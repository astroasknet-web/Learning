import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { bitsDifferent, sha256 } from "./sha256";
import { blockHash, buildChain, checkChain, GENESIS_PREV, merkleLevels, mine, meetsTarget } from "./chain";
import { validateSpec } from "./engine";

describe("sha256", () => {
  it("matches the published test vectors", () => {
    expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });
  it("agrees with Node's crypto on varied inputs, including multi-block and non-ASCII text", () => {
    for (const s of ["a", "hello world", "x".repeat(55), "x".repeat(56), "x".repeat(64), "x".repeat(1000), "₹ नमस्ते 😀", "Block 1|0|Alice pays Bob 5|42"]) {
      expect(sha256(s)).toBe(createHash("sha256").update(s).digest("hex"));
    }
  });
  it("flips about half the bits when one character changes", () => {
    const d = bitsDifferent(sha256("hello"), sha256("hellp"));
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(170);
  });
});

describe("toy chain", () => {
  const texts = ["Alice pays Bob 5", "Bob pays Carol 2", "Carol pays Dan 1"];
  it("builds a valid chain at every difficulty the widget offers", () => {
    for (const d of [0, 1, 2, 3]) {
      const chain = buildChain(texts, d);
      expect(checkChain(chain, d).valid).toEqual([true, true, true]);
      expect(chain[0].prev).toBe(GENESIS_PREV);
    }
  });
  it("breaks the edited block and every block after it, and nothing before", () => {
    const chain = buildChain(texts, 2);
    const edited = chain.map((b, i) => (i === 1 ? { ...b, data: "Bob pays Carol 200" } : b));
    expect(checkChain(edited, 2).valid).toEqual([true, false, false]);
  });
  it("is repaired by re-mining each broken block in order", () => {
    const chain = buildChain(texts, 2);
    const edited = chain.map((b, i) => (i === 0 ? { ...b, data: "Alice pays Bob 500" } : b));
    let fixed = edited;
    for (let i = 0; i < 3; i++) {
      const prev = i === 0 ? GENESIS_PREV : blockHash(fixed[i - 1]);
      const m = mine({ ...fixed[i], prev }, 2, 0, 1_000_000)!;
      fixed = fixed.map((b, k) => (k === i ? { ...b, prev, nonce: m.nonce } : b));
    }
    expect(checkChain(fixed, 2).valid).toEqual([true, true, true]);
  });
  it("finds a nonce that meets the target", () => {
    const m = mine({ index: 1, data: "x", nonce: 0, prev: GENESIS_PREV }, 3, 0, 1_000_000)!;
    expect(meetsTarget(m.hash, 3)).toBe(true);
  });
});

describe("merkle tree", () => {
  it("has the right shape and changes its root when any transaction changes", () => {
    const txs = ["a", "b", "c", "d"];
    const lv = merkleLevels(txs);
    expect(lv.map((l) => l.length)).toEqual([4, 2, 1]);
    for (let i = 0; i < 4; i++) {
      const t = [...txs]; t[i] = t[i] + "!";
      expect(merkleLevels(t)[2][0]).not.toBe(lv[2][0]);
    }
    expect(lv[1][0]).toBe(sha256(lv[0][0] + lv[0][1]));
  });
});

describe("widget specs", () => {
  it("validates the three blockchain widgets", () => {
    expect(validateSpec({ type: "hashlab", id: "hash-one", title: "t", start: "hello" })).toEqual([]);
    expect(validateSpec({ type: "chainlab", id: "chain-one", title: "t", blocks: ["a", "b", "c"], difficulty: 2 })).toEqual([]);
    expect(validateSpec({ type: "merkle", id: "merkle-one", title: "t", txs: ["a", "b", "c", "d"] })).toEqual([]);
    expect(validateSpec({ type: "chainlab", id: "chain-one", title: "t", blocks: ["a"], difficulty: 9 }).length).toBe(2);
    expect(validateSpec({ type: "merkle", id: "merkle-one", title: "t", txs: ["a", "b", "c"] }).length).toBe(1);
  });
});
