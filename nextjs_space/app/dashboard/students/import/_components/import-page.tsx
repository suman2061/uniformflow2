'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function ImportPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetch('/api/schools?limit=100').then((r: any) => r?.json()).then((d: any) => setSchools(d?.schools ?? [])).catch(() => {});
  }, []);

  const onSchoolChange = async (sid: string) => {
    setSelectedSchool(sid);
    setSelectedYear(''); setSelectedClass(''); setSelectedDivision('');
    const [ayRes, clsRes, divRes] = await Promise.all([
      fetch(`/api/academic-years?schoolId=${sid}`).then((r: any) => r?.json()),
      fetch(`/api/classes?schoolId=${sid}`).then((r: any) => r?.json()),
      fetch(`/api/divisions?schoolId=${sid}`).then((r: any) => r?.json()),
    ]);
    setAcademicYears(ayRes?.academicYears ?? []);
    setClasses(clsRes?.classes ?? []);
    setDivisions(divRes?.divisions ?? []);
  };

  const parseCSV = (text: string) => {
    const lines = (text ?? '').split('\n').filter((l: string) => l?.trim());
    if (lines.length < 2) { toast.error('CSV must have a header row and at least one data row'); return; }
    const headers = (lines[0] ?? '').split(',').map((h: string) => h?.trim()?.toLowerCase());
    const parsed = lines.slice(1).map((line: string, idx: number) => {
      const cols = (line ?? '').split(',').map((c: string) => c?.trim());
      const row: any = { _rowNum: idx + 2 };
      headers.forEach((h: string, i: number) => {
        if (h === 'name' || h === 'student name') row.name = cols[i] ?? '';
        else if (h === 'gender') row.gender = cols[i] ?? '';
        else if (h === 'uniform category' || h === 'category') row.uniformCategory = cols[i] ?? '';
        else if (h === 'parent name' || h === 'guardian') row.parentName = cols[i] ?? '';
        else if (h === 'parent phone' || h === 'phone') row.parentPhone = cols[i] ?? '';
        else if (h === 'parent email' || h === 'email') row.parentEmail = cols[i] ?? '';
        else if (h === 'roll number' || h === 'roll' || h === 'roll no') row.rollNumber = cols[i] ?? '';
      });
      row._valid = !!(row?.name && row.name.length > 0);
      return row;
    });
    setRows(parsed);
    setResult(null);
  };

  const handleFile = (e: any) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev: any) => parseCSV(ev?.target?.result ?? '');
    reader.readAsText(file);
  };

  const doImport = async () => {
    if (!selectedSchool || !selectedYear || !selectedClass) {
      toast.error('Select school, academic year, and class'); return;
    }
    setImporting(true);
    try {
      const validRows = (rows ?? []).filter((r: any) => r?._valid);
      const res = await fetch('/api/students/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchool, academicYearId: selectedYear,
          classId: selectedClass, divisionId: selectedDivision || undefined,
          students: validRows,
        }),
      });
      const data = await res?.json();
      setResult(data);
      if ((data?.imported ?? 0) > 0) toast.success(`${data.imported} students imported`);
      if ((data?.errors?.length ?? 0) > 0) toast.error(`${data.errors.length} rows had errors`);
    } catch { toast.error('Import failed'); } finally { setImporting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/students"><Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" /> Import Students
          </h1>
          <p className="text-muted-foreground mt-1">Upload a CSV file to bulk-create students</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Step 1: Select Target</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>School *</Label>
              <Select value={selectedSchool} onValueChange={onSchoolChange}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{(schools ?? []).map((s: any) => <SelectItem key={s?.id} value={s?.id}>{s?.name ?? ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Academic Year *</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{(academicYears ?? []).map((y: any) => <SelectItem key={y?.id} value={y?.id}>{y?.name ?? ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{(classes ?? []).map((c: any) => <SelectItem key={c?.id} value={c?.id}>{c?.name ?? ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Division</Label>
              <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{(divisions ?? []).map((d: any) => <SelectItem key={d?.id} value={d?.id}>{d?.name ?? ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Step 2: Upload CSV</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Required column: <code className="font-mono">name</code>. Optional: <code className="font-mono">gender, uniform category, parent name, parent phone, parent email, roll number</code></p>
          <Input type="file" accept=".csv" onChange={handleFile} />
        </CardContent>
      </Card>

      {(rows ?? []).length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Step 3: Preview & Import ({(rows ?? []).filter((r: any) => r?._valid).length} valid rows)</CardTitle>
            <Button onClick={doImport} disabled={importing || !selectedSchool || !selectedYear || !selectedClass}>
              {importing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Upload className="h-4 w-4 mr-2" /> Import
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Roll</TableHead>
                  <TableHead>Valid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows ?? []).slice(0, 50).map((r: any, i: number) => (
                  <TableRow key={i} className={r?._valid ? '' : 'bg-destructive/5'}>
                    <TableCell>{r?._rowNum ?? i + 2}</TableCell>
                    <TableCell>{r?.name ?? ''}</TableCell>
                    <TableCell>{r?.gender ?? ''}</TableCell>
                    <TableCell>{r?.parentName ?? ''}</TableCell>
                    <TableCell>{r?.parentPhone ?? ''}</TableCell>
                    <TableCell>{r?.rollNumber ?? ''}</TableCell>
                    <TableCell>{r?._valid ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Badge variant="default" className="text-base">{result?.imported ?? 0} imported</Badge>
              {(result?.skipped ?? 0) > 0 && <Badge variant="destructive" className="text-base">{result.skipped} skipped</Badge>}
            </div>
            {(result?.errors ?? []).length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-sm font-medium text-destructive">Errors:</p>
                {(result.errors ?? []).map((e: any, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">Row {e?.row ?? '?'}: {(e?.errors ?? []).join(', ')}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
