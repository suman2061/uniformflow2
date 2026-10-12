import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { InvoicesPage } from './_components/invoices-page';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <InvoicesPage userRole={session?.user?.role ?? ''} />;
}
