"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import { GOLD } from "@/lib/palette";
import { onExternalLink } from "@/lib/native";
import type { Venue } from "@/lib/types";

export type MapPerson = {
  id: string;
  name: string;
  color: string;
  lat: number;
  lon: number;
  label: string;
};

export type SpotDisplay = {
  lat: number;
  lon: number;
  label: string;
  sub: string;
};

/** "Find a spot" results, rendered as clickable dots beneath the person/spot markers */
export type MapViewProps = {
  people: MapPerson[];
  spot: SpotDisplay | null;
  highlightedId: string | null;
  maxDistKm: number;
  fitVersion: number;
  onSpotDrag: (lat: number, lon: number) => void;
  venues?: Venue[];
  activeVenueId?: string | null;
  onPickVenue?: (v: Venue) => void;
};

function personIcon(color: string, initial: string, active: boolean) {
  return L.divIcon({
    className: "mitm-marker",
    html: `<span class="mitm-pin" style="background:${color};${
      active ? `box-shadow:0 0 0 5px ${color}66;` : ""
    }">${initial.replace(/[&<>"']/g, "")}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function spotIcon() {
  return L.divIcon({
    className: "mitm-marker",
    html: `<span class="mitm-spot"><i class="mitm-spot-pulse"></i><i class="mitm-spot-ring"></i><b class="mitm-spot-core"></b></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

/** Fit all starting points, including after a phone tab or viewport resize. */
function Controller({ spot, people, fitVersion }: { spot: SpotDisplay | null; people: MapPerson[]; fitVersion: number }) {
  const map = useMap();
  const current = useRef({ spot, people });
  useEffect(() => { current.current = { spot, people }; }, [spot, people]);
  const positions = people.map(p => `${p.lat},${p.lon}`).join(";");
  useEffect(() => {
    const fit = () => {
      if (!map.getContainer().clientWidth) return;
      map.invalidateSize();
      const { people: ps, spot: target } = current.current;
      if (!ps.length) return;
      if (ps.length === 1) { map.setView([ps[0].lat, ps[0].lon], 13); return; }
      const anchor = target?.lon ?? ps[0].lon;
      const wrap = (lon: number) => anchor + ((lon - anchor + 540) % 360) - 180;
      const bounds = L.latLngBounds(ps.map(p => [p.lat, wrap(p.lon)] as [number, number]));
      if (target) bounds.extend([target.lat, wrap(target.lon)]);
      const size = map.getSize();
      const desktop = window.innerWidth > 760;
      const roomForResults = desktop && size.x > 650;
      map.fitBounds(bounds, { paddingTopLeft: [45, 105], paddingBottomRight: [roomForResults ? 365 : 45, desktop && !roomForResults ? Math.min(size.y * .5, 360) : 75], maxZoom: 15, animate: false });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, positions, fitVersion]);
  return null;
}

export default function MapView({
  people,
  spot,
  highlightedId,
  fitVersion,
  onSpotDrag,
  venues,
  activeVenueId,
  onPickVenue,
 }: MapViewProps) {
  const anchor = spot?.lon ?? people[0]?.lon ?? 0;
  const longitude = (lon: number) => anchor + ((lon - anchor + 540) % 360) - 180;
  return (
    <MapContainer
      center={[30, 12]}
      zoom={2}
      minZoom={2}
      maxZoom={18}
      zoomControl={false}
      worldCopyJump
      className="z-0 h-full w-full"
      style={{ background: "#e9ede4" }}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={18} maxNativeZoom={16}
        attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        maxZoom={18} maxNativeZoom={16}
        attribution=""
      />
      <ZoomControl position="bottomright" />
      <Controller spot={spot} people={people} fitVersion={fitVersion} />

      {spot &&
        people.map((p) => (
          <Polyline
            key={`line-${p.id}`}
            positions={[
              [p.lat, longitude(p.lon)],
              [spot.lat, longitude(spot.lon)],
            ]}
            pathOptions={{
              color: p.color,
              weight: highlightedId === p.id ? 4 : 2.5,
              opacity: highlightedId === p.id ? 1 : 0.85,
              className: "mitm-route",
            }}
          />
        ))}

      {people.map((p) => (
        <Marker
          key={p.id}
          title={p.name || "Friend"}
          alt={`${p.name || "Friend"} starting point`}
          position={[p.lat, longitude(p.lon)]}
          icon={personIcon(
            p.color,
            (p.name.trim()[0] ?? "?").toUpperCase(),
            highlightedId === p.id,
          )}
        >
          <Tooltip direction="top" offset={[0, -14]}>
            <b>{p.name}</b>
            <br />
            {p.label}
          </Tooltip>
        </Marker>
      ))}

      {venues?.map(v => {
        const active = v.id === activeVenueId;
        return (
          <CircleMarker key={v.id} center={[v.lat, longitude(v.lon)]} radius={active ? 7 : 5} className="venue-dot"
            pathOptions={{ color: GOLD, weight: active ? 3 : 1.5, fillColor: active ? GOLD : "#7aa98c", fillOpacity: 0.65 }}
            eventHandlers={onPickVenue ? { click: () => onPickVenue(v) } : undefined}>
            <Tooltip direction="top" offset={[0, -6]}>{v.name}</Tooltip>
          </CircleMarker>
        );
      })}

      {spot && (
        <Marker
          title="Drag meeting point"
          alt="Meeting point"
          position={[spot.lat, longitude(spot.lon)]}
          icon={spotIcon()}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onSpotDrag(Math.max(-90, Math.min(90, ll.lat)), ((ll.lng + 180) % 360 + 360) % 360 - 180);
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -14]} permanent>
            <span style={{ color: GOLD, fontWeight: 700 }}>{spot.label}</span>
          </Tooltip>
          <Popup>
            <b style={{ color: GOLD }}>{spot.label}</b>
            <br />
            {spot.sub}
            <br />
            {spot.lat.toFixed(5)}, {spot.lon.toFixed(5)}
            <br />
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lon}`}
              target="_blank"
              rel="noreferrer"
              onClick={onExternalLink}
            >
              Open in Google Maps
            </a>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
