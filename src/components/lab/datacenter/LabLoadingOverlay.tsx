"use client";

interface LabLoadingOverlayProps {
  hidden?: boolean;
  stage?: string;
}

export function LabLoadingOverlay({
  hidden = false,
  stage = "建立機房場景",
}: LabLoadingOverlayProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 transition-opacity duration-300 ${
        hidden ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden={hidden}
    >
      <div className="w-56 rounded-md border border-cyan-100/20 bg-slate-950/85 px-4 py-3 text-center text-white/90 shadow-xl shadow-black/30 backdrop-blur">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan-100/20 border-t-cyan-200" />
        <p className="text-sm font-semibold">載入機房</p>
        <p className="mt-1 text-xs text-white/55">{stage}</p>
      </div>
    </div>
  );
}
