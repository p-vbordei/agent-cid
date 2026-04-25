# agent-cid — v0.2 scope sheet

Scope-compression output for v0.2. Same rules as [SCOPE.md](./SCOPE.md): default DEFERRED; inclusion needs (a) a today-caller in the family, or (b) the primary v0.2 thesis dies without it.

**v0.2 thesis:** ship `did:web` as a second DID method so manifests produced by HTTP-hosted agents can be verified against a hostname-anchored key, without changing the v0.1 wire format.

---

## IN-V0.2

### Re-introduce `DidResolver` type + `VerifyOptions.resolver` option
- Real first-party caller? YES — TWO now: built-in did:key resolver and the new built-in did:web resolver, plus user-overridable.
- Dies without? YES — `verify` needs to dispatch on DID method.
- Reinvents? NO — same pattern that was speculatively removed in v0.1 cleanup; now justified by ≥2 real callers per the project rule.

### Default dispatching resolver (`did:key:` → inline; `did:web:` → fetcher)
- Real caller? YES — every `verify()` call without an explicit `resolver` uses it.
- Dies without? YES — otherwise `did:web` requires an explicit resolver every call (UX regression).
- Reinvents? NO.

### `did:web` URL derivation (`didWebToUrl`)
- Real caller? YES — used by the default did:web resolver.
- Dies without? YES.
- Reinvents? NO — straight from W3C did:web §3.2.

### `did:web` fetcher (HTTP GET `.well-known/did.json` + parse + extract Ed25519 pubkey)
- Real caller? YES — the default resolver delegates to it.
- Dies without? YES.
- Reinvents? NO — `fetch` (Bun built-in), JSON parse, multibase decode (multiformats already in deps).

### In-memory pubkey cache (5-minute TTL, opt-out)
- Real caller? YES — every `did:web` verify; without it, every signature triggers an HTTP fetch.
- Dies without? Performance dies without it (chain of N manifests = N HTTP calls). Spec correctness doesn't, but practical use does.
- Reinvents? NO — `Map<string, {pubkey, expires}>` is ~15 LoC.

### Conformance vector C5: did:web roundtrip
- Mandatory per Stage 4 pattern. Vector ships a stubbed DID document and a manifest signed by it; runner injects a fake fetcher.

### CHANGELOG v0.2.0 + `package.json` version bump

---

## DEFERRED-TO-V0.3

### Historical key resolution at `created_at`
- v0.2 fetches the CURRENT did.json. SPEC §6 says verifiers MUST resolve "at created_at, not now". For did:web this needs a history protocol that doesn't exist yet — either a sidecar log, did.json archives at versioned paths, or something agent-id-defined.
- v0.2 ships current-key-only with a documented caveat. The `created_at` field stays in the manifest unchanged. A future `historicalResolver` option in v0.3+ slots in without breaking the v0.2 API.
- Real caller today? NO. agent-id doesn't define rotation history yet.

### Deterministic CBOR representation
- SPEC §2 says MAY. Still no caller in the family. Defer to v0.3+ when `agent-phone` lands and binary frames matter.

### `resolve(manifest) -> { cid, producer, parent? }`
- Still no caller. Same reasoning as v0.1.

### Standalone CLI
- Still no user request.

---

## CUT

None. Every previous DEFERRED item still has a plausible v0.3+ caller.

---

## What's NOT changing in v0.2

- The wire format. Every v0.1.0 manifest verifies under v0.2 unchanged. No new fields.
- The 5 runtime deps. `did:web` adds zero. (Bun's `fetch` + existing `multiformats`.)
- File count. We modify `src/types.ts`, `src/verify.ts`, `src/index.ts` and add ONE file: `src/did-web.ts`. No restructuring.
- The conformance runner. Add one new vector kind (`did_web_roundtrip`) inline; no architecture change.

---

## Sizing

Validation target was 600–900 LoC for v0.1; we shipped 258. Budget for v0.2 increment: ~150 LoC src + ~100 LoC tests + ~30 LoC vectors. Total v0.2 src ≤ ~400 LoC, well within original target.

---

## Backward compatibility

- `verify(manifest, bytes)` (no options) still works — uses the default dispatching resolver, which falls back to inline did:key when the signer is `did:key:`. Existing v0.1 callers see no change.
- `verify(manifest, bytes, { ignoreExpiry: true })` still works.
- New: `verify(manifest, bytes, { resolver: customFn })` for users who want to plug in their own (e.g., test fixtures, did:plc, did:dht).
- New: `verify(manifest, bytes, { resolverCache: false })` to opt out of the in-memory cache.

No API removal. No type changes to `Manifest`. No SPEC changes (did:web was already legal in §2).

---

## Security considerations new to v0.2

To be folded into SPEC §6 with v0.2 cut:

1. **did:web HTTPS-only.** The fetcher MUST reject `http://` URLs (downgrade attack). Only `https://` allowed.
2. **Response size cap.** A 64 KiB cap on did.json fetch. Larger = reject.
3. **Fetch timeout.** 5 second default. Configurable via `VerifyOptions.resolverTimeoutMs`.
4. **Cache poisoning.** The cache is keyed by full DID string and stores only the pubkey + expires_at. The verifier MUST NOT cache the verification result, only the pubkey. (Each manifest's signature still gets verified per call.)
5. **Cache TTL trades off freshness vs. liveness.** A rotated key may verify against a cached old key for up to 5 minutes. Acceptable for v0.2; users who need stricter freshness pass `resolverCache: false`.
