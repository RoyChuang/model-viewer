/**
 * Single source of truth for the datacenter floor plan.
 *
 * Both the 3D scene and the 2D minimap read from here so they never drift.
 * All units are meters. The room is centered on the origin: X spans
 * [-ROOM.width/2, +ROOM.width/2], Z spans [-ROOM.depth/2, +ROOM.depth/2].
 *
 * Procedurally generated for now. When the encryption pipeline is wired in,
 * this layout (and per-object metadata) is what would be encrypted/streamed.
 */

export const ROOM = {
  width: 12, // X
  depth: 8, // Z
  height: 3, // Y
  wallThickness: 0.15,
} as const;

export const RACK = {
  width: 0.6, // X
  depth: 1.0, // Z
  height: 2.0, // Y
} as const;

export interface RackInstance {
  id: string;
  x: number;
  z: number;
  /** Y rotation in radians — racks face the cold aisle (toward z=0). */
  rotationY: number;
}

/**
 * Two rows of racks in a hot/cold-aisle arrangement, facing each other
 * across the center aisle (z = 0).
 */
function buildRacks(): RackInstance[] {
  const racks: RackInstance[] = [];
  const perRow = 10;
  const spacing = 0.7; // center-to-center along X
  const rowZ = 1.5; // distance of each row from the aisle center
  const startX = -((perRow - 1) * spacing) / 2;

  const rows: { z: number; rot: number; tag: string }[] = [
    { z: -rowZ, rot: 0, tag: "A" }, // back row, faces +z (toward aisle)
    { z: rowZ, rot: Math.PI, tag: "B" }, // front row, faces -z (toward aisle)
  ];

  for (const row of rows) {
    for (let i = 0; i < perRow; i++) {
      racks.push({
        id: `${row.tag}${String(i + 1).padStart(2, "0")}`,
        x: startX + i * spacing,
        z: row.z,
        rotationY: row.rot,
      });
    }
  }
  return racks;
}

export const RACKS: RackInstance[] = buildRacks();

/** Axis-aligned footprints (half-extents) used for player collision. */
export interface Obstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const RACK_OBSTACLES: Obstacle[] = RACKS.map((r) => ({
  minX: r.x - RACK.width / 2,
  maxX: r.x + RACK.width / 2,
  minZ: r.z - RACK.depth / 2,
  maxZ: r.z + RACK.depth / 2,
}));

/** Player eye height and collision radius. */
export const PLAYER = {
  eyeHeight: 1.6,
  radius: 0.3,
  speed: 3.0, // m/s
} as const;
