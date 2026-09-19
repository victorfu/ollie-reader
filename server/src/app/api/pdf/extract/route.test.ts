import { describe, expect, it } from "vitest";
import { POST, OPTIONS } from "./route";
import { pdfFixture } from "../../../../test/pdfFixture";

function upload(bytes = pdfFixture(), filename = "sample.pdf") {
  const form = new FormData();
  form.set("file", new File([bytes], filename, { type: "application/pdf" }));
  return new Request("http://localhost/api/pdf/extract", { method: "POST", body: form });
}

describe("PDF extraction", () => {
  it("extracts real PDF text and retains blank pages in the original contract", async () => {
    const response = await POST(upload());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "success", filename: "sample.pdf", total_pages: 2, pages: [
      { page_number: 1, text: "Hello Ollie", text_length: 11 },
      { page_number: 2, text: "", text_length: 0 },
    ] });
  });
  it.each([
    [new Uint8Array(), "empty.pdf", 400],
    [new TextEncoder().encode("not a PDF"), "broken.pdf", 400],
    [pdfFixture(), "sample.txt", 400],
    [new Uint8Array(4 * 1024 * 1024 + 1), "large.pdf", 413],
  ])("rejects invalid or oversized uploads", async (bytes, name, status) => {
    expect((await POST(upload(bytes, name))).status).toBe(status);
  });
  it("requires the file field", async () => {
    expect((await POST(new Request("http://localhost/api/pdf/extract", { method: "POST", body: new FormData() }))).status).toBe(422);
  });
  it("supports multipart preflight", async () => {
    const response = await OPTIONS(new Request("http://localhost/api/pdf/extract", { method: "OPTIONS", headers: {
      origin: "http://localhost:5173", "access-control-request-method": "POST", "access-control-request-headers": "content-type",
    } }));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
  });
});
