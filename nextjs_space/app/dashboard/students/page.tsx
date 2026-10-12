import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { StudentsPage } from './_components/students-page';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <StudentsPage userRole={session?.user?.role ?? ''} />;
}
