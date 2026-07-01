"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
} from "three";
import { ROOM } from "./layout";

const FLOOR_REPEAT = {
  x: ROOM.width / 2,
  y: ROOM.depth / 2,
};

const NORMAL_SCALE = new Vector2(0.42, 0.42);

const FLOOR_MATERIAL_PATHS = {
  color: "/materials/lab/floor/DiamondPlate006D_1K-JPG_Color.jpg",
  metalness: "/materials/lab/floor/DiamondPlate006D_1K-JPG_Metalness.jpg",
  normal: "/materials/lab/floor/DiamondPlate006D_1K-JPG_NormalGL.jpg",
  roughness: "/materials/lab/floor/DiamondPlate006D_1K-JPG_Roughness.jpg",
};

interface FloorMaps {
  color?: Texture;
  metalness?: Texture;
  normal?: Texture;
  roughness?: Texture;
}

function configureTexture(texture: Texture, isColor = false) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(FLOOR_REPEAT.x, FLOOR_REPEAT.y);
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  if (isColor) texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function loadOptionalTexture(url: string, isColor = false) {
  return new Promise<Texture | undefined>((resolve) => {
    new TextureLoader().load(
      url,
      (texture) => resolve(configureTexture(texture, isColor)),
      undefined,
      () => resolve(undefined)
    );
  });
}

export function FloorMaterial() {
  const [maps, setMaps] = useState<FloorMaps | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadOptionalTexture(FLOOR_MATERIAL_PATHS.color, true),
      loadOptionalTexture(FLOOR_MATERIAL_PATHS.normal),
      loadOptionalTexture(FLOOR_MATERIAL_PATHS.roughness),
      loadOptionalTexture(FLOOR_MATERIAL_PATHS.metalness),
    ]).then(([color, normal, roughness, metalness]) => {
      if (cancelled) {
        color?.dispose();
        normal?.dispose();
        roughness?.dispose();
        metalness?.dispose();
        return;
      }

      setMaps({ color, metalness, normal, roughness });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      maps?.color?.dispose();
      maps?.normal?.dispose();
      maps?.roughness?.dispose();
      maps?.metalness?.dispose();
    };
  }, [maps]);

  const hasExternalColor = Boolean(maps?.color);

  const fallbackMaterial = useMemo(
    () => ({
      color: "#56616c",
      metalness: 0.35,
      roughness: 0.58,
    }),
    []
  );

  return (
    <meshStandardMaterial
      color={hasExternalColor ? "#b8c0c8" : fallbackMaterial.color}
      map={maps?.color}
      metalness={hasExternalColor ? 0.62 : fallbackMaterial.metalness}
      metalnessMap={maps?.metalness}
      normalMap={maps?.normal}
      normalScale={NORMAL_SCALE}
      roughness={hasExternalColor ? 0.5 : fallbackMaterial.roughness}
      roughnessMap={maps?.roughness}
    />
  );
}
