"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from "three";
import { RACK, type RackInstance } from "./layout";

const TRAY_COUNT = 7;

const EMISSIVE = {
  none: new Color("#000000"),
  panel: new Color("#8fdcff"),
  host: new Color("#7ddcff"),
  powerActive: new Color("#ffd28a"),
  powerIdle: new Color("#5a2b0c"),
  coolingActive: new Color("#8bf4ff"),
  coolingIdle: new Color("#0c4356"),
};

interface GltfRackUnitProps {
  activePartId: string | null;
  exploded: boolean;
  hovered: boolean;
  ledRef: (el: Mesh | null) => void;
  modelUrl: string;
  modelRotationY?: number;
  rack: RackInstance;
  rackRef: (el: Group | null) => void;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function cloneObjectMaterials(object: Object3D) {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) => material.clone());
    } else {
      child.material = child.material.clone();
    }
  });
}

function meshMaterial(mesh: Mesh | null) {
  if (!mesh || Array.isArray(mesh.material)) return null;
  return mesh.material as MeshStandardMaterial;
}

function normalizeModelToRack(model: Object3D) {
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());

  if (size.x <= 0 || size.y <= 0 || size.z <= 0) return;

  const scale = Math.min(
    RACK.width / size.x,
    RACK.height / size.y,
    RACK.depth / size.z
  );
  model.scale.multiplyScalar(scale);

  const scaledBox = new Box3().setFromObject(model);
  const center = scaledBox.getCenter(new Vector3());
  model.position.x -= center.x;
  model.position.y -= scaledBox.min.y;
  model.position.z -= center.z;
}

export const GltfRackUnit = memo(function GltfRackUnit({
  activePartId,
  exploded,
  hovered,
  ledRef,
  modelRotationY = Math.PI,
  modelUrl,
  rack,
  rackRef,
}: GltfRackUnitProps) {
  const { scene } = useGLTF(modelUrl);
  const progress = useRef(0);

  const parts = useMemo(() => {
    const model = scene.clone(true);
    cloneObjectMaterials(model);
    normalizeModelToRack(model);
    model.rotation.y = modelRotationY;

    const frame = model.getObjectByName("rack_frame") as Mesh | undefined;
    const front = model.getObjectByName("front_panel") as Mesh | undefined;
    const power = model.getObjectByName("power_module") as Mesh | undefined;
    const cooling = model.getObjectByName("cooling_module") as Mesh | undefined;
    const led = model.getObjectByName("led_status") as Mesh | undefined;
    const trays = Array.from({ length: TRAY_COUNT }, (_, i) =>
      model.getObjectByName(`host_A${i + 1}`) as Mesh | undefined
    );

    if (front) {
      front.userData = {
        partId: `${rack.id}:panel`,
        partKind: "panel",
        partLabel: "前面板",
      };
    }

    for (let i = 0; i < trays.length; i++) {
      const tray = trays[i];
      if (!tray) continue;
      tray.visible = false;
      tray.userData = {
        hostId: `A${i + 1}`,
        partId: `${rack.id}:host:${i + 1}`,
        partKind: "host",
        partLabel: `主機 A${i + 1}`,
      };
    }

    if (power) {
      power.visible = false;
      power.userData = {
        partId: `${rack.id}:power`,
        partKind: "power",
        partLabel: "電源模組",
      };
    }

    if (cooling) {
      cooling.visible = false;
      cooling.userData = {
        partId: `${rack.id}:cooling`,
        partKind: "cooling",
        partLabel: "散熱模組",
      };
    }

    return {
      cooling: cooling ?? null,
      frame: frame ?? null,
      front: front ?? null,
      led: led ?? null,
      model,
      power: power ?? null,
      trays: trays.map((tray) => tray ?? null),
    };
  }, [modelRotationY, rack.id, scene]);

  useEffect(() => {
    ledRef(parts.led);
    return () => ledRef(null);
  }, [ledRef, parts.led]);

  useFrame((_, delta) => {
    const target = exploded ? 1 : 0;
    progress.current += (target - progress.current) * Math.min(1, delta * 7);
    if (!exploded && !hovered && progress.current < 0.001) return;

    const p = easeOutCubic(progress.current);
    const forward = RACK.depth / 2 + 0.045 + p * 1.14;
    const col = 0.36;

    const frameMat = meshMaterial(parts.frame);
    if (frameMat) {
      frameMat.opacity = 1 - p * 0.58;
      frameMat.transparent = true;
      frameMat.emissive.set("#4ea4ff");
      frameMat.emissiveIntensity = hovered || exploded ? 0.22 : 0;
    }

    if (parts.led) {
      parts.led.visible = p < 0.08;
    }

    if (parts.front) {
      parts.front.position.set(
        -p * 1.28,
        RACK.height / 2,
        RACK.depth / 2 + 0.011 + p * 1.24
      );
      parts.front.rotation.y = p * 0.72;
      const active = activePartId === `${rack.id}:panel`;
      const material = meshMaterial(parts.front);
      if (material) {
        material.emissive.copy(active ? EMISSIVE.panel : EMISSIVE.none);
        material.emissiveIntensity = active ? 0.35 : 0;
      }
    }

    for (let i = 0; i < parts.trays.length; i++) {
      const tray = parts.trays[i];
      if (!tray) continue;
      const active = activePartId === `${rack.id}:host:${i + 1}`;
      const even = i % 2 === 0;
      const colX = even ? -col : col;
      const explodedY = even ? 0.7 + (i / 2) * 0.2 : 0.5 + ((i - 1) / 2) * 0.2;
      const assembledY = 0.42 + i * 0.2;

      tray.visible = p > 0.025;
      tray.position.set(colX * p, assembledY + p * (explodedY - assembledY), forward);

      const material = meshMaterial(tray);
      if (material) {
        material.emissive.copy(active ? EMISSIVE.host : EMISSIVE.none);
        material.emissiveIntensity = active ? 0.42 : 0;
      }
    }

    if (parts.power) {
      const active = activePartId === `${rack.id}:power`;
      parts.power.visible = p > 0.025;
      parts.power.position.set(-col * p, 0.18 + p * (0.4 - 0.18), forward);
      const material = meshMaterial(parts.power);
      if (material) {
        material.emissive.copy(active ? EMISSIVE.powerActive : EMISSIVE.powerIdle);
        material.emissiveIntensity = active ? 0.7 : 0.35;
      }
    }

    if (parts.cooling) {
      const active = activePartId === `${rack.id}:cooling`;
      parts.cooling.visible = p > 0.025;
      parts.cooling.position.set(col * p, 1.76 + p * (1.2 - 1.76), forward);
      const material = meshMaterial(parts.cooling);
      if (material) {
        material.emissive.copy(active ? EMISSIVE.coolingActive : EMISSIVE.coolingIdle);
        material.emissiveIntensity = active ? 0.68 : 0.32;
      }
    }
  });

  return (
    <group
      ref={rackRef}
      name={`rack-${rack.id}-glb`}
      position={[rack.x, 0, rack.z]}
      rotation={[0, rack.rotationY, 0]}
      userData={{ rackId: rack.id }}
    >
      <primitive object={parts.model} />
    </group>
  );
});
