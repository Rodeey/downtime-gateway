# Workflow & Safety Rules for Codex

## Environment
- You are operating on my **local cloned repositories**.  
- These repositories are under Git version control and may be connected to live deployments (e.g., Vercel, Zuplo).  
- You must assume that commits to the `main`, `master`, or `production` branches will automatically trigger live deployments.

## Required Workflow
1. **Branching**
   - Never push commits directly to `main`, `master`, or `production`.
   - Create new branches prefixed with `codex/`, for example:
     - `codex/frontend-update`
     - `codex/backend-contracts`
   - Each task or feature gets its own branch.

2. **Committing**
   - Use clear, human-readable commit messages (no generic “update” or “fix”).
   - Include a one-sentence summary of *why* each change was made.

3. **Pull Requests**
   - After completing work, open a Pull Request (PR) for review.
   - PR title format:  
     `Codex: <short feature summary>`  
     e.g., `Codex: Integrate Downtime frontend with Zuplo gateway`
   - Include in the PR description:
     - Purpose of the changes  
     - Summary of files affected  
     - Testing or build results  
     - Deployment checklist (if relevant)
   - Await human approval before merging or deploying.

4. **Testing & Verification**
   - Run builds and tests locally before opening a PR.
   - Report any test results or lint warnings in the PR body.
   - If errors occur, do not attempt to deploy or merge—open an issue instead.

5. **Data & Secrets**
   - Never log, print, or hardcode API keys, tokens, or credentials.
   - Always reference environment variables (e.g., `process.env.API_KEY`).
   - Do not edit `.env` files except to list variable names in `.env.example`.

6. **Merging & Deployment**
   - Only the human operator merges PRs.
   - Merging triggers CI/CD (e.g., Vercel build), which must be confirmed successful before public release.

## Output Format
At the end of each run, summarize:
- Branch name(s) created
- Commits made
- Tests or builds executed
- PR links
- Any manual follow-up required before merge

Failure to follow these rules should result in immediate task termination and an explanation of which rule was violated.
