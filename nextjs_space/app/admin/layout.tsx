import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { AdminShell } from './_components/admin-shell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (session?.user?.role !== 'SUPER_ADMIN') redirect('/dashboard');

  return (
    <AdminShell
      userName={session?.user?.name ?? ''}
      userEmail={session?.user?.email ?? ''}
    >
      {children}
    </AdminShell>
  );
}
