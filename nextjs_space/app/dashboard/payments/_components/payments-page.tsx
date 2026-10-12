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
import { Wallet, Plus, Loader2 } from 'lucide-react';

const TYPE_CLS: Record<string, string> = {
  ADVANCE: 'bg-blue-100 text-blue-700', PARTIAL: 'bg-amber-100 text-amber-700', FULL: 'bg-green-100 text-green-700',
  REFUND: 'bg-red-100 text-red-700', ADJUSTMENT: 'bg-slate-100 text-slate-700',
};
const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash', BANK_TRANSFER: 'Bank Transfer', UPI: 'UPI', CHEQUE: 'Cheque', GATEWAY: 'Gateway',
};

type Alloc = { invoiceId: string; amount: number };

export function PaymentsPage({ userRole }: { userRole: string }) {
  const { toast } = useToast();
  const canCreate = hasPermission(userRole, 'PAYMENTS', 'CREATE');

  const [schools, setSchools] = useState<any[]>([]);
  const [schoolFilter, setSchoolFilter] = useState('');
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [cSchool, setCSchool] = useState('');
  const [type, setType] = useState('PARTIAL');
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [openInvoices, setOpenInvoices] = useState<any[]>([]);
  const [allocs, setAllocs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/schools?limit=100').then((r) => r.json()).then((d) => setSchools(d.schools ?? [])).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (schoolFilter) qs.set('schoolId', schoolFilter);
    fetch(`/api/payments?${qs.toString()}`).then((r) => r.json()).then((d) => setPayments(d.payments ?? [])).finally(() => setLoading(false));
  }, [schoolFilter]);
  useEffect(() => { load(); }, [load]);

  // When the school changes in the create dialog, load its unpaid invoices for allocation.
  useEffect(() => {
    if (!cSchool) { setOpenInvoices([]); setAllocs({}); return; }
    fetch(`/api/invoices?schoolId=${cSchool}`).then((r) => r.json()).then((d) => {
      const list = (d.invoices ?? []).filter((inv: any) => Number(inv.outstanding ?? 0) > 0.009 && inv.status !== 'CANCELLED');
      setOpenInvoices(list);
      setAllocs({});
    }).catch(() => {});
  }, [cSchool]);

  function openCreate() {
    setCSchool(''); setType('PARTIAL'); setMethod('CASH'); setAmount(''); setTransactionRef('');
    setPaymentDate(''); setNotes(''); setOpenInvoices([]); setAllocs({}); setCreateOpen(true);
  }

  function autoAllocate() {
    let remaining = Number(amount || 0);
    if (!remaining || remaining <= 0) { toast({ title: 'Enter an amount first', variant: 'destructive' }); return; }
    const next: Record<string, string> = {};
    for (const inv of openInvoices) {
      if (remaining <= 0.009) break;
      const out = Number(inv.outstanding ?? 0);
      const give = Math.min(out, remaining);
      if (give > 0.009) { next[inv.id] = give.toFixed(2); remaining -= give; }
    }
    setAllocs(next);
  }

  const allocTotal = Object.values(allocs).reduce((s, v) => s + Number(v || 0), 0);

  async function submit() {
    if (!cSchool) { toast({ title: 'Select a school', variant: 'destructive' }); return; }
    const amt = Number(amount || 0);
    if (!amt || amt <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    const allocations = Object.entries(allocs)
      .map(([invoiceId, v]) => ({ invoiceId, amount: Number(v || 0) }))
      .filter((a) => a.amount > 0.009);
    if (allocTotal - 0.009 > amt) { toast({ title: 'Allocations exceed payment amount', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: cSchool, type, method, amount: amt,
          transactionRef: transactionRef || null, paymentDate: paymentDate || null, notes: notes || null,
          allocations: allocations.length ? allocations : undefined,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed'); }
      toast({ title: 'Payment recorded' });
      setCreateOpen(false);
      load();
    } catch (e: any) {
      toast({ title: e.message || 'Failed to record payment', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2"><Wallet className="h-6 w-6 text-indigo-600" /> Payments</h1>
          <p className="text-sm text-slate-500 mt-1">Record and track payments received against invoices.</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Record Payment</Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={schoolFilter || 'all'} onValueChange={(v) => setSchoolFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-56"><SelectValue placeholder="All schools" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All schools</SelectItem>
            {schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : payments.length === 0 ? (
            <div className="text-center py-16 text-slate-400">No payments recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">School</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-800">{p.schoolName}</td>
                      <td className="px-4 py-3 text-slate-600"><SafeDate date={p.paymentDate} options={{ dateStyle: 'medium' }} /></td>
                      <td className="px-4 py-3"><Badge className={TYPE_CLS[p.type] ?? 'bg-slate-100 text-slate-700'} variant="secondary">{p.type}</Badge></td>
                      <td className="px-4 py-3 text-slate-600">{METHOD_LABEL[p.method] ?? p.method}</td>
                      <td className="px-4 py-3 text-slate-500">{p.transactionRef ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{inr(Number(p.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Record a payment received and optionally allocate it to outstanding invoices.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>School</Label>
                <Select value={cSchool} onValueChange={setCSchool}>
                  <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                  <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Payment Date</Label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['ADVANCE', 'PARTIAL', 'FULL', 'REFUND', 'ADJUSTMENT'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(METHOD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Transaction Reference</Label>
                <Input value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} placeholder="UTR / cheque no." />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            {cSchool && (
              <div className="border border-slate-100 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-700">Allocate to Invoices</Label>
                  <Button type="button" variant="outline" size="sm" onClick={autoAllocate}>Auto-allocate</Button>
                </div>
                {openInvoices.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">No outstanding invoices for this school.</p>
                ) : (
                  <div className="space-y-2">
                    {openInvoices.map((inv) => (
                      <div key={inv.id} className="flex items-center gap-3 text-sm">
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{inv.invoiceNumber}</div>
                          <div className="text-slate-500">Outstanding {inr(Number(inv.outstanding ?? 0))}</div>
                        </div>
                        <Input type="number" min="0" step="0.01" className="w-32" placeholder="0.00"
                          value={allocs[inv.id] ?? ''}
                          onChange={(e) => setAllocs((p) => ({ ...p, [inv.id]: e.target.value }))} />
                      </div>
                    ))}
                    <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
                      <span className="text-slate-500">Allocated</span>
                      <span className="font-medium text-slate-800">{inr(allocTotal)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving} className="gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
