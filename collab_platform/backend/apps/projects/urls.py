from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, JoinRequestViewSet, InvitationViewSet

router = DefaultRouter()
router.register('', ProjectViewSet, basename='project')

urlpatterns = [
    path('', include(router.urls)),
    path('invitations/', InvitationViewSet.as_view({
        'get': 'my_invitations',
        'post': 'accept'
    }), name='invitations'),
    path('invitations/decline/', InvitationViewSet.as_view({
        'post': 'decline'
    }), name='invitations-decline'),
]
