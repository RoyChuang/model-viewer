"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import { Boxes, Zap, Camera, Loader2, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AnimationPanel } from "@/components/viewer/AnimationPanel";
import { LightingPanel } from "@/components/viewer/LightingPanel";
import { useSecureModel } from "@/lib/useSecureModel";

// Dynamically import the heavy 3D viewer (no SSR)
const ModelViewer = dynamic(
  () => import("@/components/viewer/ModelViewer").then((m) => m.ModelViewer),
  { ssr: false }
);

const DEMO_MODELS = [
  { id: "duck",   label: "Duck (~120 KB)" },
  { id: "fox",    label: "Fox (~163 KB, 動畫)" },
  { id: "helmet", label: "Damaged Helmet (~3.7 MB)" },
];

export default function Home() {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [animations, setAnimations] = useState<string[]>([]);
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animSpeed, setAnimSpeed] = useState(1);
  const [lightPreset, setLightPreset] = useState<"studio" | "outdoor" | "night">("studio");
  const [lightIntensity, setLightIntensity] = useState(1.5);
  const [showGrid, setShowGrid] = useState(true);
  const [showShadows, setShowShadows] = useState(true);

  const modelState = useSecureModel(selectedModelId);

  const handleAnimationsLoaded = useCallback((names: string[]) => {
    setAnimations(names);
    if (names.length > 0) {
      setCurrentAnimation(names[0]);
      setIsPlaying(true);
    }
  }, []);

  const handleSelectAnimation = (name: string | null) => {
    setCurrentAnimation(name);
    setIsPlaying(name !== null);
  };

  const handleTogglePlay = () => {
    if (!currentAnimation) return;
    setIsPlaying((p) => !p);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentAnimation(null);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">3D Model Viewer</span>
          </div>
        </div>

        {/* Model list */}
        <div className="p-3 border-b border-border">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">模型</p>
          <div className="space-y-1">
            {DEMO_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setSelectedModelId(m.id);
                  setAnimations([]);
                  setCurrentAnimation(null);
                  setIsPlaying(false);
                }}
                className={`w-full text-left text-xs px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${
                  selectedModelId === m.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
              >
                <Boxes className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Control tabs */}
        <div className="flex-1 overflow-auto p-3">
          <Tabs defaultValue="animation">
            <TabsList className="w-full h-8 mb-3">
              <TabsTrigger value="animation" className="flex-1 text-xs gap-1">
                <Zap className="h-3 w-3" />
                動畫
              </TabsTrigger>
              <TabsTrigger value="lighting" className="flex-1 text-xs gap-1">
                <Camera className="h-3 w-3" />
                燈光
              </TabsTrigger>
            </TabsList>

            <TabsContent value="animation">
              <AnimationPanel
                animations={animations}
                currentAnimation={currentAnimation}
                isPlaying={isPlaying}
                speed={animSpeed}
                onSelect={handleSelectAnimation}
                onTogglePlay={handleTogglePlay}
                onStop={handleStop}
                onSpeedChange={setAnimSpeed}
              />
            </TabsContent>

            <TabsContent value="lighting">
              <LightingPanel
                lightPreset={lightPreset}
                lightIntensity={lightIntensity}
                showGrid={showGrid}
                showShadows={showShadows}
                onPresetChange={setLightPreset}
                onIntensityChange={setLightIntensity}
                onToggleGrid={() => setShowGrid((v) => !v)}
                onToggleShadows={() => setShowShadows((v) => !v)}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer status */}
        <div className="p-3 border-t border-border">
          {modelState.status === "loading" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              解密中…
            </div>
          )}
          {modelState.status === "ready" && (
            <Badge variant="outline" className="text-xs w-full justify-center text-green-500 border-green-500/30">
              已載入
            </Badge>
          )}
          {modelState.status === "error" && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{modelState.message}</span>
            </div>
          )}
          {modelState.status === "idle" && (
            <p className="text-xs text-muted-foreground text-center">選擇模型以開始</p>
          )}
        </div>
      </aside>

      {/* Main canvas area */}
      <main className="flex-1 relative">
        {modelState.status === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Boxes className="h-16 w-16 opacity-20" />
            <p className="text-sm">從左側選擇一個 3D 模型</p>
          </div>
        )}

        {modelState.status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="text-sm">正在解密並載入模型…</p>
          </div>
        )}

        {modelState.status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-destructive">
            <AlertCircle className="h-10 w-10" />
            <p className="text-sm">{modelState.message}</p>
          </div>
        )}

        {modelState.status === "ready" && (
          <ModelViewer
            url={modelState.blobUrl}
            currentAnimation={currentAnimation}
            isPlaying={isPlaying}
            animationSpeed={animSpeed}
            onAnimationsLoaded={handleAnimationsLoaded}
            lightPreset={lightPreset}
            lightIntensity={lightIntensity}
            showGrid={showGrid}
            showShadows={showShadows}
          />
        )}
      </main>
    </div>
  );
}
