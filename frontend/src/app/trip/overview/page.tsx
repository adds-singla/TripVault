"use client";
import Link from "next/link";
import { useState } from "react";
import { BedDouble, Calendar, CheckCircle2, Circle, Lock, Plane, Share2, Sparkles, Wallet, Sun, ListChecks, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { fileSize, fmtDate, fmtTime, dateRange, money, num } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { Dashboard } from "@/lib/types";
import { useTrip } from "@/components/TripContext";
import { ShareModal } from "@/components/modals";
import { Cover, DestinationBriefing } from "@/components/trip";
import { AvatarStack, Button, Card, Chip, EmptyState, ErrorBox, ProgressBar, ProgressRing, Skeleton } from "@/components/ui";

const Section = ({ icon, title, right, children }: { icon: React.ReactNode; title: string; right?: React.ReactNode; children: React.ReactNode }) => (
  <Card className="p-5 md:p-6"><div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-4">
    <h2 className="flex items-center gap-2.5 text-headline-sm"><span className="text-primary">{icon}</span>{title}</h2>{right}</div>{children}</Card>
);

export default function Overview() {
  const { tripId, trip, canEdit, reload } = useTrip();
  const { data: d, loading, error, reload: reloadD, setData } = useApi<Dashboard>(`/trips/${tripId}/dashboard`);
  const [share, setShare] = useState(false);
  async function toggle(id: string, done: boolean) {
    setData((p) => p && { ...p, checklist_preview: p.checklist_preview.map((c) => (c.id === id ? { ...c, done: !done } : c)) });
    await api(`/trips/${tripId}/checklist/${id}`, { method: "PATCH", json: { done: !done } }).catch(() => {});
    reloadD(); reload();
  }
  const days = trip.start_date && trip.end_date ? Math.round((+new Date(trip.end_date) - +new Date(trip.start_date)) / 864e5) + 1 : null;
  const m = d?.next_milestone;
  const pct = d && d.counts.checklist_total ? Math.round((d.counts.checklist_done / d.counts.checklist_total) * 100) : 0;
  const owed = num(d?.kpis.owed_to_you), owe = num(d?.kpis.you_owe);
  return (
    <div>
      <Cover name={trip.name} className="mb-6 flex h-56 items-end rounded-card p-6 text-white md:h-64">
        <Chip className="absolute left-5 top-5 border-white/30 bg-white/20 text-white"><Lock size={12} />Confidential travel dossier</Chip>
        <div className="absolute right-5 top-5 flex gap-2"><Button size="sm" variant="secondary" onClick={() => setShare(true)}><Share2 size={14} />Share Hub</Button></div>
        <div className="relative flex w-full flex-wrap items-end justify-between gap-4">
          <div><h1 className="flex items-center gap-3 text-headline-lg md:text-headline-xl">{trip.name}{days && <Chip className="border-white/30 bg-white/20 text-white">{days} days</Chip>}</h1>
            <p className="mt-1 flex items-center gap-2 text-body-md text-white/90"><Calendar size={15} />{dateRange(trip.start_date, trip.end_date)}{trip.destination && ` · ${trip.destination}`}</p></div>
          <div className="rounded-pill bg-white/15 p-1.5 backdrop-blur"><AvatarStack names={trip.members.map((x) => x.name)} max={4} /></div>
        </div>
      </Cover>
      {error && <ErrorBox message={error} retry={reloadD} />}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section icon={<Plane size={20} />} title="Next milestone" right={m && <Chip tone="accent"><Calendar size={12} />{fmtDate(m.starts_at, { month: "short", day: "numeric" })} · {fmtTime(m.starts_at)}</Chip>}>
            {loading ? <Skeleton className="h-32" /> : m ? (
              <div className="rounded-card border border-line bg-canvas p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><div className="flex items-center gap-2"><h3 className="text-headline-md">{m.title}</h3><Chip tone="success">{m.kind}</Chip></div>
                    {m.location && <p className="mt-1 text-body-md text-muted">{m.location}</p>}{m.notes && <p className="mt-2 text-body-md">{m.notes}</p>}</div>
                  {m.confirmation_ref && <div className="rounded-input border border-line bg-surface px-4 py-3"><div className="text-label-sm uppercase tracking-wider text-muted">Booking ref (PNR)</div><div className="tnum text-headline-sm text-accent">{m.confirmation_ref}</div></div>}
                </div>
                <div className="mt-4 text-right"><Link href={`/trip/itinerary/?id=${tripId}`} className="text-label-md font-semibold text-accent">View full itinerary →</Link></div>
              </div>
            ) : <EmptyState icon={<Plane />} title="Nothing planned yet" text="Add flights, stays and activities to build your day-by-day plan." action={canEdit && <Link href={`/trip/itinerary/?id=${tripId}`}><Button>Open itinerary</Button></Link>} />}
          </Section>

          <Section icon={<Wallet size={20} />} title="Budget & split ledger" right={<Link href={`/trip/expenses/?id=${tripId}`}><Button size="sm" variant="accent">Split an expense</Button></Link>}>
            {loading ? <Skeleton className="h-40" /> : (
              <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                <div className="flex flex-col items-center rounded-card bg-canvas p-5">
                  <ProgressRing size={110} stroke={10} percent={d?.kpis.budget_used_percent ?? 0} label={d?.kpis.budget_used_percent != null ? `${Math.round(d.kpis.budget_used_percent)}%` : "n/a"} />
                  <p className="mt-3 text-label-sm uppercase text-muted">Budget spent</p>
                  <p className="tnum mt-1 text-body-md"><b>{money(d?.kpis.total_spent, trip.currency, 0)}</b>{d?.budget && <span className="text-muted"> of {money(d.budget, trip.currency, 0)}</span>}</p>
                </div>
                <div className="space-y-4">
                  <div className={`flex items-center justify-between rounded-card border p-4 ${owe > 0 ? "border-danger/30 bg-danger/10" : "border-success/30 bg-success/10"}`}>
                    <div><div className="text-label-md">{owe > 0 ? "You owe" : "You are owed"}</div><div className="text-body-sm text-muted">{owe > 0 || owed > 0 ? "Across shared trip expenses" : "All settled up"}</div></div>
                    <div className={`tnum text-headline-md ${owe > 0 ? "text-danger" : "text-success"}`}>{money(owe > 0 ? owe : owed, trip.currency)}</div></div>
                  {d?.categories.slice(0, 2).map((c) => <div key={c.category}><div className="mb-1 flex justify-between text-body-sm"><span>{c.category}</span><span className="tnum text-muted">{money(c.amount, trip.currency, 0)}</span></div><ProgressBar percent={c.percent} color="bg-primary" /></div>)}
                </div>
              </div>
            )}
          </Section>

          <Section icon={<Lock size={20} />} title="Cloud vault" right={<Link href={`/trip/documents/?id=${tripId}`}><Button size="sm" variant="secondary">{canEdit ? "Add file" : "Open vault"}</Button></Link>}>
            <p className="-mt-2 mb-3 text-body-sm text-muted">{d?.counts.documents ?? 0} files · private S3 storage, encrypted at rest (AES-256)</p>
            {d?.recent_documents.length ? <div className="grid gap-3 sm:grid-cols-2">{d.recent_documents.map((x) => (
              <Link key={x.id} href={`/trip/documents/?id=${tripId}`} className="flex items-center gap-3 rounded-card border border-line bg-canvas p-4 hover:shadow-l2"><FileText className="text-primary" /><div className="min-w-0"><div className="truncate text-label-lg">{x.name}</div><div className="text-body-sm text-muted">{x.folder} · {fileSize(x.size)}</div></div></Link>))}</div>
              : !loading && <p className="text-body-md text-muted">No documents yet. Upload tickets, vouchers and IDs to keep them in one place.</p>}
          </Section>
        </div>

        <div className="space-y-6">
          <Section icon={<ListChecks size={20} />} title="Packing readiness" right={<Chip>{d?.counts.checklist_done ?? 0}/{d?.counts.checklist_total ?? 0}</Chip>}>
            <div className="flex items-center gap-4 rounded-card bg-canvas p-4"><ProgressRing percent={pct} size={64} /><div className="text-body-md"><b>{(d?.counts.checklist_total ?? 0) - (d?.counts.checklist_done ?? 0)} items remaining</b></div></div>
            <ul className="mt-3 space-y-2">
              {d?.checklist_preview.map((c) => (
                <li key={c.id}><button disabled={!canEdit} onClick={() => toggle(c.id, c.done)} className="flex w-full items-center gap-3 rounded-input border border-line px-3 py-2.5 text-left">
                  {c.done ? <CheckCircle2 size={18} className="text-primary" /> : <Circle size={18} className="text-primary" />}<span className={c.done ? "text-muted line-through" : ""}>{c.label}</span></button></li>))}
            </ul>
            {!loading && !d?.checklist_preview.length && <p className="text-body-md text-muted">No packing items yet.</p>}
            <Link href={`/trip/checklist/?id=${tripId}`} className="mt-3 block rounded-pill border border-line py-2 text-center text-label-md hover:bg-stone">View all {d?.counts.checklist_total ?? 0} checklist items</Link>
          </Section>
          <Section icon={<Sun size={20} />} title="Destination briefing"><DestinationBriefing trip={trip} /></Section>
          {d?.lodging && <Card className="bg-primary p-5 text-on-primary"><div className="text-label-sm uppercase tracking-wider opacity-70">Confirmed lodging</div>
            <div className="mt-1 flex items-center gap-2 text-headline-sm"><BedDouble size={20} />{d.lodging.name}</div>{d.lodging.address && <p className="mt-1 text-body-md opacity-80">{d.lodging.address}</p>}
            <Link href={`/trip/map/?id=${tripId}`} className="mt-3 inline-block text-label-md font-semibold underline">View on map</Link></Card>}
        </div>
      </div>
      <ShareModal open={share} onClose={() => setShare(false)} />
    </div>
  );
}
