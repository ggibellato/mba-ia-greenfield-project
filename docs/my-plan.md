# Plan: Execute Phase 03 — Upload e Processamento de Vídeos (`docs/exercise.md`)

## Branching & PR Strategy

Each **skill invocation** in the project's planning/implementation pipeline (`docs/exercise.md`'s workflow: research → context → validate → resolve → build → test-specs → implement) gets its own branch and its own PR, merged sequentially into `dev` — not one branch per bundled phase-of-work, and not a single `feature/phase-03-videos` branch for the whole phase.

- **Branch naming:** `feature/p03-sNN-<skill-slug>` — `NN` is a zero-padded sequence number that increments once per step, shared across the whole phase (not reset per skill type); `<skill-slug>` names the skill (and round, for the validate/resolve loop). E.g. `feature/p03-s00-setup`, `feature/p03-s01-replan`, `feature/p03-s02-research`, `feature/p03-s03-plan-context`, `feature/p03-s04-plan-validate-r1`, `feature/p03-s05-plan-resolve-r1`, `feature/p03-sNN-implement-si-03-1`.
- **Flow:** cut the step's branch from up-to-date `dev` → do only that skill's work → commit → push → open a PR against `dev` → PR is reviewed/merged → next step's branch is cut from the now-updated `dev`. Never stack a new step's branch on an unmerged one.
- **Scope of each PR:** exactly the artifact(s) that one skill invocation produces — e.g. the `/plan-context` step's PR touches only `context.md`, never also `validation.md` or decisions-doc edits. Per CLAUDE.md's Scope Limits ("Work on one feature, fix, or refactoring at a time").
- **Why per-skill, not per-phase-of-work:** lets the user return to the exact skill step to fix or change something without re-touching unrelated artifacts, and makes it visible in the PR history that the exercise's prescribed workflow was followed step-by-step — directly relevant to the exercise's reprova criterion *"Pular o workflow: implementar sem as etapas de research, planejamento e implementação (e seus artefatos)"*.
- **Open-ended stretches:** two parts of the pipeline don't have a fixed step count known upfront — each still gets one step/branch/PR per invocation:
  - **Validate ↔ Resolve loop:** `/plan-validate` and `/plan-resolve` alternate (round 1, round 2, …) until `validation.md` reads `status: clean`. Each round of each skill is its own step; stop alternating once clean.
  - **Implementation:** `/implement` runs once per Step Implementation (SI-03.1, SI-03.2, …) from `phase-03-videos.md`'s Dependency Map — one step per SI, not one step for the whole implementation phase.

## Progress Tracker

> Update this section as work happens — it is the persisted source of truth for what's done across sessions. Check an item only once its own verification (see "Verification" section below) has actually passed, not just "attempted."

