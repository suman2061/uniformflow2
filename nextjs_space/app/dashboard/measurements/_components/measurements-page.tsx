'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { hasPermission } from '@/lib/rbac';
import {
  Ruler, Link2, Copy, MoreHorizontal, CheckCircle2, XCircle, RefreshCw, Ban, Loader2, Send,
} from 'lucide-react';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  LINK_NOT_GENERATED: { label: 'Not Generated', cls: 'bg-muted text-muted-foreground' },
  LINK_SENT: { label: 'Link Sent', cls: 'bg-blue-100 text-blue-700' },
  NOT_SUBMITTED: { label: 'Not Submitted', cls: 'bg-amber-100 text-amber-700' },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-indigo-100 text-indigo-700' },
  SUBMITTED: { label: 'Submitted', cls: 'bg-purple-100 text-purple-700' },
  VERIFIED: { label: 'Verified', cls: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
  RESUBMISSION_REQUIRED: { label: 'Resubmission', cls: 'bg-orange-100 text-orange-700' },
};

export function MeasurementsPage({ userRole }: { userRole: string }) {
  const { toast } = useToast();
  const canCreate = hasPermission(userRole, 'MEASUREMENTS', 'CREATE');
  const canApprove = hasPermission(userRole, 'MEASUREMENTS', 'APPROVE');
  const canEdit = hasPermission(userRole, 'MEASUREMENTS', 'EDIT');

  const [schools, setSchools] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [yearId, setYearId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const [genOpen, setGenOpen] = useState(false);
  const [expiryDays, setExpiryDays] = useState('30');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<any[] | null>(null);

  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reasonOpen, setReasonOpen] = useState<{ id: string; action: string } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [singleLink, setSingleLink] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

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

  const load = useCallback(() => {
    if (!schoolId || !yearId) { setSubmissions([]); setCounts({}); return; }
    setLoading(true);
    const qs = new URLSearchParams({ schoolId, academicYearId: yearId });
    if (search) qs.set('search', search);
    if (statusFilter) qs.set('status', statusFilter);
    fetch(`/api/measurements/submissions?${qs.toString()}`).then((r) => r.json()).then((d) => {
      setSubmissions(d.submissions ?? []); setCounts(d.counts ?? {});
    }).finally(() => setLoading(false));
  }, [schoolId, yearId, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function generateAll() {
    setGenerating(true);
    try {
      const res = await fetch('/api/measurements/submissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, academicYearId: yearId, all: true, expiryDays: parseInt(expiryDays) || 30 }),
      });
      const d = await res.json();
      if (!res.ok) { toast({ title: 'Error', description: d.error ?? 'Failed', variant: 'destructive' }); return; }
      setGenerated(d.generated ?? []);
      setGenOpen(false);
      load();
    } finally { setGenerating(false); }
  }

  async function openDetail(id: string) {
    setDetailLoading(true); setDetail({ id });
    try {
      const res = await fetch(`/api/measurements/submissions/${id}`);
      const d = await res.json();
      setDetail(d.submission ?? null);
    } finally { setDetailLoading(false); }
  }

  async function doAction(id: string, action: string, reason?: string) {
    const res = await fetch(`/api/measurements/submissions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason, expiryDays: parseInt(expiryDays) || 30 }),
    });
    const d = await res.json();
    if (!res.ok) { toast({ title: 'Error', description: d.error ?? 'Failed', variant: 'destructive' }); return; }
    if (d.token) { setSingleLink(`${origin}/m/${d.token}`); }
    toast({ title: 'Done', description: `Action "${action}" completed.` });
    load();
    if (detail?.id === id) openDetail(id);
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
    toast({ title: 'Copied', description: 'Link copied to clipboard.' });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2"><Ruler className="h-6 w-6 text-primary" /> Measurements</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate secure parent links, track submissions, and verify measurements.</p>
        </div>
        {canCreate && schoolId && yearId && (
          <Button onClick={() => setGenOpen(true)}><Link2 className="h-4 w-4 mr-2" /> Generate Links</Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="w-56">
          <Label className="text-xs">School</Label>
          <Select value={schoolId} onValueChange={setSchoolId}>
            <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
            <SelectContent>{schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Label className="text-xs">Academic Year</Label>
          <Select value={yearId} onValueChange={setYearId} disabled={!schoolId}>
            <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}{y.isActive ? ' (active)' : ''}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter || 'ALL'} onValueChange={(v) => setStatusFilter(v === 'ALL' ? '' : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {Object.keys(STATUS_META).map((k) => <SelectItem key={k} value={k}>{STATUS_META[k].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-48">
          <Label className="text-xs">Search student</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or ID…" />
        </div>
      </div>

      {/* Status summary */}
      {schoolId && yearId && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {Object.keys(STATUS_META).map((k) => (
            <Card key={k} className={`cursor-pointer ${statusFilter === k ? 'ring-2 ring-primary' : ''}`} onClick={() => setStatusFilter(statusFilter === k ? '' : k)}>
              <CardContent className="p-3">
                <div className="text-xl font-bold">{counts[k] ?? 0}</div>
                <div className="text-[11px] text-muted-foreground leading-tight">{STATUS_META[k].label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {!schoolId || !yearId ? (
            <div className="py-16 text-center text-muted-foreground">Select a school and academic year to begin.</div>
          ) : loading ? (
            <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          ) : submissions.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">No submissions. Generate links to get started.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr className="text-left text-muted-foreground">
                    <th className="p-3 font-medium">Student</th>
                    <th className="p-3 font-medium">Class</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Items</th>
                    <th className="p-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3">
                        <button className="text-left" onClick={() => openDetail(s.id)}>
                          <div className="font-medium">{s.student?.name}</div>
                          <div className="text-xs text-muted-foreground">{s.student?.permanentId}</div>
                        </button>
                      </td>
                      <td className="p-3 text-muted-foreground">{[s.enrollment?.class?.name, s.enrollment?.division?.name].filter(Boolean).join(' - ') || '—'}</td>
                      <td className="p-3"><Badge variant="secondary" className={STATUS_META[s.status]?.cls}>{STATUS_META[s.status]?.label ?? s.status}</Badge></td>
                      <td className="p-3 text-muted-foreground">{s._count?.measurements ?? 0}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canApprove && s.status === 'SUBMITTED' && (
                            <>
                              <Button size="sm" variant="outline" className="h-7" onClick={() => doAction(s.id, 'verify')}><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Verify</Button>
                              <Button size="sm" variant="outline" className="h-7" onClick={() => { setReasonOpen({ id: s.id, action: 'reject' }); setReasonText(''); }}><XCircle className="h-3.5 w-3.5" /></Button>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetail(s.id)}>View details</DropdownMenuItem>
                              {canCreate && <DropdownMenuItem onClick={() => doAction(s.id, 'resend')}><Send className="h-3.5 w-3.5 mr-2" /> Resend / get link</DropdownMenuItem>}
                              {canCreate && <DropdownMenuItem onClick={() => doAction(s.id, 'reminder')}><RefreshCw className="h-3.5 w-3.5 mr-2" /> Log reminder</DropdownMenuItem>}
                              {canApprove && (s.status === 'SUBMITTED' || s.status === 'VERIFIED') && <DropdownMenuItem onClick={() => { setReasonOpen({ id: s.id, action: 'request_resubmission' }); setReasonText(''); }}>Request resubmission</DropdownMenuItem>}
                              {canCreate && <DropdownMenuItem className="text-destructive" onClick={() => doAction(s.id, 'revoke')}><Ban className="h-3.5 w-3.5 mr-2" /> Revoke link</DropdownMenuItem>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Measurement Links</DialogTitle>
            <DialogDescription>Create secure links for all enrolled students in this school &amp; year. Existing links are refreshed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Link validity (days)</Label><Input type="number" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">No messages are sent automatically. You will receive shareable links to copy and send via your own channels.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button onClick={generateAll} disabled={generating}>{generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Generate for all students</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generated links dialog */}
      <Dialog open={!!generated} onOpenChange={(o) => !o && setGenerated(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{generated?.length ?? 0} Links Generated</DialogTitle>
            <DialogDescription>Copy and share these links. For security they are shown only once.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {(generated ?? []).map((g) => (
              <div key={g.studentId} className="flex items-center gap-2 text-sm border border-border rounded-md p-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{g.studentName} <span className="text-muted-foreground">({g.permanentId})</span></div>
                  <div className="text-xs text-muted-foreground truncate">{origin}/m/{g.token}</div>
                </div>
                <Button size="icon-sm" variant="ghost" onClick={() => copy(`${origin}/m/${g.token}`)}><Copy className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => copy((generated ?? []).map((g) => `${g.studentName}: ${origin}/m/${g.token}`).join('\n'))}>Copy all</Button>
            <Button onClick={() => setGenerated(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single link dialog (from resend) */}
      <Dialog open={!!singleLink} onOpenChange={(o) => !o && setSingleLink(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Shareable Link</DialogTitle><DialogDescription>Copy and send this link. It is shown only once.</DialogDescription></DialogHeader>
          <div className="flex items-center gap-2"><Input readOnly value={singleLink ?? ''} /><Button size="icon" onClick={() => singleLink && copy(singleLink)}><Copy className="h-4 w-4" /></Button></div>
          <DialogFooter><Button onClick={() => setSingleLink(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reason dialog */}
      <Dialog open={!!reasonOpen} onOpenChange={(o) => !o && setReasonOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{reasonOpen?.action === 'reject' ? 'Reject Submission' : 'Request Resubmission'}</DialogTitle>
            <DialogDescription>Provide a reason. This is recorded in the audit log.</DialogDescription></DialogHeader>
          <Textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Reason…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonOpen(null)}>Cancel</Button>
            <Button onClick={() => { if (reasonOpen) { doAction(reasonOpen.id, reasonOpen.action, reasonText); setReasonOpen(null); } }}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Submission Details</DialogTitle></DialogHeader>
          {detailLoading ? <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div> : detail && detail.student ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Info label="Student" value={detail.student?.name} />
                <Info label="Student ID" value={detail.student?.permanentId} />
                <Info label="School" value={detail.school?.name} />
                <Info label="Academic Year" value={detail.academicYear?.name} />
                <Info label="Class" value={[detail.enrollment?.class?.name, detail.enrollment?.division?.name].filter(Boolean).join(' - ')} />
                <Info label="Status" value={STATUS_META[detail.status]?.label ?? detail.status} />
                {detail.verifiedBy?.name && <Info label="Verified by" value={detail.verifiedBy.name} />}
                {detail.rejectionReason && <Info label="Reason" value={detail.rejectionReason} />}
              </div>
              <div>
                <h4 className="font-medium text-sm mb-2">Measurements ({detail.measurements?.length ?? 0})</h4>
                <div className="space-y-2">
                  {(detail.measurements ?? []).map((m: any) => (
                    <div key={m.id} className="border border-border rounded-md p-3 text-sm">
                      <div className="flex justify-between"><span className="font-medium">{m.product?.name}</span><Badge variant="outline" className="text-[10px]">{m.source}</Badge></div>
                      <div className="text-muted-foreground mt-1">
                        {m.size ? `Size: ${m.size}` : ''}
                        {m.fields && Object.keys(m.fields).length > 0 ? ' ' + Object.entries(m.fields).map(([k, v]) => `${k}: ${v}`).join(', ') : ''}
                        {!m.size && (!m.fields || Object.keys(m.fields).length === 0) ? 'No data' : ''}
                      </div>
                      {m.notes && <div className="text-xs text-muted-foreground mt-1">Note: {m.notes}</div>}
                    </div>
                  ))}
                  {(detail.measurements ?? []).length === 0 && <p className="text-sm text-muted-foreground">No measurements recorded yet.</p>}
                </div>
              </div>
              {canApprove && detail.status === 'SUBMITTED' && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => doAction(detail.id, 'verify')}><CheckCircle2 className="h-4 w-4 mr-1" /> Verify</Button>
                  <Button size="sm" variant="outline" onClick={() => { setReasonOpen({ id: detail.id, action: 'reject' }); setReasonText(''); }}><XCircle className="h-4 w-4 mr-1" /> Reject</Button>
                  <Button size="sm" variant="outline" onClick={() => { setReasonOpen({ id: detail.id, action: 'request_resubmission' }); setReasonText(''); }}>Request resubmission</Button>
                </div>
              )}
            </div>
          ) : <p className="py-6 text-center text-muted-foreground">Could not load submission.</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value || '—'}</div></div>;
}
