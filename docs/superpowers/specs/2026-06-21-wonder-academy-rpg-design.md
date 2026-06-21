# Wonder Academy RPG Design

Date: 2026-06-21

## Status

Approved for design documentation. This spec replaces the current academy battle prototype direction with a full cute companion-collection RPG world. It is a design document only; implementation planning comes next.

## Design Goals

- Build a real RPG world, not a small demo.
- Keep the game friendly, cute, warm, and collectible while still having RPG depth.
- Avoid monster terminology. The collectible beings are called **Wonderlings**.
- Let the player choose and nickname their starter.
- Support long-term expansion across multiple chapters, regions, skills, careers, and collections.
- Keep built-in assets original. The game may support local custom guest slots, but the repo must not include recognizable third-party IP assets or names.

## Core Vocabulary

| Concept | In-game term |
| --- | --- |
| Game | Wonder Academy |
| Player role | Wonder Keeper |
| Collectible beings | Wonderlings |
| Collection book | Wonderdex |
| Building a connection | Attune |
| Battle/challenge | Mood Trial |
| Player party | Keeper Team |
| Region boss | Warden |
| Legendary beings | Mythlings |
| Custom local character slot | Guest Wonderling Slot |

## Premise

Wonder Academy is a floating academy connected to many cozy regions: glowing forests, glassy coasts, clocktower dorms, cloud markets, snowy villages, dream festivals, star trains, and the Crystal Bell Tower.

The player is a new Wonder Keeper. On the first school day, the Crystal Bell loses its voice. The bell normally keeps the academy and Wonderlings emotionally in tune. Without it, Wardens and Wonderlings become anxious, guarded, shy, or lost. They are not enemies; they need help being understood.

The player chooses one starter Wonderling, gives it a nickname, and travels with teachers, classmates, and their Keeper Team to recover the Bell Tones held across the world.

## Tone

- Warm, playful, and emotionally safe.
- Cute first, strategic second, but not shallow.
- Conflict comes from misunderstanding, anxiety, loneliness, lost memories, and broken trust.
- A Mood Trial should feel like calming, understanding, and connecting, not defeating.
- The story can have mystery, but it should stay suitable for parent-child play.

## Starter System

The game begins with four starter Wonderlings. Each can be renamed by the player.

Stored identity:

- `speciesName`: fixed species label, such as `Lumi`.
- `nickname`: player-entered name.
- `displayName`: nickname if present, otherwise species name.

### Lumi

- Species: starlight fox
- Elements: Light / Spark
- Roles: Striker / Trickster
- Personality: clever, impatient, eager to prove itself
- Playstyle: fast turns, timing interactions, high pressure, Attune support through dazzling effects
- Field Skill: **Light Trail**, reveals hidden paths and stardust items

Bond forms:

- Lumi
- Lumi Tailglow
- Lumi Prismtail
- Lumi Aurorafox

Signature skills:

- Tiny Flash
- Zip Spark
- Wink Feint
- Starstep Dash
- Bond Skill: Aurora Parade

### Momo

- Species: cloud kitten
- Elements: Dream / Tide
- Roles: Healer / Guardian
- Personality: sleepy, gentle, slow to react, dependable when needed
- Playstyle: high safety, shields, healing, better tolerance for mistakes
- Field Skill: **Soft Float**, crosses gaps and reaches cloud platforms

Bond forms:

- Momo
- Momo Rainpuff
- Momo Mooncloud
- Momo Dreamnimbus

Signature skills:

- Bubble Pat
- Cozy Shield
- Nap Song
- Moon Drizzle
- Bond Skill: Dreamcloud Haven

### Pico

- Species: stardust fairy
- Elements: Star / Leaf
- Roles: Trickster / Healer / Scout
- Personality: curious, playful, mischievous, great at finding secrets
- Playstyle: exploration, Attune bonuses, hidden routes, support and status effects
- Field Skill: **Secret Sense**, finds hidden Wonderlings, chests, and side-paths

Bond forms:

- Pico
- Pico Budspark
- Pico Wishpetal
- Pico Celestibloom

Signature skills:

- Leaf Wink
- Stardust Peek
- Clover Patch
- Secret Signal
- Bond Skill: Wishbloom Spiral

### Nibi

