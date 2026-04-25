# Changelog

All notable changes to this project follow [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

## [0.2.0] — 2026-04-25

`did:web` support, no wire-format changes.

### Added
- `did:web` resolution: `verify()` auto-dispatches did:key → inline codec; did:web → HTTPS fetch of `.well-known/did.json` (or custom path), 5-second timeout, 64 KiB cap, HTTPS-only.
- `DidResolver` type re-introduced (now justified by 2 real callers); `VerifyOptions.resolver` accepts a custom resolver for tests or non-default DID methods.
- `VerifyOptions.resolverCache` (default `true`) — 5-minute in-memory pubkey cache.
- `VerifyOptions.resolverTimeoutMs` (default `5000`) — fetch timeout for did:web.
- `didWebToUrl(did)` and `parseEd25519FromDidDoc(doc, did)` exposed for users implementing custom resolvers or building their own caches.
- `fetchDidWebPubkey(did, opts?)` for bypassing the default resolver entirely.
- Conformance vector C5: did:web roundtrip with embedded DID document.

### Notes
- Wire-format unchanged. Every v0.1.0 manifest verifies under v0.2 unchanged.
- Historical-key-at-`created_at` resolution still deferred (v0.3+).

## [0.1.0] — 2026-04-24

Initial release. See [SPEC.md](./SPEC.md) for the normative specification.

### Added
- `build(bytes, opts) -> Manifest` — CIDv1 sha-256 + canonical JCS + Ed25519 signing per signer.
- `verify(manifest, bytes, options?) -> VerifyResult` — validates schema, CID, size, every signature, and retention hints.
- `verifyChain(chain, options?) -> VerifyResult` — validates a linked `parent_cid` sequence.
- `pubkeyToDidKey` / `didKeyToPubkey` — did:key (Ed25519) codec.
- Canonical JSON encoding (RFC 8785 JCS) via `canonicalize`.
- Conformance vectors for SPEC §7 clauses C1–C4 in `conformance/vectors/`, runnable via `bun run conformance`.
- Demo script at `examples/demo.ts` showing build → verify → tamper → new-version.

### Deferred to v0.2
- `did:web` resolver (requires HTTP fetch + historical-key-at-`created_at` logic).
- Deterministic CBOR representation (JCS JSON covers v0.1 transports).
- `resolve(manifest)` accessor (destructure fields directly).
- Standalone CLI (the demo script covers the 1-user-command need).
