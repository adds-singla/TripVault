"use client";
import { useRouter } from "next/navigation";
import { Fingerprint, LogOut, Moon, ShieldCheck, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AUTH_MODE } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { webauthnSupported } from "@/lib/webauthn";
import { Avatar, Button, Card, Chip, PageTitle, useToast } from "@/components/ui";

export default function SettingsPage() {
  const { user, logout } = useAuth(); const { theme, toggle } = useTheme(); const router = useRouter(); const toast = useToast();
  return (
    <div className="max-w-2xl space-y-6">
      <PageTitle title="Settings" sub="Profile, appearance and security" />
      <Card className="flex items-center gap-4 p-5"><Avatar name={user?.name ?? "?"} size={56} /><div className="flex-1"><div className="text-headline-sm">{user?.name}</div><div className="text-body-md text-muted">{user?.email}</div></div><Chip>{AUTH_MODE === "mock" ? "Local dev account" : "Cognito"}</Chip></Card>
      <Card className="flex items-center justify-between p-5"><div><h2 className="text-label-lg text-base">Appearance</h2><p className="text-body-md text-muted">Currently {theme} mode</p></div>
        <Button variant="secondary" onClick={toggle}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}Switch to {theme === "dark" ? "light" : "dark"}</Button></Card>
      <Card className="space-y-3 p-5"><h2 className="flex items-center gap-2 text-label-lg text-base"><ShieldCheck size={18} />Security</h2>
        <p className="text-body-md text-muted">Documents are stored in a private S3 bucket and encrypted at rest (AES-256). Downloads use short-lived signed links.</p>
        <div className="flex items-center justify-between rounded-input bg-canvas p-3"><span className="flex items-center gap-2 text-body-md"><Fingerprint size={16} />Passport folder device lock</span>
          <Button size="sm" variant="secondary" disabled={!webauthnSupported()} onClick={() => { localStorage.removeItem("tv_webauthn_cred"); toast("Device lock reset. You'll set it up again next time."); }}>{webauthnSupported() ? "Reset" : "Unsupported"}</Button></div></Card>
      <Button variant="secondary" onClick={async () => { await logout(); router.replace("/login/"); }}><LogOut size={16} />Sign out</Button>
    </div>
  );
}
