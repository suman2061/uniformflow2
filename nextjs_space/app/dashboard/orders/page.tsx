import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { OrdersPage } from './_components/orders-page';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <OrdersPage userRole={session?.user?.role ?? ''} />;
}