- Species: mini dragon
- Elements: Ember / Crystal
- Roles: Guardian / Striker
- Personality: brave, proud, secretly afraid of being alone
- Playstyle: durable, strong in Warden trials, counterattacks, obstacle breaking
- Field Skill: **Crystal Push**, opens stone gates and clears crystal barriers

Bond forms:

- Nibi
- Nibi Pebblehorn
- Nibi Embercrest
- Nibi Hearthdrake

Signature skills:

- Warm Puff
- Crystal Brace
- Brave Bump
- Hearth Guard
- Bond Skill: Hearth Crystal Roar

## Main Cast

### Professor Bellwyn

The academy head. Bellwyn protects the Crystal Bell tradition and knows more than they initially reveal. They are cautious because they witnessed a past Keeper's failure.

### Keeper Mira

The new-student mentor. Mira teaches the first systems: starter selection, Wonderdex, Keeper Team, and safe Mood Trials.

### Chef Pippa

Snack workshop teacher. Pippa teaches recipes used for recovery, Attune bonuses, special encounters, and Warden quests.

### Inventor Tink

Workshop teacher. Tink introduces charms, gadgets, field tools, hidden paths, and region mechanisms.

### Ranger Rowan

Field teacher. Rowan teaches tracking, rare encounters, Warden ecology, and exploration safety.

### Archivist Lune

Library teacher. Lune manages Bell Pages, Wonderdex lore, and Crystal Bell history.

### Kiki

The player's friendly rival and classmate. Kiki is not a villain. She tests the player with recurring Mood Trials and learns that a strong team is not only about winning quickly.

### The First Keeper

A historical figure, not a present-day villain. Their attempt to control the Crystal Bell caused lasting harm and made Bellheart distrust Keepers.

### The Silent Bellheart

The final Warden and heart of the Crystal Bell. The final conflict is to restore trust through Attune, not to destroy it.

## Player Careers

The player starts as a **Wonder Keeper Trainee**. A career unlocks after the early chapters. Careers can be switched at the academy, but each career has its own level.

### Chef Keeper

- Core: snacks, recovery, Attune
- Passive: snack effects improve
- Battle Support: share a snack for team recovery
- Field: cook special snacks that attract specific Wonderlings
- Progression source: recipes, snack use, snack-based Attune

### Inventor Keeper

- Core: charms, tools, mechanisms
- Passive: charm effects improve
- Battle Support: deploy a gadget for shield or disruption
- Field: repair bridges, open devices, detect hidden items
- Progression source: gadgets, charms, mechanisms

### Ranger Keeper

- Core: encounters, tracking, rare Wonderlings
- Passive: rare encounter rate improves
- Battle Support: scout weakness and suggested actions
- Field: follow tracks and cross natural obstacles
- Progression source: exploration, rare discoveries, region tasks

### Performer Keeper

- Core: interaction success, combos, Mood Trial performance
- Passive: timing and rhythm windows become slightly more forgiving
- Battle Support: encore part of the last successful skill
- Field: festival performances and music mechanisms
- Progression source: high grades on interactions

### Archivist Keeper

- Core: lore, Wonderdex, weaknesses, hidden quests
- Passive: Wonderdex entries show richer clues
- Battle Support: reveal favorite snack or Attune condition
- Field: read ancient notes and unlock legend quests
- Progression source: Wonderdex completion and lore quests

Each career has 10 levels:

- Lv.1 passive
- Lv.2 first battle support
- Lv.3 field skill
- Lv.4 passive upgrade
- Lv.5 second battle support
- Lv.6 special craft, encounter, or lore mechanic
- Lv.7 team bonus
- Lv.8 advanced field shortcut
- Lv.9 career quest reward
- Lv.10 Master Keeper skill

## World Structure

Wonder Academy is the central hub. Each chapter is a region with 6-10 nodes, side paths, encounters, quests, hidden conditions, and a Warden.

### Prologue: First Bell Day

- Region: Wonder Academy
- Purpose: character setup, starter choice, nickname, first Mood Trial
- Unlocks: Wonderdex, Keeper Team, Sparkleaf Grove

### Chapter 1: Sparkleaf Grove

- Theme: glowing forest, first Attune, fear of change
- Warden: Sparkleaf Fawn
- New systems: Attune, element basics, starter field skill

