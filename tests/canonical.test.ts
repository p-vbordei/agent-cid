import { expect, test } from "bun:test";
import { canonicalEncode } from "../src/canonical";

const td = new TextDecoder();

test("canonicalEncode sorts top-level keys alphabetically", () => {
  const out = canonicalEncode({ b: 2, a: 1 });
  expect(td.decode(out)).toBe('{"a":1,"b":2}');
});

test("canonicalEncode sorts nested keys alphabetically", () => {
  const out = canonicalEncode({ outer: { z: 1, a: 2 } });
  expect(td.decode(out)).toBe('{"outer":{"a":2,"z":1}}');
});

test("canonicalEncode emits UTF-8 bytes", () => {
  const out = canonicalEncode({ s: "héllo" });
  expect(td.decode(out)).toBe('{"s":"héllo"}');
});

test("canonicalEncode is deterministic across calls", () => {
  const a = canonicalEncode({ b: 2, a: 1, c: [3, 1, 2] });
  const b = canonicalEncode({ c: [3, 1, 2], a: 1, b: 2 });
  expect(td.decode(a)).toBe(td.decode(b));
});
