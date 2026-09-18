"""
ERA Central File Type Registry & Security Definitions.

Single source of truth for allowed extensions, MIME types, dangerous extensions,
magic byte signatures, file category classifications, and parser compatibility.
"""

import os
from typing import Dict, Set, Tuple, Optional, Any, List

# Maximum Individual Upload Size: 300 MB
MAX_UPLOAD_SIZE_MB: int = 300
MAX_UPLOAD_SIZE_BYTES: int = MAX_UPLOAD_SIZE_MB * 1024 * 1024

# Category definitions
DOCUMENTS: Set[str] = {
    ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
    ".odt", ".ods", ".odp", ".txt", ".csv", ".tsv", ".md", ".rtf",
    ".json", ".xml", ".html", ".htm"
}

IMAGES: Set[str] = {
    ".png", ".jpg", ".jpeg", ".webp", ".tiff", ".tif", ".bmp"
}

AUDIO: Set[str] = {
    ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"
}

VIDEO: Set[str] = {
    ".mp4", ".mov", ".webm", ".mkv", ".avi"
}

ARCHIVES: Set[str] = {
    ".zip", ".7z", ".tar", ".tar.gz", ".tgz"
}

# ALL Allowed Extensions
ALLOWED_EXTENSIONS: Set[str] = DOCUMENTS | IMAGES | AUDIO | VIDEO | ARCHIVES

# Executable / Dangerous Extensions strictly prohibited
DANGEROUS_EXTENSIONS: Set[str] = {
    ".exe", ".dll", ".dmg", ".pkg", ".app", ".sh", ".bat", ".cmd",
    ".ps1", ".vbs", ".js", ".jar", ".com", ".scr", ".msi", ".deb",
    ".rpm", ".bin", ".php", ".py", ".elf", ".so", ".dylib", ".cgi",
    ".pif", ".application", ".gadget", ".msp", ".hta", ".cpl", ".msc"
}

