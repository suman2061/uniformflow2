import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding UniformFlow database...');

  // ─── Hidden test account (SUPER_ADMIN) ───
  const testEmail = 'abacus-5df39159@example.com';
  const testPwHash = await bcrypt.hash('FA#u81RusX', 12);
  await prisma.user.upsert({
    where: { email: testEmail },
    update: { passwordHash: testPwHash, active: true },
    create: {
      email: testEmail,
      passwordHash: testPwHash,
      name: 'System Admin',
      role: 'SUPER_ADMIN',
      active: true,
      businessId: null,
    },
  });
  console.log('  ✓ Test account ready');

  // ─── Demo Business ───
  const demoCode = 'DEMO-UNIFORM';
  let demoBusiness = await prisma.business.findUnique({ where: { code: demoCode } });
  if (!demoBusiness) {
    demoBusiness = await prisma.business.create({
      data: {
        name: 'Sharma Uniforms Pvt Ltd',
        code: demoCode,
        address: '42 MG Road, Andheri West, Mumbai, Maharashtra 400058',
        phone: '+91 22 2637 1000',
        email: 'info@sharmauniforms.in',
        status: 'active',
        isDemoData: true,
        nextStudentSeq: 0,
      },
    });
  }
  const bId = demoBusiness.id;
  console.log('  ✓ Demo business:', demoBusiness.name);

  // ─── Demo Owner User ───
  const demoOwnerEmail = 'demo@uniformflow.app';
  const demoOwnerPwHash = await bcrypt.hash('Demo@1234', 12);
  await prisma.user.upsert({
    where: { email: demoOwnerEmail },
    update: { passwordHash: demoOwnerPwHash, businessId: bId, active: true },
    create: {
      email: demoOwnerEmail,
      passwordHash: demoOwnerPwHash,
      name: 'Rajesh Sharma',
      role: 'BUSINESS_OWNER',
      businessId: bId,
      active: true,
      isDemoData: true,
    },
  });
  console.log('  ✓ Demo owner: demo@uniformflow.app / Demo@1234');

  // ─── Demo Staff Users ───
  const staffUsers = [
    { email: 'admin@sharmauniforms.in', name: 'Priya Desai', role: 'BUSINESS_ADMIN' },
    { email: 'ops@sharmauniforms.in', name: 'Amit Kulkarni', role: 'OPERATIONS_MANAGER' },
    { email: 'accounts@sharmauniforms.in', name: 'Neha Gupta', role: 'ACCOUNTS_MANAGER' },
    { email: 'data@sharmauniforms.in', name: 'Sanjay Patil', role: 'DATA_ENTRY_OPERATOR' },
  ];
  const staffPwHash = await bcrypt.hash('Staff@1234', 12);
  for (const s of staffUsers) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: { passwordHash: staffPwHash, businessId: bId, active: true },
      create: {
        email: s.email,
        passwordHash: staffPwHash,
        name: s.name,
        role: s.role,
        businessId: bId,
        active: true,
        isDemoData: true,
      },
    });
  }
  console.log('  ✓ Demo staff users created');

  // ─── Schools ───
  const schools = [
    { code: 'DPS-MUM', name: 'Delhi Public School, Mumbai', address: 'Nerul, Navi Mumbai, Maharashtra 400706', phone: '+91 22 2770 1234', contactPerson: 'Mrs. Sunita Reddy' },
    { code: 'RIS-PUN', name: 'Ryan International School, Pune', address: 'Kalyani Nagar, Pune, Maharashtra 411006', phone: '+91 20 2665 5678', contactPerson: 'Mr. Vikram Joshi' },
    { code: 'DAV-THA', name: 'DAV Public School, Thane', address: 'Ghodbunder Road, Thane West, Maharashtra 400607', phone: '+91 22 2597 4321', contactPerson: 'Mrs. Kavita Menon' },
  ];

  const schoolRecords: any[] = [];
  for (const s of schools) {
    const rec = await prisma.school.upsert({
      where: { businessId_code: { businessId: bId, code: s.code } },
      update: { name: s.name, address: s.address, phone: s.phone, contactPerson: s.contactPerson, active: true },
      create: {
        businessId: bId, ...s, active: true, isDemoData: true,
      },
    });
    schoolRecords.push(rec);
  }
  console.log('  ✓ 3 schools created');

  // ─── Academic Years ───
  const ayRecords: any[] = [];
  for (const school of schoolRecords) {
    for (const ayName of ['2024-25', '2025-26']) {
      const ay = await prisma.academicYear.upsert({
        where: { businessId_schoolId_name: { businessId: bId, schoolId: school.id, name: ayName } },
        update: { isActive: ayName === '2025-26' },
        create: {
          businessId: bId,
          schoolId: school.id,
          name: ayName,
          startsOn: new Date(`${ayName.split('-')[0]}-04-01`),
          endsOn: new Date(`20${ayName.split('-')[1]}-03-31`),
          isActive: ayName === '2025-26',
          isDemoData: true,
        },
      });
      ayRecords.push({ ...ay, schoolId: school.id });
    }
  }
  console.log('  ✓ Academic years created');

  // ─── Classes & Divisions ───
  const classNames = ['Nursery', 'LKG', 'UKG', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const divisionNames = ['A', 'B', 'C'];

  const classMap: Record<string, any[]> = {};
  const divisionMap: Record<string, any[]> = {};

  for (const school of schoolRecords) {
    classMap[school.id] = [];
    divisionMap[school.id] = [];
    for (let i = 0; i < classNames.length; i++) {
      const cls = await prisma.schoolClass.upsert({
        where: { businessId_schoolId_name: { businessId: bId, schoolId: school.id, name: classNames[i] } },
        update: { sortOrder: i, active: true },
        create: {
          businessId: bId, schoolId: school.id, name: classNames[i], sortOrder: i, active: true, isDemoData: true,
        },
      });
      classMap[school.id].push(cls);
    }
    for (let i = 0; i < divisionNames.length; i++) {
      const div = await prisma.schoolDivision.upsert({
        where: { businessId_schoolId_name: { businessId: bId, schoolId: school.id, name: divisionNames[i] } },
        update: { sortOrder: i, active: true },
        create: {
          businessId: bId, schoolId: school.id, name: divisionNames[i], sortOrder: i, active: true, isDemoData: true,
        },
      });
      divisionMap[school.id].push(div);
    }
  }
  console.log('  ✓ Classes and divisions created');

  // ─── Products ───
  const products = [
    { sku: 'SH-WH-001', name: 'White School Shirt (Boys)', category: 'Shirt', fabricType: 'Cotton Blend', color: 'White', costPrice: 280, sellingPrice: 450, unit: 'PCS' },
    { sku: 'SH-WH-002', name: 'White School Shirt (Girls)', category: 'Shirt', fabricType: 'Cotton Blend', color: 'White', costPrice: 280, sellingPrice: 450, unit: 'PCS' },
    { sku: 'TR-GR-001', name: 'Grey School Trouser (Boys)', category: 'Trouser', fabricType: 'Poly-Viscose', color: 'Grey', costPrice: 320, sellingPrice: 520, unit: 'PCS' },
    { sku: 'SK-NV-001', name: 'Navy Pleated Skirt (Girls)', category: 'Skirt', fabricType: 'Poly-Viscose', color: 'Navy Blue', costPrice: 300, sellingPrice: 490, unit: 'PCS' },
    { sku: 'TN-MR-001', name: 'Maroon Tunic (Girls)', category: 'Tunic', fabricType: 'Cotton', color: 'Maroon', costPrice: 350, sellingPrice: 550, unit: 'PCS' },
    { sku: 'TI-STR-001', name: 'Striped School Tie', category: 'Tie', fabricType: 'Polyester', color: 'Navy/Gold', costPrice: 80, sellingPrice: 180, unit: 'PCS' },
    { sku: 'BL-NV-001', name: 'Navy Blue Blazer', category: 'Blazer', fabricType: 'Polyester Blend', color: 'Navy Blue', costPrice: 750, sellingPrice: 1400, unit: 'PCS' },
    { sku: 'SW-MR-001', name: 'Maroon V-Neck Sweater', category: 'Sweater', fabricType: 'Acrylic Wool', color: 'Maroon', costPrice: 400, sellingPrice: 700, unit: 'PCS' },
    { sku: 'SP-WH-001', name: 'White Sports T-Shirt', category: 'Sports Uniform', fabricType: 'Dri-Fit', color: 'White', costPrice: 200, sellingPrice: 380, unit: 'PCS' },
    { sku: 'SP-NV-001', name: 'Navy Sports Shorts', category: 'Sports Uniform', fabricType: 'Polyester', color: 'Navy Blue', costPrice: 180, sellingPrice: 320, unit: 'PCS' },
    { sku: 'BT-BK-001', name: 'Black Leather Belt', category: 'Belt', fabricType: 'Leather', color: 'Black', costPrice: 90, sellingPrice: 200, unit: 'PCS' },
    { sku: 'SK-WH-001', name: 'White Cotton Socks (Pair)', category: 'Socks', fabricType: 'Cotton', color: 'White', costPrice: 30, sellingPrice: 60, unit: 'PAIR' },
  ];

  const productRecords: any[] = [];
  for (const p of products) {
    const rec = await prisma.product.upsert({
      where: { businessId_sku: { businessId: bId, sku: p.sku } },
      update: { name: p.name, category: p.category, costPrice: p.costPrice, sellingPrice: p.sellingPrice, isActive: true },
      create: {
        businessId: bId, ...p, isActive: true, isDemoData: true,
      },
    });
    productRecords.push(rec);
  }
  console.log('  ✓ 12 products created');

  // ─── Students with Enrollments ───
  const indianNames = [
    { name: 'Aarav Patel', gender: 'Male', parent: 'Ramesh Patel', phone: '+91 98201 11001' },
    { name: 'Ananya Sharma', gender: 'Female', parent: 'Suresh Sharma', phone: '+91 98201 11002' },
    { name: 'Vihaan Reddy', gender: 'Male', parent: 'Kiran Reddy', phone: '+91 98201 11003' },
    { name: 'Diya Iyer', gender: 'Female', parent: 'Srinivas Iyer', phone: '+91 98201 11004' },
    { name: 'Arjun Mehta', gender: 'Male', parent: 'Prakash Mehta', phone: '+91 98201 11005' },
    { name: 'Ishita Nair', gender: 'Female', parent: 'Ravi Nair', phone: '+91 98201 11006' },
    { name: 'Reyansh Joshi', gender: 'Male', parent: 'Manish Joshi', phone: '+91 98201 11007' },
    { name: 'Saanvi Desai', gender: 'Female', parent: 'Nitin Desai', phone: '+91 98201 11008' },
    { name: 'Kabir Singh', gender: 'Male', parent: 'Harpreet Singh', phone: '+91 98201 11009' },
    { name: 'Mira Kulkarni', gender: 'Female', parent: 'Ajay Kulkarni', phone: '+91 98201 11010' },
    { name: 'Advait Gupta', gender: 'Male', parent: 'Vikram Gupta', phone: '+91 98201 11011' },
    { name: 'Kiara Fernandes', gender: 'Female', parent: 'Michael Fernandes', phone: '+91 98201 11012' },
    { name: 'Rohan Verma', gender: 'Male', parent: 'Dinesh Verma', phone: '+91 98201 11013' },
    { name: 'Anika Choudhary', gender: 'Female', parent: 'Rajiv Choudhary', phone: '+91 98201 11014' },
    { name: 'Dev Saxena', gender: 'Male', parent: 'Alok Saxena', phone: '+91 98201 11015' },
    { name: 'Prisha Bhat', gender: 'Female', parent: 'Ganesh Bhat', phone: '+91 98201 11016' },
    { name: 'Yash Agarwal', gender: 'Male', parent: 'Sanjay Agarwal', phone: '+91 98201 11017' },
    { name: 'Navya Rao', gender: 'Female', parent: 'Sudhir Rao', phone: '+91 98201 11018' },
    { name: 'Vivaan Kapoor', gender: 'Male', parent: 'Rahul Kapoor', phone: '+91 98201 11019' },
    { name: 'Tara Pillai', gender: 'Female', parent: 'Anand Pillai', phone: '+91 98201 11020' },
    { name: 'Siddharth Tiwari', gender: 'Male', parent: 'Manoj Tiwari', phone: '+91 98201 11021' },
    { name: 'Myra Chatterjee', gender: 'Female', parent: 'Subhash Chatterjee', phone: '+91 98201 11022' },
    { name: 'Aryan Mishra', gender: 'Male', parent: 'Vivek Mishra', phone: '+91 98201 11023' },
    { name: 'Zara Khan', gender: 'Female', parent: 'Imran Khan', phone: '+91 98201 11024' },
    { name: 'Parth Hegde', gender: 'Male', parent: 'Vinay Hegde', phone: '+91 98201 11025' },
    { name: 'Riya Pandey', gender: 'Female', parent: 'Ashok Pandey', phone: '+91 98201 11026' },
    { name: 'Keshav Jain', gender: 'Male', parent: 'Deepak Jain', phone: '+91 98201 11027' },
    { name: 'Aisha Siddiqui', gender: 'Female', parent: 'Farooq Siddiqui', phone: '+91 98201 11028' },
    { name: 'Pranav Deshpande', gender: 'Male', parent: 'Sunil Deshpande', phone: '+91 98201 11029' },
    { name: 'Lavanya Nambiar', gender: 'Female', parent: 'Rajesh Nambiar', phone: '+91 98201 11030' },
  ];

  // Distribute students across schools
  let seqCounter = demoBusiness.nextStudentSeq;
  const studentsPerSchool = 10;

  for (let si = 0; si < schoolRecords.length; si++) {
    const school = schoolRecords[si];
    const schoolClasses = classMap[school.id];
    const schoolDivisions = divisionMap[school.id];
    const activeAy = ayRecords.find((a: any) => a.schoolId === school.id && a.isActive);

    for (let j = 0; j < studentsPerSchool; j++) {
      const idx = si * studentsPerSchool + j;
      if (idx >= indianNames.length) break;
      const n = indianNames[idx];
      seqCounter++;
      const permanentId = `UF-${String(seqCounter).padStart(6, '0')}`;
      const uniformCategory = n.gender === 'Male' ? 'Boys' : 'Girls';

      const student = await prisma.student.upsert({
        where: { businessId_permanentId: { businessId: bId, permanentId } },
        update: { name: n.name, schoolId: school.id, status: 'active' },
        create: {
          businessId: bId,
          schoolId: school.id,
          permanentId,
          name: n.name,
          gender: n.gender,
          uniformCategory,
          parentName: n.parent,
          parentPhone: n.phone,
          status: 'active',
          isDemoData: true,
        },
      });

      // Enroll in active academic year
      if (activeAy) {
        const classIdx = j % schoolClasses.length;
        const divIdx = j % schoolDivisions.length;
        await prisma.enrollment.upsert({
          where: {
            businessId_academicYearId_studentId: {
              businessId: bId,
              academicYearId: activeAy.id,
              studentId: student.id,
            },
          },
          update: { classId: schoolClasses[classIdx].id, divisionId: schoolDivisions[divIdx].id, status: 'enrolled' },
          create: {
            businessId: bId,
            studentId: student.id,
            schoolId: school.id,
            academicYearId: activeAy.id,
            classId: schoolClasses[classIdx].id,
            divisionId: schoolDivisions[divIdx].id,
            rollNumber: String(j + 1),
            status: 'enrolled',
            isDemoData: true,
          },
        });
      }
    }
  }

  // Update the sequence counter
  await prisma.business.update({
    where: { id: bId },
    data: { nextStudentSeq: seqCounter },
  });
  console.log('  ✓ 30 students with enrollments created');

  // ─── School-Product Mappings ───
  for (const school of schoolRecords) {
    const activeAy = ayRecords.find((a: any) => a.schoolId === school.id && a.isActive);
    if (!activeAy) continue;
    // Map first 8 products to each school
    for (let pi = 0; pi < Math.min(8, productRecords.length); pi++) {
      const prod = productRecords[pi];
      await prisma.schoolProduct.upsert({
        where: {
          businessId_schoolId_academicYearId_productId: {
            businessId: bId,
            schoolId: school.id,
            academicYearId: activeAy.id,
            productId: prod.id,
          },
        },
        update: { isActive: true },
        create: {
          businessId: bId,
          schoolId: school.id,
          academicYearId: activeAy.id,
          productId: prod.id,
          isMandatory: pi < 4,
          isActive: true,
          isDemoData: true,
        },
      });
    }
  }
  console.log('  ✓ School-product mappings created');

  // ─── Demo Measurement Submissions & Measurements ───
  const DEMO_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
  const enrollments = await prisma.enrollment.findMany({
    where: { businessId: bId, isDemoData: true, status: 'enrolled' },
    include: { student: true, academicYear: true },
  });
  const spBySchoolYear: Record<string, any[]> = {};
  const allSp = await prisma.schoolProduct.findMany({
    where: { businessId: bId, isActive: true },
    include: { product: true },
  });
  for (const sp of allSp) {
    const key = `${sp.schoolId}|${sp.academicYearId}`;
    (spBySchoolYear[key] = spBySchoolYear[key] ?? []).push(sp);
  }

  // Status distribution to showcase the full pipeline
  const statusCycle = [
    'VERIFIED', 'VERIFIED', 'VERIFIED', 'SUBMITTED', 'SUBMITTED',
    'LINK_SENT', 'IN_PROGRESS', 'LINK_NOT_GENERATED', 'REJECTED', 'LINK_SENT',
  ];
  const owner = await prisma.user.findFirst({ where: { businessId: bId, role: 'BUSINESS_OWNER' } });
  let mIdx = 0;
  for (const en of enrollments) {
    const status = statusCycle[mIdx % statusCycle.length];
    mIdx++;
    const now = new Date();
    const isSubmitted = ['SUBMITTED', 'VERIFIED', 'REJECTED'].includes(status);
    const isVerified = status === 'VERIFIED';

    const submission = await prisma.measurementSubmission.upsert({
      where: {
        businessId_academicYearId_studentId: {
          businessId: bId,
          academicYearId: en.academicYearId,
          studentId: en.studentId,
        },
      },
      update: { status },
      create: {
        businessId: bId,
        schoolId: en.schoolId,
        academicYearId: en.academicYearId,
        studentId: en.studentId,
        enrollmentId: en.id,
        status,
        tokenExpiresAt: status === 'LINK_NOT_GENERATED' ? null : new Date(now.getTime() + 30 * 86400000),
        sendCount: status === 'LINK_NOT_GENERATED' ? 0 : 1,
        lastSentAt: status === 'LINK_NOT_GENERATED' ? null : now,
        submittedAt: isSubmitted ? now : null,
        verifiedById: isVerified && owner ? owner.id : null,
        verifiedAt: isVerified ? now : null,
        rejectionReason: status === 'REJECTED' ? 'Measurements looked inconsistent, please re-measure.' : null,
        isDemoData: true,
      },
    });

    // Create measurements for submitted/verified students
    if (isSubmitted && status !== 'REJECTED') {
      const sps = (spBySchoolYear[`${en.schoolId}|${en.academicYearId}`] ?? []).slice(0, 4);
      for (let pi = 0; pi < sps.length; pi++) {
        const sp = sps[pi];
        const size = DEMO_SIZES[(mIdx + pi) % DEMO_SIZES.length];
        await prisma.measurement.upsert({
          where: {
            businessId_studentId_academicYearId_productId: {
              businessId: bId,
              studentId: en.studentId,
              academicYearId: en.academicYearId,
              productId: sp.productId,
            },
          },
          update: { size },
          create: {
            businessId: bId,
            studentId: en.studentId,
            academicYearId: en.academicYearId,
            productId: sp.productId,
            submissionId: submission.id,
            source: 'SELF_SERVICE',
            size,
            isDemoData: true,
          },
        });
      }
    }
  }
  console.log('  ✓ Demo measurement submissions & measurements created');

  // ============================================================
  // PHASE 3 — BUSINESS OPERATIONS DEMO DATA
  // ============================================================
  const p3now = new Date();
  const p3School = schoolRecords[0];
  const p3Ay = ayRecords.find((a: any) => a.schoolId === p3School.id && a.isActive);
  const p3Owner = await prisma.user.findFirst({ where: { businessId: bId, role: 'BUSINESS_OWNER' } });
  if (p3School && p3Ay && productRecords.length >= 4) {
    const prodA = productRecords[0]; // shirt
    const prodB = productRecords[2]; // trouser
    const prodC = productRecords[6]; // blazer

    // ---- Orders across different statuses ----
    const orderSpecs = [
      { num: 'ORD-DEMO-0001', status: 'REQUIREMENT_COLLECTION', lines: [{ p: prodA, size: 'M', qty: 40 }, { p: prodB, size: 'M', qty: 40 }] },
      { num: 'ORD-DEMO-0002', status: 'ORDER_CONFIRMED', lines: [{ p: prodA, size: 'L', qty: 60 }, { p: prodC, size: 'L', qty: 30 }] },
      { num: 'ORD-DEMO-0003', status: 'STITCHING_IN_PROGRESS', lines: [{ p: prodB, size: 'S', qty: 50 }] },
      { num: 'ORD-DEMO-0004', status: 'DELIVERED', lines: [{ p: prodA, size: 'XL', qty: 25 }, { p: prodC, size: 'XL', qty: 25 }] },
    ];
    for (const spec of orderSpecs) {
      let subtotal = 0, taxTotal = 0;
      const lineData = spec.lines.map((l) => {
        const unitPrice = Number(l.p.sellingPrice);
        const taxRate = 5;
        const base = unitPrice * l.qty;
        const tax = (base * taxRate) / 100;
        subtotal += base; taxTotal += tax;
        return {
          businessId: bId, productId: l.p.id, productName: l.p.name, size: l.size, quantity: l.qty, approvedQty: l.qty,
          unitPrice, taxRate, taxAmount: tax, lineTotal: base + tax, isDemoData: true,
        };
      });
      const grandTotal = subtotal + taxTotal;
      const existing = await prisma.order.findFirst({ where: { businessId: bId, orderNumber: spec.num } });
      if (!existing) {
        await prisma.order.create({
          data: {
            businessId: bId, orderNumber: spec.num, schoolId: p3School.id, academicYearId: p3Ay.id,
            orderType: 'SCHOOL', status: spec.status, expectedDeliveryDate: new Date(p3now.getTime() + 30 * 86400000),
            subtotal, taxTotal, grandTotal, createdById: p3Owner?.id ?? null, isDemoData: true,
            statusHistory: [{ status: spec.status, at: p3now.toISOString(), by: p3Owner?.name ?? 'System' }],
            lines: { create: lineData },
          },
        });
      }
    }
    console.log('  ✓ Demo orders created');

    // ---- Fabric requirements ----
    for (const l of [{ p: prodA, qty: 125, cpu: 1.5 }, { p: prodB, qty: 90, cpu: 1.2 }, { p: prodC, qty: 55, cpu: 2.0 }]) {
      const fabricRequired = l.qty * l.cpu * 1.1;
      const existing = await prisma.fabricRequirement.findFirst({ where: { businessId: bId, academicYearId: p3Ay.id, productId: l.p.id, size: '' } });
      if (!existing) {
        await prisma.fabricRequirement.create({
          data: {
            businessId: bId, academicYearId: p3Ay.id, productId: l.p.id, productName: l.p.name, size: '',
            totalQuantity: l.qty, consumptionPerUnit: l.cpu, wastagePercent: 10, fabricType: l.p.fabricType,
            fabricRequired, isDemoData: true,
          },
        });
      }
    }
    console.log('  ✓ Demo fabric requirements created');

    // ---- Purchase orders (one received, one ordered) ----
    const poSpecs = [
      { num: 'PO-DEMO-0001', fabric: 'Cotton Blend', qty: 200, unitCost: 120, status: 'RECEIVED', received: 200 },
      { num: 'PO-DEMO-0002', fabric: 'Poly-Viscose', qty: 150, unitCost: 140, status: 'ORDERED', received: 0 },
    ];
    for (const po of poSpecs) {
      const existing = await prisma.purchaseOrder.findFirst({ where: { businessId: bId, poNumber: po.num } });
      if (!existing) {
        const created = await prisma.purchaseOrder.create({
          data: {
            businessId: bId, poNumber: po.num, supplierName: 'Shree Textiles Mills', supplierContact: '+91 98200 11223',
            fabricType: po.fabric, quantity: po.qty, unit: 'METERS', unitCost: po.unitCost, totalCost: po.qty * po.unitCost,
            receivedQty: po.received, status: po.status, expectedDeliveryDate: new Date(p3now.getTime() + 14 * 86400000),
            createdById: p3Owner?.id ?? null, isDemoData: true,
          },
        });
        if (po.received > 0) {
          await prisma.fabricReceipt.create({
            data: { businessId: bId, purchaseOrderId: created.id, receivedQty: po.received, shortageQty: 0, receivedById: p3Owner?.id ?? null, isDemoData: true },
          });
        }
      }
    }
    console.log('  ✓ Demo purchase orders created');

    // ---- Production batches ----
    const batchSpecs = [
      { p: prodA, size: 'M', planned: 125, cut: 125, stitch: 100, done: 90, status: 'STITCHING_IN_PROGRESS', qc: 'PENDING' },
      { p: prodB, size: 'S', planned: 90, cut: 90, stitch: 90, done: 90, status: 'COMPLETED', qc: 'PASSED' },
      { p: prodC, size: 'L', planned: 55, cut: 0, stitch: 0, done: 0, status: 'PLANNED', qc: null },
    ];
    for (const b of batchSpecs) {
      const existing = await prisma.productionBatch.findFirst({ where: { businessId: bId, academicYearId: p3Ay.id, productId: b.p.id, size: b.size } });
      if (!existing) {
        await prisma.productionBatch.create({
          data: {
            businessId: bId, academicYearId: p3Ay.id, productId: b.p.id, productName: b.p.name, size: b.size,
            plannedQty: b.planned, cuttingQty: b.cut, stitchingQty: b.stitch, completedQty: b.done,
            status: b.status, qcStatus: b.qc, worker: 'In-house Unit A', vendor: null,
            plannedCompletion: new Date(p3now.getTime() + 20 * 86400000),
            actualCompletion: b.status === 'COMPLETED' ? p3now : null, isDemoData: true,
          },
        });
      }
    }
    console.log('  ✓ Demo production batches created');

    // ---- Delivery with lines ----
    const delExisting = await prisma.delivery.findFirst({ where: { businessId: bId, challanNumber: 'CH-DEMO-0001' } });
    if (!delExisting) {
      await prisma.delivery.create({
        data: {
          businessId: bId, challanNumber: 'CH-DEMO-0001', schoolId: p3School.id, academicYearId: p3Ay.id,
          recipientName: 'School Admin Office', status: 'DELIVERED', deliveryDate: p3now, createdById: p3Owner?.id ?? null, isDemoData: true,
          lines: { create: [
            { businessId: bId, productId: prodA.id, productName: prodA.name, size: 'XL', qtyRequired: 25, qtyDelivered: 25, isDemoData: true },
            { businessId: bId, productId: prodC.id, productName: prodC.name, size: 'XL', qtyRequired: 25, qtyDelivered: 25, isDemoData: true },
          ] },
        },
      });
    }
    console.log('  ✓ Demo delivery created');

    // ---- Invoice + lines + payment + allocation ----
    let invExisting = await prisma.invoice.findFirst({ where: { businessId: bId, invoiceNumber: 'INV-DEMO-0001' } });
    if (!invExisting) {
      const invLines = [
        { description: prodA.name, productId: prodA.id, quantity: 25, unitPrice: Number(prodA.sellingPrice), taxRate: 5 },
        { description: prodC.name, productId: prodC.id, quantity: 25, unitPrice: Number(prodC.sellingPrice), taxRate: 5 },
      ];
      let subtotal = 0, taxTotal = 0;
      const lineData = invLines.map((l) => {
        const base = l.unitPrice * l.quantity;
        const tax = (base * l.taxRate) / 100;
        subtotal += base; taxTotal += tax;
        return { businessId: bId, description: l.description, productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate, taxAmount: tax, lineTotal: base + tax, isDemoData: true };
      });
      const grandTotal = subtotal + taxTotal;
      invExisting = await prisma.invoice.create({
        data: {
          businessId: bId, invoiceNumber: 'INV-DEMO-0001', schoolId: p3School.id, academicYearId: p3Ay.id,
          dueDate: new Date(p3now.getTime() + 15 * 86400000), subtotal, taxTotal, grandTotal, status: 'PARTIALLY_PAID',
          createdById: p3Owner?.id ?? null, isDemoData: true, lines: { create: lineData },
        },
      });
      const payAmount = Math.round(grandTotal / 2);
      await prisma.payment.create({
        data: {
          businessId: bId, schoolId: p3School.id, invoiceId: invExisting.id, type: 'PARTIAL', method: 'BANK_TRANSFER',
          amount: payAmount, transactionRef: 'UTR-DEMO-99887', paymentDate: p3now, receivedById: p3Owner?.id ?? null, isDemoData: true,
          allocations: { create: [{ businessId: bId, invoiceId: invExisting.id, amount: payAmount, isDemoData: true }] },
        },
      });
    }
    console.log('  ✓ Demo invoice & payment created');

    // ---- Notifications ----
    const notifSpecs = [
      { type: 'ORDER', title: 'New order confirmed', body: 'Order ORD-DEMO-0002 for ' + p3School.name + ' has been confirmed.' },
      { type: 'PROCUREMENT', title: 'Fabric received', body: 'PO-DEMO-0001 fully received (200 meters).' },
      { type: 'PAYMENT', title: 'Payment received', body: 'Partial payment received against INV-DEMO-0001.' },
    ];
    const existingNotif = await prisma.notification.count({ where: { businessId: bId, isDemoData: true } });
    if (existingNotif === 0) {
      for (const n of notifSpecs) {
        await prisma.notification.create({
          data: { businessId: bId, recipientUserId: null, type: n.type, title: n.title, body: n.body, isDemoData: true },
        });
      }
    }
    console.log('  ✓ Demo notifications created');
  }

  // ─── Phase 4: Subscription Plans ───
  const planSpecs = [
    {
      name: 'Starter', slug: 'starter', monthlyPrice: 1499, annualPrice: 14990, trialDays: 14,
      maxSchools: 3, maxUsers: 3, maxStudents: 500, storageMb: 1024, sortOrder: 1,
      features: ['Measurement collection portal', 'Orders & production tracking', 'Email support'],
    },
    {
      name: 'Growth', slug: 'growth', monthlyPrice: 3999, annualPrice: 39990, trialDays: 14,
      maxSchools: 15, maxUsers: 10, maxStudents: 5000, storageMb: 5120, sortOrder: 2,
      features: ['Everything in Starter', 'Procurement & invoicing', 'Advanced reports & exports', 'Priority support'],
    },
    {
      name: 'Enterprise', slug: 'enterprise', monthlyPrice: 9999, annualPrice: 99990, trialDays: 30,
      maxSchools: 0, maxUsers: 0, maxStudents: 0, storageMb: 51200, sortOrder: 3,
      features: ['Unlimited schools, team & students', 'All modules & integrations', 'Dedicated account manager', 'Custom onboarding'],
    },
  ];
  let growthPlanId: string | null = null;
  for (const pl of planSpecs) {
    const plan = await prisma.plan.upsert({
      where: { slug: pl.slug },
      update: {
        name: pl.name, monthlyPrice: pl.monthlyPrice, annualPrice: pl.annualPrice, trialDays: pl.trialDays,
        maxSchools: pl.maxSchools, maxUsers: pl.maxUsers, maxStudents: pl.maxStudents, storageMb: pl.storageMb,
        features: pl.features, sortOrder: pl.sortOrder, active: true,
      },
      create: {
        name: pl.name, slug: pl.slug, monthlyPrice: pl.monthlyPrice, annualPrice: pl.annualPrice, trialDays: pl.trialDays,
        maxSchools: pl.maxSchools, maxUsers: pl.maxUsers, maxStudents: pl.maxStudents, storageMb: pl.storageMb,
        features: pl.features, sortOrder: pl.sortOrder, active: true, isDemoData: true,
      },
    });
    if (pl.slug === 'growth') growthPlanId = plan.id;
  }
  console.log('  ✓ Subscription plans ready (Starter / Growth / Enterprise)');

  // ─── Assign demo business an active Growth subscription ───
  if (growthPlanId) {
    await prisma.subscription.upsert({
      where: { businessId: bId },
      update: { planId: growthPlanId, status: 'active', billingCycle: 'monthly' },
      create: {
        businessId: bId, planId: growthPlanId, status: 'active', billingCycle: 'monthly',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), isDemoData: true,
      },
    });
    console.log('  ✓ Demo business subscribed to Growth plan');
  }

  // ─── Surfaced Super Admin (platform owner) ───
  const platformAdminEmail = 'superadmin@uniformflow.app';
  const platformAdminPw = 'SuperAdmin@2024';
  await prisma.user.upsert({
    where: { email: platformAdminEmail },
    update: { role: 'SUPER_ADMIN', active: true },
    create: {
      email: platformAdminEmail,
      passwordHash: await bcrypt.hash(platformAdminPw, 12),
      name: 'Platform Administrator',
      role: 'SUPER_ADMIN',
      active: true,
      businessId: null,
    },
  });
  console.log('  ✓ Platform super admin ready');

  console.log('\n✅ Seed complete!');
  console.log('   Demo login: demo@uniformflow.app / Demo@1234');
  console.log('   Super admin: superadmin@uniformflow.app / SuperAdmin@2024');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
