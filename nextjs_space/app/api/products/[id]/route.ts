export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog, diffChanges } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PRODUCTS', 'VIEW');
  if (perm) return perm;

  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, businessId: tenant.businessId },
    include: { _count: { select: { schoolProducts: true } } },
  });

  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    product: { ...product, costPrice: Number(product?.costPrice ?? 0), sellingPrice: Number(product?.sellingPrice ?? 0) },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PRODUCTS', 'EDIT');
  if (perm) return perm;

  const { id } = await params;
  const existing = await prisma.product.findFirst({
    where: { id, businessId: tenant.businessId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const body = await req.json();
    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        sku: body.sku ? (body.sku as string).toUpperCase().trim() : existing.sku,
        description: body.description !== undefined ? body.description : existing.description,
        category: body.category ?? existing.category,
        fabricType: body.fabricType !== undefined ? body.fabricType : existing.fabricType,
        color: body.color !== undefined ? body.color : existing.color,
        variants: body.variants !== undefined ? body.variants : existing.variants,
        unit: body.unit ?? existing.unit,
        costPrice: body.costPrice !== undefined ? body.costPrice : existing.costPrice,
        sellingPrice: body.sellingPrice !== undefined ? body.sellingPrice : existing.sellingPrice,
        imageUrl: body.imageUrl !== undefined ? body.imageUrl : existing.imageUrl,
        thumbnailUrl: body.thumbnailUrl !== undefined ? body.thumbnailUrl : existing.thumbnailUrl,
        hasStandardSize: body.hasStandardSize !== undefined ? body.hasStandardSize : existing.hasStandardSize,
        sizeChart: body.sizeChart !== undefined ? body.sizeChart : existing.sizeChart,
        measurementFields: body.measurementFields !== undefined ? body.measurementFields : existing.measurementFields,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
      },
    });

    const changes = diffChanges(existing as any, updated as any);
    await createAuditLog({
      businessId: tenant.businessId,
      userId: tenant.userId,
      userName: tenant.userName,
      action: 'UPDATE',
      entityType: 'Product',
      entityId: id,
      summary: `Product "${updated.name}" updated`,
      changes,
    });

    return NextResponse.json({
      product: { ...updated, costPrice: Number(updated?.costPrice ?? 0), sellingPrice: Number(updated?.sellingPrice ?? 0) },
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'SKU already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PRODUCTS', 'DELETE');
  if (perm) return perm;

  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, businessId: tenant.businessId },
    include: { _count: { select: { schoolProducts: true } } },
  });
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if ((product?._count?.schoolProducts ?? 0) > 0) {
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ archived: true });
  }

  await prisma.product.delete({ where: { id } });
  await createAuditLog({
    businessId: tenant.businessId,
    userId: tenant.userId,
    userName: tenant.userName,
    action: 'DELETE',
    entityType: 'Product',
    entityId: id,
    summary: `Product "${product.name}" deleted`,
  });

  return NextResponse.json({ deleted: true });
}
