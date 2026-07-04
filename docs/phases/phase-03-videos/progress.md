# phase-03-videos — Progress

**Status:** in progress
**SIs:** 3/7 completed

**Step 12 — Plan Test Specs:** skipped. Reasons:
1. `docs/exercise.md` lists `/plan-test-specs` explicitly as `(opcional)` in its own pipeline description, and the exercise's Critérios de Aceite never references a test-spec artifact.
2. The skill itself would no-op for this phase regardless — `/plan-test-specs` only produces a spec for SIs using the single-endpoint `**Route:**` shape (controller-wiring, screen-wiring, or cross-layer SIs), and none of `phase-03-videos.md`'s 7 SIs use that shape (endpoints were grouped into cohesive SIs instead, per the "one SI = one cohesive unit of work" sizing heuristic).

Real test coverage (unit/integration/e2e) is still mandatory per each SI's own `**Tests:**` table and the `testing-guide-nestjs-project` skill — this skip is specific to the optional external spec-authoring layer, not to testing itself.

### SI-03.1 — Dependencies, Configuration, and Docker Compose Additions
- **Status:** completed
- **Tests:** no tests (Infra) — ACs verified manually
- **Observations:**
  - `docker compose up -d redis minio` reaches healthy for both within ~10s; `nestjs-api`'s `depends_on` extended to require both healthy before starting.
  - Verified fail-fast behavior by temporarily removing `MINIO_ACCESS_KEY` from `.env` and running `node dist/main.js` directly — Joi correctly aborted with `Config validation error: "MINIO_ACCESS_KEY" is required`; `.env` restored immediately after.
  - `fluent-ffmpeg@2.1.3` install prints an npm deprecation warning ("Package no longer supported") — expected, already known when `phase-03-videos/TD-03` decided it; not a blocker, flagging for visibility only.
  - MinIO healthcheck uses `curl -f http://localhost:9000/minio/health/live` (the image's documented health endpoint); Redis uses `redis-cli ping`.
  - **PR review follow-up:** default env values were duplicated across `env.validation.ts` and each `*.config.ts` file (project-wide, not just the two new ones). Centralized into `src/config/config.constants.ts` (`ENV_DEFAULTS`), imported by both layers; required vars with no legitimate default (`DB_USERNAME`/`PASSWORD`/`NAME`, `MINIO_ACCESS_KEY`/`SECRET_KEY`) switched from a dead `|| 'fallback'` to a `!` non-null assertion, matching the existing `JWT_SECRET!` precedent in `auth.config.ts`. Full suite (144 unit/integration + 52 E2E) re-run and green after the change. This surfaced a real pre-existing gap: `env.validation.integration-spec.ts`'s `requiredEnv` fixture was missing the two new required MinIO vars (introduced by this same SI) and would have failed on any full-suite run — fixed alongside the refactor.

### SI-03.2 — Video Entity and Migration
- **Status:** completed
- **Tests:** 8 passing (`video.entity.integration-spec.ts`); full suite 152 unit/integration + 52 E2E green
- **Observations:**
  - The whole Docker stack (containers + volumes) had vanished between sessions — recreated via `docker compose up -d` and re-ran the two pre-existing migrations before generating the new one; no user data was at stake (dev-only DB).
  - Migration generated via `npm run migration:generate` matches the Data Model exactly (enum type, FK, index on `channel_id`, `timestamptz` columns).
  - `Video` entity added a bidirectional relation (`Channel.videos` `@OneToMany`) — this required adding `Video` to the `ALL_ENTITIES` array of 9 pre-existing test files (`auth.service.integration-spec.ts`, `auth.module.spec.ts`, `users.module.spec.ts`, `channels.module.spec.ts`, `verification-token.entity.integration-spec.ts`, `users.service.integration-spec.ts`, `refresh-token.entity.integration-spec.ts`, `channels.service.integration-spec.ts`, `channel.entity.integration-spec.ts`, `user.entity.integration-spec.ts`) since TypeORM needs the related entity's metadata registered wherever `Channel` is used. Purely additive/mechanical (no business-logic change), required for the full suite to pass — matches the project's own precedent of test-module wiring following entity/module changes.
  - Found and fixed a real pre-existing bug in `migrations.integration-spec.ts`: its `beforeAll` dropped all managed tables concurrently via `Promise.all`, which deadlocks in Postgres once enough FK-linked tables are involved (confirmed reproducible when `videos` — FK'd to `channels` — was added to the drop set). A subagent I dispatched to run tests correctly refused to perform the destructive DB cleanup this caused and flagged it back to me instead of working around it. Fixed the root cause (sequential `await`s instead of `Promise.all`) and, with the user's explicit go-ahead, repaired the shared dev DB (dropped 2 orphaned tables + 2 orphaned enum types left by the deadlock, then re-ran migrations from a clean state).
  - Also updated `cleanAllTables` in `create-test-data-source.ts` to delete `videos` before `channels` (FK order), and extended `migrations.integration-spec.ts`'s own coverage to assert all 3 migrations (not just 2) apply/revert correctly — the revert test now targets `videos` (the new last migration) instead of the token tables.
  - `VideosModule` registered directly in `AppModule` (no natural parent-module consumer yet, unlike `ChannelsModule` under `UsersModule`) — needed for `autoLoadEntities` to actually discover `Video` at runtime.
  - **PR review follow-up:** reviewer flagged the `ALL_ENTITIES` array itself as duplicated across many files, and noted the system will keep growing more entities. Centralized into `src/test/all-entities.ts` (single shared `ALL_ENTITIES` export), consumed by all 12 files that previously declared it locally — including switching `video.entity.integration-spec.ts` off its own hand-rolled subset (`[User, Channel, Video]`) onto the full shared list, and `migrations.integration-spec.ts`'s inline array. No equivalent duplication found outside test files (`data-source.ts` already uses a glob, not an explicit array). Full suite re-confirmed green (152 unit/integration + 52 E2E) after the change.

### SI-03.3 — Upload Initiation and Part Presigning
- **Status:** completed
- **Tests:** 3 passing (`storage.service.integration-spec.ts`, real MinIO) + 7 passing (`test/videos.e2e-spec.ts`); full suite 155 unit/integration + 59 E2E green
- **Observations:**
  - `StorageService` wraps the real `minio` client (`initiateNewMultipartUpload`, `presignedUrl`, `completeMultipartUpload`); `onModuleInit` ensures the bucket exists (`bucketExists`/`makeBucket`) since MinIO doesn't auto-create it.
  - `storage_key` needs the video's `id` before the row exists (Data Model requires it `not null`), so the id is generated client-side via `randomUUID()` before the insert, matching TypeORM's support for explicit `@PrimaryGeneratedColumn('uuid')` values.
  - Added `ChannelsService.findByUserId` (Channel is 1:1 with User) so `VideosService` can resolve "my channel" from the JWT's `sub` without owning Channel's query logic itself; `VideosModule` imports `ChannelsModule` for this.
  - `VideosService.findOwnedOrThrow` is the reusable owner-check helper the plan calls for, consumed here by `presignPart` and intended for reuse by SI-03.4/03.6/03.7.
  - **Found and fixed a second real pre-existing bug** while re-verifying the full suite: `test:e2e`'s npm script did NOT actually have `--runInBand` baked in, despite `nestjs-project/CLAUDE.md` explicitly claiming it was "already configured" — every prior verification this phase (Step 0, SI-03.1, SI-03.2) happened to pass anyway with only 3 E2E files, but adding this SI's 4th E2E file (`videos.e2e-spec.ts`) tipped Jest into real parallel execution, causing genuine FK-constraint failures from concurrent `cleanAllTables()` calls across suites sharing one DB. Fixed by adding `--runInBand` directly into the `test:e2e` script in `package.json` so it can't silently regress again regardless of file count. This also retroactively makes the `README.md` wording from the earlier `bugfix/readme-test-runinband` PR accurate (it was written believing the claim, which is now true).
  - MinIO/Postgres containers and volumes have vanished between sessions multiple times this phase (external to this work) — recreated via `docker compose up -d` + `npm run migration:run` each time; no user data at stake (dev-only DB).

### SI-03.4 — Upload Completion and Processing Job Enqueue
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.5 — Video Worker: Metadata Extraction and Thumbnail Generation
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.6 — Video Status Endpoint and Manual Retry
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.7 — Streaming and Download Endpoints
- **Status:** pending
- **Tests:** —
- **Observations:** none
