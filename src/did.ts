import { varint } from "multiformats";
import { base58btc } from "multiformats/bases/base58";

// Multicodec: Ed25519 public key is 0xed (unsigned varint).
const ED25519_MULTICODEC = 0xed;
const ED25519_PREFIX = new Uint8Array([0xed, 0x01]);

export function pubkeyToDidKey(pubkey: Uint8Array): string {
  if (pubkey.length !== 32) {
    throw new Error(`ed25519 pubkey must be 32 bytes, got ${pubkey.length}`);
  }
  const bytes = new Uint8Array(ED25519_PREFIX.length + pubkey.length);
  bytes.set(ED25519_PREFIX, 0);
  bytes.set(pubkey, ED25519_PREFIX.length);
  return `did:key:${base58btc.encode(bytes)}`;
}

export function didKeyToPubkey(did: string): Uint8Array {
  if (!did.startsWith("did:key:z")) {
    throw new Error(`not a did:key (must start with "did:key:z"): ${did}`);
  }
  const bytes = base58btc.decode(did.slice("did:key:".length));
  const [code, codeLen] = varint.decode(bytes);
  if (code !== ED25519_MULTICODEC) {
    throw new Error(`unsupported did:key multicodec 0x${code.toString(16)} (want ed25519 0xed)`);
  }
  const pub = bytes.slice(codeLen);
  if (pub.length !== 32) {
    throw new Error(`did:key pubkey has wrong length ${pub.length} (want 32)`);
  }
  return pub;
}
