import * as core from './core.js';
import { battleState, enemyTryAttack } from './battle.js';

// DOM overlay wrapper + image used to play large animated GIFs reliably
let _animOverlayWrap = null;
let _animOverlayImg = null;

// Toggle to show/hide the gradient overlays applied on backgrounds
export let SHOW_GRADIENT_OVERLAY = false;
// Toggle to show/hide decorative background elements (grid lines, panels)
export let SHOW_BG_DECORATIONS = false;
// Toggle to show/hide the bottom dark panel behind the player avatar
export let SHOW_BOTTOM_PANEL = false;
// Avatar scale multiplier used inside the status modal avatar pane
export let STATUS_AVATAR_SCALE = 1.3;

// Apartment hotspot debug/store
export let lastApartmentHotspot = null;

export function drawApartmentHotspot(g, hotspot) {
  if (!hotspot) { lastApartmentHotspot = null; return; }
  const x = Math.round(hotspot.xPct * core.BASE_W);
  const y = Math.round(hotspot.yPct * core.BASE_H);
  const r = hotspot.r || 28;
  lastApartmentHotspot = { x, y, r };
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = "rgba(40,90,255,.14)";
  g.fill();
  g.lineWidth = 2; g.strokeStyle = "rgba(140,170,255,.65)"; g.stroke();
  g.fillStyle = "rgba(235,242,255,.95)"; g.font = "700 11px system-ui"; g.textAlign = "center"; g.textBaseline = "top";
  g.fillText("Computer", x, y + r + 8);
  g.restore();
}

// Draw a large centered button on apartment screens for quick access/testing
// (centered test button removed)

export class Button {
  constructor({ id, x, y, w, h, label, iconFn, onClick, kind = "primary" }) {
    this.id = id; this.x = x; this.y = y; this.w = w; this.h = h;
    this.label = label; this.iconFn = iconFn; this.onClick = onClick; this.kind = kind; this.enabled = true;
  }
  contains(px, py) { return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h; }
  draw(g) {
    const r = 12;
    g.save();
    const bg = this.kind === "primary" ? "rgba(40,90,255,.22)" : "rgba(0,0,0,.25)";
    const stroke = this.kind === "primary" ? "rgba(140,170,255,.55)" : "rgba(140,170,255,.25)";
    g.fillStyle = bg; g.strokeStyle = stroke; g.lineWidth = 1; core.roundRect(g, this.x, this.y, this.w, this.h, r); g.fill(); g.stroke();
    if (this.iconFn) {
      // Clip icon drawing to the button rounded rect so larger images can overflow safely
      g.save(); core.roundRect(g, this.x, this.y, this.w, this.h, r); g.clip();
      try { this.iconFn(g, this.x, this.y, this.w, this.h); } catch (e) {}
      g.restore();
    }
    g.fillStyle = "rgba(235,242,255,.92)"; g.font = "600 12px system-ui"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(this.label, this.x + this.w/2, this.y + this.h - 16);
    g.restore();
  }
}

export class Modal {
  constructor({ title, onClose }) { this.title = title; this.onClose = onClose; this.visible = false; }
  open() { this.visible = true; }
  close() { this.visible = false; if (this.onClose) this.onClose(); }
  draw(g, rect, contentDrawFn, backgroundDrawFn) {
    if (!this.visible) return;
    const { x, y, w, h } = rect;
    g.save();
    // modal backdrop
    g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(0, 0, core.BASE_W, core.BASE_H);
    // allow a background element (e.g., avatar) to draw between backdrop and modal frame
    if (backgroundDrawFn) {
      try { backgroundDrawFn(g, rect); } catch (e) {}
    }
    const r = 16;
    g.fillStyle = "rgba(10,18,45,.92)"; g.strokeStyle = "rgba(140,170,255,.35)"; g.lineWidth = 1;
    core.roundRect(g, x, y, w, h, r); g.fill(); g.stroke();
    g.fillStyle = "rgba(235,242,255,.95)"; g.font = "700 16px system-ui"; g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText(this.title, x + 16, y + 22);
    const cb = { x: x + w - 44, y: y + 8, w: 36, h: 28 }; this._closeRect = cb;
    g.fillStyle = "rgba(255,255,255,.08)"; core.roundRect(g, cb.x, cb.y, cb.w, cb.h, 10); g.fill(); g.strokeStyle = "rgba(140,170,255,.25)"; g.stroke();
    g.fillStyle = "rgba(235,242,255,.9)"; g.font = "800 14px system-ui"; g.textAlign = "center"; g.fillText("✕", cb.x + cb.w/2, cb.y + cb.h/2 + 1);
    if (contentDrawFn) contentDrawFn(g, { x: x + 16, y: y + 46, w: w - 32, h: h - 62 });
    g.restore();
  }
  handlePointer(px, py) { if (!this.visible) return false; if (this._closeRect && core.rectContains(this._closeRect, px, py)) { this.close(); return true;} return true; }
}

