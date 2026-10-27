/*
 * QR code encoder (model 2, byte mode, error correction level M, versions
 * 1–6). Enough for the short links in the deck, with no dependencies.
 * Follows ISO/IEC 18004: Reed–Solomon over GF(256) with 0x11D, the eight
 * mask patterns and the penalty rules for choosing a mask.
 */

interface VersionInfo {
  /** Error correction codewords per block. */
  ecc: number;
  /** Data codewords per block. All blocks have the same length here. */
  blockData: number;
  blocks: number;
  /** Alignment pattern centres. */
  alignment: readonly number[];
}

// Level M, from table 9 in ISO/IEC 18004.
const VERSIONS: Readonly<Record<number, VersionInfo>> = {
  1: { ecc: 10, blockData: 16, blocks: 1, alignment: [] },
  2: { ecc: 16, blockData: 28, blocks: 1, alignment: [6, 18] },
  3: { ecc: 26, blockData: 44, blocks: 1, alignment: [6, 22] },
  4: { ecc: 18, blockData: 32, blocks: 2, alignment: [6, 26] },
  5: { ecc: 24, blockData: 43, blocks: 2, alignment: [6, 30] },
  6: { ecc: 16, blockData: 27, blocks: 4, alignment: [6, 34] },
};

const LEVEL_M_FORMAT_BITS = 0b00;

export type QrMatrix = readonly (readonly boolean[])[];

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]) {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() ?? 0);
    result.push(0);
    divisor.forEach((coefficient, i) => {
      result[i] ^= gfMultiply(coefficient, factor);
    });
  }
  return result;
}

function dataCodewords(bytes: Uint8Array, info: VersionInfo): number[] {
  const capacity = info.blockData * info.blocks;
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, 8); // character count, versions 1–9
  for (const byte of bytes) push(byte, 8);
  const capacityBits = capacity * 8;
  push(0, Math.min(4, capacityBits - bits.length)); // terminator
  push(0, (8 - (bits.length % 8)) % 8);
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit));
  }
  for (let pad = 0xec; codewords.length < capacity; pad ^= 0xec ^ 0x11) {
    codewords.push(pad);
  }
  return codewords;
}

function interleave(codewords: readonly number[], info: VersionInfo) {
  const divisor = rsDivisor(info.ecc);
  const blocks: number[][] = [];
  const eccBlocks: number[][] = [];
  for (let b = 0; b < info.blocks; b++) {
    const block = codewords.slice(b * info.blockData, (b + 1) * info.blockData);
    blocks.push(block);
    eccBlocks.push(rsRemainder(block, divisor));
  }
  const result: number[] = [];
  for (let i = 0; i < info.blockData; i++) {
    for (const block of blocks) result.push(block[i]);
  }
  for (let i = 0; i < info.ecc; i++) {
    for (const block of eccBlocks) result.push(block[i]);
  }
  return result;
}

function maskApplies(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function formatBits(mask: number): number {
  const data = (LEVEL_M_FORMAT_BITS << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i++) {
    remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  }
  return ((data << 10) | remainder) ^ 0x5412;
}

class Grid {
  readonly size: number;
  readonly modules: boolean[][];
  readonly reserved: boolean[][];

  constructor(size: number) {
    this.size = size;
    this.modules = Array.from({ length: size }, () =>
      new Array<boolean>(size).fill(false),
    );
    this.reserved = Array.from({ length: size }, () =>
      new Array<boolean>(size).fill(false),
    );
  }

  setFunction(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark;
    this.reserved[y][x] = true;
  }
}

function drawFunctionPatterns(grid: Grid, info: VersionInfo) {
  const { size } = grid;
  for (let i = 0; i < size; i++) {
    grid.setFunction(6, i, i % 2 === 0);
    grid.setFunction(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        grid.setFunction(x, y, distance !== 2 && distance !== 4);
      }
    }
  }
  const positions = info.alignment;
  const last = positions.length - 1;
  positions.forEach((cx, i) => {
    positions.forEach((cy, j) => {
      const overlapsFinder =
        (i === 0 && j === 0) ||
        (i === 0 && j === last) ||
        (i === last && j === 0);
      if (overlapsFinder) return;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          grid.setFunction(
            cx + dx,
            cy + dy,
            Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
          );
        }
      }
    });
  });
  drawFormat(grid, 0); // reserves the format areas and the dark module
}

function drawFormat(grid: Grid, mask: number) {
  const { size } = grid;
  const bits = formatBits(mask);
  const bit = (i: number) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) grid.setFunction(8, i, bit(i));
  grid.setFunction(8, 7, bit(6));
  grid.setFunction(8, 8, bit(7));
  grid.setFunction(7, 8, bit(8));
  for (let i = 9; i < 15; i++) grid.setFunction(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) grid.setFunction(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) grid.setFunction(8, size - 15 + i, bit(i));
  grid.setFunction(8, size - 8, true);
}

function drawCodewords(grid: Grid, codewords: readonly number[]) {
  const { size } = grid;
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vertical = 0; vertical < size; vertical++) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (grid.reserved[y][x]) continue;
        if (bitIndex < totalBits) {
          const byte = codewords[bitIndex >>> 3];
          grid.modules[y][x] = ((byte >>> (7 - (bitIndex & 7))) & 1) === 1;
          bitIndex++;
        }
      }
    }
  }
}

function applyMask(grid: Grid, mask: number) {
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      if (!grid.reserved[y][x] && maskApplies(mask, x, y)) {
        grid.modules[y][x] = !grid.modules[y][x];
      }
    }
  }
}

const FINDER_LIKE = [
  [true, false, true, true, true, false, true, false, false, false, false],
  [false, false, false, false, true, false, true, true, true, false, true],
];

function penalty(modules: readonly (readonly boolean[])[]): number {
  const size = modules.length;
  let score = 0;
  const lines: boolean[][] = [];
  for (let i = 0; i < size; i++) {
    lines.push([...modules[i]]);
    lines.push(modules.map((row) => row[i]));
  }
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) {
        run++;
      } else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    for (let i = 0; i + 11 <= size; i++) {
      for (const pattern of FINDER_LIKE) {
        if (pattern.every((value, k) => line[i + k] === value)) score += 40;
      }
    }
  }
  for (let y = 0; y + 1 < size; y++) {
    for (let x = 0; x + 1 < size; x++) {
      const c = modules[y][x];
      if (
        c === modules[y][x + 1] &&
        c === modules[y + 1][x] &&
        c === modules[y + 1][x + 1]
      ) {
        score += 3;
      }
    }
  }
  const dark = modules.reduce(
    (sum, row) => sum + row.filter(Boolean).length,
    0,
  );
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  score += Math.max(0, k) * 10;
  return score;
}

/** Encodes text as a QR code. Throws if the text is too long. */
export function encodeQr(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  const version = Object.keys(VERSIONS)
    .map(Number)
    .find((v) => {
      const info = VERSIONS[v];
      // 4 bits mode + 8 bits count + data must fit the data codewords.
      return 12 + bytes.length * 8 <= info.blockData * info.blocks * 8;
    });
  if (!version) {
    throw new Error("Teksten er for lang for QR-koden.");
  }
  const info = VERSIONS[version];
  const codewords = interleave(dataCodewords(bytes, info), info);

  let best: boolean[][] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    const grid = new Grid(17 + version * 4);
    drawFunctionPatterns(grid, info);
    drawCodewords(grid, codewords);
    applyMask(grid, mask);
    drawFormat(grid, mask);
    const score = penalty(grid.modules);
    if (score < bestScore) {
      bestScore = score;
      best = grid.modules;
    }
  }
  return best ?? [];
}
