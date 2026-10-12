'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Search, Loader2, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { SafeDate } from '@/components/safe-format';
import { hasPermission } from '@/lib/rbac';

const ENTITY_TYPES = [
  'User', 'School', 'AcademicYear', 'SchoolClass', 'SchoolDivision', 'Student', 'Enrollment',
  'Product', 'SchoolProduct', 'Business',
  'MeasurementSubmission', 'Measurement',
  'Order', 'FabricRequirement', 'PurchaseOrder', 'FabricReceipt', 'ProductionBatch',
  'Delivery', 'Invoice', 'Payment', 'Notification',
  'Plan', 'Subscription',
];

export function AuditLogPage({ userRole }: { userRole: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const canView = hasPermission(userRole, 'AUDIT_LOG', 'VIEW');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: '25' });
      if (entityType) p.set('entityType', entityType);
      if (search) p.set('search', search);
      const res = await fetch(`/api/audit-log?${p}`);
      const data = await res?.json();
      setLogs(data?.logs ?? []);
      setTotal(data?.total ?? 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, entityType, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil((total ?? 0) / 25));

  const actionColor = (action: string) => {
    const a = action?.toUpperCase() ?? '';
    if (a === 'CREATE' || a === 'LOGIN') return 'default';
    if (a === 'UPDATE' || a === 'EDIT') return 'outline';
    if (a === 'DELETE') return 'destructive';
    return 'secondary';
  };

  if (!canView) return <div className="text-center py-12 text-muted-foreground">You do not have permission to view audit logs.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2"><FileText className="h-6 w-6 text-primary" /> Audit Log</h1>
        <p className="text-muted-foreground mt-1">Track all changes and actions performed in your workspace</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="audit-search" name="audit-search" aria-label="Search audit log" placeholder="Search actions..." value={search} onChange={(e: any) => { setSearch(e?.target?.value ?? ''); setPage(1); }} className="pl-10" />
            </div>
            <Select value={entityType} onValueChange={(v: string) => { setEntityType(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger id="audit-entity" aria-label="Filter by entity" className="w-[180px]"><SelectValue placeholder="All entities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {(ENTITY_TYPES ?? []).map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (logs?.length ?? 0) === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No audit log entries found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(logs ?? []).map((log: any) => (
                      <TableRow key={log?.id}>
                        <TableCell className="whitespace-nowrap text-xs"><SafeDate date={log?.createdAt} options={{ dateStyle: 'short', timeStyle: 'short' }} localize /></TableCell>
                        <TableCell className="text-sm">{log?.userName}</TableCell>
                        <TableCell><Badge variant={actionColor(log?.action) as any}>{log?.action}</Badge></TableCell>
                        <TableCell><span className="text-xs text-muted-foreground">{log?.entityType}</span></TableCell>
                        <TableCell className="max-w-[250px] truncate text-sm">{log?.summary}</TableCell>
                        <TableCell className="text-right">
                          {log?.changes && (
                            <Button variant="ghost" size="icon-sm" onClick={() => { setSelected(log); setDetailOpen(true); }}><Eye className="h-4 w-4" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">{total} entries</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-sm">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Change Details</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm"><strong>Action:</strong> {selected?.action} on {selected?.entityType}</p>
            <p className="text-sm"><strong>By:</strong> {selected?.userName}</p>
            <p className="text-sm"><strong>Summary:</strong> {selected?.summary}</p>
            {selected?.changes && (
              <div className="bg-muted rounded-lg p-3 text-xs font-mono overflow-auto max-h-[300px]">
                <pre>{JSON.stringify(selected.changes, null, 2)}</pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