export class DialogueBox {
  constructor({ onAdvance, onClose }) { this.onAdvance = onAdvance; this.onClose = onClose; this.visible = false; this.speaker = ""; this.text = ""; this.typed = 0; this.typeSpeed = 55; this._lastTypeTime = null; }
  show(speaker, text) { this.visible = true; this.speaker = speaker; this.text = text; this.typed = 0; this._lastTypeTime = performance.now(); }
  hide() { this.visible = false; }
  draw(g, rect) {
    if (!this.visible) return; const { x, y, w, h } = rect; g.save();
    g.fillStyle = "rgba(10,18,45,.90)"; g.strokeStyle = "rgba(140,170,255,.45)"; g.lineWidth = 1; core.roundRect(g, x, y, w, h, 14); g.fill(); g.stroke();
    g.fillStyle = "rgba(40,90,255,.22)"; g.strokeStyle = "rgba(140,170,255,.55)"; core.roundRect(g, x + 12, y + 10, Math.min(200, w - 70), 26, 12); g.fill(); g.stroke();
    g.fillStyle = "rgba(235,242,255,.95)"; g.font = "700 12px system-ui"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(this.speaker, x + 22, y + 23);
    const cb = { x: x + w - 44, y: y + 10, w: 34, h: 26 }; this._closeRect = cb; g.fillStyle = "rgba(255,255,255,.08)"; core.roundRect(g, cb.x, cb.y, cb.w, cb.h, 10); g.fill(); g.strokeStyle = "rgba(140,170,255,.25)"; g.stroke(); g.fillStyle = "rgba(235,242,255,.9)"; g.font = "800 13px system-ui"; g.textAlign = "center"; g.fillText("✕", cb.x + cb.w/2, cb.y + cb.h/2 + 1);
    g.fillStyle = "rgba(235,242,255,.92)"; g.font = "500 13px system-ui"; g.textAlign = "left"; g.textBaseline = "top";
    const now = performance.now(); if (this._lastTypeTime == null) this._lastTypeTime = now; const dt = (now - this._lastTypeTime) / 1000; const add = Math.floor(dt * this.typeSpeed); if (add > 0) { this.typed = Math.min(this.text.length, this.typed + add); this._lastTypeTime = now; }
    const display = this.text.slice(0, this.typed || 0); core.wrapText(g, display, x + 16, y + 44, w - 32, 18, 5);
    g.fillStyle = "rgba(235,242,255,.75)"; g.font = "800 14px system-ui"; g.textAlign = "right"; g.textBaseline = "bottom"; g.fillText("tap ▸", x + w - 14, y + h - 10);
    g.restore();
  }
  handlePointer(px, py, rect) {
    if (!this.visible) return false; const { x, y, w, h } = rect; if (core.rectContains({ x, y, w, h }, px, py)) {
      if (this._closeRect && core.rectContains(this._closeRect, px, py)) { this.onClose?.(); }
      else { if ((this.typed || 0) < this.text.length) { this.typed = this.text.length; } else { this.onAdvance?.(); } }
      return true;
    }
    return false;
  }
}

// Layout helpers
export function getPortraitRect() {
  const w = Math.round(360 * 0.8); const h = Math.round(520 * 0.8); const x = core.BASE_W - Math.round(w * 0.5) - 190; const y = core.BASE_H - h - 8; return { x, y, w, h };
}
export function getDialogueRect() { return { x: 14, y: core.BASE_H - 96 - 148, w: core.BASE_W - 28, h: 132 }; }
export function getMoveSheetRect() { return { x: 14, y: 64 + 12, w: core.BASE_W - 28, h: 260 }; }
export function getStatusRect() { return { x: 18, y: 110, w: core.BASE_W - 36, h: core.BASE_H - 220 }; }

// Drawing functions
export function drawBackground(g, variant) {
  g.save();
  const bg = core.bgImages[variant];
  if (bg && bg._loaded) {
    const iw = bg.width; const ih = bg.height;
    let scale = Math.max(core.BASE_W / iw, core.BASE_H / ih);
    // Slightly increase scale for the apartment background so it fills the viewport
    // without over-scaling the image (small boost only).
    if (variant === 'apartment') scale *= 0.80; //bg resize
    const dw = iw * scale; const dh = ih * scale; const dx = (core.BASE_W - dw) / 2; const dy = (core.BASE_H - dh) / 2; g.drawImage(bg, dx, dy, dw, dh);
  }
  const grd = g.createLinearGradient(0, 0, 0, core.BASE_H);
  const overlayAlpha = (bg && bg._loaded) ? 0.45 : 1.0;
  if (SHOW_GRADIENT_OVERLAY) {
    if (variant === "plaza") { grd.addColorStop(0, `rgba(10,26,68,${overlayAlpha})`); grd.addColorStop(1, `rgba(11,16,32,${overlayAlpha})`); }
    else if (variant === "lab") { grd.addColorStop(0, `rgba(10,42,42,${overlayAlpha})`); grd.addColorStop(1, `rgba(11,16,32,${overlayAlpha})`); }
    else { grd.addColorStop(0, `rgba(34,17,58,${overlayAlpha})`); grd.addColorStop(1, `rgba(11,16,32,${overlayAlpha})`); }
    g.fillStyle = grd; g.fillRect(0, 0, core.BASE_W, core.BASE_H);
  }
  if (SHOW_BG_DECORATIONS) {
    g.globalAlpha = 0.25; g.strokeStyle = "rgba(140,170,255,.35)"; g.lineWidth = 1; for (let i = 0; i < 12; i++) { const y = 90 + i * 46; g.beginPath(); g.moveTo(20, y); g.lineTo(core.BASE_W - 20, y - 18); g.stroke(); }
    g.globalAlpha = 0.85;
    if (variant === "plaza") {
      g.fillStyle = "rgba(60,180,255,.22)"; core.roundRect(g, core.BASE_W - 180, 210, 160, 160, 16); g.fill(); g.strokeStyle = "rgba(140,170,255,.40)"; g.stroke(); g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(46, 210, 72, 200); g.strokeRect(46, 210, 72, 200);
    } else if (variant === "lab") {
      g.fillStyle = "rgba(60,255,220,.16)"; core.roundRect(g, 30, 190, core.BASE_W - 60, 190, 18); g.fill(); g.strokeStyle = "rgba(160,255,235,.30)"; g.stroke(); g.fillStyle = "rgba(255,255,255,.07)"; core.roundRect(g, 70, 230, core.BASE_W - 140, 110, 14); g.fill();
    } else {
      g.fillStyle = "rgba(255,120,255,.16)"; core.roundRect(g, 36, 210, core.BASE_W - 72, 210, 18); g.fill(); g.strokeStyle = "rgba(255,180,255,.22)"; g.stroke(); g.globalAlpha = 0.6; g.strokeStyle = "rgba(255,180,255,.35)"; g.lineWidth = 6; g.beginPath(); g.moveTo(50, 180); g.lineTo(50, 360); g.stroke(); g.lineWidth = 2; g.globalAlpha = 0.85;
    }
  }
  if (SHOW_BOTTOM_PANEL) {
    g.globalAlpha = 1; g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(0, core.BASE_H - 250, core.BASE_W, 250);
    g.fillStyle = "rgba(10,18,45,.75)"; core.roundRect(g, 0, core.BASE_H - 240, core.BASE_W, 170, 18); g.fill(); g.strokeStyle = "rgba(140,170,255,.30)"; g.stroke();
  }
  g.restore();
}

