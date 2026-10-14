/** Thin wrapper over amazon-cognito-identity-js (used when NEXT_PUBLIC_AUTH_MODE=cognito). */
import { AuthenticationDetails, CognitoUser, CognitoUserAttribute, CognitoUserPool } from "amazon-cognito-identity-js";

let pool: CognitoUserPool | null = null;
const getPool = () =>
  (pool ??= new CognitoUserPool({
    UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "",
    ClientId: process.env.NEXT_PUBLIC_COGNITO_APP_CLIENT_ID || "",
  }));

export function signIn(email: string, password: string): Promise<void> {
  const user = new CognitoUser({ Username: email, Pool: getPool() });
  return new Promise((res, rej) =>
    user.authenticateUser(new AuthenticationDetails({ Username: email, Password: password }), {
      onSuccess: () => res(),
      onFailure: (e) => rej(e),
      newPasswordRequired: () => rej(new Error("A new password is required. Reset it first.")),
    }));
}

export function signUp(email: string, password: string, name: string): Promise<void> {
  return new Promise((res, rej) =>
    getPool().signUp(email, password, [new CognitoUserAttribute({ Name: "email", Value: email }),
      new CognitoUserAttribute({ Name: "name", Value: name })], [], (e) => (e ? rej(e) : res())));
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  const user = new CognitoUser({ Username: email, Pool: getPool() });
  return new Promise((res, rej) => user.confirmRegistration(code, true, (e) => (e ? rej(e) : res())));
}

export function forgotPassword(email: string): Promise<void> {
  const user = new CognitoUser({ Username: email, Pool: getPool() });
  return new Promise((res, rej) => user.forgotPassword({ onSuccess: () => res(), onFailure: rej }));
}

export function getIdToken(): Promise<string | null> {
  const user = getPool().getCurrentUser();
  if (!user) return Promise.resolve(null);
  return new Promise((res) => user.getSession((e: Error | null, s: { getIdToken(): { getJwtToken(): string }; isValid(): boolean } | null) =>
    res(!e && s?.isValid() ? s.getIdToken().getJwtToken() : null)));
}

export const signOut = () => getPool().getCurrentUser()?.signOut();
