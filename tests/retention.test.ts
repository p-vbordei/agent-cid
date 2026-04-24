import { expect, test } from "bun:test";
import { build } from "../src/build";
import { verify } from "../src/verify";
import { FIXED_TIMESTAMP, SAMPLE_BODY, makeSigner, testDid, testPriv } from "./fixtures";

const NOW = Date.parse("2026-06-01T00:00:00.000Z");

async function buildWithRetention(retention: { stale_after?: string; expires_at?: string }) {
  return build(SAMPLE_BODY, {
    producer_did: testDid,
    schema_uri: "https://example.org/schemas/test",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    retention,
    signers: [makeSigner(testPriv, testDid)],
  });
}

test("verify passes when expires_at is in the future", async () => {
  const m = await buildWithRetention({ expires_at: "2030-01-01T00:00:00Z" });
  const r = await verify(m, SAMPLE_BODY, { now: NOW });
  expect(r.ok).toBe(true);
});

test("verify fails when expires_at is in the past", async () => {
  const m = await buildWithRetention({ expires_at: "2025-01-01T00:00:00Z" });
  const r = await verify(m, SAMPLE_BODY, { now: NOW });
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.includes("expired at"))).toBe(true);
});

test("verify with ignoreExpiry passes but warns when expires_at is in the past", async () => {
  const m = await buildWithRetention({ expires_at: "2025-01-01T00:00:00Z" });
  const r = await verify(m, SAMPLE_BODY, { now: NOW, ignoreExpiry: true });
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.warnings.some((w) => w.includes("expired at"))).toBe(true);
});

test("verify warns (does not fail) when stale_after is in the past", async () => {
  const m = await buildWithRetention({ stale_after: "2025-01-01T00:00:00Z" });
  const r = await verify(m, SAMPLE_BODY, { now: NOW });
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.warnings.some((w) => w.includes("stale since"))).toBe(true);
});

test("verify is silent when retention is absent", async () => {
  const m = await build(SAMPLE_BODY, {
    producer_did: testDid,
    schema_uri: "https://example.org/schemas/test",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
  const r = await verify(m, SAMPLE_BODY, { now: NOW });
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.warnings.length).toBe(0);
});
