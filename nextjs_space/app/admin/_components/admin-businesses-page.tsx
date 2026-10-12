'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Loader2, RefreshCw, Users, School, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { SafeDate } from '@/components/safe-format';

export function AdminBusinessesPage() {
  const [businesses, setBusiness] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/businesses');
      const data = await res?.json();
      setBusiness(data?.businesses ?? []);
    } catch { toast.error('Failed to load businesses'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBusinesses(); }, [fetchBusinesses]);

  const toggleStatus = async (b: any) => {
    try {
      const newStatus = b?.status === 'active' ? 'suspended' : 'active';
      const res = await fetch(`/api/super-admin/businesses/${b?.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
      if (!res?.ok) throw new Error();
      toast.success(`Business ${newStatus}`);
      fetchBusinesses();
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" /> Businesses</h1>
          <p className="text-muted-foreground mt-1">Platform-wide business tenant management</p>
        </div>
        <Button variant="outline" onClick={fetchBusinesses}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (businesses?.length ?? 0) === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No businesses registered yet</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Demo</TableHead>
                  <TableHead>Stats</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(businesses ?? []).map((b: any) => (
                    <TableRow key={b?.id}>
                      <TableCell className="font-medium">{b?.name}</TableCell>
                      <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{b?.code}</code></TableCell>
                      <TableCell><Badge variant={b?.status === 'active' ? 'default' : 'destructive'}>{b?.status}</Badge></TableCell>
                      <TableCell>{b?.isDemoData ? <Badge variant="secondary">Demo</Badge> : '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {b?._count?.users ?? 0}</span>
                          <span className="flex items-center gap-1"><School className="h-3 w-3" /> {b?._count?.schools ?? 0}</span>
                          <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" /> {b?._count?.students ?? 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs"><SafeDate date={b?.createdAt} options={{ dateStyle: 'medium' }} localize /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => toggleStatus(b)}>{b?.status === 'active' ? 'Suspend' : 'Activate'}</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
