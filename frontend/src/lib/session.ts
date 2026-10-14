/** Auth mode + per-request auth headers. mock = local dev; cognito = AWS. */
export const AUTH_MODE = (process.env.NEXT_PUBLIC_AUTH_MODE || "mock") as "mock" | "cognito";
const MOCK_KEY = "tv_mock_user";

export const mockUserId = () => (typeof window === "undefined" ? null : localStorage.getItem(MOCK_KEY));
export const setMockUser = (id: string | null) => (id ? localStorage.setItem(MOCK_KEY, id) : localStorage.removeItem(MOCK_KEY));

export async function authHeaders(): Promise<Record<string, string>> {
  if (AUTH_MODE === "mock") {
    const id = mockUserId();
    return id ? { "X-Mock-User": id } : {};
  }
  const { getIdToken } = await import("./cognito");
  const t = await getIdToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
