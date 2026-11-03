import { normalizeAnthropicStream } from "./anthropic-stream.ts";
import { CopyError, handleCopyAgent } from "./copy-agent.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// claude-sonnet-5 is a real Anthropic model id but is now legacy;
// claude-sonnet-5-5 is the current Sonnet. Confirmed against Anthropic's
// own model docs (platform.claude.com/docs/models/sonnet-5/overview),
// not assumed. Override via the ANTHROPIC_MODEL secret if needed.
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";

// Shared server-side AI proxy for app features (Orbe AI, Copy IA,
// Relatórios, Super Agente and client-detail assistant). OpenAI handles
// standard chats and translates the existing Super Agente tool loop when
// configured; Anthropic remains a fallback for deployments without OpenAI. Provider keys
// never leave the function and every request is JWT-authenticated.
//
// Two modes:
// - Plain chat (no `tools`): prefers OpenAI Responses and normalizes output
//   to the `choices[0].delta.content` format already used by the frontend.
// - Tool calling (`tools` present): maps the Super Agente's existing
//   Anthropic-shaped web_search loop to OpenAI Responses function calls,
//   then maps results back to the caller's expected tool_use/tool_result shape.
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

    const {data:profile,error:profileError}=await supabaseAdmin.from("profiles").select("is_active").eq("id",user.id).maybeSingle();
    if(profileError||!profile?.is_active)return json({error:"Seu acesso à IA não está ativo."},403);

    const rawBody = await req.text();
    if (rawBody.length > 1000000) return json({ error: 'Solicitação muito extensa.' }, 413);
    const body = JSON.parse(rawBody);
    if (body.feature === 'neuro_copy') {
      const userDb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false, autoRefreshToken: false },
      });
      try {
        if (rawBody.length > 60000) return json({error:'Briefing muito extenso.'},413);
        return json(await handleCopyAgent(userDb, body, Deno.env.get('OPENAI_API_KEY'), Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1-mini'));
      } catch (error) {
        return json({error:error instanceof CopyError ? error.message : 'Não foi possível preparar a copy. Tente novamente.'}, error instanceof CopyError ? error.status : 502);
      }
    }
    const { system, messages, tools, tool_choice, max_tokens, temperature } = body;
    if (!Array.isArray(messages)) return json({ error: "Campo obrigatório: messages" }, 400);
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    // The client-detail AI chat explicitly asks for Anthropic (most recent
    // product decision) — honor that even when OPENAI_API_KEY is set, and
    // fail honestly instead of silently answering with OpenAI under a
    // Claude label when ANTHROPIC_API_KEY isn't configured.
    const wantsAnthropic = body.provider === "anthropic";
    if (wantsAnthropic && !anthropicKey) {
      return json({ error: "ANTHROPIC_API_KEY não configurada no servidor — a IA do cliente usa Anthropic especificamente e não usa outro provedor no lugar. Configure o secret em Supabase → Edge Functions → Secrets." }, 503);
    }

    // Native tool-calling passthrough for Super Agente.
    if (Array.isArray(tools) && tools.length > 0) {
      if (openaiKey && !wantsAnthropic) {
        const input = toResponsesInput(messages);
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini",
            instructions: system ?? undefined,
            input,
            max_output_tokens: body.max_output_tokens ?? max_tokens ?? 2048,
            tools: tools.map((tool: { name: string; description?: string; input_schema?: unknown }) => ({ type: "function", name: tool.name, description: tool.description, parameters: tool.input_schema, strict: false })),
            tool_choice: tool_choice ?? "auto",
            stream: false,
            store: false,
          }),
        });
        const result = await response.json();
        if (!response.ok) return providerError("OpenAI",response.status);
        return json(normalizeOpenAIToolResponse(result));
      }
      if (!anthropicKey) return json({ error: "A integração do agente com ferramentas ainda não está configurada." }, 503);
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
      if (!anthropicRes.ok) return providerError("Anthropic",anthropicRes.status);
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
    const streamRequested = body.stream !== false;

    // OpenAI Responses API for standard chats when the server-side secret is
    // configured — unless this call specifically asked for Anthropic.
    // API credentials never leave this Edge Function.
    if (openaiKey && !wantsAnthropic) {
      const openaiBody = {
        model: Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini",
        instructions: systemPrompt,
        input: chatMessages.map((m) => ({ role: m.role, content: String(m.content ?? "") })),
        max_output_tokens: body.max_output_tokens ?? max_tokens ?? 1024,
        temperature,
        stream: streamRequested,
        store: false,
      };
      const openaiRes = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify(openaiBody),
      });
      if (!streamRequested) {
        const result = await openaiRes.json();
        if (!openaiRes.ok) return providerError("OpenAI",openaiRes.status);
        return json({ choices: [{ message: { content: result.output_text ?? extractOutputText(result.output) }, finish_reason: "stop" }] });
      }
      if (!openaiRes.ok || !openaiRes.body) {
        return providerError("OpenAI",openaiRes.status);
      }
      return normalizeOpenAIStream(openaiRes.body);
    }

    if (!anthropicKey) return json({ error: "Configure OPENAI_API_KEY nos Secrets do Supabase para habilitar a IA." }, 503);
    const anthropicMessages = chatMessages.map((m) => ({ role: m.role, content: m.content }));

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
      if (!anthropicRes.ok) return providerError("Anthropic",anthropicRes.status);
      const text = (resultJson.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("");
      return json({ choices: [{ message: { content: text }, finish_reason: "stop" }] });
    }

    if (!anthropicRes.ok || !anthropicRes.body) {
      return providerError("Anthropic",anthropicRes.status);
    }

    return normalizeAnthropicStream(anthropicRes.body,corsHeaders);

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

