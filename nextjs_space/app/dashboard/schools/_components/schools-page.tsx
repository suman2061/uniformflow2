'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { School, Plus, Search, Loader2, Edit, Archive, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { hasPermission } from '@/lib/rbac';

export function SchoolsPage({ userRole }: { userRole: string }) {
  const [schools, setSchools] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', address: '', phone: '', email: '', contactPerson: '', billingName: '', billingAddress: '', gstin: '' });

  const canCreate = hasPermission(userRole, 'SCHOOLS', 'CREATE');
  const canEdit = hasPermission(userRole, 'SCHOOLS', 'EDIT');

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', search, status: statusFilter });
      const res = await fetch(`/api/schools?${params}`);
      const data = await res?.json();
      setSchools(data?.schools ?? []);
      setTotal(data?.total ?? 0);
    } catch { } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchSchools(); }, [fetchSchools]);

  const openNew = () => {
    setEditingSchool(null);
    setForm({ name: '', code: '', address: '', phone: '', email: '', contactPerson: '', billingName: '', billingAddress: '', gstin: '' });
    setDialogOpen(true);
  };

  const openEdit = (s: any) => {
    setEditingSchool(s);
    setForm({
      name: s?.name ?? '', code: s?.code ?? '', address: s?.address ?? '',
      phone: s?.phone ?? '', email: s?.email ?? '', contactPerson: s?.contactPerson ?? '',
      billingName: s?.billingName ?? '', billingAddress: s?.billingAddress ?? '', gstin: s?.gstin ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code) { toast.error('Name and code are required'); return; }
    setSaving(true);
    try {
      const method = editingSchool ? 'PUT' : 'POST';
      const url = editingSchool ? `/api/schools/${editingSchool.id}` : '/api/schools';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res?.json();
      if (!res.ok) { toast.error(data?.error ?? 'Failed'); return; }
      toast.success(editingSchool ? 'School updated' : 'School created');
      setDialogOpen(false);
      fetchSchools();
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const toggleArchive = async (s: any) => {
    try {
      const res = await fetch(`/api/schools/${s?.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !s?.active }),
      });
      if (res.ok) { toast.success(s?.active ? 'School archived' : 'School restored'); fetchSchools(); }
    } catch { toast.error('Failed'); }
  };

  const totalPages = Math.ceil((total ?? 0) / 20);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
            <School className="h-6 w-6 text-primary" /> Schools
          </h1>
          <p className="text-muted-foreground mt-1">Manage your partner schools</p>
        </div>
        {canCreate && (
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add School</Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search schools..." value={search} onChange={(e: any) => { setSearch(e?.target?.value ?? ''); setPage(1); }} />
        </div>
        <Select value={statusFilter} onValueChange={(v: string) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden lg:table-cell">Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (schools ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No schools found</TableCell></TableRow>
              ) : (
                (schools ?? []).map((s: any) => (
                  <TableRow key={s?.id}>
                    <TableCell>
                      <Link href={`/dashboard/schools/${s?.id}`} className="font-medium text-primary hover:underline">
                        {s?.name ?? ''}
                      </Link>
                    </TableCell>
                    <TableCell><span className="font-mono text-sm">{s?.code ?? ''}</span></TableCell>
                    <TableCell className="hidden md:table-cell">{s?.contactPerson ?? '—'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{s?._count?.students ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={s?.active ? 'default' : 'secondary'}>
                        {s?.active ? 'Active' : 'Archived'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canEdit && (
                          <>
                            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(s)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => toggleArchive(s)}>
                              {s?.active ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
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
          <DialogHeader>
            <DialogTitle>{editingSchool ? 'Edit School' : 'Add School'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={form?.name ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), name: e?.target?.value ?? '' }))} /></div>
              <div className="space-y-2"><Label>Code *</Label><Input value={form?.code ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), code: e?.target?.value ?? '' }))} placeholder="e.g. DPS-MUM" /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Input value={form?.address ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), address: e?.target?.value ?? '' }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><Input value={form?.phone ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), phone: e?.target?.value ?? '' }))} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form?.email ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), email: e?.target?.value ?? '' }))} /></div>
            </div>
            <div className="space-y-2"><Label>Contact Person</Label><Input value={form?.contactPerson ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), contactPerson: e?.target?.value ?? '' }))} /></div>
            <div className="space-y-2"><Label>Billing Name</Label><Input value={form?.billingName ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), billingName: e?.target?.value ?? '' }))} /></div>
            <div className="space-y-2"><Label>GSTIN</Label><Input value={form?.gstin ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), gstin: e?.target?.value ?? '' }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingSchool ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
