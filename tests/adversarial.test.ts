// Adversarial tests — explicitly try to break agent-cid's invariants.
// Each test names what it's hunting for so a failure points right at the bug.

import { expect, test } from "bun:test";
import * as ed from "@noble/ed25519";
import { base58btc } from "multiformats/bases/base58";
import { build } from "../src/build";
import { didKeyToPubkey, didWebToUrl, parseEd25519FromDidDoc, pubkeyToDidKey } from "../src/did";
import { fetchDidWebPubkey } from "../src/did-web";
import type { DidResolver } from "../src/types";
import { __resetResolverCache, verify } from "../src/verify";
import { FIXED_TIMESTAMP, makeSigner, testDid, testPriv, testPub } from "./fixtures";

// ─── did:key — multicodec / length boundary ─────────────────────────────────

test("did:key with secp256k1 multicodec (0xe7) is rejected", () => {
  // multicodec varint for secp256k1 pubkey is 0xe7 0x01
  const bytes = new Uint8Array([0xe7, 0x01, ...new Uint8Array(33).fill(0xab)]);
  const did = `did:key:${base58btc.encode(bytes)}`;
  expect(() => didKeyToPubkey(did)).toThrow(/multicodec/);
});

test("did:key with 33-byte payload after multicodec (oversized) is rejected", () => {
  const bytes = new Uint8Array([0xed, 0x01, ...new Uint8Array(33).fill(0x77)]);
  const did = `did:key:${base58btc.encode(bytes)}`;
  expect(() => didKeyToPubkey(did)).toThrow(/length/);
});

test("did:key with empty payload after multicodec is rejected", () => {
  const bytes = new Uint8Array([0xed, 0x01]);
  const did = `did:key:${base58btc.encode(bytes)}`;
  expect(() => didKeyToPubkey(did)).toThrow(/length/);
});

// ─── did:web — URL traversal & host parsing ─────────────────────────────────

test("did:web with URL-encoded `..` path segment is rejected (decodes BEFORE check)", () => {
  expect(() => didWebToUrl("did:web:example.com:%2e%2e:secret")).toThrow(/path segment/);
});

test("did:web with mixed-case URL-encoded `..` is rejected", () => {
  expect(() => didWebToUrl("did:web:example.com:%2E%2E:secret")).toThrow(/path segment/);
});

test("did:web with empty host (no chars before first `:`) is rejected", () => {
  expect(() => didWebToUrl("did:web::missing:host")).toThrow(/host/);
});

test("did:web with double-encoded `..` does NOT decode to `..` (stays as literal %2e%2e)", () => {
  // %252e decodes to %2e (single decode); only one round of decodeURIComponent runs
  // so the segment stays "%2e%2e" — a valid path segment, not traversal.
  // This documents the boundary: we decode ONCE, not recursively.
  const url = didWebToUrl("did:web:example.com:%252e%252e:foo");
  expect(url).toBe("https://example.com/%2e%2e/foo/did.json");
});

test("did:web with single dot is rejected", () => {
  expect(() => didWebToUrl("did:web:example.com:.")).toThrow(/path segment/);
});

// ─── fetchDidWebPubkey — error paths ─────────────────────────────────────────

test("fetchDidWebPubkey rejects malformed JSON body", async () => {
  const stub = (async () =>
    new Response("{ this is not JSON", { status: 200 })) as unknown as typeof fetch;
  await expect(fetchDidWebPubkey("did:web:example.com", { fetch: stub })).rejects.toThrow();
});

test("fetchDidWebPubkey rejects DID doc with no verificationMethod array", async () => {
  const stub = (async () =>
    new Response(JSON.stringify({ id: "did:web:example.com" }), {
      status: 200,
    })) as unknown as typeof fetch;
  await expect(fetchDidWebPubkey("did:web:example.com", { fetch: stub })).rejects.toThrow(
    /verificationMethod/,
  );
});

test("fetchDidWebPubkey rejects DID doc whose methods reference a different DID", async () => {
  // Method controller is did:web:other.com but we asked for did:web:example.com
  const TEST_PUB = new Uint8Array(32).fill(0xab);
  const TEST_PUB_MB = pubkeyToDidKey(TEST_PUB).slice("did:key:".length);
  const otherDoc = {
    id: "did:web:other.com",
    verificationMethod: [
      {
        id: "did:web:other.com#key-1",
        type: "Ed25519VerificationKey2020",
        controller: "did:web:other.com",
        publicKeyMultibase: TEST_PUB_MB,
      },
    ],
  };
  const stub = (async () =>
    new Response(JSON.stringify(otherDoc), { status: 200 })) as unknown as typeof fetch;
  await expect(fetchDidWebPubkey("did:web:example.com", { fetch: stub })).rejects.toThrow(
    /no Ed25519 verification method/,
  );
});

// ─── verify — schema/wire-level edge cases ──────────────────────────────────

