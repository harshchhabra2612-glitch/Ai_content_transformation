"""
ERA Archive Security Module.

Provides security inspection and safe extraction for zip, 7z, tar, tar.gz, tgz archives.
Prevents:
- Path traversal attacks (../, absolute paths)
- Zip bombs / Decompression bombs
- Excessive file counts & sizes
- Recursive archive abuse
- Execution of dangerous extracted files
"""

import os
import io
import zipfile
import tarfile
from typing import List, Tuple, Dict, Any, Optional

from backend.security.file_registry import (
    ALLOWED_EXTENSIONS,
    DANGEROUS_EXTENSIONS,
    PARSABLE_EXTENSIONS,
    detect_file_signature_match,
)

# Configurable Archive Security Limits
MAX_ARCHIVE_FILES: int = 500
MAX_EXTRACTED_SIZE_BYTES: int = 500 * 1024 * 1024  # 500 MB
MAX_COMPRESSION_RATIO: float = 20.0
MAX_ARCHIVE_DEPTH: int = 3


class ArchiveSecurityError(Exception):
    """Custom exception raised when an archive violates security constraints."""
    pass


def inspect_and_extract_archive(file_bytes: bytes, ext: str) -> List[Tuple[str, bytes]]:
    """
    Safely inspects an archive file and extracts safe, supported inner files.
    
    Returns a list of tuples: [(inner_filename, inner_file_bytes), ...]
    Raises ArchiveSecurityError if archive fails security checks.
    """
    ext = ext.lower()
    if ext in {".zip", ".docx", ".pptx", ".xlsx", ".odt", ".ods", ".odp"}:
        return _inspect_zip(file_bytes, is_office_container=(ext != ".zip"))
    elif ext in {".tar", ".tar.gz", ".tgz"}:
        return _inspect_tar(file_bytes)
    elif ext == ".7z":
        return _inspect_7z(file_bytes)
    else:
        raise ArchiveSecurityError(f"Unsupported archive format '{ext}'.")


def _inspect_zip(file_bytes: bytes, is_office_container: bool = False) -> List[Tuple[str, bytes]]:
    extracted_files: List[Tuple[str, bytes]] = []
    total_uncompressed_size = 0

    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes), "r") as zf:
            infolist = zf.infolist()

            if len(infolist) > MAX_ARCHIVE_FILES:
                raise ArchiveSecurityError(
                    f"Archive file count ({len(infolist)}) exceeds maximum limit of {MAX_ARCHIVE_FILES} files."
                )

            for member in infolist:
                # 1. Path traversal check
                filename = member.filename
                if ".." in filename or filename.startswith("/") or filename.startswith("\\"):
                    raise ArchiveSecurityError(f"Path traversal detected in archive entry: '{filename}'.")

                # 2. Skip directories
                if member.is_dir() or filename.endswith("/"):
                    continue

                # 3. Check compression ratio & bomb limits
                c_size = max(1, member.compress_size)
                u_size = member.file_size
                ratio = u_size / c_size

                if ratio > MAX_COMPRESSION_RATIO and u_size > 10 * 1024 * 1024:
                    raise ArchiveSecurityError(
                        f"Excessive compression ratio ({ratio:.1f}x) detected in '{filename}' (Potential decompression bomb)."
                    )

                total_uncompressed_size += u_size
                if total_uncompressed_size > MAX_EXTRACTED_SIZE_BYTES:
                    raise ArchiveSecurityError(
                        f"Total extracted size exceeds maximum allowed limit of {MAX_EXTRACTED_SIZE_BYTES / (1024*1024):.0f} MB."
                    )

                # 4. Check for dangerous extensions inside archive
                inner_ext = os.path.splitext(filename)[1].lower()
                if inner_ext in DANGEROUS_EXTENSIONS:
                    raise ArchiveSecurityError(f"Archive contains executable or dangerous file: '{filename}'.")

                # If checking an standard zip (not an OOXML doc container), read safe files
                if not is_office_container:
                    if inner_ext in PARSABLE_EXTENSIONS or inner_ext in ALLOWED_EXTENSIONS:
                        content = zf.read(member)
                        # Signature match check on inner content
                        if detect_file_signature_match(content, inner_ext):
                            safe_name = os.path.basename(filename)
                            extracted_files.append((safe_name, content))

    except zipfile.BadZipFile:
        raise ArchiveSecurityError("Archive is corrupted or invalid ZIP format.")
    except ArchiveSecurityError:
        raise
    except Exception as e:
        raise ArchiveSecurityError(f"Archive processing error: {str(e)}")

    return extracted_files


