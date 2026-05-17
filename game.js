/**
 * Haenggung-dong Survival — catch insects for score, dodge pests to protect health.
 * Victory at score >= 200; game over at health <= 0; both return to menu.
 * English comments; Korean UI in index.html / canvas HUD.
 */

/** GitHub Pages subfolder: set to e.g. "/repo-name/" if needed, else "". */
const BASE_PATH = "";

const LOGICAL_W = 360;
const LOGICAL_H = 640;
const MAX_DISPLAY_SCALE = 4;

const FLOOR_HEIGHT = 96;
const FLOOR_TOP_Y = LOGICAL_H - FLOOR_HEIGHT;
const GROUND_Y = FLOOR_TOP_Y - 6;

/** Fallback / max baseline when art missing (manifest). */
const PLAYER_W = 50;
const PLAYER_H = 50;
/** Logical draw height for sliced sprites; width follows aspect (nearest-friendly ints). */
const PLAYER_DRAW_TARGET_H = 80;

const FALLING_ITEM_W = 24;
const FALLING_ITEM_H = 24;
const INSECT_SCORE_VALUE = 5;

/** Base values at level 1; scaled up to level 10 (see levelT + helpers below). */
const ITEM_FALL_SPEED_BASE = 200;
const ITEM_SPAWN_BASE_SEC = 1.05;
const ITEM_SPAWN_MIN_SEC = 0.42;

const LEVEL_MAX = 10;
/** Win condition (MASTER_PLAN §5). */
const VICTORY_SCORE = 200;

const HUD_HEART_SIZE = 26;
const HUD_HEART_GAP = 3;

const GRAVITY = 2600;
const JUMP_VELOCITY = -720;
const MAX_FALL_SPEED = 950;
const MOVE_ACCEL = 3800;
const MAX_RUN_SPEED = 260;
const GROUND_FRICTION = 3200;

const IDLE_FRAME_MS = 520;
const MOVE_FRAME_MS = 95;
const MAX_FRAME_MS = 32;

const HEALTH_MAX = 5;

const HEART_W = 20;
const HEART_H = 20;
const HELPER_DRAW_TARGET_H = 110;
const HELPER_FALLBACK_W = 82;
const HELPER_CAMEO_MS = 2000;
const HELPER_THROW_AT_MS = 1000;
const HEART_COOLDOWN_MIN_SEC = 4.0;
const HEART_COOLDOWN_MAX_SEC = 6.5;
/** First heart arrives soon after run starts. */
const HEART_FIRST_DELAY_SEC = 2.0;

const MUSIC_BPM = 136;
const MUSIC_STEP_SEC = 60 / MUSIC_BPM / 2;
const MUSIC_LOOKAHEAD_SEC = 0.14;

/** @typedef {{ id: string, file: string, fw: number, fh: number, color: string }} AssetDef */

const ASSET_MANIFEST = [
  { id: "Bg_NunuHouse", file: "nunuhouse.png", fw: 360, fh: 640, color: "#87CEEB" },
  { id: "Hoon_Idle1", file: "characters/hoon_idle1.png", fw: 50, fh: 50, color: "blue" },
  { id: "Hoon_Idle2", file: "characters/hoon_idle2.png", fw: 50, fh: 50, color: "lightblue" },
  { id: "Hoon_Move1", file: "characters/hoon_move1.png", fw: 50, fh: 50, color: "darkblue" },
  { id: "Hoon_Move2", file: "characters/hoon_move2.png", fw: 50, fh: 50, color: "blue" },
  { id: "Hoon_Move3", file: "characters/hoon_move3.png", fw: 50, fh: 50, color: "lightblue" },
  { id: "Joon_Idle1", file: "characters/joon_idle1.png", fw: 50, fh: 50, color: "green" },
  { id: "Joon_Idle2", file: "characters/joon_idle2.png", fw: 50, fh: 50, color: "lightgreen" },
  { id: "Joon_Move1", file: "characters/joon_move1.png", fw: 50, fh: 50, color: "darkgreen" },
  { id: "Joon_Move2", file: "characters/joon_move2.png", fw: 50, fh: 50, color: "green" },
  { id: "Joon_Move3", file: "characters/joon_move3.png", fw: 50, fh: 50, color: "lightgreen" },
  { id: "Obs_Bug", file: "obs_bug.png", fw: 32, fh: 32, color: "brown" },
  { id: "Insect_Butterfly", file: "insect_butterfly.png", fw: 32, fh: 32, color: "#ef5da8" },
  { id: "Insect_StagBeetle", file: "insect_stag_beetle.png", fw: 32, fh: 32, color: "#7b4118" },
  { id: "Insect_RhinoBeetle", file: "insect_rhino_beetle.png", fw: 32, fh: 32, color: "#653d1e" },
  { id: "Insect_Grasshopper", file: "insect_grasshopper.png", fw: 32, fh: 32, color: "#71be40" },
  { id: "Help_Mom", file: "mom.png", fw: 50, fh: 50, color: "pink" },
  { id: "Help_Dad", file: "daddy.png", fw: 50, fh: 50, color: "purple" },
  { id: "Item_Heart", file: "item_heart.png", fw: 20, fh: 20, color: "red" },
  { id: "UI_Heart", file: "ui_heart.png", fw: 30, fh: 30, color: "red" },
];

