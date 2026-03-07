from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, UserSkillViewSet, PasswordResetRequestView

router = DefaultRouter()
router.register('', UserViewSet, basename='user')
router.register('skills', UserSkillViewSet, basename='userskill')

urlpatterns = [
    path('', include(router.urls)),
    path('password/reset/', PasswordResetRequestView.as_view(), name='password-reset'),
]
