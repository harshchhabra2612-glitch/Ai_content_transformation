"""
ERA AI Gateway Service — OpenAI Compatible Client for Internal Gateway.

Connects to the internal Hackathon AI Gateway (http://172.16.10.110:4000/v1) for model inference.
Handles API key resolution from backend environment variables ONLY.
Provides safe logging without revealing credentials or full sensitive payloads.
Captures token usage (prompt_tokens, completion_tokens, total_tokens) and latency_ms.
Exclusively uses qwen-7b for text generation.
"""

import os
import time
import logging
import requests
from typing import Dict, Any, Optional, List
from openai import OpenAI


logger = logging.getLogger("ai_gateway")
logger.setLevel(logging.INFO)

# Default Gateway Configuration
DEFAULT_GATEWAY_URL = "http://172.16.10.110:4000/v1"
DEFAULT_MODEL = "qwen-7b"
MINICPM_MODEL = "minicpm-v"


def get_ai_gateway_url() -> str:
    """Returns configured AI Gateway base URL."""
    return os.getenv("AI_GATEWAY_URL", "").strip() or DEFAULT_GATEWAY_URL


def get_ai_gateway_api_key() -> str:
    """
    Returns AI Gateway API Key securely from backend environment ONLY.
    Never exposes or logs the key.
    """
    key = os.getenv("AI_GATEWAY_API_KEY", "").strip()
    if not key:
        # Search in root .env if not loaded into os.environ
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
                            if line_str.startswith("AI_GATEWAY_API_KEY="):
                                key = line_str.split("=", 1)[1].strip().strip('"').strip("'")
                                if key:
                                    break
                except Exception as e:
                    logger.warning(f"Could not inspect env file {env_path}: {e}")
            if key:
                break
    return key


def get_ai_model() -> str:
    """Returns configured model name (qwen-7b)."""
    return os.getenv("AI_MODEL", "").strip() or os.getenv("AI_AGENT1_MODEL", "").strip() or DEFAULT_MODEL


def get_agent1_model() -> str:
    """Returns configured Agent 1 model name (qwen-7b)."""
    return get_ai_model()


def get_openai_client(timeout: float = 120.0) -> OpenAI:
    """
    Instantiates an OpenAI client targeting the internal AI Gateway.
    Credential resolution is strictly isolated to backend environment.
    Uses reasonable server-side generation timeout (120 seconds).
    """
    api_key = get_ai_gateway_api_key() or "dummy_gateway_key"
    base_url = get_ai_gateway_url()
    return OpenAI(api_key=api_key, base_url=base_url, timeout=timeout)


