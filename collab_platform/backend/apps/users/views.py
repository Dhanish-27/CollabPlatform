from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import UserSkill, UserActivity
from .serializers import (
    UserSerializer, UserProfileSerializer, UserRegistrationSerializer,
    UserSkillSerializer, UserActivitySerializer,
    PasswordChangeSerializer, PasswordResetRequestSerializer
)

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for User model."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        if self.action in ['create', 'login', 'reset_password']:
            return [AllowAny()]
        return super().get_permissions()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserRegistrationSerializer
        if self.action == 'list':
            return UserProfileSerializer
        if self.action == 'retrieve':
            if self.request.user.is_authenticated:
                if self.request.user.is_staff or \
                   self.request.user.id == self.get_object().id:
                    return UserSerializer
            return UserProfileSerializer
        return UserSerializer
    
    def get_queryset(self):
        queryset = User.objects.all()
        
        # Filter by role
        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)
        
        # Filter by skills
        skill = self.request.query_params.get('skill')
        if skill:
            queryset = queryset.filter(skills__contains=[skill])
        
        # Filter by experience level
        experience = self.request.query_params.get('experience')
        if experience:
            queryset = queryset.filter(experience_level=experience)
        
        # Filter by availability
        available = self.request.query_params.get('available')
        if available == 'true':
            queryset = queryset.filter(availability_hours__gt=0)
        
        # Filter mentors only
        mentors_only = self.request.query_params.get('mentors')
        if mentors_only == 'true':
            queryset = queryset.filter(
                role='mentor',
                is_verified_mentor=True
            )
        
        return queryset
    
    def perform_create(self, serializer):
        user = serializer.save()
        user.set_password(serializer.validated_data['password'])
        user.save()
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user profile."""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def login(self, request):
        """Login and return JWT tokens."""
        email = request.data.get('email')
        password = request.data.get('password')
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        if not user.check_password(password):
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        if not user.is_active:
            return Response(
                {'error': 'User account is disabled'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        user.last_activity = timezone.now()
        user.save(update_fields=['last_activity'])
        
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        })
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def change_password(self, request):
        """Change user password."""
        serializer = PasswordChangeSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        
        return Response({'message': 'Password changed successfully'})
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def activities(self, request):
        """Get user activities."""
        activities = UserActivity.objects.filter(
            user=request.user
        ).select_related('project')[:50]
        serializer = UserActivitySerializer(activities, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def public_profile(self, request, pk=None):
        """Get public profile of a user."""
        try:
            user = User.objects.get(pk=pk)
            if not user.is_public_profile and user != request.user:
                return Response(
                    {'error': 'This profile is private'},
                    status=status.HTTP_403_FORBIDDEN
                )
            serializer = UserProfileSerializer(user)
            return Response(serializer.data)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class UserSkillViewSet(viewsets.ModelViewSet):
    """ViewSet for UserSkill model."""
    serializer_class = UserSkillSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return UserSkill.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PasswordResetRequestView(generics.GenericAPIView):
    """Request password reset."""
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        try:
            user = User.objects.get(email=email)
            # TODO: Send password reset email
            # For development, just return success
            return Response({
                'message': 'Password reset email sent'
            })
        except User.DoesNotExist:
            # Don't reveal if email exists
            return Response({
                'message': 'If the email exists, a reset link has been sent'
            })


class UserSearchView(generics.ListAPIView):
    """Search users by various criteria."""
    serializer_class = UserProfileSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        queryset = User.objects.filter(is_public_profile=True)
        
        # Search by query
        query = self.request.query_params.get('q')
        if query:
            queryset = queryset.filter(
                models.Q(username__icontains=query) |
                models.Q(bio__icontains=query) |
                models.Q(skills__contains=[query])
            )
        
        return queryset


# Import models at module level for search
from django.db import models
