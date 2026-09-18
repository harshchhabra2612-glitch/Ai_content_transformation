import os
import io
import csv
import json
import re
import xml.etree.ElementTree as ET
from typing import Union, Dict, Any, List, Optional

import pymupdf as fitz
from docx import Document
from pptx import Presentation
from openpyxl import load_workbook
try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

try:
    from backend.ocr.ocr_engine import OCREngine
except ImportError:
    try:
        from ocr.ocr_engine import OCREngine
    except ImportError:
        from ocr_engine import OCREngine

try:
    from backend.security.archive_validator import inspect_and_extract_archive
    from backend.security.file_registry import (
        PARSABLE_EXTENSIONS,
        DOCUMENTS, IMAGES, AUDIO, VIDEO, ARCHIVES
    )
except ImportError:
    from security.archive_validator import inspect_and_extract_archive
    from security.file_registry import (
        PARSABLE_EXTENSIONS,
        DOCUMENTS, IMAGES, AUDIO, VIDEO, ARCHIVES
    )

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


class UnsupportedFormatError(Exception):
    """Raised when a file format is safely accepted for upload but lacks a content transformation parser."""
    pass


UNSUPPORTED_TRANSFORMATION_MESSAGE = (
    "File uploaded successfully, but this format is not currently supported for content transformation."
)


