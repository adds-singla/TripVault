"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Place } from "@/lib/types";

const COLOR = { hotel: "#765A4B", attraction: "#35606E", food: "#C98B3A" };

/** Leaflet + OpenStreetMap (no API key). Markers are CSS divIcons so no image assets are needed. */
export default function MapView({ places, selected, onSelect, onPick }: { places: Place[]; selected?: string | null; onSelect?(id: string): void; onPick?(lat: number, lng: number): void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);
  const pick = useRef(onPick); pick.current = onPick;

  useEffect(() => {
    let dead = false;
    import("leaflet").then((L) => {
      if (dead || !el.current || map.current) return;
      map.current = L.map(el.current).setView([20, 0], 2);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      map.current.on("click", (e) => pick.current?.(e.latlng.lat, e.latlng.lng));
      draw(L);
    });
    return () => { dead = true; map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { import("leaflet").then(draw); /* eslint-disable-next-line */ }, [places, selected]);

  function draw(L: typeof import("leaflet")) {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    places.forEach((p) => {
      const on = p.id === selected;
      const icon = L.divIcon({ className: "", iconSize: [on ? 30 : 22, on ? 30 : 22],
        html: `<div style="width:100%;height:100%;border-radius:50%;background:${COLOR[p.kind]};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>` });
      L.marker([p.lat, p.lng], { icon }).addTo(layer.current!).bindPopup(`<b>${p.name.replace(/</g, "&lt;")}</b><br>${(p.address ?? "").replace(/</g, "&lt;")}`).on("click", () => onSelect?.(p.id));
    });
    if (places.length) map.current.fitBounds(L.latLngBounds(places.map((p) => [p.lat, p.lng] as [number, number])).pad(0.3), { maxZoom: 15 });
  }
  return <div ref={el} className="h-[420px] w-full overflow-hidden rounded-card border border-line md:h-[560px]" />;
}
