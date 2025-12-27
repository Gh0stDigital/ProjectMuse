import * as core from './core.js';
import * as ui from './ui.js';
import * as battle from './battle.js';

// UI instances
export const statusModal = new ui.Modal({ title: "Player Status", onClose: () => { core.state.ui.statusOpen = false; } });
export const dialogueBox = new ui.DialogueBox({ onAdvance: () => advanceDialogue(), onClose: () => endDialogue() });

// Apartment modal and option handling
export const apartmentModal = new ui.Modal({ title: "Personal Computer", onClose: () => {} });
let apartmentModalRect = null;
let apartmentOptionRects = [];
let apartmentSelected = null;

function drawApartmentModalContent(g, area) {
  // draw list of options on the left and a description pane on the right
  const opts = ["Network", "Gear", "Rest", "Deck"];
  const pad = 12; const itemH = 46; const startY = area.y + 16;
  apartmentOptionRects = [];
  // layout: left column for options (~40% width), right column for description
  const leftW = Math.round((area.w - pad*3) * 0.42);
  const rightX = area.x + leftW + pad * 2;
  const rightW = area.w - leftW - pad * 3;
  g.save();
  g.font = "700 14px system-ui"; g.textAlign = "left"; g.textBaseline = "middle";
  for (let i = 0; i < opts.length; i++) {
    const ix = area.x + pad; const iy = startY + i * (itemH + 10); const iw = leftW; const ih = itemH;
    const id = opts[i].toLowerCase();
    const r = { x: ix, y: iy, w: iw, h: ih, id };
    apartmentOptionRects.push(r);
    // highlight if selected
    g.fillStyle = (apartmentSelected === id) ? "rgba(40,90,255,.14)" : "rgba(255,255,255,.03)";
    core.roundRect(g, r.x, r.y, r.w, r.h, 10); g.fill();
    g.strokeStyle = "rgba(140,170,255,.18)"; g.stroke();
    g.fillStyle = "rgba(235,242,255,.95)"; g.fillText(opts[i], r.x + 14, r.y + ih/2);
  }

  // right: description pane
  const descPad = 12; const descX = rightX; const descY = area.y + 16; const descW = rightW; const descH = area.h - 32;
  g.fillStyle = "rgba(255,255,255,.03)"; g.strokeStyle = "rgba(140,170,255,.16)"; core.roundRect(g, descX, descY, descW, descH, 12); g.fill(); g.stroke();
  g.fillStyle = "rgba(235,242,255,.95)"; g.font = "700 14px system-ui"; g.textAlign = "left"; g.textBaseline = "top";
  const descTitleY = descY + descPad; g.fillText("Description", descX + descPad, descTitleY);
  g.font = "500 13px system-ui"; g.fillStyle = "rgba(235,242,255,.86)";
  const descriptions = {
    network: "Access the building's terminal to check messages, jobs, and network resources.",
    gear: "Review and manage your equipment and upgrades.",
    rest: "Take a rest to fully recover HP and EN.",
    deck: "Inspect your deck: view and arrange cards or abilities."
  };
  const descText = apartmentSelected ? (descriptions[apartmentSelected] || "") : "Tap an option to see a short description, then tap again to confirm.";
  core.wrapText(g, descText, descX + descPad, descTitleY + 26, descW - descPad * 2, 18, 10);
  g.restore();
}

// Debug overlay (temporary) to show last tap, local coords, elements under pointer, and npc hit
let _debugEl = null;
function ensureDebugOverlay() {
  if (_debugEl) return;
  if (!document || !document.body) return;
  _debugEl = document.createElement('div');
  _debugEl.style.position = 'fixed';
  _debugEl.style.right = '12px';
  _debugEl.style.top = '12px';
  _debugEl.style.zIndex = 999999;
  _debugEl.style.background = 'rgba(0,0,0,0.55)';
  _debugEl.style.color = '#e9f0ff';
  _debugEl.style.padding = '8px 10px';
  _debugEl.style.borderRadius = '8px';
  _debugEl.style.fontSize = '12px';
  _debugEl.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  _debugEl.style.whiteSpace = 'pre';
  _debugEl.style.pointerEvents = 'none';
  _debugEl.textContent = '';
  document.body.appendChild(_debugEl);
}

