# Wonder Academy Builder Field Skill Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the derived exploration field skill while creating a custom Wonder Academy creature.

**Architecture:** Reuse the existing `fieldSkillForElements()` mapping in `CreatureBuilder`. The builder derives the preview during render from selected elements, avoiding extra state and keeping `makeCustomCreature()` as the source of the saved field skill.

**Tech Stack:** React 19, TypeScript strict, Vite, Playwright smoke against the existing `localhost:5173` dev server.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Import `fieldSkillForElements`.
  - Render a small field skill preview in `CreatureBuilder` after element selection.

## Task 1: Failing Rendered UI Smoke

- [x] **Step 1: Run failing Playwright smoke**

Use existing `http://localhost:5173/games/wonder-academy` without starting a server. Start a guest run, reach Hub, open `建立寵物`, choose `leaf`, and wait for builder text `建立後探索能力`.

Expected: fail because the builder does not render a field skill preview yet.

## Task 2: Builder Preview UI

- [x] **Step 1: Import field skill helper**

Add `fieldSkillForElements` to the existing creature import list in `WonderAcademyCollector.tsx`.

- [x] **Step 2: Derive selected field skill**

Inside `CreatureBuilder`, derive:

```ts
const selectedFieldSkill = FIELD_SKILLS[fieldSkillForElements(elements)];
```

- [x] **Step 3: Render preview**

After the element selector, render a compact preview when `elements.length > 0`:

```tsx
<div style={{ marginTop: 10, fontSize: 12, color: "#6a6585", background: "#fff", border: "1px solid rgba(60,40,90,.12)", borderRadius: 12, padding: "8px 10px" }}>
  <div style={{ fontSize: 11, fontWeight: 800, color: "#8a83a3", marginBottom: 3 }}>建立後探索能力</div>
  <div style={{ fontWeight: 800, color: "#33304a" }}>{selectedFieldSkill.emoji} {selectedFieldSkill.name}</div>
  <div>{selectedFieldSkill.desc}</div>
</div>
```

## Task 3: Verification And Commit

- [x] **Step 1: Run the same Playwright smoke**

Expected: pass and screenshot the builder preview.

- [x] **Step 2: Run full checks**

Run:

```bash
npm run lint
npm run test
npm run build
```

Expected: lint has no errors; tests and build pass. Existing non-blocking warnings can remain documented.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-builder-field-skill-preview.md \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx
git commit -m "feat(wonder-academy): preview builder field skills"
```
