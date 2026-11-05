import type { Metadata } from "next";
import { ProfileView } from "./ProfileView";

export const metadata: Metadata = {
  title: "Your profile",
  description: "Your level, daily missions, brain profile, themes and achievements.",
};

export default function ProfilePage() {
  return <ProfileView />;
}
