/* Pocket-Canvas — names for colours
 * Copyright (c) 2026 Pocket-Designs <pocket-designs@proton.me>
 *
 * colourName(hex) gives a name that is true to the colour:
 *  - If the colour is (to the eye) the same as a well-known named colour, you get that name:
 *    '#8b4513' → 'Saddle Brown', '#ff7f50' → 'Coral'. "The same" means a colour difference
 *    (CIEDE2000) of under 2.5, about the smallest difference people can see.
 *  - Otherwise it describes the colour from its hue, lightness and strength:
 *    '#5b3600' → 'Dark Golden Brown', '#7f2e00' → 'Dark Reddish Brown', '#3a7be0' → 'Blue'.
 * So two clearly different colours no longer share a name that fits neither.
 * Names use British spelling (Grey, Colour).
 */
'use strict';

// The standard web (CSS) colour names.
const COLOUR_NAMES = {
  AliceBlue: 'f0f8ff', AntiqueWhite: 'faebd7', Aquamarine: '7fffd4', Azure: 'f0ffff', Beige: 'f5f5dc',
  Bisque: 'ffe4c4', Black: '000000', BlanchedAlmond: 'ffebcd', Blue: '0000ff', BlueViolet: '8a2be2',
  Brown: 'a52a2a', Burlywood: 'deb887', CadetBlue: '5f9ea0', Chartreuse: '7fff00', Chocolate: 'd2691e',
  Coral: 'ff7f50', CornflowerBlue: '6495ed', Cornsilk: 'fff8dc', Crimson: 'dc143c', Cyan: '00ffff',
  DarkBlue: '00008b', DarkCyan: '008b8b', DarkGoldenrod: 'b8860b', DarkGrey: 'a9a9a9', DarkGreen: '006400',
  DarkKhaki: 'bdb76b', DarkMagenta: '8b008b', DarkOliveGreen: '556b2f', DarkOrange: 'ff8c00', DarkOrchid: '9932cc',
  DarkRed: '8b0000', DarkSalmon: 'e9967a', DarkSeaGreen: '8fbc8f', DarkSlateBlue: '483d8b', DarkSlateGrey: '2f4f4f',
  DarkTurquoise: '00ced1', DarkViolet: '9400d3', DeepPink: 'ff1493', DeepSkyBlue: '00bfff', DimGrey: '696969',
  DodgerBlue: '1e90ff', Firebrick: 'b22222', FloralWhite: 'fffaf0', ForestGreen: '228b22', Gainsboro: 'dcdcdc',
  GhostWhite: 'f8f8ff', Gold: 'ffd700', Goldenrod: 'daa520', Grey: '808080', Green: '008000',
  GreenYellow: 'adff2f', Honeydew: 'f0fff0', HotPink: 'ff69b4', IndianRed: 'cd5c5c', Indigo: '4b0082',
  Ivory: 'fffff0', Khaki: 'f0e68c', Lavender: 'e6e6fa', LavenderBlush: 'fff0f5', LawnGreen: '7cfc00',
  LemonChiffon: 'fffacd', LightBlue: 'add8e6', LightCoral: 'f08080', LightCyan: 'e0ffff', LightGoldenrodYellow: 'fafad2',
  LightGrey: 'd3d3d3', LightGreen: '90ee90', LightPink: 'ffb6c1', LightSalmon: 'ffa07a', LightSeaGreen: '20b2aa',
  LightSkyBlue: '87cefa', LightSlateGrey: '778899', LightSteelBlue: 'b0c4de', LightYellow: 'ffffe0', Lime: '00ff00',
  LimeGreen: '32cd32', Linen: 'faf0e6', Magenta: 'ff00ff', Maroon: '800000', MediumAquamarine: '66cdaa',
  MediumBlue: '0000cd', MediumOrchid: 'ba55d3', MediumPurple: '9370db', MediumSeaGreen: '3cb371', MediumSlateBlue: '7b68ee',
  MediumSpringGreen: '00fa9a', MediumTurquoise: '48d1cc', MediumVioletRed: 'c71585', MidnightBlue: '191970', MintCream: 'f5fffa',
  MistyRose: 'ffe4e1', Moccasin: 'ffe4b5', NavajoWhite: 'ffdead', Navy: '000080', OldLace: 'fdf5e6',
  Olive: '808000', OliveDrab: '6b8e23', Orange: 'ffa500', OrangeRed: 'ff4500', Orchid: 'da70d6',
  PaleGoldenrod: 'eee8aa', PaleGreen: '98fb98', PaleTurquoise: 'afeeee', PaleVioletRed: 'db7093', PapayaWhip: 'ffefd5',
  PeachPuff: 'ffdab9', Peru: 'cd853f', Pink: 'ffc0cb', Plum: 'dda0dd', PowderBlue: 'b0e0e6',
  Purple: '800080', RebeccaPurple: '663399', Red: 'ff0000', RosyBrown: 'bc8f8f', RoyalBlue: '4169e1',
  SaddleBrown: '8b4513', Salmon: 'fa8072', SandyBrown: 'f4a460', SeaGreen: '2e8b57', Seashell: 'fff5ee',
  Sienna: 'a0522d', Silver: 'c0c0c0', SkyBlue: '87ceeb', SlateBlue: '6a5acd', SlateGrey: '708090',
  Snow: 'fffafa', SpringGreen: '00ff7f', SteelBlue: '4682b4', Tan: 'd2b48c', Teal: '008080',
  Thistle: 'd8bfd8', Tomato: 'ff6347', Turquoise: '40e0d0', Violet: 'ee82ee', Wheat: 'f5deb3',
  White: 'ffffff', WhiteSmoke: 'f5f5f5', Yellow: 'ffff00', YellowGreen: '9acd32'
};


