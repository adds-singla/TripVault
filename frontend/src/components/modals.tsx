"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Check, Copy, ScanLine, Trash2, UploadCloud, X } from "lucide-react";
import { api, uploadFile } from "@/lib/api";
import { CATEGORY_LABEL, cn, fmtDate, money, num } from "@/lib/format";
import type { Category, ItineraryItem, ScanResult } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import { Avatar, Button, Chip, Field, Input, Modal, Select, Skeleton, Textarea, useToast } from "./ui";
import { useTrip } from "./TripContext";

export const CURRENCIES = ["USD", "SGD", "EUR", "GBP", "INR", "JPY", "AUD", "THB", "AED", "CAD"];

/* ---------- New trip ---------- */
export function NewTripModal({ open, onClose }: { open: boolean; onClose(): void }) {
  const [f, setF] = useState({ name: "", destination: "", currency: "USD", start_date: "", end_date: "", budget: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const router = useRouter(); const toast = useToast();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setBusy(true); setErr("");
    try {
      const t = await api<{ id: string }>("/trips", { method: "POST", json: {
        name: f.name.trim(), destination: f.destination.trim(), currency: f.currency,
        start_date: f.start_date || null, end_date: f.end_date || null, budget: f.budget || null } });
      toast("Trip created"); onClose(); setF({ name: "", destination: "", currency: "USD", start_date: "", end_date: "", budget: "" });
      router.push(`/trip/overview/?id=${t.id}`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Create new trip" subtitle="Organize flights, ledger splits and vault storage in one workspace"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="accent" loading={busy} disabled={!f.name.trim()} onClick={save}>Create trip</Button></>}>
      <div className="space-y-4">
        <Field label="Trip name"><Input value={f.name} onChange={set("name")} placeholder="Singapore Trip" autoFocus /></Field>
        <Field label="Destination"><Input value={f.destination} onChange={set("destination")} placeholder="Singapore" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date"><Input type="date" value={f.start_date} onChange={set("start_date")} /></Field>
          <Field label="End date"><Input type="date" value={f.end_date} min={f.start_date} onChange={set("end_date")} /></Field>
          <Field label="Currency"><Select value={f.currency} onChange={set("currency")}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Budget (optional)"><Input type="number" min="0" value={f.budget} onChange={set("budget")} placeholder="5000" /></Field>
        </div>
        {err && <p className="text-body-md text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

/* ---------- Share trip ---------- */
export function ShareModal({ open, onClose }: { open: boolean; onClose(): void }) {
  const { tripId, trip, isOwner, reload } = useTrip(); const { user } = useAuth(); const toast = useToast();
  const { data, reload: reloadList } = useApi<{ members: typeof trip.members; invites: { id: string; email: string; role: string }[] }>(open ? `/trips/${tripId}/members` : null);
  const [email, setEmail] = useState(""); const [role, setRole] = useState<"viewer" | "editor">("viewer"); const [busy, setBusy] = useState(false);
  const link = typeof window !== "undefined" ? `${location.origin}/trip/overview/?id=${tripId}` : "";
  async function invite() {
    setBusy(true);
    try { const r = await api<{ status: string }>(`/trips/${tripId}/members`, { method: "POST", json: { email, role } });
      toast(r.status === "added" ? "Member added" : "Invite saved. They'll join when they sign in with that email."); setEmail(""); reloadList(); reload(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  }
  async function setMemberRole(uid: string, r: string) { await api(`/trips/${tripId}/members/${uid}`, { method: "PATCH", json: { role: r } }).catch((e) => toast(e.message, "error")); reloadList(); reload(); }
  async function remove(uid: string) { await api(`/trips/${tripId}/members/${uid}`, { method: "DELETE" }).catch((e) => toast(e.message, "error")); reloadList(); reload(); }
  async function cancel(id: string) { await api(`/trips/${tripId}/invites/${id}`, { method: "DELETE" }); reloadList(); }
  return (
    <Modal open={open} onClose={onClose} title={`Share ${trip.name}`} subtitle="Invite travelers and choose what they can do">
      {isOwner && (
        <div className="flex flex-wrap gap-2">
          <Input type="email" className="min-w-0 flex-1" placeholder="friend@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select className="w-28" value={role} onChange={(e) => setRole(e.target.value as "viewer" | "editor")}><option value="viewer">Viewer</option><option value="editor">Editor</option></Select>
          <Button loading={busy} disabled={!email.includes("@")} onClick={invite}>Invite</Button>
        </div>
      )}
      <ul className="mt-5 divide-y divide-line">
        {data?.members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-3">
            <Avatar name={m.name} /><div className="min-w-0 flex-1"><div className="truncate text-label-lg">{m.name}{m.id === user?.id && " (you)"}</div><div className="truncate text-body-sm text-muted">{m.email}</div></div>
            {isOwner && m.role !== "owner" ? (
              <><Select className="w-28 py-1.5" value={m.role} onChange={(e) => setMemberRole(m.id, e.target.value)}><option value="viewer">Viewer</option><option value="editor">Editor</option></Select>
                <button aria-label="Remove" onClick={() => remove(m.id)} className="rounded-full p-1.5 text-muted hover:bg-stone"><X size={16} /></button></>
            ) : <Chip>{m.role}</Chip>}
          </li>
        ))}
        {data?.invites.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-3 text-body-md"><span className="flex-1 truncate">{i.email}</span><Chip tone="warning">Invited · {i.role}</Chip>
            {isOwner && <button aria-label="Cancel invite" onClick={() => cancel(i.id)} className="rounded-full p-1.5 text-muted hover:bg-stone"><X size={16} /></button>}</li>
        ))}
      </ul>
      <div className="mt-4 flex items-center gap-2 rounded-input bg-stone p-2 pl-3">
        <span className="min-w-0 flex-1 truncate text-body-sm text-muted">{link}</span>
        <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(link); toast("Link copied. Only invited members can open it."); }}><Copy size={14} />Copy link</Button>
      </div>
    </Modal>
  );
}

/* ---------- Itinerary add/edit ---------- */
const KINDS = ["flight", "stay", "dinner", "transit", "activity"] as const;
export function ItineraryModal({ open, onClose, item, onSaved }: { open: boolean; onClose(): void; item?: ItineraryItem | null; onSaved(): void }) {
  const { tripId, trip } = useTrip(); const toast = useToast();
  const local = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 16) : "");
  const blank = { kind: "activity", title: "", location: "", starts_at: trip.start_date ? `${trip.start_date}T09:00` : "", ends_at: "", confirmation_ref: "", notes: "" };
  const [f, setF] = useState(blank); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF(item ? { kind: item.kind, title: item.title, location: item.location ?? "", starts_at: local(item.starts_at), ends_at: local(item.ends_at), confirmation_ref: item.confirmation_ref ?? "", notes: item.notes ?? "" } : blank); /* eslint-disable-next-line */ }, [open, item]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setBusy(true);
    const body = { ...f, location: f.location || null, confirmation_ref: f.confirmation_ref || null, notes: f.notes || null,
      starts_at: new Date(f.starts_at).toISOString(), ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null };
    try { await api(`/trips/${tripId}/itinerary${item ? `/${item.id}` : ""}`, { method: item ? "PUT" : "POST", json: body }); toast("Itinerary saved"); onSaved(); onClose(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title={item ? "Edit itinerary item" : "Add to itinerary"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!f.title || !f.starts_at} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type"><Select value={f.kind} onChange={set("kind")}>{KINDS.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}</Select></Field>
          <Field label="Confirmation / PNR"><Input value={f.confirmation_ref} onChange={set("confirmation_ref")} placeholder="TRP984" /></Field>
        </div>
        <Field label="Title"><Input value={f.title} onChange={set("title")} placeholder="SQ 321 to Singapore" /></Field>
        <Field label="Location"><Input value={f.location} onChange={set("location")} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Starts"><Input type="datetime-local" value={f.starts_at} onChange={set("starts_at")} /></Field>
          <Field label="Ends (optional)"><Input type="datetime-local" value={f.ends_at} min={f.starts_at} onChange={set("ends_at")} /></Field>
        </div>
        <Field label="Notes"><Textarea rows={3} value={f.notes} onChange={set("notes")} /></Field>
      </div>
    </Modal>
  );
}

