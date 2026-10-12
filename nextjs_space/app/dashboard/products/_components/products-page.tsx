'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Package, Plus, Search, Loader2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { hasPermission } from '@/lib/rbac';

const CATEGORIES = ['Shirt', 'Trouser', 'Skirt', 'Tunic', 'Tie', 'Belt', 'Blazer', 'Sweater', 'Sports Uniform', 'Socks', 'Other'];

export function ProductsPage({ userRole }: { userRole: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ name: '', sku: '', description: '', category: '', fabricType: '', color: '', unit: 'PCS', costPrice: 0, sellingPrice: 0 });

  const canCreate = hasPermission(userRole, 'PRODUCTS', 'CREATE');
  const canEdit = hasPermission(userRole, 'PRODUCTS', 'EDIT');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: '20', search, ...(catFilter ? { category: catFilter } : {}) });
      const res = await fetch(`/api/products?${p}`);
      const data = await res?.json();
      setProducts(data?.products ?? []);
      setTotal(data?.total ?? 0);
    } catch { } finally { setLoading(false); }
  }, [page, search, catFilter]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', sku: '', description: '', category: '', fabricType: '', color: '', unit: 'PCS', costPrice: 0, sellingPrice: 0 });
    setDialogOpen(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ name: p?.name ?? '', sku: p?.sku ?? '', description: p?.description ?? '', category: p?.category ?? '', fabricType: p?.fabricType ?? '', color: p?.color ?? '', unit: p?.unit ?? 'PCS', costPrice: p?.costPrice ?? 0, sellingPrice: p?.sellingPrice ?? 0 });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form?.name || !form?.sku || !form?.category) { toast.error('Name, SKU, and category required'); return; }
    setSaving(true);
    try {
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `/api/products/${editing.id}` : '/api/products';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, costPrice: Number(form?.costPrice ?? 0), sellingPrice: Number(form?.sellingPrice ?? 0) }) });
      const data = await res?.json();
      if (!res.ok) { toast.error(data?.error ?? 'Failed'); return; }
      toast.success(editing ? 'Product updated' : 'Product created');
      setDialogOpen(false);
      fetchProducts();
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const totalPages = Math.ceil((total ?? 0) / 20);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Products
          </h1>
          <p className="text-muted-foreground mt-1">Manage your product catalogue</p>
        </div>
        {canCreate && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add Product</Button>}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search products..." value={search} onChange={(e: any) => { setSearch(e?.target?.value ?? ''); setPage(1); }} />
        </div>
        <Select value={catFilter || 'all'} onValueChange={(v: string) => { setCatFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden md:table-cell">Cost (₹)</TableHead>
                <TableHead>Price (₹)</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-[60px]">Edit</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (products ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No products found</TableCell></TableRow>
              ) : (
                (products ?? []).map((p: any) => (
                  <TableRow key={p?.id}>
                    <TableCell><span className="font-mono text-sm">{p?.sku ?? ''}</span></TableCell>
                    <TableCell className="font-medium">{p?.name ?? ''}</TableCell>
                    <TableCell><Badge variant="secondary">{p?.category ?? ''}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell font-mono">₹{(p?.costPrice ?? 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell className="font-mono">₹{(p?.sellingPrice ?? 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell><Badge variant={p?.isActive ? 'default' : 'secondary'}>{p?.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                    {canEdit && <TableCell><Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /></Button></TableCell>}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="flex items-center text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={form?.name ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), name: e?.target?.value ?? '' }))} /></div>
              <div className="space-y-2"><Label>SKU *</Label><Input value={form?.sku ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), sku: e?.target?.value ?? '' }))} /></div>
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={form?.category ?? ''} onValueChange={(v: string) => setForm((p: any) => ({ ...(p ?? {}), category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form?.description ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), description: e?.target?.value ?? '' }))} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Fabric Type</Label><Input value={form?.fabricType ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), fabricType: e?.target?.value ?? '' }))} /></div>
              <div className="space-y-2"><Label>Color</Label><Input value={form?.color ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), color: e?.target?.value ?? '' }))} /></div>
              <div className="space-y-2"><Label>Unit</Label><Input value={form?.unit ?? 'PCS'} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), unit: e?.target?.value ?? 'PCS' }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Cost Price (₹)</Label><Input type="number" value={form?.costPrice ?? 0} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), costPrice: e?.target?.value ?? 0 }))} /></div>
              <div className="space-y-2"><Label>Selling Price (₹)</Label><Input type="number" value={form?.sellingPrice ?? 0} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), sellingPrice: e?.target?.value ?? 0 }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
