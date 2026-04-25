import { expect, test } from "bun:test";
import * as ed from "@noble/ed25519";
import { build } from "../src/build";
import { pubkeyToDidKey } from "../src/did";
import { fetchDidWebPubkey } from "../src/did-web";
import type { DidResolver } from "../src/types";
import { __resetResolverCache, verify } from "../src/verify";
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
  __resetResolverCache();
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

test("custom resolver delegating to fetchDidWebPubkey verifies a did:web manifest", async () => {
  const webDid = "did:web:example.com";
  const TEST_PUB_MB = pubkeyToDidKey(testPub).slice("did:key:".length);
  const didDoc = {
    id: webDid,
    verificationMethod: [
      {
        id: `${webDid}#key-1`,
        type: "Ed25519VerificationKey2020",
        controller: webDid,
        publicKeyMultibase: TEST_PUB_MB,
      },
    ],
  };
  const m = await build(SAMPLE_BODY, {
    producer_did: webDid,
    schema_uri: "https://example.org/s/1",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [{ did: webDid, signFn: (b) => ed.sign(b, testPriv) }],
  });
  const stubFetch = (async () =>
    new Response(JSON.stringify(didDoc), { status: 200 })) as unknown as typeof fetch;
  const r = await verify(m, SAMPLE_BODY, {
    resolver: (did) => fetchDidWebPubkey(did, { fetch: stubFetch }),
  });
  expect(r.ok).toBe(true);
});

test("cached resolver only calls inner once for repeated DIDs", async () => {
  __resetResolverCache();
  let calls = 0;
  const inner: DidResolver = (did) => {
    calls++;
    if (did === testDid) return testPub;
    throw new Error(`unknown DID: ${did}`);
  };
  const m = await build(SAMPLE_BODY, {
    producer_did: testDid,
    schema_uri: "https://example.org/s/1",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
  await verify(m, SAMPLE_BODY, { resolver: inner });
  await verify(m, SAMPLE_BODY, { resolver: inner });
  expect(calls).toBe(1);
});

test("resolverCache: false bypasses the cache", async () => {
  __resetResolverCache();
  let calls = 0;
  const inner: DidResolver = (did) => {
    calls++;
    if (did === testDid) return testPub;
    throw new Error(`unknown DID: ${did}`);
  };
  const m = await build(SAMPLE_BODY, {
    producer_did: testDid,
    schema_uri: "https://example.org/s/1",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
  await verify(m, SAMPLE_BODY, { resolver: inner, resolverCache: false });
  await verify(m, SAMPLE_BODY, { resolver: inner, resolverCache: false });
  expect(calls).toBe(2);
});
