"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Fingerprint, Globe, Lock, Mail, ShieldCheck, Plane } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AUTH_MODE } from "@/lib/session";
import { cn } from "@/lib/format";
import { Button, Input, useToast } from "@/components/ui";

const LANGS = ["English (US)", "हिन्दी", "Español", "日本語"];

export default function Login() {
  const { user, login, signup, confirm } = useAuth(); const router = useRouter(); const toast = useToast();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [f, setF] = useState({ email: AUTH_MODE === "mock" ? "elena.vance@tripvault.io" : "", password: "", name: "" });
  const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [code, setCode] = useState<string | null>(null); const [lang, setLang] = useState(LANGS[0]);
  useEffect(() => { if (user) router.replace("/trips/"); }, [user, router]);
  useEffect(() => { setLang(localStorage.getItem("tv_lang") ?? LANGS[0]); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      if (code !== null) await confirm(f.email, code, f.password);
      else if (tab === "login") await login(f.email, f.password);
      else { const r = await signup(f.email, f.password, f.name); if (r.needsConfirm) { setCode(""); toast("Check your email for the verification code"); } }
    } catch (e) { setErr((e as Error).message || "Something went wrong"); } finally { setBusy(false); }
  }
  async function google() {
    if (AUTH_MODE === "mock") { try { await login("elena.vance@tripvault.io", ""); } catch (e) { setErr((e as Error).message); } }
    else toast("Google sign-in needs the Cognito hosted UI + Google IdP (see README, AWS step)", "error");
  }
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden bg-stone p-14 lg:flex lg:flex-col lg:justify-between" style={{ backgroundImage: "radial-gradient(rgb(var(--stone-deep)/.5) 1px, transparent 1px)", backgroundSize: "28px 28px" }}>
        <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-input bg-primary text-on-primary"><Lock size={22} /></span>
          <div><div className="text-headline-sm">TripVault</div><div className="text-label-sm uppercase tracking-wider text-muted">Collaborative travel ledger</div></div></div>
        <div>
          <span className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface/70 px-3 py-1 text-label-md"><span className="h-2 w-2 rounded-full bg-success" />Encrypted at rest (AES-256)</span>
          <h1 className="mt-5 text-[52px] font-bold leading-[1.05] tracking-tight">Your travel world, organized and secured.</h1>
          <p className="mt-4 max-w-md text-body-lg text-muted">Consolidate itineraries, flight passes, identity documents and group expense splits in one quiet workspace.</p>
          <div className="mt-8 rounded-card border border-line bg-surface p-6 shadow-l2">
            <div className="flex items-center justify-between"><span className="text-headline-sm">Active Trip Vault</span><span className="inline-flex items-center gap-1 rounded-pill border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-label-sm text-accent"><ShieldCheck size={12} />Private S3 storage</span></div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[["Singapore Trip", "SIN · 6 documents"], ["Kyoto Autumn", "KIX · 4 documents"]].map(([a, b]) => (
                <div key={a} className="flex items-center gap-3 rounded-input border border-line bg-canvas p-3"><Plane size={18} className="text-primary" /><div><div className="text-label-lg">{a}</div><div className="text-body-sm text-muted">{b}</div></div></div>))}
            </div>
          </div>
        </div>
        <p className="text-body-sm text-muted">Sample trips shown for illustration.</p>
      </section>

      <section className="flex flex-col bg-surface px-6 py-8 sm:px-14">
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-pill border border-line bg-stone p-1">
            {(["login", "signup"] as const).map((t) => <button key={t} onClick={() => { setTab(t); setErr(""); setCode(null); }} className={cn("rounded-pill px-5 py-2 text-label-lg", tab === t && "bg-surface shadow-l1")}>{t === "login" ? "Log in" : "Sign up"}</button>)}
          </div>
          <button onClick={() => setTab(tab === "login" ? "signup" : "login")} className="hidden text-body-md text-muted sm:block">{tab === "login" ? "New to TripVault?" : "Have an account?"} <span className="font-semibold text-accent">{tab === "login" ? "Create account" : "Log in"}</span></button>
        </div>
        <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center py-10">
          <h2 className="text-headline-xl">{code !== null ? "Verify your email" : tab === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="mt-2 text-body-lg text-muted">{code !== null ? "Enter the 6-digit code we emailed you." : tab === "login" ? "Enter your credentials to access your trips and vault." : "Start organizing your next trip in minutes."}</p>
          {AUTH_MODE === "mock" && <p className="mt-3 rounded-input bg-warning/10 px-3 py-2 text-body-sm text-warning">Local dev mode: any password works. Demo users: elena.vance@, aman.k@, david.m@, marcus.lin@tripvault.io</p>}
          <form onSubmit={submit} className="mt-8 space-y-4">
            {code === null && <>
              <Button type="button" variant="secondary" className="w-full py-3.5" onClick={google}><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>Continue with Google</Button>
              <div className="flex items-center gap-3 text-label-sm uppercase tracking-wider text-muted"><span className="h-px flex-1 bg-line" />or continue with email<span className="h-px flex-1 bg-line" /></div>
              {tab === "signup" && <label className="block"><span className="mb-1.5 block text-label-md">Full name</span><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>}
              <label className="block"><span className="mb-1.5 block text-label-md">Work / Personal Email</span>
                <div className="relative"><Mail size={16} className="absolute left-3.5 top-3.5 text-muted" /><Input required type="email" className="pl-10" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div></label>
              <label className="block"><span className="mb-1.5 flex justify-between text-label-md">Password{tab === "login" && AUTH_MODE === "cognito" && <button type="button" className="font-semibold text-accent" onClick={async () => { try { await (await import("@/lib/cognito")).forgotPassword(f.email); toast("Reset code sent to your email"); } catch (e) { setErr((e as Error).message); } }}>Forgot password?</button>}</span>
                <div className="relative"><Lock size={16} className="absolute left-3.5 top-3.5 text-muted" /><Input required={AUTH_MODE === "cognito"} type={show ? "text" : "password"} minLength={AUTH_MODE === "cognito" ? 8 : 0} className="pl-10 pr-10" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
                  <button type="button" aria-label="Show password" onClick={() => setShow(!show)} className="absolute right-3 top-3 text-muted">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            </>}
            {code !== null && <label className="block"><span className="mb-1.5 block text-label-md">Verification code</span><Input required inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} /></label>}
            {err && <p role="alert" className="text-body-md text-danger">{err}</p>}
            <Button type="submit" loading={busy} className="w-full py-3.5 text-base">{code !== null ? "Verify & sign in" : tab === "login" ? "Sign in to TripVault" : "Create account"}<ArrowRight size={18} /></Button>
            {tab === "login" && code === null && <button type="button" onClick={() => toast("Passkey sign-in needs Cognito passkeys enabled (see README, AWS step)", "error")} className="mx-auto flex items-center gap-2 text-label-md text-accent"><Fingerprint size={16} />Sign in with a passkey</button>}
          </form>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-line pt-5 text-body-sm text-muted">
          <p>Files are encrypted at rest with AES-256. By continuing you agree to the Terms of Service and Privacy Policy.</p>
          <label className="flex shrink-0 items-center gap-2 rounded-pill border border-line bg-stone px-3 py-1.5"><Globe size={14} />
            <select aria-label="Language" value={lang} onChange={(e) => { setLang(e.target.value); localStorage.setItem("tv_lang", e.target.value); toast("Preference saved. UI is English-only for now."); }} className="bg-transparent text-label-md focus:outline-none">{LANGS.map((l) => <option key={l}>{l}</option>)}</select></label>
        </div>
      </section>
    </div>
  );
}