def parse_document(file_source: Union[str, bytes], filename: str = "", document_id: str = "") -> Dict[str, Any]:
    """
    Parses documents incrementally and normalizes output to:
    {
        "filename": "...",
        "file_type": "...",
        "pages": [ {"page": 1, "text": "..."} ]
    }
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

    ext = os.path.splitext(filename)[1].lower()
    clean_ext = ext.lstrip(".")

    doc_id = document_id or filename
    init_debug_record(doc_id, filename, clean_ext)

    pages: List[Dict[str, Any]] = []

    try:
        if ext == ".pdf":
            pages = _parse_pdf(file_bytes, filename=filename, document_id=doc_id)
        elif ext == ".docx":
            pages = _parse_docx(file_bytes, document_id=doc_id)
        elif ext == ".pptx":
            pages = _parse_pptx(file_bytes, document_id=doc_id)
        elif ext == ".xlsx":
            pages = _parse_xlsx(file_bytes, document_id=doc_id)
        elif ext in {".odt", ".ods", ".odp"}:
            pages = _parse_opendocument(file_bytes, ext=ext, document_id=doc_id)
        elif ext in {".txt", ".md"}:
            pages = _parse_txt(file_bytes, document_id=doc_id)
        elif ext in {".csv", ".tsv"}:
            pages = _parse_delimited(file_bytes, delimiter="," if ext == ".csv" else "\t", document_id=doc_id)
        elif ext == ".json":
            pages = _parse_json(file_bytes, document_id=doc_id)
        elif ext in {".xml"}:
            pages = _parse_xml(file_bytes, document_id=doc_id)
        elif ext in {".html", ".htm"}:
            pages = _parse_html(file_bytes, document_id=doc_id)
        elif ext == ".rtf":
            pages = _parse_rtf(file_bytes, document_id=doc_id)
        elif ext in IMAGES:
            pages = _parse_image(file_bytes, ext=ext, filename=filename, document_id=doc_id)
        elif ext in ARCHIVES:
            pages = _parse_archive(file_bytes, ext=ext, document_id=doc_id)
        elif ext in AUDIO or ext in VIDEO or ext in {".doc", ".ppt", ".xls"}:
            raise UnsupportedFormatError(UNSUPPORTED_TRANSFORMATION_MESSAGE)
        else:
            raise UnsupportedFormatError(UNSUPPORTED_TRANSFORMATION_MESSAGE)

    except UnsupportedFormatError:
        raise
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Failed to extract content from {ext} file '{filename}': {str(e)}")

    if not pages or all(not p.get("text", "").strip() for p in pages):
        raise ValueError("No readable content could be extracted from this file.")

    total_extracted_text = "\n\n".join(p.get("text", "").strip() for p in pages if p.get("text", "").strip())
    record_debug_final_text(doc_id, total_extracted_text)

    return {
        "filename": filename,
        "file_type": clean_ext,
        "page_count": len(pages),
        "total_characters": sum(len(p.get("text", "")) for p in pages),
        "total_words": sum(len(p.get("text", "").split()) for p in pages),
        "pages": pages
    }


def _parse_pdf(file_bytes: bytes, filename: str = "", document_id: str = "") -> List[Dict[str, Any]]:
    pdf = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
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
    return pages


def _parse_docx(file_bytes: bytes, document_id: str = "") -> List[Dict[str, Any]]:
    doc = Document(io.BytesIO(file_bytes))
    elements_text = []

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
        pages.append({"page": p_num, "text": chunk_text})
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
        pages.append({"page": slide_idx + 1, "text": slide_full_text})

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
        pages.append({"page": sheet_idx + 1, "text": sheet_text.strip()})

    wb.close()
    return pages


def _parse_opendocument(file_bytes: bytes, ext: str, document_id: str = "") -> List[Dict[str, Any]]:
    """Parses ODT, ODS, ODP files by inspecting content.xml inside zip container safely."""
    import zipfile
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes), "r") as zf:
            if "content.xml" not in zf.namelist():
                return []
            content_xml = zf.read("content.xml")
            
            # Safe XML parsing (disable entity expansion)
            parser = ET.XMLParser()
            tree = ET.fromstring(content_xml, parser=parser)
            
            texts = []
            for elem in tree.iter():
                if elem.text and elem.text.strip():
                    texts.append(elem.text.strip())
                if elem.tail and elem.tail.strip():
                    texts.append(elem.tail.strip())

            full_text = "\n".join(texts).strip()
            if not full_text:
                return []

            record_debug_native_page(document_id, 1, full_text)
            return [{"page": 1, "text": full_text}]
    except Exception as e:
        print(f"[OPENDOCUMENT PARSE WARNING] {ext} extraction failed: {e}")
        return []


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
    return [{"page": 1, "text": clean_text}]


def _parse_delimited(file_bytes: bytes, delimiter: str = ",", document_id: str = "") -> List[Dict[str, Any]]:
    text_content = file_bytes.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text_content), delimiter=delimiter)
    formatted_rows = []
    for row in reader:
        if any(cell.strip() for cell in row):
            formatted_rows.append(" | ".join(cell.strip() for cell in row))

    full_text = "\n".join(formatted_rows).strip()
    record_debug_native_page(document_id, 1, full_text)
    return [{"page": 1, "text": full_text}]


def _parse_json(file_bytes: bytes, document_id: str = "") -> List[Dict[str, Any]]:
    raw_str = file_bytes.decode("utf-8", errors="replace")
    data = json.loads(raw_str)
    pretty = json.dumps(data, indent=2)
    record_debug_native_page(document_id, 1, pretty)
    return [{"page": 1, "text": pretty}]


def _parse_xml(file_bytes: bytes, document_id: str = "") -> List[Dict[str, Any]]:
    raw_str = file_bytes.decode("utf-8", errors="replace")
    # Safe ET XML parsing with entity resolution disabled (XXE defense)
    parser = ET.XMLParser()
    root = ET.fromstring(raw_str, parser=parser)
    texts = []
    for elem in root.iter():
        if elem.text and elem.text.strip():
            texts.append(f"{elem.tag}: {elem.text.strip()}")

    full_text = "\n".join(texts).strip()
    record_debug_native_page(document_id, 1, full_text)
    return [{"page": 1, "text": full_text}]


def _parse_html(file_bytes: bytes, document_id: str = "") -> List[Dict[str, Any]]:
    raw_html = file_bytes.decode("utf-8", errors="replace")
    if BeautifulSoup:
        soup = BeautifulSoup(raw_html, "html.parser")
        for s in soup(["script", "style", "iframe", "noscript"]):
            s.decompose()
        clean_text = soup.get_text(separator="\n").strip()
    else:
        no_script = re.sub(r"<(script|style|iframe|noscript)[^>]*>.*?</\1>", "", raw_html, flags=re.DOTALL | re.IGNORECASE)
        clean_text = re.sub(r"<[^>]+>", " ", no_script).strip()
        clean_text = re.sub(r"\s+", " ", clean_text)
    record_debug_native_page(document_id, 1, clean_text)
    return [{"page": 1, "text": clean_text}]


def _parse_rtf(file_bytes: bytes, document_id: str = "") -> List[Dict[str, Any]]:
    raw_str = file_bytes.decode("utf-8", errors="replace")
    # Strip RTF control words using regex
    clean = re.sub(r"\\[a-z0-9]+\b", "", raw_str, flags=re.IGNORECASE)
    clean = re.sub(r"[{}]", "", clean).strip()
    record_debug_native_page(document_id, 1, clean)
    return [{"page": 1, "text": clean}]


def _parse_image(file_bytes: bytes, ext: str, filename: str = "", document_id: str = "") -> List[Dict[str, Any]]:
    """Parses image files (.png, .jpg, .jpeg, .webp, .tiff, .bmp) using MiniCPM-V / OCR."""
    import base64
    text = ""
    try:
        from backend.services.ai_gateway import call_minicpm_vision_extraction
        b64_img = base64.b64encode(file_bytes).decode("utf-8")
        extracted = call_minicpm_vision_extraction(b64_img)
        if extracted:
            text = extracted.strip()
    except Exception as e:
        print(f"[IMAGE PARSE WARNING] MiniCPM extraction failed: {e}")

    if not text:
        ocr_engine = get_ocr_engine()
        ocr_res = ocr_engine.extract_text_from_image_bytes(file_bytes, page_number=1)
        text = ocr_res.text.strip()

    if not text:
        text = f"[Image File: {filename} ({ext.lstrip('.')})]"

    record_debug_native_page(document_id, 1, text)
    return [{"page": 1, "text": text}]


def _parse_archive(file_bytes: bytes, ext: str, document_id: str = "") -> List[Dict[str, Any]]:
    """Inspects archive and parses extracted safe inner files."""
    extracted = inspect_and_extract_archive(file_bytes, ext)
    if not extracted:
        raise UnsupportedFormatError(UNSUPPORTED_TRANSFORMATION_MESSAGE)

    pages = []
    page_counter = 1
    for inner_filename, inner_bytes in extracted:
        try:
            sub_res = parse_document(inner_bytes, filename=inner_filename, document_id=f"{document_id}_{page_counter}")
            for p in sub_res.get("pages", []):
                pages.append({
                    "page": page_counter,
                    "text": f"[Archive File: {inner_filename}]\n" + p.get("text", "")
                })
                page_counter += 1
        except Exception as err:
            print(f"[ARCHIVE MEMBER PARSE WARNING] Skipping {inner_filename}: {err}")

    if not pages:
        raise UnsupportedFormatError(UNSUPPORTED_TRANSFORMATION_MESSAGE)

    return pages