export function drawNpcMarkers(g, location) {
  g.save();
  for (const npc of location.npcs) {
    const x = npc.marker.xPct * core.BASE_W; const y = npc.marker.yPct * core.BASE_H;
    const img = core.npcImages[npc.id];
    if (img && img._loaded) {
      const radius = 34; const size = radius * 2; g.save(); g.beginPath(); g.arc(x, y, radius, 0, Math.PI * 2); g.closePath(); g.clip(); const iw = img.width, ih = img.height; const srcFrac = npc.srcFrac || 1.0; const srcH = Math.max(1, Math.round(ih * srcFrac)); const scale = Math.max(size / iw, size / srcH); const dw = Math.round(iw * scale), dh = Math.round(srcH * scale); const dx = Math.round(x - dw / 2), dy = Math.round(y - dh / 2); g.drawImage(img, 0, 0, iw, srcH, dx, dy, dw, dh); g.restore(); g.beginPath(); g.arc(x, y, radius + 4, 0, Math.PI * 2); g.fillStyle = "rgba(40,90,255,.12)"; g.fill(); g.strokeStyle = "rgba(140,170,255,.65)"; g.lineWidth = 2; g.stroke();
    } else {
      g.fillStyle = "rgba(40,90,255,.20)"; g.strokeStyle = "rgba(140,170,255,.65)"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 22, 0, Math.PI*2); g.fill(); g.stroke(); g.fillStyle = "rgba(235,242,255,.92)"; g.beginPath(); g.arc(x, y, 4, 0, Math.PI*2); g.fill();
    }
    core.roundRect(g, x - 52, y + 26, 104, 22, 10); g.fillStyle = "rgba(0,0,0,.35)"; g.fill(); g.strokeStyle = "rgba(140,170,255,.25)"; g.stroke(); g.fillStyle = "rgba(235,242,255,.9)"; g.font = "700 11px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(npc.name, x, y + 37);
  }
  g.restore();
}

export function npcHitTest(px, py, location) {
  for (const npc of location.npcs) {
    const x = npc.marker.xPct * core.BASE_W; const y = npc.marker.yPct * core.BASE_H; const dx = px - x; const dy = py - y; if (dx*dx + dy*dy <= 26*26) return npc;
  }
  return null;
}

export function drawTopBar(g, getLocation, DATA) {
  g.save();
  g.fillStyle = "rgba(10,18,45,.90)"; g.fillRect(0, 0, core.BASE_W, 64);
  g.strokeStyle = "rgba(140,170,255,.25)"; g.beginPath(); g.moveTo(0, 64); g.lineTo(core.BASE_W, 64); g.stroke();

  // Location title
  g.fillStyle = "rgba(235,242,255,.95)"; g.font = "800 14px system-ui"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(getLocation().name, 14, 18);

  // Player basic stats (left side)
  const p = DATA.player;
  drawStatPill(g, 14, 30, 150, 24, "HP", p.hp.cur, p.hp.max, "rgba(255,90,120,.85)");
  drawStatPill(g, 172, 30, 120, 24, "EN", p.en.cur, p.en.max, "rgba(60,200,255,.85)");

  // Coins/gems placed at the far right of the top bar
  g.textAlign = "right"; g.font = "700 12px system-ui"; g.fillStyle = "rgba(235,242,255,.92)";
  g.fillText("🪙 " + p.coins, core.BASE_W - 14, 20);
  g.fillText("💎 " + p.gems, core.BASE_W - 14, 42);

  g.restore();
}

export function drawStatPill(g, x, y, w, h, label, cur, max, accent) {
  g.save(); g.fillStyle = "rgba(255,255,255,.08)"; g.strokeStyle = "rgba(140,170,255,.22)"; core.roundRect(g, x, y, w, h, 12); g.fill(); g.stroke(); const pad = 3; const innerW = w - pad*2; const pct = core.clamp(cur / max, 0, 1); g.fillStyle = "rgba(255,255,255,.06)"; core.roundRect(g, x + pad, y + pad, innerW, h - pad*2, 10); g.fill(); g.fillStyle = accent; core.roundRect(g, x + pad, y + pad, innerW * pct, h - pad*2, 10); g.fill(); g.fillStyle = "rgba(235,242,255,.92)"; g.font = "700 11px system-ui"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(label + " " + cur + "/" + max, x + 10, y + h/2); g.restore();
}

export function drawBottomBar(g, bottomButtons) {
  g.save(); g.fillStyle = "rgba(10,18,45,.92)"; core.roundRect(g, 0, core.BASE_H - 96, core.BASE_W, 96, 18); g.fill(); g.strokeStyle = "rgba(140,170,255,.25)"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, core.BASE_H - 96); g.lineTo(core.BASE_W, core.BASE_H - 96); g.stroke(); for (const b of bottomButtons) b.draw(g); g.restore();
}

