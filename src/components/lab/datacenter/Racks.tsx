"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh, MeshStandardMaterial } from "three";
import { RACK, RACKS } from "./layout";
import { createRackFrontTexture } from "./rackTexture";

/**
 * Server racks rendered as per-rack groups. Each rack is an addressable
 * Object3D subtree so future interaction can target rack IDs directly.
 */
export function Racks() {
  const ledRefs = useRef<(Mesh | null)[]>([]);
  const lastLedUpdate = useRef(-Infinity);
  const frontTex = useMemo(() => createRackFrontTexture(), []);
  useEffect(() => () => frontTex.dispose(), [frontTex]);
  // Per-LED blink phase/speed so they don't flash in unison.
  const phases = useMemo(
    () =>
      RACKS.map((_, i) => ({
        phase: ((i * 2.399963) % 1) * Math.PI * 2,
        speed: 1.1 + ((i * 1.618034) % 1) * 2.6,
      })),
    []
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (t - lastLedUpdate.current < 0.12) return;
    lastLedUpdate.current = t;

    for (let i = 0; i < ledRefs.current.length; i++) {
      const handle = ledRefs.current[i];
      if (!handle) continue;
      const { phase, speed } = phases[i];
      const on = Math.sin(t * speed + phase) > 0;
      // Green when "active", dim red otherwise. Blink the emissive so the
      // dot actually changes color (the base color is washed out by glow).
      const material = handle.material as MeshStandardMaterial;
      if (on) material.emissive.setRGB(0.1, 1.0, 0.3);
      else material.emissive.setRGB(0.25, 0.03, 0.03);
    }
  });

  return (
    <group>
      {RACKS.map((r, i) => (
        <group
          key={r.id}
          name={`rack-${r.id}`}
          position={[r.x, 0, r.z]}
          rotation={[0, r.rotationY, 0]}
          userData={{ rackId: r.id }}
        >
          <mesh castShadow receiveShadow position={[0, RACK.height / 2, 0]}>
            <boxGeometry args={[RACK.width, RACK.height, RACK.depth]} />
            <meshStandardMaterial color="#2e323a" roughness={0.4} metalness={0.55} />
          </mesh>

          {/* Front "equipment" panel — local +Z is the rack front. */}
          <mesh position={[0, RACK.height / 2, RACK.depth / 2 + 0.011]}>
            <boxGeometry args={[RACK.width * 0.9, RACK.height * 0.94, 0.03]} />
            <meshStandardMaterial map={frontTex} roughness={0.6} metalness={0.25} />
          </mesh>

          <mesh
            ref={(el) => {
              ledRefs.current[i] = el;
            }}
            position={[RACK.width * 0.3, RACK.height * 0.82, RACK.depth / 2 + 0.03]}
          >
            <boxGeometry args={[0.05, 0.05, 0.02]} />
            <meshStandardMaterial
              color="#0a0a0a"
              emissive="#330808"
              emissiveIntensity={1.4}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
