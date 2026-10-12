import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ProductsPage } from './_components/products-page';

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <ProductsPage userRole={session?.user?.role ?? ''} />;
}
