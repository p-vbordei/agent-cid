import { test, expect } from "bun:test";
import { build } from "../src/build";
import { verify } from "../src/verify";
import { makeSigner, testPriv, testDid, FIXED_TIMESTAMP, SAMPLE_BODY } from "./fixtures";

async function buildDefault() {
  return build(SAMPLE_BODY, {
    producer_did: testDid,
    schema_uri: "https://example.org/schemas/test",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
}

test("security §6 CID anchor — flipping any body byte fails verify", async () => {
  const m = await buildDefault();
  for (let i = 0; i < SAMPLE_BODY.length; i++) {
    const tampered = new Uint8Array(SAMPLE_BODY);
    tampered[i] = (tampered[i] ?? 0) ^ 0x01;
    const r = await verify(m, tampered);
    expect(r.ok).toBe(false);
  }
});

test("security §6 — mutating producer_did invalidates the signature", async () => {
  const m = await buildDefault();
  const mutated = { ...m, producer: "did:key:z6MkEvilProducer" };
  const r = await verify(mutated, SAMPLE_BODY);
  expect(r.ok).toBe(false);
});

test("security §6 — mutating schema_uri invalidates the signature", async () => {
  const m = await buildDefault();
  const mutated = { ...m, schema_uri: "https://evil.example.org/schemas/hijack" };
  const r = await verify(mutated, SAMPLE_BODY);
  expect(r.ok).toBe(false);
});

test("security §6 — mutating media_type invalidates the signature", async () => {
  const m = await buildDefault();
  const mutated = { ...m, media_type: "application/x-evil" };
  const r = await verify(mutated, SAMPLE_BODY);
  expect(r.ok).toBe(false);
});

test("security §6 — mutating parent_cid invalidates the signature", async () => {
  const body1 = new TextEncoder().encode("v1");
  const body2 = new TextEncoder().encode("v2");
  const parent = await buildDefault();
  const child = await build(body2, {
    producer_did: testDid,
    schema_uri: "https://example.org/schemas/test",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    parent_cid: parent.cid,
    signers: [makeSigner(testPriv, testDid)],
  });
  const mutated = { ...child, parent_cid: "bafkreiimpostor0000000000000000000000000000000000000000" };
  const r = await verify(mutated, body2);
  expect(r.ok).toBe(false);
});

test("security §6 — adding an unsigned sig entry causes verify to fail on that entry", async () => {
  const m = await buildDefault();
  const tampered = {
    ...m,
    sigs: [
      ...m.sigs,
      { signer_did: "did:key:z6MkForger", alg: "ed25519" as const, sig: "AAAA" },
    ],
  };
  const r = await verify(tampered, SAMPLE_BODY);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.includes("sigs[1]"))).toBe(true);
});

test("security §6 — removing the sole sig entry fails schema validation", async () => {
  const m = await buildDefault();
  const tampered = { ...m, sigs: [] };
  const r = await verify(tampered, SAMPLE_BODY);
  expect(r.ok).toBe(false);
});

test("security §6 — unsupported alg value fails schema validation", async () => {
  const m = await buildDefault();
  const tampered = { ...m, sigs: [{ ...m.sigs[0]!, alg: "rsa-sha256" as unknown as "ed25519" }] };
  const r = await verify(tampered, SAMPLE_BODY);
  expect(r.ok).toBe(false);
});
