import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ProductionPage } from './_components/production-page';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <ProductionPage userRole={session?.user?.role ?? ''} />;
}
