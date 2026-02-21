# Travel English UIUX Redesign Spec
# 旅行英語 UIUX 重新設計規格

**Design Concept:** Adventure Journey Map (冒險旅行地圖)
**Target Audience:** 4th Grade Elementary (國小四年級, ~10 years old)
**Design System:** macOS HIG (CLAUDE.md), Tailwind + DaisyUI + Framer Motion + lucide-react

---

## 1. Design Philosophy

### Why the old design fails for kids
The current 3-tab design (片語單字 / 情境對話 / 聽說練習) treats learning like a textbook. Tabs are boring, passive, and offer no sense of progression or reward. A 10-year-old has no intrinsic motivation to click through vocabulary lists.

### The new approach: Adventure + Role-Play + Gamification

**Core Metaphor:** You are a young traveler going on your first international trip — from Taiwan to Singapore! Every scene is a "mission" at a real location. You explore words, watch stories unfold, role-play as the traveler, and earn passport stamps.

**Three pillars:**
1. **Journey Narrative** — A visual map that tells a story. Progress is visible and satisfying.
2. **Active Learning** — No passive lists. Every interaction requires the student to DO something (tap, choose, speak, flip).
3. **Collection & Reward** — Passport stamps, stars, and celebration animations create dopamine loops.

---

## 2. Information Architecture

```
Travel English (旅行英語)
│
├── 🗺️ Journey Map Screen (Main)
│   ├── Journey Header (title + passport button + overall progress)
│   ├── Journey Section: "The Journey" (旅程)
│   │   ├── 🧳 Before the Trip
│   │   ├── 🛫 Taoyuan Airport
│   │   ├── ✈️ On the Plane
│   │   ├── 🛬 Arriving in Singapore
│   │   ├── 🚇 Getting Around
│   │   ├── 🏨 Hotel
│   │   ├── 🍜 Food & Hawker Centre
│   │   ├── 🎢 Attractions & Fun
│   │   ├── 🛍️ Shopping
│   │   ├── 🆘 Asking for Help
│   │   └── 🏠 Going Home
│   └── Journey Section: "Mandai Wildlife Reserve" (萬態保育區)
│       ├── 🦁 Mandai Hub
│       ├── 🐘 Singapore Zoo
│       ├── 🦉 Night Safari
│       ├── 🐠 River Wonders
│       ├── 🦜 Bird Paradise
│       ├── 🐅 Rainforest Wild Asia
│       ├── 🍽️ Dining at Mandai
│       └── 🏕️ Mandai Resort
│
├── 🎯 Scene Hub (per scene — replaces SceneDetail)
│   ├── Scene Hero Card (emoji, title, description, fun fact)
│   └── Activity Grid (4 mission cards):
│       ├── 🔤 Word Explorer (探索單字)
│       ├── 📖 Story (看故事)
│       ├── 🎭 Role Play (角色扮演)
│       └── ⭐ Challenge (挑戰)
│
├── 🔤 Word Explorer (per scene)
│   └── Flashcard stack with flip animation
│
├── 📖 Story Mode (per scene)
│   └── Chat-bubble based animated story playback
│
├── 🎭 Role Play Mode (per scene)
│   └── Interactive dialogue with multiple-choice responses
│
├── ⭐ Challenge Mode (per scene)
│   └── Quiz game (listen & choose, translate, match)
│
└── 🛂 Passport (overlay/modal)
    └── Collection of stamps from completed scenes
```

---

## 3. Screen Designs

### 3.1 Journey Map (Main Screen)

The heart of the redesign. Replaces the old flat grid with a visual, vertical adventure path.

#### Layout Concept

```
┌─────────────────────────────────────────────┐
│  🌏 新加坡冒險                    [🛂 護照]  │  ← Sticky header
│  ━━━━━━━━━━━━━━━━━━━ 35%                    │  ← Overall progress bar
├─────────────────────────────────────────────┤
│                                             │
│  ✈️ 旅程 The Journey                        │  ← Section header
│  ─────────────────────                      │
│                                             │
│       🧳                                    │
│      ╔═══════════════════════╗               │
│      ║ Before the Trip       ║               │
│      ║ 出發前準備    ⭐⭐☆   ║               │
│      ╚═══════════════════════╝               │
│         │                                   │
│         │  (dotted path line)               │
│         │                                   │
│       🛫                                    │
│      ╔═══════════════════════╗               │
│      ║ Taoyuan Airport       ║               │
│      ║ 桃園機場      ⭐☆☆   ║               │
│      ╚═══════════════════════╝               │
│         │                                   │
│         ↓  ... more nodes ...               │
│                                             │
│  🦁 萬態野生動物保育區                       │  ← Section header
│  ─────────────────────                      │
│       ... more nodes ...                    │
│                                             │
└─────────────────────────────────────────────┘
```

#### Mobile Layout (Primary)

The journey nodes alternate left and right to create a winding path feel:

```
┌───────────────────────────┐
│ 🌏 新加坡冒險      [🛂]  │
│ ━━━━━━━━━━━━━ 35%        │
├───────────────────────────┤
│                           │
│ ✈️ 旅程                   │
│                           │
│  ┌──────────────────┐     │
│  │ 🧳 Before the    │     │
│  │    Trip           │     │
│  │    出發前  ⭐⭐☆  │     │
│  └──────────────────┘     │
│        │                  │
│        ╰─────╮            │
│              │            │
│     ┌──────────────────┐  │
│     │ 🛫 Taoyuan       │  │
│     │    Airport        │  │
│     │    桃園機場 ⭐☆☆  │  │
│     └──────────────────┘  │
│              │            │
│        ╭─────╯            │
│        │                  │
│  ┌──────────────────┐     │
│  │ ✈️ On the Plane  │     │
│  │    飛機上   ☆☆☆  │     │
│  └──────────────────┘     │
│        │                  │
│        ↓ ...              │
└───────────────────────────┘
```

#### Desktop Layout (lg+)

On desktop, nodes are laid out in a horizontal winding path or a 2-column zigzag:

```
┌────────────────────────────────────────────────────────────────┐
│  🌏 新加坡冒險                              [🛂 我的護照]     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 35%                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ✈️ 旅程 The Journey                                          │
│                                                                │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
│  │🧳       │───→│🛫       │───→│✈️       │───→│🛬       │    │
│  │Before   │    │Taoyuan  │    │On the   │    │Arriving │    │
│  │the Trip │    │Airport  │    │Plane    │    │in SG    │    │
│  │⭐⭐☆   │    │⭐☆☆    │    │☆☆☆     │    │☆☆☆     │    │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    │
│                                                     │          │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌────↓────┐    │
│  │🏠       │←───│🛍️       │←───│🎢       │←───│🚇       │    │
│  │Going    │    │Shopping │    │Attract- │    │Getting  │    │
│  │Home     │    │         │    │ions     │    │Around   │    │
│  │☆☆☆     │    │☆☆☆     │    │☆☆☆     │    │☆☆☆     │    │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### Journey Node Card

Each node is a tappable card with:
- Scene emoji (large, 32px)
- English title (bold)
- Chinese title (secondary text)
- Star progress (0-3 filled stars using lucide `Star` icon)
- Subtle background tint matching `scene.colorClass`
- Gentle bounce animation on tap (`whileTap={{ scale: 0.96 }}`)
- Completed scenes show a subtle golden glow/border

```
┌──────────────────────────┐
│  🧳                      │
│  Before the Trip         │  ← text-sm font-semibold
│  出發前準備              │  ← text-xs text-base-content/60
│  ⭐⭐☆                  │  ← Star icons, filled=accent, empty=gray
└──────────────────────────┘
  bg: scene.colorClass (e.g. bg-violet-50)
  border: border-hairline
  radius: radius-lg (10px)
  shadow: shadow-sm, hover:shadow-md
```

#### Journey Path Connector

Between nodes, a dashed/dotted path line connects them:
- Vertical on mobile, horizontal zigzag on desktop
- Color: `text-base-content/15` (very subtle)
- Completed segments become solid and accent-colored
- Small animated dots travel along the path (subtle, `motion-safe` only)

#### Passport Button

Top-right corner, a fun "passport" button:
- Shows a small passport icon (lucide `BookOpen` or custom)
- Badge showing total stamps collected (e.g., "3/15")
- Tapping opens the Passport Modal

#### Progress Bar

Below the header, a thin progress bar:
- Shows overall journey completion (% of stars earned out of total possible)
- Animated fill with accent color gradient
- Label: "35% 完成" or "探索進度 35%"

---

### 3.2 Scene Hub (Mission Board)

When a student taps a Journey Node, they enter the Scene Hub. This replaces the old SceneDetail with its 3 boring tabs.

#### Layout

```
┌─────────────────────────────────────────────┐
│  [← 返回地圖]                               │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │       🧳                            │    │  ← Scene Hero Card
│  │   Before the Trip                   │    │
│  │   出發前準備                        │    │
│  │                                     │    │
│  │   💡 Did you know?                  │    │  ← Fun fact (rotates)
│  │   Singapore is called "Lion City"!  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  🎯 你的任務 Your Missions                  │  ← Section label
│                                             │
│  ┌────────────────┐  ┌────────────────┐    │
│  │  🔤             │  │  📖             │    │
│  │  探索單字       │  │  看故事        │    │  ← 2x2 Activity Grid
│  │  Explore Words  │  │  Story          │    │
│  │  ✅ 完成       │  │  ⭐ 1/3         │    │
│  └────────────────┘  └────────────────┘    │
│                                             │
│  ┌────────────────┐  ┌────────────────┐    │
│  │  🎭             │  │  ⭐             │    │
│  │  角色扮演       │  │  挑戰          │    │
│  │  Role Play      │  │  Challenge      │    │
│  │  🔒 未解鎖     │  │  🔒 未解鎖    │    │
│  └────────────────┘  └────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

