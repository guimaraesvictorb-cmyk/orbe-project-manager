import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { target_id } = await req.json();
    if (!target_id) return json({ error: "Campo obrigatório: target_id" }, 400);

    if (target_id === user.id) {
      return json({ error: "Você não pode remover a própria conta" }, 400);
    }

    const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(target_id, {
      ban_duration: "876000h",
    });
    if (banErr) return json({ error: banErr.message }, 400);

    await supabaseAdmin.from("profiles").update({ is_active: false }).eq("id", target_id);

    return json({ ok: true });
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