export function drawPortrait(g, DATA) {
  const r = getPortraitRect(); g.save(); g.fillStyle = "rgba(0,0,0,0)"; g.strokeStyle = "rgba(0,0,0,0)"; core.roundRect(g, r.x, r.y, r.w, r.h, 18);
  if (core.avatarImg.complete && core.avatarImg.naturalWidth > 0) {
    const padding = 6; const nw = core.avatarImg.naturalWidth; const nh = core.avatarImg.naturalHeight; const srcFrac = 0.62; const srcH = Math.max(1, Math.round(nh * srcFrac)); const scale = Math.min((r.w - padding*2) / nw, (r.h - padding*2) / srcH); const drawW = Math.round(nw * scale); const drawH = Math.round(srcH * scale); const imgX = r.x + r.w - drawW - padding; const imgY = r.y + r.h - drawH - padding; g.save(); g.globalAlpha = 0.90; g.drawImage(core.avatarImg, 0, 0, nw, srcH, imgX, imgY, drawW, drawH); g.restore();
  } else {
    const cx = r.x + r.w/2; const cy = r.y + r.h/2 - 6; g.fillStyle = "rgba(235,242,255,.10)"; g.beginPath(); g.arc(cx, cy - 12, 20, 0, Math.PI*2); g.fill(); g.beginPath(); g.arc(cx, cy + 20, 34, Math.PI, Math.PI*2); g.fill();
  }
  g.fillStyle = "rgba(235,242,255,.92)"; g.font = "700 12px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(DATA.player.name + "  Lv." + DATA.player.level, r.x + r.w/2, r.y + r.h - 14);
  g.restore();
}

export function drawMoveSheet(g, state, moveItemRectsRef) {
  if (!state.ui.moveOpen) return;
  const r = getMoveSheetRect(); g.save(); g.fillStyle = "rgba(10,18,45,.92)"; g.strokeStyle = "rgba(140,170,255,.35)"; core.roundRect(g, r.x, r.y, r.w, r.h, 16); g.fill(); g.stroke(); g.fillStyle = "rgba(235,242,255,.95)"; g.font = "800 14px system-ui"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText("Movement", r.x + 14, r.y + 22);
  const cb = { x: r.x + r.w - 62, y: r.y + 10, w: 48, h: 26 }; moveItemRectsRef.moveCloseRect = cb; g.fillStyle = "rgba(255,255,255,.08)"; core.roundRect(g, cb.x, cb.y, cb.w, cb.h, 10); g.fill(); g.strokeStyle = "rgba(140,170,255,.25)"; g.stroke(); g.fillStyle = "rgba(235,242,255,.9)"; g.font = "800 12px system-ui"; g.textAlign = "center"; g.fillText("Close", cb.x + cb.w/2, cb.y + cb.h/2);
  const loc = core.getLocation(); const items = loc.connections.map(id => ({ id, name: core.DATA.locations[id].name })); const listX = r.x + 12; const listY = r.y + 46; const itemH = 52; moveItemRectsRef.moveItemRects = [];
  for (let i = 0; i < items.length; i++) { const iy = listY + i * (itemH + 10); const itemR = { x: listX, y: iy, w: r.w - 24, h: itemH, id: items[i].id }; moveItemRectsRef.moveItemRects.push(itemR); g.fillStyle = "rgba(255,255,255,.06)"; g.strokeStyle = "rgba(140,170,255,.22)"; core.roundRect(g, itemR.x, itemR.y, itemR.w, itemR.h, 14); g.fill(); g.stroke(); g.fillStyle = "rgba(235,242,255,.95)"; g.font = "700 13px system-ui"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(items[i].name, itemR.x + 14, itemR.y + itemH/2); g.textAlign = "right"; g.fillStyle = "rgba(235,242,255,.65)"; g.font = "800 14px system-ui"; g.fillText("›", itemR.x + itemR.w - 14, itemR.y + itemH/2); }
  g.restore();
}

