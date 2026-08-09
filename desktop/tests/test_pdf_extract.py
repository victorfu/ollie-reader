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


def _word(page, text: str):
    return next(word for word in page.words if word.text == text)


def test_extract_returns_pages_with_text():
    pdf = _make_pdf("Hello Ollie")
    result = extract_text_from_pdf(pdf, "sample.pdf")
    assert result.total_pages == 1
    assert result.filename == "sample.pdf"
    assert "Hello Ollie" in result.pages[0].text
    assert result.pages[0].page_number == 1
    assert result.pages[0].text_length == len(result.pages[0].text)


def test_extract_returns_page_geometry_and_native_word_boxes():
    result = extract_text_from_pdf(_make_pdf("Hello Ollie"), "sample.pdf")

    page = result.pages[0]
    assert page.width == pytest.approx(595, abs=1)
    assert page.height == pytest.approx(842, abs=1)
    assert [word.text for word in page.words] == ["Hello", "Ollie"]
    for word in page.words:
        assert 0 <= word.x0 < word.x1 <= page.width
        assert 0 <= word.y0 < word.y1 <= page.height


def test_word_boxes_are_normalized_to_cropbox_and_page_rotation():
    doc = pymupdf.open()

    uncropped = doc.new_page(width=600, height=800)
    uncropped.insert_text((100, 150), "Anchor", fontsize=20)

    cropped = doc.new_page(width=600, height=800)
    cropped.insert_text((100, 150), "Anchor", fontsize=20)
    cropped.set_cropbox(pymupdf.Rect(50, 100, 550, 700))

    rotated = doc.new_page(width=600, height=800)
    rotated.insert_text((100, 150), "Anchor", fontsize=20)
    rotated.set_cropbox(pymupdf.Rect(50, 100, 550, 700))
    rotated.set_rotation(90)

    upside_down = doc.new_page(width=600, height=800)
    upside_down.insert_text((100, 150), "Anchor", fontsize=20)
    upside_down.set_cropbox(pymupdf.Rect(50, 100, 550, 700))
    upside_down.set_rotation(180)

    rotated_left = doc.new_page(width=600, height=800)
    rotated_left.insert_text((100, 150), "Anchor", fontsize=20)
    rotated_left.set_cropbox(pymupdf.Rect(50, 100, 550, 700))
    rotated_left.set_rotation(270)

    data = doc.tobytes()
    doc.close()

    (
        base_page,
        crop_page,
        rotated_page,
        upside_down_page,
        rotated_left_page,
    ) = extract_text_from_pdf(data, "geometry.pdf").pages
    base_word = _word(base_page, "Anchor")
    crop_word = _word(crop_page, "Anchor")
    rotated_word = _word(rotated_page, "Anchor")
    upside_down_word = _word(upside_down_page, "Anchor")
    rotated_left_word = _word(rotated_left_page, "Anchor")

    assert (crop_page.width, crop_page.height) == pytest.approx((500, 600))
    assert crop_word.x0 == pytest.approx(base_word.x0 - 50, abs=0.02)
    assert crop_word.y0 == pytest.approx(base_word.y0 - 100, abs=0.02)
    assert crop_word.x1 == pytest.approx(base_word.x1 - 50, abs=0.02)
    assert crop_word.y1 == pytest.approx(base_word.y1 - 100, abs=0.02)

    assert (rotated_page.width, rotated_page.height) == pytest.approx((600, 500))
    assert rotated_word.x0 == pytest.approx(
        crop_page.height - crop_word.y1, abs=0.02
    )
    assert rotated_word.y0 == pytest.approx(crop_word.x0, abs=0.02)
    assert rotated_word.x1 == pytest.approx(
        crop_page.height - crop_word.y0, abs=0.02
    )
    assert rotated_word.y1 == pytest.approx(crop_word.x1, abs=0.02)

    assert (upside_down_page.width, upside_down_page.height) == pytest.approx(
        (500, 600)
    )
    assert upside_down_word.x0 == pytest.approx(
        crop_page.width - crop_word.x1, abs=0.02
    )
    assert upside_down_word.y0 == pytest.approx(
        crop_page.height - crop_word.y1, abs=0.02
    )
    assert upside_down_word.x1 == pytest.approx(
        crop_page.width - crop_word.x0, abs=0.02
    )
    assert upside_down_word.y1 == pytest.approx(
        crop_page.height - crop_word.y0, abs=0.02
    )

    assert (rotated_left_page.width, rotated_left_page.height) == pytest.approx(
        (600, 500)
    )
    assert rotated_left_word.x0 == pytest.approx(crop_word.y0, abs=0.02)
    assert rotated_left_word.y0 == pytest.approx(
        crop_page.width - crop_word.x1, abs=0.02
    )
    assert rotated_left_word.x1 == pytest.approx(crop_word.y1, abs=0.02)
    assert rotated_left_word.y1 == pytest.approx(
        crop_page.width - crop_word.x0, abs=0.02
    )


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

    [page] = extract_text_from_pdf(
        _build_pdf([build]), "dehyphenated.pdf"
    ).pages
    assert "information" in page.text
    assert "informa-" not in page.text
    # Geometry follows what is visibly painted. A word split across two lines
    # must not become one large rectangle spanning both lines.
    assert "informa-" in [word.text for word in page.words]
    assert "tion" in [word.text for word in page.words]


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

    [page] = extract_text_from_pdf(_build_pdf([build]), "columns.pdf").pages
    positions = [page.text.find(s) for s in [title, *left, *right]]
    assert all(p >= 0 for p in positions), f"missing sentences in: {page.text!r}"
    assert positions == sorted(positions), (
        "expected title, then left column, then right column; "
        f"got order in: {page.text!r}"
    )
    assert [
        word.text for word in page.words if word.text in {"ENGLISH", "Left", "Right"}
    ] == ["ENGLISH", "Left", "Left", "Left", "Right", "Right", "Right"]


