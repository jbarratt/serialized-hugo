#!/usr/bin/env bash

set -e

# Make a new branch pointing at the same ref as master
git branch -m master main

# Push that new name
git push -u origin main

# Find the github name of the current repository
REPO=$(gh repo view | head -1 | sed 's/name:[[:blank:]]*//g')
# Use the github API to change the repo's default branch 
gh api -XPATCH "repos/${REPO}" -f default_branch="main"
