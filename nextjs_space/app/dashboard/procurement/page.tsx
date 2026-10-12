import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ProcurementPage } from './_components/procurement-page';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <ProcurementPage userRole={session?.user?.role ?? ''} />;
}
