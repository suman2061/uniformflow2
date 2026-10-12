import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await auth();
  if (session?.user?.id) {
    if (session.user.role === 'SUPER_ADMIN') {
      redirect('/admin');
    }
    redirect('/dashboard');
  }
  redirect('/login');
}