def _page_with_chrome(n: int) -> Callable[[pymupdf.Page], None]:
    def build(page: pymupdf.Page) -> None:
        page.insert_text((72, 40), "Ollie Weekly Reader")
        page.insert_text((72, 400), f"Body content number {n} stays.")
        page.insert_text((72, 820), f"Page {n} of 4")

    return build


def test_strips_headers_and_footers_repeating_across_pages():
    pages = extract_text_from_pdf(
        _build_pdf([_page_with_chrome(n) for n in range(1, 5)]), "chrome.pdf"
    ).pages
    assert len(pages) == 4
    for n, page in enumerate(pages, start=1):
        assert f"Body content number {n} stays." in page.text
        assert "Ollie Weekly Reader" not in page.text
        assert f"Page {n} of 4" not in page.text
        visible_words = [word.text for word in page.words]
        assert "Ollie" in visible_words
        assert "Weekly" in visible_words
        assert "Reader" in visible_words
        assert "Page" in visible_words


def test_strips_repeating_header_using_rotated_viewport_coordinates():
    def page_with_rotated_chrome(n: int) -> Callable[[pymupdf.Page], None]:
        def build(page: pymupdf.Page) -> None:
            # With /Rotate 90, displayed y is the unrotated x coordinate.
            # This text therefore appears in the top band only after its block
            # rectangle is normalized with page.rotation_matrix.
            page.insert_text((10, 100), "Chrome")
            page.insert_text((250, 400), f"Body {n} stays")
            page.set_rotation(90)

        return build

    pages = extract_text_from_pdf(
        _build_pdf([page_with_rotated_chrome(n) for n in range(1, 5)]),
        "rotated-chrome.pdf",
    ).pages

    for n, page in enumerate(pages, start=1):
        assert f"Body {n} stays" in page.text
        assert "Chrome" not in page.text
        assert "Chrome" in [word.text for word in page.words]


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
    page = result.pages[0]
    assert page.text == ""
    assert page.text_length == 0
    assert page.width == pytest.approx(595, abs=1)
    assert page.height == pytest.approx(842, abs=1)
    assert page.words == []


def test_extract_wraps_invalid_pdf_as_processing_error():
    with pytest.raises(PDFError) as exc:
        extract_text_from_pdf(b"not a pdf", "broken.pdf")
    assert exc.value.status_code == 500


def test_extract_closes_document_when_text_extraction_fails(monkeypatch):
    closed = False

    class BrokenPage:
        rect = pymupdf.Rect(0, 0, 595, 842)
        rotation_matrix = pymupdf.Matrix()

        def get_textpage(self, *args, **kwargs):
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
