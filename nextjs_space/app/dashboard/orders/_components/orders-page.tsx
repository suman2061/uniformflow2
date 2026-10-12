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
import { ORDER_STATE_LABELS } from '@/lib/order-workflow';
import { ShoppingCart, Plus, Trash2, Loader2, Package } from 'lucide-react';

const STATUS_CLS: Record<string, string> = {
  REQUIREMENT_COLLECTION: 'bg-slate-100 text-slate-700',
  REQUIREMENTS_VERIFIED: 'bg-blue-100 text-blue-700',
  ORDER_CONFIRMED: 'bg-indigo-100 text-indigo-700',
  FABRIC_PROCUREMENT_PENDING: 'bg-amber-100 text-amber-700',
  FABRIC_ORDERED: 'bg-amber-100 text-amber-700',
  FABRIC_PARTIALLY_RECEIVED: 'bg-amber-100 text-amber-700',
  FABRIC_RECEIVED: 'bg-cyan-100 text-cyan-700',
  CUTTING_IN_PROGRESS: 'bg-purple-100 text-purple-700',
  STITCHING_IN_PROGRESS: 'bg-purple-100 text-purple-700',
  QUALITY_CHECK: 'bg-fuchsia-100 text-fuchsia-700',
  READY_FOR_DISPATCH: 'bg-teal-100 text-teal-700',
  PARTIALLY_DELIVERED: 'bg-lime-100 text-lime-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-green-100 text-green-800',
  ON_HOLD: 'bg-orange-100 text-orange-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

function statusBadge(s: string) {
  return <Badge className={STATUS_CLS[s] ?? 'bg-muted text-muted-foreground'} variant="secondary">{ORDER_STATE_LABELS[s] ?? s}</Badge>;
}

type Line = { productId: string; productName: string; size: string; quantity: number; unitPrice: number; discount: number; taxRate: number };

export function OrdersPage({ userRole }: { userRole: string }) {
  const { toast } = useToast();
  const canCreate = hasPermission(userRole, 'ORDERS', 'CREATE');
  const canApprove = hasPermission(userRole, 'ORDERS', 'APPROVE');

  const [schools, setSchools] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [yearId, setYearId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [cSchool, setCSchool] = useState('');
  const [cYears, setCYears] = useState<any[]>([]);
  const [cYear, setCYear] = useState('');
  const [cNotes, setCNotes] = useState('');
  const [cLines, setCLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toStatus, setToStatus] = useState('');
  const [reason, setReason] = useState('');
  const [transitions, setTransitions] = useState<string[]>([]);

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
  useEffect(() => {
    if (!cSchool) { setCYears([]); setCYear(''); return; }
    fetch(`/api/academic-years?schoolId=${cSchool}`).then((r) => r.json()).then((d) => {
      setCYears(d.academicYears ?? []);
      const active = (d.academicYears ?? []).find((y: any) => y.isActive);
      setCYear(active?.id ?? (d.academicYears?.[0]?.id ?? ''));
    }).catch(() => {});
  }, [cSchool]);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (schoolId) qs.set('schoolId', schoolId);
    if (yearId) qs.set('academicYearId', yearId);
    if (statusFilter) qs.set('status', statusFilter);
    if (search) qs.set('search', search);
    fetch(`/api/orders?${qs.toString()}`).then((r) => r.json()).then((d) => setOrders(d.orders ?? [])).finally(() => setLoading(false));
  }, [schoolId, yearId, statusFilter, search]);
  useEffect(() => { load(); }, [load]);

  function addLine() {
    setCLines((p) => [...p, { productId: '', productName: '', size: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0 }]);
  }
  function setLine(i: number, patch: Partial<Line>) {
    setCLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function pickProduct(i: number, pid: string) {
    const prod = products.find((x) => x.id === pid);
    setLine(i, { productId: pid, productName: prod?.name ?? '', unitPrice: Number(prod?.sellingPrice ?? 0), taxRate: Number(prod?.taxRate ?? 0) });
  }
  const cTotal = cLines.reduce((s, l) => {
    const base = l.quantity * l.unitPrice - l.discount;
    return s + base + (base * l.taxRate) / 100;
  }, 0);

  async function createOrder() {
    if (!cSchool || !cYear || cLines.length === 0) { toast({ title: 'Missing info', description: 'School, year and at least one line required.', variant: 'destructive' }); return; }
    if (cLines.some((l) => !l.productId || l.quantity < 1)) { toast({ title: 'Invalid line', description: 'Each line needs a product and quantity.', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: cSchool, academicYearId: cYear, notes: cNotes || null, lines: cLines }),
      });
      const d = await res.json();
      if (!res.ok) { toast({ title: 'Error', description: d.error ?? 'Failed', variant: 'destructive' }); return; }
      toast({ title: 'Order created', description: d.order?.orderNumber });
      setCreateOpen(false); setCLines([]); setCNotes(''); load();
    } finally { setSaving(false); }
  }

  async function openDetail(id: string) {
    setDetailLoading(true); setDetail({ id }); setToStatus(''); setReason('');
    try {
      const res = await fetch(`/api/orders/${id}`);
      const d = await res.json();
      setDetail(d.order ?? null);
      // compute transitions client-side mirror via order-workflow not imported server list here; fetch allowed from labels
      const { allowedTransitions } = await import('@/lib/order-workflow');
      setTransitions(allowedTransitions(d.order?.status ?? ''));
    } finally { setDetailLoading(false); }
  }

  async function doTransition() {
    if (!toStatus) return;
    const res = await fetch(`/api/orders/${detail.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'transition', toStatus, reason: reason || null }),
    });
    const d = await res.json();
    if (!res.ok) { toast({ title: 'Error', description: d.error ?? 'Failed', variant: 'destructive' }); return; }
    toast({ title: 'Status updated' });
    openDetail(detail.id); load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2"><ShoppingCart className="h-6 w-6 text-primary" /> Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and track uniform orders through the full production lifecycle.</p>
        </div>
        {canCreate && <Button onClick={() => { setCreateOpen(true); setCSchool(schoolId); }}><Plus className="h-4 w-4 mr-2" /> New Order</Button>}
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="w-56">
          <Label className="text-xs">School</Label>
          <Select value={schoolId} onValueChange={(v) => setSchoolId(v === 'all' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="All schools" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All schools</SelectItem>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Label className="text-xs">Academic Year</Label>
          <Select value={yearId || 'all'} onValueChange={(v) => setYearId(v === 'all' ? '' : v)} disabled={!schoolId}>
            <SelectTrigger><SelectValue placeholder="All years" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All years</SelectItem>{years.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}{y.isActive ? ' (active)' : ''}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-52">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.keys(ORDER_STATE_LABELS).map((s) => <SelectItem key={s} value={s}>{ORDER_STATE_LABELS[s]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Label className="text-xs">Search</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order number" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading orders...</div>
      ) : orders.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground"><Package className="h-10 w-10 mx-auto mb-3 opacity-40" /><p>No orders found.</p></CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40"><tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Order #</th><th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Items</th><th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium"></th>
              </tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{o.orderNumber}</td>
                    <td className="px-4 py-3">{o.schoolName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.lines?.length ?? 0} line(s)</td>
                    <td className="px-4 py-3 text-right font-medium">{inr(o.grandTotal)}</td>
                    <td className="px-4 py-3">{statusBadge(o.status)}</td>
                    <td className="px-4 py-3 text-right"><Button variant="outline" size="sm" onClick={() => openDetail(o.id)}>View</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Order</DialogTitle><DialogDescription>Add order lines with products, quantities and pricing.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">School</Label>
              <Select value={cSchool} onValueChange={setCSchool}><SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Academic Year</Label>
              <Select value={cYear} onValueChange={setCYear} disabled={!cSchool}><SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>{cYears.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}{y.isActive ? ' (active)' : ''}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label className="text-xs">Order Lines</Label><Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add line</Button></div>
            {cLines.length === 0 && <p className="text-xs text-muted-foreground">No lines yet. Click "Add line".</p>}
            {cLines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-2">
                <div className="col-span-4"><Label className="text-[10px]">Product</Label>
                  <Select value={l.productId} onValueChange={(v) => pickProduct(i, v)}><SelectTrigger className="h-8"><SelectValue placeholder="Product" /></SelectTrigger>
                    <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="col-span-2"><Label className="text-[10px]">Size</Label><Input className="h-8" value={l.size} onChange={(e) => setLine(i, { size: e.target.value })} placeholder="e.g. 32" /></div>
                <div className="col-span-1"><Label className="text-[10px]">Qty</Label><Input className="h-8" type="number" value={l.quantity} onChange={(e) => setLine(i, { quantity: parseInt(e.target.value) || 0 })} /></div>
                <div className="col-span-2"><Label className="text-[10px]">Unit ₹</Label><Input className="h-8" type="number" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: parseFloat(e.target.value) || 0 })} /></div>
                <div className="col-span-2"><Label className="text-[10px]">Tax %</Label><Input className="h-8" type="number" value={l.taxRate} onChange={(e) => setLine(i, { taxRate: parseFloat(e.target.value) || 0 })} /></div>
                <div className="col-span-1 flex justify-end"><Button type="button" variant="ghost" size="icon-sm" onClick={() => setCLines((p) => p.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
              </div>
            ))}
          </div>
          <div><Label className="text-xs">Notes</Label><Textarea value={cNotes} onChange={(e) => setCNotes(e.target.value)} rows={2} /></div>
          <div className="text-right text-sm font-medium">Estimated total: {inr(cTotal)}</div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={createOrder} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Order</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailLoading || !detail?.orderNumber ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...</div>
          ) : (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2">{detail.orderNumber} {statusBadge(detail.status)}</DialogTitle>
                <DialogDescription>{detail.schoolName} · {detail.academicYearName}</DialogDescription></DialogHeader>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left"><th className="px-3 py-2">Product</th><th className="px-3 py-2">Size</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Delivered</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
                  <tbody>{(detail.lines ?? []).map((l: any) => (
                    <tr key={l.id} className="border-t"><td className="px-3 py-2">{l.productName}</td><td className="px-3 py-2">{l.size || '—'}</td><td className="px-3 py-2 text-right">{l.quantity}</td><td className="px-3 py-2 text-right">{l.deliveredQty}</td><td className="px-3 py-2 text-right">{inr(l.lineTotal)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Grand Total</span><span className="font-semibold">{inr(detail.grandTotal)}</span></div>
              {canApprove && transitions.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <Label className="text-xs">Advance / Change Status</Label>
                  <div className="flex gap-2">
                    <Select value={toStatus} onValueChange={setToStatus}><SelectTrigger><SelectValue placeholder="Select next status" /></SelectTrigger>
                      <SelectContent>{transitions.map((s) => <SelectItem key={s} value={s}>{ORDER_STATE_LABELS[s] ?? s}</SelectItem>)}</SelectContent></Select>
                    <Button onClick={doTransition} disabled={!toStatus}>Update</Button>
                  </div>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
                </div>
              )}
              {Array.isArray(detail.statusHistory) && detail.statusHistory.length > 0 && (
                <div className="border-t pt-3">
                  <Label className="text-xs">History</Label>
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {detail.statusHistory.slice().reverse().map((h: any, i: number) => (
                      <div key={i} className="text-xs text-muted-foreground">{ORDER_STATE_LABELS[h.to] ?? h.to} — {h.byName || 'System'}{h.reason ? ` · ${h.reason}` : ''}</div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