#### Scene Hero Card

- Full-width card with scene's `colorClass` as background
- Large emoji (48px)
- Title (English + Chinese)
- Rotating fun fact with lightbulb icon (if scene has `funFacts`)
- Fun fact auto-rotates every 5 seconds or tap to cycle
- Glassmorphism: `backdrop-blur-xl border border-hairline`

#### Activity Grid (2x2 Mission Cards)

Four activity cards in a 2-column grid. Each card:

| Activity | Icon | Label (Chinese) | Label (English) | Unlocked by |
|----------|------|-----------------|-----------------|-------------|
| Word Explorer | `🔤` | 探索單字 | Explore Words | Always open |
| Story | `📖` | 看故事 | Story | Always open |
| Role Play | `🎭` | 角色扮演 | Role Play | After completing Word Explorer |
| Challenge | `⭐` | 挑戰 | Challenge | After completing Story |

**Activity Card Design:**
```
┌──────────────────┐
│  🔤              │  ← Large emoji (32px)
│                  │
│  探索單字        │  ← Chinese label (font-semibold)
│  Explore Words   │  ← English label (text-xs, muted)
│                  │
│  ✅ 完成         │  ← Status badge
└──────────────────┘
  bg: white/70 (glass)
  border: hairline
  radius: radius-xl (12px)
  shadow: shadow-sm
  hover: shadow-md, scale 1.02
  locked: opacity-50, grayscale, lock icon overlay
```

**Status badges:**
- `☆ 未開始` (not started) — ghost badge
- `▶ 進行中` (in progress) — accent outline badge
- `✅ 完成` (completed) — success badge with checkmark
- `🔒 未解鎖` (locked) — muted, card has opacity-60

**Unlock logic (progressive disclosure):**
- Word Explorer and Story are always unlocked
- Role Play unlocks after the student has viewed all vocabulary (Word Explorer complete)
- Challenge unlocks after the student has watched at least one Story dialogue
- This creates a natural learning sequence: Learn words → See them in context → Practice using them → Test yourself

---

### 3.3 Word Explorer (探索單字)

Replaces the old PhraseList vocabulary grid. Uses a flashcard metaphor with flip animations.

#### Layout

```
┌─────────────────────────────────────────────┐
│  [← 返回] 探索單字            5 / 10 單字    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━ 50%              │
├─────────────────────────────────────────────┤
│                                             │
│         ┌───────────────────────┐           │
│         │                       │           │
│         │         🧳            │           │
│         │                       │           │
│         │      suitcase         │           │  ← FRONT of card
│         │                       │           │     (English word + emoji)
│         │    [SOOT-kays]        │           │     Phonetic hint
│         │                       │           │
│         │     👆 Tap to flip    │           │
│         │                       │           │
│         └───────────────────────┘           │
│                                             │
│         ┌───────────────────────┐           │
│         │                       │           │
│         │      行李箱            │           │  ← BACK of card
│         │                       │           │     (Chinese translation)
│         │  "I need to pack my   │           │     Example sentence
│         │   suitcase."          │           │     (tappable to hear)
│         │         🔊            │           │
│         │                       │           │
│         └───────────────────────┘           │
│                                             │
│    [← Prev]    ● ● ● ○ ○     [Next →]     │  ← Navigation
│                                             │
│    ┌──────────┐    ┌──────────────┐         │
│    │ 😕 再看  │    │ 👍 我會了！  │         │  ← Self-assessment
│    └──────────┘    └──────────────┘         │
│                                             │
└─────────────────────────────────────────────┘
```

#### Flashcard Behavior

1. Card shows FRONT: emoji + English word + phonetic hint
2. Tap to flip (3D Y-axis rotation, 400ms, `ease-decelerate`)
3. BACK shows: Chinese translation + example sentence + speaker button
4. Tap speaker button to hear the word and example
5. Swipe left/right or tap arrows to navigate cards
6. Bottom buttons: "😕 再看" (study again) and "👍 我會了！" (I know this!)
   - "我會了" marks the word as learned and moves to next
   - "再看" keeps it in the review pile
7. Progress dots at bottom show position

#### Card Design Tokens

```
Front card:
  bg: scene.colorClass (light tint)
  border: hairline
  radius: radius-2xl (16px)
  shadow: shadow-lg
  min-height: 280px (mobile), 320px (desktop)
  text: word is text-3xl font-bold, phonetic is text-sm text-base-content/50

Back card:
  bg: white (light) / oklch(0.18 0 0) (dark)
  border: hairline
  radius: radius-2xl
  text: chinese is text-2xl font-semibold, example is text-base italic
```

#### Completion

When all words are marked "我會了", show a completion celebration:
- Confetti animation (small colored circles falling)
- "太棒了！你學會了所有單字！" message
- Star earned indicator
- "返回任務" button

