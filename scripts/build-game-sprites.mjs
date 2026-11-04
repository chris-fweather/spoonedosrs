// Interface art from the game cache: the world map globe (WorldmapIconLarge, sprite 1698), the site's Map nav icon, and
// the game sprites that stand in for the site's own drawings (public/icons/game: spellbook tabs, the minigame grouping
// icon, the damage hitsplat, the PK skull, chat bubbles, the bank search glass and the inventory tab; see
// docs/icon-audit.md). Sprite names follow RuneLite's SpriteID.
// Reads the sprite index of a flat cache dump such as https://github.com/abextm/osrs-cache (8.flatcache) and writes
// nearest-neighbour upscaled PNGs (paths relative to the repo root). Sprite decoding follows RuneLite's cache
// SpriteLoader. Game imagery belongs to Jagex.
// Also the reward windows' stone frame (public/icons/ui-reward, app/guide-rewards.css): the game's "steelborder" that
// clientscript 228 draws around Barrows, raid and Lunar Chest rewards, composed at 1x into one 9-slice image.
//   node scripts/build-game-sprites.mjs <path/to/8.flatcache> [repoRoot]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {execFileSync} from 'node:child_process';

/** bzip2 groups (the cache stores them without the 'BZh1' header): Node has no bzip2, so Python's does it. */
const bunzip = data => execFileSync('python3', ['-I', '-c', 'import bz2,sys;sys.stdout.buffer.write(bz2.decompress(sys.stdin.buffer.read()))'], {input: Buffer.concat([Buffer.from('BZh1'), data]), maxBuffer: 1 << 26});

const ICONS = [
  {file: 'public/icons/navigation/world-map-icon.png', group: 1698, frame: 0, scale: 4},
  // Trimmed to the visible pixels, then 4× nearest neighbour.
  ...[
    ['spellbook-standard', 780], ['spellbook-ancient', 1583], ['spellbook-lunar', 1584], ['spellbook-arceuus', 1711],// TAB_MAGIC, TAB_MAGIC_SPELLBOOK_*
    ['minigame', 1053],// TAB_QUESTS_RED_MINIGAMES: the minigame grouping tab
    ['hitsplat', 1359],// the red damage hitsplat (Hitmark group, unnamed in SpriteID)
    ['skull', 439],// PLAYER_KILLER_SKULL (HEADICONS_PK frame 0)
    ['chat', 664],// OPTIONS_SPLIT_PRIVATE_CHAT: two speech bubbles
    ['search', 1043],// BANK_SEARCH: the magnifying glass
    ['inventory', 900],// TAB_INVENTORY: the backpack
  ].map(([name, group]) => ({file: `public/icons/game/${name}.png`, group, frame: 0, scale: 4, trim: true})),
  // The chatbox (the plugin page's chat example), at 1x: CHATBOX (its parchment and frame) and
  // CHATBOX_BUTTONS_BACKGROUND_STONES (the stone strip under it that holds the chat tabs).
  {file: 'public/icons/plugin/chatbox.png', group: 1017, frame: 0, scale: 1},
  {file: 'public/icons/plugin/chatbox-buttons.png', group: 1018, frame: 0, scale: 1},
];

const [flat, root = '.'] = process.argv.slice(2);
if (!flat) { console.error('usage: node scripts/build-game-sprites.mjs <8.flatcache> [repoRoot]'); process.exit(1); }

