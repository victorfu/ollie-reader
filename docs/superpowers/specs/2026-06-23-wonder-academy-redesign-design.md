# Wonder Academy Redesign — Cozy Collect-and-Raise Game

<metadata>
date: 2026-06-23
status: approved (design); pending implementation plan
supersedes: docs/superpowers/specs/2026-06-21-wonder-academy-rpg-design.md (gameplay direction only — art assets, audio, and the hardened persistence layer from that work are retained)
</metadata>

## 1. Summary & Positioning

Wonder Academy today is a thin turn-based exploration/bonding RPG rendered entirely on a Kaplay canvas. The player has one hard-coded starter (Lumi), walks a node map, and completes a single scripted "Mood Trial" to befriend one creature. Most systems (skills, snacks, leveling, team, evolution, additional creatures, chapter 2) are modeled in data but inert. There is one playable encounter (~5–10 minutes). The interaction is "fake buttons drawn on a canvas," which is the root of the poor handfeel.

This redesign keeps the art, audio, and save system, and **rebuilds the gameplay into a cozy collect-and-raise creature game**.

**One-line pitch:** You are a keeper at Sparkleaf Academy. You dispatch your cute Wonderlings on short expeditions into the glowing forest, befriend the creatures they encounter, raise them (level / evolve / skills), and fill your Wonderdex.

**Explicit positioning decisions (made with the user during brainstorming):**

- **Pure fun, not English learning.** The game is a relaxing "break" experience. It deliberately does **not** teach or gate on English content. (This removes the dissonance of a learning app containing a learning-free pet game — by making the "break game" role intentional.)
- **Keep the existing art & redo the gameplay.** Reuse the academy/forest backgrounds, the 4 starter portraits (Lumi/Momo/Pico/Nibi), creature portraits, and the 4 BGM tracks + SFX.
- **Core fun = collect + raise.** "The more you play, the richer it gets; you don't want to stop." This also honors the player's first instinct ("wasn't I supposed to choose a partner?").
- **Handfeel must be excellent.** The control layer moves off canvas to real React/DOM UI.
- **Hybrid rendering.** The player wants a "living, animated scene." So the UI is DOM, but a dedicated, isolated canvas component (reusing Kaplay) renders the living scene (creatures roaming the academy).

## 2. Goals & Non-Goals

**Goals**
- A complete, satisfying collect → raise → fill-the-dex loop that is fun in short sessions.
- Excellent handfeel: real buttons, hover/focus, responsive (mobile + desktop), accessible, design-system-consistent, smooth Framer Motion transitions.
- A "living home" academy scene where the player's creatures feel alive.
- Maximize reuse of existing art, audio, persistence, and the already-modeled data systems.
- Make adding a new creature trivial (drop in art + one data entry).

**Non-Goals**
- No English-learning integration.
- No combat/violence — bonding is emotional/harmonious, in keeping with the existing tone.
- No multiplayer, leaderboards, or monetization.
- No reliance on commissioning large amounts of new art for the MVP (use variants + growth stages to stretch existing art).
- Not a one-shot build — delivered in phases (see §11).

## 3. Core Loop

A single cycle is ~1–3 minutes and repeatable:

```
Dispatch a team to a forest destination
   → (short real-time expedition)
   → team returns with materials + XP + a chance of meeting a new creature
   → Befriend interaction adds the creature to the Wonderdex
   → Raise creatures (feed snacks · level up · evolve · equip skills)
   → unlock deeper forest / rarer creatures
   → dispatch again ↻
```

The home base (Academy) is a living scene where collected creatures roam; it is the emotional anchor of the collection.

## 4. Screens & Navigation

Five screens, all real React UI, switched via a bottom tab bar (mobile) / side rail (desktop), consistent with the app's macOS-HIG design system (DaisyUI + Tailwind tokens in `src/index.css`).

1. **Academy (Home)** — the living scene (Kaplay canvas) showing the active team/collection roaming; today's greeting; at-a-glance collection progress; entry to all other screens. DOM controls overlay the canvas.
2. **Expeditions** — choose a destination (existing map nodes), assign a 1–3 Wonderling team, and dispatch. Multiple expedition slots (start with 1, unlock more). Returning expeditions show a juicy results reveal.
3. **Befriend** — triggered when an expedition meets a new creature. The "read the creature → respond well" interaction. Success adds it to the Wonderdex. (Optional hybrid: the creature itself is rendered in a small canvas for liveliness; response buttons are DOM.)
4. **Nursery (Raise)** — feed snacks, level up, evolve (4 growth stages), equip skills, watch bond grow.
5. **Wonderdex** — the collection: seen / befriended / evolved states; region completion rewards; the "see them all" driver.

