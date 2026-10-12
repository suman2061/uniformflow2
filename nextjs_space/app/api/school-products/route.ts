export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'SCHOOL_PRODUCTS', 'VIEW');
  if (perm) return perm;

  const url = new URL(req.url);
  const schoolId = url.searchParams.get('schoolId') ?? '';
  const academicYearId = url.searchParams.get('academicYearId') ?? '';
  const productId = url.searchParams.get('productId') ?? '';

  const where: any = { businessId: tenant.businessId };
  if (schoolId) where.schoolId = schoolId;
  if (academicYearId) where.academicYearId = academicYearId;
  if (productId) where.productId = productId;

  const mappings = await prisma.schoolProduct.findMany({
    where,
    include: {
      school: { select: { id: true, name: true, code: true } },
      academicYear: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, sku: true, category: true, sellingPrice: true, thumbnailUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const serialized = (mappings ?? []).map((m: any) => ({
    ...m,
    priceOverride: m?.priceOverride ? Number(m.priceOverride) : null,
    product: m?.product ? { ...m.product, sellingPrice: Number(m.product?.sellingPrice ?? 0) } : null,
  }));

  return NextResponse.json({ schoolProducts: serialized });
}

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'SCHOOL_PRODUCTS', 'CREATE');
  if (perm) return perm;

  try {
    const body = await req.json();
    const { schoolId, academicYearId, productId, priceOverride, applicableClassIds,
      applicableDivisionIds, uniformCategories, isMandatory } = body ?? {};

    if (!schoolId || !academicYearId || !productId) {
      return NextResponse.json({ error: 'schoolId, academicYearId, productId required' }, { status: 400 });
    }

    // Verify all belong to tenant
    const [school, year, product] = await Promise.all([
      prisma.school.findFirst({ where: { id: schoolId, businessId: tenant.businessId } }),
      prisma.academicYear.findFirst({ where: { id: academicYearId, businessId: tenant.businessId } }),
      prisma.product.findFirst({ where: { id: productId, businessId: tenant.businessId } }),
    ]);

    if (!school || !year || !product) {
      return NextResponse.json({ error: 'Invalid school, academic year, or product' }, { status: 404 });
    }

    const mapping = await prisma.schoolProduct.create({
      data: {
        businessId: tenant.businessId,
        schoolId,
        academicYearId,
        productId,
        priceOverride: priceOverride ?? null,
        applicableClassIds: applicableClassIds ?? null,
        applicableDivisionIds: applicableDivisionIds ?? null,
        uniformCategories: uniformCategories ?? null,
        isMandatory: isMandatory !== false,
      },
    });

    await createAuditLog({
      businessId: tenant.businessId,
      userId: tenant.userId,
      userName: tenant.userName,
      action: 'CREATE',
      entityType: 'SchoolProduct',
      entityId: mapping.id,
      summary: `Product "${product.name}" mapped to ${school.name} for ${year.name}`,
    });

    return NextResponse.json({ schoolProduct: mapping }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'This product is already mapped to this school for this year' }, { status: 409 });
    }
    console.error('Create school product error:', error);
    return NextResponse.json({ error: 'Failed to create mapping' }, { status: 500 });
  }
}
