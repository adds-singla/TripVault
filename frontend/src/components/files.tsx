"use client";
import { useRef, useState } from "react";
import { Download, FileText, FolderOpen, Image as Img, Lock, MoreVertical, Plane, BedDouble, Ticket, Trash2, UploadCloud, ShieldCheck } from "lucide-react";
import { cn, fileSize, fmtDate } from "@/lib/format";
import type { Doc, Folder } from "@/lib/types";
import { Card, Chip } from "./ui";

export const FOLDER_META: Record<Folder, { icon: typeof Plane; label: string }> = {
  Flights: { icon: Plane, label: "Flights" }, Hotels: { icon: BedDouble, label: "Hotels & Stays" },
  Tickets: { icon: Ticket, label: "Tickets & Passes" }, Passport: { icon: ShieldCheck, label: "Passport & ID" },
  Other: { icon: FolderOpen, label: "Insurance & Other" },
};

export function UploadDropzone({ onFiles, busy, accept = "image/*,application/pdf,.pkpass", hint }: { onFiles(f: File[]): void; busy?: boolean; accept?: string; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null); const [over, setOver] = useState(false);
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(Array.from(e.dataTransfer.files)); }}
      className={cn("rounded-card border-2 border-dashed px-6 py-10 text-center transition", over ? "border-primary bg-stone" : "border-stone-deep bg-stone/40")}>
      <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface text-primary shadow-l1"><UploadCloud /></span>
      <p className="text-headline-sm">{busy ? "Uploading…" : "Drag flight tickets, hotel vouchers, or passport scans here"}</p>
      <p className="mt-1 text-body-md text-muted">or <button className="font-semibold text-accent underline" onClick={() => ref.current?.click()}>browse files</button> from your computer</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2"><Chip>PDF</Chip><Chip>JPG / PNG</Chip><Chip>Apple Wallet .pkpass</Chip><span className="text-body-sm text-muted">{hint ?? "Up to 10 MB per file"}</span></div>
      <input ref={ref} type="file" multiple hidden accept={accept} onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
    </div>
  );
}

export function FolderTile({ folder, count, active, onClick }: { folder: Folder; count: number; active: boolean; onClick(): void }) {
  const m = FOLDER_META[folder];
  return (
    <button onClick={onClick} className={cn("flex items-center gap-3 rounded-card border bg-surface p-4 text-left shadow-l1 transition hover:shadow-l2", active ? "border-primary" : "border-line")}>
      <span className="flex h-11 w-11 items-center justify-center rounded-input bg-primary/10 text-primary"><m.icon size={20} /></span>
      <span className="min-w-0"><span className="block truncate text-label-lg">{m.label}</span><span className="text-body-sm text-muted">{count} {count === 1 ? "file" : "files"}</span></span>
      {folder === "Passport" && <Lock size={14} className="ml-auto text-muted" />}
    </button>
  );
}

export function FileCard({ doc, canEdit, onOpen, onDelete, locked }: { doc: Doc; canEdit: boolean; onOpen(): void; onDelete(): void; locked?: boolean }) {
  const [menu, setMenu] = useState(false);
  const isImg = doc.content_type.startsWith("image/");
  return (
    <Card className="overflow-hidden transition hover:shadow-l2">
      <div className="flex h-28 items-center justify-center bg-canvas text-primary">
        {locked ? <Lock size={32} /> : isImg ? <Img size={32} /> : <FileText size={32} />}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-label-lg" title={doc.name}>{doc.name}</h3>
          <div className="relative">
            <button aria-label="More" onClick={() => setMenu(!menu)} className="rounded-full p-1 text-muted hover:bg-stone"><MoreVertical size={16} /></button>
            {menu && <div className="absolute right-0 z-10 w-36 rounded-input border border-line bg-surface p-1 shadow-l3">
              <button onClick={() => { setMenu(false); onOpen(); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-body-md hover:bg-stone"><Download size={14} />Open</button>
              {canEdit && <button onClick={() => { setMenu(false); onDelete(); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-body-md text-danger hover:bg-stone"><Trash2 size={14} />Delete</button>}
            </div>}
          </div>
        </div>
        <p className="mt-1 text-body-sm text-muted">{doc.folder} · {fmtDate(doc.created_at)}</p>
        <div className="mt-3 flex items-center justify-between text-body-sm text-muted">
          <span className="tnum">{fileSize(doc.size)} · <span className="text-success">Synced</span></span>
          <button onClick={onOpen} aria-label="Download" className="rounded-full p-1.5 hover:bg-stone"><Download size={16} /></button>
        </div>
      </div>
    </Card>
  );
}
