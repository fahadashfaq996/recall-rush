import type { ColorName } from "@recall/engine";

export const COLOR_HEX: Record<ColorName, string> = {
  red: "#ff3d5e",
  green: "#3dff8a",
  blue: "#4d7cff",
  yellow: "#ffd93d",
  purple: "#b44dff",
  cyan: "#22e6ff",
};

/** Layered glow for a neon element in the given color. */
export function glow(hex: string, strength = 1): string {
  return `0 0 ${10 * strength}px ${hex}, 0 0 ${30 * strength}px ${hex}aa, 0 0 ${70 * strength}px ${hex}55`;
}
