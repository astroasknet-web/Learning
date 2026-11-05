import { sha256 } from "./sha256";

/** The pure logic behind the blockchain lesson widgets: a toy chain, proof of work and a Merkle tree. Teaching code, not production code. */
export interface Block { index: number; data: string; nonce: number; prev: string }

export const blockHash = (b: Block): string => sha256(`${b.index}|${b.prev}|${b.data}|${b.nonce}`);
export const meetsTarget = (hash: string, difficulty: number): boolean => hash.startsWith("0".repeat(difficulty));
export const GENESIS_PREV = "0".repeat(64);

/** Find a nonce whose hash starts with `difficulty` zeros. Returns null if maxTries is used up (the widget calls this in slices to keep the page responsive). */
export function mine(b: Block, difficulty: number, from = 0, maxTries = 200000): { nonce: number; hash: string; tries: number } | null {
  for (let n = from, t = 0; t < maxTries; n++, t++) {
    const hash = blockHash({ ...b, nonce: n });
    if (meetsTarget(hash, difficulty)) return { nonce: n, hash, tries: t + 1 };
  }
  return null;
}

export interface ChainState { blocks: Block[]; hashes: string[]; valid: boolean[] }
/** A block is valid when it links to the previous block's current hash and its own hash meets the target. Once one is broken every later one is too. */
export function checkChain(blocks: Block[], difficulty: number): ChainState {
  const hashes = blocks.map(blockHash);
  const valid: boolean[] = [];
  blocks.forEach((b, i) => {
    const linked = b.prev === (i === 0 ? GENESIS_PREV : hashes[i - 1]);
    valid.push(linked && meetsTarget(hashes[i], difficulty) && (i === 0 || valid[i - 1]));
  });
  return { blocks, hashes, valid };
}

/** Build a valid chain from block texts (mines each one). Used for the widget's starting position and in tests. */
export function buildChain(texts: string[], difficulty: number): Block[] {
  const out: Block[] = [];
  texts.forEach((data, i) => {
    const b: Block = { index: i + 1, data, nonce: 0, prev: i === 0 ? GENESIS_PREV : blockHash(out[i - 1]) };
    const m = mine(b, difficulty, 0, 5_000_000);
    out.push({ ...b, nonce: m ? m.nonce : 0 });
  });
  return out;
}

/** Merkle tree levels, leaves first. Odd levels repeat the last hash, as Bitcoin does. */
export function merkleLevels(txs: string[]): string[][] {
  let level = txs.map((t) => sha256(t));
  const levels = [level];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(sha256(level[i] + (level[i + 1] ?? level[i])));
    levels.push(next);
    level = next;
  }
  return levels;
}
