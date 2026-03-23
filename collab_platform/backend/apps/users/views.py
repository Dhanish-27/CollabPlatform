import logging

# FIX: moved Q import to the top of the file where it belongs.
# Previously it was imported at the bottom of the file inside UserSearchView,
# which is an order-dependent anti-pattern.
from django.contrib.auth import authenticate, get_user_model
from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserActivity, UserSkill
from .serializers import (
    PasswordChangeSerializer,
    PasswordResetRequestSerializer,
    UserActivitySerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
    UserSerializer,
    UserSkillSerializer,
)

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

        # ── Check DB uniqueness first (no network call) ──────────────────
        if User.objects.filter(github_username__iexact=github_username).exists():
            return Response({
                'valid': False,
                'error': 'This GitHub username is already linked to another account on this platform.'
            })

        # ── Check GitHub REST API directly ───────────────────────────────
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
                canonical_username = resp.json().get('login', github_username)
                return Response({'valid': True, 'canonical': canonical_username})

            elif resp.status_code == 404:
                return Response({
                    'valid': False,
                    'error': f"GitHub user '{github_username}' does not exist. Please check the spelling."
                })

            else:
                logger.warning(
                    "GitHub API returned %s for user '%s'",
                    resp.status_code,
                    github_username,
                )
                return Response({
                    'valid': True,
                    'warning': f'GitHub returned status {resp.status_code}; username not fully verified.'
                })

        except http_requests.Timeout:
            logger.warning("GitHub API timed out while validating '%s'", github_username)
            return Response({'valid': True, 'warning': 'GitHub API timed out; username not verified online.'})

        except Exception as exc:
            logger.warning("GitHub API check failed for '%s': %s", github_username, exc)
            return Response({'valid': True, 'warning': 'GitHub API unreachable; username not verified online.'})


class LoginThrottle(AnonRateThrottle):
    """
    FIX: dedicated throttle for the login endpoint.
    Set THROTTLE_RATES['login'] in settings.py, e.g. '5/min'.
    """
    scope = 'login'


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for User model."""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        # FIX: removed 'reset_password' — that action doesn't exist on this
        # ViewSet; it lives on the standalone PasswordResetRequestView.
        if self.action in ['create', 'login']:
            return [AllowAny()]
        return super().get_permissions()

    def get_throttles(self):
        # FIX: apply a strict throttle only to the login action to limit
        # brute-force attempts without affecting other endpoints.
        if self.action == 'login':
            return [LoginThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):
        if self.action == 'create':
            return UserRegistrationSerializer
        if self.action == 'list':
            return UserProfileSerializer
        if self.action == 'retrieve':
            # FIX: previously called self.get_object() here, which fired a
            # duplicate DB query and ran permission checks at the wrong stage.
            # Compare PKs directly from kwargs instead.
            request_user = self.request.user
            target_pk = self.kwargs.get('pk')
            if request_user.is_authenticated and (
                request_user.is_staff or str(request_user.pk) == str(target_pk)
            ):
                return UserSerializer
            return UserProfileSerializer
        return UserSerializer

    def get_queryset(self):
        # FIX: prefetch projects_joined so the projects_joined_count
        # SerializerMethodField doesn't produce an N+1 query per user.
        queryset = User.objects.prefetch_related(
            Prefetch('projects_joined'),
            Prefetch('user_skills'),
        ).all()

        role = self.request.query_params.get('role')
        if role:
            queryset = queryset.filter(role=role)

        # FIX: skill filtering now queries UserSkill (relational) instead of
        # the removed JSON field.
        skill = self.request.query_params.get('skill')
        if skill:
            queryset = queryset.filter(user_skills__name__iexact=skill)

        experience = self.request.query_params.get('experience')
        if experience:
            queryset = queryset.filter(experience_level=experience)

        available = self.request.query_params.get('available')
        if available == 'true':
            queryset = queryset.filter(availability_hours__gt=0)

        mentors_only = self.request.query_params.get('mentors')
        if mentors_only == 'true':
            queryset = queryset.filter(
                role='mentor',
                is_verified_mentor=True
            )

        return queryset

    def perform_create(self, serializer):
        # UserRegistrationSerializer.create() calls create_user() which
        # already hashes the password correctly.
        serializer.save()

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user profile."""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def login(self, request):
        """
        Login and return JWT tokens.

        FIX: replaced the manual User.objects.get() + check_password() pattern
        with Django's authenticate(), which is constant-time and immune to
        username-enumeration via response timing differences.
        """
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response(
                {'error': 'Email and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(request, username=email, password=password)

        if user is None:
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
        """Get current user's recent activities."""
        activities = (
            UserActivity.objects
            .filter(user=request.user)
            .select_related('project')[:50]
        )
        serializer = UserActivitySerializer(activities, many=True)
        return Response(serializer.data)

    # FIX: changed detail=True so the router generates /users/{pk}/public_profile/
    # and passes pk through kwargs. Previously detail=False meant pk was always
    # None, so User.objects.get(pk=pk) always raised User.DoesNotExist.
    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def public_profile(self, request, pk=None):
        """Get the public profile of any user by pk."""
        try:
            user = User.objects.prefetch_related('projects_joined', 'user_skills').get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not user.is_public_profile and user != request.user:
            return Response(
                {'error': 'This profile is private'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = UserProfileSerializer(user)
        return Response(serializer.data)


class UserSkillViewSet(viewsets.ModelViewSet):
    """ViewSet for UserSkill model — scoped to the authenticated user."""
    serializer_class = UserSkillSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserSkill.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PasswordResetRequestView(generics.GenericAPIView):
    """Request a password reset email."""
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        try:
            user = User.objects.get(email=email)
            # TODO: Send password reset email via django.core.mail or a
            # third-party provider (e.g. SendGrid). Generate a signed token
            # with django.contrib.auth.tokens.PasswordResetTokenGenerator
            # and include it in the reset link.
            _ = user  # referenced to avoid linter warnings until implemented
        except User.DoesNotExist:
            pass  # Don't reveal whether the email exists.

        # Always return the same message to prevent email enumeration.
        return Response({
            'message': 'If that email address is registered, a reset link has been sent.'
        })


class UserSearchView(generics.ListAPIView):
    """Search public users by query string."""
    serializer_class = UserProfileSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = (
            User.objects
            .filter(is_public_profile=True)
            .prefetch_related('projects_joined', 'user_skills')
        )

        query = self.request.query_params.get('q')
        if query:
            # FIX: skill search now queries UserSkill.name instead of the
            # removed User.skills JSONField.
            queryset = queryset.filter(
                Q(username__icontains=query) |
                Q(bio__icontains=query) |
                Q(user_skills__name__icontains=query)
            ).distinct()

        return queryset