_Last updated: 2026-07-05 — Steps 0–16 merged (PR #5–#22); SI-03.5 done, PR #23 pending review (5/7 SIs)._

- [x] **Step 0 — Setup**
  - [x] context7 registered in `.mcp.json` and verified via `claude mcp list`
  - [x] Branch `feature/p03-s00-setup` cut from `dev`
  - [x] Docker stack up (`nestjs-api`, `db`, `mailpit`), deps installed in-container, migrations run
  - [x] Baseline suite green: `npm test` (23 suites/144 tests), `npm run test:e2e` (3 suites/52 tests), `npx tsc --noEmit`, `npm run lint` — all pass
  - [x] PR [#5](https://github.com/ggibellato/mba-ia-greenfield-project/pull/5) merged into `dev`
  - Notes on unplanned fixes needed to reach a green baseline:
    - `nestjs-project/.env` didn't exist (only `.env.example`, gitignored) — `DB_HOST` fell back to `localhost` instead of the Compose service name `db`, breaking migrations. Created `.env` from `.env.example`.
    - `.env.example`'s `MAIL_FROM` value was malformed (`"StreamTube" <noreply@streamtube.com>` — quotes only wrapped the first word), which broke `dotenv` parsing entirely. Fixed to quote the whole value, per the pattern `nestjs-project/CLAUDE.md` already documents.
    - `src/database/migrations.integration-spec.ts`'s `beforeAll` dropped the 4 managed tables but not the `verification_tokens_type_enum` type `CreateAuthTokens` creates, so re-running migrations against an already-migrated DB failed on `CREATE TYPE`. Added a `DROP TYPE IF EXISTS` before the migration re-run.
    - `npm run lint` was already broken on `dev` (190 problems, unrelated to Phase 03) — fixed separately on `bugfix/phase-02-auth-lint`, PR [#4](https://github.com/ggibellato/mba-ia-greenfield-project/pull/4), merged into `dev` before this branch's own baseline check.
- [x] **Step 1 — Re-plan** (this document's restructuring)
  - [x] Rewrite Branching & PR Strategy to one-step-per-skill-invocation
  - [x] Rewrite Progress Tracker and per-step narrative sections below to match
  - [x] Branch `feature/p03-s01-replan` committed, pushed, PR [#6](https://github.com/ggibellato/mba-ia-greenfield-project/pull/6) opened against `dev` and reviewed
- [x] **Step 2 — Research** (`/research phase 03`)
  - [x] `docs/decisions/technical-decisions-phase-03-videos.md` created (6 TDs)
  - [x] Covers all 5 exercise-mandated decision points (queue tech, upload strategy, worker model, unique-URL/streaming, status lifecycle), each with a Recommendation — `**Decision:**` fields left `_[pending]_` is expected here, not a defect (filled later by `/plan-resolve`)
  - [x] Branch `feature/p03-s02-research` committed, pushed, PR [#7](https://github.com/ggibellato/mba-ia-greenfield-project/pull/7) opened against `dev`, reviewed, and merged
- [x] **Step 3 — Plan Context** (`/plan-context 03`)
  - [x] `docs/phases/phase-03-videos/context.md` created via 5 parallel subagents; Filter Trace verification passed
  - [x] Correlated decision confirmed for inclusion: `openapi-docs-nestjs` (high relevance); 3 low/medium candidates excluded
  - [x] No UI scope detected — no `## UI Inventory` section emitted, per `docs/exercise.md`'s backend-only framing
  - [x] Branch `feature/p03-s03-plan-context` committed, pushed, PR [#8](https://github.com/ggibellato/mba-ia-greenfield-project/pull/8) opened against `dev`, reviewed, and merged
- [x] **Step 4 — Plan Validate, round 1** (`/plan-validate 03`)
  - [x] `docs/phases/phase-03-videos/validation.md` created — `status: dirty`, 7 issues: OQ-1..OQ-6 (the 6 pending TDs, expected) + MD-1 (thumbnail frame/timestamp parameter not decided by any TD)
  - [x] Branch `feature/p03-s04-plan-validate-r1` committed, pushed, PR [#9](https://github.com/ggibellato/mba-ia-greenfield-project/pull/9) opened against `dev`, reviewed, and merged
- [x] **Step 5 — Ad-hoc Research: thumbnail frame parameter** (`/research` ad-hoc, `related_phases: [3]`)
  - [x] Unblocks MD-1 from Step 4's validation — `/plan-resolve` cannot invent a new TD in phase mode, so this genuinely needs its own `/research` pass, small as the topic is
  - [x] `docs/decisions/technical-decisions-thumbnail-frame-selection.md` created — 1 TD (fixed percentage vs fixed offset vs content-aware scene detection), Recommendation: fixed 10% — `**Decision:**` left pending
  - [x] Branch `feature/p03-s05-research-thumbnail-frame` committed, pushed, PR [#10](https://github.com/ggibellato/mba-ia-greenfield-project/pull/10) opened against `dev`, reviewed, and merged
- [x] **Step 6 — Plan Context, re-run** (`/plan-context 03`)
  - [x] Reaggregated `thumbnail-frame-selection/TD-01` into `docs/phases/phase-03-videos/context.md` (Decisions Index + Capability Coverage); everything else byte-identical to Step 3, Filter Trace verification passed again
  - [x] Branch `feature/p03-s06-plan-context-rerun` committed, pushed, PR [#11](https://github.com/ggibellato/mba-ia-greenfield-project/pull/11) opened against `dev`, reviewed, and merged
- [x] **Step 7 — Plan Validate, round 2** (`/plan-validate 03`)
  - [x] MD-1 resolved (thumbnail-frame-selection/TD-01 now covers the capability) — `status: dirty`, 7 `OQ-N` (all pending TDs incl. the new one), zero `MD-N`
  - [x] Branch `feature/p03-s07-plan-validate-r2` committed, pushed, PR [#12](https://github.com/ggibellato/mba-ia-greenfield-project/pull/12) opened against `dev`, reviewed, and merged
- [x] **Step 8 — Plan Resolve, round 1** (`/plan-resolve 03`)
  - [x] All 7 decisions answered via `AskUserQuestion` (2 batches) — every choice matched its doc's own Recommendation (TD-01=A, TD-02=B, TD-03=A, TD-04=B, TD-05=A, TD-06=B, thumbnail-frame-selection/TD-01=A)
  - [x] Both decisions docs flipped to `status: decided`; `context.md` Decisions Index + Detail rewritten (Filter Trace verification passed); `validation.md` issue_count: 0 (status left `dirty` — validate decides `clean`)
  - [x] `library-refs.md` created — `@nestjs/bullmq`, `bullmq`, `minio`, `fluent-ffmpeg` docs fetched via context7
  - [x] Branch `feature/p03-s08-plan-resolve-r1` committed, pushed, PR [#13](https://github.com/ggibellato/mba-ia-greenfield-project/pull/13) opened against `dev`, reviewed, and merged
- [x] **Step 9 — Plan Validate, round 3** (`/plan-validate 03`)
  - [x] `status: clean` — all 8 issues (MD-1 + OQ-1..OQ-7) confirmed resolved, zero new issues across all 7 checks
  - [x] Re-stamped `context.md`'s `sources_mtime` for a false-positive staleness signal (git-checkout mtime bump, content verified byte-identical via `git diff`) — not a full `/plan-context` regeneration
  - [x] Branch `feature/p03-s09-plan-validate-r3` committed, pushed, PR [#14](https://github.com/ggibellato/mba-ia-greenfield-project/pull/14) opened against `dev`, reviewed, and merged
  - **Planning pipeline complete: research → context → validate → resolve → validate (clean). `/plan-build` unblocked.**
- [x] **Step 10 — Plan Build, Phase A** (`/plan-build 03`)
  - [x] Scaffold + Technical Specifications written: Data Model (`Video` entity), API Contracts (7 endpoints), Authorization Matrix (owner-only, derived from TD-06), Error Catalog (5 domain codes), Events/Messages (`process-video` job). No UI sections — all TDs `Scope: Backend`.
  - [x] Paused at A5 ("Stop here") — sentinelas in place for Phase B resume
  - [x] Branch `feature/p03-s10-plan-build` committed, pushed, PR [#15](https://github.com/ggibellato/mba-ia-greenfield-project/pull/15) opened against `dev`, reviewed, and merged
- [x] **Step 11 — Plan Build, Phase B** (`/plan-build 03`, resumed automatically via sentinelas)
  - [x] `docs/phases/phase-03-videos/phase-03-videos.md` complete: 7 SIs (SI-03.1..SI-03.7), Dependency Map, Deliverables (SI checklist + container-wrapped full test-suite commands)
  - [x] Fixed a real bug found by B2.5's coverage check: `library-refs.md` used `##` headings instead of the `###` the skill's grep pattern requires
  - [x] No `**Test Specs:**` placeholders emitted — none of the 7 SIs use the single-endpoint `**Route:**` shape; Step 12 (`/plan-test-specs`) expected to legitimately no-op
  - [x] Branch `feature/p03-s11-plan-build-phase-b` committed, pushed, PR [#16](https://github.com/ggibellato/mba-ia-greenfield-project/pull/16) opened against `dev`, reviewed, and merged
  - **Planning artifact complete: `phase-03-videos.md` has Technical Specifications + SIs + Dependency Map + Deliverables, per `docs/exercise.md`'s required format.**
- [x] **Step 12 — Plan Test Specs** (`/plan-test-specs 03`)
  - [x] Explicitly skipped — `docs/exercise.md` marks this stage `(opcional)` and its acceptance criteria never reference a test-spec artifact; the skill would also no-op regardless (no SI uses the single-endpoint `**Route:**` shape). Reason recorded in `docs/phases/phase-03-videos/progress.md`.
  - [x] `docs/phases/phase-03-videos/progress.md` created with the skip rationale + all 7 SIs listed as pending
  - [x] Branch `feature/p03-s12-plan-test-specs-skip` committed, pushed, PR [#17](https://github.com/ggibellato/mba-ia-greenfield-project/pull/17) opened against `dev`, reviewed, and merged
- [x] **Step 13 — Implementation: SI-03.1** (`/implement 03`)
  - [x] Dependencies, config namespaces, `redis`/`minio` compose services added; `BullModule.forRootAsync` registered
  - [x] All 3 ACs verified manually (no automated tests — Infra SI)
  - [x] Branch `feature/p03-s13-si-03-1` committed, pushed, PR [#18](https://github.com/ggibellato/mba-ia-greenfield-project/pull/18) opened against `dev`, reviewed, and merged
  - [x] Review follow-up: centralized duplicated env default values into `src/config/config.constants.ts` (project-wide), fixed a pre-existing test-fixture gap surfaced by the full-suite re-run
- [x] **Step 14 — Implementation: SI-03.2** (`/implement 03`)
  - [x] `Video` entity + `Channel` relation + migration, matching the Data Model exactly
  - [x] 8 tests passing (`video.entity.integration-spec.ts`); full suite 152 unit/integration + 52 E2E green
  - [x] Fixed a real pre-existing deadlock bug in `migrations.integration-spec.ts` (concurrent `Promise.all` DROP TABLE → sequential); repaired shared dev DB with explicit sign-off
  - [x] Review follow-up: centralized the duplicated `ALL_ENTITIES` array into `src/test/all-entities.ts` (12 files)
  - [x] Branch `feature/p03-s14-si-03-2` committed, pushed, PR [#19](https://github.com/ggibellato/mba-ia-greenfield-project/pull/19) opened against `dev`, reviewed, and merged
- [x] **Step 15 — Implementation: SI-03.3** (`/implement 03`)
  - [x] `StorageService` (real minio client), `POST /videos`, `GET /videos/:id/parts/:partNumber`, `findOwnedOrThrow` helper
  - [x] 3 tests passing (`storage.service.integration-spec.ts`, real MinIO) + 7 tests passing (`videos.e2e-spec.ts`); full suite 155 unit/integration + 59 E2E green
  - [x] Found and fixed a second real pre-existing bug: `test:e2e` script was missing `--runInBand` despite `CLAUDE.md` claiming otherwise — fixed at the script level
  - [x] Branch `feature/p03-s15-si-03-3` committed, pushed, PR [#21](https://github.com/ggibellato/mba-ia-greenfield-project/pull/21) opened against `dev`, reviewed, and merged
- [x] **Step 16 — Implementation: SI-03.4** (`/implement 03`)
  - [x] `CompleteUploadDto` (nested validation), `video-processing` BullMQ queue registration, `POST /videos/:id/complete`
  - [x] 4 unit tests passing (`videos.service.spec.ts`) + 3 new E2E tests passing; full suite 159 unit/integration + 62 E2E green
  - [x] E2E test caught a real bug: missing `@HttpCode(HttpStatus.OK)` made the endpoint return 201 instead of the plan's specified 200 — fixed
  - [x] Branch `feature/p03-s16-si-03-4` committed, pushed, PR [#22](https://github.com/ggibellato/mba-ia-greenfield-project/pull/22) opened against `dev`, reviewed, and merged
- [ ] **Step 17 — Implementation: SI-03.5** (`/implement 03`)
  - [x] Standalone worker (`worker.ts`/`worker.module.ts`), `VideoProcessor` (`@Processor`/`WorkerHost`), `Dockerfile.worker` + `worker` compose service
  - [x] 2 integration tests passing (real MinIO + real Redis/BullMQ + real ffmpeg); full suite 161 unit/integration + 62 E2E green
  - [x] Found and fixed a real bug in `minio`'s `fGetObject` (spurious ENOENT under Jest/ts-jest) — worked around via `getObject` + manual pipeline
  - [x] Deliberate deviation flagged for review: `Dockerfile.worker`'s CMD idles by default (`tail -f /dev/null`), not the plan's literal `node dist/worker.js` — matches `nestjs-api`'s own never-auto-start convention
  - [ ] Branch `feature/p03-s17-si-03-5` committed, pushed, PR [#23](https://github.com/ggibellato/mba-ia-greenfield-project/pull/23) opened against `dev` — pending manual review
- [ ] **Steps 18+… — Implementation, one per remaining SI** (`/implement 03`, resumes via `progress.md`)
  - [x] SI-03.1 — Dependencies, Configuration, and Docker Compose Additions (Step 13, above)
  - [x] SI-03.2 — Video Entity and Migration (Step 14, above)
  - [x] SI-03.3 — Upload Initiation and Part Presigning (Step 15, above)
  - [x] SI-03.4 — Upload Completion and Processing Job Enqueue (Step 16, above)
  - [x] SI-03.5 — Video Worker: Metadata Extraction and Thumbnail Generation (Step 17, above)
  - [ ] SI-03.6 — Video Status Endpoint and Manual Retry
  - [ ] SI-03.7 — Streaming and Download Endpoints
  - [ ] `docs/phases/phase-03-videos/progress.md` kept current after each SI
- [ ] **Step Last — Closure**
  - [ ] `nestjs-project/CLAUDE.md` updated with Videos section
  - [ ] Root `CLAUDE.md` updated (queue/storage/worker no longer "TBD")
  - [ ] Full Definition of Done green (whole suite + tsc + lint)
  - [ ] Every `docs/exercise.md` acceptance-criteria checkbox walked and confirmed
  - [ ] Committed on its own `feature/p03-sNN-closure` branch; PR to `dev` opened per the branching strategy above

---

## Context

This repo is a fork of `mba-ia-greenfield-project`, an MBA exercise where an AI agent (Claude Code) drives a documented pipeline of skills to plan and implement each phase of a video-sharing platform ("StreamTube"). Phases 01 (base config) and 02 (auth/users/channels) are already delivered. `docs/exercise.md` assigns Phase 03 — Upload e Processamento de Vídeos: object storage, a background processing queue, a video worker (FFmpeg), 10GB-capable uploads without blocking the API, automatic thumbnail/metadata extraction, unique URLs, streaming (range requests), and download — plus the full `docs/decisions/` → `docs/phases/phase-03-videos/` artifact trail the exercise's grading rubric explicitly checks for.

The repo already ships the exact tooling this workflow expects (found during exploration):
- Skills in `.claude/skills/`: `/research`, `/plan-context`, `/plan-validate`, `/plan-resolve`, `/plan-build`, `/plan-test-specs`, `/implement`, plus reference skill `plan-pipeline` (shared conventions) and `decide`.
- Read-only subagents in `.claude/agents/` (`plan-reader`, `decisions-reader`, `decisions-detail-reader`, `decisions-correlator`, `phases-reader`, `inventory-digest-reader`) — invoked automatically by the skills above; never called directly.
- Convention rules in `.claude/rules/` (`nestjs-entities.md`, `nestjs-controllers.md`, `nestjs-services.md`, `nestjs-modules.md`, `nestjs-dtos.md`, `nestjs-testing.md`, `typeorm-migrations.md`, `typeorm-queries.md`, `typescript-strict.md`, `auth-jwt.md`) — auto-loaded during implementation.
- Reference formats: `docs/phases/phase-02-auth/` (context.md, validation.md, phase-02-auth.md, progress.md) and `docs/decisions/technical-decisions-phase-02-auth.md` — both read in full during exploration; their headings/structure are the contract phase-03's artifacts must match.

**Nothing about queue tech, upload strategy, storage layout, or streaming approach should be decided directly by the AI up front** — that's what the `/research` skill stage is for, per the exercise's own rules and the project's workflow. Per `.claude/skills/research/SKILL.md`, `/research` itself does not pick a `**Decision:**` either — it only proposes options + a recommendation and leaves the decision field pending; the actual interactive decision-making happens in `/plan-resolve`, which asks the user via `AskUserQuestion` (per `.claude/skills/plan-pipeline/SKILL.md`'s stage table). This plan is the *meta*-plan: the sequence of individual skill invocations, checkpoints, and infra/git housekeeping needed to carry the exercise from a clean checkout to a fully passing Definition of Done, in the order the exercise itself prescribes (Setup → Research → Planning pipeline stages → Implementation per SI → Closure), with **one branch/PR per skill invocation** (revised from the original per-phase-of-work grouping — see "Branching & PR Strategy" above for why).

Decisions confirmed for this plan: (1) register `context7` in `.mcp.json`, since it's required by root `CLAUDE.md` and hard-depended on by `/research` and `/plan-resolve`, and currently only `postgres` is configured — done in Step 0. (2) The plan covers the full pipeline end-to-end, executed one skill invocation at a time across sessions, with a review checkpoint (PR) after each.

Key facts gathered during exploration (no re-derivation needed later):
- Git: `dev` and `main` both exist locally and on `origin` (fork `ggibellato/mba-ia-greenfield-project`); `upstream` points at `devfullcycle/mba-ia-greenfield-project`.
- `.mcp.json` exists only at the repo root, with `context7` and `postgres` configured (added in Step 0); `nestjs-project/.mcp.json` does not exist.
- `nestjs-project/compose.yaml` currently defines only `nestjs-api`, `db` (Postgres 17), `mailpit`. No queue, S3/MinIO, multer, or ffmpeg libraries in `package.json` yet — all net-new dependencies to be decided in research and confirmed via context7 in `library-refs.md`.
- `node_modules` is not installed on host — must run inside the container per CLAUDE.md (`docker compose exec nestjs-api npm install`), never on host.
- `docs/project-plan.md` Phase 03 section is the literal capability source `/plan-context` will index — already read in full; matches `docs/exercise.md`.
- `nestjs-project/CLAUDE.md` (module-level) has an "Architecture" section documenting one-module-per-domain and container-only command discipline — the Closure step must extend this with a Videos section, not rewrite it.

---

## Step 0 — Setup (done, merged)

Registered context7, cut the first branch, brought the Docker stack up, and confirmed the baseline suite green before touching anything else. See Progress Tracker above for the specific fixes needed to get there. PR [#5](https://github.com/ggibellato/mba-ia-greenfield-project/pull/5), merged.

## Step 1 — Re-plan (done, reviewed)

Rewrote this document's Branching & PR Strategy and Progress Tracker to move from grouped multi-skill steps to one branch/PR per skill invocation, per the rationale in "Branching & PR Strategy" above. No pipeline skill runs in this step — doc-only change. PR [#6](https://github.com/ggibellato/mba-ia-greenfield-project/pull/6), reviewed and approved.

## Step 2 — Research (done, merged)

PR [#7](https://github.com/ggibellato/mba-ia-greenfield-project/pull/7): `docs/decisions/technical-decisions-phase-03-videos.md` created with 6 TDs (queue tech, upload strategy, worker+ffmpeg tooling, status lifecycle, unique URL, streaming/download serving), all `**Decision:**` fields left `_[pending]_` as designed. Grounded via context7 against `minio-js`, `@nestjs/bull`, `pg-boss`, and `fluent-ffmpeg` docs — notably confirmed MinIO's single presigned PUT caps at 5GB, disqualifying it for the 10GB requirement outright.

Run `/research phase 03` (or the equivalent free-form invocation naming Phase 03 — Upload e Processamento de Vídeos). This produces `docs/decisions/technical-decisions-phase-03-videos.md` in the same TD-numbered format as `technical-decisions-phase-02-auth.md` (Context → Options A/B/[C] with Pros/Cons → Recommendation → `**Decision:** _[pending]_` placeholder → Decisions Summary table).

The exercise mandates these decisions be covered (already scoped into the skill invocation, not pre-decided here):
- Queue technology (project-plan.md marks it explicitly "TBD" — the one genuinely open stack choice; object storage is *not* open, it's S3-compatible/MinIO per the exercise).
- 10GB upload strategy (must not stream the full file through the API process — presigned/multipart direct-to-storage is the class of solution the exercise steers toward, but the specific mechanism is `/research`'s call).
- Worker execution model (separate container) and how it extracts metadata/generates thumbnails (ffmpeg/ffprobe tooling choice).
- Unique-URL and streaming strategy (range requests / 206 Partial Content).
- Video status lifecycle and failure handling.

**Checkpoint:** review the generated decisions doc before moving on — `**Decision:**` fields are expected to remain `_[pending]_` at the end of this step (that's `/plan-resolve`'s job, in Step 5). Confirm the recommendations themselves are sound, especially the queue choice.

## Step 3 — Plan Context (done, merged)

PR [#8](https://github.com/ggibellato/mba-ia-greenfield-project/pull/8): `docs/phases/phase-03-videos/context.md` produced — pure consolidation (Scope, Decisions Index, Capability Coverage, Decisions Detail, Inherited Decisions Detail from Phases 01–02 + the correlated `openapi-docs-nestjs` doc, Inherited Conventions, Non-UI/Deferred Capabilities, Testing Requirements). No UI Inventory section — Phase 03 is backend-only per the exercise ("Há um frontend no repositório, mas a interface de vídeo não faz parte do escopo desta fase").

## Step 4 — Plan Validate, round 1 (done, merged)

PR [#9](https://github.com/ggibellato/mba-ia-greenfield-project/pull/9): `docs/phases/phase-03-videos/validation.md` produced, `status: dirty` as expected — 6 `OQ-N` (one per pending TD) plus one genuine `MD-1` gap found: no TD/prose decides which video frame/timestamp the automatic thumbnail is grabbed from (TD-03 only decides the tooling). All other categories (Inconsistencies, Ambiguities, Dependency Gaps, Inherited Constraint Conflicts, UI Coverage Gaps) clean. Step 5 (`/plan-resolve`) resolves all 7.

## Step 5 — Ad-hoc Research: thumbnail frame parameter (done, merged)

PR [#10](https://github.com/ggibellato/mba-ia-greenfield-project/pull/10): discovered when `/plan-resolve 03` was attempted directly after Step 4: its own hard rule is "Phase mode — never create new TDs; `MD-N` aborts with a `/research` instruction" — an `MD-N` present in `validation.md` blocks resolve from touching *any* issue, not just the `MD-N` one, until a fresh `/research` pass adds the missing TD. `docs/exercise.md`'s own workflow (research → plan → implement) is what's being followed here, just triggered mid-pipeline instead of only at the start. Produced `docs/decisions/technical-decisions-thumbnail-frame-selection.md` — a single ad-hoc TD deciding which video frame/timestamp the automatic thumbnail is grabbed from (`related_phases: [3]`, since it constrains Phase 03 but isn't itself a phase-scope slice), recommending a fixed 10% offset.

## Step 6 — Plan Context, re-run (done, merged)

PR [#11](https://github.com/ggibellato/mba-ia-greenfield-project/pull/11): reaggregated the new ad-hoc decisions doc into `context.md` — same procedure as Step 3, rerun because a new source doc now exists. Only the thumbnail capability's coverage row and the Decisions Index changed; everything else came back byte-identical to Step 3's run.

## Step 7 — Plan Validate, round 2 (done, merged)

PR [#12](https://github.com/ggibellato/mba-ia-greenfield-project/pull/12): confirmed `MD-1` is resolved (moved to `## Resolved Issues`, `resolved_by: thumbnail-frame-selection/TD-01`) and no new issues were introduced. `status: dirty` still — all 7 decisions (6 original + 1 new) remain pending, now all as `OQ-N` — but zero `MD-N`, so Step 8 (`/plan-resolve`) is unblocked.

## Step 8 — Plan Resolve, round 1 (done, merged)

PR [#13](https://github.com/ggibellato/mba-ia-greenfield-project/pull/13): all 7 pending `**Decision:**` fields filled via `AskUserQuestion` (2 batches of up to 4), every choice matching its doc's own Recommendation. Decisions doc(s) + `context.md` patched, `validation.md` issues moved to Resolved, `library-refs.md` written for the 4 newly decided libraries via context7. **This is where the actual architecture decisions got made** — not in Step 2 or Step 5.

## Step 9 — Plan Validate, round 3 (done, merged)

PR [#14](https://github.com/ggibellato/mba-ia-greenfield-project/pull/14): one round of the validate/resolve loop was enough — `status: clean` on the first re-check after Step 8's resolve. All 8 issues (`MD-1` + `OQ-1`..`OQ-7`) confirmed resolved, zero new issues across every check. Hit one false-positive staleness signal (git-checkout touched two decisions docs' mtimes without changing their content — verified via `git diff` against the merge commit) and re-stamped `context.md`'s `sources_mtime` rather than forcing a pointless regeneration. Planning pipeline complete: `research → context → validate → resolve → validate (clean)`, per `docs/exercise.md`'s requirement.

## Step 10 — Plan Build, Phase A (done, merged)

PR [#15](https://github.com/ggibellato/mba-ia-greenfield-project/pull/15): scaffold + Technical Specifications written — Data Model for the `videos` table linked to `channels`, API Contracts (7 endpoints), Authorization Matrix (owner-only, per TD-06), Error Catalog (5 domain codes), and — because of the queue — an Events/Messages section for the `process-video` job. Paused at the A5 checkpoint ("Stop here") for review before Phase B commits to writing the actual SI blocks against this Tech Specs surface.

**Checkpoint:** review the Technical Specifications in `phase-03-videos.md` before Phase B runs — this is the single highest-leverage review point per the exercise's own advice ("o plano é o que segura"), and it's cheaper to correct the contracts now than after SIs are written against them.

## Step 11 — Plan Build, Phase B (done, merged)

PR [#16](https://github.com/ggibellato/mba-ia-greenfield-project/pull/16): Gate 10 detected both sentinelas from Phase A and skipped straight to Phase B, appending 7 Step Implementations (SI-03.1..SI-03.7), the Dependency Map, and the Deliverables checklist. Found and fixed a real bug along the way: `library-refs.md` used `##` headings instead of the `###` the skill's own B2.5 coverage-check grep requires. No `**Test Specs:**` placeholders emitted (no SI uses the single-endpoint `**Route:**` shape) — Step 12 is expected to legitimately no-op.

**Checkpoint:** review `phase-03-videos.md` in full — the last review point before implementation starts. The Progress Tracker's SI list above is already populated with the real titles.

## Step 12 — Plan Test Specs (skipped, done, reviewed)

Explicitly skipped rather than run. `docs/exercise.md` lists `/plan-test-specs` as `(opcional)` in its own pipeline, and its Critérios de Aceite never reference a test-spec artifact. Independently, the skill would no-op for this phase anyway — none of `phase-03-videos.md`'s 7 SIs use the single-endpoint `**Route:**` shape that triggers spec generation. Reason recorded in `docs/phases/phase-03-videos/progress.md`, which was created for the first time this step (skip note + all 7 SIs listed pending).

## Step 13 — Implementation: SI-03.1 (done, reviewed)

PR [#18](https://github.com/ggibellato/mba-ia-greenfield-project/pull/18): dependencies (`@nestjs/bullmq`, `bullmq`, `minio`, `fluent-ffmpeg`), `queue.config.ts`/`storage.config.ts` namespaces, `redis`/`minio` compose services with healthchecks, `BullModule.forRootAsync` registration. Infra-only SI, no automated tests per the plan — all 3 ACs verified manually (compose healthy, build compiles, Joi fail-fast on a missing required var). Review follow-up: reviewer flagged default-value duplication across `env.validation.ts` and every `*.config.ts` — fixed by centralizing into `src/config/config.constants.ts` project-wide (not just this PR's two new files), which also surfaced and fixed a pre-existing test-fixture gap. Full suite re-confirmed green (144 unit/integration + 52 E2E) before approval.

## Step 14 — Implementation: SI-03.2 (done, merged)

PR [#19](https://github.com/ggibellato/mba-ia-greenfield-project/pull/19): `Video` entity matching the Data Model exactly, `Channel` `@OneToMany`/`@ManyToOne` relation, migration via `npm run migration:generate`. 8 tests passing; full suite 152 unit/integration + 52 E2E green. Two notable findings: (1) the new bidirectional relation required adding `Video` to 9 pre-existing test files' entity arrays (mechanical, TypeORM metadata requirement, no business-logic change); (2) found and fixed a real pre-existing deadlock bug in `migrations.integration-spec.ts` (concurrent `Promise.all` DROP TABLE across FK-linked tables) — a subagent correctly refused to perform the resulting destructive DB cleanup and flagged it back instead of working around it; fixed the root cause and repaired the shared dev DB with explicit user sign-off. Review follow-up: reviewer flagged the `ALL_ENTITIES` array itself as duplicated across those same files — centralized into `src/test/all-entities.ts`, consumed by all 12 files (including switching `video.entity.integration-spec.ts` off a hand-rolled subset). Full suite re-confirmed green before approval.

## Step 15 — Implementation: SI-03.3 (done, merged)

PR [#21](https://github.com/ggibellato/mba-ia-greenfield-project/pull/21): `StorageService` wrapping the real `minio` client, `POST /videos` (draft + initiate multipart upload), `GET /videos/:id/parts/:partNumber` (owner + draft-status checks, presigned PUT url), `VideosService.findOwnedOrThrow` reusable helper, `ChannelsService.findByUserId` added for channel resolution. 3 integration tests (real MinIO round trip) + 7 E2E tests; full suite 155 unit/integration + 59 E2E green; all 4 plan ACs verified. Found and fixed a second real pre-existing bug: `test:e2e`'s npm script never actually had `--runInBand` baked in despite `CLAUDE.md` claiming otherwise — every prior verification passed by luck with only 3 E2E files; this SI's 4th E2E file tipped Jest into real parallel execution, causing genuine FK-constraint failures. Fixed at the script level.

## Step 16 — Implementation: SI-03.4 (done, merged)

PR [#22](https://github.com/ggibellato/mba-ia-greenfield-project/pull/22): `CompleteUploadDto` (first use of nested `class-validator` in the project), `video-processing` BullMQ queue registered in `VideosModule`, `POST /videos/:id/complete` (owner + draft-status checks, completes the multipart upload, flips status to `processing`, enqueues `process-video`). 4 unit tests (mocked repo/storage/channels/queue) + 3 new E2E tests, one of which asserts against the real BullMQ queue state via `getJobs()`; full suite 159 unit/integration + 62 E2E green; all 3 plan ACs verified. The E2E test caught a real bug on the first run: the endpoint was missing `@HttpCode(HttpStatus.OK)` and defaulted to `201` instead of the plan-specified `200` — fixed immediately.

## Step 17 — Implementation: SI-03.5 (done, PR pending review)

PR [#23](https://github.com/ggibellato/mba-ia-greenfield-project/pull/23): standalone worker (`worker.ts`/`worker.module.ts`, `NestFactory.createApplicationContext` sharing `VideosModule`'s DI graph), `VideoProcessor` (`@Processor('video-processing')`/`WorkerHost`: download from MinIO, `ffprobe` duration, thumbnail at 10% per `thumbnail-frame-selection/TD-01`, flip status to `ready`; `@OnWorkerEvent('failed')` flips to `error` only once retries exhaust, per `phase-03-videos/TD-04`), `Dockerfile.worker` + `worker` compose service. 2 integration tests against real MinIO + real Redis/BullMQ + real `ffmpeg`; full suite 161 unit/integration + 62 E2E green; all 3 plan ACs verified, including an explicit color-based check proving the thumbnail is grabbed at 10% and not timestamp 0. Found and fixed a real bug in the `minio` npm package itself (`fGetObject` throws a spurious ENOENT specifically under Jest/ts-jest) — worked around via `getObject` + a manual stream pipeline. One deliberate deviation flagged for review: the worker container idles by default (`tail -f /dev/null`) rather than the plan's literal `node dist/worker.js`, matching `nestjs-api`'s own established "never auto-start" convention.

## Steps 18+… — Implementation, one step per remaining SI (`/implement 03`, resumes via `progress.md`)

`/implement` resumes automatically from `docs/phases/phase-03-videos/progress.md` — no need to re-specify which SI to start from. **One step (branch/PR) per SI**, per the plan's Dependency Map — do not batch multiple SIs into one branch. For each SI: cut its branch → implement → run its own test file(s) → confirm green → commit/push/PR → merge → cut the next SI's branch from updated `dev`. Check off the corresponding SI in the Progress Tracker only once its own tests pass. Expect SIs to cover at minimum:
- Compose additions: object storage service (MinIO), queue service (per research decision), worker service/process — each wired with `depends_on`/`healthcheck` following the `mailpit` pattern already in `compose.yaml`.
- `videos` module in `nestjs-project/src/videos/` (entities/dto/guards as needed) — `Channel`↔`Video` as `@OneToMany`/`@ManyToOne`, mirroring the `Channel`↔`User` `@OneToOne` pattern in `src/channels/entities/channel.entity.ts`, and reusing the existing `DomainException`/`DomainExceptionFilter` pattern from `common/exceptions/` for new error codes rather than inventing a parallel mechanism.
- Migration via TypeORM CLI (`migration:generate`, never hand-written) creating the `videos` table.
- Upload/presign endpoints, processing job producer, worker consumer, streaming/download endpoints — per the plan's API Contracts.
- Tests at each layer per the plan's Tests tables and `testing-guide-nestjs-project` skill: `*.spec.ts` unit, `*.integration-spec.ts` against real Postgres/storage/queue in the Compose stack (not mocked — exercise explicitly forbids mocking what Compose can run for real), `*.e2e-spec.ts` via supertest.
- `docs/phases/phase-03-videos/progress.md` updated after each SI (status + tests passing), same shape as `phase-02-auth/progress.md`.

## Step Last — Closure

1. Update `nestjs-project/CLAUDE.md` — add a Videos section (module layout, endpoints, queue/worker, storage) reflecting the actually-implemented code, extending the existing Architecture section rather than restating it.
2. Update root `CLAUDE.md` — mark the Video Worker/Object Storage/Message Queue containers in the Architecture section as implemented, with the concrete tech chosen in research (replacing "TBD").
3. Full Definition of Done: `npm test`, `npm run test:e2e`, `npx tsc --noEmit` (exit 0), `npm run lint` — all green, whole suite (not just Phase 03's own tests).
4. Walk every checkbox in `docs/exercise.md`'s "Critérios de Aceite" section explicitly against the delivered artifacts/code before considering the phase done.
5. Commit on its own `feature/p03-sNN-closure` branch with short descriptive commits (never direct to `main`); push to `origin` and open the PR against `dev`.

---

## Verification

- After Step 0: `docker compose ps` shows `nestjs-api`/`db`/`mailpit` healthy; `npm test && npm run test:e2e && npx tsc --noEmit && npm run lint` all pass on baseline code. (Done.)
- After Step 1: `docs/my-plan.md` reflects one-step-per-skill-invocation structure; no pipeline skill was run; diff for this branch touches only this file.
- After Step 2: `docs/decisions/technical-decisions-phase-03-videos.md` exists, covers all 5 exercise-mandated decision points with a Recommendation each; `**Decision:**` fields left pending is expected.
- After Steps 3–6+: `docs/phases/phase-03-videos/validation.md` frontmatter eventually reads `status: clean`, with every `**Decision:**` in the decisions doc filled (no `_[pending]_` left) — satisfying `docs/exercise.md`'s "decisões em aberto resolvidas e justificadas" criterion.
- After Step N (plan-build): `phase-03-videos.md` contains numbered SI-03.x sections plus Data Model/API Contracts/Authorization Matrix/Error Catalog/Events-Messages/Dependency Map/Deliverables.
- After each implementation SI step: the SI's own test files pass in isolation, then full `npm test`/`npm run test:e2e` re-run to catch regressions before moving to the next SI. Manually exercise at minimum one upload → processing → streaming round trip against the running Compose stack (e.g. via curl/Postman) once the relevant SIs land, since automated e2e tests won't cover a real 10GB file.
- After Closure: every `docs/exercise.md` acceptance-criteria checkbox verified true; full DoD commands green; `git log` shows work only on `feature/p03-sNN-*` step branches, no commits on `main`.
