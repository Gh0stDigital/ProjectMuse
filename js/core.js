// core.js — shared constants, data, utilities, and asset loaders
export const BASE_W = 390;
export const BASE_H = 844;

// Simple utility helpers
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }

// Game data: player and locations
export const DATA = {
  player: {
    name: "Player",
    level: 1,
    hp: { cur: 100, max: 100 },
    en: { cur: 40, max: 40 },
    coins: 12,
    gems: 0,
    inventory: []
  },
  locations: {
    plaza: {
      name: "Neo Plaza",
      backgroundVariant: "plaza",
      backgroundImage: "assets/Area1.png",
      connections: ["lab", "alley", "apartment"],
      npcs: [
        {
          id: "guide",
          name: "Guide Bot",
          marker: { xPct: 0.18, yPct: 0.44 },
          image: "assets/guideBot.png",
          srcFrac: 0.5,
          dialogue: [
            "Welcome to Neo Plaza! Tap around to explore.",
            "This is a canvas prototype: modular UI + data-driven content.",
            "Use the Movement button to change locations.",
            "Hit Battle Test to jump to the combat stub screen."
          ]
        },
        {
          id: "vendor",
          name: "Street Vendor",
          marker: { xPct: 0.70, yPct: 0.52 },
          image: "assets/NpcGirl.png",
          srcFrac: 0.5,
          dialogue: [
            "Fresh upgrades! (Not really—shop system is a stub.)",
            "If you add items later, hook them into the inventory array."
          ]
        }
      ]
    },
    lab: {
      name: "Skyline Lab",
      backgroundVariant: "lab",
      connections: ["plaza"],
      npcs: [
        {
          id: "scientist",
          name: "Lab Technician",
          marker: { xPct: 0.62, yPct: 0.44 },
          dialogue: [
            "Diagnostics online. Your UI modules look healthy.",
            "Try swapping the theme colors or adding a quest panel next."
          ]
        }
      ]
    },
    alley: {
      name: "Circuit Alley",
      backgroundVariant: "alley",
      connections: ["plaza"],
      npcs: [
        {
          id: "kid",
          name: "Rookie Runner",
          marker: { xPct: 0.30, yPct: 0.55 },
          dialogue: [
            "Shh... I heard battles will be tested here soon.",
            "For now, use the Battle Test button to see the stub screen."
          ]
        }
      ]
    },
    apartment: {
      name: "Appartment",
      backgroundVariant: "apartment",
      backgroundImage: "assets/bedroom.png",
      connections: ["plaza"],
      // hotspot for apartment-specific interaction (computer)
      // moved to pixel coords ~ (220,500) -> normalized to xPct/yPct
      hotspot: { xPct: 220 / BASE_W, yPct: 500 / BASE_H, r: 30 },
      npcs: []
    }
  }
};

export const state = {
  screen: "adventure",
  locationId: "apartment",
  dialogue: null,
  ui: {
    statusOpen: false,
    moveOpen: false
  }
};

// Canvas and responsive scaling
export let canvas = null;
export let ctx = null;

export let scale = 1;
export let offsetX = 0;
export let offsetY = 0;

