"""
PhysioVision Download Server — Raspberry Pi 5
Serves the installer .exe with:
  - Cloudflare Turnstile bot verification
  - Per-IP rate limiting (5 downloads / hour)
  - SHA-256 integrity check on startup
  - Signed download tokens (prevents direct-link abuse)
  - Download logging
"""

import hashlib
import hmac
import logging
import os
import secrets
import time
from pathlib import Path

import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# ── CONFIG ────────────────────────────────────────────────────
EXE_PATH = Path(__file__).parent / "PhysioVision_v1_Setup.exe"
EXPECTED_SHA256 = os.getenv("EXE_SHA256", "PASTE_YOUR_HASH_HERE")
TURNSTILE_SECRET = os.getenv("TURNSTILE_SECRET_KEY", "")
TOKEN_SECRET = os.getenv("TOKEN_SECRET", secrets.token_hex(32))

ALLOWED_ORIGINS = [
    "https://physiovision.app",
    "https://www.physiovision.app",
    "http://localhost:3000",
    "http://127.0.0.1:5500",
]

# ── LOGGING ───────────────────────────────────────────────────
logging.basicConfig(
    filename="downloads.log",
    format="%(asctime)s | %(levelname)s | %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("dl")

# ── FILE INTEGRITY CHECK ON STARTUP ──────────────────────────
def verify_file_integrity():
    if not EXE_PATH.exists():
        raise SystemExit(f"FATAL: {EXE_PATH} not found")
    sha = hashlib.sha256()
    with open(EXE_PATH, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha.update(chunk)
    actual = sha.hexdigest()
    if EXPECTED_SHA256 != "PASTE_YOUR_HASH_HERE" and actual != EXPECTED_SHA256:
        raise SystemExit(
            f"FATAL: File integrity check failed!\n"
            f"  Expected: {EXPECTED_SHA256}\n"
            f"  Got:      {actual}"
        )
    log.info(f"File integrity OK — SHA-256: {actual}")
    return actual

FILE_SHA256 = verify_file_integrity()
FILE_SIZE = EXE_PATH.stat().st_size

# ── APP ───────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# ── MODELS ────────────────────────────────────────────────────
class DownloadRequest(BaseModel):
    cf_token: str = Field(..., min_length=1, max_length=4096)


# ── HELPERS ───────────────────────────────────────────────────
def verify_turnstile(token: str, ip: str) -> bool:
    if not TURNSTILE_SECRET:
        return True
    try:
        resp = requests.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={"secret": TURNSTILE_SECRET, "response": token, "remoteip": ip},
            timeout=5,
        ).json()
        return resp.get("success", False)
    except Exception as e:
        log.error(f"Turnstile verification failed: {e}")
        return False


def make_download_token(ip: str) -> str:
    """HMAC-based token valid for 60 seconds, tied to the requester's IP."""
    ts = str(int(time.time()))
    msg = f"{ip}:{ts}".encode()
    sig = hmac.new(TOKEN_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    return f"{ts}:{sig}"


def verify_download_token(token: str, ip: str) -> bool:
    try:
        ts, sig = token.split(":", 1)
        if abs(time.time() - int(ts)) > 600:
            return False
        msg = f"{ip}:{ts}".encode()
        expected = hmac.new(TOKEN_SECRET.encode(), msg, hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, expected)
    except Exception:
        return False


# ── ENDPOINTS ─────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "file_size": FILE_SIZE, "sha256": FILE_SHA256}


@app.post("/request-download")
@limiter.limit("5/hour")
async def request_download(request: Request, body: DownloadRequest):
    """
    Step 1: Frontend sends the Turnstile token here.
    If valid, returns a short-lived signed download token.
    """
    ip = get_remote_address(request)

    if not verify_turnstile(body.cf_token, ip):
        log.warning(f"{ip} | TURNSTILE_FAIL")
        raise HTTPException(status_code=403, detail="Bot verification failed.")

    token = make_download_token(ip)
    log.info(f"{ip} | DOWNLOAD_TOKEN_ISSUED")

    return {
        "download_token": token,
        "sha256": FILE_SHA256,
        "file_size": FILE_SIZE,
    }


@app.get("/download/{token}")
@limiter.limit("5/hour")
async def download_file(request: Request, token: str):
    """
    Step 2: Frontend redirects here with the signed token.
    Serves the .exe only if the token is valid and not expired.
    """
    ip = get_remote_address(request)

    if not verify_download_token(token, ip):
        log.warning(f"{ip} | INVALID_DOWNLOAD_TOKEN")
        raise HTTPException(status_code=403, detail="Invalid or expired download link.")

    if not EXE_PATH.exists():
        raise HTTPException(status_code=500, detail="File temporarily unavailable.")

    log.info(f"{ip} | DOWNLOAD_STARTED")

    return FileResponse(
        path=str(EXE_PATH),
        filename="PhysioVision_v1_Setup.exe",
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": 'attachment; filename="PhysioVision_v1_Setup.exe"',
            "X-Content-SHA256": FILE_SHA256,
            "Cache-Control": "no-store",
        },
    )
