'use client';

import { useEffect, useState, useCallback } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, BarChart3, Loader2 } from 'lucide-react';
import { hasPermission } from '@/lib/rbac';
import { useToast } from '@/hooks/use-toast';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const REPORT_TYPES = [
  { value: 'completion', label: 'Completion Status', desc: 'Measurement progress by school & class' },
  { value: 'size-matrix', label: 'Size Matrix', desc: 'Product \u00d7 size count grid' },
  { value: 'procurement', label: 'Procurement Requirements', desc: 'Quantity needed per product & size' },
  { value: 'category', label: 'Category Breakdown', desc: 'Measurements by product category' },
  { value: 'pending', label: 'Pending Students', desc: 'Students without finalized measurements' },
];

export function ReportsPage({ userRole }: { userRole: string }) {
  const { toast } = useToast();
  const [schoolId, setSchoolId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [reportType, setReportType] = useState('completion');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const canExport = hasPermission(userRole as any, 'REPORTS', 'EXPORT');
  const canPrint = hasPermission(userRole as any, 'REPORTS', 'PRINT');

  const { data: schoolsData } = useSWR('/api/schools?limit=100', fetcher);
  const schools = schoolsData?.schools ?? [];

  const { data: yearsData } = useSWR(
    schoolId ? `/api/academic-years?schoolId=${schoolId}` : '/api/academic-years',
    fetcher
  );
  const years = yearsData?.academicYears ?? [];

  // Default to active year once years load
  useEffect(() => {
    if (!academicYearId && years.length > 0) {
      const active = years.find((y: any) => y.isActive) ?? years[0];
      setAcademicYearId(active.id);
    }
  }, [years, academicYearId]);

  const runReport = useCallback(async () => {
    if (!academicYearId) {
      toast({ title: 'Select an academic year', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: reportType, academicYearId });
      if (schoolId) params.set('schoolId', schoolId);
      const res = await fetch(`/api/measurements/reports?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load report');
      setData(json);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [reportType, academicYearId, schoolId, toast]);

  const exportCsv = () => {
    if (!academicYearId) return;
    const params = new URLSearchParams({ type: reportType, academicYearId, format: 'csv' });
    if (schoolId) params.set('schoolId', schoolId);
    const a = document.createElement('a');
    a.href = `/api/measurements/reports?${params.toString()}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Measurement, procurement & completion analytics</p>
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-base">Report Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>School</Label>
              <Select value={schoolId || 'all'} onValueChange={(v) => setSchoolId(v === 'all' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="All schools" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All schools</SelectItem>
                  {schools.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Academic Year</Label>
              <Select value={academicYearId} onValueChange={setAcademicYearId}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {years.map((y: any) => (
                    <SelectItem key={y.id} value={y.id}>{y.name}{y.isActive ? ' (active)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {REPORT_TYPES.find((r) => r.value === reportType)?.desc}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={runReport} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
              Generate Report
            </Button>
            {canExport && (
              <Button variant="outline" onClick={exportCsv} disabled={!data}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            )}
            {canPrint && (
              <Button variant="outline" onClick={() => window.print()} disabled={!data}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {REPORT_TYPES.find((r) => r.value === reportType)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <ReportTable data={data} reportType={reportType} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReportTable({ data, reportType }: { data: any; reportType: string }) {
  const rows: any[] = data.rows ?? [];
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No data for the selected filters.</p>;
  }

  const th = 'text-left text-xs font-medium text-muted-foreground px-3 py-2 border-b';
  const td = 'px-3 py-2 text-sm border-b';

  if (reportType === 'completion') {
    return (
      <table className="w-full min-w-[640px]">
        <thead><tr>
          {['School', 'Class', 'Total', 'Verified', 'Submitted', 'Pending'].map((h) => <th key={h} className={th}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className={td}>{r.school}</td>
              <td className={td}>{r.className}</td>
              <td className={td}>{r.total}</td>
              <td className={td}><Badge variant="default">{r.verified}</Badge></td>
              <td className={td}><Badge variant="secondary">{r.submitted}</Badge></td>
              <td className={td}><Badge variant="outline">{r.pending}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (reportType === 'size-matrix') {
    const sizes: string[] = data.sizes ?? [];
    return (
      <table className="w-full min-w-[640px]">
        <thead><tr>
          <th className={th}>Product</th>
          {sizes.map((s) => <th key={s} className={th}>{s}</th>)}
          <th className={th}>Total</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className={td}>{r.product}</td>
              {sizes.map((s) => <td key={s} className={td}>{r[s] || 0}</td>)}
              <td className={td}><strong>{r.total}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (reportType === 'procurement') {
    return (
      <table className="w-full min-w-[560px]">
        <thead><tr>
          {['Product', 'Category', 'Size', 'Quantity'].map((h) => <th key={h} className={th}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className={td}>{r.product}</td>
              <td className={td}>{r.category}</td>
              <td className={td}>{r.size}</td>
              <td className={td}><strong>{r.quantity}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (reportType === 'category') {
    return (
      <table className="w-full min-w-[320px]">
        <thead><tr>
          {['Category', 'Quantity'].map((h) => <th key={h} className={th}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className={td}>{r.category}</td>
              <td className={td}><strong>{r.quantity}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // pending
  return (
    <table className="w-full min-w-[720px]">
      <thead><tr>
        {['Student ID', 'Name', 'School', 'Class', 'Division', 'Status', 'Parent', 'Phone'].map((h) => <th key={h} className={th}>{h}</th>)}
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className={td}>{r.permanentId}</td>
            <td className={td}>{r.name}</td>
            <td className={td}>{r.school}</td>
            <td className={td}>{r.className}</td>
            <td className={td}>{r.division}</td>
            <td className={td}>{r.status?.replace(/_/g, ' ')}</td>
            <td className={td}>{r.parentName}</td>
            <td className={td}>{r.parentPhone}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
