import { CanvasTexture, SRGBColorSpace, type Texture } from "three";

/**
 * Procedurally paints a 19" rack front face onto a canvas and returns it as a
 * texture. Rows of server units, blanking panels, vent slits, handles and a
 * few baked status dots — gives the flat front panel real surface detail
 * without any external image asset.
 *
 * Client-only (uses <canvas>). Call once and memoize.
 */
export function createRackFrontTexture(): Texture {
  const w = 256;
  const h = 768; // tall, matches the rack's portrait aspect
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Base panel
  ctx.fillStyle = "#30343c";
  ctx.fillRect(0, 0, w, h);

  const margin = 10;
  const innerW = w - margin * 2;
  let y = margin;

  // A pseudo-random but stable sequence so every rack looks the same.
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const drawVents = (vx: number, vy: number, vw: number, vh: number) => {
    ctx.fillStyle = "#15171b";
    const slit = 2;
    for (let sx = vx; sx < vx + vw; sx += slit * 2) {
      ctx.fillRect(sx, vy, slit, vh);
    }
  };

  while (y < h - margin) {
    const r = rand();
    if (r < 0.18) {
      // Blanking panel — flat darker filler
      const uh = 18 + rand() * 16;
      ctx.fillStyle = "#272a31";
      ctx.fillRect(margin, y, innerW, uh);
      ctx.strokeStyle = "#1b1d22";
      ctx.lineWidth = 1;
      ctx.strokeRect(margin + 0.5, y + 0.5, innerW - 1, uh - 1);
      y += uh + 3;
    } else {
      // Server unit (1U-3U)
      const units = 1 + Math.floor(rand() * 3);
      const uh = units * (22 + rand() * 6);
      // Face plate
      const g = 58 + Math.floor(rand() * 26);
      ctx.fillStyle = `rgb(${g},${g + 4},${g + 10})`;
      ctx.fillRect(margin, y, innerW, uh);
      // Top/bottom edge shading
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(margin, y + uh - 2, innerW, 2);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(margin, y, innerW, 1);

      // Left handle / mounting ears
      ctx.fillStyle = "#1f2228";
      ctx.fillRect(margin + 2, y + 3, 8, uh - 6);
      ctx.fillRect(margin + innerW - 10, y + 3, 8, uh - 6);

      // Central vent block
      drawVents(margin + 24, y + 4, innerW - 70, uh - 8);

      // Status dots
      const dotY = y + uh / 2;
      const colors = ["#2bd24a", "#2bd24a", "#37c0ff", "#ffb02e", "#ff3b3b"];
      for (let d = 0; d < 2 + Math.floor(rand() * 2); d++) {
        ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
        ctx.beginPath();
        ctx.arc(margin + innerW - 22 + d * 0, dotY - 6 + d * 7, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      y += uh + 3;
    }
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
