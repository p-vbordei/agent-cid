import { test, expect } from "bun:test";
import { signBytes, verifyBytes, b64encode, b64decode } from "../src/sign";
import { testPriv, testPub, testPriv2 } from "./fixtures";

test("signBytes + verifyBytes roundtrip succeeds with matching key", () => {
  const msg = new TextEncoder().encode("hello");
  const sig = signBytes(msg, testPriv);
  expect(verifyBytes(sig, msg, testPub)).toBe(true);
});

test("verifyBytes fails when the message is mutated", () => {
  const msg = new TextEncoder().encode("hello");
  const sig = signBytes(msg, testPriv);
  const tampered = new TextEncoder().encode("hellp");
  expect(verifyBytes(sig, tampered, testPub)).toBe(false);
});

test("verifyBytes fails when the signature is from a different key", () => {
  const msg = new TextEncoder().encode("hello");
  const sig = signBytes(msg, testPriv2);
  expect(verifyBytes(sig, msg, testPub)).toBe(false);
});

test("b64encode / b64decode roundtrip", () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);
  expect(Array.from(b64decode(b64encode(bytes)))).toEqual(Array.from(bytes));
});
