import { createClient, type User } from "@supabase/supabase-js";

type AuthUserResponse = User & { id: string };

export async function getAuthenticatedSupabase(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!url || !key) {
    console.error("Brak konfiguracji Supabase wymaganej do autoryzacji API.");
    return null;
  }
  if (!token) {
    console.warn("Żądanie API nie zawiera tokenu Bearer.");
    return null;
  }

  let authResponse: Response;
  try {
    authResponse = await fetch(`${url}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
  } catch (error) {
    console.error("Nie udało się połączyć z usługą autoryzacji Supabase.", error);
    return null;
  }

  if (!authResponse.ok) {
    console.warn("Supabase odrzucił token użytkownika.", {
      status: authResponse.status,
    });
    return null;
  }

  const user = (await authResponse.json()) as AuthUserResponse;
  if (!user?.id) return null;

  const client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  return { client, user };
}
