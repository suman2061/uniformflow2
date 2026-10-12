'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, Loader2, AlertTriangle, CheckCircle2, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export function DemoDataPage() {
  const [seeding, setSeeding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [result, setResult] = useState<any>(null);

  const seedDemo = async () => {
    setSeeding(true); setResult(null);
    try {
      const res = await fetch('/api/super-admin/demo-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'seed' }) });
      const data = await res?.json();
      if (!res?.ok) throw new Error(data?.error ?? 'Failed');
      setResult({ type: 'success', message: `Demo data seeded. Business: ${data?.businessName ?? 'N/A'}, Login: ${data?.demoLogin ?? 'N/A'}` });
      toast.success('Demo data seeded successfully');
    } catch (e: any) { setResult({ type: 'error', message: e?.message ?? 'Failed to seed demo data' }); toast.error(e?.message); }
    setSeeding(false);
  };

  const removeDemo = async () => {
    if (!confirm('This will permanently delete all demo data. Continue?')) return;
    setRemoving(true); setResult(null);
    try {
      const res = await fetch('/api/super-admin/demo-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove' }) });
      const data = await res?.json();
      if (!res?.ok) throw new Error(data?.error ?? 'Failed');
      setResult({ type: 'success', message: 'All demo data has been removed.' });
      toast.success('Demo data removed');
    } catch (e: any) { setResult({ type: 'error', message: e?.message ?? 'Failed to remove demo data' }); toast.error(e?.message); }
    setRemoving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Database className="h-6 w-6 text-primary" /> Demo Data</h1>
        <p className="text-muted-foreground mt-1">Seed or remove demonstration data for testing</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-green-600" /> Seed Demo Data</CardTitle>
            <CardDescription>Creates a demo business with realistic Indian schools, students, and products. Includes a demo login for previewing.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={seedDemo} disabled={seeding || removing} className="w-full">
              {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
              Seed Demo Data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" /> Remove Demo Data</CardTitle>
            <CardDescription>Permanently deletes all records marked as demo data across all businesses.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={removeDemo} disabled={seeding || removing} variant="destructive" className="w-full">
              {removing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Remove All Demo Data
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card className={result?.type === 'error' ? 'border-destructive/50' : 'border-green-500/50'}>
          <CardContent className="pt-6 flex items-start gap-3">
            {result?.type === 'error' ? <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" /> : <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />}
            <p className="text-sm">{result?.message}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
