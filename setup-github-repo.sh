#!/bin/bash

# Script to create GitHub repository and push code
# Usage: ./setup-github-repo.sh <repo-name>

REPO_NAME="${1:-gold-price-tracker-website}"

echo "🚀 Setting up GitHub repository: $REPO_NAME"
echo ""

# Check if GitHub CLI is installed
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI found"
    echo ""
    
    # Check if user is authenticated
    if gh auth status &> /dev/null; then
        echo "✅ GitHub CLI authenticated"
        echo ""
        
        # Create repository
        echo "📦 Creating GitHub repository..."
        gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ Repository created and code pushed successfully!"
            echo "🔗 Repository URL: https://github.com/$(gh api user --jq .login)/$REPO_NAME"
        else
            echo "❌ Failed to create repository"
            exit 1
        fi
    else
        echo "⚠️  GitHub CLI not authenticated"
        echo "Please run: gh auth login"
        exit 1
    fi
else
    echo "⚠️  GitHub CLI not installed"
    echo ""
    echo "Option 1: Install GitHub CLI"
    echo "  brew install gh"
    echo "  gh auth login"
    echo "  Then run this script again"
    echo ""
    echo "Option 2: Create repository manually"
    echo "  1. Go to https://github.com/new"
    echo "  2. Repository name: $REPO_NAME"
    echo "  3. Choose Public or Private"
    echo "  4. DO NOT initialize with README, .gitignore, or license"
    echo "  5. Click 'Create repository'"
    echo "  6. Then run these commands:"
    echo ""
    echo "     git remote add origin https://github.com/YOUR_USERNAME/$REPO_NAME.git"
    echo "     git push -u origin main"
    echo ""
    exit 1
fi

