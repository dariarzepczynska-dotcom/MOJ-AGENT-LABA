import { getAuthenticatedSupabase } from "@/lib/server-supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAuthenticatedSupabase(request))) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;
  const { error } = await getSupabaseAdmin()
    .from("briefings")
    .delete()
    .eq("id", id);

  if (error) {
    return Response.json(
      { success: false, error: `Nie udało się usunąć briefingu: ${error.message}` },
      { status: 500 },
    );
  }

  return Response.json({ success: true });
}
