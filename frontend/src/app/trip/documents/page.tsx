"use client";
import { useMemo, useState } from "react";
import { FolderOpen, LayoutGrid, List } from "lucide-react";
import { api, uploadFile } from "@/lib/api";
import { cn, fileSize, fmtDate } from "@/lib/format";
import { unlockWithDevice } from "@/lib/webauthn";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import type { Doc, Folder } from "@/lib/types";
import { useTrip } from "@/components/TripContext";
import { FileCard, FOLDER_META, FolderTile, UploadDropzone } from "@/components/files";
import { Button, Chip, EmptyState, ErrorBox, Modal, PageTitle, Select, Skeleton, useToast } from "@/components/ui";

const FOLDERS = Object.keys(FOLDER_META) as Folder[];
const OK = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/vnd.apple.pkpass"];
const guess = (n: string): Folder => /passport|visa|id\b/i.test(n) ? "Passport" : /flight|boarding|airline|sq\d/i.test(n) ? "Flights" : /train|rail|irctc|amtrak|eurostar|shinkansen/i.test(n) ? "Trains" : /bus|coach|greyhound|megabus|redbus/i.test(n) ? "Buses" : /hotel|booking|resort/i.test(n) ? "Hotels" : /ticket|pass|voucher/i.test(n) ? "Tickets" : "Other";

export default function Documents() {
  const { tripId, canEdit } = useTrip(); const { user } = useAuth(); const toast = useToast();
  const { data, loading, error, reload } = useApi<Doc[]>(`/trips/${tripId}/documents`);
  const [folder, setFolder] = useState<Folder | "All">("All"); const [target, setTarget] = useState<Folder | "auto">("auto");
  const [sort, setSort] = useState("date"); const [view, setView] = useState<"grid" | "list">("grid"); const [busy, setBusy] = useState(false); const [del, setDel] = useState<Doc | null>(null);
  const counts = useMemo(() => FOLDERS.reduce((a, f) => ({ ...a, [f]: data?.filter((d) => d.folder === f).length ?? 0 }), {} as Record<Folder, number>), [data]);
  const list = useMemo(() => {
    const l = (data ?? []).filter((d) => folder === "All" || d.folder === folder);
    return [...l].sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "size" ? b.size - a.size : +new Date(b.created_at) - +new Date(a.created_at));
  }, [data, folder, sort]);

  async function upload(files: File[]) {
    setBusy(true);
    for (const f of files) {
      const type = f.type || (f.name.endsWith(".pkpass") ? "application/vnd.apple.pkpass" : "");
      if (!OK.includes(type)) { toast(`${f.name}: only images, PDFs and .pkpass are allowed`, "error"); continue; }
      if (f.size > 10 * 1024 * 1024) { toast(`${f.name} is over 10 MB`, "error"); continue; }
      try {
        const file = type === f.type ? f : new File([f], f.name, { type });
        const key = await uploadFile(tripId, file, "documents");
        await api(`/trips/${tripId}/documents`, { method: "POST", json: { name: f.name, s3_key: key, content_type: type, size: f.size, folder: target === "auto" ? guess(f.name) : target } });
        toast(`Uploaded ${f.name}`);
      } catch (e) { toast(`${f.name}: ${(e as Error).message}`, "error"); }
    }
    setBusy(false); reload();
  }
  async function open(d: Doc) {
    if (d.folder === "Passport" && !(await unlockWithDevice(user?.email ?? "traveler"))) { toast("Unlock cancelled", "error"); return; }
    try { const r = await api<{ url: string }>(`/trips/${tripId}/documents/${d.id}/presign-download`); window.open(r.url, "_blank", "noopener"); }
    catch (e) { toast((e as Error).message, "error"); }
  }
  return (
    <>
      <PageTitle title="Vault documents" sub="Tickets, vouchers and IDs, stored privately in S3 (encrypted at rest, AES-256)" right={<Chip tone="neutral">{data?.length ?? 0} files</Chip>} />
      {canEdit && <div className="mb-6">
        <UploadDropzone onFiles={upload} busy={busy} />
        <label className="mt-3 flex items-center gap-2 text-body-md text-muted">Save to folder:
          <Select className="w-52 py-1.5" value={target} onChange={(e) => setTarget(e.target.value as Folder | "auto")}><option value="auto">Auto-detect from filename</option>{FOLDERS.map((f) => <option key={f} value={f}>{FOLDER_META[f].label}</option>)}</Select></label></div>}
      <div className="mb-3 flex items-center justify-between"><h2 className="text-headline-md">Vault folders</h2><span className="text-body-sm text-muted">{FOLDERS.length} organized sections</span></div>
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">{FOLDERS.map((f) => <FolderTile key={f} folder={f} count={counts[f]} active={folder === f} onClick={() => setFolder(folder === f ? "All" : f)} />)}</div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">{(["All", ...FOLDERS] as const).map((f) => <button key={f} onClick={() => setFolder(f)} className={cn("rounded-pill border px-3 py-1 text-label-md", folder === f ? "border-primary bg-primary text-on-primary" : "border-line bg-surface")}>{f === "All" ? `All files (${data?.length ?? 0})` : f}</button>)}</div>
        <div className="flex items-center gap-2"><Select className="w-36 py-1.5" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by"><option value="date">Date added</option><option value="name">Name</option><option value="size">Size</option></Select>
          {(["grid", "list"] as const).map((v) => <button key={v} aria-label={`${v} view`} onClick={() => setView(v)} className={cn("rounded-input border border-line p-2", view === v ? "bg-stone" : "bg-surface")}>{v === "grid" ? <LayoutGrid size={16} /> : <List size={16} />}</button>)}</div>
      </div>
      {error && <ErrorBox message={error} retry={reload} />}
      {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}</div>
        : !list.length ? <EmptyState icon={<FolderOpen />} title={data?.length ? "Nothing in this folder" : "Your vault is empty"} text="Drop files above to store them privately. Only trip members can open them." />
        : view === "grid" ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((d) => <FileCard key={d.id} doc={d} canEdit={canEdit} locked={d.folder === "Passport"} onOpen={() => open(d)} onDelete={() => setDel(d)} />)}</div>
        : <div className="overflow-x-auto rounded-card border border-line bg-surface"><table className="w-full text-left text-body-md"><thead className="bg-canvas text-label-md text-muted"><tr><th className="p-3">Name</th><th>Folder</th><th>Size</th><th>Added</th><th /></tr></thead>
          <tbody>{list.map((d) => <tr key={d.id} className="border-t border-line"><td className="p-3 font-semibold">{d.name}</td><td>{d.folder}</td><td className="tnum">{fileSize(d.size)}</td><td>{fmtDate(d.created_at)}</td>
            <td className="space-x-3 pr-3 text-right"><button className="font-semibold text-accent" onClick={() => open(d)}>Open</button>{canEdit && <button className="text-danger" onClick={() => setDel(d)}>Delete</button>}</td></tr>)}</tbody></table></div>}
      <p className="mt-6 text-body-sm text-muted">The Passport folder asks for your device biometric/PIN before opening. That's an app-level lock; encryption itself is handled by S3.</p>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete file?" footer={<><Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button>
        <Button variant="danger" onClick={async () => { try { await api(`/trips/${tripId}/documents/${del!.id}`, { method: "DELETE" }); toast("Deleted"); setDel(null); reload(); } catch (e) { toast((e as Error).message, "error"); } }}>Delete</Button></>}>
        <p className="text-body-md">“{del?.name}” will be permanently removed from storage.</p></Modal>
    </>
  );
}
