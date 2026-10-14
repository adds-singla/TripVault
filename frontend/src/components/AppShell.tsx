"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Bell, CheckSquare, ChevronsUpDown, Compass, FolderLock, Luggage, Map as MapIcon, Moon, Plus, Search, Settings, Sun, Users, Wallet, Cloud, CloudOff, LogOut, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { Trip } from "@/lib/types";
import { Avatar, Button, Chip, Modal, Skeleton } from "./ui";
import { LAST_TRIP } from "./TripContext";
import { NewTripModal } from "./modals";

function useNav() {
  const params = useSearchParams();
  const [last, setLast] = useState<string | null>(null);
  useEffect(() => setLast(localStorage.getItem(LAST_TRIP)), []);
  const id = params.get("id") ?? last;
  const t = (p: string) => (id ? `/trip/${p}/?id=${id}` : "/trips/");
  return {
    id, items: [
      { href: "/trips/", label: "My Trips", icon: Luggage, match: "/trips" },
      { href: t("overview"), label: "Overview", icon: Compass, match: "/trip/overview" },
      { href: t("itinerary"), label: "Itinerary", icon: Compass, match: "/trip/itinerary", hideSide: true },
      { href: t("documents"), label: "Vault Documents", short: "Vault", icon: FolderLock, match: "/trip/documents" },
      { href: t("expenses"), label: "Split Expenses", short: "Expenses", icon: Wallet, match: "/trip/expenses" },
      { href: t("checklist"), label: "Packing Checklist", short: "Packing", icon: CheckSquare, match: "/trip/checklist" },
      { href: t("map"), label: "Map Explorer", short: "Map", icon: MapIcon, match: "/trip/map" },
      { href: t("photos"), label: "Photos", icon: ImageIcon, match: "/trip/photos", hideBottom: true },
      { href: t("members"), label: "Trip Members", icon: Users, match: "/trip/members", hideBottom: true },
    ],
  };
}

function Sidebar() {
  const path = usePathname();
  const { user, logout } = useAuth();
  const { id, items } = useNav();
  const { data: trips } = useApi<Trip[]>("/trips");
  const current = trips?.find((t) => t.id === id);
  const [newOpen, setNewOpen] = useState(false);
  const router = useRouter();
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[280px] flex-col border-r border-stone-deep/40 bg-stone p-5 md:flex">
      <Link href="/trips/" className="flex items-center gap-3 px-1">
        <span className="flex h-10 w-10 items-center justify-center rounded-input bg-primary text-on-primary"><Luggage size={20} /></span>
        <span><span className="block text-headline-sm leading-5">TripVault</span><span className="text-label-sm uppercase tracking-wider text-muted">Travel ledger</span></span>
      </Link>
      {current && (
        <button onClick={() => router.push("/trips/")} className="mt-5 flex items-center justify-between rounded-card border border-line bg-surface/60 px-3 py-2.5 text-left">
          <span><span className="block text-label-lg">{current.name}</span><span className="text-body-sm text-muted">{current.members.length} travelers</span></span>
          <ChevronsUpDown size={16} className="text-muted" />
        </button>
      )}
      <nav className="mt-5 flex flex-1 flex-col gap-1">
        {items.filter((i) => !i.hideSide && (i.match === "/trips" || id)).map((i) => {
          const active = path.startsWith(i.match);
          return (
            <Link key={i.label} href={i.href} className={cn("flex items-center gap-3 rounded-pill px-4 py-2.5 text-label-lg transition",
              active ? "bg-primary text-on-primary" : "text-espresso hover:bg-surface/70")}>
              <i.icon size={18} />{i.label}
            </Link>
          );
        })}
      </nav>
      <Button variant="secondary" onClick={() => setNewOpen(true)}><Plus size={16} />New Trip</Button>
      <Link href="/settings/" className={cn("mt-3 flex items-center gap-3 rounded-pill px-4 py-2.5 text-label-lg hover:bg-surface/70", path.startsWith("/settings") && "bg-surface")}><Settings size={18} />Settings</Link>
      <div className="mt-2 flex items-center gap-3 rounded-card bg-primary/10 p-3">
        <Avatar name={user?.name ?? "?"} size={36} />
        <div className="min-w-0 flex-1"><div className="truncate text-label-lg">{user?.name}</div><div className="truncate text-body-sm text-muted">{user?.email}</div></div>
        <button aria-label="Sign out" onClick={async () => { await logout(); router.replace("/login/"); }} className="rounded-full p-1.5 text-muted hover:bg-surface"><LogOut size={16} /></button>
      </div>
      <NewTripModal open={newOpen} onClose={() => setNewOpen(false)} />
    </aside>
  );
}

