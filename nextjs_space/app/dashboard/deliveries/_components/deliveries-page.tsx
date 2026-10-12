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
import { SafeDate } from '@/components/safe-format';
import { Truck, Plus, Loader2, Trash2 } from 'lucide-react';

const CLS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700', DISPATCHED: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700', PARTIALLY_RETURNED: 'bg-orange-100 text-orange-700', RETURNED: 'bg-red-100 text-red-700',
};

type Line = { productId: string; productName: string; size: string; qtyRequired: number; qtyDelivered: number };

export function DeliveriesPage({ userRole }: { userRole: string }) {
  const { toast } = useToast();
  const canCreate = hasPermission(userRole, 'DELIVERIES', 'CREATE');

  const [schools, setSchools] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [cSchool, setCSchool] = useState('');
  const [cYears, setCYears] = useState<any[]>([]);
  const [cYear, setCYear] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [orderId, setOrderId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    fetch('/api/schools?limit=100').then((r) => r.json()).then((d) => setSchools(d.schools ?? [])).catch(() => {});
    fetch('/api/products?limit=1000').then((r) => r.json()).then((d) => setProducts(d.products ?? [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (!cSchool) { setCYears([]); setCYear(''); return; }
    fetch(`/api/academic-years?schoolId=${cSchool}`).then((r) => r.json()).then((d) => {
      setCYears(d.academicYears ?? []);
      const active = (d.academicYears ?? []).find((y: any) => y.isActive);
      setCYear(active?.id ?? (d.academicYears?.[0]?.id ?? ''));
    }).catch(() => {});
  }, [cSchool]);
  useEffect(() => {
    if (!cSchool || !cYear) { setOrders([]); return; }
    fetch(`/api/orders?schoolId=${cSchool}&academicYearId=${cYear}`).then((r) => r.json()).then((d) => setOrders(d.orders ?? [])).catch(() => {});
  }, [cSchool, cYear]);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (schoolFilter) qs.set('schoolId', schoolFilter);
    if (statusFilter) qs.set('status', statusFilter);
    fetch(`/api/deliveries?${qs.toString()}`).then((r) => r.json()).then((d) => setDeliveries(d.deliveries ?? [])).finally(() => setLoading(false));
  }, [schoolFilter, statusFilter]);
  useEffect(() => { load(); }, [load]);

  async function pickOrder(id: string) {
    setOrderId(id);
    if (!id) { setLines([]); return; }
    const res = await fetch(`/api/orders/${id}`);
    const d = await res.json();
    const ol = d.order?.lines ?? [];
    setLines(ol.map((l: any) => ({ productId: l.productId, productName: l.productName, size: l.size || '', qtyRequired: l.quantity, qtyDelivered: Math.max(0, l.quantity - l.deliveredQty) })));
  }
  function addLine() { setLines((p) => [...p, { productId: '', productName: '', size: '', qtyRequired: 0, qtyDelivered: 0 }]); }
  function setLine(i: number, patch: Partial<Line>) { setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l))); }
  function pickProduct(i: number, pid: string) { const prod = products.find((x) => x.id === pid); setLine(i, { productId: pid, productName: prod?.name ?? '' }); }

  async function create() {
    if (!cSchool || !cYear || lines.length === 0) { toast({ title: 'School, year and lines required', variant: 'destructive' }); return; }
    if (lines.some((l) => !l.productId)) { toast({ title: 'Each line needs a product', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/deliveries', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: cSchool, academicYearId: cYear, orderId: orderId || null, recipientName: recipientName || null, notes: notes || null, lines }) });
      const d = await res.json();
      if (!res.ok) { toast({ title: 'Error', description: d.error ?? 'Failed', variant: 'destructive' }); return; }
      toast({ title: 'Delivery challan created', description: d.delivery?.challanNumber });
      setCreateOpen(false); setLines([]); setOrderId(''); setRecipientName(''); setNotes(''); load();
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2"><Truck className="h-6 w-6 text-primary" /> Deliveries</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate delivery challans and track dispatch against orders.</p>
        </div>
        {canCreate && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Challan</Button>}
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="w-56"><Label className="text-xs">School</Label>
          <Select value={schoolFilter || 'all'} onValueChange={(v) => setSchoolFilter(v === 'all' ? '' : v)}><SelectTrigger><SelectValue placeholder="All schools" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All schools</SelectItem>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="w-48"><Label className="text-xs">Status</Label>
          <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{Object.keys(CLS).map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select></div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...</div>
      ) : deliveries.length === 0 ? (
        <Card><CardContent className="py-14 text-center text-muted-foreground">No deliveries yet.</CardContent></Card>
      ) : (
        <Card><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr className="text-left">
            <th className="px-4 py-3">Challan #</th><th className="px-4 py-3">School</th><th className="px-4 py-3">Recipient</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
          <tbody>{deliveries.map((x) => (
            <tr key={x.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{x.challanNumber}</td><td className="px-4 py-3">{x.schoolName}</td><td className="px-4 py-3">{x.recipientName || '—'}</td><td className="px-4 py-3"><SafeDate date={x.deliveryDate} options={{ dateStyle: 'medium' }} /></td><td className="px-4 py-3 text-muted-foreground">{x.lines?.length ?? 0}</td>
              <td className="px-4 py-3"><Badge className={CLS[x.status] ?? 'bg-muted'} variant="secondary">{x.status?.replace(/_/g, ' ')}</Badge></td>
              <td className="px-4 py-3 text-right"><Button variant="outline" size="sm" onClick={() => setDetail(x)}>View</Button></td>
            </tr>
          ))}</tbody>
        </table></CardContent></Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Delivery Challan</DialogTitle><DialogDescription>Record dispatch. Linking an order pre-fills undelivered quantities.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">School</Label>
              <Select value={cSchool} onValueChange={setCSchool}><SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Academic Year</Label>
              <Select value={cYear} onValueChange={setCYear} disabled={!cSchool}><SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>{cYears.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}{y.isActive ? ' (active)' : ''}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Link Order (optional)</Label>
              <Select value={orderId || 'none'} onValueChange={(v) => pickOrder(v === 'none' ? '' : v)} disabled={!cYear}><SelectTrigger><SelectValue placeholder="No order" /></SelectTrigger>
                <SelectContent><SelectItem value="none">No order</SelectItem>{orders.map((o) => <SelectItem key={o.id} value={o.id}>{o.orderNumber}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Recipient Name</Label><Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label className="text-xs">Lines</Label><Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add line</Button></div>
            {lines.length === 0 && <p className="text-xs text-muted-foreground">No lines. Link an order or add lines manually.</p>}
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-2">
                <div className="col-span-5"><Label className="text-[10px]">Product</Label>
                  <Select value={l.productId} onValueChange={(v) => pickProduct(i, v)}><SelectTrigger className="h-8"><SelectValue placeholder="Product" /></SelectTrigger>
                    <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="col-span-2"><Label className="text-[10px]">Size</Label><Input className="h-8" value={l.size} onChange={(e) => setLine(i, { size: e.target.value })} /></div>
                <div className="col-span-2"><Label className="text-[10px]">Required</Label><Input className="h-8" type="number" value={l.qtyRequired} onChange={(e) => setLine(i, { qtyRequired: parseInt(e.target.value) || 0 })} /></div>
                <div className="col-span-2"><Label className="text-[10px]">Delivered</Label><Input className="h-8" type="number" value={l.qtyDelivered} onChange={(e) => setLine(i, { qtyDelivered: parseInt(e.target.value) || 0 })} /></div>
                <div className="col-span-1 flex justify-end"><Button type="button" variant="ghost" size="icon-sm" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
              </div>
            ))}
          </div>
          <div><Label className="text-xs">Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={create} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Challan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-xl">
          {detail && (<>
            <DialogHeader><DialogTitle>{detail.challanNumber}</DialogTitle><DialogDescription>{detail.schoolName} · <SafeDate date={detail.deliveryDate} options={{ dateStyle: 'medium' }} /></DialogDescription></DialogHeader>
            <div className="border rounded-lg overflow-hidden"><table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left"><th className="px-3 py-2">Product</th><th className="px-3 py-2">Size</th><th className="px-3 py-2 text-right">Required</th><th className="px-3 py-2 text-right">Delivered</th></tr></thead>
              <tbody>{(detail.lines ?? []).map((l: any) => (<tr key={l.id} className="border-t"><td className="px-3 py-2">{l.productName}</td><td className="px-3 py-2">{l.size || '—'}</td><td className="px-3 py-2 text-right">{l.qtyRequired}</td><td className="px-3 py-2 text-right">{l.qtyDelivered}</td></tr>))}</tbody>
            </table></div>
            {detail.notes && <p className="text-sm text-muted-foreground">{detail.notes}</p>}
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
