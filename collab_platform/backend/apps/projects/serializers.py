from rest_framework import serializers
from django.utils.text import slugify
from .models import (
    Project, ProjectMember, JoinRequest,
    ProjectInvitation, ProjectBookmark
)
from apps.users.serializers import UserSerializer, UserProfileSerializer


class ProjectMemberSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = ProjectMember
        fields = [
            'id', 'user', 'user_id', 'role', 'joined_at',
            'status', 'tasks_completed', 'commits_count', 'last_active'
        ]
        read_only_fields = ['id', 'joined_at', 'last_active']


class JoinRequestSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    project_title = serializers.CharField(source='project.title', read_only=True)
    
    class Meta:
        model = JoinRequest
        fields = [
            'id', 'user', 'project', 'project_title', 'role_preference',
            'message', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProjectListSerializer(serializers.ModelSerializer):
    """Serializer for project list view."""
    owner = UserProfileSerializer(read_only=True)
    member_count = serializers.IntegerField(read_only=True)
    completion_percentage = serializers.IntegerField(read_only=True)
    is_bookmarked = serializers.SerializerMethodField()
    
    class Meta:
        model = Project
        fields = [
            'id', 'title', 'slug', 'description', 'problem_statement',
            'category', 'difficulty', 'max_team_size', 'required_roles',
            'tech_stack', 'estimated_duration', 'visibility', 'status',
            'is_beginner_friendly', 'is_featured', 'owner', 'member_count',
            'completion_percentage', 'created_at', 'last_activity',
            'health_status', 'is_bookmarked'
        ]
    
    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return ProjectBookmark.objects.filter(
                project=obj,
                user=request.user
            ).exists()
        return False


class ProjectDetailSerializer(serializers.ModelSerializer):
    """Serializer for project detail view."""
    owner = UserProfileSerializer(read_only=True)
    members = ProjectMemberSerializer(many=True, read_only=True)
    member_count = serializers.IntegerField(read_only=True)
    completion_percentage = serializers.IntegerField(read_only=True)
    is_member = serializers.SerializerMethodField()
    is_bookmarked = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()
    
    class Meta:
        model = Project
        fields = [
            'id', 'title', 'slug', 'description', 'problem_statement',
            'category', 'difficulty', 'max_team_size', 'required_roles',
            'tech_stack', 'estimated_duration', 'start_date', 'end_date',
            'visibility', 'status', 'is_beginner_friendly', 'is_featured',
            'owner', 'members', 'member_count', 'completion_percentage',
            'created_at', 'updated_at', 'last_activity', 'health_status',
            'is_member', 'is_bookmarked', 'user_role'
        ]
    
    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.members.filter(id=request.user.id).exists()
        return False
    
    def get_is_bookmarked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return ProjectBookmark.objects.filter(
                project=obj,
                user=request.user
            ).exists()
        return False
    
    def get_user_role(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            membership = ProjectMember.objects.filter(
                project=obj,
                user=request.user
            ).first()
            if membership:
                return membership.role
        return None


class ProjectCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating projects."""
    
    class Meta:
        model = Project
        fields = [
            'title', 'description', 'problem_statement', 'category',
            'difficulty', 'max_team_size', 'required_roles', 'tech_stack',
            'estimated_duration', 'start_date', 'end_date', 'visibility',
            'is_beginner_friendly'
        ]
    
    def create(self, validated_data):
        # Generate slug
        slug = slugify(validated_data['title'])
        base_slug = slug
        counter = 1
        while Project.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        
        validated_data['slug'] = slug
        validated_data['owner'] = self.context['request'].user
        
        project = Project.objects.create(**validated_data)
        
        # Add owner as member
        ProjectMember.objects.create(
            project=project,
            user=self.context['request'].user,
            role=ProjectMember.Role.OWNER
        )
        
        return project


class ProjectUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating projects."""
    
    class Meta:
        model = Project
        fields = [
            'title', 'description', 'problem_statement', 'category',
            'difficulty', 'max_team_size', 'required_roles', 'tech_stack',
            'estimated_duration', 'start_date', 'end_date', 'visibility',
            'status', 'is_beginner_friendly', 'is_featured'
        ]


class ProjectInvitationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectInvitation
        fields = ['id', 'project', 'email', 'role', 'invited_by', 'token', 'is_used', 'created_at', 'expires_at']
        read_only_fields = ['id', 'invited_by', 'token', 'is_used', 'created_at', 'expires_at']


class ProjectBookmarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectBookmark
        fields = ['id', 'project', 'user', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']