### Chapter 2: Tideglass Coast

- Theme: glass coast, tide caves, messages in bottles, wanting to be heard
- Warden: Pearlwhisker Seal
- New systems: snack crafting, tide terrain, stronger Healer roles

### Chapter 3: Clocktower Dorms

- Theme: dorms, clocktower, academy night, fear of mistakes
- Warden: Clockbell Tanuki
- New systems: puzzles, team switching, career choice

### Chapter 4: Sugarcloud Market

- Theme: cloud market, sharing, competition, cozy festivals
- Warden: Marshmallow Maestro
- New systems: recipes, trading, Festival Wonderlings, minigames

### Chapter 5: Snowbell Ridge

- Theme: snow village, loneliness, protection
- Warden: Aurora Alpaca
- New systems: Guardian roles, cold conditions, team endurance

### Chapter 6: Dreamcloud Festival

- Theme: dream festival, wishes, memory, loss
- Warden: Pillowmoon Ram
- New systems: Dream element, character wish quests, branching dream routes

### Chapter 7: Starrail Observatory

- Theme: star train, observatory, truth, memory
- Warden: Comet Kitsune
- New systems: Light / Star expansion, Mythling clues, Crystal Bell truth

### Final Chapter: Crystal Bell Tower

- Theme: trust, all elements, Bell Tone restoration
- Final Warden: The Silent Bellheart
- New systems: multi-team trials, final Bond Skills, ending choice

### Postgame: Wonder Keeper Trials

- Theme: mastery and collection
- Content: Warden rematches, Mythlings, rare variants, challenge tower, rotating festivals

## Hub Areas

### Dorm Room

Manage starter nickname, Keeper Team, cosmetics, and save identity.

### Wonderdex Hall

Browse seen and Attuned Wonderlings by region, category, rarity, and element.

### Snack Workshop

Cook snacks that restore Mood, improve Attune chances, or trigger special encounters.

### Training Garden

Practice Mood Trial interactions without losing progress.

### Charm Workshop

Craft and equip charms that modify exploration or Mood Trial behavior.

### Map Atrium

Choose the next region, revisit completed regions, or view chapter progress.

## Wonderlings

The full game targets roughly 100-130 Wonderlings.

Rarity:

- Common
- Uncommon
- Rare
- Warden
- Mythling

Encounter types:

- Normal node encounter
- Rare condition encounter
- Snack-attracted encounter
- Field-skill encounter
- Quest encounter
- Postgame variant

### Region Distribution

#### Wonder Academy

- Starter: Lumi, Momo, Pico, Nibi
- Common academy Wonderlings: Notebook Chirp, Teacup Foxlet, Backpack Bun, Inkdrop Cat, Nap Pillow Cub

#### Sparkleaf Grove

- Common: Mossmew, Berrybun, Acorn Pup, Fern Ferret, Pebble Turtle, Pip Puff
- Rare: Teacup Foxlet, Lantern Mothlet, Cloudmop Lamb
- Quest: Bookmark Bird, Firefly Sprite
- Warden: Sparkleaf Fawn

#### Tideglass Coast

- Common: Dewdrop Seal, Shellmouse, Bubble Pup, Coral Kit, Drift Duck, Pearl Pika
- Rare: Jellydream, Moonpool Otter, Glassfin Ray
- Quest: Bottlepost Crab, Lullaby Conch
- Warden: Pearlwhisker Seal

#### Clocktower Dorms

- Common: Ticktock Tanuki, Blanket Bat, Pencil Hedgehog, Bookmark Bird, Slipper Mouse
- Rare: Musicbox Rabbit, Keyhole Kitten, Midnight Marmot
- Quest: Inkdrop Cat, Star Eraser Sprite
- Warden: Clockbell Tanuki

#### Sugarcloud Market

- Common: Pudding Penguin, Waffle Bear, Cookie Pup, Strawberry Bun, Milk Tea Otter
- Rare: Marshmallow Cat, Candyfloss Lamb, Jellyfish Jelly
- Quest: Ribbon Rabbit, Festival Firebird
- Warden: Marshmallow Maestro

#### Snowbell Ridge

