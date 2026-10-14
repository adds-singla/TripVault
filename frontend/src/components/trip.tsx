"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Calendar, CheckCircle2, Circle, CloudSun, Plane, BedDouble, Utensils, Bus, Sparkles, MoreHorizontal, Trash2 } from "lucide-react";
import { cn, dateRange, daysUntil, fmtDate, fmtTime, gradientFor, money } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { ChecklistItem, Dashboard, ItineraryItem, Trip } from "@/lib/types";
import { AvatarStack, Card, Chip, ProgressBar, Skeleton } from "./ui";
import { useTrip } from "./TripContext";

/* ---------- Cover (gradient from the trip name; no placeholder photos) ---------- */
export const Cover = ({ name, className, children }: { name: string; className?: string; children?: React.ReactNode }) => (
  <div className={cn("relative overflow-hidden", className)} style={{ background: gradientFor(name) }}>
    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
    <span className="absolute right-4 top-2 select-none text-[120px] font-bold leading-none text-white/10">{name[0]}</span>
    {children}
  </div>
);

/* ---------- Trip card (dashboard) ---------- */
export function TripCard({ trip, onDelete }: { trip: Trip; onDelete?(): void }) {
  const pct = trip.checklist_total ? Math.round((trip.checklist_done / trip.checklist_total) * 100) : 0;
  const d = daysUntil(trip.start_date);
  const badge = d === null ? "Planning" : d > 0 ? `Starts in ${d}d` : trip.end_date && daysUntil(trip.end_date)! < 0 ? "Completed" : "In progress";
  return (
    <Card className="group overflow-hidden transition hover:shadow-l2">
      <Link href={`/trip/overview/?id=${trip.id}`} className="block">
        <Cover name={trip.name} className="h-44">
          <Chip className="absolute left-3 top-3 border-white/30 bg-white/90 text-espresso">{badge}</Chip>
          <Chip className="absolute bottom-3 right-3 border-white/30 bg-white/90 text-espresso"><Calendar size={12} />{dateRange(trip.start_date, trip.end_date)}</Chip>
        </Cover>
      </Link>
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/trip/overview/?id=${trip.id}`}><h3 className="text-headline-sm hover:underline">{trip.name}</h3></Link>
          {onDelete && trip.my_role === "owner" && <button aria-label="Delete trip" onClick={onDelete} className="rounded-full p-1.5 text-muted hover:bg-stone"><Trash2 size={16} /></button>}
        </div>
        <p className="text-body-md text-muted">{trip.destination || "No destination yet"}{trip.my_role !== "owner" && ` · ${trip.my_role}`}</p>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <AvatarStack names={trip.members.map((m) => m.name)} />
          <Chip className="tnum">{money(trip.total_spent, trip.currency, 0)} spent</Chip>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-body-sm text-muted"><span>Packing Checklist</span><span className="text-accent">{pct}% ready</span></div>
          <ProgressBar percent={pct} />
        </div>
      </div>
    </Card>
  );
}
export const TripCardSkeleton = () => <Card className="overflow-hidden"><Skeleton className="h-44 rounded-none" /><div className="space-y-3 p-5"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-2 w-full" /></div></Card>;

/* ---------- Tabs ---------- */
const TABS = [["overview", "Overview"], ["itinerary", "Itinerary"], ["documents", "Documents"], ["expenses", "Expenses"], ["checklist", "Checklist"], ["map", "Map"], ["photos", "Photos"], ["members", "Members"]] as const;
export function TripTabs() {
  const { tripId } = useTrip(); const path = usePathname();
  const { data } = useApi<Dashboard>(`/trips/${tripId}/dashboard`);
  const c = data?.counts;
  const count: Record<string, string | number | undefined> = { itinerary: c?.itinerary, documents: c?.documents, expenses: c ? undefined : undefined,
    checklist: c ? `${c.checklist_done}/${c.checklist_total}` : undefined, map: c?.places, photos: c?.photos };
  return (
    <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Trip sections">
      {TABS.map(([k, label]) => (
        <Link key={k} href={`/trip/${k}/?id=${tripId}`} className={cn("flex shrink-0 items-center gap-2 rounded-pill px-4 py-2 text-label-lg transition",
          path.startsWith(`/trip/${k}`) ? "bg-primary text-on-primary" : "text-espresso hover:bg-stone")}>
          {label}{count[k] !== undefined && <span className={cn("tnum rounded-pill px-1.5 text-label-sm", path.startsWith(`/trip/${k}`) ? "bg-white/20" : "bg-stone")}>{count[k]}</span>}
        </Link>
      ))}
    </nav>
  );
}

/* ---------- Timeline ---------- */
const KIND = { flight: Plane, stay: BedDouble, dinner: Utensils, transit: Bus, activity: Sparkles };
const KIND_COLOR = { flight: "bg-accent", stay: "bg-primary", dinner: "bg-warning", transit: "bg-muted", activity: "bg-success" };
export function Timeline({ items, onEdit, onDelete, canEdit }: { items: ItineraryItem[]; onEdit(i: ItineraryItem): void; onDelete(i: ItineraryItem): void; canEdit: boolean }) {
  const days = items.reduce<Record<string, ItineraryItem[]>>((acc, i) => { (acc[i.starts_at.slice(0, 10)] ||= []).push(i); return acc; }, {});
  return (
    <div className="space-y-8">
      {Object.entries(days).map(([day, list], n) => (
        <section key={day}>
          <h2 className="mb-3 flex items-center gap-3 text-headline-sm"><Chip tone="accent">Day {n + 1}</Chip>{fmtDate(day, { weekday: "long", month: "long", day: "numeric" })}</h2>
          <ol className="relative ml-4 border-l-2 border-line pl-8">
            {list.map((i) => { const I = KIND[i.kind]; return (
              <li key={i.id} className="relative pb-5 last:pb-0">
                <span className={cn("absolute -left-[45px] top-3 flex h-8 w-8 items-center justify-center rounded-full text-white ring-4 ring-canvas", KIND_COLOR[i.kind])}><I size={15} /></span>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><div className="tnum text-label-md text-muted">{fmtTime(i.starts_at)}{i.ends_at && ` – ${fmtTime(i.ends_at)}`}</div>
                      <h3 className="text-label-lg text-base">{i.title}</h3>{i.location && <p className="text-body-md text-muted">{i.location}</p>}
                      {i.notes && <p className="mt-2 text-body-md">{i.notes}</p>}</div>
                    <div className="flex shrink-0 items-center gap-2">{i.confirmation_ref && <Chip tone="accent">PNR {i.confirmation_ref}</Chip>}
                      {canEdit && <><button onClick={() => onEdit(i)} className="text-label-md font-semibold text-accent">Edit</button><button onClick={() => onDelete(i)} aria-label="Delete" className="text-muted hover:text-danger"><Trash2 size={15} /></button></>}</div>
                  </div>
                </Card>
              </li>); })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/* ---------- Checklist group ---------- */
export function ChecklistGroup({ name, items, canEdit, onToggle, onDelete }: { name: string; items: ChecklistItem[]; canEdit: boolean; onToggle(i: ChecklistItem): void; onDelete(i: ChecklistItem): void }) {
  const done = items.filter((i) => i.done).length;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-headline-sm">{name}</h3><span className="tnum text-body-sm text-muted">{done}/{items.length}</span></div>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 rounded-input border border-line px-3 py-2.5">
            <button disabled={!canEdit} onClick={() => onToggle(i)} aria-label={i.done ? "Mark not packed" : "Mark packed"} className="text-primary disabled:opacity-60">
              {i.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button>
            <span className={cn("flex-1 text-body-md", i.done && "text-muted line-through")}>{i.label}</span>
            {!i.done && <Chip tone="warning">Pending</Chip>}
            {canEdit && <button onClick={() => onDelete(i)} aria-label="Delete item" className="text-muted hover:text-danger"><Trash2 size={14} /></button>}
          </li>))}
      </ul>
    </Card>
  );
}

/* ---------- Destination briefing: live weather (Open-Meteo) + FX (open.er-api.com), no API keys ---------- */
const CCY: Record<string, string> = { SG: "SGD", JP: "JPY", IT: "EUR", FR: "EUR", DE: "EUR", ES: "EUR", GB: "GBP", IN: "INR", US: "USD", AU: "AUD", TH: "THB", AE: "AED", CA: "CAD" };
const WX: Record<number, string> = { 0: "Clear sky", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Foggy", 51: "Light drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 80: "Rain showers", 95: "Thunderstorms" };
export function DestinationBriefing({ trip }: { trip: Trip }) {
  const [info, setInfo] = useState<{ temp: number; desc: string; tz: string; ccy: string | null; rate: number | null } | null | "none">(null);
  useEffect(() => {
    if (!trip.destination) { setInfo("none"); return; }
    (async () => {
      try {
        const g = (await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trip.destination)}&count=1`)).json()).results?.[0];
        if (!g) return setInfo("none");
        const w = (await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,weather_code`)).json()).current;
        const ccy = CCY[g.country_code] ?? null; let rate: number | null = null;
        if (ccy && ccy !== trip.currency) { try { rate = (await (await fetch(`https://open.er-api.com/v6/latest/${trip.currency}`)).json()).rates?.[ccy] ?? null; } catch {} }
        setInfo({ temp: Math.round(w.temperature_2m), desc: WX[w.weather_code] ?? "Current conditions", tz: g.timezone, ccy, rate });
      } catch { setInfo("none"); }
    })();
  }, [trip.destination, trip.currency]);
  if (info === null) return <Skeleton className="h-40" />;
  if (info === "none") return <p className="text-body-md text-muted">Live weather and exchange rate unavailable for this destination (or you're offline).</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-input bg-canvas p-4"><div><div className="tnum text-headline-xl">{info.temp}°C</div><div className="text-body-md text-muted">{info.desc}</div></div><CloudSun size={44} className="text-warning" /></div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-input bg-canvas p-3"><div className="text-label-sm uppercase text-muted">Local time</div><div className="tnum text-label-lg">{new Date().toLocaleTimeString("en-US", { timeZone: info.tz, hour: "2-digit", minute: "2-digit", hour12: false })}</div></div>
        <div className="rounded-input bg-canvas p-3"><div className="text-label-sm uppercase text-muted">Currency</div><div className="tnum text-label-lg">{info.rate && info.ccy ? `1 ${trip.currency} = ${info.rate.toFixed(2)} ${info.ccy}` : info.ccy ?? trip.currency}</div></div>
      </div>
    </div>
  );
}
