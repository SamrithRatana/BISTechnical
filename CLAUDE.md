# Project Structure

Root: C:\Users\DELL\Desktop\Cloudflare-image\Cloudflare-image\ServiceMaintenanceApplication\ServiceMaintenanceApplication

This repo has two parts:

## Backend (.NET, old full-stack)

- Path: ./src
- Layout:
  - src/APIs    - API projects
  - src/Apps    - application layer (Old UI Blazor C#)
  - src/Core    - core/domain logic
  - src/Shared  - shared utilities/libraries
- Solution file: ServiceMaintenanceApplication.sln (repo root)

## Frontend (Next.js UI)

- Path: ./TestingReact
- This is the current UI.
- Has its own CLAUDE.md and AGENTS.md at TestingReact/ - these load
  automatically when working inside that folder. Don't duplicate
  their content here.
- package.json confirmed at TestingReact/package.json

# How to Run

## Frontend (Next.js)

```
cd TestingReact
npm install
npm run dev
```
Serves at http://localhost:3000.

## Backend (.NET)

```
dotnet restore ServiceMaintenanceApplication.sln
dotnet build ServiceMaintenanceApplication.sln
```
Each project under src/APIs and src/Apps/ServiceMaintenance can also be run
individually with `dotnet run --project <path-to-csproj>`. Every API/App
needs its own `appsettings.json` populated first - see below.

# GitHub

- Remote: https://github.com/SamrithRatana/bistechnical
- Default branch: main

# Continuing Development on a New PC

Follow this once per new machine to pick up exactly where you left off,
with Claude Code working the same way it does here.

1. **Install prerequisites**
   - Git for Windows (includes Git Bash + Git Credential Manager)
   - .NET 8 SDK (for the backend under ./src)
   - Node.js (LTS) (for TestingReact)
   - Claude Code CLI, signed in to the same account

2. **Clone the repo**
   ```
   git clone https://github.com/SamrithRatana/bistechnical.git
   cd bistechnical
   ```
   Git Credential Manager will open a browser sign-in the first time it
   needs GitHub auth.

3. **Restore the secret config files** - these are intentionally
   gitignored (never pushed to GitHub) and won't exist after a fresh
   clone. Copy each `*.example` file, drop the `.example` suffix, and
   fill in the real values (ask whoever holds them, or check a
   password manager - they are never in git history):
   - `.env.example` -> `.env` (repo root: RabbitMQ, JWT, DB, Redis, SMTP)
   - `TestingReact/.env.local.example` -> `TestingReact/.env.local`
   - `src/APIs/UserManagementAPI/appsettings.json.example` -> `appsettings.json`
   - `src/APIs/TechnicalService.API/appsettings.json.example` -> `appsettings.json`
   - `src/APIs/EmployeeManagement.Api/appsettings.json.example` -> `appsettings.json`
   - `src/Apps/ServiceMaintenance/appsettings.json.example` -> `appsettings.json`

   Also not in git (regenerated automatically, no action needed unless
   something breaks): ASP.NET Data Protection keys under
   `dataprotection-keys/` folders and `src/Apps/ServiceMaintenance/keys/`.

4. **Install dependencies and run** - see "How to Run" above.

5. **Open the folder in Claude Code** - `CLAUDE.md` (this file) and the
   nested `TestingReact/CLAUDE.md` load automatically, so Claude Code
   has the same project context as on any other machine.

6. **Keep it in sync** - `git pull` before starting work, `git push`
   after committing, on every machine you use.

# Rolling Back a Bad Change

Use this whenever a new change breaks something and you want back to a
known-good state, without needing to redo work from scratch.

- **See what happened**
  ```
  git log --oneline -20      # recent history, one line per commit
  git status                 # what's currently changed/uncommitted
  git diff                   # uncommitted changes, in detail
  ```

- **Uncommitted changes went wrong (nothing committed yet)**
  ```
  git restore <file>         # discard changes to one file
  git restore .              # discard ALL uncommitted changes
  ```

- **Want to pause half-finished work instead of discarding it**
  ```
  git stash                  # shelve current changes
  git stash pop              # bring them back later
  ```

- **Already committed, but the last commit(s) are bad and NOT pushed
  yet** (check with `git log` vs `git log origin/main`)
  ```
  git reset --hard HEAD~1    # drop the last commit entirely
  git reset --soft HEAD~1    # undo the commit, keep the changes staged
  ```

- **Already pushed to GitHub, or other people/machines might have
  pulled it** - don't rewrite shared history. Add a new commit that
  undoes the bad one instead:
  ```
  git revert <bad-commit-hash>
  git push
  ```

- **Just want to look at (not switch to) an old version to compare**
  ```
  git log --oneline           # find the commit hash you want
  git show <commit-hash>:<path/to/file>   # view that file as of that commit
  ```

- **Before trying something risky** - branch first, so `main` is
  always safe to fall back to:
  ```
  git checkout -b experiment-name
  # ...make risky changes, test them...
  # if it works: git checkout main && git merge experiment-name
  # if it fails: git checkout main   (experiment-name still exists, untouched)
  ```

General rule: never `git push --force` to `main` unless you're certain
no one else (including you, on another PC) has pulled the commits
you're rewriting.