- Common: Snowflake Fox, Bell Alpaca, Mittens Mole, Frost Puffin, Cocoa Cub
- Rare: Aurora Deerling, Snowglobe Turtle, Icicle Ferret
- Quest: Lost Sleigh Pup, Warm Lantern Sprite
- Warden: Aurora Alpaca

#### Dreamcloud Festival

- Common: Pillowcloud, Sleepcap Sheep, Dream Bubble Jelly, Nightlight Bat, Planet Hamster
- Rare: Moonshadow Otter, Wishmoth, Drowsy Dragonette
- Quest: Memory Lamb, Wish Ticket Sprite
- Warden: Pillowmoon Ram

#### Starrail Observatory

- Common: Comet Cub, Starglass Finch, Orbit Mouse, Telescope Turtle, Nebula Kit
- Rare: Comet Kitsune, Meteor Pony, Prism Lynx
- Quest: Old Map Sprite, Constellation Fawn
- Warden: Comet Kitsune

#### Crystal Bell Tower

- Common: Crystal Mew, Bell Sprite, Echo Cub, Prism Pup, Silent Finch
- Rare: First Bell Fawn, Luminara Kit, Hearthscale Dragon
- Quest: Lost Keeper's Companion, Bellshard Sprite
- Final Warden: The Silent Bellheart

#### Postgame Mythlings

- Aurora Whale
- Dreamrail Dragon
- Starlight Kirin
- Sugarcloud Phoenix
- Crystal Moonhare
- First Keeper's Companion

## Wonderling Data Model

Each species should support:

- `speciesId`
- `speciesName`
- `category`
- `rarity`
- `elements`
- `roles`
- `regionIds`
- `favoriteSnack`
- `personality`
- `fieldSkillId`
- `learnableSkillIds`
- `attuneCondition`
- `growthStages`
- `artPrompt`
- `silhouetteAsset`
- `portraitAsset`
- `spriteAsset`

Owned Wonderlings should support:

- `ownedId`
- `speciesId`
- `nickname`
- `level`
- `xp`
- `bond`
- `moodMax`
- `equippedSkillIds`
- `unlockedSkillIds`
- `attunedAt`
- `currentGrowthStage`

## Elements

The full game uses eight elements:

- Spark: speed, chain actions, disruption
- Tide: recovery, shields, rhythm control
- Leaf: calming, over-time effects, Attune support
- Light: support, accuracy, cleanse
- Dream: sleep, confusion, strange interactions
- Ember: high output, courage, obstacle breaking
- Crystal: defense, counter, stability
- Star: rare element, Bond, Mythlings, late-game power

Basic triangle:

- Spark beats Tide
- Tide beats Leaf
- Leaf beats Spark

Advanced relationships:

- Light stabilizes Dream
- Dream disrupts Crystal
- Crystal resists Ember
- Ember pressures Leaf
- Star does not hard-counter everything, but it improves Bond and late-game synergy

Advantage should be helpful, not punishing:

- Advantage adds +1 or +2 Mood Shift.
- Disadvantage reduces effect, but skills still do at least 1 useful point.
- Same-element connection can improve Attune or Bond growth.

## Roles

- Striker: large Mood Shift and pressure
- Guardian: shields, protection, counterplay
- Healer: Team Mood recovery and status cleanse
- Trickster: status effects, Attune odds, control
- Scout: rare encounters, first action, hidden clues
- Performer: interaction windows, combo bonuses, rhythm skills

## Mood Trial

Mood Trial is the core challenge system. It replaces combat language.

### Mood States

Opponent Wonderlings can move through:

- Upset
- Guarded
- Curious
- Calm
- Open

The player's team has Team Mood. If Team Mood reaches zero, there is no hard game over. The player returns to the previous safe node, keeps story progress, and receives a hint.

### Turn Flow

1. Choose active Wonderling.
2. Choose action: Comfort, Skill, Snack, Switch, Attune, Leave.
3. If using a skill, play a short interaction.
4. Resolve Mood Shift, recovery, status, and Bond effects.
5. Opponent responds.
6. If opponent is in Attune range, the player can attempt Attune.

### Main Actions

- Comfort: safe low-risk calming action.
- Skill: opens the equipped skills menu.
- Snack: uses a snack for healing, Attune bonuses, or special conditions.
- Switch: swaps the active Wonderling; usually consumes the turn.
- Attune: attempts connection when conditions are met.
- Leave: exits non-story trials when allowed.

