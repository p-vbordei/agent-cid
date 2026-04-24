import { test, expect } from "bun:test";
import { pubkeyToDidKey, didKeyToPubkey } from "../src/did";

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
