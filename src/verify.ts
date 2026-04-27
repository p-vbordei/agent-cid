import { canonicalEncode } from "./canonical";
import { verifyCID } from "./cid";
import { didKeyToPubkey } from "./did";
import { fetchDidWebPubkey } from "./did-web";
import { b64decode, verifyBytes } from "./sign";
import { ManifestSchema } from "./types";
import type { DidResolver, VerifyOptions, VerifyResult } from "./types";

const builtinResolver: DidResolver = async (did) => {
  if (did.startsWith("did:key:")) return didKeyToPubkey(did);
  if (did.startsWith("did:web:")) return fetchDidWebPubkey(did);
  throw new Error(`unsupported DID method: ${did}`);
};

const RESOLVER_CACHE_TTL_MS = 5 * 60 * 1000;

// Per-resolver cache: keyed by the underlying DidResolver function reference, so
// swapping resolvers between calls does NOT serve a stale entry. The default
// builtinResolver is a module-scoped const, so all default-resolver verifies
// share one cache (intended). User-supplied resolvers each get their own cache,
// collected when the function is.
let resolverCaches = new WeakMap<
  DidResolver,
  Map<string, { pubkey: Uint8Array; expires: number }>
>();

// Test-only — exported for unit tests to reset state between cases.
export function __resetResolverCache(): void {
  resolverCaches = new WeakMap();
}

function withCache(inner: DidResolver, ttlMs: number = RESOLVER_CACHE_TTL_MS): DidResolver {
  return async (did) => {
    let cache = resolverCaches.get(inner);
    if (!cache) {
      cache = new Map();
      resolverCaches.set(inner, cache);
    }
    const now = Date.now();
    const hit = cache.get(did);
    if (hit && hit.expires > now) return hit.pubkey;
    const pubkey = await inner(did);
    cache.set(did, { pubkey, expires: now + ttlMs });
    return pubkey;
  };
}

export async function verify(
  manifest: unknown,
  bytes: Uint8Array,
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  const baseResolver = options.resolver ?? builtinResolver;
  const resolver = options.resolverCache === false ? baseResolver : withCache(baseResolver);
  const now = options.now ?? Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  const parsed = ManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `schema: ${i.path.join(".")} ${i.message}`),
      warnings,
    };
  }
  const m = parsed.data;

  if (m.size !== bytes.length) {
    errors.push(`size mismatch: manifest ${m.size}, body ${bytes.length}`);
  }
  if (!(await verifyCID(m.cid, bytes))) {
    errors.push("cid mismatch");
  }

  if (m.retention?.expires_at) {
    const exp = Date.parse(m.retention.expires_at);
    if (Number.isFinite(exp) && now > exp) {
      if (options.ignoreExpiry) {
        warnings.push(`expired at ${m.retention.expires_at} (ignored)`);
      } else {
        errors.push(`expired at ${m.retention.expires_at}`);
      }
    }
  }
  if (m.retention?.stale_after) {
    const stale = Date.parse(m.retention.stale_after);
    if (Number.isFinite(stale) && now > stale) {
      warnings.push(`stale since ${m.retention.stale_after}`);
    }
  }

  const { sigs, ...unsigned } = m;
  const canonical = canonicalEncode(unsigned);
  for (let i = 0; i < sigs.length; i++) {
    const s = sigs[i]!;
    try {
      const pub = await resolver(s.signer_did);
      if (!verifyBytes(b64decode(s.sig), canonical, pub)) {
        errors.push(`sigs[${i}]: invalid signature for ${s.signer_did}`);
      }
    } catch (e) {
      errors.push(`sigs[${i}]: ${(e as Error).message}`);
    }
  }

  if (errors.length === 0) return { ok: true, warnings };
  return { ok: false, errors, warnings };
}

export async function verifyChain(
  chain: Array<{ manifest: unknown; bytes: Uint8Array }>,
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let prevCid: string | undefined;

  for (let i = 0; i < chain.length; i++) {
    const link = chain[i]!;
    const r = await verify(link.manifest, link.bytes, options);
    for (const w of r.warnings) warnings.push(`chain[${i}]: ${w}`);
    if (!r.ok) {
      for (const e of r.errors) errors.push(`chain[${i}]: ${e}`);
    }
    const parsed = ManifestSchema.safeParse(link.manifest);
    if (parsed.success) {
      if (i > 0) {
        if (parsed.data.parent_cid !== prevCid) {
          errors.push(
            `chain[${i}]: parent_cid mismatch — expected ${prevCid}, got ${parsed.data.parent_cid ?? "<missing>"}`,
          );
        }
      }
      prevCid = parsed.data.cid;
    }
  }

  if (errors.length === 0) return { ok: true, warnings };
  return { ok: false, errors, warnings };
}
