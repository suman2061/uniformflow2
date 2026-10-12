'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Link2, Plus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { hasPermission } from '@/lib/rbac';

export function SchoolProductsPage({ userRole }: { userRole: string }) {
  const [mappings, setMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [filterSchool, setFilterSchool] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ schoolId: '', academicYearId: '', productId: '', priceOverride: '', isMandatory: true });

  const canCreate = hasPermission(userRole, 'SCHOOL_PRODUCTS', 'CREATE');
  const canDelete = hasPermission(userRole, 'SCHOOL_PRODUCTS', 'DELETE');

  useEffect(() => {
    Promise.all([
      fetch('/api/schools?limit=100').then((r: any) => r?.json()),
      fetch('/api/products?limit=100').then((r: any) => r?.json()),
    ]).then(([s, p]: any[]) => {
      setSchools(s?.schools ?? []);
      setProducts(p?.products ?? []);
    }).catch(() => {});
  }, []);

  const fetchMappings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ ...(filterSchool ? { schoolId: filterSchool } : {}), ...(filterYear ? { academicYearId: filterYear } : {}) });
    try {
      const res = await fetch(`/api/school-products?${params}`);
      const data = await res?.json();
      setMappings(data?.schoolProducts ?? []);
    } catch { } finally { setLoading(false); }
  }, [filterSchool, filterYear]);

  useEffect(() => { fetchMappings(); }, [fetchMappings]);

  const onSchoolChange = async (sid: string) => {
    setFilterSchool(sid === 'all' ? '' : sid);
    if (sid && sid !== 'all') {
      const res = await fetch(`/api/academic-years?schoolId=${sid}`).then((r: any) => r?.json());
      setAcademicYears(res?.academicYears ?? []);
    } else {
      setAcademicYears([]);
    }
  };

  const handleCreate = async () => {
    if (!form?.schoolId || !form?.academicYearId || !form?.productId) { toast.error('All fields required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/school-products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, priceOverride: form.priceOverride ? Number(form.priceOverride) : null }),
      });
      const data = await res?.json();
      if (!res.ok) { toast.error(data?.error ?? 'Failed'); return; }
      toast.success('Product mapped to school');
      setDialogOpen(false);
      fetchMappings();
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this mapping?')) return;
    try {
      await fetch(`/api/school-products/${id}`, { method: 'DELETE' });
      toast.success('Mapping removed');
      fetchMappings();
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
            <Link2 className="h-6 w-6 text-primary" /> School-Product Mappings
          </h1>
          <p className="text-muted-foreground mt-1">Assign products to schools with price overrides</p>
        </div>
        {canCreate && <Button onClick={() => { setForm({ schoolId: '', academicYearId: '', productId: '', priceOverride: '', isMandatory: true }); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" /> Map Product</Button>}
      </div>

      <div className="flex gap-3">
        <Select value={filterSchool || 'all'} onValueChange={onSchoolChange}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="School" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            {(schools ?? []).map((s: any) => <SelectItem key={s?.id} value={s?.id}>{s?.name ?? ''}</SelectItem>)}
          </SelectContent>
        </Select>
        {filterSchool && (
          <Select value={filterYear || 'all'} onValueChange={(v: string) => setFilterYear(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {(academicYears ?? []).map((y: any) => <SelectItem key={y?.id} value={y?.id}>{y?.name ?? ''}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Price Override</TableHead>
                <TableHead>Mandatory</TableHead>
                {canDelete && <TableHead className="w-[60px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (mappings ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No mappings found</TableCell></TableRow>
              ) : (
                (mappings ?? []).map((m: any) => (
                  <TableRow key={m?.id}>
                    <TableCell>{m?.school?.name ?? ''}</TableCell>
                    <TableCell>{m?.academicYear?.name ?? ''}</TableCell>
                    <TableCell>
                      <span className="font-medium">{m?.product?.name ?? ''}</span>
                      <span className="text-muted-foreground ml-1 text-xs">({m?.product?.sku ?? ''})</span>
                    </TableCell>
                    <TableCell className="font-mono">{m?.priceOverride ? `₹${m.priceOverride.toLocaleString('en-IN')}` : '—'}</TableCell>
                    <TableCell><Badge variant={m?.isMandatory ? 'default' : 'secondary'}>{m?.isMandatory ? 'Yes' : 'No'}</Badge></TableCell>
                    {canDelete && <TableCell><Button variant="ghost" size="icon-sm" onClick={() => handleDelete(m?.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Map Product to School</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>School *</Label>
              <Select value={form?.schoolId ?? ''} onValueChange={async (v: string) => {
                setForm((p: any) => ({ ...(p ?? {}), schoolId: v, academicYearId: '' }));
                const res = await fetch(`/api/academic-years?schoolId=${v}`).then((r: any) => r?.json());
                setAcademicYears(res?.academicYears ?? []);
              }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{(schools ?? []).map((s: any) => <SelectItem key={s?.id} value={s?.id}>{s?.name ?? ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Academic Year *</Label>
              <Select value={form?.academicYearId ?? ''} onValueChange={(v: string) => setForm((p: any) => ({ ...(p ?? {}), academicYearId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{(academicYears ?? []).map((y: any) => <SelectItem key={y?.id} value={y?.id}>{y?.name ?? ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Product *</Label>
              <Select value={form?.productId ?? ''} onValueChange={(v: string) => setForm((p: any) => ({ ...(p ?? {}), productId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{(products ?? []).map((p: any) => <SelectItem key={p?.id} value={p?.id}>{p?.name ?? ''} ({p?.sku ?? ''})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Price Override (₹)</Label><Input type="number" placeholder="Leave empty for default" value={form?.priceOverride ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), priceOverride: e?.target?.value ?? '' }))} /></div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form?.isMandatory ?? true} onCheckedChange={(v: any) => setForm((p: any) => ({ ...(p ?? {}), isMandatory: !!v }))} />
              <Label>Mandatory product</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create Mapping</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
