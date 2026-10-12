import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ImportPage } from './_components/import-page';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <ImportPage />;
}
