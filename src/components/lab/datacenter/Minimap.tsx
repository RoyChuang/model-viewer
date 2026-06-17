"use client";

import { useEffect, useRef } from "react";
import { ROOM, RACKS, RACK } from "./layout";
import type { PlayerPose } from "./playerState";

interface MinimapProps {
  pose: PlayerPose;
}

const PADDING = 10;
const SCALE = 14; // pixels per meter
const DRAW_INTERVAL = 1000 / 20;

/**
 * Top-down 2D minimap drawn on a Canvas overlay (outside the WebGL canvas).
 * Reads the shared player pose every animation frame without re-rendering.
 *
 * World->map mapping: world X -> map X, world Z -> map Y (both centered).
 */
export function Minimap({ pose }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Computed from ROOM in render so a layout/HMR change rebuilds the canvas.
  const W = ROOM.width * SCALE + PADDING * 2;
  const H = ROOM.depth * SCALE + PADDING * 2;
  // Signature of the rack layout — changes (e.g. on an HMR edit to rowZ) force
  // the draw loop to rebuild against the new positions without a hard refresh.
  const racksSig = RACKS.map((r) => `${r.x},${r.z}`).join(";");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const toMapX = (wx: number) => PADDING + (wx + ROOM.width / 2) * SCALE;
    const toMapY = (wz: number) => PADDING + (wz + ROOM.depth / 2) * SCALE;

    let raf = 0;
    let lastDraw = -Infinity;
    const draw = (now: number) => {
      if (now - lastDraw < DRAW_INTERVAL) {
        raf = requestAnimationFrame(draw);
        return;
      }
      lastDraw = now;
      ctx.clearRect(0, 0, W, H);

      // Room background + border
      ctx.fillStyle = "rgba(20, 22, 28, 0.85)";
      ctx.fillRect(PADDING, PADDING, ROOM.width * SCALE, ROOM.depth * SCALE);
      ctx.strokeStyle = "#4a4a6a";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(PADDING, PADDING, ROOM.width * SCALE, ROOM.depth * SCALE);

      // Racks
      ctx.fillStyle = "#6366f1";
      for (const r of RACKS) {
        const w = RACK.width * SCALE;
        const d = RACK.depth * SCALE;
        ctx.fillRect(toMapX(r.x) - w / 2, toMapY(r.z) - d / 2, w, d);
      }

      // Player
      const px = toMapX(pose.x);
      const py = toMapY(pose.z);

      // Facing cone (FOV) — angle is atan2(dirX, dirZ); map Y follows world Z.
      const len = 22;
      const half = 0.5; // half FOV in radians
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.sin(pose.angle - half) * len, py + Math.cos(pose.angle - half) * len);
      ctx.lineTo(px + Math.sin(pose.angle + half) * len, py + Math.cos(pose.angle + half) * len);
      ctx.closePath();
      ctx.fillStyle = "rgba(120, 200, 255, 0.25)";
      ctx.fill();

      // Player dot
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#7dd3fc";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // Re-run (rebuild the rAF loop) when the layout or canvas size changes,
    // so an HMR edit to layout.ts is reflected without a hard refresh.
  }, [pose, W, H, racksSig]);

  return (
    <div className="absolute right-4 top-4 rounded-md border border-border bg-black/40 p-1 backdrop-blur-sm">
      <canvas ref={canvasRef} style={{ width: W, height: H }} />
      <div className="pointer-events-none absolute left-2 top-2 text-[10px] font-medium uppercase tracking-wide text-white/60">
        Map
      </div>
    </div>
  );
}
