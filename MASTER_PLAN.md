# Haenggung-dong Survival — Master Plan (final)

**Source of truth:** Work follows this document **in phase order**. **In-game UI copy:** Korean. **Code, comments, variable names:** English.

**Deploy target:** Static site (e.g. **GitHub Pages**). Use **relative paths** for assets (`assets/...`). If the site is served from a subpath, set a single `BASE_PATH` (or `<base href>`) once and keep image URLs consistent.

---

## 1. Mandatory handoff after each phase

When a phase is **done**, **stop**. Do **not** start the next phase until the user confirms.

Use this prompt (adjust N):

> **Phase N 완료했습니다.** 로컬에서 동작 확인 후 **Git 커밋**을 만들어 주세요. 다음 단계로 진행해도 될까요? 진행 원하시면 **`proceed`**라고 답해 주세요.

---

## 2. Implementation order (dependencies)

| Order | Phase | Depends on | Outcome |
|------:|--------|------------|---------|
| 0 | Art prep | — | 10 player PNGs with alpha (optional before Phase 2 polish; Phase 1 may use fallbacks). |
| 1 | Shell + menu + bg | — | `index.html` / `style.css` / `game.js`, portrait canvas, AssetManager, menu, `nunuhouse` in play. |
| 2 | Player | 1 | Physics, jump, PC + touch strip, Hoon/Joon animation set. |
| 3 | Obstacles | 2 | Bugs, cats, AABB, health, score. |
| 4 | Helpers | 3 | Mom/Dad, parabolic hearts, heal. |
| 5 | Progression + atmosphere | 3–4 | Level cap 10, scaling, overlays, particles. |
| 6 | HUD + end states | 5 | Top HUD, Korean game over / clear, retry → **menu**. |

---

## 3. Non-negotiables

| Topic | Rule |
|--------|------|
| Pixel art | `ctx.imageSmoothingEnabled = false`; prefer **integer** CSS scale from logical size to screen; avoid non-integer CSS transforms on the game canvas. |
| Assets | Every image: **`onload`** and **`onerror`**. On error, draw **`fillRect`** using the **fallback size and color** from the manifest (Section 6). |
| Language | All player-facing strings (menu, HUD labels if any, game over, victory, buttons): **Korean**. |
| Genre | **똥피하기**-style tension: single-screen dodge; **one** falling bug type; **cats** on the ground only; **parents** throw **hearts** that restore HP. |

### 3.1 Pixel art identity and prepared artwork (read with Section 6–7)

Treat the product as a **pixel art** game end-to-end: **runtime** rules in the table above, and **source art** authored on a **pixel grid** (no soft-scaled “HD” sprites as the default look).

**Files already in the repo (`assets/`) — names to match in disk and code:**

| File | Role |
|------|------|
| **`nunuhouse.png`** | **Portrait background** (house / street). Ship as a **normal opaque** backdrop. Do **not** flatten it to “transparent” unless you intentionally split layers for parallax; it is **not** a character sheet. |
| **`mom.png`** | Mom helper → `Help_Mom` in the manifest. |
| **`daddy.png`** | Dad helper → `Help_Dad` in the manifest. |
| **`Hoon.png`** | **Composite sheet only:** **five** poses in **one** image (idle ×2 on the **top** row, run ×3 on the **bottom** row). Each cell includes **label / FILE text above** the sprite. **Not** used directly as final in-game frames until sliced. |
| **`Joon.png`** | Same **2 + 3** composite layout as `Hoon.png`. |

**Offline pipeline for Hoon/Joon (Phase 0 — required for correct pixel look):**

1. **Define boundaries** — At 100% zoom, place **integer-pixel** guides for the **2 + 3** grid on each sheet.
2. **Split into separate files** — Export **10** gameplay PNGs (5 per character) to **`assets/characters/`** with filenames from Section 6 (`hoon_idle1.png` … `joon_move3.png`).
3. **Transparency (character exports only)** — Remove checkerboard / matte **around the character**; save **RGBA** PNGs per frame. (**`nunuhouse.png`** stays the **opaque** scene; “transparent background” here means **sprite** backgrounds, not erasing the street.)  
4. **Crop (critical)** — For each cell, set the export rectangle’s **top** to **1–2 pixels above** the first row of **character pixels** (e.g. hair) so **no text** from the top of the sheet appears in the exported sprite.
5. **Feet baseline** — Keep a **consistent ground line** across all five frames per character to avoid vertical bob when animating.

Until Phase 0 is done, the game may draw **fallback `fillRect`** colours for missing `assets/characters/*.png` paths (Section 6).

---

