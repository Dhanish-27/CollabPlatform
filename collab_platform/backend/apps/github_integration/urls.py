from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GitHubRepositoryViewSet, ContributionAnalyticsViewSet

router = DefaultRouter()
router.register('repos', GitHubRepositoryViewSet, basename='githubrepo')
router.register('analytics', ContributionAnalyticsViewSet, basename='contributionanalytics')

urlpatterns = [
    path('', include(router.urls)),
]
