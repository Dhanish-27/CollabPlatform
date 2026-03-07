from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, JoinRequestViewSet

router = DefaultRouter()
router.register('', ProjectViewSet, basename='project')

urlpatterns = [
    path('', include(router.urls)),
]