function extractOutputText(output: Array<{ content?: Array<{ type?: string; text?: string }> }> = []) {
  return output.flatMap((item) => item.content ?? []).filter((part) => part.type === "output_text").map((part) => part.text ?? "").join("");
}

function toResponsesInput(messages: Array<{ role: string; content: unknown }>) {
  const input: unknown[] = [];
  for (const message of messages) {
    if (typeof message.content === "string") {
      input.push({ role: message.role, content: message.content });
      continue;
    }
    if (!Array.isArray(message.content)) continue;
    for (const block of message.content as Array<Record<string, unknown>>) {
      if (block.type === "tool_use") {
        input.push({ type: "function_call", call_id: block.id, name: block.name, arguments: JSON.stringify(block.input ?? {}) });
      } else if (block.type === "tool_result") {
        input.push({ type: "function_call_output", call_id: block.tool_use_id, output: String(block.content ?? "") });
      } else if (block.type === "text" && typeof block.text === "string") {
        input.push({ role: message.role, content: block.text });
      }
    }
  }
  return input;
}

function normalizeOpenAIToolResponse(result: { output?: Array<Record<string, unknown>>; output_text?: string }) {
  const content: Array<Record<string, unknown>> = [];
  for (const item of result.output ?? []) {
    if (item.type === "function_call") {
      const input = (() => {
        try { return JSON.parse(String(item.arguments ?? "{}")); } catch { return {}; }
      })();
      content.push({ type: "tool_use", id: item.call_id ?? item.id, name: item.name, input });
    } else if (item.type === "message" && Array.isArray(item.content)) {
      for (const block of item.content as Array<Record<string, unknown>>) if (block.type === "output_text" && typeof block.text === "string") content.push({ type: "text", text: block.text });
    }
  }
  if (!content.some((item) => item.type === "text") && result.output_text) content.unshift({ type: "text", text: result.output_text });
  return { stop_reason: content.some((item) => item.type === "tool_use") ? "tool_use" : "end_turn", content };
}

function normalizeOpenAIStream(body: ReadableStream<Uint8Array>) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = body.getReader();
  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const event = JSON.parse(data);
              if (event.type === "response.output_text.delta" && event.delta) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: event.delta } }] })}\n\n`));
              }
              if (event.type === "error" || event.type === "response.failed") {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "\n\nNão foi possível concluir a resposta da IA. Tente novamente." } }] })}\n\n`));
              }
            } catch { /* ignore malformed SSE frames */ }
          }
        }
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { ...corsHeaders, "content-type": "text/event-stream", "cache-control": "no-cache" } });
}

function providerError(provider:string,status:number) {
  const reason=[401,403].includes(status)?'A autorização precisa ser conferida nas configurações.':status===429?'O limite de uso ou saldo precisa ser conferido.':'Não foi possível concluir a consulta agora. Tente novamente.';
  return json({error:`${provider}: ${reason}`},502);
}
