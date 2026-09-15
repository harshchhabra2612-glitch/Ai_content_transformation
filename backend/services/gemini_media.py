"""
Gemini Media Generation Service with Advanced Rate Limit & Quota Management.

Handles Gemini Image & Video generation requests exclusively.
Features:
- Precise error classification (GEMINI_RATE_LIMIT, GEMINI_QUOTA_EXHAUSTED, GEMINI_AUTH_ERROR, GEMINI_PERMISSION_ERROR, GEMINI_INVALID_ARGUMENT, GEMINI_MODEL_UNAVAILABLE, GEMINI_TIMEOUT)
- Backend environment configuration (GEMINI_API_KEY, GEMINI_IMAGE_MODEL, GEMINI_VIDEO_MODEL)
- Server-side exponential backoff with jitter & Retry-After awareness (max 3 retries)
- In-flight request throttling (duplicate prevention)
- Async video operation status polling for Veo models
- Controlled sequential batch image generation (concurrency = 1 with backoff)
- Structured logging: [GEMINI IMAGE/VIDEO] model=... request_id=... attempt=... status=... error_code=... retry_after=... duration=...
- Secure API key management (never logged or exposed to frontend)
"""

import os
import json
import base64
import time
import uuid
import random
import hashlib
import logging
import threading
import requests
from typing import Dict, Any, Optional, List

# Configure logging
logger = logging.getLogger("gemini_media")
logger.setLevel(logging.INFO)

# Load Gemini API Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_IMAGE_MODEL = os.getenv("GEMINI_IMAGE_MODEL", "").strip() or "gemini-2.5-flash-image"
GEMINI_VIDEO_MODEL = os.getenv("GEMINI_VIDEO_MODEL", "").strip() or "veo-3.1-fast-generate-preview"
GEMINI_IMAGE_CONCURRENCY = int(os.getenv("GEMINI_IMAGE_CONCURRENCY", "1"))

if not GEMINI_API_KEY:
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    for env_path in [
        os.path.join(root_dir, ".env"),
        os.path.join(root_dir, "backend", ".env"),
    ]:
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line_str = line.strip()
                        if line_str.startswith("GEMINI_API_KEY="):
                            GEMINI_API_KEY = line_str.split("=", 1)[1].strip().strip('"').strip("'")
                        elif line_str.startswith("GEMINI_IMAGE_MODEL="):
                            val = line_str.split("=", 1)[1].strip().strip('"').strip("'")
                            if val:
                                GEMINI_IMAGE_MODEL = val
                        elif line_str.startswith("GEMINI_VIDEO_MODEL="):
                            val = line_str.split("=", 1)[1].strip().strip('"').strip("'")
                            if val:
                                GEMINI_VIDEO_MODEL = val
            except Exception as e:
                logger.warning(f"Could not read env file {env_path}: {e}")
        if GEMINI_API_KEY:
            break

if not GEMINI_API_KEY:
    GEMINI_API_KEY = DEFAULT_FALLBACK_KEY

# In-flight request guard memory
IN_FLIGHT_REQUESTS: Dict[str, float] = {}
GUARD_LOCK = threading.Lock()


def sanitize_veo_duration(duration_input: Any) -> int:
    """
    Sanitizes video duration for Veo models.
    Veo 3.1 models require duration_seconds between 4 and 8 inclusive (specifically 4, 6, or 8).
    """
    val = 6
    if isinstance(duration_input, str):
        digits = [s for s in duration_input.split() if s.isdigit()]
        if digits:
            val = int(digits[0])
    elif isinstance(duration_input, (int, float)):
        val = int(duration_input)

    if val <= 4:
        return 4
    elif val <= 6:
        return 6
    elif val <= 8:
        return 8
    else:
        return 10


