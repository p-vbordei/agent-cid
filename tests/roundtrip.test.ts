import { expect, test } from "bun:test";
import { build } from "../src/build";
import { verify } from "../src/verify";
import { FIXED_TIMESTAMP, makeSigner, testDid, testPriv } from "./fixtures";

test("roundtrip: build → verify succeeds on a 1 KiB body", async () => {
  const body = new Uint8Array(1024);
  for (let i = 0; i < body.length; i++) body[i] = i & 0xff;
  const m = await build(body, {
    producer_did: testDid,
    schema_uri: "https://example.org/schemas/roundtrip",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
  const r = await verify(m, body);
  expect(r.ok).toBe(true);
});
