"use client";

import { useEffect, useSyncExternalStore } from "react";
import { loadPlayer, subscribePlayer } from "@/lib/player";
import { applyTheme } from "@/lib/themes";

/** Applies the player's chosen color theme on every page, and again whenever they change it. */
export function ThemeApplier() {
  const theme = useSyncExternalStore(
    subscribePlayer,
    () => loadPlayer().theme,
    () => "neon",
  );
  useEffect(() => applyTheme(theme), [theme]);
  return null;
}
