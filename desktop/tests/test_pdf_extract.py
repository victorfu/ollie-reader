import pymupdf
import pytest

import server.pdf_extract as pdf_extract
from server.pdf_extract import PDFError, extract_text_from_pdf


def _make_pdf(text: str) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def test_extract_returns_pages_with_text():
    pdf = _make_pdf("Hello Ollie")
    result = extract_text_from_pdf(pdf, "sample.pdf")
    assert result.total_pages == 1
    assert result.filename == "sample.pdf"
    assert "Hello Ollie" in result.pages[0].text
    assert result.pages[0].page_number == 1
    assert result.pages[0].text_length == len(result.pages[0].text)


def test_extract_rejects_non_pdf_filename():
    with pytest.raises(PDFError) as exc:
        extract_text_from_pdf(b"%PDF-1.4", "note.txt")
    assert exc.value.status_code == 400


def test_extract_rejects_empty_filename():
    with pytest.raises(PDFError) as exc:
        extract_text_from_pdf(b"%PDF-1.4", "")
    assert exc.value.status_code == 400


@pytest.mark.parametrize(
    "filename",
    ["../evil.pdf", "/tmp/evil.pdf", "folder/file.pdf", r"folder\file.pdf"],
)
def test_extract_rejects_path_like_filenames(filename: str):
    pdf = _make_pdf("Hello Ollie")
    with pytest.raises(PDFError) as exc:
        extract_text_from_pdf(pdf, filename)
    assert exc.value.status_code == 400


def test_extract_wraps_invalid_pdf_as_processing_error():
    with pytest.raises(PDFError) as exc:
        extract_text_from_pdf(b"not a pdf", "broken.pdf")
    assert exc.value.status_code == 500


def test_extract_closes_document_when_text_extraction_fails(monkeypatch):
    closed = False

    class BrokenPage:
        def get_text(self):
            raise RuntimeError("boom")

    class BrokenDoc:
        def __len__(self):
            return 1

        def __iter__(self):
            return iter([BrokenPage()])

        def close(self):
            nonlocal closed
            closed = True

    monkeypatch.setattr(pdf_extract.pymupdf, "open", lambda _path: BrokenDoc())

    with pytest.raises(PDFError) as exc:
        extract_text_from_pdf(b"%PDF-1.4", "sample.pdf")

    assert exc.value.status_code == 500
    assert closed
