"use client";
import { useState } from "react";
import { CalendarPlus, Map } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import type { ItineraryItem } from "@/lib/types";
import { useTrip } from "@/components/TripContext";
import { ItineraryModal } from "@/components/modals";
import { Timeline } from "@/components/trip";
import { Button, EmptyState, ErrorBox, Modal, PageTitle, Skeleton, useToast } from "@/components/ui";

export default function Itinerary() {
  const { tripId, canEdit } = useTrip(); const toast = useToast();
  const { data, loading, error, reload } = useApi<ItineraryItem[]>(`/trips/${tripId}/itinerary`);
  const [edit, setEdit] = useState<ItineraryItem | null>(null); const [open, setOpen] = useState(false); const [del, setDel] = useState<ItineraryItem | null>(null);
  return (
    <>
      <PageTitle title="Itinerary" sub="Day-by-day flights, stays and activities" right={canEdit && <Button onClick={() => { setEdit(null); setOpen(true); }}><CalendarPlus size={16} />Add item</Button>} />
      {error && <ErrorBox message={error} retry={reload} />}
      {loading ? <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        : !data?.length ? <EmptyState icon={<Map />} title="No itinerary yet" text="Add your flights, hotel check-ins and activities. They'll appear here grouped by day." action={canEdit && <Button onClick={() => setOpen(true)}>Add first item</Button>} />
        : <Timeline items={data} canEdit={canEdit} onEdit={(i) => { setEdit(i); setOpen(true); }} onDelete={setDel} />}
      <ItineraryModal open={open} onClose={() => setOpen(false)} item={edit} onSaved={reload} />
      <Modal open={!!del} onClose={() => setDel(null)} title="Remove this item?" footer={<><Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button>
        <Button variant="danger" onClick={async () => { try { await api(`/trips/${tripId}/itinerary/${del!.id}`, { method: "DELETE" }); toast("Removed"); setDel(null); reload(); } catch (e) { toast((e as Error).message, "error"); } }}>Remove</Button></>}>
        <p className="text-body-md">“{del?.title}” will be deleted from the itinerary.</p></Modal>
    </>
  );
}
