# agent-cid — v0.1 scope sheet

Output of Stage 1 scope compression. IN-V0.1 = ships. DEFERRED = v0.2+. CUT = never.

Default is DEFERRED. Inclusion required either (a) a today-caller in the 8-repo family, or (b) the primary use case dies without it.

---

## IN-V0.1

### Manifest data model + Zod validator
- Real first-party caller? YES — every other feature reads/writes this struct.
- Primary use case dies without it? YES — this is the primitive.
- Reinvents mature primitive? NO — Zod for shape validation.

### CID computation (CIDv1, sha-256 multihash)
- Real caller? YES — the anchor field.
- Dies without? YES.
- Reinvents? NO — `multiformats`.

### Canonical JSON encoding (RFC 8785 JCS)
- Real caller? YES — signatures depend on it.
- Dies without? YES — C4 conformance requires byte-identical encoding across impls.
- Reinvents? NO — `canonicalize` npm package.

### Ed25519 sign + verify
- Real caller? YES — integrity is the point.
- Dies without? YES.
- Reinvents? NO — `@noble/ed25519`.

### Multi-signer chain (sigs[] with ≥1 entry)
- Real caller? None yet, but single→N is the same loop; cost of N is zero once 1 is built.
- Dies without? Data shape is an array in SPEC §2.
- Reinvents? NO.

### `parent_cid` versioning field + chain traversal helper
- Real caller? YES — agent-ask will have artifact revisions; C3 conformance requires traversal.
- Dies without? Value prop collapses to "CID + sig" (DSSE-with-DIDs).
- Reinvents? NO.

### `retention` hints (`stale_after` advisory, `expires_at` normative)
- Real caller? Named differentiator in README/validation; ~20 LoC total.
- Dies without? Feature still useful, but this is a stated USP.
- Reinvents? NO — two timestamps + one comparison in verify.

### `did:key` resolution (Ed25519)
- Real caller? YES — the `producer` and `signer_did` types.
- Dies without? YES.
- Reinvents? NO — `did-resolver` + `key-did-resolver`.

### `build(bytes, opts) -> Manifest`
- Real caller? YES — half the public API.

### `verify(manifest, bytes, resolver?) -> { ok, errors[] }`
- Real caller? YES — other half of the public API. Checks cid, size, each sig, retention.

### Conformance vectors for C1–C4
- Mandatory per Stage 4 + SPEC §7.

### Demo script (Stage 5)
- `examples/demo.ts`: build → verify ✓ → tamper → verify ✗ → new version with parent_cid.

---

## DEFERRED-TO-V0.2

### `resolve(manifest) -> { cid, producer, parent? }`
A 3-field destructure. Users in TS read `manifest.cid` directly. SPEC §3.3 calls it a "pure accessor" — that's the tell. Shipping it now is a helper for no caller. If v0.2 reveals a cross-language caller that needs the named operation, add it then.

### `did:web` resolution
Adds HTTP fetch, caching, trust-on-first-use concerns, historical-key-at-created_at logic. No caller in v0.1. SPEC allows did:web but doesn't require impl.

### Deterministic CBOR representation
SPEC §2 makes it MAY, not MUST. No caller identified. JCS JSON covers v0.1 transports.

### Historical-key resolution at `created_at`
Moot with did:key (the DID is the key, never rotates). Becomes relevant when did:web lands.

### Full CLI beyond demo
The 20-line `examples/demo.ts` covers Stage 5. A polished CLI with subcommands, flags, stdin piping, output formats is corporate feature creep.

### Published JSON Schema artifact
No one is fetching it today. Zod in-code is enough.

---

## CUT

None outright cut. Every deferred item has a plausible v0.2 caller.

---

## Sizing

Validation target: ~600–900 LoC TS runtime + ~300 LoC fixtures. This scope fits.

## Dependencies (runtime, as-shipped)

- `multiformats` — CIDv1 + sha-256 multihash + base58btc + varint (also powers the inline did:key codec)
- `@noble/ed25519` — Ed25519 sign/verify
- `@noble/hashes` — sha512 for Ed25519 sync sign/verify
- `canonicalize` — RFC 8785 JCS
- `zod` — runtime schema validation

No HTTP, no database, no framework. The plan originally budgeted `did-resolver` + `key-did-resolver`; v0.1 inlined a ~15-line did:key encoder/decoder using `multiformats`' base58btc + varint instead (we only need one DID method), dropping both packages.