## 4. Fixed layout and resolution (defaults)

These are **defaults**; tune in code but document changes in commits.

| Constant | Default | Notes |
|----------|---------|--------|
| Logical width `LOGICAL_W` | **360** | Single coordinate system for physics, UI layout math, and drawing. |
| Logical height `LOGICAL_H` | **640** | Portrait; matches common ~9:16 phones. |
| Control strip height ratio | **0.24**–**0.28** of `LOGICAL_H` (~154–179 px at 640) | Bottom band only: **left = move left**, **center = jump**, **right = move right**. **Hold** left/right while finger down. |
| Playfield | Area **above** the control strip | Player and ground logic stay **above** the strip so thumbs do not cover the avatar. |
| Ground line | One constant `GROUND_Y` (e.g. top of strip minus small margin) | Player feet align here when grounded. |
| Safe area | Optional CSS `padding: env(safe-area-inset-*)` on the **page wrapper** | Avoids notch overlap for title/HUD. |

**Resize rule:** Scale the **wrapper** so the logical canvas fits the viewport: `scale = floor(min(clientW / LOGICAL_W, clientH / LOGICAL_H))` (optionally cap `scale` max, e.g. 4). Set `canvas.style.width/height` to `LOGICAL_W * scale` × `LOGICAL_H * scale`. If using **devicePixelRatio**, set backing store size in whole pixels and reset transform each frame so art stays crisp.

---

## 5. Game states and win / lose

| State | Enter when | Notes |
|--------|------------|--------|
| `menu` | Page load; after **retry / 메인** from game over or victory | DOM overlay: title, 훈/준, **시작**. `selectedCharacter` default **`hoon`**. |
| `playing` | User taps **시작** | RAF loop updates simulation + draw. |
| `gameover` | `health <= 0` | Stop spawning / stop progression; show overlay. |
| `victory` | **`score >= 200`** | Equivalent to “cleared” high goal with `Level = min(10, floor(score / 20) + 1)` at max tier. |

**Copy (use as specified):**

- **Game over title:** `게임 오버 (Game Over)` — include a **retry** control (e.g. `다시 하기` or `재시도`) that returns to **`menu`** (not silent restart) so the player can change character unless you add a separate “바로 재도전” later.
- **Victory title:** `게임 클리어! 행궁동 정복!` — include **메인으로** or same retry pattern returning to **`menu`**.

---

## 6. Asset manifest (AssetManager)

**Paths:** Prefer `assets/<filename>` from repo root. **Every row:** register in code; implement `onload` / `onerror`; on error draw `fillRect` with **fallback width × height** and **fallback color** (destination size in **logical pixels** for gameplay consistency; if real image size differs, still use these fallbacks on error only).

| Asset ID | File name (under `assets/`) | Fallback size (W×H) | Fallback color | Role |
|----------|-----------------------------|---------------------|----------------|------|
| `Bg_NunuHouse` | `nunuhouse.png` | **360×640** (full logical rect) | `#87CEEB` | Background; scale image to **cover** full logical canvas. |
| `Hoon_Idle1` | `characters/hoon_idle1.png` | 50×50 | `blue` | Idle frame 1 |
| `Hoon_Idle2` | `characters/hoon_idle2.png` | 50×50 | `lightblue` | Idle frame 2 (blink) |
| `Hoon_Move1` | `characters/hoon_move1.png` | 50×50 | `darkblue` | Run frame 1 |
| `Hoon_Move2` | `characters/hoon_move2.png` | 50×50 | `blue` | Run frame 2 |
| `Hoon_Move3` | `characters/hoon_move3.png` | 50×50 | `lightblue` | Run frame 3 |
| `Joon_Idle1` | `characters/joon_idle1.png` | 50×50 | `green` | Idle frame 1 |
| `Joon_Idle2` | `characters/joon_idle2.png` | 50×50 | `lightgreen` | Idle frame 2 |
| `Joon_Move1` | `characters/joon_move1.png` | 50×50 | `darkgreen` | Run frame 1 |
| `Joon_Move2` | `characters/joon_move2.png` | 50×50 | `green` | Run frame 2 |
| `Joon_Move3` | `characters/joon_move3.png` | 50×50 | `lightgreen` | Run frame 3 |
| `Obs_Bug` | `obs_bug.png` | 32×32 | `brown` | Single falling insect |
| `Obs_Cat` | `obs_cat.png` | 40×32 | `orange` | Ground cat, horizontal run |
| `Help_Mom` | `mom.png` | 50×50 | `pink` | Mom helper |
| `Help_Dad` | `daddy.png` | 50×50 | `purple` | Dad helper |
| `Item_Heart` | `item_heart.png` | 20×20 | `red` | Thrown heart pickup |
| `UI_Heart` | `ui_heart.png` | 30×30 | `red` | HUD heart icon |

