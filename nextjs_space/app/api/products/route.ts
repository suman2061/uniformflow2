export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTenant, isTenantSession } from '@/lib/tenant';
import { checkPermission } from '@/lib/rbac';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PRODUCTS', 'VIEW');
  if (perm) return perm;

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const category = url.searchParams.get('category') ?? '';
  const active = url.searchParams.get('active');
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20')));

  const where: any = { businessId: tenant.businessId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category) where.category = category;
  if (active === 'true') where.isActive = true;
  if (active === 'false') where.isActive = false;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  // Convert Decimal to number for JSON
  const serialized = (products ?? []).map((p: any) => ({
    ...p,
    costPrice: Number(p?.costPrice ?? 0),
    sellingPrice: Number(p?.sellingPrice ?? 0),
  }));

  return NextResponse.json({ products: serialized, total, page, limit });
}

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  if (!isTenantSession(tenant)) return tenant;
  const perm = checkPermission(tenant, 'PRODUCTS', 'CREATE');
  if (perm) return perm;

  try {
    const body = await req.json();
    const { name, sku, description, category, fabricType, color, variants, unit,
      costPrice, sellingPrice, imageUrl, thumbnailUrl, hasStandardSize, sizeChart, measurementFields } = body ?? {};

    if (!name || !sku || !category) {
      return NextResponse.json({ error: 'Name, SKU, and category are required' }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        businessId: tenant.businessId,
        name,
        sku: (sku as string).toUpperCase().trim(),
        description: description ?? null,
        category,
        fabricType: fabricType ?? null,
        color: color ?? null,
        variants: variants ?? null,
        unit: unit ?? 'PCS',
        costPrice: costPrice ?? 0,
        sellingPrice: sellingPrice ?? 0,
        imageUrl: imageUrl ?? null,
        thumbnailUrl: thumbnailUrl ?? null,
        hasStandardSize: hasStandardSize ?? false,
        sizeChart: sizeChart ?? null,
        measurementFields: measurementFields ?? null,
      },
    });

    await createAuditLog({
      businessId: tenant.businessId,
      userId: tenant.userId,
      userName: tenant.userName,
      action: 'CREATE',
      entityType: 'Product',
      entityId: product.id,
      summary: `Product "${name}" (${sku}) created`,
    });

    return NextResponse.json({
      product: { ...product, costPrice: Number(product?.costPrice ?? 0), sellingPrice: Number(product?.sellingPrice ?? 0) },
    }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'SKU already exists for this business' }, { status: 409 });
    }
    console.error('Create product error:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
