import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
registerHooks({
  resolve(s, c, n) {
    return n(
      (c.parentURL?.includes("/api/") || c.parentURL?.includes("/src/lib/")) &&
        s.endsWith(".js")
        ? s.replace(/\.js$/, ".ts")
        : s,
      c,
    );
  },
});
const {
  comparisonPeriod,
  goalProgress,
  groupTrend,
  selectedMetrics,
  campaignKey,
} = await import("../src/lib/clientAnalytics.ts");
const { aggregateClientDashboard } =
  await import("../api/_lib/clientDashboard.ts");
const { default: handler } = await import("../api/client-dashboard.ts");
const { ORBE_ORIGIN } = await import("../api/_lib/kommo.ts");
test("comparison respects month-to-date, leap month ends and equal-length arbitrary ranges", () => {
  assert.deepEqual(
    comparisonPeriod({ start: "2026-11-01", end: "2026-11-04" }),
    { start: "2026-10-01", end: "2026-10-04" },
  );
  assert.deepEqual(
    comparisonPeriod({ start: "2024-03-01", end: "2024-03-31" }),
    { start: "2024-02-01", end: "2024-02-29" },
  );
  assert.deepEqual(
    comparisonPeriod({ start: "2026-11-03", end: "2026-11-03" }),
    { start: "2026-11-02", end: "2026-11-02" },
  );
  assert.deepEqual(
    comparisonPeriod({ start: "2026-10-10", end: "2026-10-16" }),
    { start: "2026-10-03", end: "2026-10-09" },
  );
  assert.throws(() =>
    comparisonPeriod({ start: "2026-02-31", end: "2026-03-02" }),
  );
});
test("reviewed channels and aggregate drilldowns preserve native attribution and omit private history", () => {
  const at = "2026-11-03T15:00:00Z",
    record = (key: string, extra: Record<string, string>) => ({
      entity: "messages",
      entity_key: key,
      occurred_at: at,
      payload: {
        contact_id: key,
        name: "PRIVATE NAME",
        phone: "5511999999999",
        text: "PRIVATE MESSAGE",
        utm_term: "ibes",
        ...extra,
      },
    });
  const sources = [
    {
      connection: "one",
      records: [
        record("old-meta", {
          origin_history_status: "channel_found",
          origin_history_channel: "Meta",
          origin_history_evidence_id: "PRIVATE PROOF",
          origin_history_evidence_at: "2026-10-17T20:42:00Z",
          origin_history_evidence_kind: "native_ad_referral",
        }),
        record("native-google", {
          utm_source: "google",
          utm_campaign: "Search",
        }),
        record("native-meta", {
          utm_source: "meta",
          utm_campaign: "Black",
          utm_term: "alecrim",
        }),
      ],
      events: [],
      outcomes: [],
      settings: null,
    },
  ];
  const serialized = JSON.stringify(sources),
    data = aggregateClientDashboard(sources, "2026-11-01", "2026-11-04");
  assert.equal(data.total, 3);
  assert.equal(data.channels.Meta, 2);
  assert.equal(data.native_channels.Meta, 1);
  assert.equal(data.native_channels["Origem não identificada"], 1);
  assert.equal(data.segments.Meta.total, 2);
  assert.equal(data.segments.Meta.native, 1);
  assert.equal(
    data.segments.Meta.daily.reduce((n, p) => n + p.value, 0),
    2,
  );
  assert.equal(data.unit_segments.ibes.total, 2);
  assert.equal(
    data.campaigns.find(
      (c) => c.channel === "Meta" && c.name === "Campanha não informada",
    )?.metrics.native,
    0,
  );
  for (const secret of [
    "PRIVATE NAME",
    "PRIVATE MESSAGE",
    "PRIVATE PROOF",
    "5511999999999",
    "old-meta",
    "monthly_fee",
    "token_ciphertext",
  ])
    assert.equal(JSON.stringify(data).includes(secret), false);
  assert.equal(JSON.stringify(sources), serialized);
  const ibes = aggregateClientDashboard(
    sources,
    "2026-11-01",
    "2026-11-04",
    "ibes",
  );
  assert.equal(ibes.total, 2);
  assert.equal(ibes.native_channels.Meta, undefined);
  const fixture = {
    ...data,
    client: { name: "Client", logo: "" },
    period: { start: "2026-11-01", end: "2026-11-04" },
    unit: "all",
    goals: [],
    goal_month: "2026-11",
    monthly_units: { all: 3 },
    updated_at: at,
  };
  assert.equal(selectedMetrics(fixture, "Meta").total, 2);
  assert.equal(
    selectedMetrics(fixture, "Meta", campaignKey("Meta", "Black")).total,
    1,
  );
  assert.equal(selectedMetrics(fixture, "Meta", "missing-campaign").total, 0);
  assert.equal(
    groupTrend(data.daily, true).reduce((n, p) => n + p.value, 0),
    3,
  );
});
test("goals avoid double-counting a company target plus its unit targets and block partial-history projections", () => {
  const data = {
    goal_month: "2026-11",
    goals: [
      { unit: "all", target: 300 },
      { unit: "ibes", target: 100 },
      { unit: "alecrim", target: 100 },
    ],
    monthly_units: { all: 60, ibes: 25 },
    coverage_start: "2026-11-01",
  };
  const g = goalProgress(
    data as never,
    "all",
    new Date("2026-11-04T15:00:00Z"),
  );
  assert.equal(g.target, 300);
  assert.equal(g.actual, 60);
  assert.equal(g.elapsed, 4);
  assert.equal(g.projection, 450);
  assert.equal(g.needed, 240 / 26);
  assert.equal(
    goalProgress(
      { ...data, coverage_start: "2026-11-02" } as never,
      "all",
      new Date("2026-11-04T15:00:00Z"),
    ).projection,
    null,
  );
  assert.equal(
    goalProgress(data as never, "ibes", new Date("2026-11-04T15:00:00Z"))
      .target,
    100,
  );
  assert.equal(
    goalProgress(data as never, "all", new Date("2026-10-31T15:00:00Z"))
      .elapsed,
    0,
  );
});
test("workspace BI requires a session and client assignment while sharing controls remain owner-only", async () => {
  const oldFetch = globalThis.fetch,
    env = { ...process.env };
  process.env.VITE_SUPABASE_URL = "https://db.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic";
  let assigned = true,
    visible = true;
  const reads: string[] = [];
  const client = "589481f6-3a15-4c93-b384-5d33373c20e3";
  globalThis.fetch = async (url) => {
    const p = String(url);
    reads.push(p);
    let value: unknown = [];
    if (p.endsWith("/auth/v1/user")) value = { id: "assigned-operator" };
    else if (p.includes("/profiles?"))
      value = [{ is_active: true, role: "gp", can_view_financials: false }];
    else if (p.includes("/client_assignments?"))
      value = assigned ? [{ user_id: "assigned-operator" }] : [];
    else if (p.includes("/clients?"))
      value = visible ? [{ id: client, name: "Client" }] : [];
    else if (p.includes("/storage/v1/object/sign"))
      value = { signedURL: "/logo" };
    return new Response(JSON.stringify(value));
  };
  const call = async (action: string, auth?: string) => {
    const res = {
      statusCode: 0,
      body: "",
      setHeader() {},
      end(v: string) {
        this.body = v;
      },
    };
    await handler(
      {
        method: "POST",
        headers: {
          origin: ORBE_ORIGIN,
          "content-type": "application/json",
          ...(auth ? { authorization: auth } : {}),
        },
        body: {
          action,
          client_id: client,
          start: "2026-11-01",
          end: "2026-11-04",
        },
      } as never,
      res as never,
    );
    return res;
  };
  try {
    assert.equal((await call("workspace_view")).statusCode, 403);
    assert.equal(
      reads.some((p) => p.includes("wa_tracking_records")),
      false,
    );
    const allowed = await call("workspace_view", "Bearer synthetic.jwt");
    assert.equal(allowed.statusCode, 200);
    assert.equal(JSON.parse(allowed.body).total, 0);
    assert.equal(
      (await call("preview", "Bearer synthetic.jwt")).statusCode,
      403,
    );
    assigned = false;
    reads.length = 0;
    assert.equal(
      (await call("workspace_view", "Bearer synthetic.jwt")).statusCode,
      403,
    );
    assert.equal(
      reads.some((p) => p.includes("wa_tracking_connections")),
      false,
    );
    assigned = true;
    visible = false;
    assert.equal(
      (await call("workspace_view", "Bearer synthetic.jwt")).statusCode,
      403,
    );
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of ["VITE_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
  }
});
