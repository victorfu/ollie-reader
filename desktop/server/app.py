"""ollie-reader 本機 sidecar：pdf/tts/ktts + version，REST，合約與雲端一致。"""

import io
import logging

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from server.config import CORS_ORIGINS, VERSION
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
