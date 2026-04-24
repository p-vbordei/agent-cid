import { CID } from "multiformats/cid";
import * as raw from "multiformats/codecs/raw";
import { sha256 } from "multiformats/hashes/sha2";

export async function bytesToCID(bytes: Uint8Array): Promise<string> {
  const digest = await sha256.digest(bytes);
  return CID.create(1, raw.code, digest).toString();
}

export async function verifyCID(cid: string, bytes: Uint8Array): Promise<boolean> {
  return (await bytesToCID(bytes)) === cid;
}