// Other well-known colour names, with their usual codes.
const COLOUR_NAMES_EXTRA = {
  Amber: 'ffbf00', Bronze: 'cd7f32', Burgundy: '800020', BurntOrange: 'cc5500', BurntSienna: 'e97451',
  Charcoal: '36454f', Cobalt: '0047ab', Copper: 'b87333', Cream: 'fffdd0', Emerald: '50c878',
  Jade: '00a86b', Lemon: 'fff700', Lilac: 'c8a2c8', Mahogany: 'c04000', Mauve: 'e0b0ff',
  MintGreen: '98ff98', Mustard: 'ffdb58', Ochre: 'cc7722', Periwinkle: 'ccccff', Ruby: 'e0115f',
  Rust: 'b7410e', Sapphire: '0f52ba', Scarlet: 'ff2400', Sepia: '704214', Taupe: '483c32',
  Terracotta: 'e2725b', Umber: '635147', Vermilion: 'e34234'
};

// Accepts "#abc", "abc", "#aabbcc" or "aabbcc"; returns "#aabbcc" or null.
function normaliseHex(v) {
  let s = String(v || '').trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(s)) s = s.split('').map((ch) => ch + ch).join('');
  return /^[0-9a-f]{6}$/.test(s) ? '#' + s : null;
}

