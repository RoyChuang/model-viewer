"use client";

import dynamic from "next/dynamic";

// Experimental scenes are heavy and client-only — load without SSR.
const DatacenterScene = dynamic(
  () =>
    import("@/components/lab/datacenter/DatacenterScene").then(
      (m) => m.DatacenterScene
    ),
  { ssr: false }
);

export default function LabPage() {
  return <DatacenterScene />;
}
