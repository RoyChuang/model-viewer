"use client";

import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, PerspectiveCamera } from "@react-three/drei";
import { Room } from "./Room";
import { Racks } from "./Racks";
import { DoorRack, type DoorTargetState } from "./DoorRack";
import { FpsControls } from "./FpsControls";
import { Minimap } from "./Minimap";
import { createPlayerPose } from "./playerState";

/**
 * First-pass datacenter walkthrough. Fully self-contained under /lab — shares
 * nothing with the secure model viewer. Procedural geometry only for now.
 */
export function DatacenterScene() {
  const pose = useMemo(() => createPlayerPose(), []);
  const [locked, setLocked] = useState(false);
  const [doorTarget, setDoorTarget] = useState<DoorTargetState>({
    hovered: false,
    open: false,
  });

  return (
    <div className="relative h-full w-full select-none">
      <Canvas
        shadows
        gl={{ antialias: true, toneMappingExposure: 1.5 }}
        className="h-full w-full"
        style={{ background: "#1b1e26" }}
      >
        <PerspectiveCamera makeDefault fov={70} near={0.05} far={100} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#dfefff", "#2a2d34", 0.5]} />
        {/* Image-based lighting — gives metal surfaces something to reflect */}
        <Suspense fallback={null}>
          <Environment preset="warehouse" background={false} environmentIntensity={0.6} />
        </Suspense>
        <Room />
        <Racks />
        <DoorRack onTargetChange={setDoorTarget} />
        <FpsControls pose={pose} onLockChange={setLocked} />
      </Canvas>

      <Minimap pose={pose} />

      {/* Crosshair */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />

      {/* Interaction prompt — shown when the crosshair is on the door */}
      {doorTarget.hovered && (
        <div className="pointer-events-none absolute left-1/2 top-[calc(50%+22px)] -translate-x-1/2 whitespace-nowrap rounded-md bg-black/65 px-3 py-1.5 text-center text-xs text-white/90 backdrop-blur-sm">
          <span className="mr-1 rounded border border-white/30 px-1 text-[10px] text-white/70">
            左鍵
          </span>
          {doorTarget.open ? "關閉櫃門" : "開啟櫃門"}
        </div>
      )}

      {/* Click-to-enter hint */}
      {!locked && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg bg-black/60 px-5 py-3 text-center text-sm text-white/90 backdrop-blur-sm">
            <p className="font-semibold">點擊進入機房</p>
            <p className="mt-1 text-xs text-white/60">WASD 移動 · 滑鼠看向 · Esc 釋放滑鼠</p>
          </div>
        </div>
      )}
    </div>
  );
}