### Skill Loadout

Each Wonderling can learn many skills but equips four for Mood Trials.

Skill classes:

- Basic Skill
- Element Skill
- Role Skill
- Bond Skill
- Field Skill

### Interaction Types

- Tap Timing: tap when a light reaches a target.
- Hold Release: hold and release in a safe zone.
- Pattern Match: repeat a short 2-4 symbol pattern.
- Shield Tap: tap shield during response to reduce Mood loss.
- Card Pick: choose between three hidden cards.
- Rhythm Tap: tap a short rhythm sequence.

### Positive Status

- Inspired: next skill improves by 1.
- Shielded: next Mood loss reduced.
- Focused: interaction success window grows.
- Bonded: Bond Skill becomes available.
- Lucky: Attune chance improves.

### Negative Status

- Rattled: skill effect reduced.
- Sleepy: may skip action, but easier to Attune.
- Soggy: Spark weakens, Tide improves.
- Tangled: Switch becomes limited.
- Shy: Attune chance drops, Comfort improves.

## Attune

Attune replaces capture.

Normal Wonderlings:

- Require opponent Mood to be low enough or in a Calm/Open state.
- Can be influenced by snacks, roles, career, status, and Wonderdex clues.
- Should feel exciting but not cruelly random.

Wardens:

- Do not use normal random Attune.
- Join the Wonderdex through story completion.
- May unlock a Warden Support ability or region blessing.

Mythlings:

- Require postgame quests, rare conditions, or multi-region story chains.

## Team And Growth

Keeper Team:

- Up to 6 Wonderlings.
- Mood Trial uses 1 active Wonderling and 2 support slots.
- Remaining 3 are reserve.

Support slots grant passives:

- Guardian support: Team Mood or damage reduction.
- Healer support: periodic small recovery.
- Trickster support: Attune chance.
- Scout support: rare hints or first action.
- Performer support: interaction bonus.
- Striker support: extra effect at defensive cost.

Growth:

- Wonderlings have level, XP, Bond, growth stage, skills, mood max, and role scaling.
- Starters use Bond Forms instead of becoming unrecognizable.
- Chapter progression should unlock deeper systems gradually.

## Wonderdex

Wonderdex should be a major collection screen.

States:

- Unknown silhouette
- Seen
- Attuned
- Variant found
- Warden recorded
- Mythling recorded

Attuned entries show:

- Portrait
- Region
- Rarity
- Element
- Roles
- Favorite snack
- Personality note
- Field skill
- Learnable skills
- Attune condition hint
- Growth forms

## Guest Wonderling Slots

The game can support local custom slots without bundling third-party IP:

- A guest slot has a local image path or imported file.
- A guest slot has a user-provided name.
- Guest slots map to existing elements, roles, and stats.
- Guest assets are not generated, committed, or distributed by the repo.
- The built-in game remains fully playable with original Wonderlings.

## Screens

### Title / Continue

- New game
- Continue
- Settings
- Shows starter, Keeper Level, Wonderdex progress, and story chapter when a save exists

### Starter Selection

- Shows four starters with art, role, element, playstyle, and personality.
- Lets the player enter a nickname.
- Confirms before starting the journey.

### Academy Hub

- Room-like navigation, not a marketing page.
- Access to Wonderdex, Team, Snack Workshop, Training Garden, Charm Workshop, and Map Atrium.

### Region Map

- Chapter map with 6-10 nodes.
- Shows main route, optional side nodes, locked conditions, Warden node, and revisit progress.

### Mood Trial

- Canvas-first play area.
- Opponent Wonderling and mood state at top.
- Active Wonderling and Team Mood at bottom.
- Action menu: Comfort, Skills, Snack, Switch, Attune, Leave.
- Skills sub-menu shows four equipped skills.
- Center area handles short interactions.

### Team / Growth

- Keeper Team of 6.
- Active/support/reserve assignment.
- Nickname editing.
- Skill loadout.
- Bond and growth form progress.

### Wonderdex

- Filters by region, element, rarity, and state.
- Silhouettes for unknown entries.
- Full details for Attuned entries.

### Quest Log

