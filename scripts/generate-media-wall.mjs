// Renders the home hero media wall artwork into public/media-wall/tile-*.webp
// Run: node scripts/generate-media-wall.mjs
//
// Each tile is a lit height field: warped value noise is treated as a surface,
// shaded with diffuse + Blinn-Phong specular + a thin-film fresnel tint. That
// gives the liquid-metal / iridescent foil look of generated media stills
// without shipping third-party assets.
//
// Tiles cycle through 9 materials x 7 flow structures, so all 50 are distinct;
// the hero gives every row its own slice, so nothing repeats on screen.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const COUNT = 50;
// 2x the 400x300 card, so the wall stays crisp on retina without shipping
// megapixel sources for pure decoration.
const W = 800;
const H = 600;
const CW = W / 2;
const CH = H / 2;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const random = mulberry32(seed);
  const size = 256;
  const values = new Float32Array(size * size);
  for (let i = 0; i < values.length; i += 1) values[i] = random();
  const fade = (t) => t * t * (3 - 2 * t);
  const at = (x, y) =>
    values[(((y % size) + size) % size) * size + (((x % size) + size) % size)];

  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = fade(x - x0);
    const fy = fade(y - y0);
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
    const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

function fbm(noise, x, y, octaves = 5) {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * noise(x * frequency, y * frequency);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / norm;
}

const hex = (value) => {
  const n = Number.parseInt(value.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

// Global grade: these sit behind heavy scrims, so they are rendered brighter
// than a physically correct render would be.
const EXPOSURE = 1.42;
const GAMMA = 0.86;

const LIGHT = (() => {
  const v = [-0.38, -0.52, 0.76];
  const len = Math.hypot(...v);
  return v.map((n) => n / len);
})();
const HALF = (() => {
  const v = [LIGHT[0], LIGHT[1], LIGHT[2] + 1];
  const len = Math.hypot(...v);
  return v.map((n) => n / len);
})();

function renderTile(seed, material, structure) {
  const noise = makeNoise(seed);
  const warp = makeNoise(seed + 1013);
  const grain = mulberry32(seed + 29);

  const height = (u, v) => {
    const wx =
      (fbm(warp, u * structure.warpScale + 3.7, v * structure.warpScale, 3) -
        0.5) *
      structure.warpAmount;
    const wy =
      (fbm(
        warp,
        u * structure.warpScale + 8.1,
        v * structure.warpScale + 5.3,
        3,
      ) -
        0.5) *
      structure.warpAmount;
    const x = (u + wx) * structure.scale;
    const y = (v + wy) * structure.scale * structure.stretch;
    return fbm(noise, x, y, 4);
  };

  const pixels = Buffer.alloc(CW * CH * 3);
  const step = 1 / CW;
  const aspect = CW / CH;

  for (let y = 0; y < CH; y += 1) {
    for (let x = 0; x < CW; x += 1) {
      const u = x / CW;
      const v = y / CH;

      const h = height(u, v);
      const hx = height(u + step, v) - height(u - step, v);
      const hy = height(u, v + step) - height(u, v - step);

      let nx = -hx * structure.relief;
      let ny = -hy * structure.relief;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;

      const diffuse = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const spec = Math.pow(
        Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]),
        structure.gloss,
      );
      const fresnel = Math.pow(1 - nz, 2.6);

      let color = mix(
        hex(material.shadow),
        hex(material.mid),
        smoothstep(0.15, 0.9, h),
      );
      color = mix(color, hex(material.base), smoothstep(0.55, 1.0, nz) * 0.35);

      // Studio key light from the upper left.
      const kx = (u - 0.34) * aspect;
      const ky = v - 0.3;
      const key = 0.35 + 0.9 * Math.exp(-(kx * kx + ky * ky) * 2.2);

      const shade = 0.42 + 1.05 * diffuse * key;
      color = [color[0] * shade, color[1] * shade, color[2] * shade];

      color = mix(color, hex(material.iris), fresnel * material.irisStrength);
      color = mix(
        color,
        hex(material.highlight),
        Math.min(1, spec * material.specular * key),
      );

      // Ambient bounce from the lower right keeps shadows from going flat.
      const bx = (u - 0.78) * aspect;
      const by = v - 0.82;
      const bounce = Math.exp(-(bx * bx + by * by) * 3.4);
      color = mix(color, hex(material.bounce), bounce * 0.22 * (1 - diffuse));

      const vx = (u - 0.5) * 1.4;
      const vy = (v - 0.5) * 1.4;
      const vig = 1 - 0.45 * smoothstep(0.4, 1.1, Math.hypot(vx, vy));
      color = [color[0] * vig, color[1] * vig, color[2] * vig];

      const g = (grain() - 0.5) * 0.02;
      const i = (y * CW + x) * 3;
      pixels[i] = Math.round(
        Math.pow(clamp01(color[0] * EXPOSURE + g), GAMMA) * 255,
      );
      pixels[i + 1] = Math.round(
        Math.pow(clamp01(color[1] * EXPOSURE + g), GAMMA) * 255,
      );
      pixels[i + 2] = Math.round(
        Math.pow(clamp01(color[2] * EXPOSURE + g), GAMMA) * 255,
      );
    }
  }

  return sharp(pixels, { raw: { width: CW, height: CH, channels: 3 } })
    .resize(W, H, { kernel: "lanczos3" })
    .webp({ quality: 74, effort: 6 })
    .toBuffer();
}

