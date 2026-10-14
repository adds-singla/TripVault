"use client";
import { createContext, useContext, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useApi } from "@/lib/useApi";
import type { Trip } from "@/lib/types";
import { EmptyState, Skeleton } from "./ui";
import { Compass } from "lucide-react";
import Link from "next/link";

interface Ctx { tripId: string; trip: Trip; reload(): void; canEdit: boolean; isOwner: boolean }
const C = createContext<Ctx>(null as never);
export const useTrip = () => useContext(C);
export const LAST_TRIP = "tv_last_trip";

export function useTripId() { return useSearchParams().get("id"); }

export function TripProvider({ children }: { children: React.ReactNode }) {
  const id = useTripId();
  const { data, loading, error, reload } = useApi<Trip>(id ? `/trips/${id}` : null);
  useEffect(() => { if (data) localStorage.setItem(LAST_TRIP, data.id); }, [data]);
  if (!id) return <EmptyState icon={<Compass />} title="No trip selected" text="Pick a trip from your dashboard." action={<Link className="font-semibold text-accent underline" href="/trips/">Go to My Trips</Link>} />;
  if (loading) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  if (error || !data) return <EmptyState icon={<Compass />} title="Trip not found" text={error ?? "You may not have access to this trip."} action={<Link className="font-semibold text-accent underline" href="/trips/">Back to My Trips</Link>} />;
  return <C.Provider value={{ tripId: id, trip: data, reload, canEdit: data.my_role !== "viewer", isOwner: data.my_role === "owner" }}>{children}</C.Provider>;
}
