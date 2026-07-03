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

_Last updated: 2026-07-03 — Steps 0–6 merged (PR #5–#11); starting Step 7 (Plan Validate, round 2)._

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
- [ ] **Step 7 — Plan Validate, round 2** (`/plan-validate 03`)
  - [ ] MD-1 should clear (replaced by a fresh `OQ-N` for the new TD's own pending decision) — expect `status: dirty` still (all decisions remain pending), zero `MD-N` this time
- [ ] **Step 8 — Plan Resolve, round 1** (`/plan-resolve 03`)
  - [ ] Pending decisions answered via `AskUserQuestion` (all 7 by this point), decisions docs + `context.md` patched, `library-refs.md` written if new libs confirmed via context7
- [ ] **Steps 9+ — Validate/Resolve, round 2, 3, …** (only if round 1 doesn't reach clean)
  - [ ] Repeat `/plan-validate 03` ↔ `/plan-resolve 03`, one step each, until `validation.md` reads `status: clean` — add rows here as rounds happen
- [ ] **Step N — Plan Build** (`/plan-build 03`)
  - [ ] `docs/phases/phase-03-videos/phase-03-videos.md` complete: Data Model, API Contracts, Authorization Matrix, Error Catalog, Events/Messages, SIs (SI-03.x), Dependency Map, Deliverables
- [ ] **Step N+1 — Plan Test Specs** (`/plan-test-specs 03`)
  - [ ] Run, or explicitly skipped with reason recorded here (check the skill's own preflight — likely skip-eligible since Phase 03 is backend-only, no screen-wiring SIs)
- [ ] **Steps N+2… — Implementation, one per SI** (`/implement`)
  - [ ] SI list populated once `phase-03-videos.md` exists (placeholder — replace with actual SI-03.x titles from the plan, one checklist row per SI, each its own branch/PR)
    - [ ] SI-03.1 — _TBD_
    - [ ] SI-03.2 — _TBD_
    - [ ] SI-03.n — _TBD_
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

## Step 7 — Plan Validate, round 2 (`/plan-validate 03`)

Rerun to confirm `MD-1` is gone (replaced by a fresh `OQ-N` for the new TD's own pending decision) and no new issues were introduced. Still expected `status: dirty` — all 7 decisions (6 original + 1 new) remain pending until Step 8.

## Step 8 — Plan Resolve, round 1 (`/plan-resolve 03`)

Reads `validation.md`, asks the user (via `AskUserQuestion`, batched) to fill each pending `**Decision:**`, patches the decisions doc(s) + `context.md`, marks issues resolved, and writes `library-refs.md` for any new library confirmed via context7. **This is where the actual architecture decisions get made** — not in Step 2 or Step 5.

## Steps 9+ — Validate/Resolve, round 2, 3, … (as needed)

If `validation.md` isn't `status: clean` after Step 8, repeat: `/plan-validate 03` (its own step) → `/plan-resolve 03` (its own step) → re-check. Continue until clean. **This loop is mandatory before `/plan-build` will proceed** — do not skip or force it.

## Step N — Plan Build (`/plan-build 03`)

Produces `docs/phases/phase-03-videos/phase-03-videos.md`. Runs in two internal phases within this one skill invocation: Phase A (scaffold + Technical Specifications: Data Model for the `videos` table linked to `channels`, API Contracts, Authorization Matrix, Error Catalog, and — because of the queue — an Events/Messages section) pauses for review; Phase B appends Step Implementations (SI-03.1, SI-03.2, …), the Dependency Map, and the Deliverables checklist.

**Checkpoint:** review `phase-03-videos.md` in full before implementation starts — this is the single highest-leverage review point per the exercise's own advice ("o plano é o que segura"). Once this step completes, replace the placeholder SI list in the Progress Tracker above with the actual SI-03.x titles from the generated plan, one row per SI.

## Step N+1 — Plan Test Specs (`/plan-test-specs 03`)

Run only if the generated plan is `test_specs_aware: true` with controller-wiring SIs carrying `**Test Specs:**` placeholders — check the skill's own preflight rather than assume; likely skip-eligible here since there's no screen-wiring in scope (backend-only phase). If skipped, record the reason in `progress.md` and the tracker; this still counts as the step being resolved, no code/artifact change needed.

## Steps N+2… — Implementation, one step per SI (`/implement`)

Run `/implement 03`, **one step (branch/PR) per SI**, per the plan's Dependency Map — do not batch multiple SIs into one branch. For each SI: cut its branch → implement → run its own test file(s) → confirm green → commit/push/PR → merge → cut the next SI's branch from updated `dev`. Check off the corresponding SI in the Progress Tracker only once its own tests pass. Expect SIs to cover at minimum:
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
