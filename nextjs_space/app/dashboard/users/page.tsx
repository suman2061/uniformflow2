import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { UsersPage } from './_components/users-page';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <UsersPage userRole={session?.user?.role ?? ''} />;
}
