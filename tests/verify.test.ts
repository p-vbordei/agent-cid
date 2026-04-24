import { test, expect } from "bun:test";
import { build } from "../src/build";
import { verify } from "../src/verify";
import { makeSigner, testPriv, testDid, FIXED_TIMESTAMP, SAMPLE_BODY } from "./fixtures";

async function buildOne() {
  return build(SAMPLE_BODY, {
    producer_did: testDid,
    schema_uri: "https://example.org/schemas/test",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
}

test("verify returns ok for a freshly built manifest and its bytes", async () => {
  const m = await buildOne();
  const r = await verify(m, SAMPLE_BODY);
  expect(r.ok).toBe(true);
});

test("verify returns cid mismatch when bytes are tampered", async () => {
  const m = await buildOne();
  const tampered = new Uint8Array(SAMPLE_BODY);
  tampered[0] = (tampered[0] ?? 0) ^ 0xff;
  const r = await verify(m, tampered);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.includes("cid mismatch"))).toBe(true);
});

test("verify returns size mismatch when byte length changes", async () => {
  const m = await buildOne();
  const longer = new Uint8Array(SAMPLE_BODY.length + 1);
  longer.set(SAMPLE_BODY);
  longer[SAMPLE_BODY.length] = 0x00;
  const r = await verify(m, longer);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.includes("size mismatch") || e.includes("cid mismatch"))).toBe(true);
});

test("verify rejects a schema-malformed manifest", async () => {
  const bogus = { v: "agent-cid/1", cid: "x", size: 1, sigs: [] };
  const r = await verify(bogus, SAMPLE_BODY);
  expect(r.ok).toBe(false);
});