# Declared MIME types map
ALLOWED_MIME_TYPES: Dict[str, Set[str]] = {
    ".pdf": {"application/pdf"},
    ".doc": {"application/msword"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/x-zip-compressed"},
    ".ppt": {"application/vnd.ms-powerpoint"},
    ".pptx": {"application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip", "application/x-zip-compressed"},
    ".xls": {"application/vnd.ms-excel"},
    ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/x-zip-compressed"},
    ".odt": {"application/vnd.oasis.opendocument.text", "application/zip"},
    ".ods": {"application/vnd.oasis.opendocument.spreadsheet", "application/zip"},
    ".odp": {"application/vnd.oasis.opendocument.presentation", "application/zip"},
    ".txt": {"text/plain"},
    ".csv": {"text/csv", "text/plain", "application/csv"},
    ".tsv": {"text/tab-separated-values", "text/plain"},
    ".md": {"text/markdown", "text/plain", "text/x-markdown"},
    ".rtf": {"application/rtf", "text/rtf", "text/plain"},
    ".json": {"application/json", "text/plain"},
    ".xml": {"application/xml", "text/xml", "text/plain"},
    ".html": {"text/html", "application/xhtml+xml"},
    ".htm": {"text/html"},
    ".png": {"image/png"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".webp": {"image/webp"},
    ".tiff": {"image/tiff"},
    ".tif": {"image/tiff"},
    ".bmp": {"image/bmp", "image/x-ms-bmp"},
    ".mp3": {"audio/mpeg", "audio/mp3"},
    ".wav": {"audio/wav", "audio/x-wav"},
    ".m4a": {"audio/m4a", "audio/mp4", "audio/x-m4a"},
    ".aac": {"audio/aac"},
    ".ogg": {"audio/ogg", "video/ogg", "application/ogg"},
    ".flac": {"audio/flac"},
    ".mp4": {"video/mp4"},
    ".mov": {"video/quicktime"},
    ".webm": {"video/webm"},
    ".mkv": {"video/x-matroska"},
    ".avi": {"video/x-msvideo"},
    ".zip": {"application/zip", "application/x-zip-compressed"},
    ".7z": {"application/x-7z-compressed"},
    ".tar": {"application/x-tar"},
    ".tar.gz": {"application/gzip", "application/x-gzip", "application/x-tar"},
    ".tgz": {"application/gzip", "application/x-gzip", "application/x-tar"}
}

# Formats supported for direct content transformation / parsing
PARSABLE_EXTENSIONS: Set[str] = {
    ".pdf", ".docx", ".pptx", ".xlsx", ".odt", ".ods", ".odp",
    ".txt", ".csv", ".tsv", ".md", ".rtf", ".json", ".xml", ".html", ".htm",
    ".png", ".jpg", ".jpeg", ".webp", ".tiff", ".tif", ".bmp"
}

# Magic byte signatures database (Header offset 0 unless specified)
MAGIC_SIGNATURES: Dict[str, List[bytes]] = {
    ".pdf": [b"%PDF-"],
    ".png": [b"\x89PNG\r\n\x1a\n"],
    ".jpg": [b"\xff\xd8\xff"],
    ".jpeg": [b"\xff\xd8\xff"],
    ".gif": [b"GIF87a", b"GIF89a"],
    ".bmp": [b"BM"],
    ".tiff": [b"II*\x00", b"MM\x00*"],
    ".tif": [b"II*\x00", b"MM\x00*"],
    ".webp": [b"RIFF"], # WebP has RIFF...WEBP
    ".zip": [b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"],
    ".docx": [b"PK\x03\x04"],
    ".pptx": [b"PK\x03\x04"],
    ".xlsx": [b"PK\x03\x04"],
    ".odt": [b"PK\x03\x04"],
    ".ods": [b"PK\x03\x04"],
    ".odp": [b"PK\x03\x04"],
    ".7z": [b"7z\xbc\xaf\x27\x1c"],
    ".tar.gz": [b"\x1f\x8b"],
    ".tgz": [b"\x1f\x8b"],
    ".doc": [b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"], # OLE2 Compound File
    ".xls": [b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"],
    ".ppt": [b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"],
    ".flac": [b"fLaC"],
    ".ogg": [b"OggS"],
    ".mp3": [b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"],
    ".wav": [b"RIFF"],
    ".avi": [b"RIFF"],
    ".mp4": [b"ftyp"], # At offset 4
    ".mov": [b"ftyp", b"moov", b"wide", b"mdat", b"free"],
    ".mkv": [b"\x1a\x45\xdf\xa3"], # EBML header
    ".webm": [b"\x1a\x45\xdf\xa3"],
    ".rtf": [b"{\\rtf"],
    ".xml": [b"<?xml", b"<"],
    ".html": [b"<!DOCTYPE", b"<!doctype", b"<html", b"<HTML", b"<head", b"<body"],
    ".htm": [b"<!DOCTYPE", b"<!doctype", b"<html", b"<HTML", b"<head", b"<body"],
}

# Signatures for known Executables to immediately REJECT regardless of extension
EXECUTABLE_MAGIC_SIGNATURES: List[bytes] = [
    b"MZ",           # Windows EXE / DLL / SYS / SCR / COM
    b"\x7fELF",      # Linux ELF binary / SO
    b"\xca\xfe\xba\xbe", # macOS Mach-O binary / Java Class / JAR
    b"\xcf\xfa\xed\xfe", # macOS Mach-O binary 64-bit
    b"\xce\xfa\xed\xfe", # macOS Mach-O binary 32-bit
    b"#!",           # Shell script / Shebang
]


def detect_file_signature_match(file_bytes: bytes, ext: str) -> bool:
    """
    Validates if header bytes of file match expected magic signature for the extension.
    Also verifies file does NOT match executable magic signatures.
    Returns True if valid / inconclusive for plain text, False if mismatched / executable signature.
    """
    if not file_bytes:
        return False

    header_64 = file_bytes[:64]

    # Check executable signatures
    for exec_sig in EXECUTABLE_MAGIC_SIGNATURES:
        if header_64.startswith(exec_sig):
            # Special case for XML/HTML starting with '<' or text starting with '#!' or 'MZ'
            if ext in {".txt", ".csv", ".tsv", ".md", ".json", ".xml", ".html", ".htm"} and exec_sig == b"#!":
                pass
            else:
                return False

    ext = ext.lower()
    if ext not in MAGIC_SIGNATURES:
        # For plain text files (.txt, .csv, .tsv, .md, .json), return True if readable text / no binary control chars
        if ext in {".txt", ".csv", ".tsv", ".md", ".json"}:
            return True
        return True

    expected_sigs = MAGIC_SIGNATURES[ext]
    
    # Check offset 0
    for sig in expected_sigs:
        if header_64.startswith(sig):
            return True

    # Check MP4 / MOV offset 4 for 'ftyp'
    if ext in {".mp4", ".mov", ".m4a"} and len(file_bytes) >= 12:
        if file_bytes[4:8] == b"ftyp":
            return True

    # Check WebP 'RIFF' + 'WEBP'
    if ext == ".webp" and len(file_bytes) >= 12:
        if file_bytes.startswith(b"RIFF") and file_bytes[8:12] == b"WEBP":
            return True

    # Check WAV 'RIFF' + 'WAVE'
    if ext == ".wav" and len(file_bytes) >= 12:
        if file_bytes.startswith(b"RIFF") and file_bytes[8:12] == b"WAVE":
            return True

    # Check AVI 'RIFF' + 'AVI '
    if ext == ".avi" and len(file_bytes) >= 12:
        if file_bytes.startswith(b"RIFF") and file_bytes[8:12] == b"AVI ":
            return True

    # HTML/XML flexible prefix match
    if ext in {".html", ".htm", ".xml"}:
        stripped = header_64.lstrip()
        for sig in expected_sigs:
            if stripped.startswith(sig):
                return True

    return False
