'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { hasPermission } from '@/lib/rbac';
import { Factory, Plus, Loader2 } from 'lucide-react';

const CLS: Record<string, string> = {
  PLANNED: 'bg-slate-100 text-slate-700', CUTTING: 'bg-amber-100 text-amber-700',
  STITCHING: 'bg-purple-100 text-purple-700', QC: 'bg-fuchsia-100 text-fuchsia-700',
  COMPLETED: 'bg-green-100 text-green-700', ON_HOLD: 'bg-orange-100 text-orange-700',
};
const QC_CLS: Record<string, string> = { PENDING: 'bg-amber-100 text-amber-700', PASSED: 'bg-green-100 text-green-700', FAILED: 'bg-red-100 text-red-700' };

export function ProductionPage({ userRole }: { userRole: string }) {
  const { toast } = useToast();
  const canCreate = hasPermission(userRole, 'PRODUCTION', 'CREATE');
  const canEdit = hasPermission(userRole, 'PRODUCTION', 'EDIT');

  const [schools, setSchools] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [yearId, setYearId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<any>({ productId: '', productName: '', size: '', plannedQty: 1, worker: '', vendor: '', plannedCompletion: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const [edit, setEdit] = useState<any>(null);

  useEffect(() => {
    fetch('/api/schools?limit=100').then((r) => r.json()).then((d) => setSchools(d.schools ?? [])).catch(() => {});
    fetch('/api/products?limit=1000').then((r) => r.json()).then((d) => setProducts(d.products ?? [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (!schoolId) { setYears([]); setYearId(''); return; }
    fetch(`/api/academic-years?schoolId=${schoolId}`).then((r) => r.json()).then((d) => {
      setYears(d.academicYears ?? []);
      const active = (d.academicYears ?? []).find((y: any) => y.isActive);
      setYearId(active?.id ?? (d.academicYears?.[0]?.id ?? ''));
    }).catch(() => {});
  }, [schoolId]);

  const load = useCallback(() => {
    if (!yearId) { setBatches([]); return; }
    setLoading(true);
    const qs = new URLSearchParams({ academicYearId: yearId });
    if (statusFilter) qs.set('status', statusFilter);
    fetch(`/api/production?${qs.toString()}`).then((r) => r.json()).then((d) => setBatches(d.batches ?? [])).finally(() => setLoading(false));
  }, [yearId, statusFilter]);
  useEffect(() => { load(); }, [load]);

  function pickProduct(pid: string) {
    const prod = products.find((x) => x.id === pid);
    setForm((f: any) => ({ ...f, productId: pid, productName: prod?.name ?? '' }));
  }

  async function create() {
    if (!yearId) { toast({ title: 'Select school & year first', variant: 'destructive' }); return; }
    if (!form.productId || form.plannedQty < 1) { toast({ title: 'Product and planned quantity required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/production', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicYearId: yearId, productId: form.productId, productName: form.productName, size: form.size || null, plannedQty: Number(form.plannedQty), worker: form.worker || null, vendor: form.vendor || null, plannedCompletion: form.plannedCompletion || null, notes: form.notes || null }) });
      const d = await res.json();
      if (!res.ok) { toast({ title: 'Error', description: d.error ?? 'Failed', variant: 'destructive' }); return; }
      toast({ title: 'Production batch created' });
      setCreateOpen(false); setForm({ productId: '', productName: '', size: '', plannedQty: 1, worker: '', vendor: '', plannedCompletion: '', notes: '' }); load();
    } finally { setSaving(false); }
  }

  async function saveEdit() {
    const res = await fetch(`/api/production/${edit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuttingQty: Number(edit.cuttingQty), stitchingQty: Number(edit.stitchingQty), completedQty: Number(edit.completedQty), defectiveQty: Number(edit.defectiveQty), reworkQty: Number(edit.reworkQty), status: edit.status, qcStatus: edit.qcStatus || null }) });
    const d = await res.json();
    if (!res.ok) { toast({ title: 'Error', description: d.error ?? 'Failed', variant: 'destructive' }); return; }
    toast({ title: 'Batch updated' }); setEdit(null); load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2"><Factory className="h-6 w-6 text-primary" /> Production</h1>
          <p className="text-muted-foreground text-sm mt-1">Plan and track cutting, stitching and quality control batches.</p>
        </div>
        {canCreate && <Button onClick={() => setCreateOpen(true)} disabled={!yearId}><Plus className="h-4 w-4 mr-2" /> New Batch</Button>}
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="w-56"><Label className="text-xs">School</Label>
          <Select value={schoolId} onValueChange={setSchoolId}><SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
            <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="w-48"><Label className="text-xs">Academic Year</Label>
          <Select value={yearId} onValueChange={setYearId} disabled={!schoolId}><SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}{y.isActive ? ' (active)' : ''}</SelectItem>)}</SelectContent></Select></div>
        <div className="w-48"><Label className="text-xs">Status</Label>
          <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{['PLANNED', 'CUTTING', 'STITCHING', 'QC', 'COMPLETED', 'ON_HOLD'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...</div>
      ) : !yearId ? (
        <Card><CardContent className="py-14 text-center text-muted-foreground">Select a school and academic year to view production batches.</CardContent></Card>
      ) : batches.length === 0 ? (
        <Card><CardContent className="py-14 text-center text-muted-foreground">No production batches yet.</CardContent></Card>
      ) : (
        <Card><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr className="text-left">
            <th className="px-4 py-3">Product</th><th className="px-4 py-3">Size</th><th className="px-4 py-3 text-right">Planned</th><th className="px-4 py-3 text-right">Cut</th><th className="px-4 py-3 text-right">Stitched</th><th className="px-4 py-3 text-right">Done</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">QC</th><th className="px-4 py-3"></th></tr></thead>
          <tbody>{batches.map((b) => (
            <tr key={b.id} className="border-b last:border-0"><td className="px-4 py-3">{b.productName}</td><td className="px-4 py-3">{b.size || '—'}</td><td className="px-4 py-3 text-right">{b.plannedQty}</td><td className="px-4 py-3 text-right">{b.cuttingQty}</td><td className="px-4 py-3 text-right">{b.stitchingQty}</td><td className="px-4 py-3 text-right">{b.completedQty}</td>
              <td className="px-4 py-3"><Badge className={CLS[b.status] ?? 'bg-muted'} variant="secondary">{b.status}</Badge></td>
              <td className="px-4 py-3">{b.qcStatus ? <Badge className={QC_CLS[b.qcStatus]} variant="secondary">{b.qcStatus}</Badge> : '—'}</td>
              <td className="px-4 py-3 text-right">{canEdit && <Button variant="outline" size="sm" onClick={() => setEdit({ ...b, qcStatus: b.qcStatus ?? '' })}>Update</Button>}</td>
            </tr>
          ))}</tbody>
        </table></CardContent></Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Production Batch</DialogTitle><DialogDescription>Plan a batch for cutting and stitching.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="text-xs">Product</Label>
              <Select value={form.productId} onValueChange={pickProduct}><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Size</Label><Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="e.g. 32" /></div>
            <div><Label className="text-xs">Planned Qty</Label><Input type="number" value={form.plannedQty} onChange={(e) => setForm({ ...form, plannedQty: e.target.value })} /></div>
            <div><Label className="text-xs">Worker</Label><Input value={form.worker} onChange={(e) => setForm({ ...form, worker: e.target.value })} /></div>
            <div><Label className="text-xs">Vendor</Label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
            <div className="col-span-2"><Label className="text-xs">Planned Completion</Label><Input type="date" value={form.plannedCompletion} onChange={(e) => setForm({ ...form, plannedCompletion: e.target.value })} /></div>
            <div className="col-span-2"><Label className="text-xs">Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={create} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          {edit && (<>
            <DialogHeader><DialogTitle>Update Batch — {edit.productName}</DialogTitle><DialogDescription>Record progress quantities and quality status.</DialogDescription></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Cutting Qty</Label><Input type="number" value={edit.cuttingQty} onChange={(e) => setEdit({ ...edit, cuttingQty: e.target.value })} /></div>
              <div><Label className="text-xs">Stitching Qty</Label><Input type="number" value={edit.stitchingQty} onChange={(e) => setEdit({ ...edit, stitchingQty: e.target.value })} /></div>
              <div><Label className="text-xs">Completed Qty</Label><Input type="number" value={edit.completedQty} onChange={(e) => setEdit({ ...edit, completedQty: e.target.value })} /></div>
              <div><Label className="text-xs">Defective Qty</Label><Input type="number" value={edit.defectiveQty} onChange={(e) => setEdit({ ...edit, defectiveQty: e.target.value })} /></div>
              <div><Label className="text-xs">Rework Qty</Label><Input type="number" value={edit.reworkQty} onChange={(e) => setEdit({ ...edit, reworkQty: e.target.value })} /></div>
              <div><Label className="text-xs">Status</Label>
                <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['PLANNED', 'CUTTING', 'STITCHING', 'QC', 'COMPLETED', 'ON_HOLD'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">QC Status</Label>
                <Select value={edit.qcStatus || 'none'} onValueChange={(v) => setEdit({ ...edit, qcStatus: v === 'none' ? '' : v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">—</SelectItem>{['PENDING', 'PASSED', 'FAILED'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={saveEdit}>Save</Button></DialogFooter>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
