import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="glitch font-display text-[clamp(80px,25vw,160px)] font-black leading-none neon-text-magenta" data-text="404">
        404
      </div>
      <p className="mt-4 text-lg font-semibold text-muted">This page slipped our memory.</p>
      <Link href="/" className="btn-neon mt-8 rounded-2xl px-8 py-4 font-display font-black tracking-wider">
        BACK HOME
      </Link>
    </div>
  );
}
