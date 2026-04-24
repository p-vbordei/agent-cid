import { expect, test } from "bun:test";
import { ManifestSchema } from "../src/types";

test("ManifestSchema accepts a minimal valid manifest", () => {
  const m = {
    v: "agent-cid/1",
    cid: "bafkreiaaaaaaaa",
    size: 16,
    media_type: "application/json",
    schema_uri: "https://example.org/s/1",
    producer: "did:key:z6MkaaaA",
    created_at: "2026-01-01T00:00:00Z",
    sigs: [{ signer_did: "did:key:z6MkaaaA", alg: "ed25519", sig: "AAAA" }],
  };
  const parsed = ManifestSchema.safeParse(m);
  expect(parsed.success).toBe(true);
});

test("ManifestSchema rejects wrong version", () => {
  const m = {
    v: "agent-cid/2",
    cid: "bafkreiaaaaaaaa",
    size: 16,
    media_type: "application/json",
    schema_uri: "https://example.org/s/1",
    producer: "did:key:z6MkaaaA",
    created_at: "2026-01-01T00:00:00Z",
    sigs: [{ signer_did: "did:key:z6MkaaaA", alg: "ed25519", sig: "AAAA" }],
  };
  expect(ManifestSchema.safeParse(m).success).toBe(false);
});

test("ManifestSchema requires at least one signature", () => {
  const m = {
    v: "agent-cid/1",
    cid: "bafkreiaaaaaaaa",
    size: 16,
    media_type: "application/json",
    schema_uri: "https://example.org/s/1",
    producer: "did:key:z6MkaaaA",
    created_at: "2026-01-01T00:00:00Z",
    sigs: [],
  };
  expect(ManifestSchema.safeParse(m).success).toBe(false);
});

test("ManifestSchema accepts optional parent_cid and retention", () => {
  const m = {
    v: "agent-cid/1",
    cid: "bafkreiaaaaaaaa",
    size: 16,
    media_type: "application/json",
    schema_uri: "https://example.org/s/1",
    producer: "did:key:z6MkaaaA",
    created_at: "2026-01-01T00:00:00Z",
    parent_cid: "bafkreibbbbbbb",
    retention: { stale_after: "2027-01-01T00:00:00Z", expires_at: "2028-01-01T00:00:00Z" },
    sigs: [{ signer_did: "did:key:z6MkaaaA", alg: "ed25519", sig: "AAAA" }],
  };
  expect(ManifestSchema.safeParse(m).success).toBe(true);
});
