'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, GraduationCap, User, Package, Calendar, Phone, Mail } from 'lucide-react';
import { SafeDate } from '@/components/safe-format';

export function StudentDetail({ studentId, userRole }: { studentId: string; userRole: string }) {
  const [student, setStudent] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/students/${studentId}`)
      .then((r: any) => r?.json())
      .then((d: any) => { setStudent(d?.student ?? null); setProducts(d?.assignedProducts ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!student) return <div className="text-center py-12 text-muted-foreground">Student not found</div>;

  const latestEnrollment = student?.enrollments?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/students"><Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" /> {student?.name ?? ''}
          </h1>
          <p className="text-muted-foreground text-sm">
            <span className="font-mono">{student?.permanentId ?? ''}</span>
            <Badge variant={student?.status === 'active' ? 'default' : 'secondary'} className="ml-2">{student?.status ?? ''}</Badge>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Student Info */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Student Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground">School</p><p className="font-medium">{student?.school?.name ?? '—'}</p></div>
              <div><p className="text-muted-foreground">Gender</p><p className="font-medium">{student?.gender ?? '—'}</p></div>
              <div><p className="text-muted-foreground">Uniform Category</p><p className="font-medium">{student?.uniformCategory ?? '—'}</p></div>
              <div><p className="text-muted-foreground">Status</p><p className="font-medium">{student?.status ?? ''}</p></div>
            </div>
            {student?.notes && <div className="text-sm"><p className="text-muted-foreground">Notes</p><p>{student.notes}</p></div>}
          </CardContent>
        </Card>

        {/* Parent/Guardian */}
        <Card>
          <CardHeader><CardTitle className="text-base">Parent / Guardian</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm space-y-2">
              <p className="font-medium">{student?.parentName ?? 'Not provided'}</p>
              {student?.parentPhone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3 w-3" /> <span suppressHydrationWarning>{student.parentPhone}</span></p>}
              {student?.parentEmail && <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3 w-3" /> <span suppressHydrationWarning>{student.parentEmail}</span></p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enrollment History */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Enrollment History</CardTitle></CardHeader>
        <CardContent>
          {(student?.enrollments ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">No enrollments</p>
          ) : (
            <div className="space-y-2">
              {(student?.enrollments ?? []).map((e: any, i: number) => (
                <div key={e?.id} className={`p-3 rounded-lg ${i === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{e?.academicYear?.name ?? ''}</span>
                      <span className="text-muted-foreground ml-2">{e?.class?.name ?? ''} {e?.division?.name ? `/ ${e.division.name}` : ''}</span>
                      {e?.rollNumber && <span className="text-muted-foreground ml-2">Roll: {e.rollNumber}</span>}
                    </div>
                    <Badge variant={e?.status === 'enrolled' ? 'default' : 'secondary'}>{e?.status ?? ''}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assigned Products */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Assigned Products</CardTitle></CardHeader>
        <CardContent>
          {(products ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">No products assigned via school mapping</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(products ?? []).map((sp: any) => (
                <div key={sp?.id} className="p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{sp?.product?.name ?? ''}</p>
                      <p className="text-xs text-muted-foreground">{sp?.product?.sku ?? ''} · ₹{sp?.priceOverride ?? sp?.product?.sellingPrice ?? 0}</p>
                    </div>
                    <Badge variant={sp?.isMandatory ? 'default' : 'secondary'} className="text-xs">
                      {sp?.isMandatory ? 'Required' : 'Optional'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