function updateDebugOverlay(clientX, clientY) {
  try {
    ensureDebugOverlay();
    if (!_debugEl) return;
    const local = core.toLocal(clientX, clientY);
    const elems = (document.elementsFromPoint ? document.elementsFromPoint(clientX, clientY) : [document.elementFromPoint(clientX, clientY)]).slice(0,6).map(n => (n && n.tagName ? n.tagName.toLowerCase() + (n.id ? '#'+n.id : '') : ''));
    const loc = core.getLocation();
    const npc = npcHitTest(local.x, local.y, loc);
    _debugEl.textContent = `client: ${clientX},${clientY}\nlocal: ${Math.round(local.x)},${Math.round(local.y)}\nelems: ${elems.join(', ')}\nnpc: ${npc ? npc.id : 'null'}`;
  } catch (e) {}
}

// (Removed temporary document-level pointer forwarder — clicks handled by canvas listener.)

// Bottom nav buttons (constructed using ui.Button)
export const bottomButtons = [
  new ui.Button({ id: "move", x: 16, y: core.BASE_H - 78, w: 108, h: 62, label: "Movement", iconFn: (g, x, y, w, h) => { const ix = Math.round(x + (w - 20) / 2); const iy = Math.round(y + 12); core.Icons.move(g, ix, iy, 20, 20); }, onClick: () => { core.state.ui.moveOpen ? closeMove() : openMove(); } }),
  new ui.Button({ id: "status", x: 141, y: core.BASE_H - 78, w: 108, h: 62, label: "Status", iconFn: (g, x, y, w, h) => {
    const img = core.playerBustImg;
    if (img && img.complete && img.naturalWidth > 0) {
      const nw = img.naturalWidth; const nh = img.naturalHeight;
      // Use cover behavior so the bust fills the button (may crop)
      const scale = Math.max(w / nw, h / nh);
      const dw = Math.max(1, Math.round(nw * scale)); const dh = Math.max(1, Math.round(nh * scale));
      const dx = Math.round(x + (w - dw) / 2); const dy = Math.round(y + (h - dh) / 2);
      g.drawImage(img, dx, dy, dw, dh);
    } else {
      core.Icons.status(g, x, y, w, h);
    }
  }, onClick: () => openStatus(), kind: "secondary" }),
  new ui.Button({ id: "battle", x: 266, y: core.BASE_H - 78, w: 108, h: 62, label: "Battle Test", iconFn: (g, x, y, w, h) => { const ix = Math.round(x + (w - 20) / 2); const iy = Math.round(y + 12); core.Icons.battle(g, ix, iy, 20, 20); }, onClick: () => goBattleTest(), kind: "primary" }),
];

// Layout / interaction state for move sheet
const moveRects = { moveItemRects: [], moveCloseRect: null };

// Dialogue / travel functions that reference the DialogueBox instance
export function startDialogue(npcId) {
  const loc = core.getLocation();
  if (!loc || !Array.isArray(loc.npcs)) return;
  const npc = loc.npcs.find(n => n.id === npcId);
  try { console.debug('[DIALOGUE] startDialogue', npcId, !!npc); } catch (e) {}
  if (!npc) return;
  const lines = Array.isArray(npc.dialogue) ? npc.dialogue : [];
  if (lines.length === 0) {
    // no dialogue defined — show a simple stub message
    core.state.dialogue = null;
    dialogueBox.show(npc.name || "", "…" );
    return;
  }
  core.state.dialogue = { npcId, lineIndex: 0 };
  dialogueBox.show(npc.name || "", lines[0]);
}

