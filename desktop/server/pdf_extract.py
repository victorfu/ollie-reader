"""PDF 文字提取（複製自 purism-ev-bot services/pdf_service.py，合約一致）。

抽取管線（提升朗讀與選字精準度）：
1. pymupdf blocks 模式 + 展開連字（ﬁ→fi）+ 行尾斷字接回
2. 段落重排：block 內軟換行接成空格（CJK 相鄰不插空格），block 間留空行
3. 頁首頁尾：跨頁重複出現在頁面上下帶的 block（頁碼數字先正規化）整份移除
4. 閱讀順序：跨欄 block 當作分段線，帶內窄 block 依 x 區間分欄，由左欄到右欄
"""

import logging
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import PurePosixPath, PureWindowsPath
from typing import Dict, List, Optional, Set, Tuple

import pymupdf

logger = logging.getLogger(__name__)

# 展開連字、行尾斷字接回；其餘沿用 blocks 模式預設
_EXTRACT_FLAGS = (
    pymupdf.TEXTFLAGS_BLOCKS & ~pymupdf.TEXT_PRESERVE_LIGATURES
) | pymupdf.TEXT_DEHYPHENATE

_HEADER_FOOTER_BAND = 0.12  # 頁高上下各 12% 視為頁首/頁尾帶
_MIN_PAGES_FOR_BAND_STRIP = 3  # 頁數低於此值不判定頁首頁尾，避免誤刪正文
_WIDE_BLOCK_RATIO = 0.6  # 佔內容寬度 60% 以上視為跨欄（標題/分隔）block


@dataclass
class PageText:
    page_number: int
    text: str
    text_length: int


@dataclass
class PDFExtractResult:
    filename: str
    total_pages: int
    pages: List[PageText]


class PDFError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


@dataclass
class _Block:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str


def _is_path_like_filename(filename: str) -> bool:
    return (
        PurePosixPath(filename).name != filename
        or PureWindowsPath(filename).name != filename
    )


def _is_cjk_char(ch: str) -> bool:
    code = ord(ch)
    return (
        0x3000 <= code <= 0x30FF  # CJK 標點、假名
        or 0x3400 <= code <= 0x4DBF  # 擴展 A
        or 0x4E00 <= code <= 0x9FFF  # 基本區
        or 0xAC00 <= code <= 0xD7AF  # 諺文
        or 0xF900 <= code <= 0xFAFF  # 相容表意文字
        or 0xFF00 <= code <= 0xFFEF  # 全形符號
    )


def _reflow_lines(raw: str) -> str:
    """把 block 內的多行接成一個段落：CJK 相鄰直接連接，其餘以空格連接。"""
    text = ""
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        if not text:
            text = line
        elif text.endswith("-") and line[0].isalpha():
            # 行尾斷字（TEXT_DEHYPHENATE 沒接到的保險）：小寫接續去掉連字號
            text = (text[:-1] if line[0].islower() else text) + line
        elif _is_cjk_char(text[-1]) and _is_cjk_char(line[0]):
            text += line
        else:
            text += " " + line
    return text


def _collect_page_blocks(page: "pymupdf.Page") -> List[_Block]:
    blocks: List[_Block] = []
    for x0, y0, x1, y1, raw, _block_no, block_type in page.get_text(
        "blocks", flags=_EXTRACT_FLAGS
    ):
        if block_type != 0:  # 只取文字 block，略過圖片
            continue
        text = _reflow_lines(raw)
        if text:
            blocks.append(_Block(x0, y0, x1, y1, text))
    return blocks


def _template_key(text: str) -> str:
    """頁首頁尾比對用的正規化 key：壓縮空白、數字換成 #（頁碼每頁不同）。"""
    return re.sub(r"\d+", "#", re.sub(r"\s+", " ", text).strip()).lower()


def _band_entry(block: _Block, page_height: float) -> Optional[Tuple[str, str]]:
    if page_height <= 0:
        return None
    if block.y1 <= page_height * _HEADER_FOOTER_BAND:
        return ("header", _template_key(block.text))
    if block.y0 >= page_height * (1 - _HEADER_FOOTER_BAND):
        return ("footer", _template_key(block.text))
    return None


