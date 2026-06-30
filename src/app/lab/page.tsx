"use client";

import dynamic from "next/dynamic";
import { LabLoadingOverlay } from "@/components/lab/datacenter/LabLoadingOverlay";

// Experimental scenes are heavy and client-only — load without SSR.
const DatacenterScene = dynamic(
  () =>
    import("@/components/lab/datacenter/DatacenterScene").then(
      (m) => m.DatacenterScene
    ),
  {
    loading: () => (
      <div className="relative h-full w-full bg-slate-950">
        <LabLoadingOverlay stage="載入場景模組" />
      </div>
    ),
    ssr: false,
  }
);

export default function LabPage() {
  return <DatacenterScene />;
}
