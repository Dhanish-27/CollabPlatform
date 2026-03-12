from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, UserSkillViewSet, PasswordResetRequestView, ValidateGitHubUsernameView

router = DefaultRouter()
router.register('', UserViewSet, basename='user')
router.register('skills', UserSkillViewSet, basename='userskill')

urlpatterns = [
    # Custom paths MUST come before include(router.urls) — the router
    # registers UserViewSet at '' which generates a {pk}/ wildcard that
    # would otherwise match 'validate-github-username' as a pk value.
    path('password/reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('validate-github-username/', ValidateGitHubUsernameView.as_view(), name='validate-github-username'),
    path('', include(router.urls)),
]
