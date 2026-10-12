import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { PaymentsPage } from './_components/payments-page';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <PaymentsPage userRole={session?.user?.role ?? ''} />;
}