- Main story
- Region quests
- Career quests
- Warden notes
- Mythling clues

## Save Data

Use localStorage initially, with a structure that can later migrate to a richer storage layer.

Save should include:

- schema version
- player name if added later
- starter species and nickname
- story progress
- unlocked regions and nodes
- completed quests
- owned Wonderlings
- Wonderdex seen and Attuned states
- Keeper Team setup
- skill loadouts
- snacks and charms
- career levels
- settings

Storage helpers should parse defensively and tolerate malformed or older saves.

## Route And Current Game Replacement

The current route can be replaced by a new standalone game route:

- Preferred route: `/games/wonder-academy`
- The current `/games/monster-academy` route can redirect or be removed during implementation.
- The game should remain standalone and not inherit the main app layout.
- The GameHub card should open Wonder Academy in a new tab, matching the current standalone game behavior.

## Assets

Built-in assets must be original.

Asset families:

- Starter portraits and sprites
- Starter Bond Form portraits and sprites
- Wonderling portraits, sprites, and silhouettes
- Warden full art
- Region backgrounds
- Academy hub rooms
- UI icons
- Skill VFX icons
- Snack icons
- Charm icons

Asset requirements:

- PNG assets generated with Codex GPT-Image-2.
- No ImageGen API key workflow.
- No programmatically generated SVG character art.
- No recognizable third-party IP as built-in assets.
- Use consistent art direction: cozy, rounded, painterly-cute, bright but not noisy.
- Optimize large assets before committing to avoid oversized PWA precache output.

## Implementation Milestones

This spec defines the full world. Implementation can be split without shrinking the world design.

1. Foundation
   - Rename game concept to Wonder Academy.
   - Add core data model.
   - Add title/continue and starter selection with nickname.

2. Academy Hub
   - Build standalone full-screen hub.
   - Add Team, Wonderdex, and Map Atrium shells.

3. Mood Trial v2
   - Replace current battle actions with Mood Trial actions.
   - Add Skills sub-menu, equipped skills, interactions, Mood states, and Attune.

4. Chapter 1: Sparkleaf Grove
   - Region map nodes.
   - Encounter tables.
   - First Wonderlings and Sparkleaf Fawn Warden.

5. Growth Systems
   - XP, level, Bond, Bond Form progress, skill unlocks, loadouts.
   - Basic snacks and charms.

6. Polish And Save
   - Save/load.
   - Browser smoke tests.
   - Mobile layout checks.
   - Route cleanup checks.

7. Expansion Chapters
   - Tideglass Coast onward using the same data model.

## Verification Strategy

Unit tests:

- Wonderling species data validation
- skill effect resolution
- Mood Trial turn resolution
- Attune chance calculation
- save parsing and migration
- starter nickname display fallback

Browser smoke tests:

- open GameHub
- open standalone Wonder Academy route
- start new game
- pick starter and nickname
- enter hub
- open Wonderdex and Team screens
- enter a region node
- complete a Mood Trial
- attempt Attune
- leave and re-enter route without duplicated KAPLAY loops

Visual QA:

- desktop screenshot
- mobile screenshot
- canvas nonblank check
- text fit check
- no app layout inherited on standalone route

Build checks:

- `npm run lint`
- `npm run build`
- verify game is lazy loaded and main app first screen does not eagerly load the full RPG

## Non-Goals

- No backend, Firestore schema, or cloud progress storage in the initial implementation.
- No third-party IP assets or recognizable character names in the repo.
- No free-roaming 3D world.
- No multiplayer.
- No direct rewrite of the other existing Little Games.

## Implementation Defaults

These defaults keep the next planning step concrete:

- KAPLAY remains the rendering/game engine for the title, hub, region map, and Mood Trial canvas surfaces.
- React owns the standalone page shell, loading/error states, route exit, and any future accessibility overlays.
- Wonderdex and Team screens can be React panels over the standalone game shell unless a KAPLAY scene is clearly simpler during implementation.
- The preferred route is `/games/wonder-academy`.
- The existing academy prototype route should redirect to `/games/wonder-academy` during the migration.
- The first implementation milestone should include four starter portraits/sprites, one academy background, one Sparkleaf Grove map background, one Mood Trial background, and a minimal first set of original Wonderling assets needed for the starter selection and first playable loop.
