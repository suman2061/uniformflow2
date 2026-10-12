'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { School, GraduationCap, Package, Calendar, Users, Activity, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeDate } from '@/components/safe-format';

interface DashboardStats {
  schools: number;
  students: number;
  products: number;
  academicYears: number;
  users: number;
}

export function DashboardContent() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r: any) => r?.json())
      .then((data: any) => {
        setStats(data?.stats ?? null);
        setActivity(data?.recentActivity ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Active Schools', value: stats?.schools ?? 0, icon: School, href: '/dashboard/schools', color: 'text-blue-600 bg-blue-50' },
    { label: 'Active Students', value: stats?.students ?? 0, icon: GraduationCap, href: '/dashboard/students', color: 'text-green-600 bg-green-50' },
    { label: 'Products', value: stats?.products ?? 0, icon: Package, href: '/dashboard/products', color: 'text-orange-600 bg-orange-50' },
    { label: 'Academic Years', value: stats?.academicYears ?? 0, icon: Calendar, href: '/dashboard/schools', color: 'text-purple-600 bg-purple-50' },
    { label: 'Team Members', value: stats?.users ?? 0, icon: Users, href: '/dashboard/users', color: 'text-pink-600 bg-pink-50' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your uniform business operations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((card: any) => {
          const Icon = card?.icon;
          return (
            <Link key={card?.label} href={card?.href ?? '#'}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-5">
                  {loading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <>
                      <div className={`inline-flex p-2 rounded-lg ${card?.color ?? ''}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mt-3">
                        <p className="text-2xl font-bold font-mono">{card?.value ?? 0}</p>
                        <p className="text-sm text-muted-foreground">{card?.label}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/dashboard/schools?action=new">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2"><School className="h-4 w-4" /> Add School</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard/students?action=new">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Add Student</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard/products?action=new">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2"><Package className="h-4 w-4" /> Add Product</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard/students/import">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Import Students (CSV)</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i: number) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (activity ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">No recent activity</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {(activity ?? []).map((log: any) => (
                  <div key={log?.id} className="flex items-start gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground truncate">{log?.summary ?? ''}</p>
                      <p className="text-xs text-muted-foreground">
                        {log?.userName ?? 'System'} ·{' '}
                        <SafeDate date={log?.createdAt} options={{ dateStyle: 'medium', timeStyle: 'short' }} />
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
