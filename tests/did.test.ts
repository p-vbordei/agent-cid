import { expect, test } from "bun:test";
import { didKeyToPubkey, didWebToUrl, parseEd25519FromDidDoc, pubkeyToDidKey } from "../src/did";

// A deterministic 32-byte Ed25519 public key (not a real random key — fine for shape tests).
const PUBKEY = new Uint8Array(32).fill(0xab);

test("pubkeyToDidKey produces a did:key:z... string", () => {
  const did = pubkeyToDidKey(PUBKEY);
  expect(did.startsWith("did:key:z")).toBe(true);
});

test("didKeyToPubkey inverts pubkeyToDidKey", () => {
  const did = pubkeyToDidKey(PUBKEY);
  const back = didKeyToPubkey(did);
  expect(back.length).toBe(32);
  expect(Array.from(back)).toEqual(Array.from(PUBKEY));
});

test("pubkeyToDidKey rejects non-32-byte input", () => {
  expect(() => pubkeyToDidKey(new Uint8Array(16))).toThrow();
});

test("didKeyToPubkey rejects non-did:key input", () => {
  expect(() => didKeyToPubkey("did:web:example.com")).toThrow();
});

test("didWebToUrl: bare host → /.well-known/did.json", () => {
  expect(didWebToUrl("did:web:example.com")).toBe("https://example.com/.well-known/did.json");
});

test("didWebToUrl: path segments → nested path/did.json", () => {
  expect(didWebToUrl("did:web:example.com:user:alice")).toBe(
    "https://example.com/user/alice/did.json",
  );
});

test("didWebToUrl: encoded port → real port", () => {
  expect(didWebToUrl("did:web:example.com%3A8443:user:alice")).toBe(
    "https://example.com:8443/user/alice/did.json",
  );
});

test("didWebToUrl rejects non-did:web", () => {
  expect(() => didWebToUrl("did:key:z6Mk")).toThrow();
});

test("didWebToUrl rejects path traversal", () => {
  expect(() => didWebToUrl("did:web:example.com:..:secret")).toThrow();
});

const SAMPLE_PUB_MB = pubkeyToDidKey(new Uint8Array(32).fill(0xab)).slice("did:key:".length);
const SAMPLE_DOC = {
  id: "did:web:example.com",
  verificationMethod: [
    {
      id: "did:web:example.com#key-1",
      type: "Ed25519VerificationKey2020",
      controller: "did:web:example.com",
      publicKeyMultibase: SAMPLE_PUB_MB,
    },
  ],
};

test("parseEd25519FromDidDoc returns 32 bytes for a matching method", () => {
  const pub = parseEd25519FromDidDoc(SAMPLE_DOC, "did:web:example.com");
  expect(pub.length).toBe(32);
  expect(pub.every((b) => b === 0xab)).toBe(true);
});

test("parseEd25519FromDidDoc throws when no verification method matches", () => {
  expect(() => parseEd25519FromDidDoc(SAMPLE_DOC, "did:web:other.example.com")).toThrow();
});

test("parseEd25519FromDidDoc throws on unsupported key type", () => {
  const doc = {
    ...SAMPLE_DOC,
    verificationMethod: [{ ...SAMPLE_DOC.verificationMethod[0], type: "RsaVerificationKey2018" }],
  };
  expect(() => parseEd25519FromDidDoc(doc, "did:web:example.com")).toThrow();
});
