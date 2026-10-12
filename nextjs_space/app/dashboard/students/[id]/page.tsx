import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { StudentDetail } from './_components/student-detail';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const { id } = await params;
  return <StudentDetail studentId={id} userRole={session?.user?.role ?? ''} />;
}
