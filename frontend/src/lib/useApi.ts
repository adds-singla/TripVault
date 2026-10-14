"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/** Fetch a GET endpoint; pass null to skip. Returns {data, loading, error, reload, setData}. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!path) return;
    try { setData(await api<T>(path)); setError(null); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => { setLoading(!!path); load(); }, [path, load]);
  return { data, loading, error, reload: load, setData };
}
