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
import { Users, Plus, Search, Loader2, Edit, UserCog, Shield, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { hasPermission } from '@/lib/rbac';

const ROLES = [
  { value: 'BUSINESS_ADMIN', label: 'Business Admin' },
  { value: 'OPERATIONS_MANAGER', label: 'Operations Manager' },
  { value: 'ACCOUNTS_MANAGER', label: 'Accounts Manager' },
  { value: 'DATA_ENTRY_OPERATOR', label: 'Data Entry Operator' },
  { value: 'READ_ONLY', label: 'Read Only' },
];

export function UsersPage({ userRole }: { userRole: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ name: '', email: '', phone: '', role: 'DATA_ENTRY_OPERATOR', password: '' });

  const canCreate = hasPermission(userRole, 'USERS', 'CREATE');
  const canEdit = hasPermission(userRole, 'USERS', 'EDIT');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res?.json();
      setUsers(data?.users ?? []);
    } catch { toast.error('Failed to load team members'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = (users ?? []).filter((u: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u?.name?.toLowerCase()?.includes(s) || u?.email?.toLowerCase()?.includes(s);
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', phone: '', role: 'DATA_ENTRY_OPERATOR', password: '' });
    setDialogOpen(true);
  };

  const openEdit = (u: any) => {
    setEditing(u);
    setForm({ name: u?.name ?? '', email: u?.email ?? '', phone: u?.phone ?? '', role: u?.role ?? 'DATA_ENTRY_OPERATOR', password: '' });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form?.name?.trim() || !form?.email?.trim()) { toast.error('Name and email required'); return; }
    if (!editing && !form?.password?.trim()) { toast.error('Password required for new user'); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/users/${editing.id}` : '/api/users';
      const method = editing ? 'PUT' : 'POST';
      const body: any = { name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone?.trim() || null, role: form.role };
      if (form?.password?.trim()) body.password = form.password;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res?.ok) { const d = await res?.json(); throw new Error(d?.error ?? 'Failed'); }
      toast.success(editing ? 'User updated' : 'User created');
      setDialogOpen(false);
      fetchUsers();
    } catch (e: any) { toast.error(e?.message ?? 'Error'); }
    setSaving(false);
  };

  const toggleActive = async (u: any) => {
    try {
      const res = await fetch(`/api/users/${u?.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !u?.active }) });
      if (!res?.ok) throw new Error();
      toast.success(u?.active ? 'User deactivated' : 'User activated');
      fetchUsers();
    } catch { toast.error('Failed to update user status'); }
  };

  const roleLabel = (r: string) => (r ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c?.toUpperCase());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Team Members</h1>
          <p className="text-muted-foreground mt-1">Manage team members and their roles</p>
        </div>
        {canCreate && <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Add Member</Button>}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name or email..." value={search} onChange={(e: any) => setSearch(e?.target?.value ?? '')} className="pl-10" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (filtered?.length ?? 0) === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No team members found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(filtered ?? []).map((u: any) => (
                    <TableRow key={u?.id}>
                      <TableCell className="font-medium">{u?.name}</TableCell>
                      <TableCell suppressHydrationWarning>{u?.email}</TableCell>
                      <TableCell><Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> {roleLabel(u?.role)}</Badge></TableCell>
                      <TableCell><Badge variant={u?.active ? 'default' : 'secondary'}>{u?.active ? 'Active' : 'Inactive'}</Badge></TableCell>
                      <TableCell className="text-right space-x-2">
                        {canEdit && u?.role !== 'BUSINESS_OWNER' && (
                          <>
                            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(u)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => toggleActive(u)}>
                              {u?.active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Team Member' : 'Add Team Member'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Full Name *</Label><Input value={form?.name ?? ''} onChange={(e: any) => setForm({ ...(form ?? {}), name: e?.target?.value ?? '' })} /></div>
            <div><Label>Email *</Label><Input type="email" value={form?.email ?? ''} onChange={(e: any) => setForm({ ...(form ?? {}), email: e?.target?.value ?? '' })} disabled={!!editing} /></div>
            <div><Label>Phone</Label><Input value={form?.phone ?? ''} onChange={(e: any) => setForm({ ...(form ?? {}), phone: e?.target?.value ?? '' })} /></div>
            <div>
              <Label>Role *</Label>
              <Select value={form?.role ?? 'DATA_ENTRY_OPERATOR'} onValueChange={(v: string) => setForm({ ...(form ?? {}), role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(ROLES ?? []).map((r: any) => <SelectItem key={r?.value} value={r?.value}>{r?.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{editing ? 'New Password (leave blank to keep)' : 'Password *'}</Label><Input type="password" value={form?.password ?? ''} onChange={(e: any) => setForm({ ...(form ?? {}), password: e?.target?.value ?? '' })} /></div>
          </div>
          <DialogFooter><Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editing ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
