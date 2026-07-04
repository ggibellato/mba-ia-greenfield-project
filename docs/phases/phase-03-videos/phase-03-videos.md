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

<!-- SIs will be written in Phase B -->

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

<!-- Dep Map will be written in Phase B -->

---

## Deliverables

<!-- Deliverables will be written in Phase B -->