#### Also includes Phrases

After the vocabulary flashcards, there's a "常用句型" (Key Phrases) section below:
- Scrollable horizontal card list
- Each phrase card shows English (bold) + Chinese (muted) + situation badge
- Tap to hear pronunciation
- Simpler than vocab cards — no flip needed, just a compact card with a speaker icon

```
  ┌──────────────────────────────────┐
  │  Can I have a window seat?   🔊 │
  │  可以給我靠窗的座位嗎？         │
  │  [check-in]                      │
  └──────────────────────────────────┘
```

---

### 3.4 Story Mode (看故事)

Replaces the old DialoguePlayer. Turns dialogues into an animated, immersive chat story.

#### Layout

```
┌─────────────────────────────────────────────┐
│  [← 返回]  📖 看故事            1 / 2       │
├─────────────────────────────────────────────┤
│                                             │
│  Packing Together 一起打包行李              │  ← Dialogue title
│  🏠 You and mom are packing for the trip    │  ← Scene description
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │  👦 Child                           │    │  ← Speaker avatar + role
│  │  ┌───────────────────────────┐      │    │
│  │  │ Mom, I'm so excited!      │      │    │  ← Chat bubble (right=You)
│  │  │ We're going to Singapore  │      │    │
│  │  │ tomorrow!                 │      │    │
│  │  │ 媽,我好興奮！             │      │    │  ← Chinese subtitle
│  │  └───────────────────────────┘      │    │
│  │                                     │    │
│  │                        👩 Mom       │    │
│  │      ┌───────────────────────────┐  │    │
│  │      │ Me too! Let's pack your   │  │    │  ← Chat bubble (left=Other)
│  │      │ suitcase. What do you     │  │    │
│  │      │ need?                     │  │    │
│  │      │ 我也是！我們來整理...      │  │    │
│  │      └───────────────────────────┘  │    │
│  │                                     │    │
│  │         👆 Tap to continue          │    │  ← Tap prompt
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 🔊 聽    │  │ 中/英    │  │ ▶️ 自動  │  │  ← Control bar
│  └──────────┘  └──────────┘  └──────────┘  │
│                                             │
│  [← 上一段]                  [下一段 →]     │  ← Dialogue navigation
│                                             │
└─────────────────────────────────────────────┘
```

#### Story Playback Behavior

1. Messages appear one at a time with a slide-in animation
   - "You" messages slide from right: `animate={{ x: [20, 0], opacity: [0, 1] }}`
   - "Other" messages slide from left: `animate={{ x: [-20, 0], opacity: [0, 1] }}`
2. Tap anywhere to advance to the next message
3. Each message auto-plays its TTS audio when it appears
4. Chinese subtitle toggleable (shown by default)
5. "Auto-play" button: messages advance automatically with TTS pauses between
6. Tap any individual message to replay its audio
7. When all messages are shown, "Next dialogue" button appears

#### Chat Bubble Design

```
You (Speaker A) — right-aligned:
  bg: bg-accent/10 (light blue tint)
  border-radius: rounded-2xl rounded-br-md (tail bottom-right)
  max-width: 85%

Other (Speaker B) — left-aligned:
  bg: bg-base-200 (gray)
  border-radius: rounded-2xl rounded-bl-md (tail bottom-left)
  max-width: 85%

Speaker label:
  text-xs font-medium text-base-content/50
  emoji avatar before name (👦👩👨👨‍✈️🧑‍💼 based on role)

Active/speaking bubble:
  ring-2 ring-accent animate-pulse (subtle)
```

#### Speaker Avatars

Map dialogue roles to emoji avatars:
- Child / You → 👦 or 👧
- Mom → 👩
- Dad → 👨
- Staff / Cashier → 🧑‍💼
- Flight Attendant → 👨‍✈️
- Officer → 👮

#### Multiple Dialogues

When a scene has multiple dialogues:
- Show a small header with dialogue title
- Navigation arrows at bottom: "← 上一段 / 下一段 →"
- Dot indicators showing which dialogue you're on
- Each dialogue starts fresh with the tap-to-advance flow

---

### 3.5 Role Play Mode (角色扮演)

**This is the key new interactive learning mode.** The student plays as the traveler (Speaker A) and must choose the correct English response in a dialogue.

#### Layout

