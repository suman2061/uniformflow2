import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { AuditLogPage } from './_components/audit-log-page';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <AuditLogPage userRole={session?.user?.role ?? ''} />;
}