export function advanceDialogue() {
  if (!core.state.dialogue) return;
  const loc = core.getLocation();
  if (!loc || !Array.isArray(loc.npcs)) { endDialogue(); return; }
  const npc = loc.npcs.find(n => n.id === core.state.dialogue.npcId);
  if (!npc) { endDialogue(); return; }
  const lines = Array.isArray(npc.dialogue) ? npc.dialogue : [];
  const next = core.state.dialogue.lineIndex + 1;
  if (next >= lines.length) { endDialogue(); return; }
  core.state.dialogue.lineIndex = next;
  dialogueBox.show(npc.name || "", lines[next]);
}

export function endDialogue() {
  core.state.dialogue = null; dialogueBox.hide();
}

export function openStatus() { core.state.ui.statusOpen = true; statusModal.open(); }
export function closeStatus() { core.state.ui.statusOpen = false; statusModal.close(); }
export function openMove() { core.state.ui.moveOpen = true; }
export function closeMove() { core.state.ui.moveOpen = false; }

export function travel(toId) { if (!core.DATA.locations[toId]) return; core.state.locationId = toId; closeMove(); endDialogue(); }

export function goBattleTest() { closeMove(); endDialogue(); closeStatus(); battle.startBattle("testbot"); }
export function goAdventure() { core.state.screen = "adventure"; }

// Hit-testing NPCs
export function npcHitTest(px, py, location) { return ui.npcHitTest(px, py, location); }

// Input handling
export function handleTap(clientX, clientY) {
  const { x: px, y: py } = core.toLocal(clientX, clientY);
  if (core.state.screen === "battle") {
    const bs = battle.battleState;
    if (bs.phase === 'choice') {
      const f = bs.buttons.choiceFight; const fl = bs.buttons.choiceFlee;
      if (f && core.rectContains(f, px, py)) { bs.phase = 'active'; bs.phaseStart = performance.now(); return; }
      if (fl && core.rectContains(fl, px, py)) { battle.endBattle(false); return; }
    }
    if (bs.phase === 'active') {
      const s = bs.buttons.leftSword; const gbtn = bs.buttons.leftGun; const mix = bs.buttons.rightMix; const item = bs.buttons.rightItem;
      if (s && core.rectContains(s, px, py)) { battle.startSwordQTE(); return; }
      if (gbtn && core.rectContains(gbtn, px, py)) { battle.playerAttack('gun'); return; }
      if (mix && core.rectContains(mix, px, py)) { battle.playerAttack('mix'); return; }
      if (item && core.rectContains(item, px, py)) { battle.pushBattleLog('Used item (stub)'); return; }
    }
    if (bs.phase === 'qte') {
      const exec = bs.buttons.qteExecute;
      if (exec && core.rectContains(exec, px, py)) { battle.resolveSwordQTE(); return; }
    }
    return;
  }

  if (statusModal.visible) { statusModal.handlePointer(px, py); return; }
  // if apartment modal open, check option clicks first
  if (apartmentModal.visible) {
    for (const r of apartmentOptionRects) {
      if (core.rectContains(r, px, py)) {
        // If user taps an option once, select it and show the description.
        // Tapping the same option again confirms/executes it.
        if (apartmentSelected === r.id) {
          try { console.log('[APARTMENT] confirmed', r.id); } catch (e) {}
          if (r.id === 'rest') { core.DATA.player.hp.cur = core.DATA.player.hp.max; }
          // perform other option effects later as needed
          apartmentSelected = null; apartmentModal.close(); return;
        } else {
          apartmentSelected = r.id; return;
        }
      }
    }
    // also allow modal's close handling
    if (apartmentModal.handlePointer(px, py)) return;
  }
  const dRect = ui.getDialogueRect(); if (dialogueBox.handlePointer(px, py, dRect)) return;
  if (core.state.ui.moveOpen) {
    if (moveRects.moveCloseRect && core.rectContains(moveRects.moveCloseRect, px, py)) { closeMove(); return; }
    for (const r of moveRects.moveItemRects) { if (core.rectContains(r, px, py)) { travel(r.id); return; } }
    const sheet = ui.getMoveSheetRect(); if (!core.rectContains(sheet, px, py)) { closeMove(); return; }
    return;
  }

  for (const b of bottomButtons) { if (b.contains(px, py)) { b.onClick?.(); return; } }

  const loc = core.getLocation();
  // Apartment hotspot: if in apartment and hotspot hit, open modal
  if (core.state.locationId === 'apartment') {
    const hs = ui.lastApartmentHotspot;
    if (hs) {
      const dx = px - hs.x; const dy = py - hs.y;
      if (dx*dx + dy*dy <= (hs.r + 8) * (hs.r + 8)) { // allow small padding
        apartmentModal.open();
        return;
      }
    }
  }
  const npc = npcHitTest(px, py, loc); if (npc) { startDialogue(npc.id); return; }
}

