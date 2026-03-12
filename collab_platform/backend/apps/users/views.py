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
import logging

logger = logging.getLogger(__name__)
User = get_user_model()



class ValidateGitHubUsernameView(APIView):
    """Real-time GitHub username validation for the registration form.

    Uses the public GitHub REST API directly (no org initialization required).
    POST body: { "github_username": "somename" }
    Returns:   { "valid": true } or { "valid": false, "error": "..." }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        import requests as http_requests
        from django.conf import settings

        github_username = request.data.get('github_username', '').strip()

        if not github_username:
            return Response(
                {'valid': False, 'error': 'GitHub username is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # GitHub usernames are case-insensitive; normalise for DB look-ups
        github_username_lower = github_username.lower()

        # ── Check DB uniqueness first (no network call) ──────────────────
        if User.objects.filter(github_username__iexact=github_username).exists():
            return Response({
                'valid': False,
                'error': 'This GitHub username is already linked to another account on this platform.'
            })

        # ── Check GitHub REST API directly ───────────────────────────────
        # Uses PAT as optional auth header to raise rate limit (60 → 5000 req/hr).
        # Does NOT require org access — this is a public user-lookup endpoint.
        try:
            headers = {'Accept': 'application/vnd.github+json'}
            token = getattr(settings, 'GITHUB_TOKEN', None)
            if token:
                headers['Authorization'] = f'Bearer {token}'

            resp = http_requests.get(
                f'https://api.github.com/users/{github_username}',
                headers=headers,
                timeout=5
            )

            if resp.status_code == 200:
                # User exists — store the login name as returned by GitHub
                # (preserves original casing, e.g. "Dhanish-27")
                canonical_username = resp.json().get('login', github_username)
                return Response({'valid': True, 'canonical': canonical_username})

            elif resp.status_code == 404:
                return Response({
                    'valid': False,
                    'error': f"GitHub user '{github_username}' does not exist. Please check the spelling."
                })

            else:
                # Unexpected status — degrade gracefully
                logger.warning(f"GitHub API returned {resp.status_code} for user '{github_username}'")
                return Response({
                    'valid': True,
                    'warning': f'GitHub returned status {resp.status_code}; username not fully verified.'
                })

        except http_requests.Timeout:
            logger.warning(f"GitHub API timed out while validating '{github_username}'")
            return Response({'valid': True, 'warning': 'GitHub API timed out; username not verified online.'})

        except Exception as e:
            logger.warning(f"GitHub API check failed for '{github_username}': {e}")
            return Response({'valid': True, 'warning': 'GitHub API unreachable; username not verified online.'})


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
        # UserRegistrationSerializer.create() calls create_user() which
        # already hashes the password correctly — no extra set_password needed.
        serializer.save()
    
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
