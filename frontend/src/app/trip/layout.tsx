"use client";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { TripProvider } from "@/components/TripContext";
import { TripTabs } from "@/components/trip";
import { Skeleton } from "@/components/ui";

export default function TripLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <TripProvider><TripTabs />{children}</TripProvider>
      </Suspense>
    </AppShell>
  );
}
