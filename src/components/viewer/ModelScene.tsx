"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, ContactShadows, Grid } from "@react-three/drei";
import * as THREE from "three";

interface ModelSceneProps {
  url: string;
  currentAnimation: string | null;
  animationSpeed: number;
  onAnimationsLoaded: (names: string[]) => void;
  lightIntensity: number;
  showGrid: boolean;
  showShadows: boolean;
}

export function ModelScene({
  url,
  currentAnimation,
  animationSpeed,
  onAnimationsLoaded,
  lightIntensity,
  showGrid,
  showShadows,
}: ModelSceneProps) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, group);
  const reportedRef = useRef(false);

  // Center and scale the model to fit viewport
  useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;
    scene.scale.setScalar(scale);
    scene.position.sub(center.multiplyScalar(scale));
  }, [scene]);

  // Report animations once
  useEffect(() => {
    if (names.length > 0 && !reportedRef.current) {
      reportedRef.current = true;
      onAnimationsLoaded(names);
    }
  }, [names, onAnimationsLoaded]);

  // Play / stop animation
  useEffect(() => {
    Object.values(actions).forEach((a) => a?.stop());
    if (currentAnimation && actions[currentAnimation]) {
      const action = actions[currentAnimation]!;
      action.reset().play();
      action.timeScale = animationSpeed;
    }
  }, [currentAnimation, actions, animationSpeed]);

  // Keep timeScale in sync while playing
  useFrame(() => {
    if (currentAnimation && actions[currentAnimation]) {
      actions[currentAnimation]!.timeScale = animationSpeed;
    }
  });

  return (
    <>
      <ambientLight intensity={lightIntensity * 0.4} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={lightIntensity}
        castShadow={showShadows}
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-5, 5, -5]} intensity={lightIntensity * 0.3} />

      <group ref={group}>
        <primitive object={scene} />
      </group>

      {showShadows && (
        <ContactShadows
          position={[0, -1, 0]}
          opacity={0.5}
          scale={10}
          blur={2}
          far={4}
        />
      )}

      {showGrid && (
        <Grid
          position={[0, -1, 0]}
          args={[20, 20]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#444"
          sectionSize={2}
          sectionThickness={1}
          sectionColor="#666"
          fadeDistance={15}
          fadeStrength={1}
          infiniteGrid
        />
      )}
    </>
  );
}
