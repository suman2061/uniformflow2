import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user?.active) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        // Check business status for non-super-admin
        if (user?.businessId) {
          const business = await prisma.business.findUnique({
            where: { id: user.businessId },
          });
          if (!business || business?.status !== 'active') return null;
        }

        // Log login
        await prisma.auditLog.create({
          data: {
            businessId: user.businessId,
            userId: user.id,
            userName: user.name,
            action: 'LOGIN',
            entityType: 'User',
            entityId: user.id,
            summary: `User ${user.name} logged in`,
          },
        }).catch(() => {});

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.businessId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }: any) {
      if (user) {
        token.id = user?.id ?? '';
        token.role = user?.role ?? '';
        token.businessId = user?.businessId ?? null;
      }
      return token;
    },
    session({ session, token }: any) {
      if (session?.user) {
        session.user.id = token?.id ?? '';
        session.user.role = token?.role ?? '';
        session.user.businessId = token?.businessId ?? null;
      }
      return session;
    },
  },
});
