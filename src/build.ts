import { canonicalEncode } from "./canonical";
import { bytesToCID } from "./cid";
import { b64encode } from "./sign";
import type { BuildOpts, Manifest } from "./types";

export async function build(bytes: Uint8Array, opts: BuildOpts): Promise<Manifest> {
  if (opts.signers.length === 0) {
    throw new Error("build requires at least one signer");
  }
  const cid = await bytesToCID(bytes);
  const unsigned = {
    v: "agent-cid/1" as const,
    cid,
    size: bytes.length,
    media_type: opts.media_type,
    schema_uri: opts.schema_uri,
    producer: opts.producer_did,
    created_at: opts.created_at ?? new Date().toISOString(),
    ...(opts.parent_cid !== undefined ? { parent_cid: opts.parent_cid } : {}),
    ...(opts.retention !== undefined ? { retention: opts.retention } : {}),
  };
  const canonical = canonicalEncode(unsigned);
  const sigs: Manifest["sigs"] = [];
  for (const s of opts.signers) {
    const sig = await s.signFn(canonical);
    sigs.push({ signer_did: s.did, alg: "ed25519", sig: b64encode(sig) });
  }
  return { ...unsigned, sigs };
}
