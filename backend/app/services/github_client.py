import logging
from typing import List, Dict, Any
import httpx
from fastapi import HTTPException, status
from backend.app.core.config import settings

logger = logging.getLogger("app.services.github_client")

class GitHubClient:
    """Service client for making outbound API requests to GitHub REST APIs."""

    @staticmethod
    def _headers(access_token: str) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "fastapi-github-bot",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    @classmethod
    async def list_user_repos(cls, access_token: str) -> List[Dict[str, Any]]:
        """Lists repositories where the user has administrative or push access."""
        url = "https://api.github.com/user/repos?per_page=100&sort=updated"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=cls._headers(access_token))
            if response.status_code != 200:
                logger.error("Failed to fetch user repositories from GitHub: %s", response.text)
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to retrieve repositories from GitHub API."
                )
            return response.json()

    @classmethod
    async def create_webhook(cls, access_token: str, owner: str, repo: str, secret: str) -> int:
        """Registers a repository webhook callback on GitHub for issues and pull requests."""
        url = f"https://api.github.com/repos/{owner}/{repo}/hooks"
        
        webhook_target = f"{settings.WEBHOOK_BASE_URL}/api/v1/webhooks/github"
        
        payload = {
            "name": "web",
            "active": True,
            "events": ["issues", "pull_request"],
            "config": {
                "url": webhook_target,
                "content_type": "json",
                "secret": secret
            }
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, headers=cls._headers(access_token), json=payload)
            if response.status_code != 201:
                logger.error("Failed to register webhook on GitHub: %s", response.text)
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"GitHub hook registration failed: {response.json().get('message', response.text)}"
                )
            
            data = response.json()
            return data["id"]

    @classmethod
    async def delete_webhook(cls, access_token: str, owner: str, repo: str, hook_id: int) -> None:
        """Removes a repository webhook from GitHub."""
        url = f"https://api.github.com/repos/{owner}/{repo}/hooks/{hook_id}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.delete(url, headers=cls._headers(access_token))
            # If the hook was already deleted manually on GitHub, it will return 404. We swallow it.
            if response.status_code not in (204, 404):
                logger.error("Failed to delete webhook from GitHub: %s", response.text)
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to remove repository webhook from GitHub API."
                )

    @classmethod
    async def add_label_to_issue(
        cls, access_token: str, owner: str, repo: str, issue_number: int, label: str
    ) -> List[Dict[str, Any]]:
        """Applies a label to a GitHub issue or pull request."""
        url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/labels"
        payload = {"labels": [label]}

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, headers=cls._headers(access_token), json=payload)
            if response.status_code != 200:
                logger.error("Failed to add label: %s", response.text)
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to add label via GitHub: {response.text}"
                )
            return response.json()

    @classmethod
    async def add_comment_to_issue(
        cls, access_token: str, owner: str, repo: str, issue_number: int, body: str
    ) -> Dict[str, Any]:
        """Creates a comment response on an issue or pull request."""
        url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments"
        payload = {"body": body}

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, headers=cls._headers(access_token), json=payload)
            if response.status_code != 201:
                logger.error("Failed to create issue comment: %s", response.text)
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to submit comment via GitHub: {response.text}"
                )
            return response.json()
