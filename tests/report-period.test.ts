import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
registerHooks({
  resolve(s, c, n) {
    if (c.parentURL?.includes("/src/lib/")) {
      if (s.endsWith(".js")) s = s.replace(/\.js$/, ".ts");
      else if (s.startsWith(".") && !/\.[a-z]+$/.test(s)) s += ".ts";
    }
    return n(s, c);
  },
});
const { isReportDate, periodError, presetPeriod, normalizePeriod } =
  await import("../src/lib/reportPeriod.ts");
const { parseTrackingRoute } = await import("../src/lib/trackingRoute.ts");
const { dailyLeads } = await import("../src/lib/biDashboard.ts");
test("date presets use Brasilia day and inclusive ranges at UTC midnight", () => {
  const now = new Date("2026-11-03T01:00:00Z");
  assert.deepEqual(presetPeriod("today", now), {
    start: "2026-11-02",
    end: "2026-11-02",
  });
  assert.deepEqual(presetPeriod("yesterday", now), {
    start: "2026-11-01",
    end: "2026-11-01",
  });
  assert.deepEqual(presetPeriod("last30", now), {
    start: "2026-10-04",
    end: "2026-11-02",
  });
  assert.deepEqual(presetPeriod("month", now), {
    start: "2026-11-01",
    end: "2026-11-02",
  });
  assert.deepEqual(
    presetPeriod("previousMonth", new Date("2024-03-01T12:00:00Z")),
    { start: "2024-02-01", end: "2024-02-29" },
  );
});
test("maximum retains full tracking history and declares the existing Ads query limit", () => {
  assert.deepEqual(presetPeriod("maximum"), { start: "", end: "" });
  const range = presetPeriod("maximum", new Date("2026-11-03T12:00:00Z"), 93);
  assert.equal(
    (Date.parse(range.end) - Date.parse(range.start)) / 86400000,
    92,
  );
  assert.equal(periodError(range, 93), "");
  assert.notEqual(
    periodError({ start: "2026-01-01", end: "2026-11-03" }, 93),
    "",
  );
});
test("partial years, impossible dates and reversed ranges cannot become chart input", () => {
  for (const value of [
    "0002-11-01",
    "0202-11-01",
    "2026-02-30",
    "9999-12-31",
    "BAD",
  ])
    assert.equal(isReportDate(value), false);
  const fallback = { start: "2026-10-05", end: "2026-11-03" };
  assert.deepEqual(
    normalizePeriod({ start: "0002-11-01", end: "2026-11-03" }, fallback),
    fallback,
  );
  assert.deepEqual(
    normalizePeriod({ start: "2026-11-03", end: "2026-10-01" }, fallback),
    fallback,
  );
  const route = parseTrackingRoute(
    "#clientes/rayafit?de=0002-11-01&ate=2026-11-03",
  );
  assert.ok(isReportDate(route.start));
  assert.ok(route.start <= route.end);
  assert.notEqual(periodError({ start: "2026-11-03", end: "2026-10-01" }), "");
});
test("long history is aggregated monthly without losing events or creating unbounded SVG points", () => {
  const row = (at: string) => ({
    entity: "messages",
    entity_key: at,
    occurred_at: at,
    payload: {},
  });
  const points = dailyLeads(
    [
      row("2000-01-01T03:00:00Z"),
      row("2026-11-03T12:00:00Z"),
      row("2026-11-04T12:00:00Z"),
      row("invalid"),
    ],
    "2000-01-01",
    "2026-11-03",
  );
  assert.equal(
    points.reduce((n, p) => n + p.value, 0),
    2,
  );
  assert.ok(points.length < 400);
  assert.deepEqual(dailyLeads([], "0002-11-01", "2026-11-03"), []);
  assert.deepEqual(dailyLeads([], "2026-11-03", "2026-10-01"), []);
});
