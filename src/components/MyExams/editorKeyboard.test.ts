import { describe, expect, it } from "vitest";
import { isEditableTarget } from "./editorKeyboard";

describe("isEditableTarget", () => {
  it("treats form fields as editable", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(isEditableTarget(document.createElement(tag))).toBe(true);
    }
  });

  it("treats contenteditable descendants as editable", () => {
    const host = document.createElement("div");
    host.setAttribute("contenteditable", "true");
    const child = document.createElement("span");
    host.appendChild(child);
    expect(isEditableTarget(child)).toBe(true);
  });

  it("respects contenteditable=false", () => {
    const host = document.createElement("div");
    host.setAttribute("contenteditable", "false");
    expect(isEditableTarget(host)).toBe(false);
  });

  it("ignores buttons, the body and null", () => {
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(document.body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
