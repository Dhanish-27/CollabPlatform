"""
URL configuration for collab_platform project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('apps.users.urls')),
    path('api/projects/', include('apps.projects.urls')),
    path('api/tasks/', include('apps.tasks.urls')),
    path('api/communications/', include('apps.communications.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/github/', include('apps.github_integration.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('auth/', include('rest_framework.urls')),
    path('accounts/', include('allauth.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
