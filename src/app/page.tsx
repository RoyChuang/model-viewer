"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useCallback, useEffect, type ChangeEvent } from "react";
import {
  AlertCircle,
  Boxes,
  Camera,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Upload,
  Zap,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AnimationPanel } from "@/components/viewer/AnimationPanel";
import { LightingPanel } from "@/components/viewer/LightingPanel";
import { parseViewerModelsConfig } from "@/lib/modelConfigs";
import { useRemoteConfig } from "@/lib/useRemoteConfig";
import { useSecureModel } from "@/lib/useSecureModel";

// Dynamically import the heavy 3D viewer (no SSR)
const ModelViewer = dynamic(
  () => import("@/components/viewer/ModelViewer").then((m) => m.ModelViewer),
  { ssr: false }
);

export default function Home() {
  const [configReloadKey, setConfigReloadKey] = useState(0);
  const modelsConfig = useRemoteConfig(
    `/config/viewer-models.json?v=${configReloadKey}`,
    parseViewerModelsConfig
  );
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [animations, setAnimations] = useState<string[]>([]);
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animSpeed, setAnimSpeed] = useState(1);
  const [lightPreset, setLightPreset] = useState<"studio" | "outdoor" | "night">("studio");
  const [lightIntensity, setLightIntensity] = useState(1.5);
  const [showGrid, setShowGrid] = useState(true);
  const [showShadows, setShowShadows] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadModelId, setUploadModelId] = useState("");
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadState, setUploadState] = useState<
    | { status: "idle" }
    | { status: "uploading" }
    | { status: "success"; message: string }
    | { status: "error"; message: string }
  >({ status: "idle" });

  const modelState = useSecureModel(selectedModelId);
  const models = modelsConfig.status === "ready" ? modelsConfig.data : [];

  useEffect(() => {
    if (
      selectedModelId &&
      modelsConfig.status === "ready" &&
      !modelsConfig.data.some((model) => model.id === selectedModelId)
    ) {
      setSelectedModelId(null);
      setAnimations([]);
      setCurrentAnimation(null);
      setIsPlaying(false);
    }
  }, [modelsConfig, selectedModelId]);

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

  const handleUploadFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    setUploadFile(file);
    setUploadState({ status: "idle" });

    if (!file) return;

    const inferredId = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!uploadModelId) setUploadModelId(inferredId);
    if (!uploadLabel) setUploadLabel(inferredId);
  };

  const handleUpload = async () => {
    if (!uploadFile || uploadState.status === "uploading") return;

    setUploadState({ status: "uploading" });

    const form = new FormData();
    form.set("file", uploadFile);
    form.set("modelId", uploadModelId);
    form.set("label", uploadLabel);

    try {
      const res = await fetch("/api/models/upload", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as
        | { id: string; label: string }
        | { error?: string };

      if (!res.ok || !("id" in json)) {
        throw new Error("error" in json && json.error ? json.error : "Upload failed");
      }

      setUploadState({ status: "success", message: `已加密 ${json.id}` });
      setSelectedModelId(json.id);
      setAnimations([]);
      setCurrentAnimation(null);
      setIsPlaying(false);
      setConfigReloadKey((key) => key + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUploadState({ status: "error", message });
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">3D Model Viewer</span>
            </div>
            <Link
              href="/lab"
              title="實驗場景"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Lab
            </Link>
          </div>
        </div>

        {/* Model list */}
        <div className="p-3 border-b border-border">
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">模型</p>
          <div className="space-y-1">
            {modelsConfig.status === "loading" && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                載入模型清單
              </div>
            )}
            {modelsConfig.status === "error" && (
              <div className="flex items-start gap-2 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="break-words">{modelsConfig.message}</span>
              </div>
            )}
            {models.map((m) => (
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

        {/* Upload */}
        <div className="border-b border-border p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Upload className="h-3.5 w-3.5" />
            上傳加密
          </div>
          <div className="space-y-2">
            <label className="block cursor-pointer rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
              <input
                type="file"
                accept=".glb,model/gltf-binary"
                className="sr-only"
                onChange={handleUploadFileChange}
              />
              <span className="block truncate">
                {uploadFile ? uploadFile.name : "選擇 .glb 檔案"}
              </span>
            </label>
            <input
              value={uploadModelId}
              onChange={(event) => setUploadModelId(event.currentTarget.value)}
              placeholder="model id"
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
            />
            <input
              value={uploadLabel}
              onChange={(event) => setUploadLabel(event.currentTarget.value)}
              placeholder="顯示名稱"
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={!uploadFile || uploadState.status === "uploading"}
              onClick={handleUpload}
              className="flex h-8 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
            >
              {uploadState.status === "uploading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploadState.status === "uploading" ? "加密中" : "上傳並加密"}
            </button>
            {uploadState.status === "success" && (
              <div className="flex items-center gap-1.5 text-xs text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{uploadState.message}</span>
              </div>
            )}
            {uploadState.status === "error" && (
              <div className="flex items-start gap-1.5 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="break-words">{uploadState.message}</span>
              </div>
            )}
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
            <p className="text-sm">
              正在{modelState.stage ?? "解密並載入模型"} {Math.round(modelState.progress)}%
            </p>
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
