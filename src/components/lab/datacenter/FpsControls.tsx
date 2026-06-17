"use client";

/* eslint-disable react-hooks/immutability -- R3F controls update camera and pose refs imperatively. */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Euler, Vector3 } from "three";
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
  const { camera, gl } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const dragging = useRef(false);

  // Reusable temporaries to avoid per-frame allocation.
  const forward = useMemo(() => new Vector3(), []);
  const right = useMemo(() => new Vector3(), []);
  const move = useMemo(() => new Vector3(), []);
  const lookEuler = useMemo(() => new Euler(0, 0, 0, "YXZ"), []);

  useEffect(() => {
    const canvas = gl.domElement;

    camera.position.set(0, PLAYER.eyeHeight, 0); // start in the central aisle
    lookEuler.setFromQuaternion(camera.quaternion);

    const down = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
    const pointerDown = () => {
      dragging.current = true;
      onLockChange?.(true);

      if (document.pointerLockElement || !canvas.requestPointerLock) return;
      Promise.resolve(canvas.requestPointerLock()).catch(() => {
        // Embedded browsers can reject pointer lock. Drag-look remains active.
      });
    };
    const pointerUp = () => {
      if (document.pointerLockElement === canvas) return;
      dragging.current = false;
      onLockChange?.(false);
    };
    const pointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      dragging.current = locked;
      onLockChange?.(locked);
    };
    const mouseMove = (e: MouseEvent) => {
      if (!dragging.current && document.pointerLockElement !== canvas) return;

      lookEuler.setFromQuaternion(camera.quaternion);
      lookEuler.y -= e.movementX * 0.002;
      lookEuler.x -= e.movementY * 0.002;
      lookEuler.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, lookEuler.x));
      camera.quaternion.setFromEuler(lookEuler);
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("mouseup", pointerUp);
    document.addEventListener("pointerlockchange", pointerLockChange);
    document.addEventListener("mousemove", mouseMove);
    canvas.addEventListener("mousedown", pointerDown);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mouseup", pointerUp);
      document.removeEventListener("pointerlockchange", pointerLockChange);
      document.removeEventListener("mousemove", mouseMove);
      canvas.removeEventListener("mousedown", pointerDown);
    };
  }, [camera, gl, lookEuler, onLockChange]);

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

  return null;
}
