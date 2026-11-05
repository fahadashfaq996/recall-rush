let enabled = true;

export function setHaptics(on: boolean) {
  enabled = on;
}

export function buzz(pattern: number | number[]) {
  if (!enabled || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  // Browsers refuse (and log) vibration before the user has interacted with the page.
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (activation && !activation.hasBeenActive) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw when vibrate is called without a gesture; haptics are optional.
  }
}
