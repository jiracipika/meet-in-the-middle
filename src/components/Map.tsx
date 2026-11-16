"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "./MapView";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[#e9ede4] text-sm text-[#718078]">
      Loading map…
    </div>
  ),
});

export default function Map(props: MapViewProps) {
  return <MapView {...props} />;
}
