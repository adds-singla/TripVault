"use client";
import { useRef, useState } from "react";
import { ImagePlus, Trash2, X } from "lucide-react";
import { api, uploadFile } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { Photo } from "@/lib/types";
import { useTrip } from "@/components/TripContext";
import { Button, EmptyState, ErrorBox, PageTitle, Skeleton, useToast } from "@/components/ui";

export default function Photos() {
  const { tripId, canEdit } = useTrip(); const toast = useToast(); const ref = useRef<HTMLInputElement>(null);
  const { data, loading, error, reload } = useApi<Photo[]>(`/trips/${tripId}/photos`);
  const [busy, setBusy] = useState(false); const [view, setView] = useState<Photo | null>(null);
  async function upload(files: File[]) {
    setBusy(true);
    for (const f of files) {
      if (!f.type.startsWith("image/")) { toast(`${f.name} isn't an image`, "error"); continue; }
      if (f.size > 10 * 1024 * 1024) { toast(`${f.name} is over 10 MB`, "error"); continue; }
      try { const key = await uploadFile(tripId, f, "photos"); await api(`/trips/${tripId}/photos`, { method: "POST", json: { s3_key: key, content_type: f.type, size: f.size, caption: f.name.replace(/\.[^.]+$/, "") } }); }
      catch (e) { toast(`${f.name}: ${(e as Error).message}`, "error"); }
    }
    setBusy(false); reload();
  }
  return (
    <>
      <PageTitle title="Trip photos" sub="Shared with everyone on the trip" right={canEdit && <><Button loading={busy} onClick={() => ref.current?.click()}><ImagePlus size={16} />Upload photos</Button>
        <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(Array.from(e.target.files ?? [])); e.target.value = ""; }} /></>} />
      {error && <ErrorBox message={error} retry={reload} />}
      {loading ? <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-square" />)}</div>
        : !data?.length ? <EmptyState icon={<ImagePlus />} title="No photos yet" text="Upload memories from the trip. They're stored privately and only members can see them." />
        : <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{data.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <button key={p.id} onClick={() => setView(p)} className="group relative aspect-square overflow-hidden rounded-card border border-line bg-stone"><img src={p.url} alt={p.caption ?? "Trip photo"} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" /></button>))}</div>}
      {view && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4" onClick={() => setView(null)}>
          <button aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white"><X /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.url} alt={view.caption ?? ""} className="max-h-[80vh] max-w-full rounded-card" onClick={(e) => e.stopPropagation()} />
          <div className="mt-3 flex items-center gap-4 text-white" onClick={(e) => e.stopPropagation()}><span>{view.caption} · {fmtDate(view.created_at)}</span>
            {canEdit && <button onClick={async () => { await api(`/trips/${tripId}/photos/${view.id}`, { method: "DELETE" }); setView(null); reload(); }} className="flex items-center gap-1 text-label-md text-white/90 underline"><Trash2 size={14} />Delete</button>}</div>
        </div>)}
    </>
  );
}