## 5. Fun Pillar 1 — The Befriend Interaction

Replaces the fixed-sequence Mood Trial (comfort → flash → snack → attune) with a **read-and-respond** micro-interaction (~15–30s). This is the main *active* fun.

**Mechanics**
- The wild creature emits **mood cues** (peeking out shyly, bouncing excitedly, stomach rumbling, curious approach…), shown via Framer Motion puppet animation (squash/stretch, bob), floating hearts, and SFX.
- The player has a small set of **response actions** (soothe / play / treat / gift / hum…).
- **Cue matches response** → Trust rises + happy reaction. **Mismatch** → Startle rises + flinch.
- Each species has a **temperament** (existing `personality` field) that biases which cues appear; the player "reads" the creature over a few rounds.
- **Trust meter** fills toward Befriended 🎉. **Startle meter** filling first means the creature flees — *gently* (it can be re-encountered later; no harsh punishment, in keeping with cozy tone).
- Bringing the creature's **favorite snack** (existing `favoriteSnack` field) grants a large trust boost → motivates collecting snacks on expeditions and scouting preferences.
- Rarer creatures (existing `rarity` field) → more rounds / pickier cues.

**Reuses:** `personality`, `favoriteSnack`, `rarity`, snacks inventory, SFX, portraits.

**Pure logic to unit-test:** cue generation (seeded), trust/startle resolution given (cue, response, temperament, snack), win/lose detection.

## 6. Fun Pillar 2 — Expeditions

The collect-and-raise engine; the *idle/return* rhythm.

**Mechanics**
- Each **destination** = an existing map node, with: theme, duration, a loot table (materials + which species can appear), recommended team level, and required/boosting field skills.
- Assign **1–3 Wonderlings**. Team level / element / skills affect outcomes: higher level → faster, better loot, higher rare-encounter chance.
- **Field skills** (existing `fieldSkillId`: light-trail / soft-float / secret-sense / crystal-push) unlock or boost specific destinations (e.g., secret-sense reveals hidden-burrow creatures). This finally gives field skills a purpose and rewards raising a *varied* roster.
- **Duration:** short real-time wait. Persist `startedAt` + `durationMs`; resolve completion by comparing wall-clock on load/return (single-player cozy game — no anti-cheat needed). Optional speed-up.
- **Slots:** start with 1, unlock more → the "run several, check back" satisfaction.
- **Return reveal:** materials tally + XP gained; the highlight "✨ Met a new creature!" hands off to the Befriend interaction.
- Deeper/rarer nodes unlock with progression (story pointer already modeled).

**Reuses:** map nodes, `fieldSkillId`, `keeperTeam` slots, snacks/materials, XP/level.

**Pure logic to unit-test:** expedition resolution (seeded loot/encounter rolls given team + destination), completion timing.

## 7. Progression & Collection

**Raising (per OwnedWonderling — fields already exist)**
- **Level up:** XP from expeditions (and befriending). Raises stats; unlocks skill slots.
- **Evolve:** at level thresholds + materials, advance through the existing 4 `growthStages`. Evolution = visual upgrade + power; a major collection/satisfaction beat.
- **Skills:** existing `learnableSkillIds` / `equippedSkillIds` / `skillLoadouts`. Unlock on level, equip a limited set; skills matter for expeditions (field skills) and befriending (some responses).
- **Bond:** rises from feeding favorite snacks and taking the creature on expeditions; high bond gives bonuses + cute interactions (cozy layer).

**Currencies / materials (intentionally minimal)**
- One soft currency (e.g., "Stardust") + a few evolution material types.
- Map onto existing fields: `snacks` (snack inventory), `charms` / `careerLevels` reusable; add a small `materials` inventory if needed. No complex economy.

**Collection / Wonderdex**
- Shows all discoverable species with states: unseen / seen / befriended / evolved (extends the existing `wonderdex` status enum).
- Region completion → rewards → drives "see them all."

