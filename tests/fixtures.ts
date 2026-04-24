import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { pubkeyToDidKey } from "../src/did";
import type { SignerInput } from "../src/types";

// @noble/ed25519 v2: configure sync hash so sign/verify are synchronous.
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

// Deterministic test keypair — derived from a fixed 32-byte seed for byte-identical test output.
const SEED = new Uint8Array(32).fill(0x11);

export const testPriv = SEED;
export const testPub = ed.getPublicKey(testPriv);
export const testDid = pubkeyToDidKey(testPub);

// Second deterministic keypair for multi-signer tests.
const SEED2 = new Uint8Array(32).fill(0x22);
export const testPriv2 = SEED2;
export const testPub2 = ed.getPublicKey(testPriv2);
export const testDid2 = pubkeyToDidKey(testPub2);

// Third deterministic keypair (used by parent-chain tests as a "revoked middle signer").
const SEED3 = new Uint8Array(32).fill(0x33);
export const testPriv3 = SEED3;
export const testPub3 = ed.getPublicKey(testPriv3);
export const testDid3 = pubkeyToDidKey(testPub3);

export function makeSigner(priv: Uint8Array, did: string): SignerInput {
  return { did, signFn: (bytes) => ed.sign(bytes, priv) };
}

export const FIXED_TIMESTAMP = "2026-01-01T00:00:00.000Z";
export const SAMPLE_BODY = new TextEncoder().encode("hello agent-cid");
