"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import { meetingZoom } from "@/lib/geo";
import { GOLD } from "@/lib/palette";

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

export type MapViewProps = {
  people: MapPerson[];
  spot: SpotDisplay | null;
  highlightedId: string | null;
  maxDistKm: number;
  onSpotDrag: (lat: number, lon: number) => void;
};

function personIcon(color: string, initial: string, active: boolean) {
  return L.divIcon({
    className: "mitm-marker",
    html: `<span class="mitm-pin" style="background:${color};${
      active ? `box-shadow:0 0 0 4px ${color},0 6px 16px #000;` : "box-shadow:0 6px 16px #000;"
    }">${initial}</span>`,
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

/** Flies to the spot when it moves; refits bounds when people come and go. */
function Controller({
  spot,
  people,
  maxDistKm,
}: {
  spot: SpotDisplay | null;
  people: MapPerson[];
  maxDistKm: number;
}) {
  const map = useMap();
  const prevCount = useRef(-1);
  const prevSpotKey = useRef("");

  useEffect(() => {
    const count = people.length;
    const spotKey = spot ? `${spot.lat.toFixed(5)},${spot.lon.toFixed(5)}` : "";
    const countChanged = prevCount.current !== count;
    const spotChanged = prevSpotKey.current !== spotKey;
    prevCount.current = count;
    prevSpotKey.current = spotKey;

    if (people.length === 0) return;
    if (countChanged) {
      if (people.length === 1) {
        map.flyTo([people[0].lat, people[0].lon], 13, { duration: 0.9 });
        return;
      }
      const bounds = L.latLngBounds(
        people.map((p) => [p.lat, p.lon] as [number, number]),
      );
      if (spot) bounds.extend([spot.lat, spot.lon]);
      map.flyToBounds(bounds.pad(0.25), { duration: 0.9 });
    } else if (spotChanged && spot) {
      map.flyTo(
        [spot.lat, spot.lon],
        Math.max(map.getZoom(), meetingZoom(maxDistKm)),
        { duration: 1.1 },
      );
    }
  }, [spot, people, map, maxDistKm]);

  return null;
}

export default function MapView({
  people,
  spot,
  highlightedId,
  maxDistKm,
  onSpotDrag,
}: MapViewProps) {
  return (
    <MapContainer
      center={[30, 12]}
      zoom={2}
      minZoom={2}
      maxZoom={16}
      zoomControl={false}
      worldCopyJump
      className="z-0 h-full w-full"
      style={{ background: "#262626" }}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
        attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
        attribution=""
      />
      <ZoomControl position="bottomright" />
      <Controller spot={spot} people={people} maxDistKm={maxDistKm} />

      {spot &&
        people.map((p) => (
          <Polyline
            key={`line-${p.id}`}
            positions={[
              [p.lat, p.lon],
              [spot.lat, spot.lon],
            ]}
            pathOptions={{
              color: p.color,
              weight: highlightedId === p.id ? 4 : 2.5,
              opacity: highlightedId === p.id ? 0.95 : 0.6,
              className: "mitm-route",
            }}
          />
        ))}

      {people.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lon]}
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

      {spot && (
        <Marker
          position={[spot.lat, spot.lon]}
          icon={spotIcon()}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onSpotDrag(ll.lat, ll.lng);
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
            >
              Open in Google Maps
            </a>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