**The art-breadth constraint (honest)**
Only ~6 creature portraits exist today (4 starters + Mossmew + Sparkleaf Fawn). A "collect many" game needs breadth. Strategy — **build to scale + stretch existing art**, *not* a big art commission for MVP:
1. **Scale-ready architecture:** adding a creature = drop in art + one data entry.
2. **Variants multiply collection from few base designs:** 4 growth-stage forms each count as a dex entry; color/element variants (shiny / seasonal palettes via tinting — no redraw); rarity tiers. ~6 base designs → 20+ dex slots with no new drawing.
3. **(Optional, later)** the user adds/generates new portraits; the system integrates them.

## 8. Living Scene (Hybrid Rendering)

The player wants a living, animated scene; this is where a canvas/game engine genuinely earns its keep (many moving sprites, ambient motion), so **Kaplay is retained but re-scoped** from "the whole game" to "the living scene component."

```
┌─────────────────────────────────────────────┐
│  React / DOM + Framer Motion (control layer)  │
│  buttons, lists, cards, menus, team assign,   │
│  befriend responses, nursery, dex …           │
│   ┌─────────────────────────────────────┐     │
│   │  Kaplay canvas (living-scene layer)   │     │
│   │  creatures roam the academy hall,     │     │
│   │  idle bob/hop, tap → cute reaction    │     │
│   └─────────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

- **All controls stay in DOM** → handfeel fixed at the root (real buttons, hover/focus, RWD, a11y, design system).
- **Kaplay renders only the ambient scene**, embedded inside a DOM screen, reusing the existing `kaplayLifecycle` helper. Clean boundary — no return to full-canvas fake buttons.
- **No spritesheets required:** single-portrait "puppet" animation (move + squash + hop), as the current floating portraits already do; fits existing art. Richer frame animation is a later art investment.
- **Placement:** primary living scene = the Academy hall (creatures roam, tap to pet). MVP ships a *basic* living hall (active team roams + tap reaction). Phase 2+: whole collection roams, day/night, parallax, ambient reactions; optionally an animated forest expedition scene and a lively creature in the Befriend screen.
- **CJK note:** any in-canvas text must pass a CSS font-family (PingFang TC / Noto Sans TC stack) to avoid tofu glyphs (known Kaplay limitation). Prefer keeping text in the DOM layer; the canvas should be mostly text-free.

## 9. Technical Architecture

**Keep (the working, valuable parts)**
- `services/wonderAcademyProgressService.ts` + `wonderAcademyPersistence.ts` — hardened cloud/local save sync; operates on the progress blob, reused as-is.
- `wonderAcademyAudio.ts` — music/SFX manager; wired to the new UI.
- `data/wonderAcademyData.ts` + `types/wonderAcademy.ts` — content data + schema; retained and extended.

**Replace (the handfeel root cause)**
- `wonderAcademyGame.ts` (1083-line full Kaplay UI) → removed as the UI. Its role shrinks to a small living-scene canvas module.
- `WonderAcademyHost.tsx` (canvas host) → removed/repurposed into the living-scene wrapper.
- Creature/UI animation → Framer Motion + CSS in the DOM.

**Add (new structure, following CLAUDE.md conventions: Context/hooks, PascalCase components, camelCase utils, 2-space, strict TS)**
- `WonderAcademyPage.tsx` — slimmed to the auth / load / save shell.
- `useWonderAcademyGame.ts` (hook) — state + dispatch + expedition timers (timestamp-based; resolve on load).
- `screens/`: `HubScreen`, `ExpeditionScreen`, `BefriendScreen`, `NurseryScreen`, `WonderdexScreen`.
- `components/`: `WonderlingCard`, `TeamPicker`, `ExpeditionSlot`, `TrustMeter`, `CreatureSprite`, `LivingScene` (Kaplay wrapper), etc.
- **Logic split by domain into pure, testable modules** (befriend / expedition / progression / dex), replacing the 596-line catch-all `wonderAcademyLogic.ts`. Reducer pattern retained; action set redesigned for the new loop.

**State management**
- Reducer (`applyWonderAcademyAction`) + a context/hook holding state and dispatch, per the app's "Context API for global state, custom hooks for business logic" convention.
- Expeditions stored as `{ destinationId, teamOwnedIds, startedAt, durationMs, status }`; completion computed from wall-clock; resolved on load/return.

**Testing:** vitest (project runner). Pure logic (expedition resolution, befriend trust calc, leveling/evolution, dex completion) developed with TDD. Existing persistence tests retained.

**Routing/entry:** unchanged from today.

## 10. Data Model Changes

The existing `WonderAcademyProgress` already models most of what we need (`ownedWonderlings`, `wonderdex`, `keeperTeam`, `skillLoadouts`, `snacks`, `charms`, `careerLevels`, audio/accessibility settings). Changes:

- **Bump `schemaVersion`** (1 → 2) and **reset old saves** (no migration). Rationale: the game is early and the only player is the developer; the new shape diverges enough that a migration is not worth the risk/cost. The save *machinery* is unchanged — only the blob shape it carries.
- **Add** an `expeditions` array (active/queued expedition slots, as above) and `expeditionSlots` count.
- **Add** a `materials: Record<string, number>` inventory (or reuse `charms`/`careerLevels` if a clean fit emerges during planning).
- **Extend** the `wonderdex` value enum to represent stage/variant collection states (e.g., per-stage seen/owned), or add a parallel `wonderdexVariants` map — exact shape decided in the implementation plan.
- **Repurpose** currently-inert fields (`fieldSkillId`, `growthStages`, `learnableSkillIds`, `favoriteSnack`, `rarity`, `personality`) into live mechanics per §5–§7.
- Starter-selection UI (Lumi/Momo/Pico/Nibi) replaces the temporary hard-coded "Start with Lumi" screen, honoring the original "choose your first partner" objective.

## 11. Phasing

Each phase ships something playable; build the fun core first, then add depth.

**Phase 1 — MVP: the core loop feels good (vertical slice)**
- React UI shell + navigation + DaisyUI/Framer Motion; Kaplay removed as UI; new schema + reset + reused persistence.
- **Starter selection** (4 starters) replacing the placeholder.
- **Expeditions:** 2–3 destinations, team assignment, short real-time timer, returns with materials/XP/encounter chance.
- **Befriend:** the read-and-respond interaction with trust/startle + favorite-snack bonus.
- **Nursery:** feed snacks, level up, basic bond.
- **Wonderdex:** seen/befriended states + collection overview.
- **Basic living Academy hall** (active team roams + tap reaction) — delivers the requested "living scene" feel.
- Existing ~6 creatures; pure logic covered by vitest.
- → A complete little game: collect (expeditions + befriend) → raise (level/feed) → fill dex.

**Phase 2 — depth & juice**
- Evolution (4 growth stages) + evolution animation; skills (unlock/equip; field skills gating expeditions); color/element variants (shiny) to expand collection; more expedition slots / deeper nodes / rarity tiers / loot tables; dex completion rewards; richer living scene (whole collection roaming, day/night, parallax).

**Phase 3 — content & polish (ongoing)**
- More creatures (drop-in art); regions beyond Sparkleaf Grove; charms/career systems; daily rhythm; audio polish; accessibility + reduced-motion pass; optional animated forest/befriend canvases.

## 12. Risks & Open Questions

- **Art breadth** is the main risk to "collect many" feeling rich; mitigated by variants/stages (§7), revisited as the roster grows.
- **Real-time expedition durations** need tuning for a break game (short enough to be satisfying, long enough to create a check-back rhythm); exact values decided in implementation/playtesting.
- **Materials/economy shape** (new `materials` vs reusing `charms`/`careerLevels`) finalized in the implementation plan.
- **Wonderdex variant representation** (extended enum vs parallel map) finalized in the implementation plan.
- **Living-scene scope creep** — keep MVP's scene basic (team roam + tap); resist adding day/night/parallax until Phase 2.

## 13. Decision Log (from brainstorming)

| Decision | Choice |
|---|---|
| Role in the app | Pure fun "break" game; **no** English-learning tie-in |
| Art & world | Keep existing art/audio; redo gameplay |
| Core fun | Collect + raise |
| Gameplay direction | A — dispatch/expedition collector |
| Handfeel fix | Control layer → React/DOM + Framer Motion |
| Living scene | Yes — hybrid; Kaplay re-scoped to a living-scene canvas |
| Save migration | Reset (bump schemaVersion); no migration |
| Kaplay | Retained only for the living-scene component |
