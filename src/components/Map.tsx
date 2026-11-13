"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "./MapView";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[#0B0D17] text-sm text-[#9AA3C7]">
      Loading map…
    </div>
  ),
});

export default function Map(props: MapViewProps) {
  return <MapView {...props} />;
}
