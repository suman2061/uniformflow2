'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CreditCard, Loader2, Plus, RefreshCw, Pencil, Trash2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { inr } from '@/lib/utils';

const EMPTY = {
  name: '', slug: '', monthlyPrice: 0, annualPrice: 0, trialDays: 14,
  maxSchools: 0, maxUsers: 0, maxStudents: 0, storageMb: 0, sortOrder: 0, active: true,
};

export function AdminPlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  // Assign subscription dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<any>({ businessId: '', planId: '', status: 'active', billingCycle: 'monthly' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, bRes, sRes] = await Promise.all([
        fetch('/api/super-admin/plans'),
        fetch('/api/super-admin/businesses'),
        fetch('/api/super-admin/subscriptions'),
      ]);
      const [p, b, s] = await Promise.all([pRes.json(), bRes.json(), sRes.json()]);
      setPlans(p?.plans ?? []);
      setBusinesses(b?.businesses ?? []);
      setSubs(s?.subscriptions ?? []);
    } catch { toast.error('Failed to load billing data'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: p.name, slug: p.slug, monthlyPrice: Number(p.monthlyPrice), annualPrice: Number(p.annualPrice),
      trialDays: p.trialDays, maxSchools: p.maxSchools, maxUsers: p.maxUsers, maxStudents: p.maxStudents,
      storageMb: p.storageMb, sortOrder: p.sortOrder, active: p.active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name || !form.slug) { toast.error('Name and slug are required'); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/super-admin/plans/${editing.id}` : '/api/super-admin/plans';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) { const e = await res.json(); throw new Error(e?.error); }
      toast.success(editing ? 'Plan updated' : 'Plan created');
      setDialogOpen(false);
      fetchAll();
    } catch (e: any) { toast.error(e?.message || 'Failed to save plan'); }
    setSaving(false);
  };

  const remove = async (p: any) => {
    if (!confirm(`Delete plan "${p.name}"?`)) return;
    try {
      const res = await fetch(`/api/super-admin/plans/${p.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error();
      toast.success(data?.softDisabled ? 'Plan is in use — disabled instead of deleted' : 'Plan deleted');
      fetchAll();
    } catch { toast.error('Failed to delete plan'); }
  };

  const assign = async () => {
    if (!assignForm.businessId || !assignForm.planId) { toast.error('Select a business and a plan'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/super-admin/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(assignForm) });
      if (!res.ok) throw new Error();
      toast.success('Subscription assigned');
      setAssignOpen(false);
      setAssignForm({ businessId: '', planId: '', status: 'active', billingCycle: 'monthly' });
      fetchAll();
    } catch { toast.error('Failed to assign subscription'); }
    setSaving(false);
  };

  const lim = (n: number) => (n && n > 0 ? n : '∞');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><CreditCard className="h-6 w-6 text-primary" /> Plans &amp; Subscriptions</h1>
          <p className="text-muted-foreground mt-1">Define subscription plans and assign them to businesses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> New Plan</Button>
        </div>
      </div>

      {/* Plans table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (plans?.length ?? 0) === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No plans yet. Create your first plan.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Annual</TableHead>
                  <TableHead>Schools</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Trial</TableHead>
                  <TableHead>Subs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(plans ?? []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}<div className="text-xs text-muted-foreground">{p.slug}</div></TableCell>
                      <TableCell>{inr(Number(p.monthlyPrice))}</TableCell>
                      <TableCell>{inr(Number(p.annualPrice))}</TableCell>
                      <TableCell>{lim(p.maxSchools)}</TableCell>
                      <TableCell>{lim(p.maxUsers)}</TableCell>
                      <TableCell>{lim(p.maxStudents)}</TableCell>
                      <TableCell>{p.trialDays}d</TableCell>
                      <TableCell>{p?._count?.subscriptions ?? 0}</TableCell>
                      <TableCell>{p.active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => remove(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscriptions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Business Subscriptions</h2>
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-2" /> Assign</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Assign Subscription</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Business</Label>
                    <Select value={assignForm.businessId} onValueChange={(v) => setAssignForm({ ...assignForm, businessId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select a business" /></SelectTrigger>
                      <SelectContent>
                        {(businesses ?? []).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Plan</Label>
                    <Select value={assignForm.planId} onValueChange={(v) => setAssignForm({ ...assignForm, planId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select a plan" /></SelectTrigger>
                      <SelectContent>
                        {(plans ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Status</Label>
                      <Select value={assignForm.status} onValueChange={(v) => setAssignForm({ ...assignForm, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Billing Cycle</Label>
                      <Select value={assignForm.billingCycle} onValueChange={(v) => setAssignForm({ ...assignForm, billingCycle: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
                  <Button onClick={assign} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Assign</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {(subs?.length ?? 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No subscriptions assigned yet</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cycle</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(subs ?? []).map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s?.business?.name}</TableCell>
                      <TableCell>{s?.plan?.name}</TableCell>
                      <TableCell><Badge variant={s.status === 'active' ? 'default' : s.status === 'trial' ? 'secondary' : 'destructive'}>{s.status}</Badge></TableCell>
                      <TableCell className="capitalize">{s.billingCycle}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit plan dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Plan' : 'New Plan'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="growth" /></div>
            <div><Label>Monthly Price (₹)</Label><Input type="number" value={form.monthlyPrice} onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })} /></div>
            <div><Label>Annual Price (₹)</Label><Input type="number" value={form.annualPrice} onChange={(e) => setForm({ ...form, annualPrice: e.target.value })} /></div>
            <div><Label>Trial Days</Label><Input type="number" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} /></div>
            <div><Label>Sort Order</Label><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></div>
            <div><Label>Max Schools (0=∞)</Label><Input type="number" value={form.maxSchools} onChange={(e) => setForm({ ...form, maxSchools: e.target.value })} /></div>
            <div><Label>Max Users (0=∞)</Label><Input type="number" value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: e.target.value })} /></div>
            <div><Label>Max Students (0=∞)</Label><Input type="number" value={form.maxStudents} onChange={(e) => setForm({ ...form, maxStudents: e.target.value })} /></div>
            <div><Label>Storage (MB, 0=∞)</Label><Input type="number" value={form.storageMb} onChange={(e) => setForm({ ...form, storageMb: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            <Label>Active (available to businesses)</Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editing ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
