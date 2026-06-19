from typing import Optional
from pydantic import BaseModel


class SpeechRequest(BaseModel):
    text: str
    speed: float = 1.0
    voice: Optional[str] = None