```
┌─────────────────────────────────────────────┐
│  [← 返回]  🎭 角色扮演                      │
├─────────────────────────────────────────────┤
│                                             │
│  Checking In at the Counter                 │
│  在櫃檯辦理登機                             │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │                     🧑‍💼 Staff       │    │
│  │   ┌──────────────────────────────┐  │    │
│  │   │ Sure! May I see your         │  │    │
│  │   │ passport, please?            │  │    │
│  │   └──────────────────────────────┘  │    │
│  │                                     │    │
│  │                                     │    │
│  │       🤔 你會怎麼說？               │    │  ← Prompt
│  │       What would you say?           │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  A) Here you go.                    │    │  ← Choice A (correct)
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │  B) How are you?                    │    │  ← Choice B (wrong)
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │  C) I don't know.                   │    │  ← Choice C (wrong)
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

#### After Correct Answer:

```
┌─────────────────────────────────────────────┐
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │                     🧑‍💼 Staff       │    │
│  │   ┌──────────────────────────────┐  │    │
│  │   │ Sure! May I see your         │  │    │
│  │   │ passport, please?            │  │    │
│  │   └──────────────────────────────┘  │    │
│  │                                     │    │
│  │  👦 You                            │    │
│  │  ┌──────────────────────────────┐  │    │
│  │  │ ✅ Here you go.         🔊  │  │    │  ← Correct! Green bg
│  │  │    給你。                     │  │    │
│  │  └──────────────────────────────┘  │    │
│  │                                     │    │
│  │         🎉 正確！Great job!        │    │  ← Celebration text
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │           繼續 →                    │    │  ← Continue button
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

#### Role Play Behavior

1. The dialogue plays line by line (same as Story Mode for Speaker B lines)
2. When it's YOUR turn (Speaker A), instead of showing the answer, 3 choices appear
3. One choice is the correct dialogue line; two are plausible distractors
4. **Correct answer:**
   - Green highlight on the choice
   - "🎉 正確！" celebration text with bounce animation
   - TTS plays the correct answer
   - Chinese translation appears
   - "繼續 →" button to advance
