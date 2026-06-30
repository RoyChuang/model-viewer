"use client";

import { Suspense, memo } from "react";
import { Html } from "@react-three/drei";
import type { Group, Mesh } from "three";
import { useSecureModel } from "../../../lib/useSecureModel";
import { GltfRackUnit } from "./GltfRackUnit";
import { RACK, type RackInstance } from "./layout";

interface SecureGltfRackUnitProps {
  activePartId: string | null;
  exploded: boolean;
  hovered: boolean;
  ledRef: (el: Mesh | null) => void;
  modelId: string;
  modelRotationY?: number;
  rack: RackInstance;
  rackRef: (el: Group | null) => void;
}

export function RackLoadingMarker({
  progress,
  rack,
  rackRef,
  stage,
}: {
  progress: number;
  rack: RackInstance;
  rackRef: (el: Group | null) => void;
  stage?: string;
}) {
  return (
    <group
      ref={rackRef}
      name={`rack-${rack.id}-loading`}
      position={[rack.x, 0, rack.z]}
      rotation={[0, rack.rotationY, 0]}
      userData={{ rackId: rack.id }}
    >
      <mesh position={[0, RACK.height / 2, 0]}>
        <boxGeometry args={[RACK.width, RACK.height, RACK.depth]} />
        <meshStandardMaterial
          color="#203040"
          emissive="#58b7ff"
          emissiveIntensity={0.12}
          opacity={0.34}
          transparent
          wireframe
        />
      </mesh>
      <Html center distanceFactor={5.5} position={[0, RACK.height * 0.55, RACK.depth * 0.54]}>
        <div className="min-w-28 rounded-md border border-sky-300/30 bg-slate-950/85 px-3 py-2 text-center text-[11px] font-medium text-sky-100 shadow-lg backdrop-blur">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span>{rack.id}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-slate-700">
            <div
              className="h-full rounded-full bg-sky-300 transition-[width] duration-150"
              style={{ width: `${Math.max(3, Math.min(100, progress))}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-slate-300">{stage ?? "載入中"}</div>
        </div>
      </Html>
    </group>
  );
}

export const SecureGltfRackUnit = memo(function SecureGltfRackUnit({
  activePartId,
  exploded,
  hovered,
  ledRef,
  modelId,
  modelRotationY,
  rack,
  rackRef,
}: SecureGltfRackUnitProps) {
  const model = useSecureModel(modelId);

  if (model.status === "loading") {
    return (
      <RackLoadingMarker
        progress={model.progress}
        rack={rack}
        rackRef={rackRef}
        stage={model.stage}
      />
    );
  }

  if (model.status === "error") {
    return (
      <RackLoadingMarker
        progress={100}
        rack={rack}
        rackRef={rackRef}
        stage="載入失敗"
      />
    );
  }

  if (model.status !== "ready") return null;

  return (
    <Suspense
      fallback={
        <RackLoadingMarker
          progress={100}
          rack={rack}
          rackRef={rackRef}
          stage="建立模型"
        />
      }
    >
      <GltfRackUnit
        activePartId={activePartId}
        exploded={exploded}
        hovered={hovered}
        ledRef={ledRef}
        modelRotationY={modelRotationY}
        modelUrl={model.blobUrl}
        rack={rack}
        rackRef={rackRef}
      />
    </Suspense>
  );
});
