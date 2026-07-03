# Plan: Execute Phase 03 — Upload e Processamento de Vídeos (`docs/exercise.md`)

## Progress Tracker

> Update this section as work happens — it is the persisted source of truth for what's done across sessions. Check an item only once its own verification (see "Verification" section below) has actually passed, not just "attempted."

_Last updated: 2026-07-03 — plan created, no execution started yet._

- [ ] **Step 0 — Setup**
  - [ ] context7 registered in `.mcp.json` and verified via `claude mcp list`
  - [ ] Branch `feature/phase-03-videos` cut from `dev`
  - [ ] Docker stack up (`nestjs-api`, `db`, `mailpit`), deps installed in-container, migrations run
  - [ ] Baseline suite green: `npm test`, `npm run test:e2e`, `npx tsc --noEmit`, `npm run lint`
- [ ] **Step 1 — Research**
  - [ ] `/research` run → `docs/decisions/technical-decisions-phase-03-videos.md` created
  - [ ] All TDs have a filled `**Decision:**` (queue tech, upload strategy, worker model, unique-URL/streaming, status lifecycle) — none left `_[pending]_`
- [ ] **Step 2 — Planning pipeline**
  - [ ] `/plan-context 03` → `context.md`
  - [ ] `/plan-validate 03` → `validation.md`
  - [ ] `/plan-resolve 03` ↔ `/plan-validate 03` loop → `status: clean`
  - [ ] `/plan-build 03` Phase A (Technical Specifications) reviewed
  - [ ] `/plan-build 03` Phase B (SIs + Dependency Map + Deliverables) → `phase-03-videos.md` complete
  - [ ] `/plan-test-specs 03` run, or explicitly skipped with reason noted here
- [ ] **Step 3 — Implementation**
  - [ ] SI list populated below once `phase-03-videos.md` exists (placeholder — replace with actual SI-03.x titles from the plan)
    - [ ] SI-03.1 — _TBD_
    - [ ] SI-03.2 — _TBD_
    - [ ] SI-03.n — _TBD_
  - [ ] `docs/phases/phase-03-videos/progress.md` kept current after each SI
- [ ] **Step 4 — Closure**
  - [ ] `nestjs-project/CLAUDE.md` updated with Videos section
  - [ ] Root `CLAUDE.md` updated (queue/storage/worker no longer "TBD")
  - [ ] Full Definition of Done green (whole suite + tsc + lint)
  - [ ] Every `docs/exercise.md` acceptance-criteria checkbox walked and confirmed
  - [ ] Committed on `feature/phase-03-videos`; PR to `dev` opened only after explicit go-ahead

---

## Context

This repo is a fork of `mba-ia-greenfield-project`, an MBA exercise where an AI agent (Claude Code) drives a documented pipeline of skills to plan and implement each phase of a video-sharing platform ("StreamTube"). Phases 01 (base config) and 02 (auth/users/channels) are already delivered. `docs/exercise.md` assigns Phase 03 — Upload e Processamento de Vídeos: object storage, a background processing queue, a video worker (FFmpeg), 10GB-capable uploads without blocking the API, automatic thumbnail/metadata extraction, unique URLs, streaming (range requests), and download — plus the full `docs/decisions/` → `docs/phases/phase-03-videos/` artifact trail the exercise's grading rubric explicitly checks for.

The repo already ships the exact tooling this workflow expects (found during exploration):
- Skills in `.claude/skills/`: `/research`, `/plan-context`, `/plan-validate`, `/plan-resolve`, `/plan-build`, `/plan-test-specs`, `/implement`, plus reference skill `plan-pipeline` (shared conventions) and `decide`.
- Read-only subagents in `.claude/agents/` (`plan-reader`, `decisions-reader`, `decisions-detail-reader`, `decisions-correlator`, `phases-reader`, `inventory-digest-reader`) — invoked automatically by the skills above; never called directly.
- Convention rules in `.claude/rules/` (`nestjs-entities.md`, `nestjs-controllers.md`, `nestjs-services.md`, `nestjs-modules.md`, `nestjs-dtos.md`, `nestjs-testing.md`, `typeorm-migrations.md`, `typeorm-queries.md`, `typescript-strict.md`, `auth-jwt.md`) — auto-loaded during implementation.
- Reference formats: `docs/phases/phase-02-auth/` (context.md, validation.md, phase-02-auth.md, progress.md) and `docs/decisions/technical-decisions-phase-02-auth.md` — both read in full during exploration; their headings/structure are the contract phase-03's artifacts must match.

**Nothing about queue tech, upload strategy, storage layout, or streaming approach should be decided directly by the AI up front** — that's what the `/research` skill stage is for, per the exercise's own rules and the project's workflow. This plan is the *meta*-plan: the sequence of skill invocations, checkpoints, and infra/git housekeeping needed to carry the exercise from a clean checkout to a fully passing Definition of Done, in the order the exercise itself prescribes (Setup → Research → Planning pipeline → Implementation → Closure).

