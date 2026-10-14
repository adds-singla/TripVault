"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui";

export default function Home() {
  const { user, loading } = useAuth(); const router = useRouter();
  useEffect(() => { if (!loading) router.replace(user ? "/trips/" : "/login/"); }, [user, loading, router]);
  return <div className="p-10"><Skeleton className="h-10 w-64" /></div>;
}
