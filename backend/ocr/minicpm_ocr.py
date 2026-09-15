import os
import base64
from typing import Optional

try:
    from backend.services.ai_gateway import call_minicpm_vision_extraction
except ImportError:
    try:
        from services.ai_gateway import call_minicpm_vision_extraction
    except ImportError:
        call_minicpm_vision_extraction = None


def extract_text_with_minicpm_bytes(img_bytes: bytes) -> str:
    """
    Extracts text from image bytes using Model 1 (MiniCPM via Public Base API).
    Role: Content extraction ONLY. No summaries, no interpretations.
    """
    img_b64 = base64.b64encode(img_bytes).decode("utf-8")
    extracted_text = ""

    if call_minicpm_vision_extraction:
        try:
            extracted_text = call_minicpm_vision_extraction(img_b64)
        except Exception as e:
            print(f"[MINICPM OCR WARNING] Public Base API minicpm-v call failed: {e}", flush=True)

    # Fallback to RapidOCR if Public Base API minicpm-v is unreachable
    if not extracted_text:
        try:
            from rapidocr_onnxruntime import RapidOCR
            ocr_engine = RapidOCR()
            result, _ = ocr_engine(img_bytes)
            if result:
                lines = [line[1] for line in result if line and len(line) > 1]
                extracted_text = "\n".join(lines).strip()
        except Exception as ocr_err:
            print(f"[MINICPM OCR WARNING] RapidOCR fallback failed: {ocr_err}", flush=True)

    print("\n[MINICPM OCR OUTPUT]", flush=True)
    print(extracted_text, flush=True)

    return extracted_text


def extract_text_with_minicpm(image_path: str) -> str:
    """
    Extracts text from an image path using MiniCPM OCR model via Public Base API.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image path not found: {image_path}")

    with open(image_path, "rb") as img_file:
        img_bytes = img_file.read()

    return extract_text_with_minicpm_bytes(img_bytes)

