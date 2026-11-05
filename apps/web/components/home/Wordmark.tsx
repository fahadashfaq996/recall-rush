import Link from "next/link";

export function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="Recall Rush home">
      <span
        className={`relative grid place-items-center rounded-xl bg-[conic-gradient(from_180deg,var(--cyan),var(--violet),var(--magenta),var(--cyan))] ${
          size === "lg" ? "h-11 w-11" : "h-9 w-9"
        } shadow-[0_0_24px_rgba(255,43,214,0.55)]`}
      >
        <span className="absolute inset-[3px] rounded-[9px] bg-bg" />
        <span className="relative font-display text-sm font-black text-white">R</span>
      </span>
      <span className={`font-display font-black tracking-tight ${size === "lg" ? "text-2xl" : "text-base sm:text-lg"}`}>
        RECALL<span className="text-magenta">RUSH</span>
      </span>
    </Link>
  );
}
