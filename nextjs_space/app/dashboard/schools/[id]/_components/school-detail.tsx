'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, School, Plus, Calendar, BookOpen, Layers, Loader2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { hasPermission } from '@/lib/rbac';

export function SchoolDetailPage({ schoolId, userRole }: { schoolId: string; userRole: string }) {
  const [school, setSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [classDialog, setClassDialog] = useState(false);
  const [divDialog, setDivDialog] = useState(false);
  const [yearDialog, setYearDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newDivName, setNewDivName] = useState('');
  const [newYearName, setNewYearName] = useState('');

  const canEdit = hasPermission(userRole, 'SCHOOLS', 'EDIT');
  const canCreateYear = hasPermission(userRole, 'ACADEMIC_YEARS', 'CREATE');

  const fetchSchool = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schools/${schoolId}`);
      if (!res.ok) { setSchool(null); return; }
      const data = await res?.json();
      setSchool(data?.school ?? null);
    } catch { } finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { fetchSchool(); }, [fetchSchool]);

  const addClass = async () => {
    if (!newClassName) return;
    setSaving(true);
    try {
      const res = await fetch('/api/classes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, name: newClassName, sortOrder: (school?.schoolClasses?.length ?? 0) }),
      });
      if (res.ok) { toast.success('Class added'); setClassDialog(false); setNewClassName(''); fetchSchool(); }
      else { const d = await res?.json(); toast.error(d?.error ?? 'Failed'); }
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const addDiv = async () => {
    if (!newDivName) return;
    setSaving(true);
    try {
      const res = await fetch('/api/divisions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, name: newDivName, sortOrder: (school?.schoolDivisions?.length ?? 0) }),
      });
      if (res.ok) { toast.success('Division added'); setDivDialog(false); setNewDivName(''); fetchSchool(); }
      else { const d = await res?.json(); toast.error(d?.error ?? 'Failed'); }
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const addYear = async () => {
    if (!newYearName) return;
    setSaving(true);
    try {
      const res = await fetch('/api/academic-years', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, name: newYearName }),
      });
      if (res.ok) { toast.success('Academic year added'); setYearDialog(false); setNewYearName(''); fetchSchool(); }
      else { const d = await res?.json(); toast.error(d?.error ?? 'Failed'); }
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!school) return <div className="text-center py-12 text-muted-foreground">School not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/schools">
          <Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
            <School className="h-6 w-6 text-primary" /> {school?.name ?? ''}
          </h1>
          <p className="text-muted-foreground text-sm">
            Code: <span className="font-mono">{school?.code ?? ''}</span>
            {school?.active === false && <Badge variant="secondary" className="ml-2">Archived</Badge>}
          </p>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Students</p><p className="text-2xl font-bold font-mono">{school?._count?.students ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Products Mapped</p><p className="text-2xl font-bold font-mono">{school?._count?.schoolProducts ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Contact</p><p className="text-sm font-medium">{school?.contactPerson ?? '—'}</p><p className="text-xs text-muted-foreground" suppressHydrationWarning>{school?.phone ?? ''}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="years">
        <TabsList>
          <TabsTrigger value="years"><Calendar className="h-4 w-4 mr-1" /> Academic Years</TabsTrigger>
          <TabsTrigger value="classes"><BookOpen className="h-4 w-4 mr-1" /> Classes</TabsTrigger>
          <TabsTrigger value="divisions"><Layers className="h-4 w-4 mr-1" /> Divisions</TabsTrigger>
        </TabsList>

        <TabsContent value="years" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Academic Years</CardTitle>
              {canCreateYear && <Button size="sm" onClick={() => setYearDialog(true)}><Plus className="h-4 w-4 mr-1" /> Add Year</Button>}
            </CardHeader>
            <CardContent>
              {(school?.academicYears ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">No academic years yet</p>
              ) : (
                <div className="space-y-2">
                  {(school?.academicYears ?? []).map((y: any) => (
                    <div key={y?.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <span className="font-medium">{y?.name ?? ''}</span>
                        <Badge variant={y?.isActive ? 'default' : 'secondary'} className="ml-2">{y?.isActive ? 'Active' : 'Inactive'}</Badge>
                      </div>
                      <Link href={`/dashboard/students?schoolId=${schoolId}&academicYearId=${y?.id}`}>
                        <Button variant="ghost" size="sm"><GraduationCap className="h-4 w-4 mr-1" /> Students</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Classes</CardTitle>
              {canEdit && <Button size="sm" onClick={() => setClassDialog(true)}><Plus className="h-4 w-4 mr-1" /> Add Class</Button>}
            </CardHeader>
            <CardContent>
              {(school?.schoolClasses ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">No classes configured</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(school?.schoolClasses ?? []).map((c: any) => (
                    <Badge key={c?.id} variant={c?.active ? 'default' : 'secondary'} className="text-sm">{c?.name ?? ''}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="divisions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Divisions</CardTitle>
              {canEdit && <Button size="sm" onClick={() => setDivDialog(true)}><Plus className="h-4 w-4 mr-1" /> Add Division</Button>}
            </CardHeader>
            <CardContent>
              {(school?.schoolDivisions ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">No divisions configured</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(school?.schoolDivisions ?? []).map((d: any) => (
                    <Badge key={d?.id} variant={d?.active ? 'default' : 'secondary'} className="text-sm">{d?.name ?? ''}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <Dialog open={classDialog} onOpenChange={setClassDialog}>
        <DialogContent><DialogHeader><DialogTitle>Add Class</DialogTitle></DialogHeader>
          <div className="space-y-2"><Label>Class Name</Label><Input placeholder="e.g. Class 5" value={newClassName} onChange={(e: any) => setNewClassName(e?.target?.value ?? '')} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setClassDialog(false)}>Cancel</Button><Button onClick={addClass} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={divDialog} onOpenChange={setDivDialog}>
        <DialogContent><DialogHeader><DialogTitle>Add Division</DialogTitle></DialogHeader>
          <div className="space-y-2"><Label>Division Name</Label><Input placeholder="e.g. A" value={newDivName} onChange={(e: any) => setNewDivName(e?.target?.value ?? '')} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setDivDialog(false)}>Cancel</Button><Button onClick={addDiv} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={yearDialog} onOpenChange={setYearDialog}>
        <DialogContent><DialogHeader><DialogTitle>Add Academic Year</DialogTitle></DialogHeader>
          <div className="space-y-2"><Label>Year Name</Label><Input placeholder="e.g. 2027–28" value={newYearName} onChange={(e: any) => setNewYearName(e?.target?.value ?? '')} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setYearDialog(false)}>Cancel</Button><Button onClick={addYear} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
