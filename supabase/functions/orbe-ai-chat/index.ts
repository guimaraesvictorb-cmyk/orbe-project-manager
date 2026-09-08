import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_MODEL = "claude-sonnet-5";

// Shared Claude proxy for every AI feature in the app (Orbe AI, Copy IA,
// Relatórios, Super Agente, the client-detail assistant) so the API key
// only ever lives on the server, gated by the same JWT-auth pattern as
// invite-user/remove-user.
//
// Two modes:
// - Plain chat (no `tools` in the request): re-shapes Anthropic's response
//   into the OpenAI/Groq-compatible `choices[0].message/delta.content`
//   format every call site already spoke to Groq with, streamed or not —
//   so those call sites needed no rewrite beyond the URL and auth header.
// - Tool calling (`tools` present, used by Super Agente's web_search
//   loop): passed straight through in Anthropic's own native tool format
//   and returns Anthropic's raw response — trying to shim OpenAI-style
//   function-calling with a stateless proxy is fragile (Anthropic requires
//   tool_use/tool_result blocks to line up exactly across turns), so that
//   one caller speaks Anthropic's real protocol directly instead.
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

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json({ error: "ANTHROPIC_API_KEY não configurada no servidor" }, 500);

    const body = await req.json();
    const { system, messages, tools, tool_choice, max_tokens, temperature } = body;
    if (!Array.isArray(messages)) return json({ error: "Campo obrigatório: messages" }, 400);

    // Native tool-calling passthrough for Super Agente.
    if (Array.isArray(tools) && tools.length > 0) {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: max_tokens ?? 2048,
          temperature,
          system: system ?? undefined,
          messages,
          tools,
          tool_choice: tool_choice ?? undefined,
        }),
      });
      const resultJson = await anthropicRes.json();
      if (!anthropicRes.ok) return json({ error: `Anthropic ${anthropicRes.status}: ${JSON.stringify(resultJson)}` }, 502);
      return json(resultJson);
    }

    // Plain chat: normalize a leading {role:"system"} message (some call
    // sites send it that way instead of the top-level `system` field) and
    // strip it, since Anthropic only accepts system as a separate param.
    let systemPrompt = system as string | undefined;
    let chatMessages = messages as { role: string; content: string }[];
    if (chatMessages[0]?.role === "system") {
      systemPrompt = systemPrompt ?? chatMessages[0].content;
      chatMessages = chatMessages.slice(1);
    }
    const anthropicMessages = chatMessages.map((m) => ({ role: m.role, content: m.content }));

    const streamRequested = body.stream !== false;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: max_tokens ?? 1024,
        temperature,
        stream: streamRequested,
        system: systemPrompt,
        messages: anthropicMessages,
      }),
    });

    if (!streamRequested) {
      const resultJson = await anthropicRes.json();
      if (!anthropicRes.ok) return json({ error: `Anthropic ${anthropicRes.status}: ${JSON.stringify(resultJson)}` }, 502);
      const text = (resultJson.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("");
      return json({ choices: [{ message: { content: text }, finish_reason: "stop" }] });
    }

    if (!anthropicRes.ok || !anthropicRes.body) {
      const errText = await anthropicRes.text();
      return json({ error: `Anthropic ${anthropicRes.status}: ${errText}` }, 502);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const anthropicReader = anthropicRes.body.getReader();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await anthropicReader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (!data) continue;
              try {
                const evt = JSON.parse(data);
                if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                  const chunk = { choices: [{ delta: { content: evt.delta.text } }] };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              } catch {
                // ignore malformed SSE lines
              }
            }
          }
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "content-type": "text/event-stream", "cache-control": "no-cache" },
    });
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