def _repeating_band_templates(
    page_blocks: List[List[_Block]], page_heights: List[float]
) -> Set[Tuple[str, str]]:
    """找出在多數頁面的上下帶重複出現的頁首/頁尾樣板。"""
    page_count = len(page_blocks)
    if page_count < _MIN_PAGES_FOR_BAND_STRIP:
        return set()
    counts: Dict[Tuple[str, str], int] = {}
    for blocks, height in zip(page_blocks, page_heights):
        seen = {
            entry
            for block in blocks
            if (entry := _band_entry(block, height)) is not None
        }
        for entry in seen:
            counts[entry] = counts.get(entry, 0) + 1
    threshold = max(_MIN_PAGES_FOR_BAND_STRIP, (page_count + 1) // 2)
    return {entry for entry, count in counts.items() if count >= threshold}


def _order_band(blocks: List[_Block]) -> List[_Block]:
    """帶內排序：能依 x 區間切成多欄就逐欄輸出，否則按 (y, x)。"""
    by_position = sorted(blocks, key=lambda b: (b.y0, b.x0))
    if len(blocks) <= 1:
        return by_position
    columns: List[List[_Block]] = []
    right_edge = 0.0
    for block in sorted(blocks, key=lambda b: (b.x0, b.y0)):
        if columns and block.x0 > right_edge:  # 與前欄無重疊 → 新的一欄
            columns.append([block])
        elif columns:
            columns[-1].append(block)
        else:
            columns = [[block]]
        right_edge = max(right_edge, block.x1)
    if len(columns) < 2:
        return by_position
    ordered: List[_Block] = []
    for column in columns:  # 已由左至右
        ordered.extend(sorted(column, key=lambda b: (b.y0, b.x0)))
    return ordered


def _order_blocks(blocks: List[_Block]) -> List[_Block]:
    """整頁閱讀順序：跨欄 block 由上而下當分段線，其間的窄 block 逐帶分欄排序。"""
    if len(blocks) <= 1:
        return list(blocks)
    content_width = max(b.x1 for b in blocks) - min(b.x0 for b in blocks)
    if content_width <= 0:
        return sorted(blocks, key=lambda b: (b.y0, b.x0))
    wide = sorted(
        (b for b in blocks if b.x1 - b.x0 >= content_width * _WIDE_BLOCK_RATIO),
        key=lambda b: (b.y0, b.x0),
    )
    wide_ids = {id(b) for b in wide}
    wide_centers = [(w.y0 + w.y1) / 2 for w in wide]
    bands: Dict[int, List[_Block]] = {}
    for block in blocks:
        if id(block) in wide_ids:
            continue
        center = (block.y0 + block.y1) / 2
        band = sum(1 for wc in wide_centers if wc < center)
        bands.setdefault(band, []).append(block)
    ordered: List[_Block] = []
    for band in range(len(wide) + 1):
        ordered.extend(_order_band(bands.get(band, [])))
        if band < len(wide):
            ordered.append(wide[band])
    return ordered


def _pages_to_text(
    page_blocks: List[List[_Block]], page_heights: List[float]
) -> List[PageText]:
    strip = _repeating_band_templates(page_blocks, page_heights)
    pages: List[PageText] = []
    for index, (blocks, height) in enumerate(zip(page_blocks, page_heights)):
        body = [
            block
            for block in blocks
            if (entry := _band_entry(block, height)) is None or entry not in strip
        ]
        text = "\n\n".join(block.text for block in _order_blocks(body))
        pages.append(
            PageText(page_number=index + 1, text=text, text_length=len(text))
        )
    return pages


def extract_text_from_pdf(file_content: bytes, filename: str) -> PDFExtractResult:
    if not filename:
        raise PDFError("檔案名稱不能為空", status_code=400)
    if _is_path_like_filename(filename):
        raise PDFError("檔案名稱不能包含路徑", status_code=400)
    if not filename.lower().endswith(".pdf"):
        raise PDFError("只允許上傳 PDF 檔案", status_code=400)

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_file_path = os.path.join(temp_dir, "upload.pdf")
            with open(temp_file_path, "wb") as buffer:
                buffer.write(file_content)

            doc = None
            try:
                doc = pymupdf.open(temp_file_path)
                page_count = len(doc)
                page_blocks: List[List[_Block]] = []
                page_heights: List[float] = []
                for page in doc:
                    page_heights.append(page.rect.height)
                    page_blocks.append(_collect_page_blocks(page))
            finally:
                if doc is not None:
                    doc.close()

            return PDFExtractResult(
                filename=filename,
                total_pages=page_count,
                pages=_pages_to_text(page_blocks, page_heights),
            )
    except PDFError:
        raise
    except Exception as e:
        logger.error(f"PDF 處理失敗: {e}", exc_info=True)
        raise PDFError(f"PDF 處理失敗: {e}", status_code=500)