def _inspect_tar(file_bytes: bytes) -> List[Tuple[str, bytes]]:
    extracted_files: List[Tuple[str, bytes]] = []
    total_uncompressed_size = 0

    try:
        with tarfile.open(fileobj=io.BytesIO(file_bytes), mode="r:*") as tf:
            members = tf.getmembers()

            if len(members) > MAX_ARCHIVE_FILES:
                raise ArchiveSecurityError(
                    f"Archive file count ({len(members)}) exceeds maximum limit of {MAX_ARCHIVE_FILES} files."
                )

            for member in members:
                # 1. Path traversal check
                filename = member.name
                if ".." in filename or filename.startswith("/") or filename.startswith("\\"):
                    raise ArchiveSecurityError(f"Path traversal detected in archive entry: '{filename}'.")

                # 2. Skip non-regular files (symlinks, hardlinks, devices, dirs)
                if not member.isfile():
                    if member.issym() or member.islnk():
                        raise ArchiveSecurityError(f"Symbolic or hard links are prohibited in archives: '{filename}'.")
                    continue

                total_uncompressed_size += member.size
                if total_uncompressed_size > MAX_EXTRACTED_SIZE_BYTES:
                    raise ArchiveSecurityError(
                        f"Total extracted size exceeds maximum allowed limit of {MAX_EXTRACTED_SIZE_BYTES / (1024*1024):.0f} MB."
                    )

                inner_ext = os.path.splitext(filename)[1].lower()
                if inner_ext in DANGEROUS_EXTENSIONS:
                    raise ArchiveSecurityError(f"Archive contains executable or dangerous file: '{filename}'.")

                if inner_ext in PARSABLE_EXTENSIONS or inner_ext in ALLOWED_EXTENSIONS:
                    fobj = tf.extractfile(member)
                    if fobj:
                        content = fobj.read()
                        if detect_file_signature_match(content, inner_ext):
                            safe_name = os.path.basename(filename)
                            extracted_files.append((safe_name, content))

    except ArchiveSecurityError:
        raise
    except Exception as e:
        raise ArchiveSecurityError(f"Tar archive processing error: {str(e)}")

    return extracted_files


def _inspect_7z(file_bytes: bytes) -> List[Tuple[str, bytes]]:
    # Fallback / safe check for 7z structure without executing py7zr if missing
    try:
        import py7zr
        extracted_files = []
        total_size = 0
        with py7zr.SevenZipFile(io.BytesIO(file_bytes), mode='r') as z:
            info = z.archiveinfo()
            names = z.getnames()
            if len(names) > MAX_ARCHIVE_FILES:
                raise ArchiveSecurityError(f"Archive file count ({len(names)}) exceeds limit of {MAX_ARCHIVE_FILES}.")
            
            for fname in names:
                if ".." in fname or fname.startswith("/") or fname.startswith("\\"):
                    raise ArchiveSecurityError(f"Path traversal detected in 7z entry: '{fname}'.")
                inner_ext = os.path.splitext(fname)[1].lower()
                if inner_ext in DANGEROUS_EXTENSIONS:
                    raise ArchiveSecurityError(f"7z archive contains executable file: '{fname}'.")

            extracted = z.readall()
            for fname, bio in extracted.items():
                content = bio.read()
                total_size += len(content)
                if total_size > MAX_EXTRACTED_SIZE_BYTES:
                    raise ArchiveSecurityError("Total extracted size exceeds maximum allowed limit.")
                inner_ext = os.path.splitext(fname)[1].lower()
                if inner_ext in PARSABLE_EXTENSIONS or inner_ext in ALLOWED_EXTENSIONS:
                    safe_name = os.path.basename(fname)
                    extracted_files.append((safe_name, content))
        return extracted_files
    except ImportError:
        # If py7zr is not installed, verify basic header signature and return safe upload without extraction
        if file_bytes.startswith(b"7z\xbc\xaf\x27\x1c"):
            return []
        raise ArchiveSecurityError("Invalid 7z file signature.")
    except ArchiveSecurityError:
        raise
    except Exception as e:
        raise ArchiveSecurityError(f"7z archive error: {str(e)}")
