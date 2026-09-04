import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// last_sign_in_at lives on auth.users, which isn't reachable from the
// client via PostgREST — this returns it via the admin API, gated the same
// way as invite-user/remove-user (caller must be admin/coordenador).
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);
    const jwt = authHeader.replace(/^Bearer\s+/i, "");

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    if (userErr || !user) return json({ error: "Token inválido" }, 401);

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!callerProfile || !["admin", "coordenador"].includes(callerProfile.role)) {
      return json({ error: "Sem permissão" }, 403);
    }

    const activity: Record<string, { last_sign_in_at: string | null; created_at: string }> = {};
    let page = 1;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return json({ error: error.message }, 400);
      for (const u of data.users) {
        activity[u.id] = { last_sign_in_at: u.last_sign_in_at ?? null, created_at: u.created_at };
      }
      if (data.users.length < 200) break;
      page += 1;
    }

    return json({ ok: true, activity });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
