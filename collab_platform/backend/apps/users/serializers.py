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
    """Serializer for User model."""
    skills_list = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False
    )
    projects_joined_count = serializers.SerializerMethodField()
    tasks_completed_count = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'role', 'avatar', 'bio',
            'skills', 'skills_list', 'experience_level',
            'github_link', 'portfolio_link', 'linkedin_link',
            'availability_hours', 'is_available_for_mentoring',
            'is_public_profile', 'is_verified_mentor', 'profile_completion',
            'projects_joined_count', 'tasks_completed_count',
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
        return obj.projects_joined.count()
    
    def get_tasks_completed_count(self, obj):
        return obj.tasks_completed
    
    def create(self, validated_data):
        skills_list = validated_data.pop('skills_list', [])
        user = User.objects.create_user(**validated_data)
        user.skills = skills_list
        user.calculate_profile_completion()
        user.save()
        return user
    
    def update(self, instance, validated_data):
        skills_list = validated_data.pop('skills_list', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if skills_list is not None:
            instance.skills = skills_list
        instance.calculate_profile_completion()
        instance.save()
        return instance


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration."""
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ['email', 'username', 'password', 'password_confirm', 'role']
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Passwords don't match"})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    """Public profile serializer."""
    projects_joined_count = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'role', 'avatar', 'bio',
            'skills', 'experience_level', 'github_link',
            'portfolio_link', 'availability_hours',
            'is_verified_mentor', 'profile_completion',
            'projects_joined_count', 'teamwork_rating',
            'reliability_rating', 'created_at'
        ]
        read_only_fields = fields
    
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
