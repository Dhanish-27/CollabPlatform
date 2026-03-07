"""
WebSocket URL Routing
=====================
Routes WebSocket connections to appropriate consumers.
"""

from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Main chat WebSocket - connects to /ws/chat/
    # Query params: project_id=<id>
    re_path(
        r'ws/chat/$',
        consumers.ChatConsumer.as_asgi(),
        name='websocket_chat'
    ),
    
    # Presence WebSocket - for online/offline status
    # Connects to /ws/presence/
    re_path(
        r'ws/presence/$',
        consumers.PresenceConsumer.as_asgi(),
        name='websocket_presence'
    ),
]
