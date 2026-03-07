from rest_framework import serializers
from .models import ChatMessage, Thread, ThreadReply, Announcement
from apps.users.serializers import UserProfileSerializer


class ChatMessageSerializer(serializers.ModelSerializer):
    author = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = ChatMessage
        fields = [
            'id', 'project', 'author', 'content', 'mentions',
            'attachments', 'is_pinned', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ThreadReplySerializer(serializers.ModelSerializer):
    author = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = ThreadReply
        fields = [
            'id', 'thread', 'author', 'content', 'mentions',
            'parent_reply', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ThreadSerializer(serializers.ModelSerializer):
    author = UserProfileSerializer(read_only=True)
    replies_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Thread
        fields = [
            'id', 'project', 'title', 'author', 'is_pinned',
            'is_locked', 'replies_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_replies_count(self, obj):
        return obj.replies.count()


class ThreadDetailSerializer(serializers.ModelSerializer):
    author = UserProfileSerializer(read_only=True)
    replies = ThreadReplySerializer(many=True, read_only=True)
    
    class Meta:
        model = Thread
        fields = [
            'id', 'project', 'title', 'author', 'is_pinned',
            'is_locked', 'replies', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AnnouncementSerializer(serializers.ModelSerializer):
    author = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = Announcement
        fields = [
            'id', 'project', 'author', 'title', 'content',
            'is_pinned', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']
