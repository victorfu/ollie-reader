"""PDF 文字提取（複製自 purism-ev-bot services/pdf_service.py，合約一致）。"""

import logging
import os
import tempfile
from dataclasses import dataclass
from pathlib import PurePosixPath, PureWindowsPath
from typing import List

import pymupdf

logger = logging.getLogger(__name__)


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


def _is_path_like_filename(filename: str) -> bool:
    return (
        PurePosixPath(filename).name != filename
        or PureWindowsPath(filename).name != filename
    )


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
                pages_text: List[PageText] = []
                for page_num, page in enumerate(doc):
                    page_text = page.get_text()
                    pages_text.append(
                        PageText(
                            page_number=page_num + 1,
                            text=page_text,
                            text_length=len(page_text),
                        )
                    )
            finally:
                if doc is not None:
                    doc.close()

            return PDFExtractResult(
                filename=filename,
                total_pages=page_count,
                pages=pages_text,
            )
    except PDFError:
        raise
    except Exception as e:
        logger.error(f"PDF 處理失敗: {e}", exc_info=True)
        raise PDFError(f"PDF 處理失敗: {e}", status_code=500)
