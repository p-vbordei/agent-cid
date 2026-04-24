import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { type BuildOpts, build, pubkeyToDidKey, verify } from "../src";

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

const priv = new Uint8Array(32).fill(0x42);
const did = pubkeyToDidKey(ed.getPublicKey(priv));
const opts: BuildOpts = {
  producer_did: did,
  schema_uri: "https://example.org/answer/1",
  media_type: "application/json",
  signers: [{ did, signFn: (b) => ed.sign(b, priv) }],
};

const v1 = new TextEncoder().encode(JSON.stringify({ answer: 42 }));
const m1 = await build(v1, opts);
console.log("built v1:", m1.cid);
console.log("verify v1:", (await verify(m1, v1)).ok);

const tampered = new Uint8Array(v1);
tampered[0] = (tampered[0] ?? 0) ^ 0xff;
console.log("verify tampered:", await verify(m1, tampered));

const v2 = new TextEncoder().encode(JSON.stringify({ answer: 43 }));
const m2 = await build(v2, { ...opts, parent_cid: m1.cid });
console.log("built v2 → parent_cid:", m2.parent_cid);
console.log("verify v2:", (await verify(m2, v2)).ok);
