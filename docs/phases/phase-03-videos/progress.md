# phase-03-videos — Progress

**Status:** in progress
**SIs:** 1/7 completed

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

### SI-03.2 — Video Entity and Migration
- **Status:** pending
- **Tests:** —
- **Observations:** none

### SI-03.3 — Upload Initiation and Part Presigning
- **Status:** pending
- **Tests:** —
- **Observations:** none

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