5. **Wrong answer:**
   - Red shake animation on the wrong choice
   - "再試一次！Try again!" encouragement
   - Wrong choice dims out (can't re-select)
   - Student tries again (max 2 wrong, then reveal answer)
6. After 2 wrong attempts, the correct answer highlights in green with explanation

#### Distractor Generation

Distractors come from other phrases in the same scene (different situations) or common confused phrases. They should be:
- Grammatically valid English
- Similar length to the correct answer
- Contextually plausible but wrong for THIS situation

Implementation note: distractors can be pre-authored in the scene data or generated from other phrases in the scene's phrase list.

#### Completion

After completing all dialogue lines:
- Show score: "你答對了 7/8 題！"
- Star rating based on accuracy:
  - 100% correct on first try → 3 stars ⭐⭐⭐
  - 75%+ first try → 2 stars ⭐⭐☆
  - Below 75% → 1 star ⭐☆☆
- "再玩一次" (Play again) or "返回任務" (Back to missions)

---

### 3.6 Challenge Mode (挑戰)

A fast-paced quiz game that combines vocabulary and phrases. Replaces the old PracticeMode.

#### Layout

```
┌─────────────────────────────────────────────┐
│  [✕ 結束]  ⭐ 挑戰              ❤️❤️❤️    │  ← Lives (3 hearts)
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 6/10       │  ← Progress bar
├─────────────────────────────────────────────┤
│                                             │
│         Question Type: Listen & Choose      │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │    🔊 Listen and choose             │    │
│  │       聽一聽，選出正確的意思         │    │
│  │                                     │    │
│  │    ┌───────────────┐                │    │
│  │    │   ▶ 播放      │                │    │  ← Big play button
│  │    └───────────────┘                │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌──────────────────┐ ┌──────────────────┐  │
│  │  A) 登機證        │ │  B) 護照         │  │  ← 2x2 answer grid
│  └──────────────────┘ └──────────────────┘  │
│  ┌──────────────────┐ ┌──────────────────┐  │
│  │  C) 行李箱        │ │  D) 安全帶       │  │
│  └──────────────────┘ └──────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

#### Question Types

**Type 1: Listen & Choose (聽力選擇)**
- Play English audio, choose the correct Chinese meaning
- 4 Chinese options in a 2x2 grid
- Tests listening comprehension

**Type 2: Translate (翻譯選擇)**
- Show Chinese text, choose the correct English translation
- 3 English options in a vertical list
- Tests vocabulary recall

**Type 3: Fill the Blank (填空)**
- Show a sentence with a blank: "Can I have a ___ seat?"
- 3 word options: "window" / "door" / "floor"
- Tests contextual vocabulary

**Type 4: Picture Match (圖片配對)** — future enhancement
- Show an emoji/image, choose the English word
- Most visual and fun for young learners

#### Game Mechanics

- **Lives system:** Start with 3 hearts (❤️❤️❤️). Wrong answers lose a heart.
- **No timer pressure:** Kids shouldn't feel rushed. No countdown.
- **10 questions per round:** Mix of question types from the scene's vocabulary and phrases.
- **Correct answer:** Green flash + small bounce animation + "✅" + auto-advance after 1s
- **Wrong answer:** Red shake + lose a heart + show correct answer for 2s + advance
- **All hearts lost:** "Game Over" screen with encouragement: "沒關係！再試一次！" + restart button
- **Complete all 10:** Star rating screen:
  - 3 hearts remaining → ⭐⭐⭐
  - 2 hearts remaining → ⭐⭐☆
  - 1 heart remaining → ⭐☆☆

#### Completion Screen

```
┌─────────────────────────────────────────────┐
│                                             │
│              🎉                              │
│                                             │
│         太棒了！Challenge Complete!          │
│                                             │
│           ⭐ ⭐ ⭐                          │  ← Stars earned
│                                             │
│         你答對了 9 / 10 題！                │
│         ❤️ ❤️ ❤️ 剩餘生命                  │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │       🔄 再玩一次                   │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │       ← 返回任務                    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│        🛂 獲得護照印章！                    │  ← Stamp earned!
│                                             │
└─────────────────────────────────────────────┘
```

---

### 3.7 Passport (護照)

A collectible "digital passport" that serves as the progress tracker and reward system.

#### Layout (Modal/Sheet)

```
┌─────────────────────────────────────────────┐
│                                             │
│  🛂 我的旅行護照                            │
│     My Travel Passport                      │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  ┌────────────────────────────────┐ │    │
│  │  │        TRAVEL PASSPORT         │ │    │
│  │  │         旅行護照               │ │    │
│  │  │                                │ │    │
│  │  │  Name: Little Explorer         │ │    │
│  │  │  From: Taiwan 🇹🇼              │ │    │
│  │  │  To:   Singapore 🇸🇬           │ │    │
│  │  │                                │ │    │
│  │  │  Stamps: 3 / 15               │ │    │
│  │  └────────────────────────────────┘ │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  📋 護照印章 Stamps                         │
│                                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ 🧳   │ │ 🛫   │ │ ✈️   │ │ 🔒   │      │
│  │ ✅   │ │ ✅   │ │ ✅   │ │      │      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ 🔒   │ │ 🔒   │ │ 🔒   │ │ 🔒   │      │
│  │      │ │      │ │      │ │      │      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
│  ...                                        │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │              關閉                   │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

#### Stamp Earning Logic

A stamp is earned for a scene when the student earns at least 1 star in the Challenge mode for that scene.

- **Earned stamp:** Full color emoji with a subtle stamp-impression animation (scale from 1.5 to 1.0 with rotation)
- **Unearned stamp:** Grayed out with lock icon, emoji barely visible (opacity-20)
- Tapping an earned stamp shows the scene name and star count

#### Passport Modal Design

```
Overlay: bg-black/20 backdrop-blur-sm
Content: bg-background/95 backdrop-blur-2xl border border-hairline
         rounded-2xl shadow-2xl
         max-w-md mx-auto
Animation: scale from 0.95, fade in (framer motion)
```

---

## 4. Interaction Flow

### 4.1 First-Time User Flow

```
Open Travel English
  → See Journey Map with all nodes available
  → Notice first node "Before the Trip" is highlighted/pulsing
  → Tap "Before the Trip"
  → Enter Scene Hub with 4 activity cards
  → Word Explorer and Story are open; Role Play and Challenge are locked
  → Tap "Word Explorer"
  → Flip through flashcards, mark words as learned
  → Complete all words → celebration → return to Scene Hub
  → Word Explorer shows ✅, Role Play is now unlocked
  → Tap "Story" → watch animated dialogue
  → Story complete → return to Scene Hub
  → Story shows ✅, Challenge is now unlocked
  → Tap "Role Play" → interactive dialogue with choices
  → Complete role play → return to Scene Hub
  → Tap "Challenge" → quiz game
  → Earn 3 stars! → Passport stamp earned! 🎉
  → Return to Journey Map → "Before the Trip" now shows ⭐⭐⭐
  → Progress bar updated
  → Move on to next scene!
```

### 4.2 Returning User Flow

```
Open Travel English
  → Journey Map shows progress (some nodes with stars)
  → Can jump to any scene (no strict linear lock)
  → Tap any node to enter its Scene Hub
  → Activities remember completion state
  → Can replay any activity to improve stars
```

### 4.3 URL Structure

Preserve the existing URL-driven state pattern:
- `/travel` — Journey Map
- `/travel?scene=before-departure` — Scene Hub for "Before the Trip"
- `/travel?scene=before-departure&activity=words` — Word Explorer
- `/travel?scene=before-departure&activity=story` — Story Mode
- `/travel?scene=before-departure&activity=roleplay` — Role Play
- `/travel?scene=before-departure&activity=challenge` — Challenge

---

## 5. Component Hierarchy

```
TravelEnglishPage.tsx (router)
├── JourneyMap.tsx (main screen)
│   ├── JourneyHeader.tsx (title, progress bar, passport button)
│   ├── JourneySection.tsx (section grouping)
│   │   ├── SectionHeader.tsx (emoji + title)
│   │   └── JourneyNode.tsx (per-scene card with stars)
│   └── JourneyPath.tsx (connecting dotted lines)
│
├── SceneHub.tsx (per-scene mission board)
│   ├── SceneHero.tsx (emoji, titles, fun fact)
│   └── ActivityGrid.tsx
│       └── ActivityCard.tsx (per-activity mission card)
│
├── WordExplorer.tsx (flashcard activity)
│   ├── Flashcard.tsx (flip card)
│   ├── PhraseScroller.tsx (horizontal phrase cards)
│   └── CompletionCelebration.tsx
│
├── StoryMode.tsx (dialogue playback)
│   ├── ChatBubble.tsx (animated message)
│   ├── SpeakerAvatar.tsx (role-based emoji)
│   └── StoryControls.tsx (audio, subtitle toggle, auto-play)
│
├── RolePlayMode.tsx (interactive dialogue)
│   ├── ChatBubble.tsx (reused)
│   ├── ChoiceButton.tsx (answer option)
│   └── RolePlayResult.tsx (correct/wrong feedback)
│
├── ChallengeMode.tsx (quiz game)
│   ├── ChallengeHeader.tsx (hearts, progress)
│   ├── QuestionCard.tsx (question display)
│   │   ├── ListenChooseQuestion.tsx
│   │   ├── TranslateQuestion.tsx
│   │   └── FillBlankQuestion.tsx
│   └── ChallengeComplete.tsx (stars, stamp)
│
└── PassportModal.tsx (stamp collection)
    ├── PassportCover.tsx
    └── StampGrid.tsx
        └── Stamp.tsx (per-scene stamp)
```

---

## 6. Animation & Transition Specs

All animations respect `prefers-reduced-motion` via `motion-safe:` prefix or Framer Motion's `useReducedMotion()`.

### Page Transitions

| Transition | Animation | Duration |
|-----------|-----------|----------|
| Journey Map → Scene Hub | Slide left + fade | 300ms ease-decelerate |
| Scene Hub → Activity | Slide left + fade | 250ms ease-decelerate |
| Activity → Scene Hub (back) | Slide right + fade | 250ms ease-decelerate |
| Scene Hub → Journey Map (back) | Slide right + fade | 300ms ease-decelerate |

### Component Animations

| Component | Animation | Duration | Easing |
|-----------|-----------|----------|--------|
| Flashcard flip | 3D rotateY(180deg) | 400ms | ease-in-out |
| Chat bubble (You) | x: [20, 0], opacity: [0, 1] | 300ms | ease-decelerate |
| Chat bubble (Other) | x: [-20, 0], opacity: [0, 1] | 300ms | ease-decelerate |
| Correct answer | scale: [1, 1.05, 1], bg flash green | 400ms | spring |
| Wrong answer | x: [0, -8, 8, -4, 4, 0] (shake) | 500ms | ease-out |
| Star earned | scale: [0, 1.3, 1], rotate: [0, 15, 0] | 600ms | spring |
| Passport stamp | scale: [2, 0.9, 1], rotate: [-10, 5, 0] | 500ms | spring |
| Journey node hover | y: -2, shadow increase | 150ms | ease-out |
| Journey node tap | scale: 0.96 | 100ms | ease-in |
| Heart lost | scale: [1, 1.3, 0], opacity: [1, 1, 0] | 400ms | ease-in |
| Progress bar fill | width transition | 500ms | ease-decelerate |
| Celebration confetti | Multiple particles falling with rotation | 2000ms | linear |

### Framer Motion Variants (reusable)

```typescript
// Page slide variants
const pageVariants = {
  enter: { x: 30, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -30, opacity: 0 },
};

// Chat bubble variants
const bubbleVariants = {
  hidden: (isYou: boolean) => ({
    x: isYou ? 20 : -20,
    opacity: 0,
    scale: 0.95,
  }),
  visible: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

// Card flip variants
const flipVariants = {
  front: { rotateY: 0 },
  back: { rotateY: 180 },
};

// Celebration star
const starVariants = {
  hidden: { scale: 0, rotate: -30 },
  visible: {
    scale: 1,
    rotate: 0,
    transition: { type: "spring", stiffness: 300, damping: 15 },
  },
};
```

---

## 7. State Management

### Local State (per-component)

| State | Location | Type |
|-------|----------|------|
| Current flashcard index | WordExplorer | `number` |
| Flipped state | Flashcard | `boolean` |
| Known words set | WordExplorer | `Set<string>` |
| Current dialogue message index | StoryMode | `number` |
| Auto-play toggle | StoryMode | `boolean` |
| Chinese subtitle toggle | StoryMode | `boolean` |
| Selected choice | RolePlayMode | `string \| null` |
| Wrong attempts | RolePlayMode | `number` |
| Current question index | ChallengeMode | `number` |
| Lives remaining | ChallengeMode | `number` |
| Quiz answers | ChallengeMode | `Array` |

### Persistent State (localStorage)

Progress data should persist across sessions:

```typescript
interface TravelProgress {
  scenes: Record<string, SceneProgress>;
}

interface SceneProgress {
  wordsLearned: string[];       // word IDs marked as "I know this"
  storiesWatched: string[];     // dialogue IDs completed
  rolePlayScore: number | null; // best score (0-100%)
  challengeStars: number;       // 0-3 stars earned
  stampEarned: boolean;         // passport stamp
}
```

Store in localStorage under key `"travel-progress"`. Use a custom hook `useTravelProgress()`.

### URL State

Continue using `useSearchParams` for navigation:
- `?scene=<id>` — which scene is selected
- `?scene=<id>&activity=<words|story|roleplay|challenge>` — which activity

---

## 8. Data Model Changes

### New fields for TravelScene type

```typescript
export interface TravelScene {
  // ... existing fields ...
  funFacts?: FunFact[];        // Cultural fun facts for kids
}

export interface FunFact {
  emoji: string;
  english: string;
  chinese: string;
}
```

### Distractor data for Role Play

Role Play needs distractor choices. Two approaches:

**Approach A (simple):** Generate distractors from other phrases in the same scene.
Pick 2 random phrases from the scene's phrase list as wrong answers.

**Approach B (authored):** Add an optional `distractors` field to DialogueLine:
```typescript
export interface DialogueLine {
  // ... existing ...
  distractors?: string[];  // 2 wrong answer choices for role play
}
```

**Recommendation:** Start with Approach A for simplicity. The scene's phrase list provides enough material. If quality is insufficient, switch to Approach B later.

### Challenge question generation

Challenge questions are generated dynamically from scene data:
- **Listen & Choose:** Pick a vocab word → play audio → options are 4 Chinese translations (1 correct + 3 from other vocab in scene)
- **Translate:** Pick a phrase → show Chinese → options are 3 English translations (1 correct + 2 from other phrases)
- **Fill Blank:** Pick a phrase → remove a key word → options are 3 words (1 correct + 2 other vocab words)

---

## 9. Responsive Design Notes

### Mobile (< 640px, primary target)

- Journey nodes: full-width, stacked vertically
- Activity grid: 2 columns
- Flashcards: full-width with swipe gestures
- Chat bubbles: max-width 85%
- Challenge answers: full-width stacked or 2x2 grid
- Passport modal: full-screen sheet (slide up from bottom)

### Tablet (640px - 1024px)

- Journey nodes: 2-column grid
- Activity grid: 2 columns (larger cards)
- Flashcards: centered, max-width 400px
- Passport modal: centered modal (max-width 480px)

### Desktop (1024px+)

- Journey nodes: horizontal zigzag path (4 per row)
- Activity grid: 2x2 or 4-column
- Flashcards: centered, max-width 420px
- Chat area: centered, max-width 600px
- Passport modal: centered modal (max-width 500px)

---

## 10. Accessibility

- All interactive elements have `min-h-[44px]` touch targets
- Focus-visible rings on all buttons (`focus-visible:ring-2 ring-accent`)
- ARIA labels on icon-only buttons
- Screen reader text for star ratings
- Reduced motion support for all animations
- Color is not the only indicator (icons + text for correct/wrong)
- Chinese labels alongside English for bilingual comprehension

---

## 11. Summary: How Each Learning Mode Works

| Mode | Purpose | Pedagogy | Fun Factor |
|------|---------|----------|------------|
| **Word Explorer** | Introduce new vocabulary | Flashcard spaced repetition, self-assessment | Flip animation, "I know it!" satisfaction |
| **Story** | Show words in context | Comprehensible input, situational dialogue | Animated chat story, audio playback |
| **Role Play** | Active recall & application | Choose-your-response, learn from mistakes | Game-like choices, celebration on correct |
| **Challenge** | Test & reinforce | Multi-modal quiz (listen, read, fill) | Lives system, stars, passport stamps |

### Learning Sequence per Scene
1. **Explore** → Build vocabulary foundation
2. **Story** → See vocabulary in real dialogue context
3. **Role Play** → Practice choosing correct responses
4. **Challenge** → Test all knowledge, earn rewards

This sequence follows the pedagogical flow: **Exposure → Context → Practice → Assessment**.

---

## 12. What Makes This Fun for 10-Year-Olds

1. **It's a real adventure** — Not "Lesson 1, Lesson 2" but "Your trip to Singapore!"
2. **Passport stamps** — Collection mechanic = "Gotta catch 'em all" motivation
3. **Role-playing** — Kids pretend they're the traveler talking to real people
4. **Stars and hearts** — Game-like feedback without being punitive (no fail state, just retry)
5. **Fun facts** — "Did you know Singapore has a pool on top of a hotel?!" = genuine wonder
6. **Visual progress** — The journey map shows how far you've come
7. **Animated stories** — Chat-style dialogues feel like messaging, which is familiar to digital natives
8. **No walls of text** — Everything is bite-sized, tappable, and visual
9. **Celebration moments** — Confetti, bouncing stars, and "太棒了！" keep energy high
10. **Agency** — Kids CHOOSE what to explore, not forced through a linear textbook
