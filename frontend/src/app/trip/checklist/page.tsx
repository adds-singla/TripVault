"use client";
import { useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import type { ChecklistItem } from "@/lib/types";
import { useTrip } from "@/components/TripContext";
import { ChecklistGroup } from "@/components/trip";
import { Button, Card, EmptyState, ErrorBox, Input, PageTitle, ProgressRing, Skeleton, useToast } from "@/components/ui";

export default function Checklist() {
  const { tripId, canEdit } = useTrip(); const toast = useToast();
  const { data, loading, error, reload, setData } = useApi<ChecklistItem[]>(`/trips/${tripId}/checklist`);
  const [label, setLabel] = useState(""); const [group, setGroup] = useState("General");
  const groups = (data ?? []).reduce<Record<string, ChecklistItem[]>>((a, i) => { (a[i.group_name] ||= []).push(i); return a; }, {});
  const done = data?.filter((i) => i.done).length ?? 0; const total = data?.length ?? 0;
  async function toggle(i: ChecklistItem) {
    setData((p) => p && p.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x)));
    try { await api(`/trips/${tripId}/checklist/${i.id}`, { method: "PATCH", json: { done: !i.done } }); } catch (e) { toast((e as Error).message, "error"); reload(); }
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    try { await api(`/trips/${tripId}/checklist`, { method: "POST", json: { label: label.trim(), group_name: group.trim() || "General" } }); setLabel(""); reload(); }
    catch (e) { toast((e as Error).message, "error"); }
  }
  async function remove(i: ChecklistItem) { try { await api(`/trips/${tripId}/checklist/${i.id}`, { method: "DELETE" }); reload(); } catch (e) { toast((e as Error).message, "error"); } }
  return (
    <>
      <PageTitle title="Packing checklist" sub="Check things off as you pack" />
      {error && <ErrorBox message={error} retry={reload} />}
      <Card className="mb-6 flex items-center gap-5 p-5"><ProgressRing size={88} stroke={9} percent={total ? (done / total) * 100 : 0} />
        <div><div className="text-headline-md">{total - done} items remaining</div><div className="text-body-md text-muted">{done} of {total} packed</div></div></Card>
      {canEdit && <form onSubmit={add} className="mb-6 flex flex-wrap gap-2">
        <Input className="min-w-0 flex-1" placeholder="Add an item, e.g. Power adapter" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input className="w-40" list="groups" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group" /><datalist id="groups">{Object.keys(groups).map((g) => <option key={g} value={g} />)}</datalist>
        <Button type="submit" disabled={!label.trim()}><Plus size={16} />Add</Button></form>}
      {loading ? <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
        : !total ? <EmptyState icon={<ListChecks />} title="Nothing to pack yet" text="Add the essentials: documents, chargers, clothing and medicines." />
        : <div className="grid gap-4 md:grid-cols-2">{Object.entries(groups).map(([g, items]) => <ChecklistGroup key={g} name={g} items={items} canEdit={canEdit} onToggle={toggle} onDelete={remove} />)}</div>}
    </>
  );
}
