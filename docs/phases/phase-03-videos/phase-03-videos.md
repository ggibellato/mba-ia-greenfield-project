---
kind: phase
name: phase-03-videos
test_specs_aware: true
sources_mtime:
  docs/phases/phase-03-videos/context.md: "2026-07-03T17:57:49+01:00"
  docs/phases/phase-03-videos/library-refs.md: "2026-07-03T17:47:14+01:00"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-07-03T17:47:14+01:00"
  docs/decisions/technical-decisions-thumbnail-frame-selection.md: "2026-07-03T17:47:14+01:00"
  docs/decisions/technical-decisions-openapi-docs-nestjs.md: "2026-06-30T09:31:19+01:00"
  docs/phases/phase-01-configuracao-base/context.md: "2026-06-30T09:31:19+01:00"
  docs/phases/phase-02-auth/context.md: "2026-06-30T09:31:19+01:00"
  docs/phases/phase-02-auth-frontend/context.md: "2026-06-30T09:31:19+01:00"
  .claude/skills/testing-guide-nestjs-project/SKILL.md: "2026-06-30T09:31:19+01:00"
---

# Phase 03 — Upload e Processamento de Vídeos

## Objective

Deliver upload of videos up to 10GB via presigned multipart storage upload (never routing the file through the API), automatic background processing (duration/metadata extraction and thumbnail generation) through a queued video worker, a unique per-video URL, and range-based streaming plus download — satisfying Fase 03's deliverables: upload de até 10GB funcional, processamento automático do vídeo, streaming funcionando, URLs únicas geradas.

---

## Step Implementations

### SI-03.1 — Dependencies, Configuration, and Docker Compose Additions

**Description:** Add the queue, storage, and video-processing dependencies and infrastructure this phase needs, following the project's existing config/compose conventions — no application behavior yet.

**Technical actions:**

1. Add `@nestjs/bullmq`, `bullmq`, `minio`, `fluent-ffmpeg` to `package.json` (per `phase-03-videos/TD-01`, `TD-02`, `TD-03`)
2. Add `redis` and `minio` services to `nestjs-project/compose.yaml` with healthchecks, following the `mailpit`/`db` pattern already established
3. Create `src/config/queue.config.ts` and `src/config/storage.config.ts` via `registerAs`, mirroring `src/config/database.config.ts` (per `phase-01-configuracao-base/TD-01`, `TD-03`)
4. Add the new queue/storage env vars to `.env.example` and the Joi schema in `src/config/env.validation.ts` (per `phase-01-configuracao-base/TD-02`)
5. Register `BullModule.forRootAsync` in `AppModule`, injecting `queueConfig` (per `phase-03-videos/TD-01`)

**Tests:** _(empty — Infra)_

**Dependencies:** none

**Acceptance criteria:**

- `docker compose up -d` brings up `redis` and `minio` services in `running`/healthy state
- `npm run build` compiles with the new config namespaces registered
- Starting the app with a required queue/storage env var missing fails fast with a Joi validation error

---

### SI-03.2 — Video Entity and Migration

**Description:** Create the `Video` entity per the Data Model, its relation to `Channel`, and the migration that creates the `videos` table.

**Technical actions:**

1. Create `src/videos/entities/video.entity.ts` with the fields, types, and constraints from `### Data Model` (`id`, `channel_id`, `original_filename`, `storage_key`, `thumbnail_key`, `status`, `duration_seconds`, `upload_id`, `retry_count`, `created_at`, `updated_at`)
2. Add `@ManyToOne(() => Channel)` on `Video` and `@OneToMany(() => Video)` on `Channel`, mirroring the `Channel`↔`User` `@OneToOne` pattern in `src/channels/entities/channel.entity.ts`
3. Create `src/videos/videos.module.ts` registering `TypeOrmModule.forFeature([Video])`
4. Generate the migration via `npm run migration:generate` (TypeORM CLI, never hand-written) creating the `videos` table with the `channel_id` index

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `Video` | Integration: constraints, defaults, enum values | `src/videos/entities/video.entity.integration-spec.ts` |

**Dependencies:** SI-03.1

**Acceptance criteria:**

- Running migrations creates a `videos` table whose columns match the Data Model's fields, types, and constraints
- Inserting a video with an invalid `status` value violates the `status` enum constraint
- Inserting a video with a `channel_id` that does not reference an existing channel violates the FK constraint

