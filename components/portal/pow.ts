/**
 * Browser side of the built-in human check (see lib/portal/captcha.ts). Finds a nonce so that SHA-256("<challenge>:<nonce>") starts
 * with `bits` zero bits. The search runs in a Web Worker so the page stays responsive, with a fallback on the main thread.
 *
 * The code is kept as one plain string on purpose: the minifier renames functions, and a serialised function would then call helpers
 * that no longer exist inside the worker. The same string builds the worker and the functions used by the tests and the fallback.
 */
const CODE = `
var K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);
function sha256Bytes(msg) {
  var H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  var len = msg.length;
  var padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(msg);
  padded[len] = 0x80;
  var bits = len * 8;
  var view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bits >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(bits / 4294967296), false);
  var w = new Uint32Array(64);
  for (var off = 0; off < padded.length; off += 64) {
    for (var i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (var j = 16; j < 64; j++) {
      var a0 = w[j - 15], a1 = w[j - 2];
      var s0 = ((a0 >>> 7) | (a0 << 25)) ^ ((a0 >>> 18) | (a0 << 14)) ^ (a0 >>> 3);
      var s1 = ((a1 >>> 17) | (a1 << 15)) ^ ((a1 >>> 19) | (a1 << 13)) ^ (a1 >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (var k = 0; k < 64; k++) {
      var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      var ch = (e & f) ^ (~e & g);
      var t1 = (h + S1 + ch + K[k] + w[k]) | 0;
      var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H;
}
function zeroBits(h) {
  var n = 0;
  for (var i = 0; i < h.length; i++) {
    if (h[i] === 0) { n += 32; continue; }
    n += Math.clz32(h[i]);
    break;
  }
  return n;
}
function search(challenge, bits, start, count) {
  var enc = new TextEncoder();
  var prefix = challenge + ":";
  for (var n = start; n < start + count; n++) {
    var nonce = n.toString(36);
    if (zeroBits(sha256Bytes(enc.encode(prefix + nonce))) >= bits) return nonce;
  }
  return null;
}
`;

const WORKER = `${CODE}
onmessage = function (e) {
  var d = e.data, start = 0, step = 20000;
  for (;;) {
    var r = search(d.challenge, d.bits, start, step);
    if (r !== null) { postMessage(r); return; }
    start += step;
  }
};`;

interface Lib { sha256Bytes(msg: Uint8Array): Uint32Array; zeroBits(h: Uint32Array): number; search(challenge: string, bits: number, start: number, count: number): string | null }
const lib = new Function(`${CODE}\nreturn { sha256Bytes: sha256Bytes, zeroBits: zeroBits, search: search };`)() as Lib;

export const sha256Bytes = lib.sha256Bytes;
export const zeroBits = lib.zeroBits;
export const search = lib.search;

/** Solve a challenge. Resolves with the nonce. */
export function solve(challenge: string, bits: number): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const url = URL.createObjectURL(new Blob([WORKER], { type: "text/javascript" }));
      const w = new Worker(url);
      w.onmessage = (e) => { w.terminate(); URL.revokeObjectURL(url); resolve(String(e.data)); };
      w.onerror = () => { w.terminate(); URL.revokeObjectURL(url); mainThread(challenge, bits).then(resolve, reject); };
      w.postMessage({ challenge, bits });
    } catch {
      mainThread(challenge, bits).then(resolve, reject);
    }
  });
}

function mainThread(challenge: string, bits: number): Promise<string> {
  return new Promise((resolve) => {
    let start = 0;
    const tick = () => {
      const r = search(challenge, bits, start, 4000);
      if (r !== null) return resolve(r);
      start += 4000;
      setTimeout(tick, 0);
    };
    tick();
  });
}
