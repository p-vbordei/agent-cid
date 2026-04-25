import { didWebToUrl, parseEd25519FromDidDoc } from "./did";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type DidWebOptions = {
  fetch?: FetchLike;
  timeoutMs?: number;
  sizeLimit?: number; // bytes
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_SIZE_LIMIT = 64 * 1024;

export async function fetchDidWebPubkey(
  did: string,
  opts: DidWebOptions = {},
): Promise<Uint8Array> {
  const url = didWebToUrl(did);
  if (!url.startsWith("https://")) {
    throw new Error(`did:web requires https://, got ${url}`);
  }
  const f = opts.fetch ?? (globalThis.fetch as FetchLike);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await f(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`did:web fetch ${did}: HTTP ${res.status}`);
    const text = await res.text();
    const limit = opts.sizeLimit ?? DEFAULT_SIZE_LIMIT;
    if (text.length > limit) throw new Error(`did:web doc size ${text.length} > limit ${limit}`);
    const doc = JSON.parse(text);
    return parseEd25519FromDidDoc(doc, did);
  } finally {
    clearTimeout(timer);
  }
}
