"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import { Vector3 } from "three";
import { ROOM, RACK_OBSTACLES, PLAYER, type Obstacle } from "./layout";
import type { PlayerPose } from "./playerState";

interface FpsControlsProps {
  pose: PlayerPose;
  onLockChange?: (locked: boolean) => void;
}

/** Resolve a circle (player) against an AABB by pushing out the least axis. */
function resolveObstacle(x: number, z: number, r: number, o: Obstacle): [number, number] {
  const minX = o.minX - r;
  const maxX = o.maxX + r;
  const minZ = o.minZ - r;
  const maxZ = o.maxZ + r;
  if (x <= minX || x >= maxX || z <= minZ || z >= maxZ) return [x, z];

  // Inside the expanded box — push out along whichever wall is closest.
  const dl = x - minX;
  const dr = maxX - x;
  const dt = z - minZ;
  const db = maxZ - z;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) return [minX, z];
  if (m === dr) return [maxX, z];
  if (m === dt) return [x, minZ];
  return [x, maxZ];
}

export function FpsControls({ pose, onLockChange }: FpsControlsProps) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});

  // Reusable temporaries to avoid per-frame allocation.
  const forward = useMemo(() => new Vector3(), []);
  const right = useMemo(() => new Vector3(), []);
  const move = useMemo(() => new Vector3(), []);

  useEffect(() => {
    camera.position.set(0, PLAYER.eyeHeight, 0); // start in the central aisle
    const down = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [camera]);

  useFrame((_, delta) => {
    const k = keys.current;
    const fwdInput = (k["KeyW"] || k["ArrowUp"] ? 1 : 0) - (k["KeyS"] || k["ArrowDown"] ? 1 : 0);
    const strafe = (k["KeyD"] || k["ArrowRight"] ? 1 : 0) - (k["KeyA"] || k["ArrowLeft"] ? 1 : 0);

    // Horizontal forward/right derived from camera yaw.
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.set(-forward.z, 0, forward.x); // forward rotated -90deg on Y (points to player's right)

    if (fwdInput !== 0 || strafe !== 0) {
      move.set(0, 0, 0);
      move.addScaledVector(forward, fwdInput);
      move.addScaledVector(right, strafe);
      move.normalize().multiplyScalar(PLAYER.speed * delta);

      let nx = camera.position.x + move.x;
      let nz = camera.position.z + move.z;

      // Keep inside the room interior (walls + player radius + margin).
      const halfW = ROOM.width / 2 - ROOM.wallThickness - PLAYER.radius;
      const halfD = ROOM.depth / 2 - ROOM.wallThickness - PLAYER.radius;
      nx = Math.max(-halfW, Math.min(halfW, nx));
      nz = Math.max(-halfD, Math.min(halfD, nz));

      // Resolve against each rack.
      for (const o of RACK_OBSTACLES) {
        [nx, nz] = resolveObstacle(nx, nz, PLAYER.radius, o);
      }

      camera.position.x = nx;
      camera.position.z = nz;
      camera.position.y = PLAYER.eyeHeight;
    }

    // Publish pose for the minimap (top-down heading from forward vector).
    pose.x = camera.position.x;
    pose.z = camera.position.z;
    pose.angle = Math.atan2(forward.x, forward.z);
  });

  return (
    <PointerLockControls
      onLock={() => onLockChange?.(true)}
      onUnlock={() => onLockChange?.(false)}
    />
  );
}
