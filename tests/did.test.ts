import { expect, test } from "bun:test";
import { didKeyToPubkey, didWebToUrl, pubkeyToDidKey } from "../src/did";

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