export function drawStatusContent(g, area, DATA) {
  const p = DATA.player;
  // Top status area
  const pad = 14;
  const topH = Math.min(140, Math.round(area.h * 0.28));
  g.fillStyle = "rgba(255,255,255,.06)"; g.strokeStyle = "rgba(140,170,255,.22)"; core.roundRect(g, area.x, area.y, area.w, topH, 12); g.fill(); g.stroke();
  const startX = area.x + pad; const ty = area.y + 12;
  g.fillStyle = "rgba(235,242,255,.95)"; g.font = "800 14px system-ui"; g.textAlign = "left"; g.textBaseline = "top"; g.fillText(p.name + "  (Lv. " + p.level + ")", startX, ty);
  g.font = "600 13px system-ui"; g.fillStyle = "rgba(235,242,255,.85)";
  g.fillText("HP: " + p.hp.cur + "/" + p.hp.max, startX, ty + 28);
  g.fillText("EN: " + p.en.cur + "/" + p.en.max, startX, ty + 50);
  g.fillText("Coins: " + p.coins, startX, ty + 72);
  g.fillText("Gems: " + p.gems, startX, ty + 94);

  // Bottom area: split into left inventory and right avatar pane
  const bottomY = area.y + topH + pad;
  const bottomH = area.h - topH - pad * 2;
  const innerPad = 12;
  // give the avatar pane more room (approx 58% right, 42% left)
  const leftW = Math.round((area.w - innerPad * 3) * 0.42);
  const rightW = area.w - leftW - innerPad * 3;
  const leftX = area.x + innerPad;
  const rightX = leftX + leftW + innerPad;

  // Left: inventory box
  g.fillStyle = "rgba(255,255,255,.04)"; g.strokeStyle = "rgba(140,170,255,.18)"; core.roundRect(g, leftX, bottomY, leftW, bottomH, 12); g.fill(); g.stroke();
  g.fillStyle = "rgba(235,242,255,.95)"; g.font = "800 14px system-ui"; g.textAlign = "left"; g.textBaseline = "top"; g.fillText("Inventory", leftX + 12, bottomY + 12);
  g.fillStyle = "rgba(235,242,255,.85)"; g.font = "500 13px system-ui";
  let y = bottomY + 44;
  for (const item of p.inventory) { g.fillText("• " + item, leftX + 16, y); y += 22; }
  if (!p.inventory.length) { g.fillText("(empty)", leftX + 16, y); }

  // Right: avatar pane
  g.fillStyle = "rgba(255,255,255,.02)"; g.strokeStyle = "rgba(140,170,255,.14)"; core.roundRect(g, rightX, bottomY, rightW, bottomH, 12); g.fill(); g.stroke();
  // draw avatar centered in right pane
  const avPad = 6; const avW = rightW - avPad * 2; const avH = bottomH - avPad * 2; const avX = rightX + avPad; const avY = bottomY + avPad;
  if (core.avatarImg && core.avatarImg.complete && core.avatarImg.naturalWidth > 0) {
    const img = core.avatarImg; const iw = img.naturalWidth; const ih = img.naturalHeight;
    // use uniform scale for both axes, allow overflow and clip to pane
    const base = Math.min(avW / iw, avH / ih);
    const scale = base * STATUS_AVATAR_SCALE;
    const dw = Math.round(iw * scale); const dh = Math.round(ih * scale);
    const dx = avX + Math.round((avW - dw) / 2); const dy = avY + Math.round((avH - dh) / 2);
    g.save(); core.roundRect(g, avX, avY, avW, avH, 10); g.clip();
    g.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh);
    g.restore();
  } else {
    // placeholder silhouette
    const cx = avX + avW / 2; const cy = avY + avH / 2;
    g.fillStyle = "rgba(235,242,255,.06)"; g.beginPath(); g.arc(cx, cy - 24, 24, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(cx, cy + 24, 44, Math.PI, Math.PI * 2); g.fill();
  }
}

export function drawStatusBackground(g, area, DATA) {
  // Draw the avatar as a subtle background element behind the status modal content.
  try {
    const pad = 18; const maxW = Math.round(area.w * 0.7); const maxH = Math.round(area.h - pad * 2);
    if (core.avatarImg && core.avatarImg.complete && core.avatarImg.naturalWidth > 0) {
      const img = core.avatarImg; const iw = img.naturalWidth; const ih = img.naturalHeight;
      const scale = Math.min(maxW / iw, maxH / ih);
      const dw = Math.round(iw * scale); const dh = Math.round(ih * scale);
      const dx = Math.round(area.x + (area.w - dw) / 2);
      const dy = Math.round(area.y + (area.h - dh) / 2);
      g.save(); g.globalAlpha = 0.18; g.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh); g.restore();
    } else {
      // placeholder silhouette so you can verify background placement while image loads
      const cx = Math.round(area.x + area.w / 2);
      const cy = Math.round(area.y + area.h / 2);
      const r = Math.round(Math.min(area.w, area.h) * 0.28);
      g.save(); g.globalAlpha = 0.08; g.fillStyle = "rgba(235,242,255,.95)"; g.beginPath(); g.arc(cx, cy - Math.round(r * 0.28), Math.round(r * 0.33), 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(cx, cy + Math.round(r * 0.22), Math.round(r * 0.6), Math.PI, Math.PI * 2); g.fill(); g.restore();
    }
  } catch (e) {}
}

