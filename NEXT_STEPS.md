# Next steps

Written at v0.1.0 tag time (commit `9de1e1a`). What to do next, in order.

---

## 1. Ship v0.1.0 (pending user approval)

Everything for v0.1.0 is already committed and the local tag `v0.1.0` points at `9de1e1a`. To publish, in order:

### 1.1 Merge the worktree branch into `main`

Current branch: `claude/infallible-brahmagupta-9a79df` (in worktree `.claude/worktrees/infallible-brahmagupta-9a79df`).

```sh
# From the main checkout (not the worktree):
cd /Users/vladbordei/Documents/Development/PERSONAL/agent-cid
git fetch origin
git checkout main
git merge --ff-only claude/infallible-brahmagupta-9a79df
```

If `--ff-only` refuses, rebase the branch on current `main` first. Do not squash — the 28 commits tell a clean narrative and are worth preserving.

### 1.2 Push

```sh
git push origin main
git push origin v0.1.0
```

The `v0.1.0` tag MUST be pushed alongside the commits — GitHub's release page reads from tags.

### 1.3 Cut a GitHub release

- Go to `https://github.com/<you>/agent-cid/releases/new`
- Tag: `v0.1.0`
- Title: `v0.1.0`
- Body: paste the `[0.1.0]` section of [CHANGELOG.md](./CHANGELOG.md)

### 1.4 Publish to npm

```sh
# Sanity-check the package contents first:
npm pack --dry-run

# Expect: package.json, README.md, LICENSE, SPEC.md, CHANGELOG.md,
#         src/*.ts. Tests, conformance, examples, docs are excluded
#         by npm's default ignore rules (or add an "files" field).
```

Before the first publish, add a `"files"` field to `package.json` so you ship only the public artifacts:

```json
"files": ["src", "SPEC.md", "CHANGELOG.md", "LICENSE", "README.md"]
```

Then:

```sh
npm login         # or: npm whoami
npm publish --access public
```

The package ships `.ts` sources directly — consumers on Bun or `bun build --compile` pipelines consume them as-is. If you hit demand for pre-built `.js` + `.d.ts`, add a `prepublish` script running `bun build` + `tsc --emitDeclarationOnly`; do NOT do this pre-emptively.

### 1.5 Post-publish smoke test

From a scratch directory:

```sh
mkdir /tmp/cid-smoke && cd /tmp/cid-smoke
bun init -y
bun add agent-cid
bun -e 'import { build } from "agent-cid"; console.log(typeof build);'  # expect: function
```

---

## 2. Deferred-to-v0.2 work (from [SCOPE.md](./SCOPE.md))

Listed in priority order. Each is a separate PR.

### 2.1 `did:web` resolver — **highest priority for v0.2**

Unblocks servers that publish DID documents at well-known URLs. Introduces three real costs that `did:key` doesn't have:

- **HTTP fetch** with cache + timeout (pure `fetch` + a tiny `Map` cache keyed by DID; reject if `.well-known/did.json` is >64 KiB or takes >5s; no network libraries).
- **Verification-method-at-`created_at` resolution.** SPEC §6 requires resolving signer keys "at `created_at`, not 'now'". For `did:web`, this means the DID document may have rotated keys. v0.2 needs a convention for fetching *historical* DID documents — pragmatic option: accept the current document only and document the limitation, deferring historical resolution to v0.3 when `agent-id` defines a history mechanism.
- **Re-introduce the `DidResolver` seam** that was removed in v0.1 cleanup. With two real methods (`did:key` default + pluggable `did:web`), the abstraction now has two callers.

Expected surface change: add `DidResolver` type back to `types.ts`, `resolver?: DidResolver` to `VerifyOptions`, ship a default that dispatches on DID prefix (`did:key:` → inline codec; `did:web:` → `fetchWebDid`). Conformance: one vector per method exercising a full build/verify roundtrip with a stubbed fetcher for `did:web`.

### 2.2 Deterministic CBOR representation

SPEC §2 already makes this MAY-level. For size-sensitive transports (e.g. `agent-phone` binary frames) CBOR cuts ~40% vs. JCS JSON. v0.2 ships:

- `canonicalEncodeCBOR(value: unknown): Uint8Array` matching CTAP2 canonical CBOR / RFC 8949 §4.2.
- A `format: "json" | "cbor"` option on `build` + `verify` (default `"json"` — no breaking change).
- Conformance vectors `c5-cbor-canonical.json` + `c6-cbor-roundtrip.json` (parity with C1/C4).

