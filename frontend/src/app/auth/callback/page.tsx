"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CognitoUserPool } from "amazon-cognito-identity-js";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const idToken = params.get("id_token");
    const accessToken = params.get("access_token");

    if (!idToken) {
      router.replace("/login");
      return;
    }

    // Decode the token to get the username
    const payload = JSON.parse(atob(idToken.split(".")[1]));
    const username = payload["cognito:username"] || payload.sub;

    const clientId = process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID || "";
    const prefix = `CognitoIdentityServiceProvider.${clientId}.${username}`;

    localStorage.setItem(`${prefix}.idToken`, idToken);
    if (accessToken) localStorage.setItem(`${prefix}.accessToken`, accessToken);
    localStorage.setItem(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`, username);

    // Verify the pool recognises the session
    const pool = new CognitoUserPool({
      UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "",
      ClientId: clientId,
    });
    const user = pool.getCurrentUser();
    if (user) {
      user.getSession((err: Error | null) => {
        router.replace(err ? "/login" : "/trips/");
      });
    } else {
      router.replace("/trips/");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-body-lg text-muted">Signing you in…</p>
    </div>
  );
}
