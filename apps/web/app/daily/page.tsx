import type { Metadata } from "next";
import { Game } from "@/components/game/Game";

export const metadata: Metadata = {
  title: "Daily Challenge",
  description: "One run a day, the same rounds for everyone. How far can you get? Share your result and keep your streak going.",
};

export default function DailyPage() {
  return <Game mode="daily" />;
}
