export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';

function toCsv(rows: any[], headers: { key: string; label: string }[]): string {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = headers.map((h) => esc(h.label)).join(',');
  const body = rows.map((r) => headers.map((h) => esc(r[h.key])).join(',')).join('\n');
  return head + '\n' + body;
}

// A measurement is "finalized" (usable for requirements) when staff/manually recorded,
// or when its self-service submission has been verified.
function isFinalized(m: any): boolean {
  if (m.source === 'STAFF' || m.source === 'MANUAL') return true;
  return m.submission?.status === 'VERIFIED';
}

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'REPORTS', 'VIEW');
  if (perm) return perm;

  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'completion';
  const schoolId = url.searchParams.get('schoolId') ?? '';
  const academicYearId = url.searchParams.get('academicYearId') ?? '';
  const format = url.searchParams.get('format') ?? 'json';

  if (!academicYearId) {
    return NextResponse.json({ error: 'academicYearId is required' }, { status: 400 });
  }

  const subWhere: any = { businessId: tenant.businessId, academicYearId };
  if (schoolId) subWhere.schoolId = schoolId;

  // -------- COMPLETION --------
  if (type === 'completion') {
    const subs = await prisma.measurementSubmission.findMany({
      where: subWhere,
      include: { school: { select: { name: true } }, enrollment: { include: { class: { select: { name: true } } } } },
    });
    const map: Record<string, any> = {};
    for (const s of subs) {
      const key = `${s.schoolId}|${s.enrollment?.class?.name ?? '-'}`;
      if (!map[key]) map[key] = { school: s.school?.name ?? '-', className: s.enrollment?.class?.name ?? '-', total: 0, sent: 0, submitted: 0, verified: 0, pending: 0 };
      const row = map[key];
      row.total++;
      if (['LINK_SENT', 'IN_PROGRESS'].includes(s.status)) row.sent++;
      if (s.status === 'SUBMITTED') row.submitted++;
      if (s.status === 'VERIFIED') row.verified++;
      if (!['SUBMITTED', 'VERIFIED'].includes(s.status)) row.pending++;
    }
    const rows = Object.values(map).sort((a: any, b: any) => (a.school + a.className).localeCompare(b.school + b.className));
    if (format === 'csv') {
      const csv = toCsv(rows, [
        { key: 'school', label: 'School' }, { key: 'className', label: 'Class' },
        { key: 'total', label: 'Total' }, { key: 'verified', label: 'Verified' },
        { key: 'submitted', label: 'Submitted (awaiting)' }, { key: 'pending', label: 'Pending' },
      ]);
      return csvResponse(csv, 'completion-report.csv');
    }
    return NextResponse.json({ type, rows });
  }

  // Fetch finalized measurements with context for the remaining report types.
  const measurements = await prisma.measurement.findMany({
    where: { businessId: tenant.businessId, academicYearId, ...(schoolId ? { student: { is: { schoolId } } } : {}) },
    include: {
      product: { select: { name: true, category: true } },
      student: { select: { name: true, permanentId: true, uniformCategory: true, schoolId: true } },
      submission: { select: { status: true } },
    },
  });
  const finalized = measurements.filter(isFinalized);

  // -------- SIZE MATRIX (product x size) --------
  if (type === 'size-matrix') {
    const matrix: Record<string, Record<string, number>> = {};
    const sizes = new Set<string>();
    for (const m of finalized) {
      const pname = m.product?.name ?? '-';
      const size = (m.size ?? 'Custom/Manual').trim() || 'Custom/Manual';
      sizes.add(size);
      matrix[pname] = matrix[pname] ?? {};
      matrix[pname][size] = (matrix[pname][size] ?? 0) + 1;
    }
    const sizeList = Array.from(sizes).sort();
    const rows = Object.entries(matrix).map(([product, counts]) => {
      const row: any = { product };
      let total = 0;
      for (const sz of sizeList) { row[sz] = counts[sz] ?? 0; total += row[sz]; }
      row.total = total;
      return row;
    });
    if (format === 'csv') {
      const headers = [{ key: 'product', label: 'Product' }, ...sizeList.map((s) => ({ key: s, label: s })), { key: 'total', label: 'Total' }];
      return csvResponse(toCsv(rows, headers), 'size-matrix.csv');
    }
    return NextResponse.json({ type, sizes: sizeList, rows });
  }

  // -------- PROCUREMENT (qty needed per product/size) --------
  if (type === 'procurement') {
    const map: Record<string, any> = {};
    for (const m of finalized) {
      const key = `${m.product?.name ?? '-'}|${m.size ?? 'Manual'}`;
      if (!map[key]) map[key] = { product: m.product?.name ?? '-', category: m.product?.category ?? '-', size: m.size ?? 'Manual', quantity: 0 };
      map[key].quantity++;
    }
    const rows = Object.values(map).sort((a: any, b: any) => a.product.localeCompare(b.product) || String(a.size).localeCompare(String(b.size)));
    if (format === 'csv') {
      return csvResponse(toCsv(rows, [
        { key: 'product', label: 'Product' }, { key: 'category', label: 'Category' },
        { key: 'size', label: 'Size' }, { key: 'quantity', label: 'Quantity' },
      ]), 'procurement-requirements.csv');
    }
    return NextResponse.json({ type, rows });
  }

  // -------- CATEGORY breakdown --------
  if (type === 'category') {
    const map: Record<string, number> = {};
    for (const m of finalized) {
      const cat = m.product?.category ?? '-';
      map[cat] = (map[cat] ?? 0) + 1;
    }
    const rows = Object.entries(map).map(([category, quantity]) => ({ category, quantity }));
    if (format === 'csv') return csvResponse(toCsv(rows, [{ key: 'category', label: 'Category' }, { key: 'quantity', label: 'Quantity' }]), 'category-report.csv');
    return NextResponse.json({ type, rows });
  }

  // -------- PENDING students --------
  if (type === 'pending') {
    const subs = await prisma.measurementSubmission.findMany({
      where: { ...subWhere, status: { notIn: ['SUBMITTED', 'VERIFIED'] } },
      include: {
        student: { select: { name: true, permanentId: true, parentName: true, parentPhone: true } },
        school: { select: { name: true } },
        enrollment: { include: { class: { select: { name: true } }, division: { select: { name: true } } } },
      },
    });
    const rows = subs.map((s) => ({
      permanentId: s.student?.permanentId ?? '', name: s.student?.name ?? '',
      school: s.school?.name ?? '', className: s.enrollment?.class?.name ?? '',
      division: s.enrollment?.division?.name ?? '', status: s.status,
      parentName: s.student?.parentName ?? '', parentPhone: s.student?.parentPhone ?? '',
    }));
    if (format === 'csv') return csvResponse(toCsv(rows, [
      { key: 'permanentId', label: 'Student ID' }, { key: 'name', label: 'Name' },
      { key: 'school', label: 'School' }, { key: 'className', label: 'Class' }, { key: 'division', label: 'Division' },
      { key: 'status', label: 'Status' }, { key: 'parentName', label: 'Parent' }, { key: 'parentPhone', label: 'Phone' },
    ]), 'pending-students.csv');
    return NextResponse.json({ type, rows });
  }

  return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