---

### SI-03.3 — Upload Initiation and Part Presigning

**Description:** Implement the two endpoints that start a multipart upload and hand the client a presigned URL per part, so the video file never passes through the API.

**Technical actions:**

1. Create `src/videos/storage.service.ts` — `StorageService` wrapping the `minio` client: `initiateMultipartUpload(key)`, `presignPartUpload(key, uploadId, partNumber)`, `completeMultipartUpload(key, uploadId, parts)` (per `phase-03-videos/TD-02`)
2. Create `src/videos/dto/create-video.dto.ts` — `CreateVideoDto` with `@IsString() originalFilename` and `@IsString() contentType`, both required
3. Create `src/videos/videos.controller.ts` and `src/videos/videos.service.ts` — implement `POST /videos` (`### API Contracts`): create a `draft` `Video` row, call `storageService.initiateMultipartUpload`, persist the returned `uploadId`, return `{ id, uploadId }`
4. Implement `GET /videos/:id/parts/:partNumber` (`### API Contracts`): verify the requester's channel owns the video (`### Authorization Matrix`) and the video is `draft` (`VIDEO_NOT_IN_DRAFT` otherwise), then return `{ url }` from `storageService.presignPartUpload`
5. Wire the owner-check as a reusable helper in `VideosService` (`findOwnedOrThrow(videoId, channelId)`) for reuse by later SIs

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosController` | E2E only | `test/videos.e2e-spec.ts` |
| `CreateVideoDto` | E2E: validation wiring | `test/videos.e2e-spec.ts` |
| `StorageService` | Integration: real MinIO, not mocked | `src/videos/storage.service.integration-spec.ts` |

**Dependencies:** SI-03.2

**Acceptance criteria:**

- `POST /videos` with a valid body returns `201` with `id` and `uploadId`, and a `draft` row is persisted with that `id`
- `POST /videos` with a missing `originalFilename` returns `400` with a validation error
- `GET /videos/:id/parts/:partNumber` for a video owned by a different channel returns `403` with `VIDEO_ACCESS_FORBIDDEN`
- `GET /videos/:id/parts/:partNumber` for a video not in `draft` status returns `409` with `VIDEO_NOT_IN_DRAFT`

---

### SI-03.4 — Upload Completion and Processing Job Enqueue

**Description:** Implement the endpoint that finalizes the multipart upload and enqueues the background processing job — the handoff point between "uploaded" and "processing".

**Technical actions:**

1. Create `src/videos/dto/complete-upload.dto.ts` — `CompleteUploadDto` with `parts: { partNumber: number; etag: string }[]`, validated via nested `class-validator` decorators
2. Register the `video-processing` queue via `BullModule.registerQueueAsync` (per `phase-03-videos/TD-01`)
3. Implement `POST /videos/:id/complete` (`### API Contracts`) in `VideosService`: owner + `draft`-status checks (`VIDEO_NOT_IN_DRAFT` otherwise), call `storageService.completeMultipartUpload`, set `storage_key`, flip `status` to `processing`
4. Enqueue the `process-video` job (`### Events/Messages`) with `{ videoId }`, `attempts: 3`, exponential `backoff` (per `phase-03-videos/TD-04`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosController` | E2E only | `test/videos.e2e-spec.ts` |
| `VideosService` | Unit: branch logic (mock repo + queue) | `src/videos/videos.service.spec.ts` |

**Dependencies:** SI-03.3

**Acceptance criteria:**

- `POST /videos/:id/complete` with valid `parts` returns `200` with `status: "processing"` and enqueues exactly one `process-video` job carrying that video's `id`
- `POST /videos/:id/complete` for a video not in `draft` status returns `409` with `VIDEO_NOT_IN_DRAFT`
- `POST /videos/:id/complete` with malformed `parts` returns `400` with a validation error

---

### SI-03.5 — Video Worker: Metadata Extraction and Thumbnail Generation

**Description:** Implement the standalone video worker that consumes `process-video` jobs, extracts duration via ffprobe, generates the thumbnail at the decided timestamp, and updates the video's status.

**Technical actions:**

1. Create `src/worker.ts` — a standalone bootstrap (`NestFactory.createApplicationContext`) sharing `VideosModule`'s DI graph, registering only the queue processor (per `phase-03-videos/TD-03`)
2. Create `src/videos/video.processor.ts` — `@Processor('video-processing')` class extending `WorkerHost`, implementing `async process(job: Job<{ videoId: string }>)`
3. In `process()`: fetch the object from MinIO by `storage_key`, run `ffmpeg.ffprobe` to extract `duration_seconds`, run `.screenshots({ timestamps: ['10%'] })` for the thumbnail (per `thumbnail-frame-selection/TD-01`'s decided 10% policy), upload the thumbnail to `thumbnail_key`, and flip `status` to `ready`
4. On unrecoverable failure (after BullMQ's `attempts`/`backoff` are exhausted), leave `status` as `error` (per `phase-03-videos/TD-04`)
5. Add a worker Dockerfile (extending `Dockerfile.dev` with `ffmpeg` installed via `apt`) and a `worker` service in `compose.yaml` running `node dist/worker.js`

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideoProcessor` | Integration: real MinIO + real Redis/BullMQ, not mocked | `src/videos/video.processor.integration-spec.ts` |

**Dependencies:** SI-03.4

**Acceptance criteria:**

- A `process-video` job for a valid uploaded video updates `duration_seconds` and `thumbnail_key`, and flips `status` to `ready`
- A job for a corrupt/unreadable video exhausts automatic retries and leaves the video in `error` status
- The generated thumbnail is grabbed at 10% of the video's duration, not at timestamp 0

---

### SI-03.6 — Video Status Endpoint and Manual Retry

**Description:** Implement the endpoint clients poll for upload/processing status, and the manual retry endpoint that re-enqueues processing for a failed video without a fresh upload.

**Technical actions:**

1. Implement `GET /videos/:id` (`### API Contracts`) in `VideosService`: owner check, return `{ id, status, originalFilename, durationSeconds, createdAt }`
2. Implement `POST /videos/:id/retry` (`### API Contracts`): owner + `error`-status checks (`VIDEO_NOT_IN_ERROR_STATE` otherwise), increment `retry_count`, flip `status` to `processing`, re-enqueue the `process-video` job (per `phase-03-videos/TD-04`)

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosController` | E2E only | `test/videos.e2e-spec.ts` |

**Dependencies:** SI-03.4

**Acceptance criteria:**

- `GET /videos/:id` for the owning channel returns `200` with the video's current status and metadata
- `GET /videos/:id` for a non-owning channel returns `403` with `VIDEO_ACCESS_FORBIDDEN`
- `POST /videos/:id/retry` on an `error` video returns `200` with `status: "processing"`, increments `retry_count`, and re-enqueues the job
- `POST /videos/:id/retry` on a `ready` video returns `409` with `VIDEO_NOT_IN_ERROR_STATE`

---

### SI-03.7 — Streaming and Download Endpoints

**Description:** Implement the two endpoints that serve a ready video's bytes by redirecting to a presigned storage URL, keeping large-file bytes off the API process entirely.

**Technical actions:**

1. Implement `GET /videos/:id/stream` (`### API Contracts`): owner + `ready`-status checks (`VIDEO_NOT_READY` otherwise), `302` redirect with `Location` set to `storageService.presignedGetObject(storage_key)` (per `phase-03-videos/TD-06`)
2. Implement `GET /videos/:id/download` (`### API Contracts`): same checks, `302` redirect with `Location` set to a presigned GET URL carrying `response-content-disposition: attachment; filename="{originalFilename}"`

**Tests:**

| Artifact | Layer | Test file |
|----------|-------|-----------|
| `VideosController` | E2E only | `test/videos.e2e-spec.ts` |

**Dependencies:** SI-03.5

**Acceptance criteria:**

- `GET /videos/:id/stream` for a `ready` video returns `302` with a `Location` header pointing to a presigned MinIO URL
- `GET /videos/:id/download` for a `ready` video returns `302` with a `Location` header whose target carries a `content-disposition` reflecting the original filename
- `GET /videos/:id/stream` for a video not in `ready` status returns `409` with `VIDEO_NOT_READY`

---

## Technical Specifications

### Data Model

#### Video

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, generated *(per phase-03-videos/TD-05 — reused directly as the public URL identifier)* |
| channel_id | uuid | FK → `channels.id`, not null |
| original_filename | varchar(255) | not null |
| storage_key | varchar(512) | not null — object key of the uploaded original, e.g. `videos/{id}/original.<ext>` *(per phase-03-videos/TD-02)* |
| thumbnail_key | varchar(512) | nullable — populated once processing succeeds, e.g. `videos/{id}/thumbnail.jpg` *(per phase-03-videos/TD-02)* |
| status | enum(`draft`,`processing`,`ready`,`error`) | not null, default `draft` *(per phase-03-videos/TD-04)* |
| duration_seconds | integer | nullable — populated by the worker via ffprobe *(per phase-03-videos/TD-03)* |
| upload_id | varchar(255) | nullable — MinIO multipart `uploadId`, set at upload initiation *(per phase-03-videos/TD-02)* |
| retry_count | integer | not null, default 0 — incremented on each manual retry *(per phase-03-videos/TD-04)* |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | auto-updated |

**Relations:** `Channel` has many `Video` (one-to-many); `Video` belongs to `Channel` (many-to-one), mirroring the `Channel`↔`User` relation pattern already established in `src/channels/entities/channel.entity.ts`.
**Indexes:** index on `channel_id` (video listing per channel, needed by future phases).

### API Contracts

#### POST /videos (SI-03.3)

**Request headers:**
- Content-Type: application/json

**Request body:**
- originalFilename: string, required
- contentType: string, required

**Response 201:**
- id: string (uuid)
- uploadId: string — MinIO multipart upload id *(per phase-03-videos/TD-02)*

**Error responses:**
- 400 validation error: when the request body fails schema validation

---

#### GET /videos/:id/parts/:partNumber (SI-03.3)

**Response 200:**
- url: string — presigned PUT URL for this part, generated via `presignedUrl('PUT', bucket, key, expiry, { uploadId, partNumber })` *(per phase-03-videos/TD-02)*

**Error responses:**
- 404 VIDEO_NOT_FOUND: when `id` does not match any video
- 403 VIDEO_ACCESS_FORBIDDEN: when the authenticated user's channel does not own the video
- 409 VIDEO_NOT_IN_DRAFT: when the video's `status` is not `draft`

---

#### POST /videos/:id/complete (SI-03.4)

**Request headers:**
- Content-Type: application/json

**Request body:**
- parts: array, required — each item: `{ partNumber: number, etag: string }`

**Response 200:**
- id: string (uuid)
- status: string — `processing`

**Error responses:**
- 404 VIDEO_NOT_FOUND
- 403 VIDEO_ACCESS_FORBIDDEN
- 409 VIDEO_NOT_IN_DRAFT: when the video's `status` is not `draft`
- 400 validation error: when `parts` fails schema validation

---

#### GET /videos/:id (SI-03.6)

**Response 200:**
- id: string (uuid)
- status: string — one of `draft`, `processing`, `ready`, `error` *(per phase-03-videos/TD-04)*
- originalFilename: string
- durationSeconds: number, nullable
- createdAt: string (ISO-8601)

**Error responses:**
- 404 VIDEO_NOT_FOUND
- 403 VIDEO_ACCESS_FORBIDDEN

---

#### POST /videos/:id/retry (SI-03.6)

**Response 200:**
- id: string (uuid)
- status: string — `processing`

**Error responses:**
- 404 VIDEO_NOT_FOUND
- 403 VIDEO_ACCESS_FORBIDDEN
- 409 VIDEO_NOT_IN_ERROR_STATE: when the video's `status` is not `error` *(per phase-03-videos/TD-04 — retry only applies to a failed processing attempt)*

---

#### GET /videos/:id/stream (SI-03.7)

**Response 302:** `Location` header set to a short-lived presigned GET URL *(per phase-03-videos/TD-06 — MinIO/S3 `GetObject` implements `Range` natively, so the redirect target serves partial-content requests without API involvement)*. No response body.

**Error responses:**
- 404 VIDEO_NOT_FOUND
- 403 VIDEO_ACCESS_FORBIDDEN
- 409 VIDEO_NOT_READY: when the video's `status` is not `ready`

---

#### GET /videos/:id/download (SI-03.7)

**Response 302:** `Location` header set to a short-lived presigned GET URL with `response-content-disposition: attachment; filename="{originalFilename}"` *(per phase-03-videos/TD-06)*. No response body.

**Error responses:**
- 404 VIDEO_NOT_FOUND
- 403 VIDEO_ACCESS_FORBIDDEN
- 409 VIDEO_NOT_READY: when the video's `status` is not `ready`

### Authorization Matrix

| Endpoint | Anonymous | Authenticated | Owner |
|----------|-----------|---------------|-------|
| POST /videos | ✗ | ✗ | ✓ |
| GET /videos/:id/parts/:partNumber | ✗ | ✗ | ✓ |
| POST /videos/:id/complete | ✗ | ✗ | ✓ |
| GET /videos/:id | ✗ | ✗ | ✓ |
| POST /videos/:id/retry | ✗ | ✗ | ✓ |
| GET /videos/:id/stream | ✗ | ✗ | ✓ |
| GET /videos/:id/download | ✗ | ✗ | ✓ |

**Owner** = the authenticated user's channel matches the video's `channel_id`. Every endpoint is owner-only in this phase — no public/unlisted visibility model exists yet (per `phase-03-videos/TD-06`'s own note: "no visibility rules exist yet at this phase's scope"). Fase 04 introduces `visibilidade pública/unlisted`, and Fase 05 introduces anonymous playback (`Acesso anônimo à visualização de vídeos`) — both explicitly out of this phase's scope per `docs/project-plan.md`. Streaming/download are deliberately not opened to "any authenticated user" to avoid inventing an access model this phase doesn't own.

### Error Catalog

| errorCode | HTTP | Trigger |
|-----------|------|---------|
| VIDEO_NOT_FOUND | 404 | Referenced `id` does not match any video |
| VIDEO_ACCESS_FORBIDDEN | 403 | Authenticated user's channel does not own the referenced video |
| VIDEO_NOT_IN_DRAFT | 409 | Part-presign or complete-upload requested while `status` is not `draft` |
| VIDEO_NOT_IN_ERROR_STATE | 409 | Retry requested while `status` is not `error` |
| VIDEO_NOT_READY | 409 | Stream or download requested while `status` is not `ready` |

Error response shape follows the `{ statusCode, error, message }` envelope already established by `phase-02-auth/TD-07` (Custom Domain Exception Filter) — no new error format is introduced in this phase.

### Events/Messages

#### process-video

**Payload:**

```json
{ "videoId": "uuid" }
```

**Producer:** `VideosService` (per `phase-03-videos/TD-01`) — enqueues on `POST /videos/:id/complete` (SI-03.4) and on `POST /videos/:id/retry` (SI-03.6).
**Consumer:** the video worker's `@Processor('video-processing')` class (per `phase-03-videos/TD-03`).
**Trigger:** multipart upload completion, or an explicit manual retry of a video in the `error` status.
**Delivery semantics:** at-least-once, with automatic retries — `attempts: 3`, exponential `backoff` (per `phase-03-videos/TD-04`) — before the video is left in `error` status awaiting a manual retry.

---

<!-- phase-a-complete -->

## Dependency Map

```
SI-03.1 (root)
└── SI-03.2 — depends on SI-03.1 (entity needs config/infra first)
    └── SI-03.3 — depends on SI-03.2 (upload endpoints need the entity)
        └── SI-03.4 — depends on SI-03.3 (completion needs initiation)
            ├── SI-03.5 — depends on SI-03.4 (worker consumes the enqueued job)
            │   └── SI-03.7 — depends on SI-03.5 (streaming/download need a worker-produced ready video)
            └── SI-03.6 — depends on SI-03.4 (status/retry need the queue wiring in place)
```

---

## Deliverables

- [x] SI-03.1 — Dependencies, Configuration, and Docker Compose Additions
- [x] SI-03.2 — Video Entity and Migration
- [x] SI-03.3 — Upload Initiation and Part Presigning
- [x] SI-03.4 — Upload Completion and Processing Job Enqueue
- [x] SI-03.5 — Video Worker: Metadata Extraction and Thumbnail Generation
- [x] SI-03.6 — Video Status Endpoint and Manual Retry
- [x] SI-03.7 — Streaming and Download Endpoints

**Full test suites** (per `nestjs-project/CLAUDE.md` — every command runs inside the container):

- [x] Backend unit + integration tests pass (`docker compose exec nestjs-api npm test -- --runInBand`)
- [x] E2E tests pass (`docker compose exec nestjs-api npm run test:e2e`)
- [x] Type-check passes (`docker compose exec nestjs-api npx tsc --noEmit`)
- [x] Lint passes (`docker compose exec nestjs-api npm run lint`)
- [x] `docker compose ps` shows `nestjs-api`, `db`, `mailpit`, `redis`, `minio`, and the `worker` service all healthy/running
