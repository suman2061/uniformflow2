import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { DeliveriesPage } from './_components/deliveries-page';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <DeliveriesPage userRole={session?.user?.role ?? ''} />;
}