/* ---------- Expense modal (manual entry + Scan Receipt flow) ---------- */
type Stage = "pick" | "uploading" | "scanning" | "form";
export function ExpenseModal({ open, onClose, startWithScan, onSaved }: { open: boolean; onClose(): void; startWithScan: boolean; onSaved(): void }) {
  const { tripId, trip } = useTrip(); const { user } = useAuth(); const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("form");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [f, setF] = useState({ merchant: "", amount: "", spent_on: new Date().toISOString().slice(0, 10), category: "Other" as Category, payer_id: "", description: "" });
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [who, setWho] = useState<string[]>([]);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [dismissedDup, setDismissedDup] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStage(startWithScan ? "pick" : "form"); setScan(null); setPreview(null); setErr(""); setMode("equal"); setCustom({}); setDismissedDup(false);
    setF({ merchant: "", amount: "", spent_on: new Date().toISOString().slice(0, 10), category: "Other", payer_id: user?.id ?? "", description: "" });
    setWho(trip.members.map((m) => m.id));
  }, [open, startWithScan, trip.members, user?.id]);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { setErr("Receipt scanning supports images (JPG, PNG, WebP)."); return; }
    if (file.size > 10 * 1024 * 1024) { setErr("File must be under 10 MB."); return; }
    setErr(""); setPreview(URL.createObjectURL(file)); setStage("uploading");
    try {
      const key = await uploadFile(tripId, file, "receipts");
      setStage("scanning");
      const r = await api<ScanResult>(`/trips/${tripId}/expenses/scan`, { method: "POST", json: { s3_key: key } });
      setScan(r);
      setF((p) => ({ ...p, merchant: r.merchant ?? "", amount: r.amount ?? "", spent_on: r.spent_on ?? p.spent_on, category: r.category }));
      setStage("form");
    } catch (e) { setErr((e as Error).message); setStage("pick"); }
  }

  const amount = num(f.amount);
  const share = who.length ? amount / who.length : 0;
  const customSum = Object.values(custom).reduce((s, v) => s + num(v), 0);
  const valid = f.merchant.trim() && amount > 0 && (mode === "equal" ? who.length > 0 : Math.abs(customSum - amount) < 0.01);

  async function save() {
    setBusy(true); setErr("");
    try {
      await api(`/trips/${tripId}/expenses`, { method: "POST", json: {
        merchant: f.merchant.trim(), description: f.description || null, amount: f.amount, currency: scan?.currency ?? trip.currency,
        category: f.category, spent_on: f.spent_on, payer_id: f.payer_id, split_mode: mode,
        participants: mode === "equal" ? who : undefined, shares: mode === "custom" ? custom : undefined,
        receipt_s3_key: scan?.s3_key, image_hash: scan?.image_hash, ocr_raw_text: scan?.ocr_raw_text } });
      toast("Expense saved"); onSaved(); onClose();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const cats = Object.keys(CATEGORY_LABEL) as Category[];
  return (
    <Modal open={open} onClose={onClose} wide={stage === "form" && !!preview} title={startWithScan ? "Scan Receipt" : "Add expense"}
      subtitle={startWithScan ? "OCR processing & split allocation review" : "Log a shared expense"}
      footer={stage === "form" ? <>
        <Button variant="secondary" onClick={onClose}>Dismiss</Button>
        <Button loading={busy} disabled={!valid} onClick={save}><Check size={16} />Confirm & save expense</Button></> : undefined}>
      {err && <div className="mb-4 rounded-input bg-danger/10 px-3 py-2 text-body-md text-danger">{err}</div>}

      {stage === "pick" && (
        <div>
          <button onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const x = e.dataTransfer.files[0]; if (x) handleFile(x); }}
            className="flex w-full flex-col items-center rounded-card border-2 border-dashed border-stone-deep bg-canvas px-6 py-14 hover:border-primary">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface text-primary shadow-l1"><Camera /></span>
            <span className="text-headline-sm">Drop a receipt photo or browse</span>
            <span className="mt-1 text-body-md text-muted">JPG, PNG or WebP · up to 10 MB · we'll read merchant, total and date</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <p className="mt-4 text-center text-body-md text-muted">Prefer typing it in? <button className="font-semibold text-accent underline" onClick={() => setStage("form")}>Enter manually</button></p>
        </div>
      )}

      {(stage === "uploading" || stage === "scanning") && (
        <div className="flex flex-col items-center gap-4 py-10">
          {preview && /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="Receipt" className="max-h-56 rounded-input border border-line" />}
          <ScanLine className="animate-pulse text-primary" size={32} />
          <p className="text-headline-sm">{stage === "uploading" ? "Uploading securely to your vault…" : "Reading receipt with OCR…"}</p>
          <Skeleton className="h-3 w-64" /><Skeleton className="h-3 w-48" />
        </div>
      )}

      {stage === "form" && (
        <div className={cn("grid gap-6", preview && "md:grid-cols-[260px_1fr]")}>
          {preview && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Receipt" className="w-full rounded-input border border-line" />
              {scan && <p className="mt-2 text-center text-body-sm text-muted">{scan.fields_found} of 3 fields found automatically{scan.fields_found < 3 && ". Please check the rest."}</p>}
            </div>
          )}
          <div className="space-y-4">
            {scan && scan.duplicates.length > 0 && !dismissedDup && (
              <div className="rounded-input border border-warning/40 bg-warning/10 p-3 text-body-md">
                <div className="flex items-center gap-2 font-semibold text-warning"><AlertTriangle size={16} />Possible duplicate detected</div>
                {scan.duplicates.map((d) => <p key={d.expense_id} className="mt-1 text-espresso">{d.merchant} · {money(d.amount, trip.currency)} on {fmtDate(d.spent_on)} ({d.reason}).</p>)}
                <button onClick={() => setDismissedDup(true)} className="mt-2 text-label-md font-semibold underline">It's different, continue</button>
              </div>
            )}
            <Field label="Merchant / place"><Input value={f.merchant} onChange={(e) => setF({ ...f, merchant: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={`Amount (${scan?.currency ?? trip.currency})`}><Input type="number" step="0.01" min="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className="tnum" /></Field>
              <Field label="Date"><Input type="date" value={f.spent_on} onChange={(e) => setF({ ...f, spent_on: e.target.value })} /></Field>
            </div>
            <div>
              <span className="mb-1.5 flex items-center gap-2 text-label-md">Category {scan && <Chip tone="accent">auto-suggested · {Math.round(scan.category_confidence * 100)}%</Chip>}</span>
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => <button key={c} onClick={() => setF({ ...f, category: c })} className={cn("rounded-pill border px-3 py-1.5 text-label-md transition", f.category === c ? "border-primary bg-primary text-on-primary" : "border-line bg-surface hover:bg-stone")}>{CATEGORY_LABEL[c]}</button>)}
              </div>
            </div>
            <Field label="Paid by"><Select value={f.payer_id} onChange={(e) => setF({ ...f, payer_id: e.target.value })}>{trip.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
            <div>
              <div className="mb-1.5 flex items-center justify-between"><span className="text-label-md">Split breakdown</span>
                <div className="flex rounded-pill border border-line bg-stone p-0.5 text-label-md">
                  {(["equal", "custom"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={cn("rounded-pill px-3 py-1", mode === m && "bg-surface shadow-l1")}>{m === "equal" ? `Equal (${who.length})` : "Custom"}</button>)}
                </div></div>
              <ul className="space-y-1.5 rounded-input bg-stone p-3">
                {trip.members.map((m) => mode === "equal" ? (
                  <li key={m.id}><label className="flex items-center gap-3"><input type="checkbox" checked={who.includes(m.id)} className="accent-[rgb(var(--primary))]"
                    onChange={(e) => setWho(e.target.checked ? [...who, m.id] : who.filter((x) => x !== m.id))} /><Avatar name={m.name} size={26} /><span className="flex-1 text-body-md">{m.name}</span>
                    <span className="tnum text-body-md text-muted">{who.includes(m.id) ? money(share, trip.currency) : "-"}</span></label></li>
                ) : (
                  <li key={m.id} className="flex items-center gap-3"><Avatar name={m.name} size={26} /><span className="flex-1 text-body-md">{m.name}</span>
                    <Input type="number" step="0.01" min="0" className="tnum w-28 py-1.5" value={custom[m.id] ?? ""} onChange={(e) => setCustom({ ...custom, [m.id]: e.target.value })} /></li>
                ))}
              </ul>
              {mode === "custom" && <p className={cn("mt-1 text-body-sm", Math.abs(customSum - amount) < 0.01 ? "text-success" : "text-danger")}>Shares total {money(customSum, trip.currency)} of {money(amount, trip.currency)}</p>}
            </div>
            <Field label="Note (optional)"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
