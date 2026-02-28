from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from jose import JWTError, jwt


ALGORITHM = "HS256"
DEFAULT_EXPIRY_HOURS = 24


class JwtError(Exception):
    """Raised when a JWT cannot be decoded or is invalid."""


def _get_secret() -> str:
    """
    Read the JWT secret from the environment.

    FastAPI will typically run this with JWT_SECRET set; failing that, we raise
    so callers can return 500/401 as appropriate.
    """
    import os

    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise JwtError("JWT_SECRET is not configured")
    return secret


def create_token(
    subject: str,
    *,
    name: str,
    room_id: int,
    role: str,
    expires_in_hours: int = DEFAULT_EXPIRY_HOURS,
    extra_claims: Dict[str, Any] | None = None,
) -> str:
    """
    Create a signed JWT for a room participant.

    Claims:
    - sub: opaque user id
    - name: display name
    - room_id: numeric room id
    - role: 'gm' | 'player'
    - exp: expiry (UTC)
    """
    now = datetime.now(timezone.utc)
    to_encode: Dict[str, Any] = {
        "sub": subject,
        "name": name,
        "room_id": room_id,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=expires_in_hours)).timestamp()),
    }
    if extra_claims:
        to_encode.update(extra_claims)

    secret = _get_secret()
    return jwt.encode(to_encode, secret, algorithm=ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a JWT.

    Raises JwtError on any problem; callers should treat this as authentication failure.
    """
    secret = _get_secret()
    try:
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise JwtError("Invalid token") from exc
    return payload

