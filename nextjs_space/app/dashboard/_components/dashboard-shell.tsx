'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, School, Users, GraduationCap, Package, Link2, FileText,
  Settings, LogOut, Menu, X, ChevronDown, Shield, Ruler, BarChart3,
  ShoppingCart, Factory, Scissors, Truck, ReceiptText, Wallet, Bell, CreditCard,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/schools', label: 'Schools', icon: School },
  { href: '/dashboard/students', label: 'Students', icon: GraduationCap },
  { href: '/dashboard/products', label: 'Products', icon: Package },
  { href: '/dashboard/school-products', label: 'School Mappings', icon: Link2 },
  { href: '/dashboard/measurements', label: 'Measurements', icon: Ruler },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/dashboard/procurement', label: 'Procurement', icon: Scissors },
  { href: '/dashboard/production', label: 'Production', icon: Factory },
  { href: '/dashboard/deliveries', label: 'Deliveries', icon: Truck },
  { href: '/dashboard/invoices', label: 'Invoices', icon: ReceiptText },
  { href: '/dashboard/payments', label: 'Payments', icon: Wallet },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/users', label: 'Team', icon: Users },
  { href: '/dashboard/billing', label: 'Billing & Plan', icon: CreditCard },
  { href: '/dashboard/audit-log', label: 'Audit Log', icon: FileText },
];

interface Props {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  userRole: string;
}

export function DashboardShell({ children, userName, userEmail, userRole }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const roleLabel = (userRole ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c?.toUpperCase());

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">UF</span>
            </div>
            <span className="font-display font-bold text-lg tracking-tight">UniformFlow</span>
          </Link>
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="p-3 space-y-1">
          {(NAV_ITEMS ?? []).map((item: any) => {
            const isActive = pathname === item?.href || (item?.href !== '/dashboard' && pathname?.startsWith(item?.href));
            const Icon = item?.icon;
            return (
              <Link
                key={item?.href}
                href={item?.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {item?.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-card/80 backdrop-blur-sm border-b border-border flex items-center px-4 gap-4">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Link href="/dashboard/notifications">
            <Button variant="ghost" size="icon-sm" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 text-sm">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold text-xs">
                    {(userName ?? '').split(' ').map((n: string) => n?.[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="hidden sm:block text-left">
                  <div className="font-medium">{userName}</div>
                  <div className="text-xs text-muted-foreground">{roleLabel}</div>
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground" suppressHydrationWarning>{userEmail}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>{roleLabel}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-2 text-destructive"
                onClick={() => signOut({ redirectTo: '/login' })}
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
