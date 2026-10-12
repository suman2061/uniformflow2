export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { requireSuperAdmin, isSuperAdminSession } from '@/lib/tenant';
import { createAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const sa = await requireSuperAdmin();
  if (!isSuperAdminSession(sa)) return sa;

  const body = await req.json();
  const { action } = body ?? {};

  if (action === 'seed') {
    return await seedDemoData(sa);
  }

  if (action === 'remove') {
    return await removeDemoData(sa);
  }

  return NextResponse.json({ error: 'action must be seed or remove' }, { status: 400 });
}

async function seedDemoData(sa: any) {
  try {
    // Check if demo data already exists
    const existingDemo = await prisma.business.findFirst({ where: { isDemoData: true } });
    if (existingDemo) {
      return NextResponse.json({ error: 'Demo data already exists. Remove it first.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash('Demo@1234', 12);

    const result = await prisma.$transaction(async (tx: any) => {
      // Create demo business
      const business = await tx.business.create({
        data: {
          name: 'Sharma Uniforms & Textiles',
          code: 'DEMO-SHARMA',
          address: '45, Textile Market, Ring Road, Surat, Gujarat 395002',
          phone: '+91 98765 43210',
          email: 'info@sharmauniforms.demo',
          status: 'active',
          isDemoData: true,
          nextStudentSeq: 20,
        },
      });

      // Create demo owner
      const owner = await tx.user.create({
        data: {
          businessId: business.id,
          email: 'demo@uniformflow.app',
          passwordHash,
          name: 'Rajesh Sharma',
          phone: '+91 98765 43210',
          role: 'BUSINESS_OWNER',
          active: true,
          isDemoData: true,
        },
      });

      // Create schools
      const school1 = await tx.school.create({
        data: {
          businessId: business.id, name: 'Delhi Public School, Surat', code: 'DPS-SUR',
          address: 'Canal Road, Athwa, Surat, Gujarat 395007',
          phone: '+91 261 2654321', email: 'admin@dpssurat.demo',
          contactPerson: 'Mrs. Priya Mehta', billingName: 'DPS Surat Education Society',
          gstin: '24AABCD1234E1Z5', active: true, isDemoData: true,
        },
      });

      const school2 = await tx.school.create({
        data: {
          businessId: business.id, name: 'St. Xavier\'s High School, Surat', code: 'SXS-SUR',
          address: 'Piplod, Surat, Gujarat 395007',
          phone: '+91 261 2789012', email: 'office@stxavierssurat.demo',
          contactPerson: 'Fr. Anthony D\'Souza', billingName: 'St. Xavier\'s Education Trust',
          gstin: '24AABCE5678F2Z3', active: true, isDemoData: true,
        },
      });

      // Create academic years
      const ay1 = await tx.academicYear.create({
        data: { businessId: business.id, schoolId: school1.id, name: '2026–27', isActive: true, isDemoData: true },
      });
      const ay2 = await tx.academicYear.create({
        data: { businessId: business.id, schoolId: school2.id, name: '2026–27', isActive: true, isDemoData: true },
      });

      // Create classes for school 1
      const classNames = ['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
        'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
      const classes1: any[] = [];
      for (let i = 0; i < classNames.length; i++) {
        const c = await tx.schoolClass.create({
          data: { businessId: business.id, schoolId: school1.id, name: classNames[i], sortOrder: i, isDemoData: true },
        });
        classes1.push(c);
      }

      // Fewer classes for school 2
      const classes2: any[] = [];
      for (let i = 0; i < 10; i++) {
        const c = await tx.schoolClass.create({
          data: { businessId: business.id, schoolId: school2.id, name: classNames[i], sortOrder: i, isDemoData: true },
        });
        classes2.push(c);
      }

      // Create divisions
      const divNames = ['A', 'B', 'C'];
      const divs1: any[] = [];
      for (let i = 0; i < divNames.length; i++) {
        const d = await tx.schoolDivision.create({
          data: { businessId: business.id, schoolId: school1.id, name: divNames[i], sortOrder: i, isDemoData: true },
        });
        divs1.push(d);
      }
      const divs2: any[] = [];
      for (let i = 0; i < 2; i++) {
        const d = await tx.schoolDivision.create({
          data: { businessId: business.id, schoolId: school2.id, name: divNames[i], sortOrder: i, isDemoData: true },
        });
        divs2.push(d);
      }

      // Create products
      const products = [
        { name: 'White Cotton Shirt (Boys)', sku: 'SHT-WHT-B', category: 'Shirt', costPrice: 280, sellingPrice: 450, fabricType: 'Cotton', color: 'White' },
        { name: 'White Cotton Shirt (Girls)', sku: 'SHT-WHT-G', category: 'Shirt', costPrice: 270, sellingPrice: 430, fabricType: 'Cotton', color: 'White' },
        { name: 'Grey Trouser (Boys)', sku: 'TRS-GRY-B', category: 'Trouser', costPrice: 320, sellingPrice: 520, fabricType: 'Polyester Blend', color: 'Grey' },
        { name: 'Grey Skirt (Girls)', sku: 'SKT-GRY-G', category: 'Skirt', costPrice: 300, sellingPrice: 480, fabricType: 'Polyester Blend', color: 'Grey' },
        { name: 'School Tie', sku: 'TIE-NVY', category: 'Tie', costPrice: 80, sellingPrice: 150, fabricType: 'Silk Blend', color: 'Navy Blue' },
        { name: 'Leather Belt', sku: 'BLT-BLK', category: 'Belt', costPrice: 120, sellingPrice: 220, fabricType: 'Leather', color: 'Black' },
        { name: 'Navy Blue Blazer', sku: 'BLZ-NVY', category: 'Blazer', costPrice: 800, sellingPrice: 1450, fabricType: 'Wool Blend', color: 'Navy Blue' },
        { name: 'Sports T-Shirt', sku: 'SPT-TSH', category: 'Sports Uniform', costPrice: 200, sellingPrice: 350, fabricType: 'Dri-fit', color: 'House Colors' },
        { name: 'Sports Shorts', sku: 'SPT-SHT', category: 'Sports Uniform', costPrice: 180, sellingPrice: 300, fabricType: 'Polyester', color: 'Navy Blue' },
        { name: 'White Socks (3-pack)', sku: 'SCK-WHT-3', category: 'Socks', costPrice: 90, sellingPrice: 160, fabricType: 'Cotton Blend', color: 'White' },
      ];

      const createdProducts: any[] = [];
      for (const p of products) {
        const created = await tx.product.create({
          data: {
            businessId: business.id, ...p,
            measurementFields: ['Shirt', 'Blazer'].includes(p.category)
              ? ['chest', 'shoulder', 'shirtLength', 'sleeveLength']
              : ['Trouser', 'Skirt'].includes(p.category)
                ? ['waist', 'hip', 'trouserLength']
                : null,
            isDemoData: true,
          },
        });
        createdProducts.push(created);
      }

      // Map products to schools
      for (const prod of createdProducts) {
        await tx.schoolProduct.create({
          data: {
            businessId: business.id, schoolId: school1.id, academicYearId: ay1.id,
            productId: prod.id, isMandatory: !['Blazer', 'Sports Uniform'].includes(prod.category),
            isDemoData: true,
          },
        });
      }
      // School 2 gets fewer products
      for (const prod of createdProducts.slice(0, 6)) {
        await tx.schoolProduct.create({
          data: {
            businessId: business.id, schoolId: school2.id, academicYearId: ay2.id,
            productId: prod.id, priceOverride: Number(prod.sellingPrice) + 20,
            isMandatory: true, isDemoData: true,
          },
        });
      }

      // Create demo students
      const studentNames = [
        { name: 'Aarav Patel', gender: 'Male', parent: 'Vikram Patel', phone: '+91 99887 11001' },
        { name: 'Ananya Singh', gender: 'Female', parent: 'Amit Singh', phone: '+91 99887 11002' },
        { name: 'Vihaan Sharma', gender: 'Male', parent: 'Suresh Sharma', phone: '+91 99887 11003' },
        { name: 'Diya Gupta', gender: 'Female', parent: 'Rakesh Gupta', phone: '+91 99887 11004' },
        { name: 'Arjun Reddy', gender: 'Male', parent: 'Krishna Reddy', phone: '+91 99887 11005' },
        { name: 'Ishita Joshi', gender: 'Female', parent: 'Manoj Joshi', phone: '+91 99887 11006' },
        { name: 'Kabir Malhotra', gender: 'Male', parent: 'Sanjay Malhotra', phone: '+91 99887 11007' },
        { name: 'Myra Verma', gender: 'Female', parent: 'Pradeep Verma', phone: '+91 99887 11008' },
        { name: 'Reyansh Agarwal', gender: 'Male', parent: 'Nitin Agarwal', phone: '+91 99887 11009' },
        { name: 'Saanvi Desai', gender: 'Female', parent: 'Hemant Desai', phone: '+91 99887 11010' },
        { name: 'Aditya Nair', gender: 'Male', parent: 'Vijay Nair', phone: '+91 99887 11011' },
        { name: 'Prisha Iyer', gender: 'Female', parent: 'Ramesh Iyer', phone: '+91 99887 11012' },
        { name: 'Vivaan Saxena', gender: 'Male', parent: 'Ashish Saxena', phone: '+91 99887 11013' },
        { name: 'Aanya Kumar', gender: 'Female', parent: 'Rajiv Kumar', phone: '+91 99887 11014' },
        { name: 'Dhruv Bhatt', gender: 'Male', parent: 'Manish Bhatt', phone: '+91 99887 11015' },
        { name: 'Kiara Chopra', gender: 'Female', parent: 'Vinod Chopra', phone: '+91 99887 11016' },
        { name: 'Arnav Mishra', gender: 'Male', parent: 'Deepak Mishra', phone: '+91 99887 11017' },
        { name: 'Navya Tiwari', gender: 'Female', parent: 'Alok Tiwari', phone: '+91 99887 11018' },
        { name: 'Shaurya Rao', gender: 'Male', parent: 'Sudhir Rao', phone: '+91 99887 11019' },
        { name: 'Avni Pandey', gender: 'Female', parent: 'Gaurav Pandey', phone: '+91 99887 11020' },
      ];

      // 14 students for school1, 6 for school2
      for (let i = 0; i < studentNames.length; i++) {
        const s = studentNames[i];
        const isSchool1 = i < 14;
        const schoolId = isSchool1 ? school1.id : school2.id;
        const ayId = isSchool1 ? ay1.id : ay2.id;
        const clsArr = isSchool1 ? classes1 : classes2;
        const divArr = isSchool1 ? divs1 : divs2;
        const clsIdx = i % clsArr.length;
        const divIdx = i % divArr.length;

        const student = await tx.student.create({
          data: {
            businessId: business.id, schoolId,
            permanentId: `UF-${String(i + 1).padStart(6, '0')}`,
            name: s.name, gender: s.gender,
            uniformCategory: s.gender === 'Male' ? 'Boys' : 'Girls',
            parentName: s.parent, parentPhone: s.phone,
            isDemoData: true,
          },
        });

        await tx.enrollment.create({
          data: {
            businessId: business.id, studentId: student.id, schoolId,
            academicYearId: ayId, classId: clsArr[clsIdx].id,
            divisionId: divArr[divIdx].id, rollNumber: String(i + 1),
            isDemoData: true,
          },
        });
      }

      return { business, owner };
    });

    await createAuditLog({
      businessId: null,
      userId: sa.userId,
      userName: sa.userName,
      action: 'CREATE',
      entityType: 'DemoData',
      summary: 'Demo data seeded successfully',
    });

    return NextResponse.json({
      success: true,
      demoLogin: { email: 'demo@uniformflow.app', password: 'Demo@1234' },
      businessName: result.business.name,
    });
  } catch (error: any) {
    console.error('Seed demo data error:', error);
    return NextResponse.json({ error: 'Failed to seed demo data: ' + (error?.message ?? '') }, { status: 500 });
  }
}

async function removeDemoData(sa: any) {
  try {
    // Remove in dependency order
    // Phase 3 — Business Operations (child → parent)
    await prisma.subscription.deleteMany({ where: { isDemoData: true } });
    await prisma.plan.deleteMany({ where: { isDemoData: true } });
    await prisma.paymentAllocation.deleteMany({ where: { isDemoData: true } });
    await prisma.payment.deleteMany({ where: { isDemoData: true } });
    await prisma.invoiceLine.deleteMany({ where: { isDemoData: true } });
    await prisma.invoice.deleteMany({ where: { isDemoData: true } });
    await prisma.deliveryLine.deleteMany({ where: { isDemoData: true } });
    await prisma.delivery.deleteMany({ where: { isDemoData: true } });
    await prisma.fabricReceipt.deleteMany({ where: { isDemoData: true } });
    await prisma.purchaseOrder.deleteMany({ where: { isDemoData: true } });
    await prisma.productionBatch.deleteMany({ where: { isDemoData: true } });
    await prisma.fabricRequirement.deleteMany({ where: { isDemoData: true } });
    await prisma.orderLine.deleteMany({ where: { isDemoData: true } });
    await prisma.order.deleteMany({ where: { isDemoData: true } });
    await prisma.notification.deleteMany({ where: { isDemoData: true } });
    await prisma.measurementHistory.deleteMany({ where: { measurement: { is: { isDemoData: true } } } });
    await prisma.measurement.deleteMany({ where: { isDemoData: true } });
    await prisma.measurementSubmission.deleteMany({ where: { isDemoData: true } });
    await prisma.enrollment.deleteMany({ where: { isDemoData: true } });
    await prisma.schoolProduct.deleteMany({ where: { isDemoData: true } });
    await prisma.student.deleteMany({ where: { isDemoData: true } });
    await prisma.schoolDivision.deleteMany({ where: { isDemoData: true } });
    await prisma.schoolClass.deleteMany({ where: { isDemoData: true } });
    await prisma.academicYear.deleteMany({ where: { isDemoData: true } });
    await prisma.product.deleteMany({ where: { isDemoData: true } });
    await prisma.school.deleteMany({ where: { isDemoData: true } });
    await prisma.user.deleteMany({ where: { isDemoData: true } });
    await prisma.business.deleteMany({ where: { isDemoData: true } });

    await createAuditLog({
      businessId: null,
      userId: sa.userId,
      userName: sa.userName,
      action: 'DELETE',
      entityType: 'DemoData',
      summary: 'All demo data removed',
    });

    return NextResponse.json({ success: true, message: 'Demo data removed' });
  } catch (error: any) {
    console.error('Remove demo data error:', error);
    return NextResponse.json({ error: 'Failed to remove demo data' }, { status: 500 });
  }
}
