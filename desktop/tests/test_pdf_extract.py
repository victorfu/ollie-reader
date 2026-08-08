import re
from typing import Callable, List

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


def _build_pdf(builders: List[Callable[[pymupdf.Page], None]]) -> bytes:
    doc = pymupdf.open()
    for build in builders:
        page = doc.new_page()  # A4: 595 x 842
        build(page)
    data = doc.tobytes()
    doc.close()
    return data


def _page_texts(pdf: bytes) -> List[str]:
    result = extract_text_from_pdf(pdf, "sample.pdf")
    return [page.text for page in result.pages]


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


# ---------------------------------------------------------------------------
# 抽取品質：斷字、段落重排、CJK、多欄順序、頁首頁尾（與 purism-ev-bot 相同行為）
# ---------------------------------------------------------------------------


def test_dehyphenates_words_broken_across_lines():
    def build(page: pymupdf.Page) -> None:
        page.insert_text((72, 100), "This is useful informa-")
        page.insert_text((72, 113), "tion for readers")

    [text] = _page_texts(_build_pdf([build]))
    assert "information" in text
    assert "informa-" not in text


def test_reflows_lines_within_paragraph_and_keeps_paragraph_breaks():
    def build(page: pymupdf.Page) -> None:
        page.insert_text((72, 100), "First paragraph line one")
        page.insert_text((72, 113), "continues on line two.")
        page.insert_text((72, 300), "Second paragraph starts here")
        page.insert_text((72, 313), "and also wraps once.")

    [text] = _page_texts(_build_pdf([build]))
    assert "line one continues" in text
    assert "starts here and also" in text
    assert "\n\n" in text
    assert not re.search(r"(?<!\n)\n(?!\n)", text)


def test_cjk_lines_join_without_inserted_space():
    poem = "床前明月光疑是地上霜舉頭望明月低頭思故鄉"

    def build(page: pymupdf.Page) -> None:
        rect = pymupdf.Rect(72, 72, 200, 400)
        page.insert_textbox(rect, poem, fontname="china-ts", fontsize=14)

    [text] = _page_texts(_build_pdf([build]))
    assert poem in text


def test_orders_two_column_layout_column_by_column():
    title = "ENGLISH READING MIDTERM EXAMINATION PAPER SECTION A REVIEW"
    left = [
        "Left column sentence one.",
        "Left column sentence two.",
        "Left column sentence three.",
    ]
    right = [
        "Right column sentence one.",
        "Right column sentence two.",
        "Right column sentence three.",
    ]

    def build(page: pymupdf.Page) -> None:
        # 故意先寫右欄再寫左欄，模擬內容流順序與視覺順序不同的 PDF
        for i, sentence in enumerate(right):
            page.insert_text((320, 150 + i * 100), sentence)
        for i, sentence in enumerate(left):
            page.insert_text((50, 150 + i * 100), sentence)
        page.insert_text((50, 60), title)

    [text] = _page_texts(_build_pdf([build]))
    positions = [text.find(s) for s in [title, *left, *right]]
    assert all(p >= 0 for p in positions), f"missing sentences in: {text!r}"
    assert positions == sorted(positions), (
        f"expected title, then left column, then right column; got order in: {text!r}"
    )


def _page_with_chrome(n: int) -> Callable[[pymupdf.Page], None]:
    def build(page: pymupdf.Page) -> None:
        page.insert_text((72, 40), "Ollie Weekly Reader")
        page.insert_text((72, 400), f"Body content number {n} stays.")
        page.insert_text((72, 820), f"Page {n} of 4")

    return build


def test_strips_headers_and_footers_repeating_across_pages():
    texts = _page_texts(_build_pdf([_page_with_chrome(n) for n in range(1, 5)]))
    assert len(texts) == 4
    for n, text in enumerate(texts, start=1):
        assert f"Body content number {n} stays." in text
        assert "Ollie Weekly Reader" not in text
        assert f"Page {n} of 4" not in text


def test_keeps_bands_on_short_documents():
    # 頁數太少時不做頁首頁尾判定，避免誤刪正文
    texts = _page_texts(_build_pdf([_page_with_chrome(n) for n in range(1, 3)]))
    assert len(texts) == 2
    for n, text in enumerate(texts, start=1):
        assert "Ollie Weekly Reader" in text
        assert f"Page {n} of 4" in text


def test_empty_page_yields_empty_text():
    result = extract_text_from_pdf(
        _build_pdf([lambda page: None]), "empty.pdf"
    )
    assert result.pages[0].text == ""
    assert result.pages[0].text_length == 0


def test_extract_wraps_invalid_pdf_as_processing_error():
    with pytest.raises(PDFError) as exc:
        extract_text_from_pdf(b"not a pdf", "broken.pdf")
    assert exc.value.status_code == 500


def test_extract_closes_document_when_text_extraction_fails(monkeypatch):
    closed = False

    class BrokenPage:
        rect = pymupdf.Rect(0, 0, 595, 842)

        def get_text(self, *args, **kwargs):
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
