import canonicalize from "canonicalize";

export function canonicalEncode(value: unknown): Uint8Array {
  const s = canonicalize(value);
  if (s === undefined) throw new Error("canonicalize returned undefined");
  return new TextEncoder().encode(s);
}
