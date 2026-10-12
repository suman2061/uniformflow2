import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { SchoolsPage } from './_components/schools-page';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <SchoolsPage userRole={session?.user?.role ?? ''} />;
}
