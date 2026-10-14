"use client";
import { useState } from "react";
import { FileText, Plane, Plus, Wallet, Luggage } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn, daysUntil, money, num } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { Trip } from "@/lib/types";
import { NewTripModal } from "@/components/modals";
import { TripCard, TripCardSkeleton } from "@/components/trip";
import { Button, Card, EmptyState, ErrorBox, Modal, StatCard, useToast } from "@/components/ui";

export default function Trips() {
  const { user } = useAuth(); const toast = useToast();
  const { data: trips, loading, error, reload } = useApi<Trip[]>("/trips");
  const [tab, setTab] = useState("All Trips"); const [open, setOpen] = useState(false); const [del, setDel] = useState<Trip | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const filtered = (trips ?? []).filter((t) => tab === "All Trips" ? true : tab === "Upcoming" ? !t.end_date || t.end_date >= today : tab === "Past" ? !!t.end_date && t.end_date < today : t.my_role !== "owner");
  const next = (trips ?? []).map((t) => daysUntil(t.start_date)).filter((d): d is number => d !== null && d >= 0).sort((a, b) => a - b)[0];
  const totalSpent = (trips ?? []).reduce((s, t) => s + num(t.total_spent), 0);
  const docs = (trips ?? []).reduce((s, t) => s + t.document_count, 0);
  const upcoming = (trips ?? []).filter((t) => !t.end_date || t.end_date >= today).length;
  const shared = (trips ?? []).filter((t) => t.my_role !== "owner").length;
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><div className="text-label-md uppercase tracking-wider text-accent">Traveler binder</div>
          <h1 className="text-headline-lg md:text-[44px] md:leading-[52px] md:font-bold">Welcome back, {user?.name.split(" ")[0]}.</h1>
          <p className="mt-1 text-body-lg text-muted">{next !== undefined ? <>Your next adventure is in <span className="font-semibold text-accent">{next} days</span>.</> : "Plan your next adventure."}</p></div>
        <div className="flex rounded-pill border border-line bg-surface p-1">
          {["All Trips", "Upcoming", "Past", `Shared (${shared})`].map((t) => <button key={t} onClick={() => setTab(t.startsWith("Shared") ? "Shared" : t)} className={cn("rounded-pill px-4 py-1.5 text-label-md", (t.startsWith("Shared") ? tab === "Shared" : tab === t) && "bg-primary text-on-primary")}>{t}</button>)}
        </div>
      </div>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active trips" value={`${upcoming} planned`} icon={<Plane size={18} />} />
        <StatCard label="Total spent" value={money(totalSpent, trips?.[0]?.currency ?? "USD", 0)} icon={<Wallet size={18} />} hint="across all trips" />
        <StatCard label="Vault storage" value={`${docs} stored docs`} icon={<FileText size={18} />} />
        <StatCard label="Trips" value={trips?.length ?? 0} icon={<Luggage size={18} />} hint={`${shared} shared with you`} />
      </div>
      {error && <ErrorBox message={error} retry={reload} />}
      {!loading && !error && !trips?.length ? (
        <EmptyState icon={<Luggage />} title="No trips yet" text="Create your first trip to start organizing flights, documents and shared expenses." action={<Button onClick={() => setOpen(true)}><Plus size={16} />Create new trip</Button>} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {loading ? [0, 1, 2].map((i) => <TripCardSkeleton key={i} />) : filtered.map((t) => <TripCard key={t.id} trip={t} onDelete={() => setDel(t)} />)}
          {!loading && <button onClick={() => setOpen(true)} className="flex min-h-[280px] flex-col items-center justify-center rounded-card border-2 border-dashed border-stone-deep p-8 text-center transition hover:bg-stone">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface shadow-l1"><Plus /></span>
            <span className="text-headline-sm">Create New Trip</span><span className="mt-1 max-w-[230px] text-body-md text-muted">Organize flights, ledger splits and vault storage in one workspace.</span></button>}
        </div>
      )}
      {!loading && trips?.length! > 0 && !filtered.length && <p className="mt-6 text-center text-body-md text-muted">No trips in this view.</p>}
      <NewTripModal open={open} onClose={() => setOpen(false)} />
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete this trip?" subtitle="This permanently removes its itinerary, expenses and uploaded files."
        footer={<><Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button>
          <Button variant="danger" onClick={async () => { try { await api(`/trips/${del!.id}`, { method: "DELETE" }); toast("Trip deleted"); setDel(null); reload(); } catch (e) { toast((e as Error).message, "error"); } }}>Delete trip</Button></>}>
        <p className="text-body-md">“{del?.name}” will be gone for all {del?.members.length} members.</p>
      </Modal>
    </>
  );
}
