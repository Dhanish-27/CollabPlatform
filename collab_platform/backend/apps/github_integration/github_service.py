from github import Github
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class GitHubService:
    """Service class for GitHub API interactions.
    
    This class wraps the PyGithub library and handles all GitHub API interactions.
    The GitHub token is retrieved from Django settings, which loads it from 
    environment variables (.env file). Never hardcode the token!
    """
    
    def __init__(self):
        """Initialize GitHub service with token from settings (environment)."""
        self.token = settings.GITHUB_TOKEN
        self.org_name = settings.GITHUB_ORG_NAME
        
        if not self.token:
            raise ValueError("GITHUB_TOKEN is not configured. Please add it to your .env file.")
        
        if not self.org_name:
            raise ValueError("GITHUB_ORG_NAME is not configured. Please add it to your .env file.")
        
        self.g = Github(self.token)
        try:
            self.org = self.g.get_organization(self.org_name)
        except Exception as e:
            logger.error(f"Failed to get organization {self.org_name}: {str(e)}")
            raise ValueError(f"Could not access organization '{self.org_name}'. Please check the organization name and your token permissions.")
    
    def repository_exists(self, repo_name):
        """Check if a repository already exists in the organization.
        
        Args:
            repo_name (str): Name of the repository to check
            
        Returns:
            bool: True if exists, False otherwise
        """
        try:
            self.org.get_repo(repo_name)
            return True
        except:
            return False
    
    def create_repository(self, name, visibility, auto_init=True):
        """Create a new repository in the GitHub organization.
        
        Args:
            name (str): Name of the repository to create
            visibility (str): Either "private" or "public"
            auto_init (bool): Whether to initialize with a README
            
        Returns:
            Repository: PyGithub Repository object
            
        Raises:
            Exception: If repository already exists or creation fails
        """
        if self.repository_exists(name):
            raise Exception("Repository already exists")
        
        repo = self.org.create_repo(
            name=name,
            private=(visibility == "private"),
            auto_init=auto_init
        )
        
        return repo
    
    def add_collaborators(self, repo, members, permission="push"):
        """Add users as collaborators to a repository.
        
        Args:
            repo (Repository): PyGithub Repository object
            members (list): List of GitHub usernames to add
            permission (str): Permission level - 'pull', 'push', or 'admin'
        """
        for username in members:
            try:
                repo.add_to_collaborators(username, permission=permission)
            except Exception as e:
                logger.warning(f"Failed to add collaborator {username}: {str(e)}")
    
    def create_branch(self, repo, branch_name="dev"):
        """Create a new branch from the default branch.
        
        Args:
            repo (Repository): PyGithub Repository object
            branch_name (str): Name of the new branch (default: "dev")
            
        Returns:
            GitRef: The created branch reference
        """
        source = repo.get_branch(repo.default_branch)
        return repo.create_git_ref(
            ref=f"refs/heads/{branch_name}",
            sha=source.commit.sha
        )
    
    def delete_repository(self, repo_name):
        """Delete a repository from the organization.
        
        Args:
            repo_name (str): Name of the repository to delete
            
        Warning: This action is irreversible!
        """
        repo = self.org.get_repo(repo_name)
        repo.delete()
    
    def check_user_exists(self, username):
        """Check if a GitHub user exists.
        
        Args:
            username (str): GitHub username to check
            
        Returns:
            bool: True if user exists, False otherwise
        """
        try:
            self.g.get_user(username)
            return True
        except:
            return False
    
    def get_repository(self, repo_name):
        """Get a repository from the organization.
        
        Args:
            repo_name (str): Name of the repository
            
        Returns:
            Repository: PyGithub Repository object
        """
        return self.org.get_repo(repo_name)
    
    def list_repositories(self):
        """List all repositories in the organization.
        
        Returns:
            list: List of Repository objects
        """
        return list(self.org.get_repos())
