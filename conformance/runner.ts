import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { build } from "../src/build";
import { canonicalEncode } from "../src/canonical";
import { parseEd25519FromDidDoc, pubkeyToDidKey } from "../src/did";
import type { BuildOpts, Manifest } from "../src/types";
import { verify, verifyChain } from "../src/verify";

ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

const VECTORS_DIR = new URL("./vectors/", import.meta.url).pathname;

type Signer = { priv_hex: string };
type BuildInput = {
  body_hex: string;
  producer_priv_hex: string;
  schema_uri: string;
  media_type: string;
  created_at: string;
  parent_cid?: string;
  retention?: { stale_after?: string; expires_at?: string };
  extra_signers?: Signer[];
};

type Vector =
  | {
      id: string;
      kind: "roundtrip";
      description: string;
      build: BuildInput;
      expected: { cid: string; verify_ok: true };
    }
  | {
      id: string;
      kind: "tampered_body";
      description: string;
      build: BuildInput;
      tamper_offset: number;
      expected: { verify_ok: false; error_contains: string };
    }
  | {
      id: string;
      kind: "parent_chain";
      description: string;
      links: BuildInput[];
      tamper_link_sig_index?: number;
      expected: { verify_ok: false; error_contains: string };
    }
  | {
      id: string;
      kind: "canonical";
      description: string;
      input: Record<string, unknown>;
      expected_canonical: string;
    }
  | {
      id: string;
      kind: "did_web_roundtrip";
      description: string;
      build: BuildInput;
      producer_did: string;
      did_doc: Record<string, unknown>;
      expected: { verify_ok: true };
    };

function hexToBytes(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function runBuild(input: BuildInput): Promise<{ manifest: Manifest; body: Uint8Array }> {
  const body = hexToBytes(input.body_hex);
  const priv = hexToBytes(input.producer_priv_hex);
  const pub = ed.getPublicKey(priv);
  const producerDid = pubkeyToDidKey(pub);

  const signers: BuildOpts["signers"] = [{ did: producerDid, signFn: (b) => ed.sign(b, priv) }];
  for (const s of input.extra_signers ?? []) {
    const sp = hexToBytes(s.priv_hex);
    const sd = pubkeyToDidKey(ed.getPublicKey(sp));
    signers.push({ did: sd, signFn: (b) => ed.sign(b, sp) });
  }

  const manifest = await build(body, {
    producer_did: producerDid,
    schema_uri: input.schema_uri,
    media_type: input.media_type,
    created_at: input.created_at,
    parent_cid: input.parent_cid,
    retention: input.retention,
    signers,
  });
  return { manifest, body };
}

async function runVector(v: Vector): Promise<{ pass: boolean; detail: string }> {
  switch (v.kind) {
    case "roundtrip": {
      const { manifest, body } = await runBuild(v.build);
      if (manifest.cid !== v.expected.cid) {
        return { pass: false, detail: `cid mismatch: got ${manifest.cid}, want ${v.expected.cid}` };
      }
      const r = await verify(manifest, body);
      return r.ok === v.expected.verify_ok
        ? { pass: true, detail: `cid=${manifest.cid}` }
        : { pass: false, detail: `verify.ok = ${r.ok}, want ${v.expected.verify_ok}` };
    }
    case "tampered_body": {
      const { manifest, body } = await runBuild(v.build);
      const tampered = new Uint8Array(body);
      tampered[v.tamper_offset] = (tampered[v.tamper_offset] ?? 0) ^ 0xff;
      const r = await verify(manifest, tampered);
      if (r.ok !== false) return { pass: false, detail: "verify unexpectedly returned ok" };
      const found = r.errors.some((e) => e.includes(v.expected.error_contains));
      return found
        ? { pass: true, detail: `errors=${r.errors.join(";")}` }
        : {
            pass: false,
            detail: `want error containing "${v.expected.error_contains}", got ${r.errors.join(";")}`,
          };
    }
    case "parent_chain": {
      const built = [];
      let prev: string | undefined;
      for (const link of v.links) {
        const b = await runBuild({ ...link, parent_cid: link.parent_cid ?? prev });
        built.push(b);
        prev = b.manifest.cid;
      }
      const chain = built.map((b) => ({ manifest: b.manifest as unknown, bytes: b.body }));
      if (v.tamper_link_sig_index !== undefined) {
        const idx = v.tamper_link_sig_index;
        const link = chain[idx];
        if (!link) return { pass: false, detail: `tamper index ${idx} out of range` };
        const m = link.manifest as Manifest;
        chain[idx] = {
          manifest: { ...m, sigs: [{ ...m.sigs[0]!, sig: "AAAA" }] },
          bytes: link.bytes,
        };
      }
      const r = await verifyChain(chain);
      if (r.ok !== false) return { pass: false, detail: "verifyChain unexpectedly returned ok" };
      const found = r.errors.some((e) => e.includes(v.expected.error_contains));
      return found
        ? { pass: true, detail: `errors=${r.errors.join(";")}` }
        : {
            pass: false,
            detail: `want error containing "${v.expected.error_contains}", got ${r.errors.join(";")}`,
          };
    }
    case "canonical": {
      const out = new TextDecoder().decode(canonicalEncode(v.input));
      return out === v.expected_canonical
        ? { pass: true, detail: `${out.length} bytes` }
        : { pass: false, detail: `\ngot:  ${out}\nwant: ${v.expected_canonical}` };
    }
    case "did_web_roundtrip": {
      const body = hexToBytes(v.build.body_hex);
      const priv = hexToBytes(v.build.producer_priv_hex);
      const manifest = await build(body, {
        producer_did: v.producer_did,
        schema_uri: v.build.schema_uri,
        media_type: v.build.media_type,
        created_at: v.build.created_at,
        signers: [{ did: v.producer_did, signFn: (b) => ed.sign(b, priv) }],
      });
      const r = await verify(manifest, body, {
        resolver: (did) => parseEd25519FromDidDoc(v.did_doc, did),
      });
      return r.ok === v.expected.verify_ok
        ? { pass: true, detail: `cid=${manifest.cid}` }
        : { pass: false, detail: `verify.ok = ${r.ok}, want ${v.expected.verify_ok}` };
    }
  }
}

async function main() {
  const files = (await readdir(VECTORS_DIR)).filter((f) => f.endsWith(".json")).sort();
  let passed = 0;
  let failed = 0;
  const start = Date.now();
  for (const f of files) {
    const path = join(VECTORS_DIR, f);
    const vector = JSON.parse(await readFile(path, "utf8")) as Vector;
    const result = await runVector(vector);
    const tag = result.pass ? "PASS" : "FAIL";
    console.log(`${tag}  ${vector.id.padEnd(24)}  ${vector.description}`);
    if (!result.pass) console.log(`      → ${result.detail}`);
    result.pass ? passed++ : failed++;
  }
  const elapsed = Date.now() - start;
  console.log(`\n${passed} pass, ${failed} fail (${elapsed}ms)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
