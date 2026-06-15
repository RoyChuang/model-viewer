/**
 * Mutable, ref-shared player pose written by the FPS controls (inside the
 * Canvas, every frame) and read by the minimap (a DOM overlay outside the
 * Canvas). Using a plain mutable object avoids a React re-render per frame.
 */
export interface PlayerPose {
  x: number;
  z: number;
  /** Heading in radians, measured like atan2(dirX, dirZ) for top-down use. */
  angle: number;
}

export function createPlayerPose(): PlayerPose {
  return { x: 0, z: 0, angle: 0 };
}
