# GitHub Integration Documentation

This document provides a comprehensive guide to understanding and implementing the GitHub integration in integration this project. The uses the GitHub API via the PyGithub library to programmatically create and manage repositories within a GitHub Organization.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Configuration](#configuration)
5. [Models](#models)
6. [GitHub Service](#github-service)
7. [API Endpoints](#api-endpoints)
8. [Serializers](#serializers)
9. [Workflow Flow](#workflow-flow)
10. [Implementation Guide](#implementation-guide)
11. [Error Handling](#error-handling)
12. [Security Considerations](#security-considerations)

---

## Overview

This GitHub integration allows authenticated users to:
- Create new GitHub repositories within an organization
- Set repository visibility (public/private)
- Add collaborators to repositories
- Create additional branches (e.g., "dev" branch)
- Delete repositories
- List available groups/repositories
- Join existing groups/repositories

The integration is designed to work with a GitHub Organization, not individual user accounts.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  (React/Vue/Any)                                            │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP Requests (JWT Auth)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Django Backend                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              github_functions App                    │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │    │
│  │  │    Views     │──│  Serializers │  │   Models   │  │    │
│  │  └──────────────┘  └──────────────┘  └────────────┘  │    │
│  │         │                                        │    │    │
│  │         ▼                                        │    │    │
│  │  ┌──────────────────────────────────────────┐     │    │    │
│  │  │          GitHubService                   │     │    │    │
│  │  │  (PyGithub Wrapper)                       │     │    │    │
│  │  └──────────────────────────────────────────┘     │    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────┬───────────────────────────────────────┘
                      │ GitHub API (REST)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  GitHub Organization                         │
│  - Create Repositories                                       │
│  - Manage Collaborators                                      │
│  - Manage Branches                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Required Packages

Install the following dependencies:

```bash
pip install django>=5.0
pip install djangorestframework
pip install djangorestframework-simplejwt
pip install django-cors-headers
pip install daphne
pip install channels
pip install python-decouple
pip install PyGithub
```

### GitHub Requirements

1. **GitHub Organization**: You must have a GitHub Organization created
2. **Personal Access Token (PAT)**: Create a Classic Personal Access Token with the following scopes:
   - `repo` (Full control of private repositories)
   - `read:org` (Read org and team membership)
   - `write:org` (Update org and team membership)
   - `delete_repo` (Delete repositories)

3. **Token Permissions**: The token must have admin access to the organization

---

## Configuration

### Environment Variables

Create a `.env` file in your Django project root:

```env
# Django settings
SECRET_KEY=your-secret-key-here
DEBUG=True

# GitHub Configuration (REQUIRED)
GITHUB_TOKEN=ghp_your-personal-access-token-here
GITHUB_ORG_NAME=YourOrganizationName
```

### Django Settings

Add the following to your `settings.py`:

```python
from decouple import config

# GitHub Configuration
GITHUB_TOKEN = config("GITHUB_TOKEN", default="")
GITHUB_ORG_NAME = config("GITHUB_ORG_NAME", default="")
```

### URL Configuration

Include the GitHub functions URL in your main `urls.py`:

```python
from django.urls import path, include

urlpatterns = [
    # ... other URLs
    path("api/github/", include("github_functions.urls")),
]
```

---

## Models

### Group Model

The `Group` model represents a GitHub repository linked with local database records.

**File**: [`projectunity/github_functions/models.py`](projectunity/github_functions/models.py:8)

```python
class Group(models.Model):
    name = models.CharField(max_length=255)
    repo_name = models.CharField(max_length=255, unique=True)
    github_repo_id = models.BigIntegerField()
    visibility = models.CharField(
        max_length=20,
        choices=[("private", "Private"), ("public", "Public")]
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_groups"
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="joined_groups",
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
```

### Model Fields Explanation

| Field | Type | Description |
|-------|------|-------------|
| `name` | CharField(255) | Display name of the group |
| `repo_name` | CharField(255) | GitHub repository name (must be unique) |
| `github_repo_id` | BigIntegerField | GitHub's internal repository ID |
| `visibility` | CharField(20) | Either "private" or "public" |
| `created_by` | ForeignKey | User who created the group |
| `members` | ManyToManyField | Users who are members of the group |
| `created_at` | DateTimeField | Timestamp of creation |

---

## GitHub Service

The `GitHubService` class is a wrapper around the PyGithub library that handles all GitHub API interactions.

**File**: [`projectunity/github_functions/github_service.py`](projectunity/github_functions/github_service.py:5)

### Class Definition

```python
class GitHubService:
    def __init__(self):
        self.g = Github(settings.GITHUB_TOKEN)
        self.org = self.g.get_organization(settings.GITHUB_ORG_NAME)
```

### Available Methods

#### 1. `repository_exists(repo_name)`

Checks if a repository already exists in the organization.

```python
def repository_exists(self, repo_name):
    try:
        self.org.get_repo(repo_name)
        return True
    except:
        return False
```

**Parameters:**
- `repo_name` (str): Name of the repository to check

**Returns:** `bool` - True if exists, False otherwise

---

#### 2. `create_repository(name, visibility)`

Creates a new repository in the GitHub organization.

```python
def create_repository(self, name, visibility):
    if self.repository_exists(name):
        raise Exception("Repository already exists")

    repo = self.org.create_repo(
        name=name,
        private=(visibility == "private"),
        auto_init=True  # Creates initial commit with README
    )

    return repo
```

**Parameters:**
- `name` (str): Name of the repository to create
- `visibility` (str): Either "private" or "public"

**Returns:** `Repository` object

**Features:**
- Automatically initializes with a README
- Sets visibility based on parameter
- Raises exception if repository already exists

---

#### 3. `add_collaborators(repo, members)`

Adds users as collaborators to a repository.

```python
def add_collaborators(self, repo, members):
    for username in members:
        repo.add_to_collaborators(username, permission="push")
```

**Parameters:**
- `repo` (Repository): PyGithub Repository object
- `members` (list): List of GitHub usernames to add

**Permission Levels:**
- `pull` - Read-only access
- `push` - Read and write access
- `admin` - Full administrative access

---

#### 4. `create_branch(repo, branch_name)`

Creates a new branch from the default branch.

```python
def create_branch(self, repo, branch_name="dev"):
    source = repo.get_branch(repo.default_branch)
    repo.create_git_ref(
        ref=f"refs/heads/{branch_name}",
        sha=source.commit.sha
    )
```

**Parameters:**
- `repo` (Repository): PyGithub Repository object
- `branch_name` (str): Name of the new branch (default: "dev")

**Process:**
1. Gets the default branch (usually "main")
2. Gets the latest commit SHA
3. Creates a new branch reference

---

#### 5. `delete_repository(repo_name)`

Deletes a repository from the organization.

```python
def delete_repository(self, repo_name):
    repo = self.org.get_repo(repo_name)
    repo.delete()
```

**Parameters:**
- `repo_name` (str): Name of the repository to delete

**Warning:** This action is irreversible!

---

#### 6. `check_user_exists(username)`

Checks if a GitHub user exists.

```python
def check_user_exists(self, username):
    try:
        self.g.get_user(username)
        return True
    except:
        return False
```

**Parameters:**
- `username` (str): GitHub username to check

**Returns:** `bool` - True if user exists, False otherwise

---

## API Endpoints

All endpoints require JWT authentication (except token endpoints).

**Base URL**: `/api/github/`

### 1. Create Group/Repository

**Endpoint**: `POST /api/github/create-group/`

**Description**: Creates a new GitHub repository and corresponding group in the database.

**Request Headers:**
```
Authorization: Bearer <jwt-access-token>
Content-Type: application/json
```

**Request Body:**
```json
{
    "group_name": "My Project Team",
    "repo_name": "my-project-team",
    "visibility": "private",
    "members": ["github-user1", "github-user2"]
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `group_name` | string | Yes | Display name for the group |
| `repo_name` | string | Yes | GitHub repository name (alphanumeric + hyphens) |
| `visibility` | string | Yes | Either "private" or "public" |
| `members` | array | No | List of GitHub usernames to add as collaborators |

**Success Response (201 Created):**
```json
{
    "id": 1,
    "name": "My Project Team",
    "repo_name": "my-project-team",
    "github_repo_id": 123456789,
    "visibility": "private",
    "created_by": 1,
    "members": [1, 2, 3],
    "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Response (400 Bad Request):**
```json
{
    "error": "Repository already exists"
}
```

---

### 2. Delete Group/Repository

**Endpoint**: `DELETE /api/github/delete-group/<repo_name>/`

**Description**: Deletes a GitHub repository and its corresponding database record.

**URL Parameters:**
- `repo_name` (str): Name of the repository to delete

**Request Headers:**
```
Authorization: Bearer <jwt-access-token>
```

**Success Response (200 OK):**
```json
{
    "message": "Deleted successfully"
}
```

**Error Response (400 Bad Request):**
```json
{
    "error": "Error message here"
}
```

---

### 3. List User's Groups

**Endpoint**: `GET /api/github/list-groups/`

**Description**: Returns all groups/repositories the authenticated user is a member of.

**Request Headers:**
```
Authorization: Bearer <jwt-access-token>
```

**Success Response (200 OK):**
```json
[
    {
        "id": 1,
        "name": "My Project Team",
        "repo_name": "my-project-team",
        "github_repo_id": 123456789,
        "visibility": "private",
        "created_by": 1,
        "members": [1, 2],
        "created_at": "2024-01-15T10:30:00Z"
    }
]
```

---

### 4. List All Groups

**Endpoint**: `GET /api/github/list-all-groups/`

**Description**: Returns all public groups and private groups the user is a member of.

**Request Headers:**
```
Authorization: Bearer <jwt-access-token>
```

**Success Response (200 OK):**
```json
[
    {
        "id": 1,
        "name": "Public Project",
        "repo_name": "public-project",
        "github_repo_id": 123456789,
        "visibility": "public",
        "created_by": 2,
        "members": [2, 3],
        "created_at": "2024-01-10T10:30:00Z"
    }
]
```

---

### 5. Join Group

**Endpoint**: `POST /api/github/join-group/<group_id>/`

**Description**: Adds the authenticated user as a member to an existing group.

**URL Parameters:**
- `group_id` (int): ID of the group to join

**Request Headers:**
```
Authorization: Bearer <jwt-access-token>
```

**Success Response (200 OK):**
```json
{
    "id": 1,
    "name": "My Project Team",
    "repo_name": "my-project-team",
    "github_repo_id": 123456789,
    "visibility": "private",
    "created_by": 1,
    "members": [1, 2, 3],
    "created_at": "2024-01-15T10:30:00Z"
}
```

---

## Serializers

### GroupCreateSerializer

**File**: [`projectunity/github_functions/serializers.py`](projectunity/github_functions/serializers.py:5)

```python
class GroupCreateSerializer(serializers.Serializer):
    group_name = serializers.CharField()
    repo_name = serializers.CharField()
    visibility = serializers.ChoiceField(choices=["private", "public"])
    members = serializers.ListField(
        child=serializers.CharField(),
        allow_empty=True
    )
```

**Validation:**
- `group_name`: Required, non-empty string
- `repo_name`: Required, non-empty string (recommend validation for GitHub naming conventions)
- `visibility`: Must be either "private" or "public"
- `members`: Optional list of strings (GitHub usernames)

### GroupSerializer

```python
class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = "__all__"
```

Serializes all fields from the Group model.

---

## Workflow Flow

### Creating a New Group

```
1. User sends POST request to /api/github/create-group/
   │
   ▼
2. JWT Authentication validates the token
   │
   ▼
3. GroupCreateSerializer validates request data
   │
   ▼
4. GitHubService.create_repository() is called
   │  - Checks if repo exists
   │  - Creates repository in GitHub Org
   │  - Sets visibility (private/public)
   │  - Initializes with README
   │
   ▼
5. GitHubService.add_collaborators() is called
   │  - Adds specified members to repo
   │  - Sets permission to "push"
   │
   ▼
6. GitHubService.create_branch() is called
   │  - Creates "dev" branch from default branch
   │
   ▼
7. Group object created in database
   │  - Links to GitHub repo via repo_name and github_repo_id
   │  - Sets creator as member
   │
   ▼
8. Returns GroupSerializer data with 201 status
```

### Joining a Group

```
1. User sends POST request to /api/github/join-group/<group_id>/
   │
   ▼
2. JWT Authentication validates the token
   │
   ▼
3. Group is fetched from database
   │
   ▼
4. Check if user is already a member
   │
   ▼
5. GitHubService adds user as collaborator
   │
   ▼
6. User added to Group.members (local database)
   │
   ▼
7. Returns updated GroupSerializer data
```

---

## Implementation Guide

### Step 1: Create Django App

```bash
cd your_project
python manage.py startapp github_functions
```

### Step 2: Update Settings

Add to `INSTALLED_APPS`:

```python
INSTALLED_APPS = [
    # ... existing apps
    'github_functions',
]
```

Add GitHub configuration:

```python
GITHUB_TOKEN = config("GITHUB_TOKEN", default="")
GITHUB_ORG_NAME = config("GITHUB_ORG_NAME", default="")
```

### Step 3: Create Models

Create [`models.py`](projectunity/github_functions/models.py:8):

```python
from django.db import models
from django.conf import settings

class Group(models.Model):
    name = models.CharField(max_length=255)
    repo_name = models.CharField(max_length=255, unique=True)
    github_repo_id = models.BigIntegerField()
    visibility = models.CharField(
        max_length=20,
        choices=[("private", "Private"), ("public", "Public")]
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_groups"
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="joined_groups",
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
```

Run migrations:
```bash
python manage.py makemigrations github_functions
python manage.py migrate
```

### Step 4: Create GitHub Service

Create [`github_service.py`](projectunity/github_functions/github_service.py:5):

```python
from github import Github
from django.conf import settings

class GitHubService:
    def __init__(self):
        self.g = Github(settings.GITHUB_TOKEN)
        self.org = self.g.get_organization(settings.GITHUB_ORG_NAME)

    def repository_exists(self, repo_name):
        try:
            self.org.get_repo(repo_name)
            return True
        except:
            return False

    def create_repository(self, name, visibility):
        if self.repository_exists(name):
            raise Exception("Repository already exists")

        repo = self.org.create_repo(
            name=name,
            private=(visibility == "private"),
            auto_init=True
        )
        return repo

    def add_collaborators(self, repo, members):
        for username in members:
            repo.add_to_collaborators(username, permission="push")

    def create_branch(self, repo, branch_name="dev"):
        source = repo.get_branch(repo.default_branch)
        repo.create_git_ref(
            ref=f"refs/heads/{branch_name}",
            sha=source.commit.sha
        )

    def delete_repository(self, repo_name):
        repo = self.org.get_repo(repo_name)
        repo.delete()

    def check_user_exists(self, username):
        try:
            self.g.get_user(username)
            return True
        except:
            return False
```

### Step 5: Create Serializers

Create [`serializers.py`](projectunity/github_functions/serializers.py:1):

```python
from rest_framework import serializers
from .models import Group

class GroupCreateSerializer(serializers.Serializer):
    group_name = serializers.CharField()
    repo_name = serializers.CharField()
    visibility = serializers.ChoiceField(choices=["private", "public"])
    members = serializers.ListField(
        child=serializers.CharField(),
        allow_empty=True
    )

class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = "__all__"
```

### Step 6: Create Views

Create [`views.py`](projectunity/github_functions/views.py:1):

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from .models import Group
from .serializers import GroupCreateSerializer, GroupSerializer
from .github_service import GitHubService


class CreateGroupView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = GroupCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        github = GitHubService()

        try:
            repo = github.create_repository(
                name=data["repo_name"],
                visibility=data["visibility"],
            )

            github.add_collaborators(repo, data["members"])
            github.create_branch(repo, "dev")

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        group = Group.objects.create(
            name=data["group_name"],
            repo_name=data["repo_name"],
            github_repo_id=repo.id,
            visibility=data["visibility"],
            created_by=request.user,
        )
        group.members.add(request.user)

        return Response(
            GroupSerializer(group).data,
            status=status.HTTP_201_CREATED
        )


class DeleteGroupView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, repo_name):
        github = GitHubService()

        try:
            github.delete_repository(repo_name)
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        Group.objects.filter(repo_name=repo_name).delete()

        return Response({"message": "Deleted successfully"})


class ListGroupsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        groups = Group.objects.filter(members=request.user).order_by('-created_at')
        serializer = GroupSerializer(groups, many=True)
        return Response(serializer.data)


class ListAllGroupsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Q
        groups = Group.objects.filter(
            Q(visibility='public') | Q(members=request.user)
        ).distinct().order_by('-created_at')
        serializer = GroupSerializer(groups, many=True)
        return Response(serializer.data)


class JoinGroupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        try:
            group = Group.objects.get(id=group_id)
        except Group.DoesNotExist:
            return Response({"error": "Group not found"}, status=status.HTTP_404_NOT_FOUND)
        
        if request.user in group.members.all():
            return Response({"message": "Already a member"}, status=status.HTTP_200_OK)

        # Add to GitHub repo
        github = GitHubService()
        try:
            repo = github.org.get_repo(group.repo_name)
            github.add_collaborators(repo, [request.user.username])
        except Exception as e:
            print(f"Failed to add {request.user.username} to GitHub repo: {str(e)}")
            
        group.members.add(request.user)
        return Response(GroupSerializer(group).data, status=status.HTTP_200_OK)
```

### Step 7: Create URLs

Create [`urls.py`](projectunity/github_functions/urls.py:1):

```python
from django.urls import path
from .views import CreateGroupView, DeleteGroupView, ListGroupsView, ListAllGroupsView, JoinGroupView

urlpatterns = [
    path("create-group/", CreateGroupView.as_view()),
    path("delete-group/<str:repo_name>/", DeleteGroupView.as_view()),
    path("list-groups/", ListGroupsView.as_view()),
    path("list-all-groups/", ListAllGroupsView.as_view()),
    path("join-group/<int:group_id>/", JoinGroupView.as_view()),
]
```

### Step 8: Register URLs

In your main `urls.py`:

```python
from django.urls import path, include

urlpatterns = [
    # ... other URLs
    path("api/github/", include("github_functions.urls")),
]
```

---

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Repository already exists` | Repo name is taken | Choose a unique repository name |
| `Not Found` after creation | GitHub API delay | Add retry logic or wait for propagation |
| `Bad credentials` | Invalid/expired token | Regenerate GitHub Personal Access Token |
| `Not Found` (404) | Organization doesn't exist | Verify `GITHUB_ORG_NAME` is correct |
| `Permission denied` | Token lacks required scopes | Add required scopes to PAT |
| `User not found` | Invalid GitHub username | Verify username exists on GitHub |

### Adding Better Error Handling

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class CreateGroupView(APIView):
    def post(self, request):
        github = GitHubService()
        
        try:
            # Validate repo name format
            import re
            repo_name = request.data.get('repo_name', '')
            if not re.match(r'^[a-zA-Z0-9-_]+$', repo_name):
                return Response(
                    {"error": "Invalid repository name. Use only letters, numbers, hyphens, and underscores."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create repository
            repo = github.create_repository(
                name=repo_name,
                visibility=request.data.get('visibility', 'private'),
            )
            
            # ... rest of logic
            
        except Exception as e:
            error_message = str(e)
            
            if "Repository already exists" in error_message:
                return Response(
                    {"error": "A repository with this name already exists in the organization."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            elif "Not Found" in error_message:
                return Response(
                    {"error": "Organization not found. Check your configuration."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            else:
                return Response(
                    {"error": f"GitHub API error: {error_message}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
```

---

## Security Considerations

### 1. Token Security

- **Never commit tokens to version control**
- Use environment variables (already configured with `python-decouple`)
- Rotate tokens periodically
- Use minimal required scopes

### 2. Access Control

```python
from rest_framework.permissions import IsAuthenticated

class CreateGroupView(APIView):
    permission_classes = [IsAuthenticated]  # Ensures only logged-in users can access
```

### 3. Input Validation

```python
from rest_framework import serializers

class GroupCreateSerializer(serializers.Serializer):
    group_name = serializers.CharField(max_length=255, min_length=1)
    repo_name = serializers.CharField(max_length=100)
    visibility = serializers.ChoiceField(choices=["private", "public"])
    members = serializers.ListField(
        child=serializers.CharField(max_length=39),  # GitHub username max length
        allow_empty=True,
        max_length=10  # Limit number of members
    )
```

### 4. Rate Limiting

GitHub API has rate limits. For production, implement caching:

```python
from django.core.cache import cache

class GitHubService:
    def get_org_repos(self):
        cache_key = f"github_org_repos_{self.org.login}"
        repos = cache.get(cache_key)
        
        if repos is None:
            repos = list(self.org.get_repos())
            cache.set(cache_key, repos, timeout=300)  # Cache for 5 minutes
        
        return repos
```

### 5. Audit Logging

```python
import logging

logger = logging.getLogger(__name__)

class CreateGroupView(APIView):
    def post(self, request):
        # ... create logic
        logger.info(f"User {request.user.username} created group {data['group_name']}")
```

---

## Testing

### Unit Tests for GitHub Service

```python
from unittest.mock import Mock, patch
from django.test import TestCase
from github_functions.github_service import GitHubService

class GitHubServiceTest(TestCase):
    
    @patch('github_functions.github_service.Github')
    def test_create_repository(self, mock_github):
        # Setup mock
        mock_org = Mock()
        mock_repo = Mock()
        mock_repo.id = 12345
        mock_org.create_repo.return_value = mock_repo
        mock_github.return_value.get_organization.return_value = mock_org
        
        # Test
        service = GitHubService()
        repo = service.create_repository("test-repo", "private")
        
        # Assertions
        mock_org.create_repo.assert_called_once_with(
            name="test-repo",
            private=True,
            auto_init=True
        )
        self.assertEqual(repo.id, 12345)
    
    @patch('github_functions.github_service.Github')
    def test_repository_exists(self, mock_github):
        mock_org = Mock()
        mock_org.get_repo.return_value = Mock()
        mock_github.return_value.get_organization.return_value = mock_org
        
        service = GitHubService()
        result = service.repository_exists("existing-repo")
        
        self.assertTrue(result)
```

### API Tests

```python
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse

class GroupAPITestCase(APITestCase):
    
    def setUp(self):
        # Create test user and get token
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        response = self.client.post('/api/tokens/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        self.token = response.data['access']
    
    def test_create_group_authenticated(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')
        response = self.client.post('/api/github/create-group/', {
            'group_name': 'Test Group',
            'repo_name': 'test-group',
            'visibility': 'private',
            'members': []
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_create_group_unauthenticated(self):
        response = self.client.post('/api/github/create-group/', {})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
```

---

## Production Checklist

Before deploying to production:

- [ ] Use strong, unique `SECRET_KEY`
- [ ] Set `DEBUG=False`
- [ ] Configure `ALLOWED_HOSTS`
- [ ] Use HTTPS
- [ ] Set up proper CORS settings
- [ ] Use database (not SQLite) for production
- [ ] Configure proper logging
- [ ] Set up monitoring and alerting
- [ ] Implement rate limiting
- [ ] Use environment-specific tokens
- [ ] Set up proper error pages
- [ ] Configure CI/CD for automated testing

---

## Additional Resources

- [PyGithub Documentation](https://pygithub.readthedocs.io/)
- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [GitHub Organization API](https://docs.github.com/en/rest/orgs)
- [GitHub Repository API](https://docs.github.com/en/rest/repos)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [Python Decouple](https://pypi.org/project/python-decouple/)

---

## Troubleshooting

### Issue: "Bad credentials" Error

**Solution**: 
1. Check that `GITHUB_TOKEN` is set correctly in `.env`
2. Verify the token hasn't expired
3. Ensure the token has required scopes

### Issue: "Organization not found"

**Solution**:
1. Verify `GITHUB_ORG_NAME` matches your organization exactly
2. Ensure you're a member of the organization
3. Check that the token has `read:org` scope

### Issue: Members Not Added to GitHub

**Solution**:
1. Verify the GitHub usernames are correct
2. Ensure users have GitHub accounts
3. Check that your token has `repo` scope

### Issue: Repository Not Visible

**Solution**:
1. GitHub API propagation can take time (usually seconds)
2. Check repository visibility setting
3. Verify organization settings allow repository creation

---

## Conclusion

This GitHub integration provides a complete solution for managing GitHub repositories within a Django application. It handles repository creation, collaborator management, branch creation, and deletion while maintaining local database records for easy querying.

To implement this in your own project:
1. Ensure you have a GitHub Organization
2. Create a Personal Access Token with required scopes
3. Follow the Implementation Guide above
4. Customize error handling and validation as needed

For any issues or questions, refer to the error handling section or check the GitHub API documentation.
