import {
  copyProviderRequest,
  buildCatalog,
  campaignPath,
  parseObject,
  readBrief,
  readCopy,
  unsupportedAmounts,
} from "./copy-core.ts";
import { handleCopyAgent } from "./copy-agent.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
function assert(value: unknown): asserts value {
  if (!value) throw new Error("assertion failed");
}
Deno.test(
  "current Sonnet request excludes retired sampling and disabled thinking parameters",
  () => {
    const body = copyProviderRequest("claude-sonnet-5-5", "Test");
    assert(!("temperature" in body));
    assert(!("top_p" in body));
    assert(!("top_k" in body));
    assert(body.thinking?.type === "between_tools");
    assert(body.messages[0].role === "user");
    const catalog = buildCatalog([
      {
        id: "x",
        title: "campanha_setembro_2026.html",
        source_ref: "x",
        source_url: null,
      },
    ]);
    assert(
      catalog[0].label.includes("2026") &&
        !catalog[0].label.includes("confirmar"),
    );
    assert(
      campaignPath(
        "04. Campanhas/00. Eventos - Campanhas pontuais/Reativação.pdf",
      ) === "04. Campanhas/00. Eventos - Campanhas pontuais/Reativação.pdf",
    );
  },
);
function rejects(fn: () => unknown) {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  assert(failed);
}
Deno.test(
  "catalog groups chunks, keeps historical years separate and never infers a year from sync",
  () => {
    const paths = [
      ["a", "04. Campanhas/11. Novembro 2026/Oferta.docx · parte 1/2"],
      ["a:chunk:1", "04. Campanhas/11. Novembro 2026/Oferta.docx · parte 2/2"],
      ["b", "04. Campanhas/11. Novembro 2026/Roteiros.md"],
      [
        "c",
        "13. Backup/4. CAMPANHAS/2. COPY/META ADS/2025/BLACK FRIDAY/Roteiro.docx",
      ],
      ["d", "04. Campanhas/10. Outubro/Copy.md"],
    ];
    const catalog = buildCatalog(
      paths.map(([source_ref, title], i) => ({
        id: String(i),
        title,
        source_ref,
        source_url: null,
      })),
    );
    assert(catalog.length === 3);
    assert(
      catalog.find((c) => c.path.includes("Novembro"))?.documentCount === 2,
    );
    assert(catalog.find((c) => c.historical)?.label.includes("2025"));
    assert(
      catalog
        .find((c) => c.path.includes("Outubro"))
        ?.label.includes("ano a confirmar"),
    );
  },
);
Deno.test(
  "campaign detection handles actual folder hierarchy, dated meeting names and excludes report lookalikes",
  () => {
    assert(
      campaignPath(
        "04. Campanhas/01. Campanhas Marketing/09. Set/Roteiros/A.md",
      ) === "04. Campanhas/01. Campanhas Marketing/09. Set",
    );
    assert(
      campaignPath(
        "02. Reuniões/[ORBE / RAYAFIT] - Black - 2026/10/16 10:00 - Anotações.md",
      ) !== null,
    );
    assert(
      campaignPath(
        "11. Métricas e Relatórios/Meta Ads/2026-09/Contas-Campanhas.csv",
      ) === null,
    );
  },
);
Deno.test(
  "brief and model JSON reject invalid shapes instead of coercing into copy",
  () => {
    rejects(() => readBrief({ product: "incomplete" }));
    rejects(() => parseObject('some text {"brief":{}}'));
    rejects(() => parseObject("[]"));
    assert(parseObject('```json\n{"ok":true}\n```').ok === true);
  },
);
Deno.test(
  "Google RSA output must have every field and respect limits without truncating terms",
  () => {
    const fields = {
      "Headline 1": "Matrículas abertas",
      "Headline 2": "Conheça a Rayafit",
      "Headline 3": "Escolha sua unidade",
      "Descrição 1": "Consulte planos e condições.",
      "Descrição 2": "Fale com a equipe para saber mais.",
    };
    assert(readCopy(fields, "google")["Headline 1"] === fields["Headline 1"]);
    rejects(() =>
      readCopy({ ...fields, "Headline 1": "a".repeat(31) }, "google"),
    );
    rejects(() =>
      readCopy({ ...fields, "Descrição 1": "a".repeat(91) }, "google"),
    );
    rejects(() => readCopy({}, "meta"));
  },
);
Deno.test(
  "generated/extracted prices must occur in the selected reference, allowing equivalent formatting",
  () => {
    assert(!unsupportedAmounts("R$ 7,00 e R$ 1.299,90", "R$ 7 e R$ 1.299,90"));
    assert(unsupportedAmounts("R$ 27", "R$ 7 na primeira parcela"));
    assert(!unsupportedAmounts('R$ 137,00', 'O plano é 137, as demais de 99,90.'));
  },
);
type Recorded = { table: string; operation: string; args: unknown[] };
function mockDb(inaccessible = false, failKnowledge = false) {
  const calls: Recorded[] = [];
  const result = (table: string) =>
    table === "clients"
      ? {
          data: inaccessible
            ? null
            : { id: "589481f6-3a15-4c93-b384-5d33373c20e3", name: "Rayafit" },
          error: null,
        }
      : table === "client_drive_config"
        ? {
            data: { folder_id: "mapped-root", last_synced_at: "2026-11-03" },
            error: null,
          }
        : {
            data: [],
            error: failKnowledge ? { message: "private error" } : null,
          };
  const db = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const method of [
        "select",
        "eq",
        "is",
        "in",
        "order",
        "range",
        "maybeSingle",
      ])
        chain[method] = (...args: unknown[]) => {
          calls.push({ table, operation: method, args });
          return chain;
        };
      chain.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(result(table)).then(resolve);
      return chain;
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}
Deno.test(
  "client authorization fails closed before reading campaign documents or contacting Anthropic",
  async () => {
    const { db, calls } = mockDb(true);
    let denied = false;
    try {
      await handleCopyAgent(
        db,
        {
          client_id: "589481f6-3a15-4c93-b384-5d33373c20e3",
          action: "catalog",
        },
        undefined,
        "unused",
      );
    } catch {
      denied = true;
    }
    assert(denied);
    assert(!calls.some((c) => c.table === "client_knowledge"));
  },
);
Deno.test(
  "catalog reads are scoped to client, current root and validated Drive source; RLS errors fail closed",
  async () => {
    const { db, calls } = mockDb();
    const result = await handleCopyAgent(
      db,
      { client_id: "589481f6-3a15-4c93-b384-5d33373c20e3", action: "catalog" },
      undefined,
      "unused",
    );
    assert("campaigns" in result && result.campaigns?.length === 0);
    const filters = calls
      .filter((c) => c.table === "client_knowledge" && c.operation === "eq")
      .map((c) => JSON.stringify(c.args));
    for (const pair of [
      ["client_id", "589481f6-3a15-4c93-b384-5d33373c20e3"],
      ["source", "drive"],
      ["validated", true],
      ["source_folder_id", "mapped-root"],
    ])
      assert(filters.includes(JSON.stringify(pair)));
    let failed = false;
    try {
      await handleCopyAgent(
        mockDb(false, true).db,
        {
          client_id: "589481f6-3a15-4c93-b384-5d33373c20e3",
          action: "catalog",
        },
        undefined,
        "unused",
      );
    } catch {
      failed = true;
    }
    assert(failed);
  },
);
