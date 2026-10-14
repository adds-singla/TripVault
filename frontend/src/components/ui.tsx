"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn, initials } from "@/lib/format";

/* ---------- Button ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "accent" | "danger" | "ghost"; size?: "sm" | "md"; loading?: boolean };
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...p }: BtnProps) {
  const v = {
    primary: "bg-primary text-on-primary hover:bg-primary-hover",
    secondary: "bg-surface text-espresso border border-line hover:bg-stone",
    accent: "bg-accent text-white hover:opacity-90",
    danger: "bg-danger text-white hover:opacity-90",
    ghost: "text-espresso hover:bg-stone",
  }[variant];
  return (
    <button {...p} disabled={disabled || loading}
      className={cn("inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" ? "px-3.5 py-1.5 text-label-md" : "px-5 py-2.5 text-label-lg", v, className)}>
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

/* ---------- Card ---------- */
export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) =>
  <div {...p} className={cn("rounded-card border border-line bg-surface shadow-l1", className)} />;

/* ---------- Inputs ---------- */
const inputCls = "w-full rounded-input border border-line bg-surface px-3.5 py-2.5 text-body-md text-espresso placeholder:text-muted focus:border-primary focus:outline-none focus:ring-0 focus:border-[1.5px]";
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn(inputCls, p.className)} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn(inputCls, p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cn(inputCls, p.className)} />;
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-label-md text-espresso">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-body-sm text-muted">{hint}</span>}
    </label>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, subtitle, children, footer, wide }: {
  open: boolean; onClose(): void; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-espresso/25 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={cn("flex max-h-[92vh] w-full flex-col rounded-t-card bg-surface shadow-l3 sm:rounded-card", wide ? "sm:max-w-4xl" : "sm:max-w-lg")}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div><h2 className="text-headline-sm">{title}</h2>{subtitle && <p className="text-body-sm text-muted">{subtitle}</p>}</div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-stone"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Skeleton / Empty ---------- */
export const Skeleton = ({ className }: { className?: string }) =>
  <div className={cn("animate-[pulse2_1.4s_ease-in-out_infinite] rounded-input bg-stone", className)} />;

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border-2 border-dashed border-line px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone text-primary">{icon}</div>
      <h3 className="text-headline-sm">{title}</h3>
      <p className="mt-1 max-w-sm text-body-md text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const ErrorBox = ({ message, retry }: { message: string; retry?: () => void }) => (
  <div className="rounded-card border border-danger/30 bg-danger/10 p-4 text-body-md text-danger">
    {message} {retry && <button onClick={retry} className="ml-2 font-semibold underline">Retry</button>}
  </div>
);

/* ---------- Chips ---------- */
const tones = {
  neutral: "bg-stone text-primary border-line", success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/30", danger: "bg-danger/10 text-danger border-danger/20",
  accent: "bg-accent/10 text-accent border-accent/20",
};
export const Chip = ({ tone = "neutral", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) =>
  <span {...p} className={cn("inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-label-sm", tones[tone], className)} />;

const catTone: Record<string, keyof typeof tones> = { Food: "warning", Accommodation: "neutral", Transport: "accent", Activities: "success", Shopping: "warning", Other: "neutral" };
export const CategoryChip = ({ category, label }: { category: string; label?: string }) =>
  <Chip tone={catTone[category] ?? "neutral"}>{label ?? category}</Chip>;
export const StatusBadge = ({ status, pending }: { status: "settled" | "pending"; pending?: number }) =>
  status === "settled" ? <Chip tone="success">● Settled</Chip> : <Chip tone="warning">● Pending{pending ? ` (${pending})` : ""}</Chip>;

/* ---------- Avatars ---------- */
export const Avatar = ({ name, size = 32 }: { name: string; size?: number }) => (
  <span title={name} style={{ width: size, height: size, fontSize: size * 0.38 }}
    className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-surface bg-stone-deep font-semibold text-espresso">{initials(name)}</span>
);
export function AvatarStack({ names, max = 3 }: { names: string[]; max?: number }) {
  return (
    <div className="flex items-center">
      {names.slice(0, max).map((n, i) => <span key={n + i} className={i ? "-ml-2" : ""}><Avatar name={n} /></span>)}
      {names.length > max && <span className="-ml-2 inline-flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-surface bg-stone px-1 text-label-sm text-primary">+{names.length - max}</span>}
    </div>
  );
}

/* ---------- Progress ---------- */
export function ProgressRing({ percent, size = 56, stroke = 6, color = "rgb(var(--accent))", label }: { percent: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.min(100, Math.max(0, percent));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (p / 100) * c} />
      </svg>
      <span className="tnum absolute inset-0 flex items-center justify-center text-label-md">{label ?? `${Math.round(p)}%`}</span>
    </div>
  );
}
export const ProgressBar = ({ percent, color = "bg-accent" }: { percent: number; color?: string }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone"><div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, percent)}%` }} /></div>
);

/* ---------- StatCard ---------- */
export function StatCard({ label, value, hint, icon, tone, badge, children }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: "success" | "accent" | "danger"; badge?: string; children?: React.ReactNode;
}) {
  const border = tone === "accent" ? "border-l-4 border-l-accent" : tone === "danger" ? "border-l-4 border-l-danger" : tone === "success" ? "border-l-4 border-l-success" : "";
  const color = tone === "accent" ? "text-accent" : tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-espresso";
  return (
    <Card className={cn("p-5", border)}>
      <div className="flex items-center justify-between text-body-md text-muted">
        <span>{label}</span>{badge ? <Chip tone="neutral">{badge}</Chip> : icon}
      </div>
      <div className={cn("tnum mt-3 text-headline-lg", color)}>{value}</div>
      {hint && <div className="mt-1 text-body-sm text-muted">{hint}</div>}
      {children}
    </Card>
  );
}

/* ---------- Toast ---------- */
const ToastCtx = createContext<(msg: string, kind?: "ok" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const push = useCallback((msg: string, kind: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-20 right-4 z-[60] flex flex-col gap-2 md:bottom-6" aria-live="polite">
        {items.map((i) => <div key={i.id} className={cn("rounded-input px-4 py-3 text-body-md text-white shadow-l3", i.kind === "error" ? "bg-danger" : "bg-espresso text-canvas")}>{i.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

export const PageTitle = ({ eyebrow, title, sub, right }: { eyebrow?: string; title: string; sub?: string; right?: React.ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      {eyebrow && <div className="text-label-md uppercase tracking-wider text-accent">{eyebrow}</div>}
      <h1 className="text-headline-lg md:text-headline-xl">{title}</h1>
      {sub && <p className="mt-1 text-body-md text-muted">{sub}</p>}
    </div>
    {right}
  </div>
);

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
