import os
import io
from typing import Union, Dict, Any, List

import pymupdf as fitz
from docx import Document
from pptx import Presentation
from openpyxl import load_workbook

try:
    from backend.ocr.ocr_engine import OCREngine
except ImportError:
    try:
        from ocr.ocr_engine import OCREngine
    except ImportError:
        from ocr_engine import OCREngine

_ocr_engine_instance = None

def get_ocr_engine() -> OCREngine:
    global _ocr_engine_instance
    if _ocr_engine_instance is None:
        _ocr_engine_instance = OCREngine(dpi=300)
    return _ocr_engine_instance


try:
    from backend.debug_store import (
        init_debug_record,
        record_debug_native_page,
        record_debug_minicpm,
        record_debug_final_text
    )
except ImportError:
    try:
        from debug_store import (
            init_debug_record,
            record_debug_native_page,
            record_debug_minicpm,
            record_debug_final_text
        )
    except ImportError:
        init_debug_record = lambda *a, **k: None
        record_debug_native_page = lambda *a, **k: None
        record_debug_minicpm = lambda *a, **k: None
        record_debug_final_text = lambda *a, **k: None


def parse_document(file_source: Union[str, bytes], filename: str = "", document_id: str = "") -> Dict[str, Any]:
    """
    Parses a document (PDF, TXT, DOCX, PPTX, XLSX) from a file path or raw bytes,
    and returns a standardized output payload while logging diagnostic telemetry.
    """
    if isinstance(file_source, str):
        if not filename:
            filename = os.path.basename(file_source)
        if not os.path.exists(file_source):
            raise ValueError(f"File not found: '{file_source}'")
        try:
            with open(file_source, "rb") as f:
                file_bytes = f.read()
        except Exception as e:
            raise ValueError(f"Could not read file '{filename}': {str(e)}")
    else:
        file_bytes = file_source

    if not file_bytes or len(file_bytes) == 0:
        raise ValueError(f"File '{filename or 'upload'}' is empty (0 bytes).")

    ext = os.path.splitext(filename)[1].lower().lstrip(".")
    if not ext:
        raise ValueError(f"Unable to determine file extension from filename '{filename}'.")

    supported_extensions = {"pdf", "txt", "docx", "pptx", "xlsx"}
    if ext not in supported_extensions:
        raise ValueError(
            f"Unsupported file type '.{ext}'. Supported extensions are: {', '.join(sorted(supported_extensions))}."
        )

    doc_id = document_id or filename
    init_debug_record(doc_id, filename, ext)

    try:
        if ext == "pdf":
            pages = _parse_pdf(file_bytes, filename=filename, document_id=doc_id)
        elif ext == "txt":
            pages = _parse_txt(file_bytes, document_id=doc_id)
        elif ext == "docx":
            pages = _parse_docx(file_bytes, document_id=doc_id)
        elif ext == "pptx":
            pages = _parse_pptx(file_bytes, document_id=doc_id)
        elif ext == "xlsx":
            pages = _parse_xlsx(file_bytes, document_id=doc_id)
        else:
            raise ValueError(f"Unsupported file type '.{ext}'.")
    except ValueError as ve:
        raise ve
    except Exception as e:
        raise ValueError(f"Failed to extract content from .{ext} file '{filename}': {str(e)}")

    if not pages or all(not p.get("text", "").strip() for p in pages):
        raise ValueError("The uploaded document could not be read or no relevant content was retrieved.")

    total_extracted_text = "\n\n".join(p.get("text", "").strip() for p in pages if p.get("text", "").strip())
    record_debug_final_text(doc_id, total_extracted_text)

    return {
        "filename": filename,
        "file_type": ext,
        "page_count": len(pages),
        "total_characters": sum(len(p.get("text", "")) for p in pages),
        "total_words": sum(len(p.get("text", "").split()) for p in pages),
        "pages": pages
    }


def _parse_pdf(file_bytes: bytes, filename: str = "", document_id: str = "") -> List[Dict[str, Any]]:
    pdf = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    total_pages = len(pdf)
    ocr_engine = get_ocr_engine()

    for page_number, page in enumerate(pdf):
        native_text = (page.get_text() or "").strip()
        record_debug_native_page(document_id or filename, page_number + 1, native_text)

        text = native_text
        ocr_required = len(native_text) < 30
        blocks = []
        confidence = 1.0
        ocr_low_quality = False

        if ocr_required:
            try:
                pix = page.get_pixmap(dpi=300)
                img_bytes = pix.tobytes("png")
                
                try:
                    from backend.ocr.minicpm_ocr import extract_text_with_minicpm_bytes
                except ImportError:
                    try:
                        from ocr.minicpm_ocr import extract_text_with_minicpm_bytes
                    except ImportError:
                        extract_text_with_minicpm_bytes = None

                minicpm_text = extract_text_with_minicpm_bytes(img_bytes) if extract_text_with_minicpm_bytes else ""
                if minicpm_text and minicpm_text.strip():
                    text = minicpm_text.strip()
                    confidence = 0.95
                    record_debug_minicpm(document_id or filename, minicpm_text.strip())
                else:
                    ocr_res = ocr_engine.extract_text_from_image_bytes(img_bytes, page_number=page_number + 1)
                    if ocr_res.text.strip():
                        text = ocr_res.text.strip()
                        blocks = ocr_res.blocks
                        confidence = ocr_res.confidence
                        ocr_low_quality = ocr_res.ocr_low_quality
                        record_debug_minicpm(document_id or filename, ocr_res.text.strip())
            except Exception as err:
                print(f"[MINICPM / OCR ERROR] Page {page_number + 1} processing failed: {err}")

        words = text.split()
        pages.append({
            "page": page_number + 1,
            "text": text.strip(),
            "blocks": blocks,
            "characters": len(text),
            "words": len(words),
            "confidence": confidence,
            "ocr_used": ocr_required,
            "ocr_low_quality": ocr_low_quality
        })

    pdf.close()

    total_chars = sum(p.get("characters", 0) for p in pages)
    if total_chars == 0:
        raise ValueError(f"No text content could be extracted from PDF '{filename}'.")

    return pages


