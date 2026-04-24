import { test, expect } from "bun:test";
import { build } from "../src/build";
import { verifyChain } from "../src/verify";
import { makeSigner, testPriv, testDid, FIXED_TIMESTAMP } from "./fixtures";

async function buildAt(body: Uint8Array, parent?: string) {
  return build(body, {
    producer_did: testDid,
    schema_uri: "https://example.org/schemas/test",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    parent_cid: parent,
    signers: [makeSigner(testPriv, testDid)],
  });
}

test("verifyChain returns ok for a 3-version chain", async () => {
  const b1 = new TextEncoder().encode("v1");
  const b2 = new TextEncoder().encode("v2");
  const b3 = new TextEncoder().encode("v3");
  const m1 = await buildAt(b1);
  const m2 = await buildAt(b2, m1.cid);
  const m3 = await buildAt(b3, m2.cid);
  const r = await verifyChain([
    { manifest: m1, bytes: b1 },
    { manifest: m2, bytes: b2 },
    { manifest: m3, bytes: b3 },
  ]);
  expect(r.ok).toBe(true);
});

test("verifyChain flags a broken parent_cid link", async () => {
  const b1 = new TextEncoder().encode("v1");
  const b2 = new TextEncoder().encode("v2");
  const b3 = new TextEncoder().encode("v3");
  const m1 = await buildAt(b1);
  const m2 = await buildAt(b2, m1.cid);
  const m3 = await buildAt(b3, "bafkreibogusparentcid000000000000000000000000000000000000");
  const r = await verifyChain([
    { manifest: m1, bytes: b1 },
    { manifest: m2, bytes: b2 },
    { manifest: m3, bytes: b3 },
  ]);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.includes("chain[2]") && e.includes("parent_cid"))).toBe(true);
});

test("verifyChain flags a middle link whose signature does not verify", async () => {
  const b1 = new TextEncoder().encode("v1");
  const b2 = new TextEncoder().encode("v2");
  const b3 = new TextEncoder().encode("v3");
  const m1 = await buildAt(b1);
  const m2 = await buildAt(b2, m1.cid);
  const m3 = await buildAt(b3, m2.cid);
  // Corrupt middle signature
  const badMiddle = { ...m2, sigs: [{ ...m2.sigs[0]!, sig: "AAAA" }] };
  const r = await verifyChain([
    { manifest: m1, bytes: b1 },
    { manifest: badMiddle, bytes: b2 },
    { manifest: m3, bytes: b3 },
  ]);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.includes("chain[1]"))).toBe(true);
});
