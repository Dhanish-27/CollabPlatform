from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChatMessageViewSet, ThreadViewSet, ThreadReplyViewSet, AnnouncementViewSet

router = DefaultRouter()
router.register('messages', ChatMessageViewSet, basename='chatmessage')
router.register('threads', ThreadViewSet, basename='thread')
router.register('announcements', AnnouncementViewSet, basename='announcement')

urlpatterns = [
    path('', include(router.urls)),
    path('threads/<int:thread_pk>/replies/', ThreadReplyViewSet.as_view({'get': 'list', 'post': 'create'}), name='thread-replies'),
]
