"use client";

import { Sun, Moon, Layers, Grid3X3, Cloud } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type LightPreset = "studio" | "outdoor" | "night";

interface LightingPanelProps {
  lightPreset: LightPreset;
  lightIntensity: number;
  showGrid: boolean;
  showShadows: boolean;
  onPresetChange: (preset: LightPreset) => void;
  onIntensityChange: (v: number) => void;
  onToggleGrid: () => void;
  onToggleShadows: () => void;
}

const PRESETS: { value: LightPreset; label: string; icon: React.ReactNode }[] = [
  { value: "studio", label: "Studio", icon: <Layers className="h-3.5 w-3.5" /> },
  { value: "outdoor", label: "戶外", icon: <Sun className="h-3.5 w-3.5" /> },
  { value: "night", label: "夜間", icon: <Moon className="h-3.5 w-3.5" /> },
];

export function LightingPanel({
  lightPreset,
  lightIntensity,
  showGrid,
  showShadows,
  onPresetChange,
  onIntensityChange,
  onToggleGrid,
  onToggleShadows,
}: LightingPanelProps) {
  return (
    <div className="space-y-3">
      {/* Presets */}
      <div className="grid grid-cols-3 gap-1">
        {PRESETS.map(({ value, label, icon }) => (
          <Tooltip key={value}>
            <TooltipTrigger
              render={
                <button
                  onClick={() => onPresetChange(value)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 rounded text-xs transition-colors",
                    lightPreset === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent hover:bg-accent/80 text-accent-foreground"
                  )}
                >
                  {icon}
                  {label}
                </button>
              }
            />
            <TooltipContent>{label} 光源</TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Intensity */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>亮度</span>
          <span>{lightIntensity.toFixed(1)}</span>
        </div>
        <Slider
          min={0}
          max={5}
          step={0.1}
          value={[lightIntensity]}
          onValueChange={(v) => onIntensityChange(Array.isArray(v) ? v[0] : v)}
        />
      </div>

      <Separator />

      {/* Toggles */}
      <div className="space-y-1">
        <ToggleRow
          label="網格"
          icon={<Grid3X3 className="h-3.5 w-3.5" />}
          active={showGrid}
          onToggle={onToggleGrid}
        />
        <ToggleRow
          label="陰影"
          icon={<Cloud className="h-3.5 w-3.5" />}
          active={showShadows}
          onToggle={onToggleShadows}
        />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  icon,
  active,
  onToggle,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors",
        active ? "bg-primary/20 text-primary" : "hover:bg-accent text-muted-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
      <div
        className={cn(
          "ml-auto w-6 h-3 rounded-full transition-colors relative",
          active ? "bg-primary" : "bg-muted"
        )}
      >
        <div
          className={cn(
            "absolute top-0.5 w-2 h-2 rounded-full bg-white transition-transform",
            active ? "translate-x-3.5" : "translate-x-0.5"
          )}
        />
      </div>
    </button>
  );
}