def call_ai_gateway(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: Optional[int] = 1000,
    timeout: float = 120.0
) -> Dict[str, Any]:
    """
    Executes a Chat Completion request against the internal AI Gateway using Qwen 7B.
    
    Safe Logging: Logs model, provider, status code, latency_ms, and token usage without exposing
    API keys, authorization headers, or raw sensitive document context.
    """
    target_model = model or get_ai_model()
    base_url = get_ai_gateway_url()
    target_temp = temperature if temperature is not None else 0.2
    target_max_tokens = max_tokens or 1000

    logger.info(
        f"AI_GATEWAY_REQUEST_START provider=internal_gateway base_url={base_url} "
        f"AI_GATEWAY_MODEL={target_model} max_tokens={target_max_tokens} timeout={timeout}s"
    )

    start_time = time.time()
    try:
        client = get_openai_client(timeout=timeout)
        kwargs: Dict[str, Any] = {
            "model": target_model,
            "messages": messages,
            "temperature": target_temp,
        }
        if target_max_tokens:
            kwargs["max_tokens"] = target_max_tokens

        response = client.chat.completions.create(**kwargs)
        duration_ms = int((time.time() - start_time) * 1000)
        
        content = ""
        if response.choices and len(response.choices) > 0:
            content = response.choices[0].message.content or ""

        prompt_tokens = 0
        completion_tokens = 0
        total_tokens = 0

        if hasattr(response, "usage") and response.usage:
            prompt_tokens = getattr(response.usage, "prompt_tokens", 0) or 0
            completion_tokens = getattr(response.usage, "completion_tokens", 0) or 0
            total_tokens = getattr(response.usage, "total_tokens", 0) or 0

        # Fallback non-zero estimation if gateway usage object is omitted or zero
        if prompt_tokens == 0 and messages:
            prompt_str = " ".join([m.get("content", "") for m in messages])
            prompt_tokens = max(1, len(prompt_str) // 4)
        if completion_tokens == 0 and content:
            completion_tokens = max(1, len(content) // 4)
        if total_tokens == 0:
            total_tokens = prompt_tokens + completion_tokens

        usage_info = {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens
        }

        logger.info(
            f"AI_GATEWAY_RESPONSE_RECEIVED AI_GATEWAY_MODEL={target_model} AI_GATEWAY_STATUS=completed "
            f"AI_GATEWAY_DURATION_MS={duration_ms} AI_GATEWAY_TOKEN_USAGE={usage_info} response_len={len(content)}"
        )

        return {
            "success": True,
            "content": content,
            "model": target_model,
            "temperature": target_temp,
            "max_tokens": target_max_tokens,
            "usage": usage_info,
            "latency_ms": duration_ms
        }

    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        err_msg = str(e)
        is_timeout = "timeout" in err_msg.lower() or "timed out" in err_msg.lower()
        if is_timeout:
            logger.error(f"AI_GATEWAY_TIMEOUT AI_GATEWAY_MODEL={target_model} AI_GATEWAY_DURATION_MS={duration_ms} error={err_msg}")
        else:
            logger.error(f"AI_GATEWAY_ERROR AI_GATEWAY_MODEL={target_model} AI_GATEWAY_STATUS=failed AI_GATEWAY_DURATION_MS={duration_ms} error={err_msg}")

        return {
            "success": False,
            "error": err_msg,
            "model": target_model,
            "temperature": target_temp,
            "max_tokens": target_max_tokens,
            "usage": {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0
            },
            "latency_ms": duration_ms
        }


def call_minicpm_vision_extraction(image_b64: str) -> str:
    """
    Calls MiniCPM (minicpm-v) via the Public Base API for document text/content extraction ONLY.
    Sends base64 encoded document image and strict extraction prompt.
    Does NOT perform summary, interpretation, or text generation.
    """
    gateway_url = get_ai_gateway_url()
    api_key = get_ai_gateway_api_key() or "dummy_gateway_key"
    prompt_text = (
        "Extract all visible text from this document image exactly as written. "
        "Output ONLY the raw extracted content. Preserve exact wording, numbers, names, headings, dates, and tables. "
        "Do NOT summarize, comment, interpret, format as email/report/FAQ, or add commentary."
    )

    client = get_openai_client()
    try:
        response = client.chat.completions.create(
            model=MINICPM_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt_text},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{image_b64}"}
                        }
                    ]
                }
            ],
            temperature=0.1,
            max_tokens=2048
        )
        if response.choices and len(response.choices) > 0:
            extracted = (response.choices[0].message.content or "").strip()
            if extracted:
                return extracted
    except Exception as e:
        logger.warning(f"[MINICPM GATEWAY VISION WARNING] Vision completions failed: {e}")

    # Fallback to standard requests if OpenAI SDK vision format is rejected by proxy
    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": MINICPM_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": prompt_text,
                    "images": [image_b64]
                }
            ],
            "temperature": 0.1,
            "max_tokens": 2048
        }
        res = requests.post(f"{gateway_url.rstrip('/')}/chat/completions", json=payload, headers=headers, timeout=15)
        if res.status_code == 200:
            data = res.json()
            if "choices" in data and len(data["choices"]) > 0:
                return (data["choices"][0].get("message", {}).get("content", "") or "").strip()
    except Exception as err:
        logger.warning(f"[MINICPM GATEWAY REQUEST WARNING] Direct HTTP vision request failed: {err}")

    return ""

