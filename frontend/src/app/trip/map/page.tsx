"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { BedDouble, MapPin, Search, Trash2, Utensils, Landmark } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { Place } from "@/lib/types";
import { useTrip } from "@/components/TripContext";
import { Button, Card, EmptyState, ErrorBox, Field, Input, PageTitle, Select, Skeleton, useToast } from "@/components/ui";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <Skeleton className="h-[420px]" /> });
const ICON = { hotel: BedDouble, attraction: Landmark, food: Utensils };

export default function MapPage() {
  const { tripId, canEdit, trip } = useTrip(); const toast = useToast();
  const { data, loading, error, reload } = useApi<Place[]>(`/trips/${tripId}/places`);
  const [sel, setSel] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", kind: "attraction", q: "", lat: "", lng: "" }); const [busy, setBusy] = useState(false);

  async function lookup() {  // OpenStreetMap Nominatim geocoding (no API key)
    setBusy(true);
    try {
      const r = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(f.q || f.name + " " + trip.destination)}`)).json();
      if (!r[0]) { toast("Couldn't find that address. Click the map instead.", "error"); return; }
      setF({ ...f, lat: (+r[0].lat).toFixed(5), lng: (+r[0].lon).toFixed(5), name: f.name || r[0].display_name.split(",")[0] });
    } catch { toast("Address search is unavailable. Click the map to pick a spot.", "error"); } finally { setBusy(false); }
  }
  async function add() {
    try { await api(`/trips/${tripId}/places`, { method: "POST", json: { name: f.name, kind: f.kind, lat: +f.lat, lng: +f.lng, address: f.q || null } }); setF({ name: "", kind: "attraction", q: "", lat: "", lng: "" }); reload(); toast("Place added"); }
    catch (e) { toast((e as Error).message, "error"); }
  }
  return (
    <>
      <PageTitle title="Map explorer" sub="Hotels, food and attractions. Map data © OpenStreetMap contributors" />
      {error && <ErrorBox message={error} retry={reload} />}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          {canEdit && <Card className="space-y-3 p-4"><h2 className="text-label-lg">Add a place</h2>
            <Input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="hotel">Hotel</option><option value="attraction">Attraction</option><option value="food">Food</option></Select>
            <div className="flex gap-2"><Input placeholder="Address or landmark" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /><Button variant="secondary" loading={busy} onClick={lookup} aria-label="Find"><Search size={16} /></Button></div>
            <p className="text-body-sm text-muted">{f.lat ? `Pin: ${f.lat}, ${f.lng}` : "Search, or click the map to drop a pin."}</p>
            <Button className="w-full" disabled={!f.name || !f.lat} onClick={add}>Add to map</Button></Card>}
          {loading ? <Skeleton className="h-40" /> : !data?.length ? <EmptyState icon={<MapPin />} title="No places yet" text="Add your hotel and sights to see them on the map." /> : (
            <ul className="space-y-2">{data.map((p) => { const I = ICON[p.kind]; return (
              <li key={p.id}><div className={cn("flex w-full items-center gap-3 rounded-card border bg-surface p-3", sel === p.id ? "border-primary" : "border-line")}>
                <button onClick={() => setSel(p.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input bg-stone text-primary"><I size={16} /></span>
                  <span className="min-w-0"><span className="block truncate text-label-lg">{p.name}</span><span className="block truncate text-body-sm text-muted">{p.address ?? p.kind}</span></span></button>
                {canEdit && <button aria-label="Remove place" onClick={async () => { await api(`/trips/${tripId}/places/${p.id}`, { method: "DELETE" }); reload(); }} className="text-muted hover:text-danger"><Trash2 size={15} /></button>}</div></li>); })}</ul>)}
        </div>
        <MapView places={data ?? []} selected={sel} onSelect={setSel} onPick={canEdit ? (lat, lng) => setF((p) => ({ ...p, lat: lat.toFixed(5), lng: lng.toFixed(5) })) : undefined} />
      </div>
    </>
  );
}
