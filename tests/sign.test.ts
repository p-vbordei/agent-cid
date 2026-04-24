import { expect, test } from "bun:test";
import * as ed from "@noble/ed25519";
import { b64decode, b64encode, verifyBytes } from "../src/sign";
import { testPriv, testPriv2, testPub } from "./fixtures";

test("verifyBytes accepts a signature from the matching key", () => {
  const msg = new TextEncoder().encode("hello");
  const sig = ed.sign(msg, testPriv);
  expect(verifyBytes(sig, msg, testPub)).toBe(true);
});

test("verifyBytes rejects a signature when the message is mutated", () => {
  const msg = new TextEncoder().encode("hello");
  const sig = ed.sign(msg, testPriv);
  const tampered = new TextEncoder().encode("hellp");
  expect(verifyBytes(sig, tampered, testPub)).toBe(false);
});

test("verifyBytes rejects a signature from a different key", () => {
  const msg = new TextEncoder().encode("hello");
  const sig = ed.sign(msg, testPriv2);
  expect(verifyBytes(sig, msg, testPub)).toBe(false);
});

test("b64encode / b64decode roundtrip", () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);
  expect(Array.from(b64decode(b64encode(bytes)))).toEqual(Array.from(bytes));
});