export function resize() {
	// No-op if canvas not ready yet
	if (!canvas) return;
  // Prefer visualViewport when available (handles iOS Safari chrome changes)
  const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const s = Math.min(vw / BASE_W, vh / BASE_H);
	scale = s;
	// keep drawing buffer at base resolution, scale via CSS for crisp drawing
	canvas.width = BASE_W;
	canvas.height = BASE_H;
	canvas.style.width = (BASE_W * scale) + "px";
	canvas.style.height = (BASE_H * scale) + "px";
  offsetX = (vw - BASE_W * scale) / 2;
  offsetY = (vh - BASE_H * scale) / 2;
}
window.addEventListener("resize", resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// initialize canvas when DOM is ready (handles script running in head)
function initCanvas() {
	canvas = document.getElementById("game");
	if (!canvas) return;
	ctx = canvas.getContext("2d");
	// ensure base drawing buffer size
	canvas.width = BASE_W;
	canvas.height = BASE_H;
	// initial resize/pass to compute scale/offset
	resize();
}
// try immediately (if script placed after element) and also on DOMContentLoaded
initCanvas();
window.addEventListener("DOMContentLoaded", initCanvas);

export function toLocal(clientX, clientY) {
  const x = (clientX - offsetX) / scale;
  const y = (clientY - offsetY) / scale;
  return { x, y };
}

// Drawing helpers
export function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, w/2, h/2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

export function rectContains(r, px, py) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function wrapText(g, text, x, y, maxW, lineH, maxLines) {
  const words = text.split(/\s+/);
  let line = "";
  let cy = y;
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    const w = g.measureText(test).width;
    if (w <= maxW) {
      line = test;
    } else {
      // draw current line
      g.fillText(line, x, cy);
      lines++;
      cy += lineH;
      if (lines >= maxLines) return;
      // start new line with current word
      line = words[i];
      // if single word is too long, chop it to fit (rare)
      if (g.measureText(line).width > maxW) {
        let chopped = line;
        while (chopped.length > 0 && g.measureText(chopped + "…").width > maxW) {
          chopped = chopped.slice(0, -1);
        }
        g.fillText(chopped + "…", x, cy - lineH); // replace the last drawn line
        lines++;
        if (lines >= maxLines) return;
        line = "";
        cy += lineH;
      }
    }
  }
  if (line && lines < maxLines) {
    // If this is the last allowed line and it overflows, ellipsize
    if (lines === maxLines - 1 && g.measureText(line).width > maxW) {
      let final = line;
      while (final.length > 0 && g.measureText(final + "…").width > maxW) {
        final = final.slice(0, -1);
      }
      g.fillText(final + "…", x, cy);
    } else {
      g.fillText(line, x, cy);
    }
  }
}

// Icons
export const Icons = {
  move(g, x, y, w, h) {
    g.save();
    g.strokeStyle = "rgba(235,242,255,.9)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x + w/2, y);
    g.lineTo(x + w/2, y + h);
    g.moveTo(x, y + h/2);
    g.lineTo(x + w, y + h/2);
    g.stroke();
    g.beginPath();
    g.moveTo(x + w/2, y);
    g.lineTo(x + w/2 - 5, y + 6);
    g.moveTo(x + w/2, y);
    g.lineTo(x + w/2 + 5, y + 6);
    g.moveTo(x + w/2, y + h);
    g.lineTo(x + w/2 - 5, y + h - 6);
    g.moveTo(x + w/2, y + h);
    g.lineTo(x + w/2 + 5, y + h - 6);
    g.stroke();
    g.restore();
  },
  status(g, x, y, w, h) {
    g.save();
    g.strokeStyle = "rgba(235,242,255,.9)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x + w/2, y + h/2, 8, 0, Math.PI*2);
    g.stroke();
    g.beginPath();
    g.moveTo(x + w/2 - 12, y + h - 2);
    g.quadraticCurveTo(x + w/2, y + h - 14, x + w/2 + 12, y + h - 2);
    g.stroke();
    g.restore();
  },
  battle(g, x, y, w, h) {
    g.save();
    g.strokeStyle = "rgba(235,242,255,.9)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x + 4, y + 4);
    g.lineTo(x + w - 4, y + h - 4);
    g.moveTo(x + w - 4, y + 4);
    g.lineTo(x + 4, y + h - 4);
    g.stroke();
    g.restore();
  }
};

export function getLocation() {
  return DATA.locations[state.locationId];
}

// Avatar image (add cache-bust to ensure updated file loads during development)
export const avatarImg = new Image();
avatarImg.src = "assets/playerFull.png?_=" + Date.now();

// Player bust image used for UI icons (status button)
export const playerBustImg = new Image();
playerBustImg.src = "assets/PlayerBust.png?_=" + Date.now();

