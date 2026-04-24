# agent-cid conformance vectors

Test vectors that any `agent-cid/1` implementation must pass.

## Running against this repo's TS impl

```sh
bun install
bun run conformance
```

Exit code 0 = all vectors pass. Non-zero = at least one vector failed.

## Vector shape

Each `vectors/*.json` is a single vector with a `kind` discriminator:

- `roundtrip` — build a manifest from `body_hex` + `producer_priv_hex`; expect the CID to match `expected.cid` and `verify()` to return ok.
- `tampered_body` — build normally, then flip one byte at `tamper_offset`; expect verify to fail with an error containing `expected.error_contains`.
- `parent_chain` — build a chain of links; optionally corrupt one link's signature (`tamper_link_sig_index`); expect `verifyChain` to fail.
- `canonical` — given `input`, canonicalEncode MUST produce exactly `expected_canonical`.

## Adding an implementation in another language

Parse `vectors/*.json`, implement the same four `kind`s against your library, and confirm pass. The private keys are hex-encoded raw Ed25519 seeds; producer DID is derived with `pubkey → did:key (multicodec 0xed)`.

## SPEC clause mapping

| File | SPEC clause |
|---|---|
| `c1-roundtrip.json` | §7 C1 |
| `c2-tampered-body.json` | §7 C2 |
| `c3-parent-chain.json` | §7 C3 |
| `c4-canonical.json` | §7 C4 |