def _parse_txt(file_bytes: bytes, document_id: str = "") -> List[Dict[str, Any]]:
    text = ""
    for encoding in ["utf-8", "utf-8-sig", "latin-1", "cp1252", "utf-16"]:
        try:
            text = file_bytes.decode(encoding)
            break
        except Exception:
            continue
    if not text:
        text = file_bytes.decode("utf-8", errors="replace")

    clean_text = text.strip()
    record_debug_native_page(document_id, 1, clean_text)
    return [{
        "page": 1,
        "text": clean_text
    }]


def _parse_docx(file_bytes: bytes, document_id: str = "") -> List[Dict[str, Any]]:
    doc = Document(io.BytesIO(file_bytes))
    elements_text = []

    # Preserve natural inline document order for paragraphs and tables
    for child in doc.element.body:
        if child.tag.endswith('p'):
            from docx.text.paragraph import Paragraph
            p = Paragraph(child, doc)
            p_text = p.text.strip()
            if p_text:
                elements_text.append(p_text)
        elif child.tag.endswith('tbl'):
            from docx.table import Table
            t = Table(child, doc)
            table_rows = []
            for row in t.rows:
                row_cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
                if any(row_cells):
                    table_rows.append(" | ".join(row_cells))
            if table_rows:
                elements_text.append("[TABLE]:\n" + "\n".join(table_rows))

    # Fallback if body iteration produced no elements
    if not elements_text:
        for paragraph in doc.paragraphs:
            p_text = paragraph.text.strip()
            if p_text:
                elements_text.append(p_text)

    full_text = "\n\n".join(elements_text)
    if not full_text:
        return []

    words = full_text.split()
    if len(words) <= 500:
        record_debug_native_page(document_id, 1, full_text)
        return [{"page": 1, "text": full_text}]

    pages = []
    chunk_size = 500
    for i in range(0, len(words), chunk_size):
        chunk_text = " ".join(words[i:i + chunk_size])
        p_num = (i // chunk_size) + 1
        record_debug_native_page(document_id, p_num, chunk_text)
        pages.append({
            "page": p_num,
            "text": chunk_text
        })
    return pages


def _parse_pptx(file_bytes: bytes, document_id: str = "") -> List[Dict[str, Any]]:
    prs = Presentation(io.BytesIO(file_bytes))
    pages = []

    for slide_idx, slide in enumerate(prs.slides):
        slide_texts = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    p_text = paragraph.text.strip()
                    if p_text:
                        slide_texts.append(p_text)
            elif shape.has_table:
                table_rows = []
                for row in shape.table.rows:
                    row_cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
                    if any(row_cells):
                        table_rows.append(" | ".join(row_cells))
                if table_rows:
                    slide_texts.append("[TABLE]:\n" + "\n".join(table_rows))

        if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
            notes_text = slide.notes_slide.notes_text_frame.text.strip()
            if notes_text:
                slide_texts.append(f"[SLIDE NOTES]: {notes_text}")

        slide_full_text = "\n".join(slide_texts).strip() if slide_texts else ""
        record_debug_native_page(document_id, slide_idx + 1, slide_full_text)
        pages.append({
            "page": slide_idx + 1,
            "text": slide_full_text
        })

    return pages


def _parse_xlsx(file_bytes: bytes, document_id: str = "") -> List[Dict[str, Any]]:
    wb = load_workbook(io.BytesIO(file_bytes), data_only=True, read_only=True)
    pages = []

    for sheet_idx, sheet_name in enumerate(wb.sheetnames):
        sheet = wb[sheet_name]
        sheet_rows = []

        for row in sheet.iter_rows(values_only=True):
            if any(cell is not None and str(cell).strip() != "" for cell in row):
                row_str = " | ".join(str(cell).strip() if cell is not None else "" for cell in row)
                sheet_rows.append(row_str)

        sheet_text = f"[Sheet: {sheet_name}]\n" + ("\n".join(sheet_rows) if sheet_rows else "")
        record_debug_native_page(document_id, sheet_idx + 1, sheet_text)
        pages.append({
            "page": sheet_idx + 1,
            "text": sheet_text.strip()
        })

    wb.close()
    return pages