Decisions confirmed for this plan: (1) register `context7` in `.mcp.json`, since it's required by root `CLAUDE.md` and hard-depended on by `/research` and `/plan-resolve`, and currently only `postgres` is configured. (2) The plan covers the full pipeline end-to-end, executed stage-by-stage across sessions with a review checkpoint after each artifact.

Key facts gathered during exploration (no re-derivation needed later):
- Git: `dev` and `main` both exist locally and on `origin` (fork `ggibellato/mba-ia-greenfield-project`); `upstream` points at `devfullcycle/mba-ia-greenfield-project`. Branch `feature/add-exercise-md` is off-scope for this work — Phase 03 needs its own `feature/phase-03-videos` branch cut from `dev`, per CLAUDE.md Git Flow.
- `.mcp.json` exists only at the repo root, with only `postgres` configured; `nestjs-project/.mcp.json` does not exist.
- Docker stack is not currently running (`docker compose ps` → empty). `nestjs-project/compose.yaml` currently defines only `nestjs-api`, `db` (Postgres 17), `mailpit`.
- `node_modules` is not installed on host — must run inside the container per CLAUDE.md (`docker compose exec nestjs-api npm install`), never on host.
- No queue, S3/MinIO, multer, or ffmpeg libraries in `package.json` yet — all net-new dependencies to be decided in research and confirmed via context7 in `library-refs.md`.
- `docs/project-plan.md` Phase 03 section is the literal capability source `/plan-context` will index — already read in full; matches `docs/exercise.md`.
- `nestjs-project/CLAUDE.md` (module-level) has an "Architecture" section documenting one-module-per-domain and container-only command discipline — Step 4 must extend this with a Videos section, not rewrite it.

---

## Step 0 — Setup

1. Register **context7** in the repo-root `.mcp.json` — that's where `postgres` is currently declared (`nestjs-project/.mcp.json` doesn't exist). Add a standard `npx -y @upstash/context7-mcp` stdio server entry alongside the existing `postgres` entry. Verify connectivity with `claude mcp list` before proceeding to research.
2. Cut branch `feature/phase-03-videos` from `dev` (`git checkout dev && git pull && git checkout -b feature/phase-03-videos`) — Git Flow per CLAUDE.md; never work on `main` or continue on `feature/add-exercise-md`.
3. Bring the stack up: `cd nestjs-project && docker compose up -d`, then `docker compose exec nestjs-api npm install`, then run migrations (`npm run migration:run` inside the container).
4. Confirm baseline is green before adding anything: `npm test`, `npm run test:e2e`, `npx tsc --noEmit`, `npm run lint` — all must pass on the untouched Phase 01/02 code. This is the regression baseline for the final Definition-of-Done check in Step 4.

## Step 1 — Research (`/research`)

Run `/research phase 03` (or the equivalent free-form invocation naming Phase 03 — Upload e Processamento de Vídeos). This produces `docs/decisions/technical-decisions-phase-03-videos.md` in the same TD-numbered format as `technical-decisions-phase-02-auth.md` (Context → Options A/B/[C] with Pros/Cons → Recommendation → `**Decision:** _[pending]_` placeholder → Decisions Summary table).

