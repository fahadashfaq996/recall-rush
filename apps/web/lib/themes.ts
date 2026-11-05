/** Color themes, unlocked by player level. Each overrides the neon palette's CSS variables. */
export interface Theme {
  id: string;
  name: string;
  level: number;
  /** Swatch colors for previews: background, primary, accent. */
  swatch: [string, string, string];
  vars: Record<string, string>;
}

export const THEMES: readonly Theme[] = [
  { id: "neon", name: "Neon Night", level: 1, swatch: ["#06061a", "#22e6ff", "#ff2bd6"], vars: {} },
  {
    id: "sunset",
    name: "Sunset Drive",
    level: 3,
    swatch: ["#1a0712", "#ffb347", "#ff4f81"],
    vars: { "--bg": "#1a0712", "--bg-2": "#2b0a1d", "--cyan": "#ffb347", "--magenta": "#ff4f81", "--violet": "#ff7a45" },
  },
  {
    id: "toxic",
    name: "Toxic",
    level: 5,
    swatch: ["#03120a", "#b6ff3b", "#00ffa3"],
    vars: { "--bg": "#03120a", "--bg-2": "#072015", "--cyan": "#b6ff3b", "--magenta": "#00ffa3", "--violet": "#3bff8f" },
  },
  {
    id: "ice",
    name: "Ice Cave",
    level: 8,
    swatch: ["#050b1a", "#9ee8ff", "#7aa8ff"],
    vars: { "--bg": "#050b1a", "--bg-2": "#0a1630", "--cyan": "#9ee8ff", "--magenta": "#7aa8ff", "--violet": "#b3c7ff" },
  },
  {
    id: "gold",
    name: "Gold Rush",
    level: 12,
    swatch: ["#120d02", "#ffd84d", "#ff9f1c"],
    vars: { "--bg": "#120d02", "--bg-2": "#211704", "--cyan": "#ffd84d", "--magenta": "#ff9f1c", "--violet": "#ffcf6b" },
  },
  {
    id: "void",
    name: "Void",
    level: 16,
    swatch: ["#000000", "#ffffff", "#a78bfa"],
    vars: { "--bg": "#000000", "--bg-2": "#07040f", "--cyan": "#ffffff", "--magenta": "#a78bfa", "--violet": "#6d28d9" },
  },
  {
    id: "synth",
    name: "Synth Heart",
    level: 20,
    swatch: ["#12001f", "#ff6ad5", "#8c1eff"],
    vars: { "--bg": "#12001f", "--bg-2": "#1e0033", "--cyan": "#ff6ad5", "--magenta": "#8c1eff", "--violet": "#ff2975" },
  },
];

const ALL_VARS = [...new Set(THEMES.flatMap((t) => Object.keys(t.vars)))];

/** Applies a theme to the page by overriding CSS variables on <html>. */
export function applyTheme(id: string) {
  if (typeof document === "undefined") return;
  const theme = THEMES.find((t) => t.id === id) ?? THEMES[0]!;
  const root = document.documentElement;
  for (const v of ALL_VARS) root.style.removeProperty(v);
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);
  root.dataset.theme = theme.id;
}

export const themesUnlockedBetween = (fromLevel: number, toLevel: number) =>
  THEMES.filter((t) => t.level > fromLevel && t.level <= toLevel);

/**
 * Inline script for <head>: applies the saved theme before the first paint, so returning players never see a
 * flash of the default palette. Mirrors applyTheme and the player storage key.
 */
export function themeBootScript(): string {
  const vars = Object.fromEntries(THEMES.map((t) => [t.id, t.vars]));
  return `try{var p=JSON.parse(localStorage.getItem("recall-rush:v1")||"{}");var v=${JSON.stringify(vars)}[p.theme];if(v){for(var k in v)document.documentElement.style.setProperty(k,v[k]);document.documentElement.dataset.theme=p.theme}}catch(e){}`;
}
