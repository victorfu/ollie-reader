"""ollie-reader 本機 sidecar：pdf/tts/ktts + version，REST，合約與雲端一致。"""

import io
import logging

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

from server.config import CORS_ORIGINS, VERSION
from server.fetch_url import FetchError, fetch_url_content_async
from server.models import SpeechRequest
from server.pdf_extract import PDFError, extract_text_from_pdf
from server.tts_kokoro import KokoroTTSError, kokoro_synthesize_speech
from server.tts_piper import TTSError, generate_speech

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title="ollie-reader local sidecar", version=VERSION)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_private_network=True,
    )

    @app.get("/api/version", tags=["meta"])
    async def version():
        return {"version": VERSION, "engine": "local-sidecar"}

    @app.get("/api/fetch-url", tags=["utility"])
    async def fetch_url(
        url: str = Query(..., description="要抓取的網址 URL"),
        follow_redirects: bool = Query(True, description="是否自動跟隨重定向"),
        max_redirects: int = Query(10, ge=1, le=30, description="最大重定向次數 (1-30)"),
        timeout: int = Query(30, ge=1, le=120, description="請求超時時間(秒) (1-120)"),
    ):
        """代抓指定 URL 的檔案內容並回傳（合約與雲端一致）。"""
        try:
            result = await fetch_url_content_async(
                url=url,
                follow_redirects=follow_redirects,
                max_redirects=max_redirects,
                timeout=timeout,
            )
        except FetchError as e:
            raise HTTPException(status_code=e.status_code, detail=e.message) from e
        except Exception as e:
            logger.exception("URL 抓取未預期錯誤")
            raise HTTPException(
                status_code=500, detail="伺服器錯誤，請稍後再試"
            ) from e

        headers = {
            "Content-Type": result.content_type,
            "Content-Length": str(len(result.content)),
            "X-Final-URL": result.final_url,
            "X-Redirect-Count": str(result.redirect_count),
            "X-File-Extension": result.file_extension,
            "Content-Disposition": result.content_disposition,
        }
        return Response(
            content=result.content,
            headers=headers,
            media_type=result.content_type,
        )

    @app.post("/api/pdf/extract", tags=["pdf"])
    async def extract_pdf(file: UploadFile = File(...)):
        try:
            filename = file.filename or "unknown.pdf"
            content = await file.read()
            result = await run_in_threadpool(extract_text_from_pdf, content, filename)
        except PDFError as e:
            raise HTTPException(status_code=e.status_code, detail=e.message) from e
        except Exception as e:
            logger.exception("未預期的 PDF 處理失敗")
            raise HTTPException(status_code=500, detail="PDF 處理失敗") from e
        return {
            "status": "success",
            "filename": result.filename,
            "total_pages": result.total_pages,
            "pages": [
                {
                    "page_number": p.page_number,
                    "text": p.text,
                    "text_length": p.text_length,
                }
                for p in result.pages
            ],
        }

    @app.post("/api/tts", tags=["tts"])
    async def tts(request: SpeechRequest):
        length_scale = (
            min(2.0, max(0.1, 1.0 / request.speed)) if request.speed > 0 else 1.0
        )
        try:
            speaker = int(request.voice) if request.voice else 0
        except (ValueError, TypeError) as e:
            raise HTTPException(
                status_code=400,
                detail="Piper 的 voice 必須為整數 speaker id",
            ) from e
        try:
            result = await run_in_threadpool(
                generate_speech,
                request.text,
                speaker,
                length_scale,
            )
        except TTSError as e:
            raise HTTPException(status_code=e.status_code, detail=e.message) from e
        except Exception as e:
            logger.exception("未預期的 Piper TTS 失敗")
            raise HTTPException(status_code=500, detail="語音合成失敗") from e
        return StreamingResponse(
            io.BytesIO(result.audio_data),
            media_type=result.content_type,
            headers={"Content-Disposition": 'attachment; filename="speech.wav"'},
        )

    @app.post("/api/ktts", tags=["tts"])
    async def ktts(request: SpeechRequest):
        try:
            result = await run_in_threadpool(
                kokoro_synthesize_speech,
                request.text,
                request.speed,
                request.voice,
            )
        except KokoroTTSError as e:
            raise HTTPException(status_code=e.status_code, detail=e.message) from e
        except Exception as e:
            logger.exception("未預期的 Kokoro TTS 失敗")
            raise HTTPException(status_code=500, detail="Kokoro 語音合成失敗") from e
        return StreamingResponse(
            io.BytesIO(result.audio_data),
            media_type=result.content_type,
            headers={"Content-Disposition": 'attachment; filename="speech.wav"'},
        )

    return app


app = create_app()
