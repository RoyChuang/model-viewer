"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Instance, Instances } from "@react-three/drei";
import type { Color } from "three";
import { RACK, RACKS } from "./layout";
import { createRackFrontTexture } from "./rackTexture";

/** Small ref handle exposing the per-instance color setter drei provides. */
interface InstanceHandle {
  color: Color;
}

/**
 * Server racks rendered as instanced chassis (one draw call) plus a second
 * instanced set of status LEDs that blink to make the room feel alive.
 */
export function Racks() {
  const ledRefs = useRef<(InstanceHandle | null)[]>([]);
  const frontTex = useMemo(() => createRackFrontTexture(), []);
  useEffect(() => () => frontTex.dispose(), [frontTex]);
  // Per-LED blink phase/speed so they don't flash in unison.
  const phases = useMemo(
    () => RACKS.map(() => ({ phase: Math.random() * Math.PI * 2, speed: 1 + Math.random() * 3 })),
    []
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < ledRefs.current.length; i++) {
      const handle = ledRefs.current[i];
      if (!handle) continue;
      const { phase, speed } = phases[i];
      const on = Math.sin(t * speed + phase) > 0;
      // Green when "active", dim red otherwise.
      if (on) handle.color.setRGB(0.1, 1.0, 0.3);
      else handle.color.setRGB(0.4, 0.05, 0.05);
    }
  });

  return (
    <group>
      {/* Rack chassis — instanced, single draw call */}
      <Instances limit={RACKS.length} castShadow receiveShadow>
        <boxGeometry args={[RACK.width, RACK.height, RACK.depth]} />
        <meshStandardMaterial color="#2e323a" roughness={0.4} metalness={0.55} />
        {RACKS.map((r) => (
          <Instance
            key={r.id}
            position={[r.x, RACK.height / 2, r.z]}
            rotation={[0, r.rotationY, 0]}
          />
        ))}
      </Instances>

      {/* Front "equipment" panel — textured 19" rack face toward the aisle */}
      <Instances limit={RACKS.length}>
        <boxGeometry args={[RACK.width * 0.9, RACK.height * 0.94, 0.03]} />
        <meshStandardMaterial map={frontTex} roughness={0.6} metalness={0.25} />
        {RACKS.map((r) => {
          // Push the panel toward the aisle (z = 0).
          const dir = r.z < 0 ? 1 : -1;
          return (
            <Instance
              key={r.id}
              position={[r.x, RACK.height / 2, r.z + dir * (RACK.depth / 2 + 0.011)]}
              rotation={[0, r.rotationY, 0]}
            />
          );
        })}
      </Instances>

      {/* Status LEDs — instanced emissive dots near the top of each rack front */}
      <Instances limit={RACKS.length}>
        <boxGeometry args={[0.05, 0.05, 0.02]} />
        <meshStandardMaterial emissive="#ffffff" emissiveIntensity={2} toneMapped={false} />
        {RACKS.map((r, i) => {
          const dir = r.z < 0 ? 1 : -1;
          return (
            <Instance
              key={r.id}
              ref={(el: InstanceHandle | null) => {
                ledRefs.current[i] = el;
              }}
              position={[
                r.x + RACK.width * 0.3,
                RACK.height * 0.82,
                r.z + dir * (RACK.depth / 2 + 0.03),
              ]}
            />
          );
        })}
      </Instances>
    </group>
  );
}
