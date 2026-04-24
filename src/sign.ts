import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";

// @noble/ed25519 v2 requires sha512 wired for sync sign/verify.
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

export function verifyBytes(sig: Uint8Array, message: Uint8Array, pubkey: Uint8Array): boolean {
  try {
    return ed.verify(sig, message, pubkey);
  } catch {
    return false;
  }
}

export function b64encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function b64decode(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}
