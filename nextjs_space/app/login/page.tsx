import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { LoginForm } from './_components/login-form';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    if (session.user.role === 'SUPER_ADMIN') redirect('/admin');
    redirect('/dashboard');
  }
  return <LoginForm />;
}
