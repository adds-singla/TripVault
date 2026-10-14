/** App-level "unlock" using the device's biometric/PIN (WebAuthn platform authenticator).
 *  This is a UI gate for sensitive folders, NOT encryption: files are encrypted at rest by S3 (AES-256). */
const KEY = "tv_webauthn_cred";
const rand = () => crypto.getRandomValues(new Uint8Array(32));
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const webauthnSupported = () => typeof window !== "undefined" && !!window.PublicKeyCredential;

export async function unlockWithDevice(userLabel: string): Promise<boolean> {
  if (!webauthnSupported()) return window.confirm("This browser has no biometric support. Continue?");
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      await navigator.credentials.get({ publicKey: { challenge: rand(), userVerification: "required", timeout: 60000,
        allowCredentials: [{ id: unb64(saved), type: "public-key" }] } });
    } else {
      const cred = (await navigator.credentials.create({ publicKey: {
        challenge: rand(), rp: { name: "TripVault" }, user: { id: rand(), name: userLabel, displayName: userLabel },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" }, timeout: 60000 } })) as PublicKeyCredential | null;
      if (!cred) return false;
      localStorage.setItem(KEY, b64(cred.rawId));
    }
    return true;
  } catch { return false; }
}
