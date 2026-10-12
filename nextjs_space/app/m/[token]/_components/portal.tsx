'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Clock, Ban, AlertCircle, Loader2, Ruler, ShirtIcon } from 'lucide-react';

const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const DEFAULT_FIELDS = [
  { key: 'chest', label: 'Chest (inches)' },
  { key: 'waist', label: 'Waist (inches)' },
  { key: 'length', label: 'Length (inches)' },
  { key: 'shoulder', label: 'Shoulder (inches)' },
  { key: 'sleeve', label: 'Sleeve (inches)' },
];

function sizesFor(product: any): string[] {
  const chart = product?.sizeChart;
  if (chart && Array.isArray(chart.sizes) && chart.sizes.length > 0) return chart.sizes;
  if (Array.isArray(chart) && chart.length > 0) return chart;
  return DEFAULT_SIZES;
}
function fieldsFor(product: any): { key: string; label: string }[] {
  const mf = product?.measurementFields;
  if (Array.isArray(mf) && mf.length > 0) {
    return mf.map((f: any) => (typeof f === 'string' ? { key: f, label: f } : { key: f.key ?? f.label, label: f.label ?? f.key }));
  }
  return DEFAULT_FIELDS;
}

export function PortalClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [entries, setEntries] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/public/measurement/${token}`);
        const json = await res.json();
        if (!json.ok) { setReason(json.reason ?? 'NOT_FOUND'); }
        else {
          setData(json);
          const init: Record<string, any> = {};
          for (const p of json.products ?? []) {
            init[p.product.id] = { mode: 'standard', size: '', fields: {}, notes: '' };
          }
          setEntries(init);
        }
      } catch { setReason('NOT_FOUND'); }
      finally { setLoading(false); }
    })();
  }, [token]);

  function setEntry(pid: string, patch: any) {
    setEntries((prev) => ({ ...prev, [pid]: { ...prev[pid], ...patch } }));
  }
  function setField(pid: string, key: string, value: string) {
    setEntries((prev) => ({ ...prev, [pid]: { ...prev[pid], fields: { ...prev[pid].fields, [key]: value } } }));
  }

  async function submit() {
    setError(null);
    if (!confirmed) { setError('Please confirm the student details first.'); return; }
    const items = (data.products ?? []).map((p: any) => {
      const e = entries[p.product.id] ?? {};
      return { productId: p.product.id, mode: e.mode, size: e.mode === 'standard' ? e.size : null, fields: e.mode === 'manual' ? e.fields : null, notes: e.notes || null };
    });
    // Require at least a size or a filled field for mandatory products
    for (const p of data.products ?? []) {
      const e = entries[p.product.id];
      if (p.isMandatory) {
        if (e.mode === 'standard' && !e.size) { setError(`Please select a size for ${p.product.name}.`); return; }
        if (e.mode === 'manual' && Object.values(e.fields ?? {}).every((v) => !v)) { setError(`Please enter measurements for ${p.product.name}.`); return; }
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/measurement/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, parentConfirmed: confirmed }),
      });
      const json = await res.json();
      if (json.ok) setDone(true);
      else setError(json.error || 'Submission failed. Please try again.');
    } catch { setError('Submission failed. Please try again.'); }
    finally { setSubmitting(false); }
  }

  if (loading) {
    return <Centered><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-muted-foreground mt-3">Loading…</p></Centered>;
  }

  if (done) {
    return <Centered><StatusCard icon={<CheckCircle2 className="h-12 w-12 text-green-600" />} title="Measurements Submitted" message="Thank you! The uniform supplier has received your measurements. You can close this page." /></Centered>;
  }

  if (reason) {
    const map: Record<string, { icon: any; title: string; msg: string }> = {
      NOT_FOUND: { icon: <AlertCircle className="h-12 w-12 text-muted-foreground" />, title: 'Link Not Valid', msg: 'This measurement link is invalid. Please contact your school or uniform supplier.' },
      EXPIRED: { icon: <Clock className="h-12 w-12 text-amber-500" />, title: 'Link Expired', msg: 'This measurement link has expired. Please request a new link from your uniform supplier.' },
      REVOKED: { icon: <Ban className="h-12 w-12 text-destructive" />, title: 'Link Disabled', msg: 'This link has been disabled. Please contact your uniform supplier for a new one.' },
      ALREADY_SUBMITTED: { icon: <CheckCircle2 className="h-12 w-12 text-green-600" />, title: 'Already Submitted', msg: 'Measurements for this student have already been submitted. Thank you!' },
    };
    const m = map[reason] ?? map.NOT_FOUND;
    return <Centered><StatusCard icon={m.icon} title={m.title} message={m.msg} /></Centered>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-xl mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <ShirtIcon className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold leading-tight">{data.business?.name}</p>
            <p className="text-xs text-muted-foreground">Uniform Measurement Form</p>
          </div>
        </div>

        {/* Student card */}
        <Card className="mb-4">
          <CardHeader className="pb-3"><CardTitle className="text-base">Confirm Student Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Student" value={data.student?.name} />
            <Row label="Student ID" value={data.student?.permanentId} />
            <Row label="School" value={data.school?.name} />
            <Row label="Academic Year" value={data.academicYear?.name} />
            <Row label="Class" value={[data.enrollment?.className, data.enrollment?.divisionName].filter(Boolean).join(' - ') || '—'} />
            <label className="flex items-start gap-2 pt-3 cursor-pointer">
              <Checkbox checked={confirmed} onCheckedChange={(v: any) => setConfirmed(!!v)} />
              <span className="text-sm">I confirm these are the correct student details.</span>
            </label>
          </CardContent>
        </Card>

        {/* Products */}
        {(data.products ?? []).length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No uniform items are assigned yet. Please contact your supplier.</CardContent></Card>
        )}
        {(data.products ?? []).map((p: any) => {
          const e = entries[p.product.id] ?? { mode: 'standard', size: '', fields: {} };
          const sizes = sizesFor(p.product);
          const fields = fieldsFor(p.product);
          return (
            <Card key={p.product.id} className="mb-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-primary" /> {p.product.name}
                  {p.isMandatory && <span className="text-[10px] font-medium uppercase tracking-wide text-destructive">Required</span>}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{p.product.category}{p.product.color ? ` · ${p.product.color}` : ''}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <ModeBtn active={e.mode === 'standard'} onClick={() => setEntry(p.product.id, { mode: 'standard' })}>Standard Size</ModeBtn>
                  <ModeBtn active={e.mode === 'manual'} onClick={() => setEntry(p.product.id, { mode: 'manual' })}>Custom Measurements</ModeBtn>
                </div>
                {e.mode === 'standard' ? (
                  <div className="grid grid-cols-4 gap-2">
                    {sizes.map((sz: string) => (
                      <button key={sz} type="button" onClick={() => setEntry(p.product.id, { size: sz })}
                        className={`py-2 rounded-md border text-sm font-medium transition-colors ${e.size === sz ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-border'}`}>
                        {sz}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {fields.map((f) => (
                      <div key={f.key}>
                        <Label className="text-xs">{f.label}</Label>
                        <Input inputMode="decimal" value={e.fields?.[f.key] ?? ''} onChange={(ev) => setField(p.product.id, f.key, ev.target.value)} placeholder="0" />
                      </div>
                    ))}
                  </div>
                )}
                <Textarea placeholder="Notes (optional) — e.g. fitting preference" value={e.notes ?? ''} onChange={(ev) => setEntry(p.product.id, { notes: ev.target.value })} className="text-sm" rows={2} />
              </CardContent>
            </Card>
          );
        })}

        {error && <p className="text-sm text-destructive mt-3 text-center">{error}</p>}
      </div>

      {/* Sticky submit */}
      {(data.products ?? []).length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-card border-t border-border p-4">
          <div className="max-w-xl mx-auto">
            <Button className="w-full" size="lg" disabled={submitting} onClick={submit}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting…</> : 'Submit Measurements'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium text-right">{value || '—'}</span></div>;
}
function ModeBtn({ active, onClick, children }: any) {
  return <button type="button" onClick={onClick} className={`flex-1 py-1.5 rounded-md text-sm font-medium border transition-colors ${active ? 'bg-primary/10 text-primary border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted'}`}>{children}</button>;
}
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4 text-center">{children}</div>;
}
function StatusCard({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
  return (
    <Card className="max-w-md w-full"><CardContent className="py-10 flex flex-col items-center text-center gap-3">
      {icon}<h1 className="text-xl font-semibold">{title}</h1><p className="text-muted-foreground">{message}</p>
    </CardContent></Card>
  );
}
