"use client";

import { ROOM } from "./layout";

/**
 * Room shell: raised access floor, four walls, ceiling, and overhead lighting.
 * Pure procedural boxes/planes — no external assets.
 */
export function Room() {
  const { width, depth, height, wallThickness } = ROOM;
  const t = wallThickness;

  return (
    <group>
      {/* Floor — perforated access-floor look via dark tile color */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#3a3e47" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#1b1d22" roughness={1} />
      </mesh>

      {/* Walls */}
      {/* North (-Z) and South (+Z) */}
      <mesh position={[0, height / 2, -depth / 2]} receiveShadow>
        <boxGeometry args={[width, height, t]} />
        <meshStandardMaterial color="#535a66" roughness={0.9} />
      </mesh>
      <mesh position={[0, height / 2, depth / 2]} receiveShadow>
        <boxGeometry args={[width, height, t]} />
        <meshStandardMaterial color="#535a66" roughness={0.9} />
      </mesh>
      {/* West (-X) and East (+X) */}
      <mesh position={[-width / 2, height / 2, 0]} receiveShadow>
        <boxGeometry args={[t, height, depth]} />
        <meshStandardMaterial color="#535a66" roughness={0.9} />
      </mesh>
      <mesh position={[width / 2, height / 2, 0]} receiveShadow>
        <boxGeometry args={[t, height, depth]} />
        <meshStandardMaterial color="#535a66" roughness={0.9} />
      </mesh>

      {/* Overhead ceiling panel lights (emissive strips + actual lights) */}
      {[-depth / 4, depth / 4].map((z) =>
        [-width / 4, width / 4].map((x) => (
          <group key={`${x}:${z}`} position={[x, height - 0.02, z]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[1.6, 0.6]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive="#eaf4ff"
                emissiveIntensity={2.2}
              />
            </mesh>
            <pointLight
              position={[0, -0.3, 0]}
              intensity={28}
              distance={14}
              decay={2}
              color="#dfefff"
            />
          </group>
        ))
      )}
    </group>
  );
}
