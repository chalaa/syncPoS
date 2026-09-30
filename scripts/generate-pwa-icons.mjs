import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function createPng(width, height, drawFn) {
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const body = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body), 0);
    return Buffer.concat([len, body, crc]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth 8
  ihdr[9] = 6; // Color type RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk("IHDR", ihdr);
  const idatChunk = makeChunk("IDAT", compressed);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function drawAppIcon(x, y, w, h, isMaskable = false) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background
  let r = 11; // #0B
  let g = 93; // #5D
  let b = 75; // #4B
  let a = 255;

  if (!isMaskable) {
    // Rounded corner box for normal icons
    const rx = Math.abs(dx);
    const ry = Math.abs(dy);
    const cornerRadius = w * 0.22;
    const innerW = cx - cornerRadius;
    const innerH = cy - cornerRadius;

    if (rx > innerW && ry > innerH) {
      const cDist = Math.sqrt((rx - innerW) ** 2 + (ry - innerH) ** 2);
      if (cDist > cornerRadius) {
        return [0, 0, 0, 0]; // Transparent outside rounded corner
      }
    }
  }

  // Dark radial gradient overlay towards edges
  const gradRatio = Math.min(1, dist / (cx * 1.2));
  r = Math.round(r * (1 - gradRatio * 0.35));
  g = Math.round(g * (1 - gradRatio * 0.35));
  b = Math.round(b * (1 - gradRatio * 0.35));

  // Outer Gold Accent Circle / Ring
  const outerRingR = w * 0.34;
  const innerRingR = w * 0.27;

  if (dist >= innerRingR && dist <= outerRingR) {
    // Gold gradient (#F59E0B / #FBBF24)
    r = 245;
    g = 158;
    b = 11;
  }

  // Center emblem - Gear teeth & S shape (Sync emblem)
  const angle = Math.atan2(dy, dx);
  const teethCount = 8;
  const toothAngle = (Math.PI * 2) / teethCount;
  const inTooth = Math.cos(angle * teethCount) > 0;
  const gearR = inTooth ? w * 0.22 : w * 0.18;

  if (dist <= gearR && dist > w * 0.08) {
    // White/Gold gear body
    r = 255;
    g = 255;
    b = 255;
  }

  if (dist <= w * 0.08) {
    // Center Gold Core
    r = 245;
    g = 158;
    b = 11;
  }

  return [r, g, b, a];
}

const iconsDir = path.resolve("public/icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

console.log("Generating PWA PNG icons...");
const icon192 = createPng(192, 192, (x, y, w, h) => drawAppIcon(x, y, w, h, false));
fs.writeFileSync(path.join(iconsDir, "icon-192x192.png"), icon192);

const icon512 = createPng(512, 512, (x, y, w, h) => drawAppIcon(x, y, w, h, false));
fs.writeFileSync(path.join(iconsDir, "icon-512x512.png"), icon512);

const maskable512 = createPng(512, 512, (x, y, w, h) => drawAppIcon(x, y, w, h, true));
fs.writeFileSync(path.join(iconsDir, "maskable-512x512.png"), maskable512);

const appleTouch = createPng(180, 180, (x, y, w, h) => drawAppIcon(x, y, w, h, true));
fs.writeFileSync(path.resolve("public/apple-touch-icon.png"), appleTouch);
fs.writeFileSync(path.resolve("public/icon-192.png"), icon192);
fs.writeFileSync(path.resolve("public/icon-512.png"), icon512);

// Vector SVG Icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B5D4B" />
      <stop offset="100%" stop-color="#052E26" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FBBF24" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />
  <circle cx="256" cy="256" r="160" fill="none" stroke="url(#goldGrad)" stroke-width="28" opacity="0.9" />
  <path d="M256 128 C326.97 128 384 185.03 384 256 C384 326.97 326.97 384 256 384 C185.03 384 128 326.97 128 256 C128 185.03 185.03 128 256 128 Z" fill="none" stroke="#FFFFFF" stroke-width="16" stroke-dasharray="80 30" />
  <circle cx="256" cy="256" r="48" fill="url(#goldGrad)" />
  <path d="M224 256 L248 280 L296 232" fill="none" stroke="#052E26" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

fs.writeFileSync(path.join(iconsDir, "icon.svg"), svgContent);
fs.writeFileSync(path.resolve("public/icon.svg"), svgContent);

console.log("Successfully generated all PWA icons in public/ and public/icons/");
