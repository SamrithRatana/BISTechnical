# Project Structure

Root: C:\Users\DELL\Desktop\Cloudflare-image\Cloudflare-image\ServiceMaintenanceApplication\ServiceMaintenanceApplication

This repo has two parts:

## Backend (.NET, old full-stack)

- Path: ./src
- Layout:
  - src/APIs    — API projects
  - src/Apps    — application layer (Old UI Blazor C#)
  - src/Core    — core/domain logic
  - src/Shared  — shared utilities/libraries
- Solution file: find *.sln inside ./src (confirm exact filename once, then hardcode it here)

## Frontend (Next.js UI)

- Path: ./TestingReact
- This is the current UI.
- Has its own CLAUDE.md and AGENTS.md at TestingReact/ — these load
  automatically when working inside that folder. Don't duplicate
  their content here.
- package.json confirmed at TestingReact/package.json

# How to Run

## Frontend (Next.js)