// Safe startup: wait for `core.canvas` / `core.ctx` to be ready before attaching listeners
function startApp() {
  // ensure debug overlay visible ASAP
  try { ensureDebugOverlay(); } catch (e) {}
  // Primary canvas listener (keeps existing behavior) with a debug log
  core.canvas.addEventListener("pointerdown", (e) => {
    try { console.debug('[INPUT] canvas pointerdown', e.clientX, e.clientY); } catch (e) {}
    updateDebugOverlay(e.clientX, e.clientY);
    e.preventDefault(); handleTap(e.clientX, e.clientY);
  }, { passive: false });

  // (Removed extra document-level listeners to avoid duplicate event forwarding.)

  // Main loop
  function draw() {
    core.ctx.clearRect(0, 0, core.BASE_W, core.BASE_H);
    if (core.state.screen === "battle") {
      ui.drawBattleScreen(core.ctx, battle.battleState, core.avatarImg, battle.playerAttack, battle.endBattle, battle.pushBattleLog);
      requestAnimationFrame(draw);
      return;
    }
    const loc = core.getLocation();
    ui.drawBackground(core.ctx, loc.backgroundVariant);
    // draw apartment hotspot on top of the background
    if (core.state.locationId === 'apartment' && loc && loc.hotspot) {
      ui.drawApartmentHotspot(core.ctx, loc.hotspot);
    }
    ui.drawTopBar(core.ctx, core.getLocation, core.DATA);
    ui.drawNpcMarkers(core.ctx, loc);
    ui.drawBottomBar(core.ctx, bottomButtons);
    ui.drawMoveSheet(core.ctx, core.state, moveRects);
    dialogueBox.draw(core.ctx, ui.getDialogueRect());
    // draw status modal with avatar background behind the modal frame (centered)
    statusModal.draw(core.ctx, ui.getStatusRect(),
      (g, area) => ui.drawStatusContent(g, area, core.DATA),
      (g, area) => ui.drawStatusBackground(g, area, core.DATA)
    );
    // apartment modal (if open)
    drawApartmentModalIfNeeded(core.ctx);
    requestAnimationFrame(draw);
  }

  draw();
}

// draw apartment modal each frame if visible
function drawApartmentModalIfNeeded(g) {
  if (!apartmentModal.visible) return;
  // Give more room so options and the description pane fit comfortably
  const w = Math.min(core.BASE_W - 28, 360); const h = 340; const x = Math.round((core.BASE_W - w) / 2); const y = Math.round((core.BASE_H - h) / 2);
  apartmentModalRect = { x, y, w, h };
  apartmentModal.draw(g, apartmentModalRect, drawApartmentModalContent);
}

if (core.canvas && core.ctx) {
  startApp();
} else {
  window.addEventListener("DOMContentLoaded", () => {
    // `core.initCanvas` runs on DOMContentLoaded; allow it a tick to set `core.canvas`/`core.ctx`
    setTimeout(() => {
      if (!core.canvas || !core.ctx) {
        core.canvas = document.getElementById("game");
        if (core.canvas) core.ctx = core.canvas.getContext("2d");
        core.resize();
      }
      startApp();
    }, 0);
  }, { once: true });
}

// Expose a small API for debugging in console
window.__app = { core, ui, battle, startDialogue, advanceDialogue, endDialogue, goBattleTest };
