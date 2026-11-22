import base64
import io
import os
from typing import Annotated, Any
from uuid import UUID

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, status
from jwt import InvalidTokenError
from PIL import Image
from pydantic import BaseModel

app = FastAPI(title="LumiPlan OCR Service", version="0.1.0")


class OCRRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/png"
    enable_layout: bool = False
    enable_table: bool = False
    lang: str = "vi"


class OCRBlock(BaseModel):
    text: str
    confidence: float
    bbox: list[list[float]] = []
    block_type: str = "text"


class OCRExtractResponse(BaseModel):
    text: str
    blocks: list[OCRBlock] = []
    tables_html: list[str] = []
    avg_confidence: float = 0.0
    engine: str = "paddleocr"


def verify_s2s(authorization: Annotated[str | None, Header()] = None) -> UUID:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing S2S token")
    token = authorization.split(" ", 1)[1].strip()
    secret = os.getenv("S2S_SIGNING_SECRET", "")
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"], audience="ocr-service")
        return UUID(str(payload["sub"]))
    except (InvalidTokenError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid S2S token") from exc


_ocr_instance: Any = None


def _get_paddle_ocr(lang: str) -> Any | None:
    global _ocr_instance
    if _ocr_instance is not None:
        return _ocr_instance
    try:
        from paddleocr import PaddleOCR  # type: ignore[import-not-found]

        _ocr_instance = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
        return _ocr_instance
    except (ImportError, RuntimeError, OSError, ValueError):
        return None


@app.get("/health/live")
async def health_live() -> dict[str, str]:
    return {"status": "alive"}


@app.get("/health/ready")
async def health_ready() -> dict[str, str]:
    return {"status": "ready"}


@app.post("/internal/v1/ocr/extract", response_model=OCRExtractResponse)
async def extract_ocr(
    payload: OCRRequest,
    _: Annotated[UUID, Depends(verify_s2s)],
) -> OCRExtractResponse:
    raw = base64.b64decode(payload.image_base64)
    img = Image.open(io.BytesIO(raw))
    img.verify()

    engine = _get_paddle_ocr(payload.lang)
    if engine is None:
        return OCRExtractResponse(
            text="",
            blocks=[],
            tables_html=[],
            avg_confidence=0.0,
            engine="paddleocr_unavailable_fallback_vision",
        )

    import numpy as np  # type: ignore[import-not-found]

    rgb = Image.open(io.BytesIO(raw)).convert("RGB")
    result = engine.ocr(np.array(rgb), cls=True)
    blocks: list[OCRBlock] = []
    lines: list[str] = []
    confs: list[float] = []
    for page in result or []:
        for line in page or []:
            bbox, (txt, conf) = line[0], line[1]
            lines.append(str(txt))
            confs.append(float(conf))
            blocks.append(OCRBlock(text=str(txt), confidence=float(conf), bbox=bbox, block_type="text"))

    avg_conf = round(sum(confs) / len(confs), 3) if confs else 0.0
    return OCRExtractResponse(
        text="\n".join(lines),
        blocks=blocks,
        tables_html=[],
        avg_confidence=avg_conf,
        engine="paddleocr",
    )
