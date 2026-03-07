from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, MilestoneViewSet

router = DefaultRouter()
router.register('tasks', TaskViewSet, basename='task')
router.register('milestones', MilestoneViewSet, basename='milestone')

urlpatterns = [
    path('', include(router.urls)),
]