// Attack animation (GIF)
export const swordAttackImg = new Image();
swordAttackImg.src = "assets/SwordAttack.gif";

// Background images
export const bgImages = {};
function tryLoadBg(variant, candidates, idx = 0) {
  if (!candidates || idx >= candidates.length) {
    bgImages[variant] = null;
    return;
  }
  const img = new Image();
  img.onload = () => { img._loaded = true; bgImages[variant] = img; };
  img.onerror = () => { tryLoadBg(variant, candidates, idx + 1); };
  img.src = candidates[idx];
}

for (const vid of Object.keys(DATA.locations)) {
  const loc = DATA.locations[vid];
  const variant = loc.backgroundVariant || vid;
  if (loc.backgroundImage) {
    const img = new Image();
    img.onload = () => { img._loaded = true; bgImages[variant] = img; };
    img.onerror = () => { bgImages[variant] = null; };
    img.src = loc.backgroundImage;
  } else {
    const candidates = [
      `assets/${variant}.png`,
      `assets/${variant}.jpg`,
      `assets/${variant}.webp`,
      `assets/bg-${variant}.png`,
      `assets/bg-${variant}.jpg`,
      `assets/bg-${variant}.webp`
    ];
    tryLoadBg(variant, candidates, 0);
  }
}

// Also try a specific battleAlley asset name so battles can use a dedicated background
tryLoadBg('battlealley', [
  'assets/battleAlley.webp',
  'assets/battlealley.png',
  'assets/battlealley.jpg',
  'assets/bg-battlealley.webp'
], 0);

// Also allow a generic 'bs1' background (e.g., assets/BS1.png) for enemy battle scenes
tryLoadBg('bs1', [
  'assets/BS1.png',
  'assets/bs1.png',
  'assets/BS1.webp',
  'assets/bs1.webp'
], 0);

// Also allow a 'bs3' background for enemy/top area (e.g., assets/BS3.png)
tryLoadBg('bs3', [
  'assets/BS3.png',
  'assets/bs3.webp',
  'assets/bs3.jpg',
  'assets/BS3.webp'
], 0);

// NPC images
export const npcImages = {};
function tryLoadNpcImage(id, candidates, idx = 0) {
  if (!candidates || idx >= candidates.length) { npcImages[id] = null; return; }
  const img = new Image();
  img.onload = () => { img._loaded = true; npcImages[id] = img; };
  img.onerror = () => { tryLoadNpcImage(id, candidates, idx + 1); };
  img.src = candidates[idx];
}

for (const locId of Object.keys(DATA.locations)) {
  const loc = DATA.locations[locId];
  for (const npc of loc.npcs) {
    if (npc.image) {
      const img = new Image();
      img.onload = () => { img._loaded = true; npcImages[npc.id] = img; };
      img.onerror = () => { npcImages[npc.id] = null; };
      img.src = npc.image;
      continue;
    }
    const candidates = [
      `assets/npc-${npc.id}.png`,
      `assets/npc-${npc.id}.webp`,
      `assets/${npc.id}.png`,
      `assets/${npc.id}.webp`
    ];
    tryLoadNpcImage(npc.id, candidates, 0);
  }
}

// Ensure NPC objects have safe defaults (id and srcFrac) so hit-testing and drawing are reliable
for (const locId of Object.keys(DATA.locations)) {
  const loc = DATA.locations[locId];
  if (!loc || !Array.isArray(loc.npcs)) continue;
  for (const npc of loc.npcs) {
    if (!npc.id) npc.id = (npc.name || 'npc').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (npc.srcFrac == null) npc.srcFrac = 0.5;
  }
}

// Export helpful collections
export default {
  BASE_W, BASE_H, clamp, lerp, DATA, state, canvas, ctx, resize, toLocal,
  roundRect, rectContains, wrapText, Icons, getLocation, avatarImg, bgImages, npcImages
};