function hexToLab(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const splitName = (n) => n.replace(/([a-z])([A-Z])/g, '$1 $2');
const COLOUR_LAB = Object.entries({ ...COLOUR_NAMES, ...COLOUR_NAMES_EXTRA })
  .map(([name, hex]) => ({ name: splitName(name), lab: hexToLab(hex) }));

// CIEDE2000 colour difference: how different two colours look to people (about 2.3 = just visible).
function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp = (b, ap) => (b === 0 && ap === 0 ? 0 : (Math.atan2(b, ap) * deg + 360) % 360);
  const hp1 = hp(b1, ap1), hp2 = hp(b2, ap2);
  const dL = L2 - L1, dC = Cp2 - Cp1;
  let dh = 0;
  if (Cp1 * Cp2) { dh = hp2 - hp1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dh * rad / 2);
  const Lm = (L1 + L2) / 2, Cpm = (Cp1 + Cp2) / 2;
  let hm = hp1 + hp2;
  if (Cp1 * Cp2) hm = Math.abs(hp1 - hp2) > 180 ? (hp1 + hp2 + (hp1 + hp2 < 360 ? 360 : -360)) / 2 : (hp1 + hp2) / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const Sl = 1 + 0.015 * (Lm - 50) ** 2 / Math.sqrt(20 + (Lm - 50) ** 2);
  const Sc = 1 + 0.045 * Cpm, Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

// Hue families, each placed at a typical colour of that family (its hue, lightness and strength in Lab).
const HUE_FAMILIES = [
  ['Red', 'e32322'], ['Orange', 'f28500'], ['Amber', 'f5b000'], ['Yellow', 'f2e000'], ['Lime', '9acd32'],
  ['Green', '2e9e44'], ['Teal', '14a090'], ['Cyan', '10b0d0'], ['Blue', '2a6ae0'], ['Indigo', '4b3fc0'],
  ['Violet', '7a3fd0'], ['Purple', '9a2fb0'], ['Magenta', 'd0209a'], ['Pink', 'e8407a']
].map(([name, hex]) => { const [L, a, b] = hexToLab('#' + hex); return { name, L, C: Math.hypot(a, b), h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 }; })
  .sort((x, y) => x.h - y.h);
// Colours half-way between two neighbouring families get a combined name.
const BETWEEN = {
  'Red|Orange': 'Red-Orange', 'Orange|Amber': 'Tangerine', 'Amber|Yellow': 'Golden Yellow', 'Yellow|Lime': 'Yellow-Green',
  'Lime|Green': 'Leaf Green', 'Green|Teal': 'Jade Green', 'Teal|Cyan': 'Turquoise', 'Cyan|Blue': 'Azure',
  'Blue|Indigo': 'Ultramarine', 'Indigo|Violet': 'Blue-Violet', 'Violet|Purple': 'Purple', 'Purple|Magenta': 'Plum Purple',
  'Magenta|Pink': 'Fuchsia Pink', 'Pink|Red': 'Rose Red'
};

// A plain-English description, e.g. "Dark Reddish Brown", "Pale Greyish Blue".
function describeColour([L, a, b]) {
  const C = Math.hypot(a, b);
  const h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  // greys
  if (C < 7 || (C < 10 && (L < 15 || L > 92))) {
    if (L < 9) return 'Black';
    if (L > 96) return 'White';
    const tint = C >= 3.5 ? (h > 40 && h < 160 ? 'Warm ' : (h > 180 && h < 320 ? 'Cool ' : '')) : '';
    if (L < 28) return tint + 'Charcoal Grey';
    if (L < 45) return tint + 'Dark Grey';
    if (L < 65) return tint + 'Grey';
    if (L < 85) return tint + 'Light Grey';
    return tint + 'Pale Grey';
  }
  // the two families either side of this hue, and how far between them it sits
  const F = HUE_FAMILIES, n = F.length;
  let k = F.findIndex((f) => f.h > h); if (k < 0) k = 0;
  const A = F[(k - 1 + n) % n], B = F[k];
  const span = (B.h - A.h + 360) % 360 || 360, t = ((h - A.h + 360) % 360) / span;
  const fam = t < 0.5 ? A : B;
  let name = t > 0.3 && t < 0.7 ? (BETWEEN[A.name + '|' + B.name] || fam.name) : fam.name;
  // lightness and strength compared with a typical colour of the family
  const dL = L - fam.L, rel = C / fam.C;
  const plain = ['Red', 'Red-Orange', 'Orange', 'Tangerine', 'Amber', 'Golden Yellow', 'Yellow'];
  let special = false;
  // what people call dark or washed-out versions of some hues
  if (fam.name === 'Red' && L < 42 && rel < 0.55) { name = 'Reddish Brown'; special = true; }
  else if (['Red-Orange', 'Orange'].includes(name) && L < 55 && rel < 0.85) { name = name === 'Red-Orange' ? 'Reddish Brown' : 'Brown'; special = true; }
  else if (['Tangerine', 'Amber', 'Golden Yellow'].includes(name) && L < 58 && rel < 0.85) { name = 'Golden Brown'; special = true; }
  else if (name === 'Yellow' && L < 62) { name = rel < 0.35 ? 'Olive Brown' : 'Olive'; special = true; }
  else if ((name === 'Yellow-Green' && L < 55) || (name === 'Lime' && L < 50)) { name = 'Olive Green'; special = true; }
  else if (['Orange', 'Tangerine', 'Amber', 'Golden Yellow'].includes(name) && rel < 0.55 && L >= 55 && L <= 80) { name = 'Tan'; special = true; }
  else if (plain.includes(name) && L > 80 && rel < 0.35) { name = { Red: 'Blush', 'Red-Orange': 'Blush', Orange: 'Peach', Tangerine: 'Peach', Amber: 'Beige', 'Golden Yellow': 'Cream', Yellow: 'Cream' }[name]; special = true; }
  else if (['Red', 'Rose Red'].includes(name) && dL > 14) { name = 'Pink'; special = true; }
  else if (['Blue', 'Ultramarine', 'Indigo'].includes(name) && L < 22) return 'Navy';
  else if (name === 'Red' && L < 22) return 'Maroon';
  const mods = [];
  const base = special ? null : dL;
  if (L < 16) mods.push('Very Dark');
  else if (base === null ? L < 30 : dL < -10) mods.push('Dark');
  else if (base !== null && dL > 28 && L > 80) mods.push('Pale');
  else if (base !== null && dL > 12 && rel <= 1.05) mods.push('Light');
  if (!['Blush', 'Peach', 'Beige', 'Cream', 'Olive Brown'].includes(name)) {
    if (rel < 0.28) mods.push('Greyish');
    else if (rel < 0.45 && !special && L <= 75) mods.push('Muted');
    else if (rel > 1.05 && !special) mods.push('Bright');
  }
  return [...mods, name].join(' ');
}

function colourName(hex) {
  const h = normaliseHex(hex);
  if (!h) return '';
  const lab = hexToLab(h);
  let best = null, bestD = Infinity;
  for (const c of COLOUR_LAB) {
    const d = deltaE2000(lab, c.lab);
    if (d < bestD) { bestD = d; best = c.name; }
  }
  return bestD < 2.5 ? best : describeColour(lab);
}