The exercise mandates these decisions be covered (already scoped into the skill invocation, not pre-decided here):
- Queue technology (project-plan.md marks it explicitly "TBD" — the one genuinely open stack choice; object storage is *not* open, it's S3-compatible/MinIO per the exercise).
- 10GB upload strategy (must not stream the full file through the API process — presigned/multipart direct-to-storage is the class of solution the exercise steers toward, but the specific mechanism is `/research`'s call).
- Worker execution model (separate container) and how it extracts metadata/generates thumbnails (ffmpeg/ffprobe tooling choice).
- Unique-URL and streaming strategy (range requests / 206 Partial Content).
- Video status lifecycle and failure handling.

**Checkpoint:** Review the generated decisions doc before moving on — in particular confirm the `**Decision:**` fields get filled (they start `_[pending]_`; per the pipeline, `/plan-resolve` is what normally fills these after `/plan-validate` flags them, but the queue choice is the headline architectural call and worth a direct look).

## Step 2 — Planning pipeline

Run in sequence, in `docs/phases/phase-03-videos/`:

1. `/plan-context 03` → `context.md` — pure consolidation (Scope, Decisions Index, Capability Coverage, Decisions Detail, Inherited Conventions from Phase 02, Non-UI/Deferred Capabilities, Testing Requirements). No UI Inventory section expected — Phase 03 is backend-only per the exercise ("Há um frontend no repositório, mas a interface de vídeo não faz parte do escopo desta fase").
2. `/plan-validate 03` → `validation.md` — checks Inconsistencies/Ambiguities/Missing Decisions/Dependency Gaps/Inherited Constraint Conflicts/Open Questions against `context.md`.
3. If `status: dirty` — loop `/plan-resolve 03` (fills pending decisions via `AskUserQuestion`, patches decisions doc + context.md, resolves library versions via context7 into `library-refs.md`) ↔ `/plan-validate 03` until `status: clean`. **This loop is mandatory before `/plan-build` will proceed** — do not skip or force it.
4. `/plan-build 03` → `phase-03-videos.md`. Runs in two parts: Phase A (scaffold + Technical Specifications: Data Model for the `videos` table linked to `channels`, API Contracts, Authorization Matrix, Error Catalog, and — because of the queue — an Events/Messages section) pauses for review; Phase B appends Step Implementations (SI-03.1, SI-03.2, …), the Dependency Map, and the Deliverables checklist.
5. `/plan-test-specs 03` — run only if the generated plan is `test_specs_aware: true` with controller-wiring SIs carrying `**Test Specs:**` placeholders; likely light/optional here since there's no screen-wiring in scope, but check rather than assume.

**Checkpoint:** Review `phase-03-videos.md` in full before implementation starts — this is the single highest-leverage review point per the exercise's own advice ("o plano é o que segura"). Once this step completes, replace the placeholder SI list in the Progress Tracker above with the actual SI-03.x titles from the generated plan.

## Step 3 — Implementation (`/implement`)

Run `/implement 03`, SI by SI, per the plan's Dependency Map. Each SI: implement → run its own test file(s) → confirm green → move to next (do not batch multiple SIs' code before testing). Check off the corresponding SI in the Progress Tracker only once its own tests pass. Expect SIs to cover at minimum:
- Compose additions: object storage service (MinIO), queue service (per research decision), worker service/process — each wired with `depends_on`/`healthcheck` following the `mailpit` pattern already in `compose.yaml`.
- `videos` module in `nestjs-project/src/videos/` (entities/dto/guards as needed) — `Channel`↔`Video` as `@OneToMany`/`@ManyToOne`, mirroring the `Channel`↔`User` `@OneToOne` pattern in `src/channels/entities/channel.entity.ts`, and reusing the existing `DomainException`/`DomainExceptionFilter` pattern from `common/exceptions/` for new error codes rather than inventing a parallel mechanism.
- Migration via TypeORM CLI (`migration:generate`, never hand-written) creating the `videos` table.
- Upload/presign endpoints, processing job producer, worker consumer, streaming/download endpoints — per the plan's API Contracts.
- Tests at each layer per the plan's Tests tables and `testing-guide-nestjs-project` skill: `*.spec.ts` unit, `*.integration-spec.ts` against real Postgres/storage/queue in the Compose stack (not mocked — exercise explicitly forbids mocking what Compose can run for real), `*.e2e-spec.ts` via supertest.
- `docs/phases/phase-03-videos/progress.md` updated after each SI (status + tests passing), same shape as `phase-02-auth/progress.md`.

## Step 4 — Closure

1. Update `nestjs-project/CLAUDE.md` — add a Videos section (module layout, endpoints, queue/worker, storage) reflecting the actually-implemented code, extending the existing Architecture section rather than restating it.
2. Update root `CLAUDE.md` — mark the Video Worker/Object Storage/Message Queue containers in the Architecture section as implemented, with the concrete tech chosen in research (replacing "TBD").
3. Full Definition of Done: `npm test`, `npm run test:e2e`, `npx tsc --noEmit` (exit 0), `npm run lint` — all green, whole suite (not just Phase 03's own tests).
4. Walk every checkbox in `docs/exercise.md`'s "Critérios de Aceite" section explicitly against the delivered artifacts/code before considering the phase done.
5. Commit on `feature/phase-03-videos` with short descriptive commits (never direct to `main`); push to `origin` and open the PR against `dev` only after explicit go-ahead at that point.

---

## Verification

- After Step 0: `docker compose ps` shows `nestjs-api`/`db`/`mailpit` healthy; `npm test && npm run test:e2e && npx tsc --noEmit && npm run lint` all pass on baseline code.
- After Step 1: `docs/decisions/technical-decisions-phase-03-videos.md` exists, every TD has a filled `**Decision:**` (no `_[pending]_` left), covers all 5 exercise-mandated decision points.
- After Step 2: `docs/phases/phase-03-videos/validation.md` frontmatter reads `status: clean`; `phase-03-videos.md` contains numbered SI-03.x sections plus Data Model/API Contracts/Authorization Matrix/Error Catalog/Events-Messages/Dependency Map/Deliverables.
- After Step 3, per SI: the SI's own test files pass in isolation, then full `npm test`/`npm run test:e2e` re-run to catch regressions before moving to the next SI. Manually exercise at minimum one upload → processing → streaming round trip against the running Compose stack (e.g. via curl/Postman) once the relevant SIs land, since automated e2e tests won't cover a real 10GB file.
- After Step 4: every `docs/exercise.md` acceptance-criteria checkbox verified true; full DoD commands green; `git log` shows work only on `feature/phase-03-videos`, no commits on `main`.
