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

const NORMAL_SCALE = new Vector2(0.22, 0.22);

const WALL_MATERIAL_PATHS = {
  color: "/materials/lab/wall/Tiles001_1K-JPG_Color.jpg",
  normal: "/materials/lab/wall/Tiles001_1K-JPG_NormalGL.jpg",
  roughness: "/materials/lab/wall/Tiles001_1K-JPG_Roughness.jpg",
};

interface WallMaps {
  color?: Texture;
  normal?: Texture;
  roughness?: Texture;
}

interface WallMaterialProps {
  repeatX: number;
  repeatY: number;
}

function configureTexture(texture: Texture, repeatX: number, repeatY: number, isColor = false) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  if (isColor) texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function loadOptionalTexture(url: string, repeatX: number, repeatY: number, isColor = false) {
  return new Promise<Texture | undefined>((resolve) => {
    new TextureLoader().load(
      url,
      (texture) => resolve(configureTexture(texture, repeatX, repeatY, isColor)),
      undefined,
      () => resolve(undefined)
    );
  });
}

export function WallMaterial({ repeatX, repeatY }: WallMaterialProps) {
  const [maps, setMaps] = useState<WallMaps | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadOptionalTexture(WALL_MATERIAL_PATHS.color, repeatX, repeatY, true),
      loadOptionalTexture(WALL_MATERIAL_PATHS.normal, repeatX, repeatY),
      loadOptionalTexture(WALL_MATERIAL_PATHS.roughness, repeatX, repeatY),
    ]).then(([color, normal, roughness]) => {
      if (cancelled) {
        color?.dispose();
        normal?.dispose();
        roughness?.dispose();
        return;
      }

      setMaps({ color, normal, roughness });
    });

    return () => {
      cancelled = true;
    };
  }, [repeatX, repeatY]);

  useEffect(() => {
    return () => {
      maps?.color?.dispose();
      maps?.normal?.dispose();
      maps?.roughness?.dispose();
    };
  }, [maps]);

  const fallbackMaterial = useMemo(
    () => ({
      color: "#535a66",
      roughness: 0.9,
    }),
    []
  );

  const hasExternalColor = Boolean(maps?.color);

  return (
    <meshStandardMaterial
      color={hasExternalColor ? "#b9c2cf" : fallbackMaterial.color}
      map={maps?.color}
      normalMap={maps?.normal}
      normalScale={NORMAL_SCALE}
      roughness={hasExternalColor ? 0.82 : fallbackMaterial.roughness}
      roughnessMap={maps?.roughness}
    />
  );
}
