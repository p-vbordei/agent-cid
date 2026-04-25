import { expect, test } from "bun:test";
import * as ed from "@noble/ed25519";
import { build } from "../src/build";
import type { DidResolver } from "../src/types";
import { verify } from "../src/verify";
import { FIXED_TIMESTAMP, SAMPLE_BODY, makeSigner, testDid, testPriv, testPub } from "./fixtures";

test("verify accepts a custom resolver returning the right pubkey", async () => {
  const m = await build(SAMPLE_BODY, {
    producer_did: testDid,
    schema_uri: "https://example.org/s/1",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
  const stub: DidResolver = (did) => {
    if (did === testDid) return testPub;
    throw new Error(`unknown DID: ${did}`);
  };
  const r = await verify(m, SAMPLE_BODY, { resolver: stub });
  expect(r.ok).toBe(true);
});

test("verify with custom resolver returning wrong key fails", async () => {
  const m = await build(SAMPLE_BODY, {
    producer_did: testDid,
    schema_uri: "https://example.org/s/1",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
  const wrong: DidResolver = () => ed.getPublicKey(new Uint8Array(32).fill(0x99));
  const r = await verify(m, SAMPLE_BODY, { resolver: wrong });
  expect(r.ok).toBe(false);
});

test("default resolver throws on unknown DID method", async () => {
  const m = await build(SAMPLE_BODY, {
    producer_did: testDid,
    schema_uri: "https://example.org/s/1",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
  // Tamper signer_did to a method we don't support
  const bogus = {
    ...m,
    sigs: [{ ...m.sigs[0]!, signer_did: "did:dht:abc123" }],
  };
  const r = await verify(bogus, SAMPLE_BODY);
  expect(r.ok).toBe(false);
});
