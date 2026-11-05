import { notFound } from "next/navigation";
import { RoundGallery } from "./RoundGallery";

/** Development-only gallery of every round type, for visual review. */
export default function DevRoundsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RoundGallery />;
}