// Battle drawing uses battleState; it also triggers enemy auto-attack
export function drawBattleScreen(g, battleState, avatarImg, playerAttack, endBattle, pushBattleLog) {
  g.save();
  // Split battle screen into top (enemy) and bottom (player) halves.
  const topRatio = 0.52; // give the enemy slightly more vertical space
  const halfH = Math.round(core.BASE_H * topRatio);
  const topArea = { x: 0, y: 0, w: core.BASE_W, h: halfH };
  const bottomArea = { x: 0, y: halfH, w: core.BASE_W, h: core.BASE_H - halfH };

  // choose backgrounds: prefer `battleState.bs1` for top (enemy), then fall back
  const topPref = [];
  if (battleState && battleState.bs1) topPref.push(battleState.bs1);
  topPref.push('bs1', 'battlealley', 'alley');
  let topBg = null;
  for (const v of topPref) { if (core.bgImages[v] && core.bgImages[v]._loaded) { topBg = core.bgImages[v]; break; } }

  // choose bottom background from current location variant, else plaza
  const loc = core.getLocation();
  const bottomVariant = (battleState && battleState.bs2) ? battleState.bs2 : ((loc && loc.backgroundVariant) ? loc.backgroundVariant : (core.state && core.state.locationId) ? core.state.locationId : 'plaza');
  const bottomBg = (core.bgImages[bottomVariant] && core.bgImages[bottomVariant]._loaded) ? core.bgImages[bottomVariant] : null;

  function drawAreaBg(area, img, overlayAlpha) {
    // If this is the player/bottom area, draw a simple dark panel (no background image)
    if (area === bottomArea) {
      g.fillStyle = "rgba(6,10,18,0.86)";
      g.fillRect(area.x, area.y, area.w, area.h);
      return;
    }
    if (img) {
      const iw = img.width; const ih = img.height; const scale = Math.max(area.w / iw, area.h / ih); const dw = Math.round(iw * scale); const dh = Math.round(ih * scale); const dx = Math.round((area.w - dw) / 2); const dy = Math.round(area.y + (area.h - dh) / 2 + (area === topArea ? -Math.round(area.h * 0.20) : 0)); g.drawImage(img, dx, dy, dw, dh);
      if (SHOW_GRADIENT_OVERLAY && overlayAlpha) { const grd2 = g.createLinearGradient(0, area.y, 0, area.y + area.h); grd2.addColorStop(0, `rgba(10,18,45,${overlayAlpha})`); grd2.addColorStop(1, `rgba(11,16,32,${overlayAlpha})`); g.fillStyle = grd2; g.fillRect(area.x, area.y, area.w, area.h); }
      return;
    }
    // fallback gradient for area
    const grd = g.createLinearGradient(0, area.y, 0, area.y + area.h); grd.addColorStop(0, "#18081a"); grd.addColorStop(1, "#051022"); g.fillStyle = grd; g.fillRect(area.x, area.y, area.w, area.h);
  }

  drawAreaBg(topArea, topBg, 0.36);
  drawAreaBg(bottomArea, bottomBg, 0.18);
  const now = performance.now(); const bs = battleState;
  if (bs.enemy) {
    const ex = Math.round(core.BASE_W / 2);
    const ey = Math.round(topArea.y + topArea.h / 2);
    if (bs.enemy.image) {
      const img = new Image(); img.src = bs.enemy.image;
      if (img.complete) {
        const iw = img.width, ih = img.height;
        const maxEnemySize = Math.min(300, topArea.h - 80); // constrain to top half (use extra room)
        const scale = Math.min(maxEnemySize / iw, maxEnemySize / ih);
        const dw = Math.round(iw * scale), dh = Math.round(ih * scale);
        g.drawImage(img, ex - dw/2, ey - dh/2, dw, dh);
      } else {
        const ph = Math.min(180, topArea.h - 40);
        g.fillStyle = "rgba(255,255,255,.06)"; core.roundRect(g, ex - ph/2, ey - ph/2, ph, ph, 12); g.fill();
      }
    } else {
      const ph = Math.min(180, topArea.h - 40);
      g.fillStyle = "rgba(255,255,255,.06)"; core.roundRect(g, ex - ph/2, ey - ph/2, ph, ph, 12); g.fill();
    }
    const barW = Math.min(300, core.BASE_W - 40); const barX = ex - barW/2; const barY = topArea.y + topArea.h - 36; g.fillStyle = "rgba(255,255,255,.06)"; core.roundRect(g, barX, barY, barW, 16, 8); g.fill(); const pct = bs.enemy.hp / bs.enemy.maxHp; g.fillStyle = "rgba(255,110,110,.95)"; core.roundRect(g, barX + 2, barY + 2, (barW - 4) * pct, 12, 6); g.fill(); g.fillStyle = "rgba(235,242,255,.95)"; g.font = "700 12px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(bs.enemy.name + "  " + Math.max(0, bs.enemy.hp) + "/" + bs.enemy.maxHp, ex, barY + 8);
  }
  if (bs.phase === "intro") { g.fillStyle = "rgba(235,242,255,.95)"; g.font = "700 18px system-ui"; g.textAlign = "center"; g.fillText("An " + (bs.enemy?.name || "Enemy") + " appeared", core.BASE_W/2, core.BASE_H/2 - 40); if (now - bs.phaseStart > 900) { bs.phase = "choice"; bs.phaseStart = now; } }
  if (bs.phase === "choice") {
    const cw = 130, ch = 46; const left = { x: core.BASE_W/2 - cw - 12, y: core.BASE_H/2 + 10, w: cw, h: ch }; const right = { x: core.BASE_W/2 + 12, y: core.BASE_H/2 + 10, w: cw, h: ch }; bs.buttons.choiceFight = left; bs.buttons.choiceFlee = right; g.fillStyle = "rgba(40,90,255,.22)"; core.roundRect(g, left.x, left.y, left.w, left.h, 12); g.fill(); g.strokeStyle = "rgba(140,170,255,.45)"; g.stroke(); g.fillStyle = "rgba(235,242,255,.95)"; g.font = "700 14px system-ui"; g.textAlign = "center"; g.fillText("Fight", left.x + left.w/2, left.y + left.h/2); g.fillStyle = "rgba(255,255,255,.08)"; core.roundRect(g, right.x, right.y, right.w, right.h, 12); g.fill(); g.strokeStyle = "rgba(140,170,255,.25)"; g.stroke(); g.fillStyle = "rgba(235,242,255,.95)"; g.fillText("Flee", right.x + right.w/2, right.y + right.h/2);
  }
  if (bs.phase === "active") {
    // Draw player avatar using same placement/size as other screens (portrait area)
    const r = getPortraitRect();
    if (avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0) {
      const padding = 6; const nw = avatarImg.naturalWidth; const nh = avatarImg.naturalHeight; const srcFrac = 0.62; const srcH = Math.max(1, Math.round(nh * srcFrac)); const scale = Math.min((r.w - padding*2) / nw, (r.h - padding*2) / srcH); const drawW = Math.round(nw * scale); const drawH = Math.round(srcH * scale); const imgX = r.x + r.w - drawW - padding; const imgY = r.y + r.h - drawH - padding; g.save(); g.globalAlpha = 0.90; g.drawImage(avatarImg, 0, 0, nw, srcH, imgX, imgY, drawW, drawH); g.restore();
    } else {
      const cx = r.x + r.w/2; const cy = r.y + r.h/2 - 6; g.fillStyle = "rgba(235,242,255,.10)"; g.beginPath(); g.arc(cx, cy - 12, 20, 0, Math.PI*2); g.fill(); g.beginPath(); g.arc(cx, cy + 20, 34, Math.PI, Math.PI*2); g.fill();
    }
    const bw = 100, bh = 42; const leftTop = { x: 28, y: core.BASE_H - 200, w: bw, h: bh }; const leftBot = { x: 28, y: core.BASE_H - 140, w: bw, h: bh }; const rightTop = { x: core.BASE_W - 28 - bw, y: core.BASE_H - 200, w: bw, h: bh }; const rightBot = { x: core.BASE_W - 28 - bw, y: core.BASE_H - 140, w: bw, h: bh }; bs.buttons.leftSword = leftTop; bs.buttons.leftGun = leftBot; bs.buttons.rightMix = rightTop; bs.buttons.rightItem = rightBot;
    const drawAction = (r, label, primary=false) => { g.fillStyle = primary ? "rgba(40,90,255,.24)" : "rgba(255,255,255,.06)"; core.roundRect(g, r.x, r.y, r.w, r.h, 12); g.fill(); g.strokeStyle = primary ? "rgba(140,170,255,.55)" : "rgba(140,170,255,.25)"; g.stroke(); g.fillStyle = "rgba(235,242,255,.95)"; g.font = "700 13px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label, r.x + r.w/2, r.y + r.h/2); };
    drawAction(leftTop, "Sword Mode", true); drawAction(leftBot, "Gun Mode", false); drawAction(rightTop, "Mix", false); drawAction(rightBot, "Item", false);
    enemyTryAttack(now);
  }

  // Draw battle animation overlays (e.g., sword GIF)
  if (bs.anim) {
    const a = bs.anim;
    if (a.type === 'sword') {
      // Use a fixed-position wrapper with an inner <img> so the GIF animates reliably and is centered
      try {
        if (!document.body) throw 0;
        if (!_animOverlayWrap) {
          _animOverlayWrap = document.createElement('div');
          _animOverlayWrap.style.position = 'fixed';
          _animOverlayWrap.style.pointerEvents = 'none';
          _animOverlayWrap.style.zIndex = 999999;
          _animOverlayWrap.style.display = 'flex';
          _animOverlayWrap.style.alignItems = 'center';
          _animOverlayWrap.style.justifyContent = 'center';
          _animOverlayWrap.style.background = 'rgba(0,0,0,0.6)';
          document.body.appendChild(_animOverlayWrap);
          try { console.log('[QTE] created overlay wrapper'); } catch (e) {}
        }
        // create a fresh media element for each animation start so it reliably restarts
        if (!_animOverlayWrap._animStart || _animOverlayWrap._animStart !== a.start) {
          // remove old media if any
          try { if (_animOverlayImg) { _animOverlayImg.remove(); _animOverlayImg = null; } } catch (e) {}
          // try a video source first (mp4/webm). Video allows changing playbackRate.
          const tryVideoSources = ['assets/SwordAttack.mp4', 'assets/SwordAttack.webm'];
          let videoLoaded = false;
          const desiredRate = 2.0; // speed-up factor (adjustable)
          function tryNextVideo(i) {
            if (i >= tryVideoSources.length) {
              // fallback to GIF image
              try { console.log('[QTE] falling back to GIF overlay'); } catch(e){}
              _animOverlayImg = document.createElement('img');
              const src2 = core.swordAttackImg.src || 'assets/SwordAttack.gif';
              _animOverlayImg.style.display = 'none';
              _animOverlayImg.style.maxWidth = '100%';
              _animOverlayImg.style.maxHeight = '100%';
              _animOverlayImg.style.width = '100%';
              _animOverlayImg.style.height = '100%';
              _animOverlayImg.style.objectFit = 'contain';
              _animOverlayImg.style.imageRendering = 'auto';
              _animOverlayImg.onload = () => { try { _animOverlayImg.style.display = 'block'; console.log('[QTE] GIF shown'); } catch(e){} };
              _animOverlayImg.onerror = (err) => { try { console.error('[QTE] GIF failed to load', err, src2); } catch(e){} };
              _animOverlayImg.src = src2 + '?_=' + Date.now();
              _animOverlayWrap.appendChild(_animOverlayImg);
              _animOverlayWrap._animStart = a.start;
              // set a sensible fallback duration (shorter because user wanted it faster)
              battleState.anim.duration = 7000;
              // schedule cleanup for GIF fallback
              setTimeout(() => {
                try { battleState.anim = null; if (battleState.enemy && battleState.enemy.hp > 0) battleState.phase = 'active'; } catch(e){}
                try { if (_animOverlayImg) { _animOverlayImg.remove(); _animOverlayImg = null; } if (_animOverlayWrap) { _animOverlayWrap.remove(); _animOverlayWrap = null; } } catch(e){}
              }, battleState.anim.duration + 80);
              return;
            }
            const src = tryVideoSources[i] + '?_=' + Date.now();
            const v = document.createElement('video');
            v.style.width = '100%'; v.style.height = '100%'; v.style.objectFit = 'contain';
            v.muted = true; v.playsInline = true; v.autoplay = true; v.controls = false; v.loop = false;
            v.preload = 'auto';
            v.src = src;
            v.oncanplay = () => {
              videoLoaded = true;
              try { console.log('[QTE] video canplay', src); } catch(e){}
              v.playbackRate = desiredRate;
              v.play().catch(()=>{});
              _animOverlayImg = v;
              _animOverlayWrap.appendChild(_animOverlayImg);
              _animOverlayWrap._animStart = a.start;
              // let battleState know approximate duration (ms)
              const dur = (v.duration && !isNaN(v.duration)) ? Math.round((v.duration / desiredRate) * 1000) : 4000;
              battleState.anim.duration = dur;
              try { console.log('[QTE] set anim.duration from video', dur); } catch(e){}
              v.onended = () => {
                try { console.log('[QTE] video ended'); } catch(e){}
                // clear animation state
                try { battleState.anim = null; if (battleState.enemy && battleState.enemy.hp > 0) battleState.phase = 'active'; } catch(e){}
                // remove overlay
                try { _animOverlayImg.remove(); _animOverlayImg = null; if (_animOverlayWrap) { _animOverlayWrap.remove(); _animOverlayWrap = null; } } catch(e){}
              };
            };
            v.onerror = () => { try { console.warn('[QTE] video failed to load, trying next', src); } catch(e){}; tryNextVideo(i+1); };
            // try to load
            v.load();
          }
          tryNextVideo(0);
        }
        // make overlay cover the full viewport so attack animation is immersive
        _animOverlayWrap.style.left = '0';
        _animOverlayWrap.style.top = '0';
        _animOverlayWrap.style.width = '100vw';
        _animOverlayWrap.style.height = '100vh';
        _animOverlayWrap.style.display = 'flex';
      } catch (e) {
        // fallback: draw static frame on canvas
        const img = core.swordAttackImg;
        if (img && img.complete && img.naturalWidth > 0) {
          const maxW = Math.round(core.BASE_W * 0.92);
          const maxH = Math.round(core.BASE_H * 0.78);
          const iw = img.naturalWidth, ih = img.naturalHeight;
          const scale = Math.min(maxW / iw, maxH / ih);
          const dw = Math.round(iw * scale), dh = Math.round(ih * scale);
          const drawX = Math.round((core.BASE_W - dw) / 2);
          const drawY = Math.round((core.BASE_H - dh) / 2) - 20;
          g.save(); g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(0, 0, core.BASE_W, core.BASE_H); g.drawImage(img, drawX, drawY, dw, dh); g.restore();
        }
      }
    }
  } else {
    // ensure overlay removed when animation ends
    if (_animOverlayImg) { try { _animOverlayImg.remove(); } catch (e) {} _animOverlayImg = null; }
    if (_animOverlayWrap) { try { _animOverlayWrap.remove(); } catch (e) {} _animOverlayWrap = null; }
  }

  // QTE overlay for sword mode
  if (bs.phase === "qte" && bs.qte) {
    const q = bs.qte;
    // make meter centered and vertically closer to center so it's clearly visible
    const meterW = Math.min(360, core.BASE_W - 120);
    const meterH = 28;
    const meterX = (core.BASE_W - meterW) / 2;
    const meterY = Math.round(core.BASE_H / 2) + 36;
    // compute pointer position (0..1) using same triangle/ping-pong as battle
    const elapsed = Math.max(0, now - q.start);
    const phase = (elapsed % q.period) / q.period;
    const pos = Math.abs(phase * 2 - 1);

    g.save();
    // dim background subtly
    g.fillStyle = "rgba(0,0,0,.42)"; g.fillRect(0, 0, core.BASE_W, core.BASE_H);

    // instruction
    g.fillStyle = "rgba(235,242,255,.95)"; g.font = "600 14px system-ui"; g.textAlign = "center";
    g.fillText("Tap EXECUTE when the bar is closest to the center", core.BASE_W / 2, meterY - 36);

    // meter background
    g.fillStyle = "rgba(255,255,255,.06)"; core.roundRect(g, meterX, meterY, meterW, meterH, 10); g.fill();
    g.strokeStyle = "rgba(140,170,255,.20)"; g.lineWidth = 1; g.stroke();

    // target zone (green band)
    const targetW = q.targetWidth * meterW; const targetX = meterX + (meterW - targetW) / 2;
    g.fillStyle = "rgba(90,220,120,.14)"; core.roundRect(g, targetX, meterY, targetW, meterH, 8); g.fill();

    // critical center band (narrow, highlighted)
    const critW = q.criticalWidth * meterW; const critX = meterX + (meterW - critW) / 2;
    g.fillStyle = "rgba(255,200,30,.22)"; core.roundRect(g, critX, meterY, critW, meterH, 8); g.fill();
    // draw subtle center outline
    g.strokeStyle = "rgba(255,200,30,.35)"; g.lineWidth = 1; core.roundRect(g, critX, meterY, critW, meterH, 8); g.stroke();

    // pointer as small glowing circle
    const px = meterX + Math.round(pos * meterW);
    g.beginPath(); g.fillStyle = "rgba(235,242,255,1)"; g.shadowColor = "rgba(60,140,255,.35)"; g.shadowBlur = 14; g.arc(px, meterY + meterH / 2, 8, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;

    // execute button centered below meter with larger hit area
    const exW = Math.min(200, Math.round(meterW * 0.5)); const exH = 64; const exX = meterX + Math.round((meterW - exW) / 2); const exY = meterY + meterH + 50;
    // increase clickable area slightly
    bs.buttons.qteExecute = { x: exX - 8, y: exY - 8, w: exW + 16, h: exH + 16 };

    g.fillStyle = "rgba(40,90,255,.28)"; core.roundRect(g, exX, exY, exW, exH, 12); g.fill();
    g.strokeStyle = "rgba(140,170,255,.60)"; g.lineWidth = 1; g.stroke();
    g.fillStyle = "rgba(235,242,255,.98)"; g.font = "800 14px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("EXECUTE", exX + exW / 2, exY + exH / 2);

    g.restore();
  }
  // Battle log hidden per user request
  if (bs.phase === "ended") { g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(0, 0, core.BASE_W, core.BASE_H); g.fillStyle = "rgba(235,242,255,.95)"; g.font = "800 18px system-ui"; g.textAlign = "center"; g.fillText(bs.logs[0]?.msg || "Battle ended", core.BASE_W/2, core.BASE_H/2); }
  g.restore();
}

export default { Button, Modal, DialogueBox, getPortraitRect, getDialogueRect, getMoveSheetRect, getStatusRect, drawBackground, drawNpcMarkers, drawTopBar, drawBottomBar, drawPortrait, drawMoveSheet, drawStatusContent, drawBattleScreen };