const BENEFICIAL_INSECTS = [
  { assetId: "Insect_Butterfly" },
  { assetId: "Insect_StagBeetle" },
  { assetId: "Insect_RhinoBeetle" },
  { assetId: "Insect_Grasshopper" },
];

class AssetManager {
  constructor() {
    /** @type {Map<string, { def: AssetDef, img: HTMLImageElement, ok: boolean }>} */
    this.map = new Map();
  }

  /** @param {(err?: Error) => void} done */
  loadAll(done) {
    let remaining = ASSET_MANIFEST.length;
    const finishOne = () => {
      remaining -= 1;
      if (remaining <= 0) done();
    };

    for (const def of ASSET_MANIFEST) {
      const img = new Image();
      const entry = { def, img, ok: false };
      img.onload = () => {
        entry.ok = true;
        finishOne();
      };
      img.onerror = () => {
        entry.ok = false;
        finishOne();
      };
      img.src = `${BASE_PATH}assets/${def.file}`;
      this.map.set(def.id, entry);
    }
  }

  drawCover(ctx, id, destW, destH) {
    const entry = this.map.get(id);
    if (!entry) {
      ctx.fillStyle = "#87CEEB";
      ctx.fillRect(0, 0, destW, destH);
      return;
    }
    const { def, img, ok } = entry;
    if (!ok || !img.naturalWidth) {
      ctx.fillStyle = def.color;
      ctx.fillRect(0, 0, destW, destH);
      return;
    }

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const ir = iw / ih;
    const cr = destW / destH;
    let sx;
    let sy;
    let sw;
    let sh;
    if (ir > cr) {
      sh = ih;
      sw = sh * cr;
      sx = (iw - sw) / 2;
      sy = 0;
    } else {
      sw = iw;
      sh = sw / cr;
      sx = 0;
      sy = (ih - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, destW, destH);
  }

  drawSprite(ctx, id, dx, dy, dw, dh) {
    const entry = this.map.get(id);
    if (!entry) return;
    const { def, img, ok } = entry;
    if (!ok || !img.naturalWidth) {
      ctx.fillStyle = def.color;
      ctx.fillRect(dx, dy, dw, dh);
      return;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
  }
}

const assets = new AssetManager();

/** @type {"menu" | "playing" | "gameover" | "victory"} */
let gameState = "menu";

/** @type {"hoon" | "joon"} */
let selectedCharacter = "hoon";

let health = HEALTH_MAX;
let score = 0;

/** @type {{ x: number, y: number, w: number, h: number, vy: number, kind: "pest" | "insect", assetId: string, scoreValue: number }[]} */
let fallingItems = [];
let itemSpawnAcc = 0;

/** @type {{ x: number, y: number, w: number, h: number, vx: number, vy: number }[]} */
let hearts = [];
let heartCooldownSec = HEART_FIRST_DELAY_SEC;
/** @type {{ assetId: string, x: number, y: number, w: number, h: number, ttlMs: number, throwAtMs: number, hasThrown: boolean, fromLeft: boolean } | null} */
let helperCameo = null;

let canvas = /** @type {HTMLCanvasElement | null} */ (null);
let ctx = /** @type {CanvasRenderingContext2D | null} */ (null);
let rafId = 0;
let lastTickMs = 0;
let musicCtx = null;
let musicGain = null;
let musicTimer = 0;
let musicStep = 0;
let musicNextTime = 0;

/** @type {Map<number, { lx: number, ly: number }>} */
const activeTouches = new Map();

const keys = {
  left: false,
  right: false,
};

const player = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  facing: 1,
  idlePhase: 0,
  idleTimerMs: 0,
  moveFrame: 0,
  moveTimerMs: 0,
  /** Hitbox / draw size for current frame (synced each tick). */
  dw: PLAYER_W,
  dh: PLAYER_H,
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function randRange(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

function midiToFreq(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function playChipNote(time, midiNote, durationSec, volume, type = "square") {
  if (!musicCtx || !musicGain || midiNote == null) return;
  const osc = musicCtx.createOscillator();
  const env = musicCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(midiToFreq(midiNote), time);
  env.gain.setValueAtTime(0.0001, time);
  env.gain.exponentialRampToValueAtTime(volume, time + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, time + durationSec);
  osc.connect(env);
  env.connect(musicGain);
  osc.start(time);
  osc.stop(time + durationSec + 0.02);
}

function scheduleMusicStep(time, step) {
  const melody = [76, 79, 81, 79, 76, 72, 74, 76, 79, 83, 81, 79, 76, 74, 72, 74];
  const bass = [48, null, 55, null, 52, null, 55, null, 45, null, 52, null, 48, null, 55, null];
  const i = step % melody.length;
  playChipNote(time, melody[i], MUSIC_STEP_SEC * 0.82, 0.045, "square");
  playChipNote(time, bass[i], MUSIC_STEP_SEC * 0.9, 0.032, "triangle");
  if (step % 4 === 2) {
    playChipNote(time, melody[i] + 7, MUSIC_STEP_SEC * 0.42, 0.02, "square");
  }
}

function startMusic() {
  if (musicTimer) return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  if (!musicCtx) {
    musicCtx = new AudioCtor();
    musicGain = musicCtx.createGain();
    musicGain.gain.value = 0.18;
    musicGain.connect(musicCtx.destination);
  }
  musicCtx.resume();
  musicStep = 0;
  musicNextTime = musicCtx.currentTime + 0.04;
  musicTimer = window.setInterval(() => {
    if (!musicCtx) return;
    while (musicNextTime < musicCtx.currentTime + MUSIC_LOOKAHEAD_SEC) {
      scheduleMusicStep(musicNextTime, musicStep);
      musicStep += 1;
      musicNextTime += MUSIC_STEP_SEC;
    }
  }, 25);
}

function stopMusic() {
  if (musicTimer) {
    window.clearInterval(musicTimer);
    musicTimer = 0;
  }
}

/** Level tracks score from collected insects. */
function levelFromScore(sc) {
  return Math.min(LEVEL_MAX, Math.floor(sc / 20) + 1);
}

/** 0 at level 1, 1 at level 10 — used to lerp difficulty. */
function levelT(level) {
  return clamp((level - 1) / (LEVEL_MAX - 1), 0, 1);
}

function itemSpawnIntervalSec(level) {
  const t = levelT(level);
  return clamp(ITEM_SPAWN_BASE_SEC * (1 - t * 0.58), ITEM_SPAWN_MIN_SEC, ITEM_SPAWN_BASE_SEC);
}

function itemFallSpeedPx(level) {
  const t = levelT(level);
  return ITEM_FALL_SPEED_BASE * (1 + t * 0.92);
}

function getPlayerDrawDimensions() {
  const ids =
    selectedCharacter === "hoon"
      ? ["Hoon_Idle1", "Hoon_Idle2", "Hoon_Move1", "Hoon_Move2", "Hoon_Move3"]
      : ["Joon_Idle1", "Joon_Idle2", "Joon_Move1", "Joon_Move2", "Joon_Move3"];
  let maxW = PLAYER_W;
  let maxH = PLAYER_H;
  for (const id of ids) {
    const entry = assets.map.get(id);
    if (!entry || !entry.ok || !entry.img.naturalWidth) continue;
    const iw = entry.img.naturalWidth;
    const ih = entry.img.naturalHeight;
    maxH = Math.max(maxH, ih);
    maxW = Math.max(maxW, iw);
  }
  const h = Math.min(PLAYER_DRAW_TARGET_H, Math.max(36, maxH));
  const w = Math.max(1, Math.round((maxW * h) / Math.max(1, maxH)));
  return { w, h };
}

function getHelperDrawDimensions(assetId) {
  const entry = assets.map.get(assetId);
  if (!entry || !entry.ok || !entry.img.naturalWidth) {
    return { w: HELPER_FALLBACK_W, h: HELPER_DRAW_TARGET_H };
  }
  const iw = entry.img.naturalWidth;
  const ih = entry.img.naturalHeight;
  const h = HELPER_DRAW_TARGET_H;
  const w = Math.max(1, Math.round((iw * h) / Math.max(1, ih)));
  return { w, h };
}

function syncPlayerDrawSize() {
  const d = getPlayerDrawDimensions();
  player.dw = d.w;
  player.dh = d.h;
}

function resetPlayer() {
  player.vx = 0;
  player.vy = 0;
  player.facing = 1;
  player.idlePhase = 0;
  player.idleTimerMs = 0;
  player.moveFrame = 0;
  player.moveTimerMs = 0;
  syncPlayerDrawSize();
  player.x = LOGICAL_W / 2 - player.dw / 2;
  player.y = GROUND_Y - player.dh;
}

function resetRun() {
  health = HEALTH_MAX;
  score = 0;
  fallingItems = [];
  itemSpawnAcc = 0;
  hearts = [];
  helperCameo = null;
  heartCooldownSec = HEART_FIRST_DELAY_SEC;
  resetPlayer();
}

function spawnHeartEvent() {
  const useMom = Math.random() < 0.5;
  const assetId = useMom ? "Help_Mom" : "Help_Dad";
  const fromLeft = !useMom;
  const size = getHelperDrawDimensions(assetId);
  const hx = fromLeft ? 6 : LOGICAL_W - size.w - 6;
  const hy = GROUND_Y - size.h;
  helperCameo = {
    assetId,
    x: hx,
    y: hy,
    w: size.w,
    h: size.h,
    ttlMs: HELPER_CAMEO_MS,
    throwAtMs: HELPER_THROW_AT_MS,
    hasThrown: false,
    fromLeft,
  };
}

function throwHeartFromHelper(h) {
  const sx = h.fromLeft ? h.x + h.w - HEART_W * 0.65 : h.x + HEART_W * 0.15;
  const sy = h.y + h.h * 0.28;

  syncPlayerDrawSize();
  const px = player.x + player.dw / 2;
  const centerBiasedTargetX = LOGICAL_W / 2 + (px - LOGICAL_W / 2) * 0.55;
  const aimVx = (centerBiasedTargetX - (sx + HEART_W / 2)) * 1.56;
  const vx = clamp(aimVx, -630, 630);
  const vy = -560;
  hearts.push({ x: sx, y: sy, w: HEART_W, h: HEART_H, vx, vy });
}

function updateHeartCooldown(dtSec) {
  heartCooldownSec -= dtSec;
  if (heartCooldownSec <= 0) {
    spawnHeartEvent();
    heartCooldownSec = randRange(HEART_COOLDOWN_MIN_SEC, HEART_COOLDOWN_MAX_SEC);
  }
}

function updateHelperCameo(dtMs) {
  if (!helperCameo) return;
  helperCameo.ttlMs -= dtMs;
  helperCameo.throwAtMs -= dtMs;
  if (!helperCameo.hasThrown && helperCameo.throwAtMs <= 0) {
    throwHeartFromHelper(helperCameo);
    helperCameo.hasThrown = true;
  }
  if (helperCameo.ttlMs <= 0) helperCameo = null;
}

function moveHearts(dtSec) {
  const kept = [];
  for (const h of hearts) {
    h.vy += GRAVITY * dtSec;
    h.vy = Math.min(h.vy, MAX_FALL_SPEED);
    h.x += h.vx * dtSec;
    h.y += h.vy * dtSec;
    const off =
      h.y > LOGICAL_H + 28 || h.x + h.w < -36 || h.x > LOGICAL_W + 36 || h.y < -120;
    if (!off) kept.push(h);
  }
  hearts = kept;
}

function resolveHeartPickups() {
  const hb = playerHitbox();
  const kept = [];
  for (const h of hearts) {
    if (rectOverlap(hb.x, hb.y, hb.w, hb.h, h.x, h.y, h.w, h.h)) {
      if (health < HEALTH_MAX) health += 1;
    } else {
      kept.push(h);
    }
  }
  hearts = kept;
}

function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function playerHitbox() {
  const insetX = Math.round(player.dw * 0.22);
  const insetTop = Math.round(player.dh * 0.1);
  const insetBottom = Math.round(player.dh * 0.08);
  return {
    x: player.x + insetX,
    y: player.y + insetTop,
    w: Math.max(12, player.dw - insetX * 2),
    h: Math.max(18, player.dh - insetTop - insetBottom),
  };
}

function spawnFallingItem(level) {
  const x = Math.random() * Math.max(1, LOGICAL_W - FALLING_ITEM_W);
  const vy = itemFallSpeedPx(level);
  const insectChance = clamp(0.72 - levelT(level) * 0.18, 0.54, 0.72);
  const isInsect = Math.random() < insectChance;
  if (isInsect) {
    const insect = BENEFICIAL_INSECTS[Math.floor(Math.random() * BENEFICIAL_INSECTS.length)];
    fallingItems.push({
      x,
      y: -FALLING_ITEM_H - 8,
      w: FALLING_ITEM_W,
      h: FALLING_ITEM_H,
      vy,
      kind: "insect",
      assetId: insect.assetId,
      scoreValue: INSECT_SCORE_VALUE,
    });
    return;
  }

  fallingItems.push({
    x,
    y: -FALLING_ITEM_H - 8,
    w: FALLING_ITEM_W,
    h: FALLING_ITEM_H,
    vy,
    kind: "pest",
    assetId: "Obs_Bug",
    scoreValue: 0,
  });
}

function updateSpawners(dtSec) {
  const lv = levelFromScore(score);
  const itemEvery = itemSpawnIntervalSec(lv);
  itemSpawnAcc += dtSec;
  while (itemSpawnAcc >= itemEvery) {
    itemSpawnAcc -= itemEvery;
    spawnFallingItem(lv);
  }
}

function moveFallingItems(dtSec) {
  for (const item of fallingItems) {
    const vy = typeof item.vy === "number" ? item.vy : ITEM_FALL_SPEED_BASE;
    item.y += vy * dtSec;
  }
}

function resolveCollisions() {
  const hb = playerHitbox();
  const nextItems = [];
  for (const item of fallingItems) {
    if (rectOverlap(hb.x, hb.y, hb.w, hb.h, item.x, item.y, item.w, item.h)) {
      if (item.kind === "pest") {
        health = Math.max(0, health - 1);
      } else {
        score += item.scoreValue;
      }
    } else {
      nextItems.push(item);
    }
  }
  fallingItems = nextItems;
}

function removeOffScreenItems() {
  fallingItems = fallingItems.filter((item) => item.y <= LOGICAL_H);
}

function syncCanvasBufferSize() {
  if (!canvas) return;
  canvas.width = LOGICAL_W;
  canvas.height = LOGICAL_H;
}

function resizeCanvasCss() {
  if (!canvas) return;
  const wrap = document.getElementById("canvas-wrap");
  if (!wrap) return;

  const pad = 16;
  const availW = window.innerWidth - pad;
  const availH = window.innerHeight - pad;
  let scale = Math.floor(Math.min(availW / LOGICAL_W, availH / LOGICAL_H));
  if (scale < 1) scale = 1;
  if (scale > MAX_DISPLAY_SCALE) scale = MAX_DISPLAY_SCALE;

  const cssW = LOGICAL_W * scale;
  const cssH = LOGICAL_H * scale;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  wrap.style.width = `${cssW}px`;
  wrap.style.height = `${cssH}px`;
}

function clientToLogical(clientX, clientY) {
  if (!canvas) return { lx: 0, ly: 0 };
  const r = canvas.getBoundingClientRect();
  const lx = ((clientX - r.left) / r.width) * LOGICAL_W;
  const ly = ((clientY - r.top) / r.height) * LOGICAL_H;
  return { lx, ly };
}

function stripZone(lx, ly) {
  if (ly < FLOOR_TOP_Y) return "play";
  const t1 = LOGICAL_W / 3;
  const t2 = (2 * LOGICAL_W) / 3;
  if (lx < t1) return "left";
  if (lx < t2) return "center";
  return "right";
}

function isPlayerOnGround() {
  return player.y + player.dh >= GROUND_Y - 0.5 && player.vy >= 0;
}

function tryJump() {
  if (gameState !== "playing") return;
  if (isPlayerOnGround()) {
    player.vy = JUMP_VELOCITY;
  }
}

function aggregateTouchStripInput() {
  let left = false;
  let right = false;
  for (const p of activeTouches.values()) {
    const z = stripZone(p.lx, p.ly);
    if (z === "left") left = true;
    if (z === "right") right = true;
  }
  return { left, right };
}

function updateTouchesFromEvent(ev) {
  if (!canvas || gameState !== "playing") return;
  for (let i = 0; i < ev.changedTouches.length; i += 1) {
    const t = ev.changedTouches[i];
    const { lx, ly } = clientToLogical(t.clientX, t.clientY);
    if (ev.type === "touchend" || ev.type === "touchcancel") {
      activeTouches.delete(t.identifier);
    } else {
      activeTouches.set(t.identifier, { lx, ly });
    }
  }
}

function bindCanvasTouch() {
  if (!canvas) return;
  const opts = { passive: false };
  const onTouch = (ev) => {
    if (gameState !== "playing") return;
    updateTouchesFromEvent(ev);
    if (ev.type === "touchstart") {
      for (let i = 0; i < ev.changedTouches.length; i += 1) {
        const t = ev.changedTouches[i];
        const { lx, ly } = clientToLogical(t.clientX, t.clientY);
        if (stripZone(lx, ly) === "center") tryJump();
      }
    }
    ev.preventDefault();
  };
  canvas.addEventListener("touchstart", onTouch, opts);
  canvas.addEventListener("touchmove", onTouch, opts);
  canvas.addEventListener("touchend", onTouch, opts);
  canvas.addEventListener("touchcancel", onTouch, opts);
}

function bindKeyboard() {
  window.addEventListener(
    "keydown",
    (ev) => {
      if (gameState !== "playing") return;
      if (ev.code === "ArrowLeft") {
        keys.left = true;
        ev.preventDefault();
      } else if (ev.code === "ArrowRight") {
        keys.right = true;
        ev.preventDefault();
      } else if (ev.code === "Space") {
        if (!ev.repeat) tryJump();
        ev.preventDefault();
      }
    },
    { passive: false },
  );
  window.addEventListener(
    "keyup",
    (ev) => {
      if (ev.code === "ArrowLeft") keys.left = false;
      if (ev.code === "ArrowRight") keys.right = false;
    },
    { passive: true },
  );
}

function bindTouchButtons() {
  const left = document.getElementById("btn-left");
  const right = document.getElementById("btn-right");
  const jump = document.getElementById("btn-jump");
  if (!left || !right || !jump) return;

  const bindHold = (btn, onDown, onUp) => {
    const down = (ev) => {
      ev.preventDefault();
      if (gameState !== "playing") return;
      onDown();
    };
    const up = (ev) => {
      ev.preventDefault();
      onUp();
    };
    btn.addEventListener("pointerdown", down, { passive: false });
    btn.addEventListener("pointerup", up, { passive: false });
    btn.addEventListener("pointercancel", up, { passive: false });
    btn.addEventListener("pointerleave", up, { passive: false });
  };

  bindHold(
    left,
    () => {
      keys.left = true;
    },
    () => {
      keys.left = false;
    },
  );
  bindHold(
    right,
    () => {
      keys.right = true;
    },
    () => {
      keys.right = false;
    },
  );

  jump.addEventListener(
    "pointerdown",
    (ev) => {
      ev.preventDefault();
      if (gameState !== "playing") return;
      tryJump();
    },
    { passive: false },
  );
}

function setTouchControlsVisible(show) {
  const el = document.getElementById("touch-controls");
  if (!el) return;
  el.classList.toggle("hidden", !show);
  el.setAttribute("aria-hidden", show ? "false" : "true");
}

function applyCanvasPixelStyle() {
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
}

function currentAnimAssetId() {
  const prefix = selectedCharacter === "hoon" ? "Hoon_" : "Joon_";
  const moving = Math.abs(player.vx) > 40;
  if (moving) {
    const n = player.moveFrame % 3;
    const names = ["Move1", "Move2", "Move3"];
    return `${prefix}${names[n]}`;
  }
  const idle = player.idlePhase === 0 ? "Idle1" : "Idle2";
  return `${prefix}${idle}`;
}

function updatePlayer(dtSec, dtMs) {
  const touch = aggregateTouchStripInput();
  let move = 0;
  if (keys.right || touch.right) move += 1;
  if (keys.left || touch.left) move -= 1;

  if (move !== 0) {
    player.vx += move * MOVE_ACCEL * dtSec;
    player.vx = clamp(player.vx, -MAX_RUN_SPEED, MAX_RUN_SPEED);
  } else {
    const decel = GROUND_FRICTION * dtSec;
    if (Math.abs(player.vx) <= decel) player.vx = 0;
    else player.vx -= Math.sign(player.vx) * decel;
  }

  if (player.vx > 30) player.facing = 1;
  else if (player.vx < -30) player.facing = -1;

  player.vy += GRAVITY * dtSec;
  player.vy = Math.min(player.vy, MAX_FALL_SPEED);

  player.x += player.vx * dtSec;
  player.y += player.vy * dtSec;

  syncPlayerDrawSize();

  if (player.y + player.dh > GROUND_Y) {
    player.y = GROUND_Y - player.dh;
    if (player.vy > 0) player.vy = 0;
  }

  player.x = clamp(player.x, 0, LOGICAL_W - player.dw);
  player.y = clamp(player.y, 0, GROUND_Y - player.dh);

  const movingAnim = Math.abs(player.vx) > 40;
  if (movingAnim) {
    player.moveTimerMs += dtMs;
    while (player.moveTimerMs >= MOVE_FRAME_MS) {
      player.moveTimerMs -= MOVE_FRAME_MS;
      player.moveFrame = (player.moveFrame + 1) % 3;
    }
    player.idleTimerMs = 0;
    player.idlePhase = 0;
  } else {
    player.moveTimerMs = 0;
    player.moveFrame = 0;
    player.idleTimerMs += dtMs;
    while (player.idleTimerMs >= IDLE_FRAME_MS) {
      player.idleTimerMs -= IDLE_FRAME_MS;
      player.idlePhase = player.idlePhase === 0 ? 1 : 0;
    }
  }
}

function drawPlayer() {
  if (!ctx) return;
  const id = currentAnimAssetId();
  const { dw, dh } = player;
  // Small ground shadow improves depth/visibility on bright backgrounds.
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(player.x + dw * 0.5, GROUND_Y - 2, Math.max(8, dw * 0.26), 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (player.facing === 1) {
    assets.drawSprite(ctx, id, player.x, player.y, dw, dh);
  } else {
    ctx.save();
    ctx.translate(player.x + dw, player.y);
    ctx.scale(-1, 1);
    assets.drawSprite(ctx, id, 0, 0, dw, dh);
    ctx.restore();
  }
}

function drawFloorStrip() {
  if (!ctx) return;
  ctx.fillStyle = "#040404";
  ctx.fillRect(0, FLOOR_TOP_Y, LOGICAL_W, FLOOR_HEIGHT);
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(0, FLOOR_TOP_Y, LOGICAL_W, 2);
}

function drawFallingItems() {
  if (!ctx) return;
  for (const item of fallingItems) {
    assets.drawSprite(ctx, item.assetId, item.x, item.y, item.w, item.h);
  }
}

/**
 * Full-screen tint after background. Lvl 4–5 sunset; 6+ night (8–10 adds particles in drawRain).
 */
function drawAtmosphere(level) {
  if (!ctx || level <= 3) return;
  if (level <= 5) {
    ctx.fillStyle = "rgba(255, 130, 55, 0.2)";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  } else {
    ctx.fillStyle = "rgba(0, 22, 58, 0.42)";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }
}

/** Simple white drifting pixels for levels 8–10 (MASTER_PLAN §12). */
function drawRainParticles(nowMs) {
  if (!ctx) return;
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  const n = 46;
  for (let i = 0; i < n; i += 1) {
    const phase = i * 9973;
    const x = ((phase * 0.017 + nowMs * 0.018) % 1) * LOGICAL_W;
    const y = ((phase * 0.031 + nowMs * 0.095) % 1) * LOGICAL_H;
    const sz = 2 + (i % 2);
    ctx.fillRect(Math.floor(x), Math.floor(y), sz, sz);
  }
  ctx.restore();
}

function drawHelperCameo() {
  if (!ctx || !helperCameo) return;
  const h = helperCameo;
  assets.drawSprite(ctx, h.assetId, h.x, h.y, h.w, h.h);
}

function drawHearts() {
  if (!ctx) return;
  for (const h of hearts) {
    assets.drawSprite(ctx, "Item_Heart", h.x, h.y, h.w, h.h);
  }
}

function drawHud() {
  if (!ctx) return;
  const pad = 8;
  const lv = levelFromScore(score);
  ctx.save();
  ctx.textBaseline = "top";

  const hy = pad;
  for (let i = 0; i < HEALTH_MAX; i += 1) {
    const hx = pad + i * (HUD_HEART_SIZE + HUD_HEART_GAP);
    if (i < health) {
      assets.drawSprite(ctx, "UI_Heart", hx, hy, HUD_HEART_SIZE, HUD_HEART_SIZE);
    } else {
      ctx.globalAlpha = 0.3;
      assets.drawSprite(ctx, "UI_Heart", hx, hy, HUD_HEART_SIZE, HUD_HEART_SIZE);
      ctx.globalAlpha = 1;
    }
  }

  const textY0 = pad + 2;
  const textY1 = pad + 22;
  const rx = LOGICAL_W - pad;
  ctx.font = '600 14px "Gowun Batang", serif';
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillText(`점수 ${score}`, rx + 1, textY0 + 1);
  ctx.fillText(`레벨 ${lv}`, rx + 1, textY1 + 1);
  ctx.fillStyle = "#fdf6e3";
  ctx.fillText(`점수 ${score}`, rx, textY0);
  ctx.fillText(`레벨 ${lv}`, rx, textY1);
  ctx.restore();
}

function triggerGameOver() {
  if (gameState !== "playing") return;
  gameState = "gameover";
  stopLoop();
  stopMusic();
  activeTouches.clear();
  keys.left = false;
  keys.right = false;
  setTouchControlsVisible(false);

  const vic = document.getElementById("victory-overlay");
  if (vic) vic.classList.add("hidden");

  const overlay = document.getElementById("gameover-overlay");
  const scoreEl = document.getElementById("go-score");
  if (scoreEl) scoreEl.textContent = String(score);
  if (overlay) overlay.classList.remove("hidden");
}

function triggerVictory() {
  if (gameState !== "playing") return;
  gameState = "victory";
  stopLoop();
  stopMusic();
  activeTouches.clear();
  keys.left = false;
  keys.right = false;
  setTouchControlsVisible(false);

  const go = document.getElementById("gameover-overlay");
  if (go) go.classList.add("hidden");

  const overlay = document.getElementById("victory-overlay");
  const scoreEl = document.getElementById("vic-score");
  if (scoreEl) scoreEl.textContent = String(score);
  if (overlay) overlay.classList.remove("hidden");
}

function returnToMenu() {
  const go = document.getElementById("gameover-overlay");
  const vic = document.getElementById("victory-overlay");
  const menu = document.getElementById("menu");
  if (go) go.classList.add("hidden");
  if (vic) vic.classList.add("hidden");
  if (menu) menu.classList.remove("menu-hidden");
  gameState = "menu";
  setTouchControlsVisible(false);
  stopMusic();
}

function tick(nowMs) {
  if (!ctx) return;
  if (gameState !== "playing") {
    rafId = 0;
    return;
  }

  if (!lastTickMs) lastTickMs = nowMs;
  let dtMs = nowMs - lastTickMs;
  lastTickMs = nowMs;
  if (dtMs > MAX_FRAME_MS) dtMs = MAX_FRAME_MS;
  const dtSec = dtMs / 1000;

  updateHeartCooldown(dtSec);
  updateSpawners(dtSec);
  moveFallingItems(dtSec);
  updatePlayer(dtSec, dtMs);
  moveHearts(dtSec);
  updateHelperCameo(dtMs);

  resolveCollisions();
  if (health <= 0) {
    triggerGameOver();
    return;
  }
  resolveHeartPickups();
  removeOffScreenItems();

  if (score >= VICTORY_SCORE) {
    triggerVictory();
    return;
  }

  const level = levelFromScore(score);

  applyCanvasPixelStyle();
  assets.drawCover(ctx, "Bg_NunuHouse", LOGICAL_W, LOGICAL_H);
  drawAtmosphere(level);
  drawFloorStrip();
  if (level >= 8) {
    drawRainParticles(nowMs);
  }
  drawFallingItems();
  drawHelperCameo();
  drawHearts();
  drawPlayer();
  drawHud();

  rafId = requestAnimationFrame(tick);
}

function startLoop() {
  if (rafId) return;
  lastTickMs = 0;
  rafId = requestAnimationFrame(tick);
}

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  lastTickMs = 0;
}

function bindMenu() {
  const menu = document.getElementById("menu");
  const loadHint = document.getElementById("load-hint");
  const charRow = document.getElementById("char-row");
  const btnStart = document.getElementById("btn-start");
  const charBtns = document.querySelectorAll(".char-btn");

  if (!menu || !loadHint || !charRow || !btnStart) return;

  assets.loadAll(() => {
    loadHint.textContent = "곤충을 잡아 점수를 얻고, 거미는 피하세요.";
    charRow.hidden = false;
    btnStart.hidden = false;
    btnStart.disabled = false;
  });

  charBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = btn.getAttribute("data-char");
      if (c !== "hoon" && c !== "joon") return;
      selectedCharacter = c;
      charBtns.forEach((b) => {
        const on = b === btn;
        b.classList.toggle("selected", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    });
  });

  btnStart.addEventListener("click", () => {
    gameState = "playing";
    menu.classList.add("menu-hidden");
    keys.left = false;
    keys.right = false;
    activeTouches.clear();
    resetRun();
    setTouchControlsVisible(true);
    startMusic();
    startLoop();
  });
}

function bindGameOver() {
  const btn = document.getElementById("btn-go-menu");
  if (!btn) return;
  btn.addEventListener("click", () => {
    returnToMenu();
  });
}

function bindVictory() {
  const btn = document.getElementById("btn-vic-menu");
  if (!btn) return;
  btn.addEventListener("click", () => {
    returnToMenu();
  });
}

function init() {
  canvas = document.getElementById("game");
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  if (!ctx) return;

  const go = document.getElementById("gameover-overlay");
  if (go) go.classList.add("hidden");
  const vic = document.getElementById("victory-overlay");
  if (vic) vic.classList.add("hidden");

  syncCanvasBufferSize();
  resizeCanvasCss();
  window.addEventListener("resize", resizeCanvasCss);

  bindMenu();
  bindGameOver();
  bindVictory();
  bindCanvasTouch();
  bindTouchButtons();
  bindKeyboard();
  setTouchControlsVisible(false);
}

document.addEventListener("DOMContentLoaded", init);
