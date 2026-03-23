from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import UserSkill, UserActivity

User = get_user_model()


class UserSkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSkill
        fields = ['id', 'name', 'proficiency']
        read_only_fields = ['id']


class UserActivitySerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    project_title = serializers.CharField(source='project.title', read_only=True)

    class Meta:
        model = UserActivity
        fields = [
            'id', 'user', 'user_email', 'action', 'description',
            'project', 'project_title', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    """Full serializer for User model (authenticated / own profile)."""

    # FIX: removed the redundant tasks_completed_count SerializerMethodField.
    # tasks_completed is a plain integer field; expose it directly.
    # FIX: removed skills / skills_list — skills now live exclusively in
    # UserSkill (relational). Use the nested UserSkillSerializer instead.
    user_skills = UserSkillSerializer(many=True, read_only=True)
    projects_joined_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'role', 'avatar', 'bio',
            'user_skills', 'experience_level',
            'github_username', 'github_link', 'portfolio_link', 'linkedin_link',
            'availability_hours', 'is_available_for_mentoring',
            'is_public_profile', 'is_verified_mentor', 'profile_completion',
            'projects_joined_count', 'tasks_completed', 'total_contributions',
            'teamwork_rating', 'reliability_rating', 'feedback_count',
            'last_activity', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'profile_completion', 'tasks_completed',
            'total_contributions', 'teamwork_rating',
            'reliability_rating', 'feedback_count', 'last_activity',
            'created_at', 'updated_at'
        ]

    def get_projects_joined_count(self, obj):
        # Relies on prefetch_related('projects_joined') in the queryset.
        # .count() against a prefetched M2M uses the cache, not a new query.
        return obj.projects_joined.count()

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        user.calculate_profile_completion()
        user.save(update_fields=['profile_completion'])
        return user

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.calculate_profile_completion()
        instance.save()
        return instance


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    github_username = serializers.CharField(
        max_length=39,
        required=False,
        allow_blank=True,
        help_text="Your GitHub username — must be an existing GitHub account not already registered here."
    )

    class Meta:
        model = User
        fields = ['email', 'username', 'github_username', 'password', 'password_confirm', 'role']

    def validate_role(self, value):
        """
        FIX: Prevent self-assignment of the mentor role at registration.
        Mentor status must go through a verified approval flow.
        """
        if value == 'mentor':
            raise serializers.ValidationError(
                "You cannot register directly as a mentor. "
                "Please register as a developer or student and apply for mentor status."
            )
        return value

    def validate_github_username(self, value):
        """Validate that the GitHub username exists on GitHub and is unique in our DB."""
        if not value:
            return value

        value = value.strip().lower()

        # Check uniqueness in our DB first (cheap, no API call).
        # FIX: use __iexact for case-insensitive uniqueness consistent with
        # how ValidateGitHubUsernameView performs the same check.
        if User.objects.filter(github_username__iexact=value).exists():
            raise serializers.ValidationError(
                "This GitHub username is already linked to another account on this platform."
            )

        # Validate existence on GitHub (API call).
        try:
            from apps.github_integration.github_service import GitHubService
            from django.conf import settings
            if hasattr(settings, 'GITHUB_TOKEN') and settings.GITHUB_TOKEN:
                service = GitHubService()
                if not service.check_user_exists(value):
                    raise serializers.ValidationError(
                        f"GitHub user '{value}' does not exist. Please enter a valid GitHub username."
                    )
        except serializers.ValidationError:
            raise
        except Exception:
            # If GitHub API is unreachable, skip the check to not block registration.
            pass

        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Passwords don't match"})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    """Public profile serializer — safe subset of fields, all read-only."""

    # FIX: replaced skills JSONField with relational UserSkill data.
    user_skills = UserSkillSerializer(many=True, read_only=True)
    projects_joined_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'role', 'avatar', 'bio',
            'user_skills', 'experience_level', 'github_username', 'github_link',
            'portfolio_link', 'availability_hours',
            'is_verified_mentor', 'profile_completion',
            'projects_joined_count', 'teamwork_rating',
            'reliability_rating', 'created_at'
        ]
        # FIX: use an explicit tuple instead of referencing `fields` by name,
        # which is fragile and order-dependent within the class body.
        read_only_fields = (
            'id', 'username', 'role', 'avatar', 'bio',
            'user_skills', 'experience_level', 'github_username', 'github_link',
            'portfolio_link', 'availability_hours',
            'is_verified_mentor', 'profile_completion',
            'projects_joined_count', 'teamwork_rating',
            'reliability_rating', 'created_at'
        )

    def get_projects_joined_count(self, obj):
        return obj.projects_joined.count()


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for password change."""
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect")
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for password reset request."""
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for password reset confirmation."""
    new_password = serializers.CharField(validators=[validate_password])
    new_password_confirm = serializers.CharField()

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({"new_password": "Passwords don't match"})
        return attrs