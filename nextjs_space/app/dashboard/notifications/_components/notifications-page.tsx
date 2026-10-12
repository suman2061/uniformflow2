'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { SafeDate } from '@/components/safe-format';
import { Bell, Loader2, CheckCheck } from 'lucide-react';

export function NotificationsPage({ userRole }: { userRole: string }) {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/notifications').then((r) => r.json()).then((d) => {
      setItems(d.notifications ?? []);
      setUnread(d.unread ?? 0);
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    try {
      await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'markRead', id }) });
      load();
    } catch { toast({ title: 'Failed to update', variant: 'destructive' }); }
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'markAllRead' }) });
      load();
    } catch { toast({ title: 'Failed to update', variant: 'destructive' }); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Bell className="h-6 w-6 text-indigo-600" /> Notifications
            {unread > 0 && <Badge className="bg-indigo-100 text-indigo-700" variant="secondary">{unread} unread</Badge>}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Alerts and updates across your operations.</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={markAllRead} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />} Mark all read
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-slate-400">No notifications.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((n) => (
                <li key={n.id} className={`flex items-start gap-3 px-4 py-4 ${n.readAt ? '' : 'bg-indigo-50/40'}`}>
                  <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${n.readAt ? 'bg-slate-300' : 'bg-indigo-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-800">{n.title}</span>
                      {n.type && <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs">{n.type}</Badge>}
                    </div>
                    {n.body && <p className="text-sm text-slate-600 mt-0.5">{n.body}</p>}
                    <p className="text-xs text-slate-400 mt-1"><SafeDate date={n.createdAt} options={{ dateStyle: 'medium', timeStyle: 'short' }} /></p>
                  </div>
                  {!n.readAt && (
                    <Button variant="ghost" size="sm" onClick={() => markRead(n.id)} className="text-indigo-600">Mark read</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
