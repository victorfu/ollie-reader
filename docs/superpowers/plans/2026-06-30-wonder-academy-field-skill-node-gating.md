# Wonder Academy Field Skill Node Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add field-skill-gated exploration nodes without blocking the main Wonder Academy route.

**Architecture:** Extend `RegionNode` with an optional `fieldSkillId`. Region helpers check both cleared prerequisite nodes and the active team's field skills, while the node map UI passes the team's field skills and shows a readable locked hint. Add one optional Sparkleaf side node requiring `secret-sense`; it branches from the first node and does not gate the Warden path.

**Tech Stack:** React 19, TypeScript strict, Vitest, existing Wonder Academy region and field skill modules.

---

## File Structure

- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyRegions.ts`
  - Add `fieldSkillId?: string` to `RegionNode`.
  - Add optional side node data.
  - Make `isNodeUnlocked()` and `nodeUnlockHint()` account for field skills.
  - Validate unknown node field skills.
- **Modify** `src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts`
  - Add failing tests for field-skill locked nodes and validation.
- **Modify** `src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx`
  - Pass team field skills into node unlock checks and hints.

## Task 1: Region Logic And Data

- [x] **Step 1: Write failing tests**

Update imports in `src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts`:

```ts
import {
  FIRST_REGION,
  REGIONS,
  isNodeUnlocked,
  nodeKey,
  nodeUnlockHint,
  regionValidationErrors,
  type Region,
} from "./wonderAcademyRegions";
```

Add to the `nodeUnlockHint` describe block:

```ts
it("keeps field-skill-gated nodes locked until the team has the skill", () => {
  const secretNode = {
    ...FIRST_REGION.nodes.find((node) => node.id === "meadow")!,
    fieldSkillId: "secret-sense",
  };
  const cleared = [nodeKey(FIRST_REGION.id, "entry")];

  expect(isNodeUnlocked(secretNode, FIRST_REGION.id, cleared, [])).toBe(false);
  expect(nodeUnlockHint(secretNode, FIRST_REGION, cleared, [])).toBe("需要「尋祕」探索能力");
  expect(isNodeUnlocked(secretNode, FIRST_REGION.id, cleared, ["secret-sense"])).toBe(true);
  expect(nodeUnlockHint(secretNode, FIRST_REGION, cleared, ["secret-sense"])).toBeNull();
});

it("ships an optional field-skill side node without blocking the warden path", () => {
  const sideNode = FIRST_REGION.nodes.find((node) => node.id === "secret-garden");
  const wardenNode = FIRST_REGION.nodes.find((node) => node.kind === "warden");

  expect(sideNode).toMatchObject({
    label: "祕密花圃",
    kind: "explore",
    fieldSkillId: "secret-sense",
  });
  expect(wardenNode?.requires).not.toContain("secret-garden");
});
```

Add to `regionValidationErrors` malformed test data:

```ts
        { id: "skill-lock", label: "壞技能門", kind: "explore", x: 0.2, y: 0.2, requires: [], fieldSkillId: "missing-skill" },
```

And add this expected error before the warden-count error:

```ts
      "broken: node 'skill-lock' requires unknown field skill 'missing-skill'",
```

- [x] **Step 2: Verify tests fail**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts
```

Expected: fail because `isNodeUnlocked()` does not accept field skills, hints do not include field-skill requirements, `secret-garden` does not exist, and validation ignores unknown field skills.

- [x] **Step 3: Implement region logic and side node**

In `wonderAcademyRegions.ts`, update imports:

```ts
import { FIELD_SKILLS, speciesById } from "./wonderAcademyCreatures";
```

Update `RegionNode`:

```ts
  /** Optional active-team field skill required for this node. */
  fieldSkillId?: string;
```

Add the side node:

```ts
  { id: "secret-garden", label: "祕密花圃", kind: "explore", x: 0.3, y: 0.18, requires: ["entry"], fieldSkillId: "secret-sense" },
```

Update `isNodeUnlocked()`:

```ts
export function isNodeUnlocked(
  node: RegionNode,
  regionId: string,
  clearedNodes: string[],
  fieldSkillIds: readonly string[] = [],
): boolean {
  const prerequisitesMet = node.requires.every((rid) => clearedNodes.includes(nodeKey(regionId, rid)));
  const fieldSkillMet = !node.fieldSkillId || fieldSkillIds.includes(node.fieldSkillId);
  return prerequisitesMet && fieldSkillMet;
}
```

Update `nodeUnlockHint()`:

```ts
export function nodeUnlockHint(
  node: RegionNode,
  region: Region,
  clearedNodes: string[],
  fieldSkillIds: readonly string[] = [],
): string | null {
  const missing = node.requires.filter((rid) => !clearedNodes.includes(nodeKey(region.id, rid)));
  if (missing.length > 0) {
    const labels = missing.map((rid) => region.nodes.find((candidate) => candidate.id === rid)?.label ?? rid);
    return `先完成「${labels.join("、")}」`;
  }

  if (node.fieldSkillId && !fieldSkillIds.includes(node.fieldSkillId)) {
    const skill = FIELD_SKILLS[node.fieldSkillId];
    return `需要「${skill?.name ?? node.fieldSkillId}」探索能力`;
  }

  return null;
}
```

In `regionValidationErrors()`, inside the node loop, add:

```ts
    if (node.fieldSkillId && !FIELD_SKILLS[node.fieldSkillId]) {
      errors.push(`${prefix} node '${node.id}' requires unknown field skill '${node.fieldSkillId}'`);
    }
```

- [x] **Step 4: Verify region tests pass**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts
```

Expected: pass.

## Task 2: Wire Node Map UI

- [x] **Step 1: Add team field-skill helper and pass skills to region helpers**

In `WonderAcademyCollector.tsx`, add near `displayName()`:

```ts
const teamFieldSkillIds = (team: OwnedCreature[]): string[] => [
  ...new Set(
    team
      .map((owned) => speciesById(owned.speciesId)?.fieldSkillId)
      .filter((id): id is string => !!id),
  ),
];
```

In the node map block, add after `wardenDone`:

```ts
    const skillIds = teamFieldSkillIds(state.team);
```

Update both calls:

```ts
const unlocked = isNodeUnlocked(n, region.id, state.clearedNodes, skillIds);
const unlockHint = nodeUnlockHint(n, region, state.clearedNodes, skillIds);
```

Update `enterNode` to use active team skills:

```ts
      const skillIds = teamFieldSkillIds(state.team);
      if (!isNodeUnlocked(node, region.id, state.clearedNodes, skillIds)) return state;
```

Update the region select block to reuse the helper:

```ts
          const skillIds = teamFieldSkillIds(state.team);
```

- [x] **Step 2: Verify focused tests still pass**

Run:

```bash
npm run test -- src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts
```

Expected: pass.

## Task 3: Full Verification And Commit

- [x] **Step 1: Run full checks**

Run:

```bash
npm run lint
npm run test
npm run build
```

Expected: lint has no errors; tests and build pass. Existing non-blocking warnings can remain documented.

- [x] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-06-30-wonder-academy-field-skill-node-gating.md \
  src/components/LittleGames/wonder-academy/WonderAcademyCollector.tsx \
  src/components/LittleGames/wonder-academy/wonderAcademyRegions.ts \
  src/components/LittleGames/wonder-academy/wonderAcademyRegions.test.ts
git commit -m "feat(wonder-academy): gate nodes by field skills"
```
