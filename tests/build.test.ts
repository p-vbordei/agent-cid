import { test, expect } from "bun:test";
import { build } from "../src/build";
import { ManifestSchema } from "../src/types";
import { makeSigner, testPriv, testDid, FIXED_TIMESTAMP, SAMPLE_BODY } from "./fixtures";

test("build produces a schema-valid manifest with one signer", async () => {
  const m = await build(SAMPLE_BODY, {
    producer_did: testDid,
    schema_uri: "https://example.org/schemas/test",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
  const parsed = ManifestSchema.safeParse(m);
  expect(parsed.success).toBe(true);
});

test("build sets cid to the sha-256 multihash of the bytes", async () => {
  const m = await build(SAMPLE_BODY, {
    producer_did: testDid,
    schema_uri: "https://example.org/schemas/test",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
  expect(m.cid.startsWith("bafkrei")).toBe(true);
  expect(m.size).toBe(SAMPLE_BODY.length);
});

test("build defaults created_at to now when omitted", async () => {
  const before = Date.now();
  const m = await build(SAMPLE_BODY, {
    producer_did: testDid,
    schema_uri: "https://example.org/schemas/test",
    media_type: "application/octet-stream",
    signers: [makeSigner(testPriv, testDid)],
  });
  const after = Date.now();
  const t = Date.parse(m.created_at);
  expect(t).toBeGreaterThanOrEqual(before);
  expect(t).toBeLessThanOrEqual(after);
});

test("build throws when signers is empty", async () => {
  await expect(
    build(SAMPLE_BODY, {
      producer_did: testDid,
      schema_uri: "https://example.org/schemas/test",
      media_type: "application/octet-stream",
      signers: [],
    }),
  ).rejects.toThrow(/at least one signer/);
});

test("build includes parent_cid and retention when provided", async () => {
  const m = await build(SAMPLE_BODY, {
    producer_did: testDid,
    schema_uri: "https://example.org/schemas/test",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    parent_cid: "bafkreiprevious0000000000000000000000000000000000000000",
    retention: { stale_after: "2027-01-01T00:00:00Z", expires_at: "2028-01-01T00:00:00Z" },
    signers: [makeSigner(testPriv, testDid)],
  });
  expect(m.parent_cid).toBe("bafkreiprevious0000000000000000000000000000000000000000");
  expect(m.retention?.expires_at).toBe("2028-01-01T00:00:00Z");
});
