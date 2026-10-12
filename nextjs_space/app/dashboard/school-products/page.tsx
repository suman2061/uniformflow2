import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { SchoolProductsPage } from './_components/school-products-page';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <SchoolProductsPage userRole={session?.user?.role ?? ''} />;
}
