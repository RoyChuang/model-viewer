"use client";

import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, PerspectiveCamera } from "@react-three/drei";
import { Room } from "./Room";
import { Racks, type RackTargetState } from "./Racks";
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
  const [rackTarget, setRackTarget] = useState<RackTargetState>({
    hovered: false,
    rackId: null,
    hostId: null,
    partId: null,
    partLabel: null,
    partKind: null,
    exploded: false,
  });
  const rackPartType =
    rackTarget.partKind === "host"
      ? "運算節點"
      : rackTarget.partKind === "power"
        ? "供電"
        : rackTarget.partKind === "cooling"
          ? "散熱"
          : rackTarget.partKind === "panel"
            ? "外殼"
            : "機箱";

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
        <Racks onTargetChange={setRackTarget} />
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

      {!doorTarget.hovered && rackTarget.hovered && (
        <div className="pointer-events-none absolute left-[calc(50%+14px)] top-[calc(50%+14px)] flex items-start">
          <div className="mt-4 h-px w-10 bg-cyan-200/70 shadow-[0_0_8px_rgba(125,220,255,0.75)]" />
          <div className="min-w-40 rounded-md border border-cyan-100/20 bg-slate-950/75 px-3 py-2 text-xs text-white/90 shadow-lg shadow-black/25 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-cyan-100">
                {rackTarget.partLabel ?? rackTarget.rackId}
              </p>
              <span className="rounded border border-cyan-100/25 px-1.5 py-0.5 text-[10px] text-cyan-100/80">
                {rackPartType}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-[2.5rem_1fr] gap-x-3 gap-y-1 text-[11px]">
              <span className="text-white/45">機箱</span>
              <span>{rackTarget.rackId}</span>
              <span className="text-white/45">狀態</span>
              <span className="text-emerald-200">正常</span>
            </div>
            <div className="mt-2 border-t border-white/10 pt-1.5 text-[11px] text-white/65">
              左鍵 {rackTarget.exploded ? "收合爆炸圖" : "展開爆炸圖"}
            </div>
          </div>
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
