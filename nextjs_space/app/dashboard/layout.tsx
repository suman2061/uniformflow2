import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { DashboardShell } from './_components/dashboard-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (session?.user?.role === 'SUPER_ADMIN') redirect('/admin');
  if (!session?.user?.businessId) redirect('/login');

  return (
    <DashboardShell
      userName={session?.user?.name ?? ''}
      userEmail={session?.user?.email ?? ''}
      userRole={session?.user?.role ?? ''}
    >
      {children}
    </DashboardShell>
  );
}
