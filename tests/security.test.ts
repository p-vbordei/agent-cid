import { test, expect } from "bun:test";
import { build } from "../src/build";
import { verify } from "../src/verify";
import { makeSigner, testPriv, testDid, FIXED_TIMESTAMP, SAMPLE_BODY } from "./fixtures";

async function buildDefault() {
  return build(SAMPLE_BODY, {
    producer_did: testDid,
    schema_uri: "https://example.org/schemas/test",
    media_type: "application/octet-stream",
    created_at: FIXED_TIMESTAMP,
    signers: [makeSigner(testPriv, testDid)],
  });
}

test("security §6 CID anchor — flipping any body byte fails verify", async () => {
  const m = await buildDefault();
  for (let i = 0; i < SAMPLE_BODY.length; i++) {
    const tampered = new Uint8Array(SAMPLE_BODY);
    tampered[i] = (tampered[i] ?? 0) ^ 0x01;
    const r = await verify(m, tampered);
    expect(r.ok).toBe(false);
  }
});
