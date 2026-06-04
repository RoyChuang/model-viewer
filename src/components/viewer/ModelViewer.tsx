"use client";

import { Suspense, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, Html, useProgress } from "@react-three/drei";
import { Loader2 } from "lucide-react";
import { ModelScene } from "./ModelScene";

function LoadingFallback() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="text-sm">{Math.round(progress)}%</span>
      </div>
    </Html>
  );
}

interface ModelViewerProps {
  url: string;
  currentAnimation: string | null;
  isPlaying: boolean;
  animationSpeed: number;
  onAnimationsLoaded: (names: string[]) => void;
  lightPreset: "studio" | "outdoor" | "night";
  lightIntensity: number;
  showGrid: boolean;
  showShadows: boolean;
}

export function ModelViewer({
  url,
  currentAnimation,
  isPlaying,
  animationSpeed,
  onAnimationsLoaded,
  lightPreset,
  lightIntensity,
  showGrid,
  showShadows,
}: ModelViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbitRef = useRef<{ reset: () => void } | null>(null);

  useEffect(() => {
    orbitRef.current?.reset();
  }, [url]);

  // Disable right-click context menu on canvas to hinder basic devtools tricks
  const handleContextMenu = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div
      className="w-full h-full relative select-none"
      onContextMenu={handleContextMenu}
    >
      <Canvas
        ref={canvasRef}
        shadows={showShadows}
        gl={{ preserveDrawingBuffer: false, antialias: true }}
        className="w-full h-full"
        style={{ background: "radial-gradient(ellipse at center, #1a1a2e 0%, #0d0d0d 100%)" }}
      >
        <PerspectiveCamera makeDefault position={[0, 1.5, 4]} fov={45} />
        <OrbitControls
          ref={orbitRef}
          enablePan
          enableZoom
          enableRotate
          minDistance={0.5}
          maxDistance={20}
          makeDefault
        />
        {/* Environment must be outside the model's Suspense to avoid setState-during-render */}
        <Suspense fallback={null}>
          <Environment
            preset={lightPreset === "outdoor" ? "sunset" : lightPreset === "night" ? "night" : "studio"}
            background={false}
          />
        </Suspense>

        <Suspense fallback={<LoadingFallback />}>
          <ModelScene
            key={url}
            url={url}
            currentAnimation={isPlaying ? currentAnimation : null}
            animationSpeed={animationSpeed}
            onAnimationsLoaded={onAnimationsLoaded}
            lightIntensity={lightIntensity}
            showGrid={showGrid}
            showShadows={showShadows}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
