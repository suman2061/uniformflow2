import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { SchoolDetailPage } from './_components/school-detail';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const { id } = await params;
  return <SchoolDetailPage schoolId={id} userRole={session?.user?.role ?? ''} />;
}