**Note:** See **§3.1** for the full story on **`nunuhouse.png`**, **`mom.png`**, **`daddy.png`**, and composite **`Hoon.png` / `Joon.png`**. Runtime paths for parents are `mom.png` and `daddy.png` at `assets/` root; player frames come from **`assets/characters/`** after Phase 0.

---

## 7. Art preprocessing (Phase 0) — checklist (details in §3.1)

1. **Grid:** Top row **2** cells (idle 1, idle 2); bottom row **3** cells (run 1–3); **integer** guides.
2. **Separate files:** Ten exports under **`assets/characters/`**; names match Section 6.
3. **Alpha on sprites:** Real **RGBA** per frame; **do not** make **`nunuhouse.png`** transparent unless you intend a layered sky pipeline.
4. **Crop:** Top of each export **1–2 px above** hair/head so **no FILE / label** text is visible.
5. **Feet baseline** aligned across the five frames per character.

---

## 8. Controls

| Platform | Binding |
|----------|---------|
| PC | **Left / Right Arrow** = horizontal move; **Space** = jump (edge-triggered: one jump per press unless you add coyote time later—keep Phase 2 simple). |
| Mobile | **Bottom strip** only: left third **hold** = move left; center third **tap** = jump; right third **hold** = move right. Optional **few px dead gaps** between thirds. |
| Scroll / zoom | On the canvas or game wrapper: `touch-action: none` (or `manipulation` where appropriate) and **`preventDefault`** on `touchstart`/`touchmove` listeners that drive the game **with `{ passive: false }`** where needed so the page does not scroll while playing. |

---

## 9. Player and animation (Phase 2)

- **Variables:** Horizontal velocity, vertical velocity, `onGround` flag, facing (optional; sprites face right by default—mirror with `scale(-1,1)` only if you add it).
- **Gravity:** Constant downward acceleration each frame; clamp max fall speed.
- **Jump:** Impulse upward when `onGround && jumpPressed`; clear jump press after consume.
- **Movement:** Left/right acceleration or max speed while key/touch active; optional light friction when no input.
- **Animation:**
  - **Idle:** alternate Idle1 / Idle2 on a timer (e.g. **~400–600 ms** per frame—tune for readability).
  - **Move:** cycle Move1 → Move2 → Move3 while horizontal speed ≠ 0 (e.g. **~80–120 ms** per frame depending on run speed).
- **Draw size:** After real slices exist, use **intrinsic image dimensions** (or a single `PLAYER_DRAW` scale) for draw and **hitbox**; fallbacks use manifest sizes until measured.

---

## 10. Obstacles and rules (Phase 3)

| Entity | Spawn | Motion | Score |
|--------|--------|--------|--------|
| **Bug** | Random **x** within playfield, **y** above top edge | Constant **vy** downward (positive in screen coords) | **+1 score** when it leaves the **bottom** of the playfield **without** hitting the player (safe miss). Remove entity when off-screen. |
| **Cat** | Random choice **left** or **right** edge; **y = ground** | Constant **vx** toward screen center | Same **+1** when it exits the **opposite** side without hitting. Remove when off-screen. |

- **Collision:** **Axis-aligned boxes (AABB)**. Use rectangles for player and each obstacle; on overlap: **health −= 1** (minimum 0), **remove that obstacle**, optional short invulnerability **not required** in v1.
- **Initial values:** `health = 5`, `healthMax = 5`, `score = 0` at run start.
- **Spawn timing:** Use a **timer** or accumulator (seconds between spawns); exact numbers tuned in Phase 5—Phase 3 can use fixed intervals.

---

## 11. Helpers and hearts (Phase 4)

- **Appear:** Mom or Dad **briefly** at **left or right** screen edge (use `Help_Mom` / `Help_Dad` art); then spawn **`Item_Heart`** from near the parent.
- **Throw:** Give the heart **initial velocity** (`vx` toward player’s **x** as a simple aim, `vy` negative/up); each frame apply **same gravity** as player (or slightly lower if it feels better). Remove heart if below ground or off-screen long enough.
- **Pickup:** AABB overlap with player → **health +1** clamped to **`healthMax`**, remove heart.
- **Balance:** Cooldown or random interval so hearts are **helpful but not spam**; exact numbers are tunable constants in code.

---

## 12. Level, difficulty, atmosphere (Phase 5)

