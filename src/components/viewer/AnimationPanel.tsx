"use client";

import { Play, Pause, Square, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AnimationPanelProps {
  animations: string[];
  currentAnimation: string | null;
  isPlaying: boolean;
  speed: number;
  onSelect: (name: string | null) => void;
  onTogglePlay: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
}

export function AnimationPanel({
  animations,
  currentAnimation,
  isPlaying,
  speed,
  onSelect,
  onTogglePlay,
  onStop,
  onSpeedChange,
}: AnimationPanelProps) {
  const currentIndex = animations.indexOf(currentAnimation ?? "");

  const handlePrev = () => {
    if (animations.length === 0) return;
    const idx = currentIndex <= 0 ? animations.length - 1 : currentIndex - 1;
    onSelect(animations[idx]);
  };

  const handleNext = () => {
    if (animations.length === 0) return;
    const idx = currentIndex >= animations.length - 1 ? 0 : currentIndex + 1;
    onSelect(animations[idx]);
  };

  if (animations.length === 0) {
    return (
      <div className="text-xs text-muted-foreground px-1">
        此模型沒有動畫
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Clip list */}
      <ScrollArea className="h-28 rounded border border-border">
        <div className="p-1 space-y-0.5">
          {animations.map((name) => (
            <button
              key={name}
              onClick={() => onSelect(name)}
              className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors truncate ${
                currentAnimation === name
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </ScrollArea>

      <Separator />

      {/* Transport controls */}
      <div className="flex items-center gap-1 justify-center">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            }
          />
          <TooltipContent>上一個</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={isPlaying ? "default" : "outline"}
                size="icon"
                className="h-7 w-7"
                onClick={onTogglePlay}
                disabled={!currentAnimation}
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
            }
          />
          <TooltipContent>{isPlaying ? "暫停" : "播放"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onStop}
                disabled={!currentAnimation}
              >
                <Square className="h-3 w-3" />
              </Button>
            }
          />
          <TooltipContent>停止</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            }
          />
          <TooltipContent>下一個</TooltipContent>
        </Tooltip>
      </div>

      {currentAnimation && (
        <Badge variant="secondary" className="text-xs w-full justify-center truncate">
          {currentAnimation}
        </Badge>
      )}

      {/* Speed */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>速度</span>
          <span>{speed.toFixed(1)}x</span>
        </div>
        <Slider
          min={0.1}
          max={3}
          step={0.1}
          value={[speed]}
          onValueChange={(v) => onSpeedChange(Array.isArray(v) ? v[0] : v)}
        />
      </div>
    </div>
  );
}
