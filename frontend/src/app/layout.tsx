import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = { title: "TripVault", description: "Collaborative travel ledger: itinerary, documents and expense splitting", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { themeColor: "#765A4B", width: "device-width", initialScale: 1 };

// Sets the theme before first paint to avoid a light/dark flash.
const themeScript = `try{var t=localStorage.getItem('tv_theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><ThemeProvider><ToastProvider><AuthProvider>{children}</AuthProvider></ToastProvider></ThemeProvider></body>
    </html>
  );
}
