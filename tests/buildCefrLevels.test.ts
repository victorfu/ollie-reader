import { expect, test } from "vitest";
import { buildCefrLevels, parseCsv } from "../scripts/build-cefr-levels.mjs";

test("parses quoted fields containing commas", () => {
  expect(parseCsv('a,"b, c",d\n')[0]).toEqual(["a", "b, c", "d"]);
});

test("splits slash variants, lowercases, and keeps the lowest level", () => {
  const cefrj = 'headword,pos,CEFR,CoreInventory 1,CoreInventory 2,Threshold\n' +
    'a.m./A.M./am/AM,adverb,A1,,,\nlight,noun,A1,,,\nlight,adjective,A2,,,\n' +
    'air conditioning,noun,B1,Objects and rooms,,"House and home, environment"\n';
  const octanove = 'headword,pos,CEFR,notes\ncloak,noun,C1,\nlight,verb,C2,\nbad,noun,Z9,\n';
  expect(buildCefrLevels([cefrj, octanove])).toEqual({
    "a.m.": "A1", am: "A1", light: "A1", "air conditioning": "B1", cloak: "C1",
  });
});
