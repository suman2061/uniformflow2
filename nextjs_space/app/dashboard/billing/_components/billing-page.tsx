'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CreditCard, Loader2, Check, Zap, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { inr } from '@/lib/utils';
import { SafeDate } from '@/components/safe-format';

interface Props { userRole: string; }

export function BillingPage({ userRole }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const [busy, setBusy] = useState<string | null>(null);

  const isOwner = userRole === 'BUSINESS_OWNER';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing');
      const d = await res.json();
      setData(d);
    } catch { toast({ title: 'Failed to load billing', variant: 'destructive' }); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const subscribe = async (planId: string) => {
    setBusy(planId);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingCycle: cycle }),
      });
      const d = await res.json();
      if (res.ok && d?.free) {
        toast({ title: 'Plan activated', description: 'Your plan has been updated.' });
        fetchData();
      } else if (res.status === 503 && d?.configured === false) {
        toast({
          title: 'Payment gateway not yet connected',
          description: d?.message || 'Online payments will be enabled once the gateway keys are configured.',
        });
      } else if (res.ok && d?.checkoutUrl) {
        window.location.href = d.checkoutUrl;
      } else {
        toast({ title: 'Could not start checkout', description: d?.message || d?.error, variant: 'destructive' });
      }
    } catch { toast({ title: 'Checkout failed', variant: 'destructive' }); }
    setBusy(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const sub = data?.subscription;
  const usage = data?.usage;
  const plans = data?.plans ?? [];
  const currentPlanId = sub?.planId;

  const trialExpired = sub?.status === 'trial' && sub?.trialEndsAt && new Date(sub.trialEndsAt).getTime() < Date.now();

  const UsageBar = ({ label, u }: { label: string; u: any }) => {
    const limit = u?.limit ?? 0;
    const used = u?.used ?? 0;
    const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    const over = limit > 0 && used >= limit;
    return (
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-muted-foreground">{label}</span>
          <span className={over ? 'text-destructive font-medium' : 'font-medium'}>{used} / {limit > 0 ? limit : '∞'}</span>
        </div>
        {limit > 0 && <Progress value={pct} className={over ? '[&>div]:bg-destructive' : ''} />}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2"><CreditCard className="h-6 w-6 text-primary" /> Billing &amp; Plan</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and monitor usage</p>
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Current Plan</CardTitle></CardHeader>
        <CardContent>
          {sub ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-display font-bold">{sub?.plan?.name}</span>
                  <Badge variant={sub.status === 'active' ? 'default' : sub.status === 'trial' ? 'secondary' : 'destructive'}>{sub.status}</Badge>
                </div>
                {sub.status === 'trial' && sub.trialEndsAt && (
                  <p className={`text-sm mt-1 ${trialExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {trialExpired ? 'Trial ended on ' : 'Trial ends '}
                    <SafeDate date={sub.trialEndsAt} options={{ dateStyle: 'medium' }} localize />
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{inr(Number(sub?.billingCycle === 'annual' ? sub?.plan?.annualPrice : sub?.plan?.monthlyPrice))}</div>
                <div className="text-xs text-muted-foreground capitalize">per {sub?.billingCycle === 'annual' ? 'year' : 'month'}</div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">No active subscription. Choose a plan below to get started.</div>
          )}
          {trialExpired && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-destructive/10 text-destructive p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span>Your free trial has ended. Upgrade to a paid plan to continue adding schools, team members and students.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage */}
      {usage && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Usage</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <UsageBar label="Schools" u={usage.schools} />
            <UsageBar label="Team members" u={usage.users} />
            <UsageBar label="Students" u={usage.students} />
            <UsageBar label="Storage (MB)" u={usage.storageMb} />
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-semibold">Available Plans</h2>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          <button onClick={() => setCycle('monthly')} className={`px-3 py-1 text-sm rounded-md ${cycle === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Monthly</button>
          <button onClick={() => setCycle('annual')} className={`px-3 py-1 text-sm rounded-md ${cycle === 'annual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Annual</button>
        </div>
      </div>

      {(plans?.length ?? 0) === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No plans are available yet. Please check back soon.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {(plans ?? []).map((p: any) => {
            const price = cycle === 'annual' ? Number(p.annualPrice) : Number(p.monthlyPrice);
            const isCurrent = p.id === currentPlanId;
            const features: string[] = Array.isArray(p.features) ? p.features : [];
            return (
              <Card key={p.id} className={isCurrent ? 'border-primary ring-1 ring-primary' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-lg">
                    {p.name}
                    {isCurrent && <Badge>Current</Badge>}
                  </CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{price > 0 ? inr(price) : 'Free'}</span>
                    {price > 0 && <span className="text-sm text-muted-foreground">/{cycle === 'annual' ? 'yr' : 'mo'}</span>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {p.maxSchools > 0 ? `${p.maxSchools} schools` : 'Unlimited schools'}</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {p.maxUsers > 0 ? `${p.maxUsers} team members` : 'Unlimited team'}</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {p.maxStudents > 0 ? `${p.maxStudents.toLocaleString('en-IN')} students` : 'Unlimited students'}</li>
                    {p.trialDays > 0 && <li className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> {p.trialDays}-day free trial</li>}
                    {features.map((f, i) => <li key={i} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {f}</li>)}
                  </ul>
                  {isOwner ? (
                    <Button className="w-full" disabled={isCurrent || busy === p.id} onClick={() => subscribe(p.id)}>
                      {busy === p.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {isCurrent ? 'Current Plan' : price > 0 ? 'Upgrade' : 'Switch to Free'}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center">Only the business owner can change plans.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