- **Level formula:** `level = min(10, floor(score / 20) + 1)`.
- **Scaling (implement as functions of `level`):** Decrease **bug / cat spawn interval** toward a floor; increase **bug fall speed** and **cat run speed** toward ceilings. Use **clamp** so the game stays fair on small screens. Document chosen formula in a short comment in `game.js`.
- **Overlays (full-screen `fillRect` after bg, before entities or before HUD—pick one consistent order):**
  - Levels **1–3:** no overlay.
  - Levels **4–5:** **sunset** — e.g. `rgba(255, 140, 0, 0.15)`–`0.25` (tune).
  - Levels **6–7:** **night** — e.g. `rgba(0, 20, 60, 0.35)`–`0.5` over sunset or replace sunset.
  - Levels **8–10:** keep night overlay; add **simple white particles** (small rects or 2×2 px) drifting down (rain/snow); **no** extra shaders required.

---

## 13. HUD and end UI (Phase 6)

- **Layout (top of logical canvas):** e.g. **hearts** (repeat `UI_Heart` or fallback rects for current HP), **점수** + number, **레벨** + number. Keep within top **~8–12%** of height so the playfield stays clear.
- **Game over / victory:** Semi-transparent full-screen dim + Korean text (Section 5) + button(s) returning to **`menu`**; reset `score`, `health`, internal timers, and entity arrays on restart.

---

## 14. Phase deliverables (checklist)

### Phase 0 — Art

Execute **§3.1 / §7**: slice **`Hoon.png`** and **`Joon.png`** on the **2+3** grid; **1–2 px above hair** crop; **RGBA** per frame; **`assets/characters/`** outputs; feet baseline. **`nunuhouse`**, **`mom`**, **`daddy`** stay as provided (opaque bg; parents at root).

**Stop** → user commit + `proceed`.

### Phase 1 — Shell

Files `index.html`, `style.css`, `game.js`; logical canvas + integer scale + smoothing off; **AssetManager** for all manifest ids (missing files OK with fallbacks); **menu** (title font loaded from CDN e.g. Google Fonts **Gowun Batang** or **Nanum Myeongjo**); 훈/준 + **시작**; `playing` draws **`nunuhouse`** full frame.

**Stop** → ask.

### Phase 2 — Player

Physics + jump + ground; arrows + space; touch strip; animation rules (Section 9) keyed by `selectedCharacter`.

**Stop** → ask.

### Phase 3 — Survival

Bug + cat behavior and scoring (Section 10); AABB; game over when `health === 0` (full Phase 6 overlay can be minimal here: **stop loop + alert** is **not** acceptable—at least a simple Korean text + button in Phase 3 or defer full styling to Phase 6 while still **stopping** the game).

**Stop** → ask.

### Phase 4 — Hearts

Mom/Dad cameo + parabolic heart + pickup (Section 11).

**Stop** → ask.

### Phase 5 — Progression

Level formula + scaling + overlays + particles (Section 12).

**Stop** → ask.

### Phase 6 — Polish

HUD (Section 13); final game over / victory UI (Section 5); polish touch/keyboard focus; confirm GitHub Pages friendliness (Section header).

**Stop** → ask.

---

## 15. Game loop (all phases with RAF)

- Use **`requestAnimationFrame`**; compute **`deltaTime`** from timestamps clamped (e.g. max **32 ms** per step) to avoid spiral after tab backgrounding.
- **Order draw (suggested):** background image → atmosphere overlay → particles → obstacles → helpers/projectiles → player → HUD / modal overlays.

---

## 16. Minimal acceptance tests (per phase)

| Phase | Must pass |
|-------|-------------|
| 1 | Menu → 시작 → stable **nunuhouse**; no smoothing blur; resize window stays integer-snapped. |
| 2 | Jump only on ground; hold strip moves; PC keys work; idle/move cycles. |
| 3 | Hit loses HP and removes hazard; safe exit increments score; death stops game. |
| 4 | Heart increases HP up to 5 only. |
| 5 | At higher score, faster spawns / motion; overlays appear at right level bands. |
| 6 | Score **200** triggers victory copy; HUD readable; buttons return to **menu**. |

---

## 17. Summary

Single **MASTER_PLAN**: portrait **360×640**; **pixel art** in engine and in source; **repo art** (**`nunuhouse`**, **`mom`**, **`daddy`**, composite **`Hoon`/`Joon`** sheets) and **Phase 0** slice/alpha/**1–2 px top crop** pipeline (**§3.1**); **AssetManager manifest**; controls; physics/animation; obstacles and scoring; hearts; level and atmosphere; **victory at score ≥ 200**; Korean end copy; phased delivery with **mandatory stop + `proceed`** after each phase.
