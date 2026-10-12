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
import { inr } from '@/lib/utils';
import { Scissors, Plus, Loader2, RefreshCw, PackageCheck, Ban } from 'lucide-react';

const PO_CLS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700', ORDERED: 'bg-blue-100 text-blue-700',
  PARTIALLY_RECEIVED: 'bg-amber-100 text-amber-700', RECEIVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export function ProcurementPage({ userRole }: { userRole: string }) {
  const { toast } = useToast();
  const canCreate = hasPermission(userRole, 'PROCUREMENT', 'CREATE');
  const canEdit = hasPermission(userRole, 'PROCUREMENT', 'EDIT');

  const [tab, setTab] = useState<'requirements' | 'po'>('requirements');

  // Fabric requirements
  const [schools, setSchools] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [yearId, setYearId] = useState('');
  const [reqs, setReqs] = useState<any[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [computing, setComputing] = useState(false);

  // Purchase orders
  const [pos, setPos] = useState<any[]>([]);
  const [poLoading, setPoLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<any>({ supplierName: '', supplierContact: '', fabricType: '', quantity: 0, unit: 'METERS', unitCost: 0, expectedDeliveryDate: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [receiveFor, setReceiveFor] = useState<any>(null);
  const [recvQty, setRecvQty] = useState(0);

  useEffect(() => {
    fetch('/api/schools?limit=100').then((r) => r.json()).then((d) => setSchools(d.schools ?? [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (!schoolId) { setYears([]); setYearId(''); return; }
    fetch(`/api/academic-years?schoolId=${schoolId}`).then((r) => r.json()).then((d) => {
      setYears(d.academicYears ?? []);
      const active = (d.academicYears ?? []).find((y: any) => y.isActive);
      setYearId(active?.id ?? (d.academicYears?.[0]?.id ?? ''));
    }).catch(() => {});
  }, [schoolId]);

  const loadReqs = useCallback(() => {
    if (!yearId) { setReqs([]); return; }
    setReqLoading(true);
    fetch(`/api/fabric-requirements?academicYearId=${yearId}`).then((r) => r.json()).then((d) => setReqs(d.requirements ?? [])).finally(() => setReqLoading(false));
  }, [yearId]);
  useEffect(() => { loadReqs(); }, [loadReqs]);

  const loadPos = useCallback(() => {
    setPoLoading(true);
    fetch('/api/purchase-orders').then((r) => r.json()).then((d) => setPos(d.purchaseOrders ?? [])).finally(() => setPoLoading(false));
  }, []);
  useEffect(() => { loadPos(); }, [loadPos]);

  async function recompute() {
    if (!yearId) { toast({ title: 'Select a school & year first', variant: 'destructive' }); return; }
    setComputing(true);
    try {
      const res = await fetch('/api/fabric-requirements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ academicYearId: yearId }) });
      const d = await res.json();
      if (!res.ok) { toast({ title: 'Error', description: d.error ?? 'Failed', variant: 'destructive' }); return; }
      toast({ title: 'Requirements computed', description: `${d.computed ?? 0} line(s) from confirmed orders.` });
      loadReqs();
    } finally { setComputing(false); }
  }

  async function createPo() {
    if (!form.supplierName || form.quantity <= 0) { toast({ title: 'Supplier and quantity required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/purchase-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantity: Number(form.quantity), unitCost: Number(form.unitCost), expectedDeliveryDate: form.expectedDeliveryDate || null }) });
      const d = await res.json();
      if (!res.ok) { toast({ title: 'Error', description: d.error ?? 'Failed', variant: 'destructive' }); return; }
      toast({ title: 'Purchase order created', description: d.purchaseOrder?.poNumber });
      setCreateOpen(false); setForm({ supplierName: '', supplierContact: '', fabricType: '', quantity: 0, unit: 'METERS', unitCost: 0, expectedDeliveryDate: '', notes: '' }); loadPos();
    } finally { setSaving(false); }
  }

  async function receive() {
    if (recvQty <= 0) { toast({ title: 'Enter received quantity', variant: 'destructive' }); return; }
    const res = await fetch(`/api/purchase-orders/${receiveFor.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'receive', receivedQty: recvQty }) });
    const d = await res.json();
    if (!res.ok) { toast({ title: 'Error', description: d.error ?? 'Failed', variant: 'destructive' }); return; }
    toast({ title: 'Fabric received' });
    setReceiveFor(null); setRecvQty(0); loadPos();
  }

  async function cancelPo(id: string) {
    const res = await fetch(`/api/purchase-orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) });
    const d = await res.json();
    if (!res.ok) { toast({ title: 'Error', description: d.error ?? 'Failed', variant: 'destructive' }); return; }
    toast({ title: 'Purchase order cancelled' }); loadPos();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2"><Scissors className="h-6 w-6 text-primary" /> Procurement</h1>
          <p className="text-muted-foreground text-sm mt-1">Compute fabric requirements from confirmed orders and manage supplier purchase orders.</p>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        <button onClick={() => setTab('requirements')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'requirements' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Fabric Requirements</button>
        <button onClick={() => setTab('po')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'po' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Purchase Orders</button>
      </div>

      {tab === 'requirements' ? (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="w-56"><Label className="text-xs">School</Label>
              <Select value={schoolId} onValueChange={setSchoolId}><SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="w-48"><Label className="text-xs">Academic Year</Label>
              <Select value={yearId} onValueChange={setYearId} disabled={!schoolId}><SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>{years.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}{y.isActive ? ' (active)' : ''}</SelectItem>)}</SelectContent></Select></div>
            {canCreate && <Button onClick={recompute} disabled={computing || !yearId} variant="outline">{computing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Recompute from Orders</Button>}
          </div>
          {reqLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...</div>
          ) : reqs.length === 0 ? (
            <Card><CardContent className="py-14 text-center text-muted-foreground">No fabric requirements yet. Select a school & year, then recompute from confirmed orders.</CardContent></Card>
          ) : (
            <Card><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr className="text-left">
                <th className="px-4 py-3">Product</th><th className="px-4 py-3">Size</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Consumption/unit</th><th className="px-4 py-3 text-right">Wastage %</th><th className="px-4 py-3 text-right">Fabric Required</th></tr></thead>
              <tbody>{reqs.map((r) => (
                <tr key={r.id} className="border-b last:border-0"><td className="px-4 py-3">{r.productName}</td><td className="px-4 py-3">{r.size || '—'}</td><td className="px-4 py-3 text-right">{r.totalQuantity}</td><td className="px-4 py-3 text-right">{Number(r.consumptionPerUnit).toFixed(3)}</td><td className="px-4 py-3 text-right">{Number(r.wastagePercent).toFixed(1)}</td><td className="px-4 py-3 text-right font-medium">{Number(r.fabricRequired).toFixed(2)} m</td></tr>
              ))}</tbody>
            </table></CardContent></Card>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">{canCreate && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Purchase Order</Button>}</div>
          {poLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...</div>
          ) : pos.length === 0 ? (
            <Card><CardContent className="py-14 text-center text-muted-foreground">No purchase orders yet.</CardContent></Card>
          ) : (
            <Card><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr className="text-left">
                <th className="px-4 py-3">PO #</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Fabric</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Received</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
              <tbody>{pos.map((p) => (
                <tr key={p.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{p.poNumber}</td><td className="px-4 py-3">{p.supplierName}</td><td className="px-4 py-3">{p.fabricType || '—'}</td><td className="px-4 py-3 text-right">{Number(p.quantity).toFixed(2)} {p.unit?.toLowerCase()}</td><td className="px-4 py-3 text-right">{Number(p.receivedQty).toFixed(2)}</td><td className="px-4 py-3 text-right">{inr(p.totalCost)}</td>
                  <td className="px-4 py-3"><Badge className={PO_CLS[p.status] ?? 'bg-muted'} variant="secondary">{p.status.replace(/_/g, ' ')}</Badge></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{canEdit && p.status !== 'RECEIVED' && p.status !== 'CANCELLED' && (<>
                    <Button variant="outline" size="sm" className="mr-1" onClick={() => { setReceiveFor(p); setRecvQty(0); }}><PackageCheck className="h-3 w-3 mr-1" /> Receive</Button>
                    <Button variant="ghost" size="sm" onClick={() => cancelPo(p.id)}><Ban className="h-3 w-3 text-destructive" /></Button></>)}</td>
                </tr>
              ))}</tbody>
            </table></CardContent></Card>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Purchase Order</DialogTitle><DialogDescription>Raise a fabric purchase order to a supplier.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="text-xs">Supplier Name</Label><Input value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} /></div>
            <div><Label className="text-xs">Supplier Contact</Label><Input value={form.supplierContact} onChange={(e) => setForm({ ...form, supplierContact: e.target.value })} /></div>
            <div><Label className="text-xs">Fabric Type</Label><Input value={form.fabricType} onChange={(e) => setForm({ ...form, fabricType: e.target.value })} placeholder="e.g. Poly-cotton navy" /></div>
            <div><Label className="text-xs">Quantity</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
            <div><Label className="text-xs">Unit</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="METERS">Meters</SelectItem><SelectItem value="ROLLS">Rolls</SelectItem><SelectItem value="PIECES">Pieces</SelectItem></SelectContent></Select></div>
            <div><Label className="text-xs">Unit Cost (₹)</Label><Input type="number" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} /></div>
            <div><Label className="text-xs">Expected Delivery</Label><Input type="date" value={form.expectedDeliveryDate} onChange={(e) => setForm({ ...form, expectedDeliveryDate: e.target.value })} /></div>
            <div className="col-span-2"><Label className="text-xs">Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="text-right text-sm font-medium">Total: {inr((Number(form.quantity) || 0) * (Number(form.unitCost) || 0))}</div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={createPo} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receiveFor} onOpenChange={(o) => !o && setReceiveFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Receive Fabric</DialogTitle><DialogDescription>{receiveFor?.poNumber} — ordered {Number(receiveFor?.quantity ?? 0).toFixed(2)}, received {Number(receiveFor?.receivedQty ?? 0).toFixed(2)} so far.</DialogDescription></DialogHeader>
          <div><Label className="text-xs">Quantity received now</Label><Input type="number" value={recvQty} onChange={(e) => setRecvQty(parseFloat(e.target.value) || 0)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setReceiveFor(null)}>Cancel</Button><Button onClick={receive}>Confirm Receipt</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
