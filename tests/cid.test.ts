import { expect, test } from "bun:test";
import { bytesToCID, verifyCID } from "../src/cid";

test("bytesToCID returns a CIDv1 base32 string starting with 'bafkrei'", async () => {
  const cid = await bytesToCID(new TextEncoder().encode("hello"));
  expect(cid.startsWith("bafkrei")).toBe(true);
  expect(cid.length).toBeGreaterThan(50);
});

test("bytesToCID is deterministic for the same input", async () => {
  const a = await bytesToCID(new TextEncoder().encode("hello"));
  const b = await bytesToCID(new TextEncoder().encode("hello"));
  expect(a).toBe(b);
});

test("bytesToCID differs when a single byte changes", async () => {
  const a = await bytesToCID(new Uint8Array([1, 2, 3, 4]));
  const b = await bytesToCID(new Uint8Array([1, 2, 3, 5]));
  expect(a).not.toBe(b);
});

test("verifyCID returns true for matching bytes", async () => {
  const bytes = new TextEncoder().encode("hello");
  const cid = await bytesToCID(bytes);
  expect(await verifyCID(cid, bytes)).toBe(true);
});

test("verifyCID returns false for tampered bytes", async () => {
  const bytes = new TextEncoder().encode("hello");
  const cid = await bytesToCID(bytes);
  const tampered = new TextEncoder().encode("hellp");
  expect(await verifyCID(cid, tampered)).toBe(false);
});
