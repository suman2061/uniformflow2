'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Building2, Database, LogOut, Shield, CreditCard } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const NAV = [
  { href: '/admin', label: 'Businesses', icon: Building2 },
  { href: '/admin/plans', label: 'Plans & Subscriptions', icon: CreditCard },
  { href: '/admin/demo-data', label: 'Demo Data', icon: Database },
];

interface Props { children: React.ReactNode; userName: string; userEmail: string; }

export function AdminShell({ children, userName, userEmail }: Props) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 h-16 bg-card/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-[1200px] mx-auto h-full flex items-center px-4 gap-4">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-red-600 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg">Super Admin</span>
          </Link>
          <nav className="flex items-center gap-1 ml-6">
            {(NAV ?? []).map((n: any) => {
              const active = pathname === n?.href;
              const Icon = n?.icon;
              return (
                <Link key={n?.href} href={n?.href} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors', active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}>
                  <Icon className="h-4 w-4" /> {n?.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center"><Shield className="h-3.5 w-3.5 text-red-600" /></div>
                <span className="hidden sm:inline text-sm">{userName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5"><p className="text-sm font-medium">{userName}</p><p className="text-xs text-muted-foreground" suppressHydrationWarning>{userEmail}</p></div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive gap-2" onClick={() => signOut({ redirectTo: '/login' })}>
                <LogOut className="h-4 w-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="max-w-[1200px] mx-auto p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
