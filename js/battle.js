import { DATA, state } from './core.js';

export const ENEMIES = {
  testbot: { id: "testbot", name: "Test Bot", hp: 40, maxHp: 40, atk: 1, cooldown: 3000, image: "assets/TestBot.png", bg1: 'bs3' },
  rogue: { id: "rogue", name: "Rogue Drone", hp: 60, maxHp: 60, atk: 8, cooldown: 1400, image: null }
};

export let battleState = {
  active: false,
  phase: "idle",
  enemy: null,
  logs: [],
  lastEnemyAttack: 0,
  playerLastAction: 0,
  buttons: {},
  qte: null,
  bs1: null, // background identifier for enemy/top area
  bs2: null  // background identifier for player/bottom area
};

export function pushBattleLog(msg) {
  battleState.logs.unshift({ t: performance.now(), msg });
  if (battleState.logs.length > 6) battleState.logs.pop();
}

export function startBattle(enemyId) {
  const tpl = ENEMIES[enemyId] || ENEMIES.testbot;
  battleState.enemy = Object.assign({}, tpl);
  // set battle backgrounds: prefer template bg1/bg2, else fallback
    battleState.bs1 = tpl.bg1 || 'bs3';
  const loc = DATA.locations[state.locationId];
  battleState.bs2 = tpl.bg2 || (loc && loc.backgroundVariant) || state.locationId || 'plaza';
  battleState.phase = "intro";
  battleState.phaseStart = performance.now();
  battleState.lastEnemyAttack = performance.now();
  battleState.playerLastAction = 0;
  battleState.logs = [];
  state.screen = "battle";
  battleState.active = true;
  pushBattleLog("An " + battleState.enemy.name + " appeared");
}

export function endBattle(win) {
  battleState.phase = "ended";
  battleState.active = false;
  if (win) pushBattleLog("You defeated " + battleState.enemy.name + "!");
  else pushBattleLog("You fled or were defeated.");
  setTimeout(() => { state.screen = "adventure"; battleState.phase = "idle"; }, 900);
}

export function enemyTryAttack(now) {
  if (!battleState.enemy) return;
  if (now - battleState.lastEnemyAttack >= battleState.enemy.cooldown) {
    battleState.lastEnemyAttack = now;
    const dmg = Math.max(1, Math.round((battleState.enemy.atk) * (0.8 + Math.random() * 0.6)));
    DATA.player.hp.cur = Math.max(0, DATA.player.hp.cur - dmg);
    pushBattleLog(battleState.enemy.name + " hits you for " + dmg + "!");
    if (DATA.player.hp.cur <= 0) {
      pushBattleLog("You were defeated...");
      endBattle(false);
    }
  }
}

export function playerAttack(mode) {
  if (!battleState.enemy || battleState.phase !== "active") return;
  const now = performance.now();
  if (now - battleState.playerLastAction < 400) return;
  battleState.playerLastAction = now;
  let dmg = 0;
  if (mode === "sword") dmg = 8 + Math.floor(Math.random()*6);
  else if (mode === "gun") dmg = 5 + Math.floor(Math.random()*8);
  else if (mode === "mix") dmg = 6 + Math.floor(Math.random()*7);
  else dmg = 4;
  battleState.enemy.hp = Math.max(0, battleState.enemy.hp - dmg);
  pushBattleLog("You hit " + battleState.enemy.name + " for " + dmg + "");
  if (battleState.enemy.hp <= 0) {
    endBattle(true);
  }
}

// Quick-Time Event (QTE) for sword mode
export function startSwordQTE() {
  if (!battleState.enemy || battleState.phase !== "active") return;
  const now = performance.now();
  battleState.phase = "qte";
  battleState.qte = {
    start: now,
    period: 1000, // millis for back-and-forth
    timeout: 2400, // total allowed time for QTE
    targetWidth: 0.14, // portion of meter considered a hit
    criticalWidth: 0.04, // portion around center considered critical
    startTime: now
  };
  battleState.phaseStart = now;
  pushBattleLog("Prepare your strike!");
}

function _qtePosFromNow(qte, now) {
  const elapsed = Math.max(0, now - qte.start);
  const phase = (elapsed % qte.period) / qte.period; // 0..1
  // triangle ping-pong to 0..1
  const pos = Math.abs(phase * 2 - 1);
  return pos; // 0..1
}

export function resolveSwordQTE() {
  const qte = battleState.qte;
  if (!qte) return;
  const now = performance.now();
  const elapsed = now - qte.start;
  const pos = _qtePosFromNow(qte, now);
  const centerDist = Math.abs(pos - 0.5);
  const criticalThresh = qte.criticalWidth / 2;
  const hitThresh = qte.targetWidth / 2;
  let result = "miss";
  if (centerDist <= criticalThresh) result = "critical";
  else if (centerDist <= hitThresh) result = "hit";

  // apply damage based on result
  let base = 8 + Math.floor(Math.random() * 6);
  let dmg = 0;
  if (result === "critical") dmg = base * 2;
  else if (result === "hit") dmg = base;
  else dmg = 0;

  if (dmg > 0) {
    battleState.enemy.hp = Math.max(0, battleState.enemy.hp - dmg);
    pushBattleLog(result === "critical" ? `Critical! You strike for ${dmg}!` : `You hit for ${dmg}.`);
    // trigger attack animation overlay and pause battle while it plays
    const animStart = now;
    // duration will be managed by the UI (video end or timeout); set placeholder
    battleState.anim = { type: 'sword', start: animStart, duration: null, dmg, result };
    try { console.log('[QTE] anim set (UI will manage duration)', battleState.anim); } catch(e) {}
    // set phase to 'anim' to pause enemy attacks and input; UI will clear anim when done
    battleState.phase = 'anim';
    if (battleState.enemy.hp <= 0) {
      // allow the endBattle flow to show outcome — endBattle will set phase and active
      endBattle(true);
    }
  } else {
    pushBattleLog("You missed the strike!");
  }

  // cleanup qte
  battleState.qte = null;
  if (battleState.phase === "qte") battleState.phase = "active";
  battleState.playerLastAction = now;
}
