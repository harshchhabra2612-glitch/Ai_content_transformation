import time
from collections import defaultdict
import threading
from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from backend.security.config import RATE_LIMIT_PER_MINUTE

# Sliding window rate limiter state
_request_history: dict[str, list[float]] = defaultdict(list)
_rate_lock = threading.Lock()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware injecting essential HTTP security headers into every response.
    """
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if request.url.path in ("/docs", "/redoc", "/openapi.json"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fastapi.tiangolo.com; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' data: https://fastapi.tiangolo.com; "
                "frame-ancestors 'none';"
            )
        else:
            response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
        return response



class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    In-memory sliding window rate limiter middleware per client IP.
    Returns 429 Too Many Requests when rate limit is exceeded.
    """
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Exclude static assets, health checks, or media endpoints
        if request.url.path in ("/", "/health") or request.url.path.startswith("/api/media/") or request.url.path.startswith("/test_image"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()
        window_start = now - 60.0  # 1 minute window

        with _rate_lock:
            # Purge entries older than window
            timestamps = [t for t in _request_history[client_ip] if t > window_start]
            
            if len(timestamps) >= RATE_LIMIT_PER_MINUTE:
                raise HTTPException(
                    status_code=429,
                    detail=f"Too Many Requests: Rate limit of {RATE_LIMIT_PER_MINUTE} requests per minute exceeded. Please try again later."
                )

            timestamps.append(now)
            _request_history[client_ip] = timestamps

        return await call_next(request)
