// Forward pass of the exported policy net (see skyjo-ml `skyjo/export.py` for the schema).
// layers: body layers then the policy layer, ReLU after all but the last. The value head is not exported.

export interface Layer {
  w: Float64Array; // [out * in], row-major
  b: Float64Array;
  inSize: number;
  outSize: number;
}

export interface Net {
  inputSize: number;
  actionSize: number;
  layers: Layer[];
}

export function loadNet(json: unknown): Net {
  const j = json as { inputSize?: number; actionSize?: number; activation?: string; layers?: { w: number[][]; b: number[] }[] };
  if (!j || !Array.isArray(j.layers) || j.layers.length < 1 || j.activation !== 'relu') throw new Error('bad net json');
  const layers: Layer[] = j.layers.map((l) => {
    const outSize = l.b.length;
    const inSize = l.w[0]?.length ?? 0;
    if (l.w.length !== outSize || l.w.some((r) => r.length !== inSize)) throw new Error('bad layer shape');
    const w = new Float64Array(outSize * inSize);
    l.w.forEach((row, i) => w.set(row, i * inSize));
    return { w, b: Float64Array.from(l.b), inSize, outSize };
  });
  for (let i = 1; i < layers.length; i++) if (layers[i].inSize !== layers[i - 1].outSize) throw new Error('layer sizes do not chain');
  const inputSize = layers[0].inSize;
  const actionSize = layers[layers.length - 1].outSize;
  if (j.inputSize !== inputSize || j.actionSize !== actionSize) throw new Error('size fields do not match layers');
  return { inputSize, actionSize, layers };
}

/** `value` is always 0: the value head is not part of the shipped weights. */
export function forward(net: Net, x: Float32Array): { logits: Float32Array; value: number } {
  if (x.length !== net.inputSize) throw new Error('bad input size');
  // One array type and local references in the hot loop: same arithmetic, about 1.5x faster.
  let h = Float64Array.from(x);
  const n = net.layers.length;
  for (let li = 0; li < n; li++) {
    const { w, b, inSize, outSize } = net.layers[li];
    const out = new Float64Array(outSize);
    const last = li === n - 1;
    for (let o = 0; o < outSize; o++) {
      let s = b[o];
      const base = o * inSize;
      for (let i = 0; i < inSize; i++) s += w[base + i] * h[i];
      out[o] = last || s > 0 ? s : 0;
    }
    h = out;
  }
  return { logits: Float32Array.from(h), value: 0 };
}

/** Index of the largest logit among legal actions (first on ties); non-finite logits count as -Infinity.
 * Returns -1 only when no action is legal. Never returns an illegal action. */
export function argmaxLegal(logits: ArrayLike<number>, mask: boolean[]): number {
  let best = -1;
  let bestVal = -Infinity;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const v = Number.isFinite(logits[i]) ? logits[i] : -Infinity;
    if (best < 0 || v > bestVal) {
      best = i;
      bestVal = v;
    }
  }
  return best;
}