/** Four neutrals + five accents keeps the wall rich without turning rainbow. */
const MATERIALS = [
  {
    shadow: "#0a0d12",
    mid: "#6f7d8f",
    base: "#1a2029",
    iris: "#9fd8ff",
    irisStrength: 0.5,
    highlight: "#ffffff",
    specular: 1.5,
    bounce: "#3f6fa8",
  },
  {
    shadow: "#08090b",
    mid: "#8b96a3",
    base: "#14181d",
    iris: "#cfe4ff",
    irisStrength: 0.35,
    highlight: "#ffffff",
    specular: 1.7,
    bounce: "#44505e",
  },
  {
    shadow: "#070b10",
    mid: "#5b6f85",
    base: "#16202b",
    iris: "#a8c8ff",
    irisStrength: 0.45,
    highlight: "#eef4ff",
    specular: 1.6,
    bounce: "#2c4a68",
  },
  {
    shadow: "#100d08",
    mid: "#9a8a6a",
    base: "#221c12",
    iris: "#ffe9c0",
    irisStrength: 0.4,
    highlight: "#fffaf0",
    specular: 1.3,
    bounce: "#6b5636",
  },
  {
    shadow: "#0b0714",
    mid: "#6d4bb0",
    base: "#1a1030",
    iris: "#ff9ee6",
    irisStrength: 0.85,
    highlight: "#f2e6ff",
    specular: 1.4,
    bounce: "#5a3bb0",
  },
  {
    shadow: "#12070c",
    mid: "#a3546f",
    base: "#24101a",
    iris: "#ffb3c8",
    irisStrength: 0.75,
    highlight: "#fff0f4",
    specular: 1.4,
    bounce: "#7a2f45",
  },
  {
    shadow: "#0d0805",
    mid: "#b06a24",
    base: "#241408",
    iris: "#ffc46b",
    irisStrength: 0.7,
    highlight: "#fff2d8",
    specular: 1.6,
    bounce: "#8a3b18",
  },
  {
    shadow: "#04100f",
    mid: "#2f7d7a",
    base: "#0a1f20",
    iris: "#8dffe9",
    irisStrength: 0.8,
    highlight: "#e8fff9",
    specular: 1.4,
    bounce: "#1f6f7a",
  },
  {
    shadow: "#04120c",
    mid: "#2f8f5e",
    base: "#0a2318",
    iris: "#8dffc4",
    irisStrength: 0.75,
    highlight: "#e9fff2",
    specular: 1.4,
    bounce: "#1f7a55",
  },
];

const STRUCTURES = [
  { scale: 1.9, stretch: 0.55, warpScale: 1.1, warpAmount: 2.2, relief: 30, gloss: 34 },
  { scale: 3.2, stretch: 0.9, warpScale: 2.0, warpAmount: 1.6, relief: 40, gloss: 44 },
  { scale: 1.2, stretch: 0.4, warpScale: 0.7, warpAmount: 3.2, relief: 22, gloss: 26 },
  { scale: 2.4, stretch: 1.0, warpScale: 1.6, warpAmount: 2.8, relief: 34, gloss: 40 },
  { scale: 1.6, stretch: 1.35, warpScale: 0.9, warpAmount: 2.6, relief: 26, gloss: 30 },
  { scale: 2.1, stretch: 1.1, warpScale: 1.4, warpAmount: 2.4, relief: 32, gloss: 38 },
  { scale: 1.35, stretch: 0.7, warpScale: 1.2, warpAmount: 2.0, relief: 24, gloss: 32 },
];

// 10-slot hue rhythm: neutrals anchor the set, accents give it life.
const MATERIAL_ORDER = [0, 4, 1, 7, 6, 2, 8, 5, 3, 1];

const outDir = path.join(process.cwd(), "public", "media-wall");
await mkdir(outDir, { recursive: true });

let total = 0;
for (let i = 0; i < COUNT; i += 1) {
  const material = MATERIALS[MATERIAL_ORDER[i % MATERIAL_ORDER.length]];
  const structure = STRUCTURES[(i * 3) % STRUCTURES.length];
  // Small per-tile jitter so two tiles never share an exact look.
  const jitter = 0.92 + ((i * 37) % 17) / 100;
  const tile = {
    ...structure,
    scale: structure.scale * jitter,
    relief: structure.relief * (0.94 + ((i * 13) % 12) / 100),
  };
  const buffer = await renderTile(2000 + i * 811, material, tile);
  total += buffer.length;
  const name = `tile-${String(i + 1).padStart(2, "0")}.webp`;
  await writeFile(path.join(outDir, name), buffer);
}

console.log(`${COUNT} tiles, ${(total / 1024).toFixed(0)} kB total`);
