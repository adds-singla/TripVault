export const num = (v: string | number | null | undefined) => (v === null || v === undefined ? 0 : Number(v));
export const money = (v: string | number | null | undefined, cur = "USD", frac = 2) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur, minimumFractionDigits: frac, maximumFractionDigits: frac }).format(num(v));
export const fmtDate = (d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
  d ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-US", opts) : "";
export const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
export const dateRange = (a: string | null, b: string | null) =>
  a && b ? `${fmtDate(a, { month: "short", day: "numeric" })} – ${fmtDate(b, { month: "short", day: "numeric" })}` : a ? fmtDate(a) : "Dates not set";
export const fileSize = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
export const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
export const daysUntil = (d: string | null) => (d ? Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 864e5) : null);
export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export const CATEGORY_LABEL: Record<string, string> = {
  Food: "Food & Dining", Transport: "Transport", Accommodation: "Stay & Lodging", Activities: "Activities & Tours",
  Shopping: "Shopping", Other: "Other",
};
export const CATEGORY_COLOR: Record<string, string> = {
  Food: "#765A4B", Accommodation: "#35606E", Transport: "#A58B7C", Activities: "#5E8C61", Shopping: "#C98B3A", Other: "#7B7167",
};
export const gradientFor = (s: string) => {
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 35% 38%), hsl(${(h + 40) % 360} 30% 22%))`;
};
