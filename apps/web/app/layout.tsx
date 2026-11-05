import type { Metadata, Viewport } from "next";
import { Inter, Unbounded } from "next/font/google";
import { ThemeApplier } from "@/components/ThemeApplier";
import { themeBootScript } from "@/lib/themes";
import "./globals.css";

const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], weight: ["400", "600", "800", "900"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Recall Rush: the endless memory game",
    template: "%s · Recall Rush",
  },
  description:
    "How far can your memory go? An endless tap game of quick memory, focus and reaction rounds that gets harder every round. One wrong tap and it's over.",
  keywords: ["memory game", "memory test", "brain game", "reaction test", "focus game", "daily challenge", "leaderboard"],
  applicationName: "Recall Rush",
  appleWebApp: { capable: true, title: "Recall Rush", statusBarStyle: "black-translucent" },
  openGraph: { type: "website", siteName: "Recall Rush" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#06061a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${unbounded.variable} ${inter.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
      </head>
      <body className="min-h-dvh">
        <div className="backdrop" aria-hidden>
          <div className="blob blob-a" />
          <div className="blob blob-b" />
          <div className="grid-floor" />
          <div className="noise" />
        </div>
        <ThemeApplier />
        {children}
      </body>
    </html>
  );
}
