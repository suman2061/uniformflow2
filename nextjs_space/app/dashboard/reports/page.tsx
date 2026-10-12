import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ReportsPage } from './_components/reports-page';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return <ReportsPage userRole={session.user.role} />;
}
