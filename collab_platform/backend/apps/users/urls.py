from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    PasswordResetRequestView,
    UserSearchView,
    UserSkillViewSet,
    UserViewSet,
    ValidateGitHubUsernameView,
)

router = DefaultRouter()
router.register('', UserViewSet, basename='user')
router.register('skills', UserSkillViewSet, basename='userskill')

urlpatterns = [
    # Custom paths MUST come before include(router.urls).
    # The router registers UserViewSet at '' which generates a {pk}/ wildcard
    # that would otherwise swallow 'search', 'password/reset/', and
    # 'validate-github-username/' as pk values.
    path('search/', UserSearchView.as_view(), name='user-search'),
    path('password/reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('validate-github-username/', ValidateGitHubUsernameView.as_view(), name='validate-github-username'),
    path('', include(router.urls)),
]