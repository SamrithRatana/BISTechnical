---
name: run
description: Launch this project's frontend and/or backend APIs to see a change working. Use when asked to run, start, serve, or screenshot the app, or to confirm a change works in the real app rather than only in tests.
user-invocable: true
---

# run — launch the app

Two independent halves. The Next.js frontend is the current UI and is what you
almost always want; the .NET backend only needs starting when the change is
*in* the backend.

## Read this before starting the frontend

`npm run dev` with no `TestingReact/.env.local` **connects to production.**

The proxy routes fall back to hardcoded live URLs when the env vars are unset:

```ts
process.env.NEXT_PUBLIC_TECHNICAL_API_URL || "https://technicalservicesapi.camprotec.com.kh"
```

So a fresh clone appears to work perfectly — and every save, status change and
delete you click through is a real mutation against live customer data. The
file is gitignored, so a new machine has this state by default.

**Check first:**

```bash
ls TestingReact/.env.local
```

Missing, or the vars still pointing at `camprotec.com.kh`? Say so before
launching, and confirm the user actually wants to run against production. If
they want local backends, point the three vars at localhost ports (below) and
restart — `.env.local` is read at startup, not per request.

`npm run dev` also binds `-H 0.0.0.0`, so the dev server is reachable from
anything on the same network, not just localhost.

## Frontend

```bash
cd TestingReact
npm install        # only if node_modules is missing or package.json changed
npm run dev
```

Serves on **http://localhost:3000**. Start it with `run_in_background: true` —
it does not exit — and wait for the ready line before navigating.

Health check once it is up:

```bash
curl -s http://localhost:3000/api/health
```

Other scripts: `npm run build`, `npm start` (production build),
`npm run lint`, `npm run build:templates` (regenerates the report `.xlsx`
templates under `public/templates/`).

## Backend (.NET)

Only needed for changes under `src/`. Each project needs its own
`appsettings.json` — all four are gitignored; copy the `.example` beside each
and fill in real values.

```bash
dotnet restore ServiceMaintenanceApplication.sln
dotnet build ServiceMaintenanceApplication.sln
```

| Project | Path | HTTP port |
|---|---|---|
| TechnicalService.API | `src/APIs/TechnicalService.API` | **8000** |
| UserManagementAPI | `src/APIs/UserManagementAPI` | **8087** |
| EmployeeManagement.Api | `src/APIs/EmployeeManagement.Api` | **5050** |
| ServiceMaintenance (legacy Blazor UI) | `src/Apps/ServiceMaintenance` | — |

```bash
dotnet run --project src/APIs/TechnicalService.API/TechnicalService.API.csproj
```

Ports come from each project's `Properties/launchSettings.json`; the `https`
profiles differ from the `http` ones listed above. Confirm there rather than
guessing if a profile is specified.

To point the frontend at local backends, in `TestingReact/.env.local`:

```
NEXT_PUBLIC_TECHNICAL_API_URL=http://localhost:8000
NEXT_PUBLIC_JWT_API_URL=http://localhost:8087
```

The legacy Blazor app under `src/Apps/ServiceMaintenance` is the **old**
full-stack UI. Run it only when the task is explicitly about legacy behaviour
or about matching its Khmer terminology.

## After it is running

The app is behind `AuthGuard`, so a bare page load bounces to `/login`. To
drive it without credentials, use the **`verify-ui`** skill — the token needs a
valid unexpired `exp` claim, not just any string.

## Stopping

Kill the background shell you started. A stale `next dev` holding port 3000
makes the next launch silently pick 3001, and then browser checks hit the old
build.
