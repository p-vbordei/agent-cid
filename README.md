# agent-cid

> Minimal content-addressed manifest format for artifacts exchanged between AI agents.

## What

`agent-cid` is a tiny envelope format that binds a content identifier (CID) to agent-specific metadata: producer DID, schema URI, timestamp, size, signing chain, optional retention/staleness, and optional parent-CID for versioning. Machine-first, platform-neutral.

If MCP tells you how to call a tool and `agent-scroll` tells you what was said, `agent-cid` tells you **what an artifact is**, who produced it, and whether it's still fresh — in a way every agent-* repo can consume without buying into a framework.

## Status

**0.1.0.** Normative spec in [SPEC.md](./SPEC.md). TypeScript reference impl in [`src/`](./src/). Conformance vectors in [`conformance/`](./conformance/).

## Quickstart

```sh
bun install
bun test
bun run demo
```

What you should see: `bun run demo` builds a manifest, verifies it, tampers one byte and shows the verify failure, then rolls a v2 with `parent_cid` pointing at v1.

## Using as a library

```ts
import { build, verify, pubkeyToDidKey } from "agent-cid";
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

const priv = ed.utils.randomPrivateKey();
const did = pubkeyToDidKey(ed.getPublicKey(priv));

const body = new TextEncoder().encode(JSON.stringify({ answer: 42 }));
const manifest = await build(body, {
  producer_did: did,
  schema_uri: "https://example.org/answer/1",
  media_type: "application/json",
  signers: [{ did, signFn: (b) => ed.sign(b, priv) }],
});
const result = await verify(manifest, body); // { ok: true, warnings: [] }
```

### did:web

When the producer is `did:web:` instead of `did:key:`, `verify()` automatically fetches the DID document from the well-known URL (HTTPS-only, 5-second timeout, 64 KiB cap) and caches the resolved pubkey for 5 minutes. Override the resolver for tests or custom DID methods:

```ts
const r = await verify(manifest, body, {
  resolver: (did) => myCustomDidResolver(did),
});
```

Bypass the cache when you need strict freshness:

```ts
const r = await verify(manifest, body, { resolverCache: false });
```

## The gap

`multiformats` defines the CID (the identifier). IPLD defines graphs. OCI image manifests describe container layer graphs. SigStore cosign bundles anchor signatures to X.509. SLSA provenance describes what built what. UCAN describes capabilities. KAF (Kindred Artifact Format) describes Kindred-specific artifacts.

What's missing: a **minimal, machine-first, platform-neutral** manifest that binds a CID to `producer_did + schema_uri + parent_cid + signing_chain` with optional retention hints, without pulling in any network, registry, or framework.

## Scope

**In scope**

- Manifest JSON schema (also CBOR representation)
- Canonical encoding (RFC 8785 JCS for JSON; deterministic CBOR)
- Producer + co-signer signature chain (Ed25519 default)
- Parent-CID versioning
- Retention hints (`stale_after`, `expires_at`)
- Reference TypeScript builder + verifier

**Out of scope**

- Running an IPFS network
- A block storage service
- Replacing KAF (KAF stays Kindred-scoped)
- A general CID library (`multiformats` exists)

## Dependencies and companions

- **Depends on:** `agent-id` (for producer DID + signers).
- **Depended on by:** `agent-ask` (Q&A artifacts), potentially any repo handling stored artifacts.

## Validation scoring

| Criterion | Score |
|---|---|
| Scope | 5 |
| Composes primitives | 5 |
| Standalone | 5 |
| Clear gap | 4 |
| Light deps | 5 |
| Testable | 5 |
| **Total** | **29/30** |

Verdict: **EASY**. Full validation: [`../research/validations/agent-cid.md`](../research/validations/agent-cid.md). Risk is positioning against in-toto, not engineering.

## Prior art

- **multiformats / CID** — identifier, not envelope.
- **IPLD** — too broad; no agent semantics.
- **OCI image manifest** — container-shaped, heavyweight.
- **SigStore cosign bundle** — X.509 anchor, not DID.
- **SLSA provenance v1 / in-toto attestation** — build-pipeline framed.
- **UCAN invocation** — capabilities, not manifests.
- **KAF 0.1 (Kindred)** — Kindred-scoped types; not platform-neutral.
- **Web Packaging / Bundles** — browser-origin bundles, different problem.

## Implementation skeleton

**Manifest fields:**

```
v:            "agent-cid/1"
cid:          CIDv1, multihash sha-256
size:         bytes
media_type
schema_uri
producer:     did:key:... / did:web:...
created_at:   RFC 3339
parent_cid?:  string
retention?:   { stale_after, expires_at }
sigs[]:       [{ signer_did, alg, sig }]   # over canonical manifest minus sigs
```

**API (one package):**

- `build(bytes, opts) -> Manifest`
- `verify(manifest, bytes) -> { ok, errors[] }`
- `resolve(manifest) -> { cid, producer, parent? }`

**Dependencies:** `multiformats`, `@noble/ed25519`, `did-resolver`, a canonical-JSON library (RFC 8785).

**Repo sizing:** ~600-900 LoC TypeScript + ~300 LoC fixtures.

## Conformance tests

1. Build → verify roundtrip on a 1 KiB body.
2. Tampered-body detection (CID mismatch).
3. Parent-chain traversal over 3 versions with a revoked middle signer.

## License

Apache 2.0 — see [LICENSE](./LICENSE).

## Research

Landscape, prior art, scoring rationale: [`../research/`](../research/).
