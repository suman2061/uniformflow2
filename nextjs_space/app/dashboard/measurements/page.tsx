import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { MeasurementsPage } from './_components/measurements-page';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <MeasurementsPage userRole={session?.user?.role ?? ''} />;
}
