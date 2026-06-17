"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Mesh, MeshStandardMaterial, Raycaster, Vector2 } from "three";
import { RACK, RACKS } from "./layout";

const DOOR_RACK_ID = "A05";
const OPEN_ANGLE = 1.9; // radians the door swings open
const REACH = 3.5; // max distance (m) the crosshair can interact from
const RAYCAST_INTERVAL = 1 / 24; // seconds

export interface DoorTargetState {
  hovered: boolean;
  open: boolean;
}

interface DoorRackProps {
  /** Fired only when the targeted/open state changes (not every frame). */
  onTargetChange?: (state: DoorTargetState) => void;
}

/**
 * A single rack fitted with a hinged, clickable door. The door is layered in
 * front of the (instanced) rack chassis: closed it hides the equipment,
 * open it swings into the aisle to reveal the textured server face behind.
 *
 * In pointer-lock (FPS) mode the cursor is centered, so we raycast from the
 * screen center (the crosshair) rather than from stale pointer coordinates.
 */
export function DoorRack({ onTargetChange }: DoorRackProps) {
  const rack = useMemo(() => RACKS.find((r) => r.id === DOOR_RACK_ID)!, []);
  const { camera } = useThree();

  const pivotRef = useRef<Group>(null);
  const doorRef = useRef<Mesh>(null);
  const matRef = useRef<MeshStandardMaterial>(null);

  const openRef = useRef(false); // target state
  const angleRef = useRef(0); // animated angle
  const hoveredRef = useRef(false);
  const lastRaycastAt = useRef(-Infinity);
  const lastEmitted = useRef<DoorTargetState>({ hovered: false, open: false });

  const raycaster = useMemo(() => new Raycaster(), []);
  const center = useMemo(() => new Vector2(0, 0), []);

  // Front faces the aisle (toward z = 0); dir matches the front-panel logic.
  const dir = rack.z < 0 ? 1 : -1;
  const doorW = RACK.width * 0.92;
  const doorH = RACK.height * 0.96;
  const hingeX = rack.x - doorW / 2;
  const frontZ = rack.z + dir * (RACK.depth / 2 + 0.05);
  const openTarget = -dir * OPEN_ANGLE; // swing outward into the aisle

  // Toggle on click, but only when the crosshair is on the door and in reach.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (hoveredRef.current) openRef.current = !openRef.current;
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  useFrame((state, delta) => {
    // Raycast from the crosshair at a capped rate; door animation still runs
    // every frame, but hover detection does not need 60 checks per second.
    let hovered = hoveredRef.current;
    if (pivotRef.current && state.clock.elapsedTime - lastRaycastAt.current >= RAYCAST_INTERVAL) {
      lastRaycastAt.current = state.clock.elapsedTime;
      raycaster.setFromCamera(center, camera);
      const hit = raycaster.intersectObject(pivotRef.current, true)[0];
      hovered = !!hit && hit.distance <= REACH;
      hoveredRef.current = hovered;
    }
    if (matRef.current) {
      matRef.current.emissiveIntensity = hovered ? 0.45 : 0;
    }

    // Animate the door toward its target angle.
    const target = openRef.current ? openTarget : 0;
    angleRef.current += (target - angleRef.current) * Math.min(1, delta * 8);
    if (pivotRef.current) pivotRef.current.rotation.y = angleRef.current;

    // Notify the overlay only when hovered/open actually changes.
    const prev = lastEmitted.current;
    if (prev.hovered !== hovered || prev.open !== openRef.current) {
      lastEmitted.current = { hovered, open: openRef.current };
      onTargetChange?.(lastEmitted.current);
    }
  });

  return (
    <group ref={pivotRef} position={[hingeX, RACK.height / 2, frontZ]}>
      {/* Door slab — centered on the rack, hinged at hingeX */}
      <mesh ref={doorRef} position={[doorW / 2, 0, 0]} castShadow>
        <boxGeometry args={[doorW, doorH, 0.03]} />
        <meshStandardMaterial
          ref={matRef}
          color="#3c424d"
          roughness={0.35}
          metalness={0.6}
          emissive="#5aa9ff"
          emissiveIntensity={0}
        />
      </mesh>

      {/* Perforated mesh window (darker inset) */}
      <mesh position={[doorW / 2, 0, 0.02]}>
        <planeGeometry args={[doorW * 0.7, doorH * 0.82]} />
        <meshStandardMaterial color="#14161a" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Handle — on the free (swinging) edge, opposite the hinge */}
      <mesh position={[doorW * 0.88, 0, 0.05]} castShadow>
        <boxGeometry args={[0.03, 0.18, 0.04]} />
        <meshStandardMaterial color="#9aa3ad" roughness={0.3} metalness={0.8} />
      </mesh>
    </group>
  );
}