Library: use `cbor-x` or hand-roll. Hand-rolled is ~150 LoC for the subset we need (no big ints, no floats beyond IEEE 754 canonical form). Decision at PR time.

### 2.3 `resolve(manifest) -> { cid, producer, parent? }`

Only if a non-TypeScript consumer surfaces needing the named operation. In TypeScript, destructure. Ship only with a first real caller that needs it.

### 2.4 Standalone CLI

Only if users ask. The `examples/demo.ts` pattern already covers the 90% case. A polished CLI (`agent-cid build < body > manifest.json`, `agent-cid verify manifest.json body`) would be ~80 LoC in one file — but don't build it without a user story.

### 2.5 Historical-key resolution at `created_at`

Matters only once `did:web` lands (did:key has no rotation). Becomes meaningful when `agent-id` defines how DID documents version themselves over time. Likely v0.3 or later.

---

## 3. Open technical debt

Nothing load-bearing, but worth a note:

- **`@noble/ed25519` v2.3.0 API gotcha.** Four sites (`src/sign.ts`, `tests/fixtures.ts`, `conformance/runner.ts`, `examples/demo.ts`) each install `ed.etc.sha512Sync`. This is a library-init quirk, not our API surface. If `@noble/ed25519` ships the newer `ed.hashes.sha512` pattern in a future version, collapse the four sites to one (in `src/sign.ts`, re-exported or side-effect-imported). Don't do this speculatively.
- **`verifyCID` has one production caller** (`src/verify.ts`). Inlining saves ~10 LoC at the cost of a less-readable boolean expression; keep the named predicate unless a future cleanup sweep decides otherwise.
- **Conformance runner's `tamper_link_sig_index`** path replaces a link's whole `sigs` array. If a vector wants to tamper one sig in a multi-signer link, extend to `tamper_sig_path: [link_index, sig_index]`. Not needed until we have a multi-signer-chain vector.

---

## 4. Cross-repo integration (the reason agent-cid exists)

Once v0.1.0 is on npm, the other repos in the 8-repo family start consuming it. Order matches the roadmap in [research/06-easy-pickings-shortlist.md](../research/06-easy-pickings-shortlist.md) "Natural build order":

- **`agent-ask`** (Q&A artifacts) is the first real consumer. Every question + every answer produced becomes a `agent-cid/1` manifest. This is where the public API gets its first stress test.
- **`agent-rerun`** (reproducibility bundles) composes `agent-cid` + `agent-scroll` to produce a signed bundle (manifest over the scroll bytes). Another consumer.
- **`agent-phone`** (sync RPC) may wrap its response payloads in `agent-cid` manifests for replayability. Optional, not required.

The feedback from `agent-ask`'s first cut should drive v0.2 priorities. Specifically: if `agent-ask` needs historical DID resolution or did:web immediately, 2.1 jumps ahead of everything else.

---

## 5. Adoption signals to watch

Specific, falsifiable indicators that v0.1.0 is landing:

- **In the family:** `agent-ask` (and at least one other repo) imports `agent-cid` within 4 weeks of publish.
- **External:** a non-trivial PR from someone not on the core team within 3 months. (Docs typo fix doesn't count; feature PR or issue with a concrete use case does.)
- **Conformance:** at least one second implementation (Go, Python, Rust) running the checked-in vectors within 6 months. The existence of `conformance/vectors/` + `conformance/README.md` is the ask — we don't need to write it.

If none of those signal by month 6, the positioning risk the validation flagged ("adoption battle against in-toto") materialized, and the next move is a blog post / HN submission to generate discussion, not more code.

---

## 6. Known things NOT to do

- **Do not** add a plugin system.
- **Do not** add a configuration language (YAML, dotfiles).
- **Do not** pull in `did-resolver` / `key-did-resolver` when `did:web` lands; write the ~20 lines inline like we did for `did:key`.
- **Do not** embed LDK / Lightning / any network stack. `agent-cid` is a format. Period.
- **Do not** split this repo into multiple packages (e.g. `@agent-cid/core`, `@agent-cid/cli`). One repo, one package, one binary ambition.
- **Do not** ship a "framework" that wraps `build` / `verify` in a class hierarchy. The primitive IS the surface.