function BottomTabBar() {
  const path = usePathname();
  const { items } = useNav();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {items.filter((i) => !i.hideBottom && !i.hideSide).map((i) => (
        <Link key={i.label} href={i.href} className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-label-sm", path.startsWith(i.match) ? "text-primary" : "text-muted")}>
          <i.icon size={20} />{i.short ?? i.label}
        </Link>
      ))}
    </nav>
  );
}

function useOnline() {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    const ping = () => api("/health").then(() => setOk(true), () => setOk(false));
    ping(); const t = setInterval(ping, 30000); return () => clearInterval(t);
  }, []);
  return ok;
}

function SearchModal({ open, onClose }: { open: boolean; onClose(): void }) {
  const [q, setQ] = useState(""); const [res, setRes] = useState<{ type: string; title: string; subtitle: string; href: string }[]>([]);
  const router = useRouter();
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    const t = setTimeout(() => api<typeof res>(`/search?q=${encodeURIComponent(q)}`).then(setRes).catch(() => setRes([])), 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Modal open={open} onClose={onClose} title="Search" subtitle="Trips, itinerary, PNRs, receipts and documents">
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full rounded-input border border-line bg-surface px-3.5 py-2.5 text-body-md focus:border-primary focus:outline-none" />
      <ul className="mt-4 space-y-1">
        {res.map((r, i) => (
          <li key={i}><button onClick={() => { onClose(); router.push(r.href); }} className="flex w-full items-center justify-between rounded-input px-3 py-2 text-left hover:bg-stone">
            <span><span className="block text-label-lg">{r.title}</span><span className="text-body-sm text-muted">{r.subtitle}</span></span><Chip>{r.type}</Chip></button></li>
        ))}
        {q.trim().length >= 2 && !res.length && <li className="py-6 text-center text-body-md text-muted">No results</li>}
      </ul>
    </Modal>
  );
}

function TopBar() {
  const online = useOnline(); const { theme, toggle } = useTheme(); const router = useRouter();
  const [search, setSearch] = useState(false); const [bell, setBell] = useState(false);
  const { data: notes } = useApi<{ kind: string; text: string; trip_id: string }[]>("/notifications");
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line/60 bg-canvas/90 px-4 py-3 backdrop-blur md:px-8">
      <button onClick={() => setSearch(true)} className="flex min-w-0 flex-1 items-center gap-2 rounded-input border border-line bg-surface px-3.5 py-2 text-left text-body-md text-muted md:max-w-md">
        <Search size={16} /><span className="truncate">Search trips, PNR, receipts…</span><kbd className="ml-auto hidden rounded bg-stone px-1.5 text-label-sm sm:block">⌘K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-2">
        <Chip tone={online ? "success" : "danger"} className="hidden sm:inline-flex">{online ? <Cloud size={12} /> : <CloudOff size={12} />}{online ? "Vault Synced" : "Offline"}</Chip>
        <button aria-label="Toggle dark mode" onClick={toggle} className="rounded-full p-2 text-espresso hover:bg-stone">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
        <div className="relative">
          <button aria-label="Notifications" onClick={() => setBell((b) => !b)} className="relative rounded-full p-2 text-espresso hover:bg-stone">
            <Bell size={18} />{!!notes?.length && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />}
          </button>
          {bell && (
            <div className="absolute right-0 top-11 z-40 w-80 rounded-card border border-line bg-surface p-2 shadow-l3">
              {notes?.length ? notes.map((n, i) => (
                <button key={i} onClick={() => { setBell(false); router.push(`/trip/overview/?id=${n.trip_id}`); }} className="block w-full rounded-input px-3 py-2 text-left text-body-md hover:bg-stone">{n.text}</button>
              )) : <p className="p-4 text-center text-body-md text-muted">You're all caught up.</p>}
            </div>
          )}
        </div>
      </div>
      <SearchModal open={search} onClose={() => setSearch(false)} />
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace("/login/"); }, [loading, user, router]);
  if (loading || !user) return <div className="p-10"><Skeleton className="h-10 w-64" /></div>;
  return (
    <Suspense fallback={null}>
      <Sidebar />
      <div className="md:pl-[280px]">
        <TopBar />
        <main className="mx-auto max-w-[1280px] px-4 pb-28 pt-6 md:px-8 md:pb-12">{children}</main>
      </div>
      <BottomTabBar />
    </Suspense>
  );
}
