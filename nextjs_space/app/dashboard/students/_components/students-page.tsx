'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { GraduationCap, Plus, Search, Loader2, Upload, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { hasPermission } from '@/lib/rbac';

export function StudentsPage({ userRole }: { userRole: string }) {
  const [students, setStudents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [schools, setSchools] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ name: '', schoolId: '', gender: '', uniformCategory: '', parentName: '', parentPhone: '', parentEmail: '', academicYearId: '', classId: '', divisionId: '', rollNumber: '' });

  const canCreate = hasPermission(userRole, 'STUDENTS', 'CREATE');
  const canImport = hasPermission(userRole, 'STUDENTS', 'IMPORT');

  useEffect(() => {
    fetch('/api/schools?limit=100').then((r: any) => r?.json()).then((d: any) => setSchools(d?.schools ?? [])).catch(() => {});
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: '20', search, ...(schoolFilter ? { schoolId: schoolFilter } : {}), ...(statusFilter ? { status: statusFilter } : {}) });
      const res = await fetch(`/api/students?${p}`);
      const data = await res?.json();
      setStudents(data?.students ?? []);
      setTotal(data?.total ?? 0);
    } catch { } finally { setLoading(false); }
  }, [page, search, schoolFilter, statusFilter]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const onSchoolChange = async (sid: string) => {
    setForm((p: any) => ({ ...(p ?? {}), schoolId: sid, academicYearId: '', classId: '', divisionId: '' }));
    if (sid) {
      const [ayRes, clsRes, divRes] = await Promise.all([
        fetch(`/api/academic-years?schoolId=${sid}`).then((r: any) => r?.json()),
        fetch(`/api/classes?schoolId=${sid}`).then((r: any) => r?.json()),
        fetch(`/api/divisions?schoolId=${sid}`).then((r: any) => r?.json()),
      ]);
      setAcademicYears(ayRes?.academicYears ?? []);
      setClasses(clsRes?.classes ?? []);
      setDivisions(divRes?.divisions ?? []);
    }
  };

  const handleSave = async () => {
    if (!form?.name || !form?.schoolId) { toast.error('Name and school required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res?.json();
      if (!res.ok) { toast.error(data?.error ?? 'Failed'); return; }
      toast.success(`Student created: ${data?.student?.permanentId ?? ''}`);
      setDialogOpen(false);
      fetchStudents();
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const totalPages = Math.ceil((total ?? 0) / 20);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" /> Students
          </h1>
          <p className="text-muted-foreground mt-1">{total} total students</p>
        </div>
        <div className="flex gap-2">
          {canImport && (
            <Link href="/dashboard/students/import">
              <Button variant="outline"><Upload className="h-4 w-4 mr-2" /> Import CSV</Button>
            </Link>
          )}
          {canCreate && (
            <Button onClick={() => { setForm({ name: '', schoolId: '', gender: '', uniformCategory: '', parentName: '', parentPhone: '', parentEmail: '', academicYearId: '', classId: '', divisionId: '', rollNumber: '' }); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Add Student
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search by name, ID, phone..." value={search} onChange={(e: any) => { setSearch(e?.target?.value ?? ''); setPage(1); }} />
        </div>
        <Select value={schoolFilter || 'all'} onValueChange={(v: string) => { setSchoolFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="School" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            {(schools ?? []).map((s: any) => <SelectItem key={s?.id} value={s?.id}>{s?.name ?? ''}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter || 'all'} onValueChange={(v: string) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">School</TableHead>
                <TableHead className="hidden lg:table-cell">Class</TableHead>
                <TableHead className="hidden lg:table-cell">Roll</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (students ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No students found</TableCell></TableRow>
              ) : (
                (students ?? []).map((s: any) => {
                  const latestEnrollment = s?.enrollments?.[0];
                  return (
                    <TableRow key={s?.id}>
                      <TableCell><Link href={`/dashboard/students/${s?.id}`} className="font-mono text-sm text-primary hover:underline">{s?.permanentId ?? ''}</Link></TableCell>
                      <TableCell><Link href={`/dashboard/students/${s?.id}`} className="font-medium hover:underline">{s?.name ?? ''}</Link></TableCell>
                      <TableCell className="hidden md:table-cell">{s?.school?.name ?? ''}</TableCell>
                      <TableCell className="hidden lg:table-cell">{latestEnrollment?.class?.name ?? '—'} {latestEnrollment?.division?.name ? `/ ${latestEnrollment.division.name}` : ''}</TableCell>
                      <TableCell className="hidden lg:table-cell">{latestEnrollment?.rollNumber ?? '—'}</TableCell>
                      <TableCell><Badge variant={s?.status === 'active' ? 'default' : 'secondary'}>{s?.status ?? ''}</Badge></TableCell>
                    </TableRow>
                  );
                })
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

      {/* New Student Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Student</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={form?.name ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), name: e?.target?.value ?? '' }))} /></div>
            <div className="space-y-2">
              <Label>School *</Label>
              <Select value={form?.schoolId ?? ''} onValueChange={(v: string) => onSchoolChange(v)}>
                <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>{(schools ?? []).map((s: any) => <SelectItem key={s?.id} value={s?.id}>{s?.name ?? ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form?.schoolId && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Academic Year</Label>
                    <Select value={form?.academicYearId ?? ''} onValueChange={(v: string) => setForm((p: any) => ({ ...(p ?? {}), academicYearId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{(academicYears ?? []).map((y: any) => <SelectItem key={y?.id} value={y?.id}>{y?.name ?? ''}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Class</Label>
                    <Select value={form?.classId ?? ''} onValueChange={(v: string) => setForm((p: any) => ({ ...(p ?? {}), classId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{(classes ?? []).map((c: any) => <SelectItem key={c?.id} value={c?.id}>{c?.name ?? ''}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Division</Label>
                    <Select value={form?.divisionId ?? ''} onValueChange={(v: string) => setForm((p: any) => ({ ...(p ?? {}), divisionId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{(divisions ?? []).map((d: any) => <SelectItem key={d?.id} value={d?.id}>{d?.name ?? ''}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Roll Number</Label><Input value={form?.rollNumber ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), rollNumber: e?.target?.value ?? '' }))} /></div>
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={form?.gender ?? ''} onValueChange={(v: string) => setForm((p: any) => ({ ...(p ?? {}), gender: v, uniformCategory: v === 'Male' ? 'Boys' : v === 'Female' ? 'Girls' : '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Uniform Category</Label><Input value={form?.uniformCategory ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), uniformCategory: e?.target?.value ?? '' }))} placeholder="e.g. Boys, Girls" /></div>
            </div>
            <div className="space-y-2"><Label>Parent/Guardian Name</Label><Input value={form?.parentName ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), parentName: e?.target?.value ?? '' }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Parent Phone</Label><Input value={form?.parentPhone ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), parentPhone: e?.target?.value ?? '' }))} /></div>
              <div className="space-y-2"><Label>Parent Email</Label><Input type="email" value={form?.parentEmail ?? ''} onChange={(e: any) => setForm((p: any) => ({ ...(p ?? {}), parentEmail: e?.target?.value ?? '' }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create Student</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
