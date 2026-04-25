import { expect, test } from "bun:test";
import { pubkeyToDidKey } from "../src/did";
import { fetchDidWebPubkey } from "../src/did-web";

const TEST_PUB = new Uint8Array(32).fill(0xab);
const TEST_PUB_MB = pubkeyToDidKey(TEST_PUB).slice("did:key:".length);
const TEST_DOC = {
  id: "did:web:example.com",
  verificationMethod: [
    {
      id: "did:web:example.com#key-1",
      type: "Ed25519VerificationKey2020",
      controller: "did:web:example.com",
      publicKeyMultibase: TEST_PUB_MB,
    },
  ],
};

function stubFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

test("fetchDidWebPubkey returns the pubkey from a valid did.json", async () => {
  const pub = await fetchDidWebPubkey("did:web:example.com", { fetch: stubFetch(TEST_DOC) });
  expect(pub.length).toBe(32);
  expect(pub.every((b) => b === 0xab)).toBe(true);
});

test("fetchDidWebPubkey throws on non-2xx", async () => {
  await expect(
    fetchDidWebPubkey("did:web:example.com", { fetch: stubFetch({}, 404) }),
  ).rejects.toThrow(/404/);
});

test("fetchDidWebPubkey rejects oversized payload", async () => {
  const huge = { padding: "x".repeat(70_000) };
  await expect(
    fetchDidWebPubkey("did:web:example.com", { fetch: stubFetch(huge), sizeLimit: 1024 }),
  ).rejects.toThrow(/size/i);
});
