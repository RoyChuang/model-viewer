"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Raycaster,
  Vector2,
  type Texture,
} from "three";
import { RACK, RACKS, type RackInstance } from "./layout";
import { createRackFrontTexture } from "./rackTexture";

const RAYCAST_INTERVAL = 1 / 24;
const REACH = 5.2;
const TRAY_COUNT = 7;

export interface RackTargetState {
  hovered: boolean;
  rackId: string | null;
  hostId: string | null;
  partId: string | null;
  partLabel: string | null;
  partKind: "host" | "power" | "cooling" | "panel" | null;
  exploded: boolean;
}

interface RacksProps {
  onTargetChange?: (state: RackTargetState) => void;
}

interface RackUnitProps {
  activePartId: string | null;
  exploded: boolean;
  frontTex: Texture;
  hovered: boolean;
  ledRef: (el: Mesh | null) => void;
  rack: RackInstance;
  rackRef: (el: Group | null) => void;
}

interface RackPartData {
  hostId?: string;
  partId: string;
  partKind: "host" | "power" | "cooling" | "panel";
  partLabel: string;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function findRackId(object: Object3D | null) {
  let current: Object3D | null = object;
  while (current) {
    if (typeof current.userData.rackId === "string") return current.userData.rackId as string;
    current = current.parent;
  }
  return null;
}

function findPartData(object: Object3D | null): RackPartData | null {
  let current: Object3D | null = object;
  while (current) {
    if (typeof current.userData.partId === "string") {
      return current.userData as RackPartData;
    }
    current = current.parent;
  }
  return null;
}

function RackUnit({
  activePartId,
  exploded,
  frontTex,
  hovered,
  ledRef,
  rack,
  rackRef,
}: RackUnitProps) {
  const frameRef = useRef<Mesh>(null);
  const frameMatRef = useRef<MeshStandardMaterial>(null);
  const frontRef = useRef<Mesh>(null);
  const trayRefs = useRef<(Mesh | null)[]>([]);
  const powerRef = useRef<Mesh>(null);
  const coolingRef = useRef<Mesh>(null);
  const progress = useRef(0);

  useFrame((_, delta) => {
    const target = exploded ? 1 : 0;
    progress.current += (target - progress.current) * Math.min(1, delta * 7);
    const p = easeOutCubic(progress.current);

    if (frameMatRef.current) {
      frameMatRef.current.opacity = 1 - p * 0.58;
      frameMatRef.current.emissiveIntensity = hovered || exploded ? 0.22 : 0;
    }

    if (frontRef.current) {
      frontRef.current.position.set(-p * 0.12, RACK.height / 2, RACK.depth / 2 + 0.011 + p * 0.16);
      frontRef.current.rotation.y = p * 0.08;
      const material = frontRef.current.material as MeshStandardMaterial;
      const active = activePartId === `${rack.id}:panel`;
      material.emissive.set(active ? "#8fdcff" : "#000000");
      material.emissiveIntensity = active ? 0.35 : 0;
    }

    for (let i = 0; i < trayRefs.current.length; i++) {
      const tray = trayRefs.current[i];
      if (!tray) continue;
      const partId = `${rack.id}:host:${i + 1}`;
      const active = activePartId === partId;
      tray.visible = p > 0.025;
      tray.position.y = 0.42 + i * 0.2;
      tray.position.z = RACK.depth / 2 + 0.035 + p * (0.16 + i * 0.028);
      tray.position.x = (i % 2 === 0 ? -0.012 : 0.012) * p;
      const material = tray.material as MeshStandardMaterial;
      material.emissive.set(active ? "#7ddcff" : "#000000");
      material.emissiveIntensity = active ? 0.42 : 0;
    }

    if (powerRef.current) {
      const active = activePartId === `${rack.id}:power`;
      powerRef.current.visible = p > 0.025;
      powerRef.current.position.set(-0.08 * p, 0.18, RACK.depth / 2 + 0.045 + p * 0.32);
      const material = powerRef.current.material as MeshStandardMaterial;
      material.emissive.set(active ? "#ffd28a" : "#5a2b0c");
      material.emissiveIntensity = active ? 0.7 : 0.35;
    }

    if (coolingRef.current) {
      const active = activePartId === `${rack.id}:cooling`;
      coolingRef.current.visible = p > 0.025;
      coolingRef.current.position.set(0.08 * p, 1.76, RACK.depth / 2 + 0.045 + p * 0.28);
      const material = coolingRef.current.material as MeshStandardMaterial;
      material.emissive.set(active ? "#8bf4ff" : "#0c4356");
      material.emissiveIntensity = active ? 0.68 : 0.32;
    }
  });

  return (
    <group
      ref={rackRef}
      name={`rack-${rack.id}`}
      position={[rack.x, 0, rack.z]}
      rotation={[0, rack.rotationY, 0]}
      userData={{ rackId: rack.id }}
    >
      <mesh ref={frameRef} castShadow receiveShadow position={[0, RACK.height / 2, 0]}>
        <boxGeometry args={[RACK.width, RACK.height, RACK.depth]} />
        <meshStandardMaterial
          ref={frameMatRef}
          color="#2e323a"
          emissive="#4ea4ff"
          emissiveIntensity={hovered || exploded ? 0.22 : 0}
          metalness={0.55}
          opacity={1}
          roughness={0.4}
          transparent
        />
      </mesh>

      <mesh
        ref={frontRef}
        position={[0, RACK.height / 2, RACK.depth / 2 + 0.011]}
        userData={{
          partId: `${rack.id}:panel`,
          partKind: "panel",
          partLabel: "前面板",
        }}
      >
        <boxGeometry args={[RACK.width * 0.9, RACK.height * 0.94, 0.03]} />
        <meshStandardMaterial map={frontTex} roughness={0.6} metalness={0.25} />
      </mesh>

      {Array.from({ length: TRAY_COUNT }).map((_, trayIndex) => (
        <mesh
          key={`${rack.id}-tray-${trayIndex}`}
          ref={(el) => {
            trayRefs.current[trayIndex] = el;
          }}
          position={[0, 0.42 + trayIndex * 0.2, RACK.depth / 2 + 0.035]}
          userData={{
            hostId: `A${trayIndex + 1}`,
            partId: `${rack.id}:host:${trayIndex + 1}`,
            partKind: "host",
            partLabel: `主機 A${trayIndex + 1}`,
          }}
          visible={false}
        >
          <boxGeometry args={[RACK.width * 0.7, 0.07, 0.26]} />
          <meshStandardMaterial
            color={trayIndex % 2 === 0 ? "#697481" : "#5d6672"}
            metalness={0.35}
            roughness={0.48}
          />
        </mesh>
      ))}

      <mesh
        ref={powerRef}
        position={[0, 0.18, RACK.depth / 2 + 0.05]}
        userData={{
          partId: `${rack.id}:power`,
          partKind: "power",
          partLabel: "電源模組",
        }}
        visible={false}
      >
        <boxGeometry args={[RACK.width * 0.58, 0.12, 0.28]} />
        <meshStandardMaterial color="#b06b2e" emissive="#5a2b0c" emissiveIntensity={0.35} />
      </mesh>

      <mesh
        ref={coolingRef}
        position={[0, 1.76, RACK.depth / 2 + 0.05]}
        userData={{
          partId: `${rack.id}:cooling`,
          partKind: "cooling",
          partLabel: "散熱模組",
        }}
        visible={false}
      >
        <boxGeometry args={[RACK.width * 0.54, 0.12, 0.24]} />
        <meshStandardMaterial color="#2f8499" emissive="#0c4356" emissiveIntensity={0.32} />
      </mesh>

      <mesh
        ref={(el) => {
          ledRef(el);
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
  );
}

/**
 * Server racks rendered as per-rack groups. Each rack is an addressable
 * Object3D subtree so future interaction can target rack IDs directly.
 */
export function Racks({ onTargetChange }: RacksProps) {
  const { camera } = useThree();
  const [explodedRackId, setExplodedRackId] = useState<string | null>(null);
  const [hoveredRackId, setHoveredRackId] = useState<string | null>(null);
  const [hoveredHostId, setHoveredHostId] = useState<string | null>(null);
  const [hoveredPart, setHoveredPart] = useState<RackPartData | null>(null);
  const hoveredRackIdRef = useRef<string | null>(null);
  const hoveredHostIdRef = useRef<string | null>(null);
  const hoveredPartIdRef = useRef<string | null>(null);
  const rackRefs = useRef<(Group | null)[]>([]);
  const ledRefs = useRef<(Mesh | null)[]>([]);
  const lastLedUpdate = useRef(-Infinity);
  const lastRaycastAt = useRef(-Infinity);
  const raycaster = useMemo(() => new Raycaster(), []);
  const center = useMemo(() => new Vector2(0, 0), []);
  const frontTex = useMemo(() => createRackFrontTexture(), []);

  useEffect(() => () => frontTex.dispose(), [frontTex]);

  const phases = useMemo(
    () =>
      RACKS.map((_, i) => ({
        phase: ((i * 2.399963) % 1) * Math.PI * 2,
        speed: 1.1 + ((i * 1.618034) % 1) * 2.6,
      })),
    []
  );

  useEffect(() => {
    onTargetChange?.({
      hovered: hoveredRackId !== null,
      rackId: hoveredRackId,
      hostId: hoveredHostId,
      partId: hoveredPart?.partId ?? null,
      partLabel: hoveredPart?.partLabel ?? null,
      partKind: hoveredPart?.partKind ?? null,
      exploded: hoveredRackId !== null && hoveredRackId === explodedRackId,
    });
  }, [explodedRackId, hoveredHostId, hoveredPart, hoveredRackId, onTargetChange]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const rackId = hoveredRackIdRef.current;
      if (!rackId) return;
      setExplodedRackId((current) => (current === rackId ? null : rackId));
    };

    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (t - lastRaycastAt.current >= RAYCAST_INTERVAL) {
      lastRaycastAt.current = t;
      raycaster.setFromCamera(center, camera);
      const rackObjects = rackRefs.current.filter((rack): rack is Group => rack !== null);
      const hits = raycaster.intersectObjects(rackObjects, true);
      const partHit =
        explodedRackId !== null
          ? hits.find((intersection) => findPartData(intersection.object)?.partKind === "host") ??
            hits.find((intersection) => {
              const partKind = findPartData(intersection.object)?.partKind;
              return partKind === "power" || partKind === "cooling";
            }) ??
            hits.find((intersection) => findPartData(intersection.object)?.partKind === "panel")
          : undefined;
      const hit = partHit ?? hits[0];
      const nextHovered =
        hit && hit.distance <= REACH ? findRackId(hit.object) : null;
      const nextPart =
        hit && hit.distance <= REACH && nextHovered === explodedRackId
          ? findPartData(hit.object)
          : null;
      const nextHost = nextPart?.hostId ?? null;

      if (hoveredRackIdRef.current !== nextHovered) {
        hoveredRackIdRef.current = nextHovered;
        setHoveredRackId(nextHovered);
      }

      if (hoveredHostIdRef.current !== nextHost) {
        hoveredHostIdRef.current = nextHost;
        setHoveredHostId(nextHost);
      }

      if (hoveredPartIdRef.current !== (nextPart?.partId ?? null)) {
        hoveredPartIdRef.current = nextPart?.partId ?? null;
        setHoveredPart(nextPart);
      }
    }

    if (t - lastLedUpdate.current < 0.12) return;
    lastLedUpdate.current = t;

    for (let i = 0; i < ledRefs.current.length; i++) {
      const handle = ledRefs.current[i];
      if (!handle) continue;
      const { phase, speed } = phases[i];
      const on = Math.sin(t * speed + phase) > 0;
      const material = handle.material as MeshStandardMaterial;
      if (on) material.emissive.setRGB(0.1, 1.0, 0.3);
      else material.emissive.setRGB(0.25, 0.03, 0.03);
    }
  });

  return (
    <group>
      {RACKS.map((rack, i) => (
        <RackUnit
          key={rack.id}
          activePartId={hoveredRackId === rack.id ? hoveredPart?.partId ?? null : null}
          exploded={explodedRackId === rack.id}
          frontTex={frontTex}
          hovered={hoveredRackId === rack.id}
          ledRef={(el) => {
            ledRefs.current[i] = el;
          }}
          rack={rack}
          rackRef={(el) => {
            rackRefs.current[i] = el;
          }}
        />
      ))}
    </group>
  );
}
