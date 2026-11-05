import type { ShapeKind, SymbolId } from "@recall/engine";
import type { CSSProperties } from "react";

export const SYMBOL_COLOR: Record<SymbolId, string> = {
  star: "#ffd93d",
  heart: "#ff3d7f",
  bolt: "#22e6ff",
  diamond: "#7cf6ff",
  moon: "#c9b8ff",
  skull: "#eef0ff",
  crown: "#ffc43d",
  flame: "#ff7a2b",
};

const SYMBOL_PATHS: Record<SymbolId, string> = {
  star: "M50 6 L62 38 L96 38 L68 58 L79 92 L50 71 L21 92 L32 58 L4 38 L38 38 Z",
  heart: "M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 21 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88 Z",
  bolt: "M58 4 L18 56 L46 56 L38 96 L82 40 L54 40 Z",
  diamond: "M50 4 L92 50 L50 96 L8 50 Z",
  moon: "M64 8 C40 12 24 32 24 54 C24 76 42 94 66 94 C76 94 85 90 92 84 C60 84 40 62 44 36 C46 24 54 14 64 8 Z",
  skull:
    "M50 6 C26 6 10 22 10 44 C10 58 18 68 28 72 L28 88 L40 88 L40 80 L46 80 L46 88 L54 88 L54 80 L60 80 L60 88 L72 88 L72 72 C82 68 90 58 90 44 C90 22 74 6 50 6 Z M34 40 A9 9 0 1 0 34.1 40 Z M66 40 A9 9 0 1 0 66.1 40 Z",
  crown: "M8 80 L14 26 L34 50 L50 14 L66 50 L86 26 L92 80 Z",
  flame: "M50 4 C56 24 78 34 78 62 C78 82 64 96 50 96 C36 96 22 82 22 62 C22 46 32 38 36 26 C42 38 46 42 50 44 C54 32 54 18 50 4 Z",
};

export function SymbolIcon({
  id,
  size = 96,
  color,
  className,
  style,
}: {
  id: SymbolId;
  size?: number | string;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const c = color ?? SYMBOL_COLOR[id];
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={{ width: size, height: size, overflow: "visible", filter: `drop-shadow(0 0 6px ${c}) drop-shadow(0 0 18px ${c}99)`, ...style }}
      aria-label={id}
      role="img"
    >
      <path d={SYMBOL_PATHS[id]} fill={`${c}33`} stroke={c} strokeWidth={4} strokeLinejoin="round" fillRule="evenodd" />
    </svg>
  );
}

export function ShapeIcon({ kind, color, size = 160 }: { kind: ShapeKind; color: string; size?: number | string }) {
  const common = { fill: `${color}40`, stroke: color, strokeWidth: 5, strokeLinejoin: "round" as const };
  return (
    <svg
      viewBox="0 0 100 100"
      style={{ width: size, height: size, overflow: "visible", filter: `drop-shadow(0 0 10px ${color}) drop-shadow(0 0 30px ${color}aa)` }}
      aria-label={`${kind}`}
      role="img"
    >
      {kind === "circle" && <circle cx={50} cy={50} r={42} {...common} />}
      {kind === "square" && <rect x={10} y={10} width={80} height={80} rx={8} {...common} />}
      {kind === "triangle" && <path d="M50 8 L94 88 L6 88 Z" {...common} />}
    </svg>
  );
}

/** Regular polygon with `sides` edges, or a star with `sides` points. */
export function polygonPoints(sides: number, star: boolean, rotationDeg = 0): string {
  const pts: string[] = [];
  const count = star ? sides * 2 : sides;
  for (let i = 0; i < count; i++) {
    const r = star && i % 2 === 1 ? 19 : 44;
    const a = (Math.PI * 2 * i) / count - Math.PI / 2 + (rotationDeg * Math.PI) / 180;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

export function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {on ? (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      ) : (
        <path d="m16 9 5 6M21 9l-5 6" />
      )}
    </svg>
  );
}

export function TrophyIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3" />
    </svg>
  );
}

export function ShareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" />
    </svg>
  );
}

export function CalendarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  );
}

export function PlayIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" />
    </svg>
  );
}

export function BackIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18 9 12l6-6" />
    </svg>
  );
}