/** The packed contents of each sprite group in the flat cache. */
function readGroups(file) {
  const groups = new Map();
  let id = -1;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('id=')) id = Number(line.slice(3));
    else if (line.startsWith('contents=') && id >= 0) groups.set(id, line.slice(9));
  }
  return groups;
}
function unpack(b64) {
  const b = Buffer.from(b64, 'base64'), type = b[0], len = b.readInt32BE(1);
  if (type === 0) return b.subarray(5, 5 + len);
  if (type === 2) return zlib.gunzipSync(b.subarray(9, 9 + len));
  if (type === 1) return bunzip(b.subarray(9, 9 + len));
  throw new Error('unsupported compression ' + type);
}
/** One frame of a sprite group as RGBA on the group's full canvas. */
function decodeFrame(b, want) {
  const count = b.readUInt16BE(b.length - 2);
  let p = b.length - 7 - count * 8;
  const width = b.readUInt16BE(p), height = b.readUInt16BE(p + 2), palette = [0];
  const table = k => Array.from({length: count}, (_, i) => b.readUInt16BE(p + 5 + (k * count + i) * 2));
  const [ox, oy, fw, fh] = [0, 1, 2, 3].map(table);
  p = b.length - 7 - count * 8 - (b[p + 4]) * 3;
  for (let i = 1; i <= b[b.length - 7 - count * 8 + 4]; i++, p += 3) palette.push((b[p] << 16 | b[p + 1] << 8 | b[p + 2]) || 1);
  p = 0;
  for (let f = 0; f < count; f++) {
    const w = fw[f], h = fh[f], n = w * h, flags = b[p++], at = i => flags & 1 ? (i % h) * w + Math.floor(i / h) : i;
    const index = new Uint8Array(n), alpha = new Uint8Array(n);
    for (let i = 0; i < n; i++) index[at(i)] = b[p++];
    if (flags & 2) for (let i = 0; i < n; i++) alpha[at(i)] = b[p++];
    else for (let i = 0; i < n; i++) alpha[i] = index[i] ? 255 : 0;
    if (f !== want) continue;
    const rgba = Buffer.alloc(width * height * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, o = ((y + oy[f]) * width + x + ox[f]) * 4, c = palette[index[i]];
      if (!index[i]) continue;
      rgba[o] = c >> 16 & 255; rgba[o + 1] = c >> 8 & 255; rgba[o + 2] = c & 255; rgba[o + 3] = alpha[i];
    }
    return {width, height, rgba};
  }
  throw new Error('no frame ' + want);
}
function upscale({width, height, rgba}, s) {
  const out = Buffer.alloc(width * height * s * s * 4);
  for (let y = 0; y < height * s; y++) for (let x = 0; x < width * s; x++) {
    const from = (Math.floor(y / s) * width + Math.floor(x / s)) * 4;
    rgba.copy(out, (y * width * s + x) * 4, from, from + 4);
  }
  return {width: width * s, height: height * s, rgba: out};
}
/** Crop to the pixels that are not fully transparent. */
function trim({width, height, rgba}) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (rgba[(y * width + x) * 4 + 3]) {left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);}
  const w = right - left + 1, h = bottom - top + 1, out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) rgba.copy(out, y * w * 4, ((y + top) * width + left) * 4, ((y + top) * width + left + w) * 4);
  return {width: w, height: h, rgba: out};
}
const CRC = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const x of buf) c = CRC[(c ^ x) & 255] ^ c >>> 8; return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const head = Buffer.alloc(4), tail = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type), data]);
  head.writeUInt32BE(data.length); tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}
function png({width, height, rgba}) {
  const row = width * 4 + 1, raw = Buffer.alloc(row * height), ihdr = Buffer.alloc(13);
  for (let y = 0; y < height; y++) rgba.copy(raw, y * row + 1, y * width * 4, (y + 1) * width * 4);
  ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, {level: 9})), chunk('IEND', Buffer.alloc(0))]);
}

const groups = readGroups(flat);
for (const icon of ICONS) {
  const frame = decodeFrame(unpack(groups.get(icon.group)), icon.frame), image = upscale(icon.trim ? trim(frame) : frame, icon.scale);
  fs.mkdirSync(path.dirname(path.join(root, icon.file)), {recursive: true});
  fs.writeFileSync(path.join(root, icon.file), png(image));
  console.log(icon.file, `${image.width}x${image.height}`, `sprite ${icon.group} frame ${icon.frame}`);
}

/** Draw one RGBA image over another at (x, y), clipped to the canvas (the game's frame pieces hang over its edges). */
function over(dst, src, x0, y0) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const dx = x + x0, dy = y + y0, s = (y * src.width + x) * 4;
    if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height || !src.rgba[s + 3]) continue;
    src.rgba.copy(dst.rgba, (dy * dst.width + dx) * 4, s, s + 4);
  }
}
/** The steelborder as a CSS 9-slice (border-image-slice 30 25): Steelborder 310-313 are the 25x30 corners; Miscgraphics
 * 172/Steelborder2 315 the left and right edges and Steelborder2 314/Miscgraphics 173 the top and bottom (36x36 tiles
 * drawn 15px outside the window, as clientscript 228 places them). One edge tile between the corners. */
const sprite = id => decodeFrame(unpack(groups.get(id)), 0);
const W = 25 + 36 + 25, H = 30 + 36 + 30, frame = {width: W, height: H, rgba: Buffer.alloc(W * H * 4)};
over(frame, sprite(172), -15, 30); over(frame, sprite(315), W - 36 + 15, 30);
over(frame, sprite(314), 25, -15); over(frame, sprite(173), 25, H - 36 + 15);
over(frame, sprite(310), 0, 0); over(frame, sprite(311), W - 25, 0); over(frame, sprite(312), 0, H - 30); over(frame, sprite(313), W - 25, H - 30);
const REWARD = [['steelborder.png', frame], ['tradebacking.png', sprite(297)], ['steelborder-divider.png', sprite(2546)]];
for (const [name, image] of REWARD) {
  const file = path.join(root, 'public/icons/ui-reward', name);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, png(image));
  console.log('public/icons/ui-reward/' + name, `${image.width}x${image.height}`);
}
