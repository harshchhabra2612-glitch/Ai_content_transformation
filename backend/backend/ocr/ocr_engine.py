import os
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

@dataclass
class OCRBlock:
    type: str  # "heading" | "paragraph" | "bullet" | "label"
    text: str
    confidence: float = 1.0

@dataclass
class OCRResult:
    text: str
    page: int
    confidence: float
    blocks: List[Dict[str, Any]] = field(default_factory=list)
    ocr_low_quality: bool = False
    characters: int = 0
    words: int = 0


class OCREngine:
    """
    Production-grade OCR Engine abstraction layer for document image extraction.
    Reconstructs logical reading order, heading levels, bullet items, and structural blocks.
    """

    def __init__(self, dpi: int = 300):
        self.dpi = dpi
        self._rapid_ocr = None

    def _get_rapid_ocr(self):
        if self._rapid_ocr is None:
            try:
                from rapidocr_onnxruntime import RapidOCR
                self._rapid_ocr = RapidOCR()
            except Exception as e:
                print(f"[OCR ENGINE ERROR] Could not initialize RapidOCR: {e}")
                self._rapid_ocr = False
        return self._rapid_ocr if self._rapid_ocr is not False else None

    def extract_text_from_image_bytes(self, img_bytes: bytes, page_number: int = 1) -> OCRResult:
        ocr = self._get_rapid_ocr()
        if not ocr:
            return OCRResult(text="", page=page_number, confidence=0.0, ocr_low_quality=True)

        try:
            result, _ = ocr(img_bytes)
        except Exception as err:
            print(f"[OCR ENGINE EXCEPTION] Page {page_number}: {err}")
            return OCRResult(text="", page=page_number, confidence=0.0, ocr_low_quality=True)

        if not result:
            return OCRResult(text="", page=page_number, confidence=0.0, ocr_low_quality=True)

        raw_items = []
        confidences = []

        for item in result:
            bbox = item[0]
            text = str(item[1]).strip()
            score = float(item[2]) if len(item) > 2 else 0.8
            if text:
                ys = [p[1] for p in bbox]
                xs = [p[0] for p in bbox]
                y_center = sum(ys) / len(ys)
                x_left = min(xs)
                raw_items.append({"y": y_center, "x": x_left, "text": text, "score": score})
                confidences.append(score)

        if not raw_items:
            return OCRResult(text="", page=page_number, confidence=0.0, ocr_low_quality=True)

        # Reconstruct reading order: sort vertically first
        raw_items.sort(key=lambda i: i["y"])
        line_groups = []
        curr_group = []

        for item in raw_items:
            if not curr_group:
                curr_group.append(item)
            elif abs(item["y"] - curr_group[0]["y"]) <= 18:
                curr_group.append(item)
            else:
                curr_group.sort(key=lambda i: i["x"])
                line_groups.append(" ".join(i["text"] for i in curr_group))
                curr_group = [item]

        if curr_group:
            curr_group.sort(key=lambda i: i["x"])
            line_groups.append(" ".join(i["text"] for i in curr_group))

        blocks = []
        structured_lines = []

        for line in line_groups:
            clean_line = line.strip()
            if not clean_line:
                continue

            # Classify structural block type
            if clean_line.isupper() and len(clean_line) < 60:
                block_type = "heading"
                formatted_line = f"### {clean_line}"
            elif clean_line.startswith("-") or clean_line.startswith("•") or clean_line.startswith("→"):
                block_type = "bullet"
                formatted_line = f"- {clean_line.lstrip('-•→ ').strip()}"
            elif ":" in clean_line and len(clean_line.split(":")[0]) < 35:
                block_type = "label"
                formatted_line = clean_line
            else:
                block_type = "paragraph"
                formatted_line = clean_line

            blocks.append({"type": block_type, "text": clean_line})
            structured_lines.append(formatted_line)

        normalized_text = "\n\n".join(structured_lines)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        words = len(normalized_text.split())
        chars = len(normalized_text)
        is_low_quality = chars < 30 or avg_confidence < 0.3

        return OCRResult(
            text=normalized_text,
            page=page_number,
            confidence=round(avg_confidence, 4),
            blocks=blocks,
            ocr_low_quality=is_low_quality,
            characters=chars,
            words=words
        )

    def extract_text_from_image_path(self, image_path: str, page_number: int = 1) -> OCRResult:
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found at {image_path}")
        with open(image_path, "rb") as f:
            return self.extract_text_from_image_bytes(f.read(), page_number=page_number)
