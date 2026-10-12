import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { BillingPage } from './_components/billing-page';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <BillingPage userRole={session?.user?.role ?? ''} />;
}
