import { supabase } from "./supabase";

const tokenRefreshWindowSeconds = 60;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = supabase.auth
      .refreshSession()
      .then(({ data, error }) => {
        if (error) return null;
        return data.session?.access_token ?? null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function getValidAccessToken(forceRefresh = false) {
  if (forceRefresh) return refreshAccessToken();

  const { data, error } = await supabase.auth.getSession();
  if (error) return refreshAccessToken();

  const session = data.session;
  if (!session?.access_token) return refreshAccessToken();

  const expiresSoon =
    typeof session.expires_at === "number" &&
    session.expires_at <= Math.floor(Date.now() / 1000) + tokenRefreshWindowSeconds;

  return expiresSoon ? refreshAccessToken() : session.access_token;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const accessToken = await getValidAccessToken();
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(input, { ...init, headers });
  if (response.status !== 401) return response;

  const refreshedAccessToken = await getValidAccessToken(true);
  if (!refreshedAccessToken || refreshedAccessToken === accessToken) return response;

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set("Authorization", `Bearer ${refreshedAccessToken}`);
  return fetch(input, { ...init, headers: retryHeaders });
}