test("build → verify roundtrip on a 0-byte body", async () => {
  const empty = new Uint8Array(0);
  const m = await build(empty, {
    producer_did: testDid,
    schema_uri: "https://example.org/empty",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
  expect(m.size).toBe(0);
  const r = await verify(m, empty);
  expect(r.ok).toBe(true);
});

test("verify accepts a single manifest whose parent_cid equals its own cid (self-reference)", async () => {
  // Build, then mutate parent_cid to match cid. The signature was over the unsigned manifest
  // WITHOUT this parent_cid, so this mutation should fail verify (sig mismatch), proving
  // we can't trivially craft a self-referential manifest after the fact.
  const body = new TextEncoder().encode("self-ref");
  const m = await build(body, {
    producer_did: testDid,
    schema_uri: "https://example.org/s",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
  const mutated = { ...m, parent_cid: m.cid };
  const r = await verify(mutated, body);
  expect(r.ok).toBe(false);
});

test("verify rejects a manifest whose signer_did uses an unsupported DID method", async () => {
  const body = new TextEncoder().encode("unsupported");
  const m = await build(body, {
    producer_did: testDid,
    schema_uri: "https://example.org/s",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
  // Tamper signer_did to a method we never resolve.
  const tampered = {
    ...m,
    sigs: [{ ...m.sigs[0]!, signer_did: "did:plc:abc123" }],
  };
  const r = await verify(tampered, body);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.some((e) => e.includes("unsupported DID method"))).toBe(true);
});

// ─── cache — cross-resolver pollution ───────────────────────────────────────

test("documented behaviour: cache is process-global; two resolvers for the same DID share an entry", async () => {
  // This documents a known limitation rather than asserting "correct" behaviour:
  // since the cache is module-scoped and keyed by DID alone, swapping resolvers
  // between calls does NOT invalidate the cache. Users needing isolation pass
  // resolverCache: false. If we ever scope the cache per-resolver, this test
  // will start failing — that's the intended signal.
  __resetResolverCache();
  const body = new TextEncoder().encode("cache-pollution");
  const m = await build(body, {
    producer_did: testDid,
    schema_uri: "https://example.org/s",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
  // First call: resolver returns the correct key.
  const correctResolver: DidResolver = () => testPub;
  const r1 = await verify(m, body, { resolver: correctResolver });
  expect(r1.ok).toBe(true);
  // Second call with a DIFFERENT resolver returning a different key: cache hits with
  // the stale "correct" key, so verify still passes (and wrongResolver is never called).
  let wrongResolverCalls = 0;
  const wrongResolver: DidResolver = () => {
    wrongResolverCalls++;
    return ed.getPublicKey(new Uint8Array(32).fill(0x99));
  };
  const r2 = await verify(m, body, { resolver: wrongResolver });
  expect(r2.ok).toBe(true); // cache served the stale-but-correct key
  expect(wrongResolverCalls).toBe(0); // wrongResolver was never invoked
});

test("cache: resolverCache: false isolates a wrong-key resolver from a prior cached entry", async () => {
  __resetResolverCache();
  const body = new TextEncoder().encode("cache-bypass");
  const m = await build(body, {
    producer_did: testDid,
    schema_uri: "https://example.org/s",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
  // Prime cache with correct key.
  await verify(m, body, { resolver: () => testPub });
  // Now bypass cache; wrong resolver should actually run.
  let wrongResolverCalls = 0;
  const wrongResolver: DidResolver = () => {
    wrongResolverCalls++;
    return ed.getPublicKey(new Uint8Array(32).fill(0x99));
  };
  const r = await verify(m, body, { resolver: wrongResolver, resolverCache: false });
  expect(r.ok).toBe(false);
  expect(wrongResolverCalls).toBe(1);
});

// ─── parseEd25519FromDidDoc — adversarial DID document shapes ───────────────

test("parseEd25519FromDidDoc takes the FIRST matching method (later methods ignored)", () => {
  const realPub = new Uint8Array(32).fill(0xaa);
  const fakePub = new Uint8Array(32).fill(0xbb);
  const realMb = pubkeyToDidKey(realPub).slice("did:key:".length);
  const fakeMb = pubkeyToDidKey(fakePub).slice("did:key:".length);
  const doc = {
    id: "did:web:example.com",
    verificationMethod: [
      {
        id: "did:web:example.com#real",
        type: "Ed25519VerificationKey2020",
        controller: "did:web:example.com",
        publicKeyMultibase: realMb,
      },
      {
        id: "did:web:example.com#fake",
        type: "Ed25519VerificationKey2020",
        controller: "did:web:example.com",
        publicKeyMultibase: fakeMb,
      },
    ],
  };
  const pub = parseEd25519FromDidDoc(doc, "did:web:example.com");
  expect(pub.every((b) => b === 0xaa)).toBe(true);
});

test("parseEd25519FromDidDoc skips non-Ed25519 methods and falls through to the next", () => {
  const realPub = new Uint8Array(32).fill(0xaa);
  const realMb = pubkeyToDidKey(realPub).slice("did:key:".length);
  const doc = {
    id: "did:web:example.com",
    verificationMethod: [
      {
        id: "did:web:example.com#rsa-decoy",
        type: "RsaVerificationKey2018",
        controller: "did:web:example.com",
        publicKeyMultibase: "zSomeRsaThing",
      },
      {
        id: "did:web:example.com#ed-real",
        type: "Ed25519VerificationKey2020",
        controller: "did:web:example.com",
        publicKeyMultibase: realMb,
      },
    ],
  };
  const pub = parseEd25519FromDidDoc(doc, "did:web:example.com");
  expect(pub.every((b) => b === 0xaa)).toBe(true);
});

test("parseEd25519FromDidDoc throws when an Ed25519 method has no publicKeyMultibase", () => {
  const doc = {
    id: "did:web:example.com",
    verificationMethod: [
      {
        id: "did:web:example.com#key",
        type: "Ed25519VerificationKey2020",
        controller: "did:web:example.com",
        // publicKeyMultibase intentionally omitted
      },
    ],
  };
  expect(() => parseEd25519FromDidDoc(doc, "did:web:example.com")).toThrow();
});
