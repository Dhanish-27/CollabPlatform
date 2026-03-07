from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserFeedbackViewSet, ReportViewSet, AnalyticsViewSet

router = DefaultRouter()
router.register('feedback', UserFeedbackViewSet, basename='feedback')
router.register('reports', ReportViewSet, basename='report')
router.register('', AnalyticsViewSet, basename='analytics')

urlpatterns = [
    path('', include(router.urls)),
]
