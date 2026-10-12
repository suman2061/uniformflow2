import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { DashboardContent } from './_components/dashboard-content';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <DashboardContent />;
}
