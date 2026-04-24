# Changelog

All notable changes to this project follow [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

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
