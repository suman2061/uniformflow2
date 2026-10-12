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
import { SafeDate } from '@/components/safe-format';
import { ReceiptText, Plus, Loader2, Trash2, Ban } from 'lucide-react';

const CLS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700', SENT: 'bg-blue-100 text-blue-700', PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  PAID: 'bg-green-100 text-green-700', OVERDUE: 'bg-red-100 text-red-700', CANCELLED: 'bg-red-100 text-red-700',
};

type Line = { description: string; productId: string; quantity: number; unitPrice: number; discount: number; taxRate: number };

export function InvoicesPage({ userRole }: { userRole: string }) {
  const { toast } = useToast();
  const canCreate = hasPermission(userRole, 'INVOICES', 'CREATE');
  const canEdit = hasPermission(userRole, 'INVOICES', 'EDIT');

  const [schools, setSchools] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [mode, setMode] = useState<'orders' | 'manual'>('orders');
  const [cSchool, setCSchool] = useState('');
  const [cYears, setCYears] = useState<any[]>([]);
  const [cYear, setCYear] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [selOrders, setSelOrders] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
    fetch(`/api/invoices?${qs.toString()}`).then((r) => r.json()).then((d) => setInvoices(d.invoices ?? [])).finally(() => setLoading(false));
  }, [schoolFilter, statusFilter]);
  useEffect(() => { load(); }, [load]);

  function addLine() { setLines((p) => [...p, { description: '', productId: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0 }]); }
  function setLine(i: number, patch: Partial<Line>) { setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l))); }
  function pickProduct(i: number, pid: string) { const prod = products.find((x) => x.id === pid); setLine(i, { productId: pid, description: prod?.name ?? '', unitPrice: Number(prod?.sellingPrice ?? 0), taxRate: Number(prod?.taxRate ?? 0) }); }

  async function create() {
    if (!cSchool || !cYear) { toast({ title: 'School and year required', variant: 'destructive' }); return; }
    const payload: any = { schoolId: cSchool, academicYearId: cYear, dueDate: dueDate || null, notes: notes || null };
    if (mode === 'orders') {
      if (selOrders.length === 0) { toast({ title: 'Select at least one order', variant: 'destructive' }); return; }
      payload.fromOrderIds = selOrders;
    } else {
      if (lines.length === 0 || lines.some((l) => !l.description || l.quantity < 1)) { toast({ title: 'Each line needs a description and quantity', variant: 'destructive' }); return; }
      payload.lines = lines.map((l) => ({ ...l, productId: l.productId || null }));
    }
    setSaving(true);
    try {
      const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await res.json();
      if (!res.ok) { toast({ title: 'Error', description: d.error ?? 'Failed', variant: 'destructive' }); return; }
      toast({ title: 'Invoice created', description: d.invoice?.invoiceNumber });
      setCreateOpen(false); setSelOrders([]); setLines([]); setNotes(''); setDueDate(''); load();
    } finally { setSaving(false); }
  }

  async function openDetail(id: string) {
    setDetailLoading(true); setDetail({ id });
    try { const res = await fetch(`/api/invoices/${id}`); const d = await res.json(); setDetail(d.invoice ?? null); } finally { setDetailLoading(false); }
  }
  async function cancelInvoice(id: string) {
    const res = await fetch(`/api/invoices/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) });
    const d = await res.json();
    if (!res.ok) { toast({ title: 'Error', description: d.error ?? 'Failed', variant: 'destructive' }); return; }
    toast({ title: 'Invoice cancelled' }); setDetail(null); load();
  }

  const manualTotal = lines.reduce((s, l) => { const base = l.quantity * l.unitPrice - l.discount; return s + base + (base * l.taxRate) / 100; }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2"><ReceiptText className="h-6 w-6 text-primary" /> Invoices</h1>
          <p className="text-muted-foreground text-sm mt-1">Raise invoices from orders or manual lines and track payment status.</p>
        </div>
        {canCreate && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Invoice</Button>}
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
      ) : invoices.length === 0 ? (
        <Card><CardContent className="py-14 text-center text-muted-foreground">No invoices yet.</CardContent></Card>
      ) : (
        <Card><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr className="text-left">
            <th className="px-4 py-3">Invoice #</th><th className="px-4 py-3">School</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
          <tbody>{invoices.map((i) => (
            <tr key={i.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{i.invoiceNumber}</td><td className="px-4 py-3">{i.schoolName}</td><td className="px-4 py-3"><SafeDate date={i.invoiceDate} options={{ dateStyle: 'medium' }} /></td><td className="px-4 py-3 text-right">{inr(i.grandTotal)}</td><td className="px-4 py-3 text-right text-green-700">{inr(i.paidAmount)}</td><td className="px-4 py-3 text-right font-medium">{inr(i.outstanding)}</td>
              <td className="px-4 py-3"><Badge className={CLS[i.status] ?? 'bg-muted'} variant="secondary">{i.status?.replace(/_/g, ' ')}</Badge></td>
              <td className="px-4 py-3 text-right"><Button variant="outline" size="sm" onClick={() => openDetail(i.id)}>View</Button></td>
            </tr>
          ))}</tbody>
        </table></CardContent></Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Invoice</DialogTitle><DialogDescription>Bill a school from its orders or custom lines.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">School</Label>
              <Select value={cSchool} onValueChange={setCSchool}><SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Academic Year</Label>
              <Select value={cYear} onValueChange={setCYear} disabled={!cSchool}><SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>{cYears.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}{y.isActive ? ' (active)' : ''}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Due Date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('orders')} className={`px-3 py-1.5 text-sm rounded-md border ${mode === 'orders' ? 'bg-primary text-primary-foreground border-primary' : ''}`}>From Orders</button>
            <button type="button" onClick={() => setMode('manual')} className={`px-3 py-1.5 text-sm rounded-md border ${mode === 'manual' ? 'bg-primary text-primary-foreground border-primary' : ''}`}>Manual Lines</button>
          </div>
          {mode === 'orders' ? (
            <div className="space-y-2 max-h-56 overflow-y-auto border rounded-lg p-2">
              {orders.length === 0 && <p className="text-xs text-muted-foreground">No orders for this school & year.</p>}
              {orders.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                  <input type="checkbox" checked={selOrders.includes(o.id)} onChange={(e) => setSelOrders((p) => e.target.checked ? [...p, o.id] : p.filter((x) => x !== o.id))} />
                  <span className="font-medium">{o.orderNumber}</span><span className="text-muted-foreground">· {inr(o.grandTotal)} · {o.lines?.length ?? 0} items</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label className="text-xs">Lines</Label><Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add line</Button></div>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-2">
                  <div className="col-span-4"><Label className="text-[10px]">Description</Label><Input className="h-8" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></div>
                  <div className="col-span-3"><Label className="text-[10px]">Product (opt)</Label>
                    <Select value={l.productId || 'none'} onValueChange={(v) => v === 'none' ? setLine(i, { productId: '' }) : pickProduct(i, v)}><SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">—</SelectItem>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="col-span-1"><Label className="text-[10px]">Qty</Label><Input className="h-8" type="number" value={l.quantity} onChange={(e) => setLine(i, { quantity: parseInt(e.target.value) || 0 })} /></div>
                  <div className="col-span-2"><Label className="text-[10px]">Unit ₹</Label><Input className="h-8" type="number" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: parseFloat(e.target.value) || 0 })} /></div>
                  <div className="col-span-1"><Label className="text-[10px]">Tax%</Label><Input className="h-8" type="number" value={l.taxRate} onChange={(e) => setLine(i, { taxRate: parseFloat(e.target.value) || 0 })} /></div>
                  <div className="col-span-1 flex justify-end"><Button type="button" variant="ghost" size="icon-sm" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                </div>
              ))}
              <div className="text-right text-sm font-medium">Total: {inr(manualTotal)}</div>
            </div>
          )}
          <div><Label className="text-xs">Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={create} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Invoice</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailLoading || !detail?.invoiceNumber ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...</div>
          ) : (<>
            <DialogHeader><DialogTitle className="flex items-center gap-2">{detail.invoiceNumber} <Badge className={CLS[detail.status] ?? 'bg-muted'} variant="secondary">{detail.status?.replace(/_/g, ' ')}</Badge></DialogTitle>
              <DialogDescription>{detail.school?.billingName || detail.school?.name}{detail.school?.gstin ? ` · GSTIN ${detail.school.gstin}` : ''}</DialogDescription></DialogHeader>
            <div className="border rounded-lg overflow-hidden"><table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left"><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
              <tbody>{(detail.lines ?? []).map((l: any) => (<tr key={l.id} className="border-t"><td className="px-3 py-2">{l.description}</td><td className="px-3 py-2 text-right">{l.quantity}</td><td className="px-3 py-2 text-right">{inr(l.unitPrice)}</td><td className="px-3 py-2 text-right">{inr(l.lineTotal)}</td></tr>))}</tbody>
            </table></div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{inr(detail.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{inr(detail.taxTotal)}</span></div>
              <div className="flex justify-between font-semibold"><span>Grand Total</span><span>{inr(detail.grandTotal)}</span></div>
              <div className="flex justify-between text-green-700"><span>Paid</span><span>{inr(detail.paidAmount)}</span></div>
              <div className="flex justify-between font-medium"><span>Outstanding</span><span>{inr(detail.outstanding)}</span></div>
            </div>
            {canEdit && detail.status !== 'CANCELLED' && detail.paidAmount === 0 && (
              <div className="border-t pt-3 text-right"><Button variant="outline" size="sm" onClick={() => cancelInvoice(detail.id)}><Ban className="h-3 w-3 mr-1 text-destructive" /> Cancel Invoice</Button></div>
            )}
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
