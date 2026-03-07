"""
JWT WebSocket Authentication Middleware
========================================
Reads the JWT token from the WebSocket query string (?token=...) and
authenticates the Django user, setting scope['user'] before the consumer runs.

Usage in asgi.py:
    from apps.communications.middleware import JwtAuthMiddlewareStack
    application = ProtocolTypeRouter({
        "websocket": JwtAuthMiddlewareStack(URLRouter(websocket_urlpatterns))
    })
"""

from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


@database_sync_to_async
def get_user_from_token(token_key):
    """Decode JWT and return the corresponding User, or AnonymousUser on failure."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        # Validate token signature and expiry
        validated_token = UntypedToken(token_key)
        user_id = validated_token.get('user_id')
        return User.objects.get(id=user_id)
    except (InvalidToken, TokenError, Exception) as e:
        logger.warning(f"WS JWT auth failed: {e}")
        return AnonymousUser()


class JwtAuthMiddleware:
    """ASGI middleware that authenticates WebSocket connections via JWT query param."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope['type'] == 'websocket':
            # Parse ?token=<jwt> from query string
            query_string = scope.get('query_string', b'').decode()
            params = parse_qs(query_string)
            token_list = params.get('token', [])

            if token_list:
                scope['user'] = await get_user_from_token(token_list[0])
            else:
                scope['user'] = AnonymousUser()

        return await self.inner(scope, receive, send)


def JwtAuthMiddlewareStack(inner):
    """Convenience wrapper — drop-in replacement for AuthMiddlewareStack."""
    return JwtAuthMiddleware(inner)
