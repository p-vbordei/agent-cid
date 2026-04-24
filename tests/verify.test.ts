import { test, expect } from "bun:test";
import { build } from "../src/build";
import { verify } from "../src/verify";
import {
  makeSigner,
  testPriv,
  testPriv2,
  testDid,
  testDid2,
  FIXED_TIMESTAMP,
  SAMPLE_BODY,
} from "./fixtures";

async function buildOne(signerList = [makeSigner(testPriv, testDid)]) {
  return build(SAMPLE_BODY, {
    producer_did: testDid,
    schema_uri: "https://example.org/schemas/test",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: signerList,
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
  const r = await verify(m, longer);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.includes("size mismatch") || e.includes("cid mismatch"))).toBe(true);
});

test("verify rejects a schema-malformed manifest", async () => {
  const bogus = { v: "agent-cid/1", cid: "x", size: 1, sigs: [] };
  const r = await verify(bogus, SAMPLE_BODY);
  expect(r.ok).toBe(false);
});

test("verify accepts a two-signer manifest", async () => {
  const m = await buildOne([makeSigner(testPriv, testDid), makeSigner(testPriv2, testDid2)]);
  expect(m.sigs.length).toBe(2);
  const r = await verify(m, SAMPLE_BODY);
  expect(r.ok).toBe(true);
});

test("verify fails when one of several signatures is swapped", async () => {
  const m = await buildOne([makeSigner(testPriv, testDid), makeSigner(testPriv2, testDid2)]);
  // Tamper sig[1].sig (base64 swap the first char so decoded bytes differ).
  const badSig = m.sigs[1]!.sig[0] === "A" ? `B${m.sigs[1]!.sig.slice(1)}` : `A${m.sigs[1]!.sig.slice(1)}`;
  const tampered = { ...m, sigs: [m.sigs[0]!, { ...m.sigs[1]!, sig: badSig }] };
  const r = await verify(tampered, SAMPLE_BODY);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.includes("sigs[1]"))).toBe(true);
});