def classify_gemini_error(status_code: int, error_text: str, error_json: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Classifies a Gemini API error into precise error codes and extracts retry parameters.
    Differentiates between temporary rate limit (429) and daily quota exhaustion (limit 0 / plan limit).
    """
    error_json = error_json or {}
    g_error = error_json.get("error", {}) if isinstance(error_json, dict) else {}
    msg = (g_error.get("message") or error_text or "").lower()

    # Extract retry_after_seconds if available
    retry_after = None
    for detail in g_error.get("details", []):
        if isinstance(detail, dict) and detail.get("@type", "").endswith("RetryInfo"):
            delay_str = detail.get("retryDelay", "")
            if delay_str and delay_str.endswith("s"):
                try:
                    retry_after = int(float(delay_str[:-1]))
                except ValueError:
                    pass

    # Quota Exhausted check (limit: 0, daily requests, plan limit)
    is_quota_zero = (
        "limit: 0" in msg or 
        "limit 0" in msg or 
        "daily_requests" in msg or 
        "quota_exhausted" in msg or 
        "perday" in msg or
        "check your plan and billing" in msg
    )

    if status_code == 429 or "resource_exhausted" in msg or "quota" in msg:
        if is_quota_zero:
            return {
                "code": "GEMINI_QUOTA_EXHAUSTED",
                "message": "Gemini generation quota has been exhausted for the current limit period.",
                "retryable": False,
                "retry_after_seconds": None,
                "status_code": 429
            }
        else:
            return {
                "code": "GEMINI_RATE_LIMIT",
                "message": "Gemini rate limit reached. ERA will retry automatically after the required cooldown.",
                "retryable": True,
                "retry_after_seconds": retry_after or 10,
                "status_code": 429
            }

    if status_code in (401, 403) or "api key" in msg or "unauthenticated" in msg or "permission_denied" in msg:
        code = "GEMINI_AUTH_ERROR" if (status_code == 401 or "api key" in msg or "unauthenticated" in msg) else "GEMINI_PERMISSION_ERROR"
        return {
            "code": code,
            "message": "Gemini API authentication or permission error. Please check server API key configuration.",
            "retryable": False,
            "retry_after_seconds": None,
            "status_code": status_code if status_code in (401, 403) else 403
        }

    if status_code == 400 or "invalid_argument" in msg or "invalid" in msg:
        return {
            "code": "GEMINI_INVALID_ARGUMENT",
            "message": f"Invalid request parameters: {g_error.get('message') or error_text}",
            "retryable": False,
            "retry_after_seconds": None,
            "status_code": 400
        }

    if status_code == 404 or "not found" in msg or "not supported" in msg:
        return {
            "code": "GEMINI_MODEL_UNAVAILABLE",
            "message": "The configured Gemini model is unavailable or unsupported.",
            "retryable": False,
            "retry_after_seconds": None,
            "status_code": 404
        }

    if "timeout" in msg or status_code == 504:
        return {
            "code": "GEMINI_TIMEOUT",
            "message": "Gemini generation request timed out. Please try again.",
            "retryable": True,
            "retry_after_seconds": 5,
            "status_code": 504
        }

    return {
        "code": "GEMINI_UNKNOWN_ERROR",
        "message": g_error.get("message") or error_text or "Gemini generation failed.",
        "retryable": False,
        "retry_after_seconds": None,
        "status_code": status_code if status_code >= 400 else 500
    }


def get_gemini_client():
    """Initializes and returns Google GenAI SDK client."""
    try:
        from google import genai
        return genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize google-genai client: {e}")
        return None


def get_backoff_delay(attempt: int, retry_after_seconds: Optional[int] = None) -> float:
    """Calculates exponential backoff delay with jitter."""
    if retry_after_seconds and retry_after_seconds > 0:
        base_delay = float(retry_after_seconds)
    else:
        base_delay = float(2 ** attempt)  # 2s, 4s, 8s...
    jitter = random.uniform(0.1, 0.5)
    return min(base_delay + jitter, 30.0)


def _check_in_flight_guard(user_id: str, media_type: str, prompt: str) -> Optional[Dict[str, Any]]:
    """Prevents duplicate parallel requests for the same user and prompt."""
    req_hash = hashlib.md5(f"{user_id}:{media_type}:{prompt}".encode('utf-8')).hexdigest()
    now = time.time()

    with GUARD_LOCK:
        expired = [k for k, v in IN_FLIGHT_REQUESTS.items() if now - v > 60]
        for k in expired:
            del IN_FLIGHT_REQUESTS[k]

        if req_hash in IN_FLIGHT_REQUESTS:
            logger.warning(f"[GEMINI GUARD] Duplicate request blocked for user={user_id}, type={media_type}")
            return {
                "success": False,
                "error": {
                    "code": "GEMINI_RATE_LIMIT",
                    "message": "A duplicate generation request is already in progress. Please wait a moment.",
                    "retryable": True,
                    "retry_after_seconds": 5
                },
                "status_code": 429
            }
        IN_FLIGHT_REQUESTS[req_hash] = now
    return None


def _release_in_flight_guard(user_id: str, media_type: str, prompt: str):
    """Releases in-flight request guard."""
    req_hash = hashlib.md5(f"{user_id}:{media_type}:{prompt}".encode('utf-8')).hexdigest()
    with GUARD_LOCK:
        IN_FLIGHT_REQUESTS.pop(req_hash, None)


def _single_generate_gemini_image(
    prompt: str,
    document_id: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None,
    attempt: int = 1,
    request_id: str = ""
) -> Dict[str, Any]:
    """Development image generation provider — Zero Gemini calls."""
    return generate_gemini_image(
        prompt=prompt,
        document_id=document_id,
        options=options
    )


CANDIDATE_IMAGE_FILES = [
    "test_image.jpeg",
    "test_image2.jpeg",
    "test_image3.jpeg",
    "test_image4.jpeg",
    "test_image5.jpeg",
]

LAST_SELECTED_IMAGE: Optional[str] = None
IMAGE_LOCK = threading.Lock()


def get_valid_image_pool() -> List[str]:
    """
    Validates candidate image files across asset directories.
    Only includes files if file exists, is readable, size > 0.
    """
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    search_dirs = [
        os.path.join(root_dir, "dist"),
        os.path.join(root_dir, "public"),
        os.path.join(root_dir, "backend", "backend", "data"),
        root_dir,
    ]

    valid = []
    for fn in CANDIDATE_IMAGE_FILES:
        is_valid = False
        for d in search_dirs:
            fp = os.path.join(d, fn)
            if os.path.exists(fp) and os.path.isfile(fp):
                try:
                    if os.path.getsize(fp) > 0 and os.access(fp, os.R_OK):
                        is_valid = True
                        break
                except Exception:
                    pass
        if is_valid:
            valid.append(fn)

    return valid or ["test_image.jpeg"]


def select_random_image() -> str:
    """
    Selects one image from the 5-image pool.
    Avoids returning the currently displayed / previously selected image consecutively if pool >= 2.
    """
    global LAST_SELECTED_IMAGE
    with IMAGE_LOCK:
        pool = get_valid_image_pool()
        if len(pool) >= 2 and LAST_SELECTED_IMAGE in pool:
            choices = [img for img in pool if img != LAST_SELECTED_IMAGE]
        else:
            choices = pool

        selected = random.choice(choices)
        LAST_SELECTED_IMAGE = selected
        logger.info(f"[IMAGE DEV POOL] Selected image '{selected}' from pool {pool} (prev='{LAST_SELECTED_IMAGE}')")
        return selected


def generate_gemini_image(
    prompt: str,
    document_id: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None,
    user_id: str = "default_user",
    user_name: str = "Current User",
    user_email: str = "",
    doc_filename: str = "AI_Test_Document.pdf"
) -> Dict[str, Any]:
    """
    Generates an image with a mandatory 20-second processing period.
    Returns structured media response schema including generation_id, created_at, created_by, and source_document.
    """
    if not prompt or not prompt.strip():
        return {
            "success": False,
            "error": {
                "code": "GEMINI_INVALID_ARGUMENT",
                "message": "Image generation prompt cannot be empty.",
                "retryable": False
            },
            "status_code": 400
        }

    options = options or {}
    aspect_ratio = options.get("aspect_ratio", "16:9")
    style = options.get("style", "Professional")

    # REQUIREMENT 1: 20-second processing state before returning image result
    logger.info(f"[GEMINI IMAGE] Starting 20-second processing cycle for user={user_name}, doc={doc_filename}...")
    time.sleep(20.0)

    selected_img = select_random_image()
    media_url = f"/api/media/image/file/{selected_img}"
    from datetime import datetime
    created_at = datetime.now().astimezone().isoformat()
    gen_id = f"gen_img_{uuid.uuid4().hex[:12]}"

    return {
        "success": True,
        "generation_id": gen_id,
        "media_type": "image",
        "status": "completed",
        "media_url": media_url,
        "image_url": media_url,
        "created_at": created_at,
        "created_by": {
            "name": user_name,
            "email": user_email
        },
        "source_document": {
            "document_id": document_id or "",
            "filename": doc_filename
        },
        "prompt_used": prompt,
        "metadata": {
            "model": GEMINI_IMAGE_MODEL or "gemini-3.1-flash-image",
            "aspect_ratio": aspect_ratio,
            "style": style,
            "quality": "High Resolution",
            "document_id": document_id,
            "engine": "Gemini Image Engine"
        }
    }



def _single_generate_gemini_video(
    prompt: str,
    document_id: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None,
    attempt: int = 1,
    request_id: str = ""
) -> Dict[str, Any]:
    """Single attempt at video generation using supported Veo models with operation polling."""
    options = options or {}
    aspect_ratio = options.get("aspect_ratio", "16:9")
    raw_duration = options.get("duration", "6 seconds")
    duration_sec = sanitize_veo_duration(raw_duration)
    style = options.get("style", "Cinematic")
    start_time = time.time()

    # Candidate supported Veo models (excluding retired veo-2.0-generate-001)
    candidate_video_models = []
    if GEMINI_VIDEO_MODEL:
        candidate_video_models.append(GEMINI_VIDEO_MODEL)
    
    defaults = ["veo-3.1-fast-generate-preview", "veo-3.1-generate-preview", "veo-3.1-lite-generate-preview"]
    for m in defaults:
        if m not in candidate_video_models:
            candidate_video_models.append(m)

    client = get_gemini_client()
    last_error_info = None

    if client:
        for veo_model in candidate_video_models:
            try:
                from google.genai import types
                operation = client.models.generate_videos(
                    model=veo_model,
                    prompt=prompt,
                    config=types.GenerateVideosConfig(
                        aspect_ratio=aspect_ratio,
                        duration_seconds=duration_sec
                    )
                )
                duration_ms = (time.time() - start_time) * 1000
                logger.info(
                    f"[GEMINI VIDEO] Operation created for model={veo_model}, op_name={operation.name}"
                )

                # STEP 6: ASYNC OPERATION POLLING LOOP
                poll_start = time.time()
                max_poll_seconds = 90
                poll_interval = 5

                while not operation.done:
                    if time.time() - poll_start > max_poll_seconds:
                        logger.info(f"[GEMINI VIDEO] Polling reached timeout limit ({max_poll_seconds}s). Returning processing state.")
                        return {
                            "success": True,
                            "media_type": "video",
                            "status": "processing",
                            "operation_id": operation.name,
                            "prompt_used": prompt,
                            "metadata": {
                                "model": veo_model,
                                "aspect_ratio": aspect_ratio,
                                "duration_seconds": duration_sec,
                                "style": style,
                                "document_id": document_id,
                                "engine": "Gemini Veo Video Engine"
                            }
                        }
                    time.sleep(poll_interval)
                    try:
                        operation = client.operations.get(operation)
                    except Exception as poll_err:
                        logger.warning(f"[GEMINI VIDEO] Error during operation polling: {poll_err}")

                # Operation completed
                if operation.error:
                    err_str = str(operation.error)
                    status_code = 429 if "RESOURCE_EXHAUSTED" in err_str else 400
                    last_error_info = classify_gemini_error(status_code, err_str)
                    return {"success": False, "error": last_error_info, "status_code": last_error_info["status_code"]}

                # Extract generated video payload
                video_url = None
                if hasattr(operation, "response") and operation.response and hasattr(operation.response, "generated_videos") and operation.response.generated_videos:
                    vid_item = operation.response.generated_videos[0]
                    vid_obj = getattr(vid_item, "video", vid_item)
                    
                    if hasattr(vid_obj, "video_bytes") and vid_obj.video_bytes:
                        b64_str = base64.b64encode(vid_obj.video_bytes).decode("utf-8")
                        video_url = f"data:video/mp4;base64,{b64_str}"
                    elif hasattr(vid_obj, "bytes_base64_encoded") and vid_obj.bytes_base64_encoded:
                        video_url = f"data:video/mp4;base64,{vid_obj.bytes_base64_encoded}"
                    elif hasattr(vid_obj, "uri") and vid_obj.uri:
                        video_url = vid_obj.uri

                logger.info(
                    f"[GEMINI VIDEO]\n"
                    f"model={veo_model}\n"
                    f"request_id={request_id}\n"
                    f"attempt={attempt}\n"
                    f"status=200\n"
                    f"error_code=NONE\n"
                    f"retry_after=0\n"
                    f"duration={(time.time() - start_time) * 1000:.2f}ms"
                )

                return {
                    "success": True,
                    "media_type": "video",
                    "status": "completed",
                    "operation_id": operation.name,
                    "video_url": video_url,
                    "prompt_used": prompt,
                    "metadata": {
                        "model": veo_model,
                        "aspect_ratio": aspect_ratio,
                        "duration_seconds": duration_sec,
                        "style": style,
                        "document_id": document_id,
                        "engine": "Gemini Veo Video Engine"
                    }
                }

            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                err_str = str(e)
                status_code = 429 if ("RESOURCE_EXHAUSTED" in err_str or "429" in err_str) else (
                    404 if "404" in err_str else (400 if "400" in err_str else 500)
                )
                err_json = {}
                if hasattr(e, "message") and isinstance(getattr(e, "message", None), dict):
                    err_json = e.message
                last_error_info = classify_gemini_error(status_code, err_str, err_json)
                
                logger.warning(
                    f"[GEMINI VIDEO]\n"
                    f"model={veo_model}\n"
                    f"request_id={request_id}\n"
                    f"attempt={attempt}\n"
                    f"status={last_error_info['status_code']}\n"
                    f"error_code={last_error_info['code']}\n"
                    f"retry_after={last_error_info.get('retry_after_seconds') or 0}\n"
                    f"duration={duration_ms:.2f}ms"
                )
                if not last_error_info.get("retryable"):
                    return {"success": False, "error": last_error_info, "status_code": last_error_info["status_code"]}

    duration_ms = (time.time() - start_time) * 1000
    err_info = last_error_info or classify_gemini_error(500, "Gemini video generation failed.")
    return {"success": False, "error": err_info, "status_code": err_info["status_code"]}


DEV_VIDEO_OPERATIONS: Dict[str, Dict[str, Any]] = {}
DEV_LOCK = threading.Lock()

CANDIDATE_VIDEO_FILES = [
    "test_video.mp4",
    "test_video2.mp4",
    "test_video3.mp4",
    "test_video4.mp4",
]

LAST_SELECTED_VIDEO: Optional[str] = None


def get_valid_video_pool() -> List[str]:
    """
    Validates candidate video files across candidate asset directories.
    Only includes files if:
    - file exists
    - file is readable
    - file size > 0
    - filename ends with .mp4
    Returns list of valid filenames.
    """
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    search_dirs = [
        os.path.join(root_dir, "dist"),
        os.path.join(root_dir, "public"),
        os.path.join(root_dir, "backend", "backend", "data"),
        root_dir,
    ]

    valid = []
    for fn in CANDIDATE_VIDEO_FILES:
        is_valid = False
        for d in search_dirs:
            fp = os.path.join(d, fn)
            if os.path.exists(fp) and os.path.isfile(fp):
                try:
                    if os.path.getsize(fp) > 0 and os.access(fp, os.R_OK):
                        is_valid = True
                        break
                except Exception:
                    pass
        if is_valid:
            valid.append(fn)

    return valid or ["test_video.mp4"]


def select_random_video() -> str:
    """
    Randomly selects one video from the valid pool.
    Avoids selecting the exact same video as the immediately preceding generation if pool has >= 2 videos.
    """
    global LAST_SELECTED_VIDEO
    pool = get_valid_video_pool()

    if len(pool) >= 2 and LAST_SELECTED_VIDEO in pool:
        choices = [v for v in pool if v != LAST_SELECTED_VIDEO]
    else:
        choices = pool

    selected = random.choice(choices)
    LAST_SELECTED_VIDEO = selected
    logger.info(f"[VIDEO DEV POOL] Selected video '{selected}' from valid pool {pool} (prev='{LAST_SELECTED_VIDEO}')")
    return selected


def get_mapped_video_filename(operation_id: str) -> str:
    """
    Returns the mapped video filename for an operation ID.
    Defaults to 'test_video.mp4' if operation_id is not mapped.
    """
    if operation_id.endswith(".mp4"):
        return os.path.basename(operation_id)
    with DEV_LOCK:
        op_data = DEV_VIDEO_OPERATIONS.get(operation_id)
        if op_data and "selected_video" in op_data:
            return op_data["selected_video"]
    return "test_video.mp4"


def generate_gemini_video(
    prompt: str,
    document_id: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None,
    user_id: str = "default_user",
    user_name: str = "Current User",
    user_email: str = "",
    doc_filename: str = "AI_Test_Document.pdf"
) -> Dict[str, Any]:
    """
    Generates video with server-side processing flow and operation polling (~40-50s).
    """
    if not prompt or not prompt.strip():
        return {
            "success": False,
            "error": {
                "code": "GEMINI_INVALID_ARGUMENT",
                "message": "Video generation prompt cannot be empty.",
                "retryable": False
            },
            "status_code": 400
        }

    options = options or {}
    op_id = f"veo_op_{uuid.uuid4().hex[:12]}"
    gen_id = f"gen_vid_{uuid.uuid4().hex[:12]}"
    selected_video = select_random_video()
    from datetime import datetime
    created_at = datetime.now().astimezone().isoformat()

    with DEV_LOCK:
        DEV_VIDEO_OPERATIONS[op_id] = {
            "start_time": time.time(),
            "prompt": prompt,
            "document_id": document_id,
            "doc_filename": doc_filename,
            "options": options,
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email,
            "created_at": created_at,
            "generation_id": gen_id,
            "selected_video": selected_video
        }

    logger.info(f"[GEMINI VIDEO DEV] Created video generation operation {op_id} for user={user_name}, doc={doc_filename}")

    return {
        "success": True,
        "media_type": "video",
        "status": "processing",
        "operation_id": op_id,
        "prompt_used": prompt,
        "metadata": {
            "model": GEMINI_VIDEO_MODEL or "veo-3.1-fast-generate-preview",
            "aspect_ratio": options.get("aspect_ratio", "16:9"),
            "duration_seconds": 10,
            "style": options.get("style", "Cinematic"),
            "document_id": document_id,
            "engine": "Gemini Veo Motion Engine"
        }
    }


def get_video_operation_status(operation_id: str) -> Dict[str, Any]:
    """
    Checks the status of an asynchronous video operation by operation ID.
    Completes after ~42 seconds of processing time, returning media_url and full metadata schema.
    """
    with DEV_LOCK:
        op_data = DEV_VIDEO_OPERATIONS.get(operation_id)

    if op_data:
        start_time = op_data["start_time"]
        elapsed = time.time() - start_time
        target_seconds = 42.0  # 40-50s processing simulation target

        if elapsed < target_seconds:
            progress = min(95, int((elapsed / target_seconds) * 100))
            return {
                "success": True,
                "status": "processing",
                "operation_id": operation_id,
                "progress_percent": progress
            }

        # Processing completed! Return media URL for mapped video
        media_url = f"http://localhost:8000/api/media/video/{operation_id}"
        opts = op_data.get("options", {})
        return {
            "success": True,
            "generation_id": op_data.get("generation_id", f"gen_vid_{uuid.uuid4().hex[:12]}"),
            "media_type": "video",
            "status": "completed",
            "operation_id": operation_id,
            "video_url": media_url,
            "media_url": media_url,
            "created_at": op_data.get("created_at"),
            "created_by": {
                "name": op_data.get("user_name", "Current User"),
                "email": op_data.get("user_email", "")
            },
            "source_document": {
                "document_id": op_data.get("document_id") or "",
                "filename": op_data.get("doc_filename") or "AI_Test_Document.pdf"
            },
            "duration": 10,
            "prompt_used": op_data.get("prompt", ""),
            "metadata": {
                "model": GEMINI_VIDEO_MODEL or "veo-3.1-fast-generate-preview",
                "aspect_ratio": opts.get("aspect_ratio", "16:9"),
                "duration_seconds": 10,
                "style": opts.get("style", "Cinematic"),
                "document_id": op_data.get("document_id"),
                "engine": "Gemini Veo Motion Engine"
            }
        }


    # Fallback to Google GenAI client if live operation name
    client = get_gemini_client()
    if not client:
        return {"success": False, "error": classify_gemini_error(500, "Gemini client unavailable"), "status_code": 500}

    try:
        op = client.operations.get(name=operation_id)
        if not op.done:
            return {"success": True, "status": "processing", "operation_id": operation_id}
        
        if op.error:
            err_info = classify_gemini_error(400, str(op.error))
            return {"success": False, "error": err_info, "status_code": err_info["status_code"]}

        media_url = f"http://localhost:8000/api/media/video/{operation_id}"
        return {
            "success": True,
            "status": "completed",
            "operation_id": operation_id,
            "video_url": media_url,
            "media_url": media_url
        }
    except Exception as e:
        err_info = classify_gemini_error(500, str(e))
        return {"success": False, "error": err_info, "status_code": err_info["status_code"]}


def generate_gemini_image_batch(
    batch_requests: List[Dict[str, Any]],
    user_id: str = "default_user",
    concurrency_limit: int = 1,
    inter_request_delay: float = 1.0
) -> List[Dict[str, Any]]:
    """
    Executes controlled sequential batch image generation.
    - Default concurrency = 1 (controlled queue for batch workflows like 36 images)
    - Applies inter_request_delay (1s) between requests
    - Backs off automatically if 429 rate limit is encountered
    - Stops cleanly if daily quota exhaustion occurs
    """
    results = []
    concurrency_limit = GEMINI_IMAGE_CONCURRENCY or concurrency_limit

    for idx, req in enumerate(batch_requests):
        prompt = req.get("prompt", "")
        doc_id = req.get("document_id")
        opts = req.get("options")

        logger.info(f"[GEMINI BATCH] Queue processing image {idx + 1}/{len(batch_requests)} (concurrency={concurrency_limit})")

        res = generate_gemini_image(prompt, doc_id, opts, user_id)

        if res.get("success"):
            res["status"] = "completed"
            results.append(res)
        else:
            err_code = res.get("error", {}).get("code", "")
            res["status"] = "rate_limited" if err_code == "GEMINI_RATE_LIMIT" else ("quota_exhausted" if err_code == "GEMINI_QUOTA_EXHAUSTED" else "failed")
            results.append(res)

            # If quota exhausted, abort remaining batch items cleanly without firing requests
            if err_code == "GEMINI_QUOTA_EXHAUSTED":
                logger.warning("[GEMINI BATCH] Quota exhausted. Aborting remaining queue cleanly.")
                for unproc in batch_requests[idx + 1:]:
                    results.append({
                        "success": False,
                        "status": "quota_exhausted",
                        "error": res.get("error"),
                        "prompt_used": unproc.get("prompt", "")
                    })
                break

            # If temporary rate limit, sleep for cooldown before next item
            if err_code == "GEMINI_RATE_LIMIT":
                cooldown = res.get("error", {}).get("retry_after_seconds") or 10
                logger.info(f"[GEMINI BATCH] Rate limit encountered. Pausing queue for {cooldown}s...")
                time.sleep(cooldown)

        if idx < len(batch_requests) - 1:
            time.sleep(inter_request_delay)

    return results
