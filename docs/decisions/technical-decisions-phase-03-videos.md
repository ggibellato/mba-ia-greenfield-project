---
scope_type: phase
related_phases: [3]
status: decided
date: 2026-07-03
scope_description: "Object storage usage, background job queue, video worker (ffmpeg), 10GB upload strategy, unique video URLs, and streaming/download serving for Fase 03 — Upload e Processamento de Vídeos."
---

# Technical Decisions — Phase 03: Upload e Processamento de Vídeos

_Subprojects in scope:_

- `nestjs-project/` — receives the new `videos` module: object storage client, background queue integration, video worker process, migration for the `videos` table, and the upload/streaming/download endpoints. All decisions below apply here.
- `next-frontend/` — no open decision. Per `docs/exercise.md`, the video upload/playback UI is explicitly out of scope for this phase ("Há um frontend no repositório, mas a interface de vídeo não faz parte do escopo desta fase"); those screens belong to Fase 04 (gerenciamento de vídeos) and Fase 05 (página de visualização).

---

## TD-01: Background Job Queue Technology

**Scope:** Backend

**Capability:** Serviço de processamento em segundo plano (filas)

**Context:** `docs/project-plan.md` leaves the queue technology explicitly open ("TBD") — it's the one genuinely undecided piece of stack in this phase. Video processing jobs (metadata extraction + thumbnail generation) are long-running and must run outside the request/response cycle, decoupling the upload confirmation from processing completion. The choice determines what new infrastructure this phase adds to `compose.yaml` and how the worker (TD-03) consumes jobs.

**Options:**

### Option A: BullMQ (Redis-backed) via `@nestjs/bullmq`
- Redis-backed queue with a first-party NestJS module (`@nestjs/bullmq`). Producers use `Queue.add()`; consumers extend `WorkerHost` under a `@Processor()` class, runnable as a distinct process while still sharing the app's DI graph (entities, config, repositories).
- **Pros:** Native NestJS integration matches this project's existing preference for framework-idiomatic modules (`@nestjs/jwt`, `@nestjs/throttler`). Built-in retry with exponential backoff, per-job concurrency control, and an optional dashboard (Bull Board) for observing stuck video jobs during development.
- **Cons:** Adds Redis as new infrastructure (new Compose service, new failure mode to operate).

### Option B: pg-boss (PostgreSQL-backed)
- Queue implemented entirely on top of PostgreSQL (`pgboss` schema), using `boss.send()` / `boss.work()`. Exactly-once delivery, built-in dead-letter queues with `redrive()`, and cron-style scheduling.
- **Pros:** No new infrastructure — reuses the already-running `db` Postgres service. Job creation can share the same DB transaction as the video draft insert (`send()` accepts a `db` client override), giving transactional exactly-once enqueue for free.
- **Cons:** No official NestJS module — DI wiring (module lifecycle, `onModuleInit`/`onModuleDestroy` for `boss.start()`/`stop()`) is hand-rolled. Adds polling/notification load to the same Postgres instance serving the application's primary data.

### Option C: RabbitMQ via `@golevelup/nestjs-rabbitmq`
- Dedicated message broker with a community NestJS wrapper providing pub/sub and RPC decorators, connection resilience, and message batching.
- **Pros:** Purpose-built message broker, decoupled from both the app's cache and primary DB. Mirrors the "Message Queue" container already named in `docs/diagrams/software-arch.mermaid`.
- **Cons:** Heaviest new infrastructure of the three (a full broker, not just a client library). `@golevelup/nestjs-rabbitmq` is community-maintained (not `@nestjs`-official), a step down in maintenance guarantee from Option A. No retry/backoff semantics as ready-made as BullMQ's — must be composed manually via dead-letter exchanges.

**Recommendation:** **Option A (BullMQ via `@nestjs/bullmq`)** — the first-party NestJS module keeps this phase consistent with the project's established pattern of choosing framework-native integrations over generic alternatives (mirroring `@nestjs/jwt` and `@nestjs/throttler` in Phase 02), and its `WorkerHost`/`@Processor` pattern is exactly the mechanism TD-03 needs to run the worker as a separate container while still sharing the app's TypeORM entities and config. Redis is a real new dependency, but it is a single well-understood, single-purpose service — a smaller operational surface than a full broker (Option C), and it isolates job-queue load from the primary Postgres instance (unlike Option B).

**Decision:** A (BullMQ via `@nestjs/bullmq`)
**Libraries:** @nestjs/bullmq, bullmq

---

## TD-02: Video Upload Strategy for Files up to 10GB

**Scope:** Backend

**Capability:** Transversal — covers: "Serviço de armazenamento de arquivos (vídeos e thumbnails)", "Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance"

**Context:** The object storage technology itself is fixed by the exercise (S3-compatible — MinIO locally, swappable for S3 in production); what's open is how the API lets a client move up to 10GB into it without the file ever passing through the NestJS process (the exercise explicitly forbids this — it's the automatic-failure condition in `docs/exercise.md`'s reprova list). Verified against the MinIO JS client (`minio-js`) docs: a single presigned `PUT` (`presignedPutObject`) is capped by the S3 API itself at 5GB per object — below this phase's 10GB requirement, not just a performance concern.

**Options:**

### Option A: Single presigned PUT (`presignedPutObject`)
- API creates the draft video row, generates one presigned PUT URL for the whole file, and returns it to the client, which uploads directly to MinIO with a single HTTP PUT.
- **Pros:** Simplest to implement — one URL, one request, no part bookkeeping.
- **Cons:** S3-compatible single-PUT objects are capped at 5GB — cannot satisfy this phase's 10GB requirement at all, regardless of performance tuning. Not resumable — any connection drop during a multi-GB transfer restarts the whole upload.

### Option B: Presigned multipart upload
- API calls `initiateNewMultipartUpload` (server-side, authenticated), then issues one presigned PUT URL per part (`presignedUrl('PUT', bucket, key, expiry, { uploadId, partNumber })`) for the client to upload in parallel/sequentially, and finally calls `completeMultipartUpload` with the returned ETags once every part lands.
- **Pros:** No per-object size cap in practice (S3 multipart supports up to 5TB, parts up to 5GB each) — comfortably covers 10GB. Resumable: a failed part can be re-uploaded without restarting the whole file. Parts can upload in parallel, improving effective throughput for large files.
- **Cons:** More moving parts to implement and test — the API must track `uploadId` and part ETags, and handle abandoned multipart uploads (stale parts consuming storage) via a cleanup policy.

### Option C: Proxy upload through the NestJS API (streamed, not buffered)
- Client uploads to a NestJS endpoint; the controller streams the incoming request body directly into MinIO's `putObject` without buffering to memory or disk.
- **Pros:** Single endpoint, no client-side multipart orchestration.
- **Cons:** Directly contradicts the exercise's explicit constraint — even a streamed (non-buffered) proxy ties up an API request/connection/worker thread for the full duration of a 10GB transfer, which is exactly the "impacto na performance" this phase must avoid. This is the class of solution `docs/exercise.md` calls out as the wrong path.

**Recommendation:** **Option B (Presigned multipart upload)** — Option A is disqualified outright by the 5GB single-PUT ceiling, and Option C is the literal anti-pattern the exercise warns against. Multipart is also the standard, actually-tested-at-scale approach for this exact problem (S3/MinIO's own multipart API exists specifically for uploads that exceed comfortable single-request size). Object keys should follow a simple, collision-free scheme keyed by the video's own UUID (e.g. `videos/{videoId}/original.<ext>` and `videos/{videoId}/thumbnail.jpg` in one bucket) — this reuses the entity's own unique identifier (see TD-05) rather than inventing a second naming scheme.

**Decision:** B (Presigned multipart upload)
**Libraries:** minio

---

## TD-03: Worker Execution Model & Video Processing Tooling

**Scope:** Backend

**Capability:** Transversal — covers: "Serviço de processamento em segundo plano (filas)", "Processamento automático do vídeo após upload (extração de duração e metadados)", "Geração automática de thumbnail a partir de um frame do vídeo"

**Context:** `docs/diagrams/software-arch.mermaid` already names a "Video Worker (FFmpeg)" as its own container — that part isn't in question. What's open is how that worker is implemented within the monorepo and how it drives `ffmpeg`/`ffprobe` to extract duration/metadata and generate a thumbnail frame. Depends on TD-01 (queue technology) — the worker's consumption pattern follows whichever queue library is chosen there.

**Options:**

### Option A: NestJS standalone worker app + `fluent-ffmpeg`
- A second bootstrap entry point in `nestjs-project/` (`NestFactory.createApplicationContext`) runs the same DI graph as the API — entities, config, TypeORM repositories — but only registers the `@Processor()`/`WorkerHost` class from `@nestjs/bullmq` (TD-01) instead of HTTP controllers. `fluent-ffmpeg` wraps the `ffmpeg`/`ffprobe` CLI binaries (installed via `apt` in a dedicated worker Dockerfile, extending the existing `node:25.6.0-slim` base) for `ffmpeg.ffprobe()` (duration/metadata) and `.screenshots()` (thumbnail frame extraction).
- **Pros:** Reuses every existing repository/entity/config class as-is — no parallel data-access layer to keep in sync with the API. `fluent-ffmpeg` is a thin, well-documented wrapper around the actual `ffmpeg`/`ffprobe` binaries, not a reimplementation.
- **Cons:** Ships the full Nest DI container in the worker image even though it only needs a slice of it (module design must exclude HTTP-only providers from the worker's bootstrap module).

### Option B: Plain Node.js worker script (no NestJS)
- A standalone script using `bullmq`'s `Worker` class directly, with its own hand-built `DataSource` for DB reads/writes, same `fluent-ffmpeg` usage for processing.
- **Pros:** Smaller runtime footprint — no NestJS module resolution overhead.
- **Cons:** Duplicates entity definitions and repository-style DB access outside NestJS's DI, or awkwardly imports NestJS-decorated entities into a non-NestJS context — diverges from every other part of this project's data-access pattern (`nestjs-entities.md`, `typeorm` rules), for a footprint saving that doesn't matter at video-processing timescales (seconds to minutes per job).

### Option C: Managed/cloud video-processing API
- Trigger a third-party transcoding/thumbnail service (e.g., a cloud media API) from the same queue job, instead of self-hosted `ffmpeg`.
- **Pros:** No `ffmpeg` binary or worker container to operate.
- **Cons:** External network dependency and (typically) a paid API for something fully achievable locally; breaks the project's local-Docker-first posture (MinIO instead of real S3, Mailpit instead of a real SMTP provider) for no stated requirement to use a cloud service here.

**Recommendation:** **Option A (NestJS standalone worker app + `fluent-ffmpeg`)** — sharing the API's entities and repositories avoids maintaining a second, drifting data-access layer (Option B's core cost), and self-hosted `ffmpeg` fits the project's established pattern of running real infrastructure locally in Compose rather than depending on external paid services (Option C), consistent with the exercise's own instruction not to mock/skip infrastructure that can run for real.

**Decision:** A (NestJS standalone worker app + `fluent-ffmpeg`)
**Libraries:** fluent-ffmpeg

---

## TD-04: Video Status Lifecycle & Failure Handling

**Scope:** Backend

**Capability:** Transversal — covers: "Pré-cadastro automático do vídeo como rascunho ao iniciar o upload", "Processamento automático do vídeo após upload (extração de duração e metadados)"

**Context:** The video record is pre-created as a draft the moment upload begins (before any bytes land in storage) and moves through processing to a terminal state. This TD defines the status enum's transitions and — since processing (TD-03) can fail (corrupt file, unsupported codec, worker crash) — what happens next. Depends on TD-01 (queue's own retry mechanics) and TD-03 (what can fail).

**Options:**

### Option A: Linear enum + queue-native automatic retries only
- Statuses: `draft` → `processing` → `ready` / `error`. On processing failure, the queue's own retry policy (e.g., BullMQ's `attempts` + `backoff`) re-runs the job a fixed number of times; after the last attempt fails, the video is marked `error` permanently. Recovery requires deleting and re-uploading.
- **Pros:** Simplest to implement — no extra endpoint, failure handling lives entirely in queue configuration.
- **Cons:** A transient failure (e.g., a worker container restart mid-job) forces the user to re-upload the entire file even though it's already durably stored in MinIO — wasteful and poor UX for a 10GB asset.

### Option B: Linear enum + queue-native retries + manual retry endpoint
- Same status enum as Option A, but a terminal `error` video can be re-enqueued via an explicit endpoint (e.g. `POST /videos/:id/retry`) that reuses the already-uploaded file from storage — no new upload needed.
- **Pros:** The original file is already sitting in MinIO, so a retry is nearly free to offer and avoids forcing a fresh 10GB transfer over a transient failure. Automatic queue retries (from Option A) still absorb most transient errors first; the endpoint is only a fallback for the small number of jobs that exhaust automatic attempts.
- **Cons:** One additional endpoint and authorization check (only the owning channel may retry its own video) to design and test.

### Option C: Formal state-machine library
- Model transitions with a dedicated FSM package instead of a plain enum column, enforcing valid transitions at the type level.
- **Pros:** Guards against invalid transitions being written by a future bug (e.g., `ready` → `draft`).
- **Cons:** No prior FSM precedent anywhere in this project (Phases 01–02 use plain enum/status columns); for 3–4 linear states with no branching, this is ceremony the (d)+(a) test would flag as unwarranted — a Postgres `enum` column plus service-layer checks (already the project's pattern) covers the same guarantee.

**Recommendation:** **Option B (Linear enum + automatic retries + manual retry endpoint)** — reusing the durably-stored file on retry is a direct, low-cost improvement over forcing a full re-upload (Option A), and it layers on top of (rather than replaces) the queue's own automatic retry behavior. Option C's added structure isn't justified by this phase's transition complexity, which is a straight line with one failure exit.

**Decision:** B (Linear enum + automatic retries + manual retry endpoint)
**Libraries:** —

---

## TD-05: Unique Video URL Strategy

**Scope:** Backend

**Capability:** URL única por vídeo, sem conflito com outros vídeos

**Context:** Every video needs a public-facing identifier (used in upload confirmation, streaming, and download routes) that is guaranteed never to collide with another video's. `nestjs-entities.md` already mandates UUID primary keys (`@PrimaryGeneratedColumn('uuid')`) for every entity in this project, including the forthcoming `videos` table.

**Options:**

### Option A: Reuse the entity's UUID primary key as the public identifier
- Routes address a video directly by its PK, e.g. `/videos/{uuid}/stream`. Uniqueness is the same guarantee Postgres already enforces on the PK.
- **Pros:** Zero extra columns, generation logic, or collision handling — uniqueness comes from a constraint the database already enforces. Consistent with every other entity in the project (`Channel`, `User`), none of which have a separate system-generated public slug distinct from their PK.
- **Cons:** UUIDs are long (36 characters) and visually indistinct compared to short platform-style codes — a cosmetic concern only, not a functional gap against the stated requirement ("sem conflito").

### Option B: Separate short unique code (e.g., `nanoid`) in a dedicated column
- Generate an 8–11 character random code at video creation, stored in a uniquely-indexed column decoupled from the PK.
- **Pros:** Shorter, more shareable URLs (YouTube-style).
- **Cons:** New dependency, new column, and insert-time collision-retry logic, all for a cosmetic benefit; `Channel.nickname` is not a precedent for this — it's a human-chosen handle, not a system-generated collision-avoidant ID.

### Option C: Sequential integer identifier
- Auto-incrementing integer exposed directly in the URL.
- **Pros:** Shortest possible URLs.
- **Cons:** Predictable/enumerable — lets any client guess adjacent video IDs, which undermines the "unlisted" visibility Fase 04 plans to add on top of this phase's data model. Also diverges from the UUID-PK convention used everywhere else in the project.

**Recommendation:** **Option A (reuse the UUID primary key)** — `nestjs-entities.md` already mandates UUID PKs project-wide; reusing it as the public identifier costs nothing new and inherits the same non-conflict guarantee the database already provides, rather than introducing a second identifier concept with no functional justification. A short-code layer (Option B) is a purely additive change that can be introduced later without breaking this phase's contract, if ever desired.

**Decision:** A (reuse the UUID primary key)
**Libraries:** —

---

## TD-06: Video Streaming & Download Serving Strategy

**Scope:** Backend

**Capability:** Transversal — covers: "Reprodução via streaming (sem necessidade de download completo)", "Download do vídeo pelo usuário"

**Context:** Streaming playback needs HTTP `Range` request support (`206 Partial Content`); download needs a full-file transfer with `Content-Disposition: attachment`. The decision is whether the NestJS API proxies the bytes itself or hands the client off to talk to MinIO directly. Depends on TD-02 — the same "don't route big payloads through the API" reasoning that ruled out the upload proxy applies symmetrically to serving.

**Options:**

### Option A: API proxies the bytes
- The controller parses the `Range` header, calls MinIO's ranged `getObject`, and pipes the resulting stream back with `206`/`Content-Range` headers; a download request without `Range` streams the full object with `Content-Disposition: attachment`.
- **Pros:** Every byte served passes through the API, so authorization/visibility can be re-checked per request.
- **Cons:** Ties up an API connection/process for the full duration of every playback session and every download, for a 10GB-capable asset class — the same performance risk this phase's upload strategy was designed to avoid, now on the read path.

### Option B: Redirect to a presigned GET URL
- The controller issues a short-lived `presignedGetObject` URL (with a `response-content-disposition` override for downloads) and responds with a redirect (or returns the URL for the client's `<video src>`/download link to use directly). MinIO/S3 natively implements `Range` on `GetObject` — no reimplementation needed.
- **Pros:** Keeps large-file bytes off the NestJS process entirely, mirroring TD-02's upload approach. Range support comes for free from the S3 API itself. Needs only one additional MinIO client call per request.
- **Cons:** A presigned URL, once issued, doesn't re-check the video's status/visibility again during its (short) validity window — acceptable here since Phase 03 doesn't yet implement per-video visibility rules (that's Fase 04's public/unlisted split); the check still happens once, at issuance.

### Option C: Hybrid — proxy for streaming, redirect for download
- Use Option A's per-chunk proxying for streaming (finer-grained control) but Option B's redirect for plain downloads.
- **Pros:** Streaming gets per-chunk authorization; downloads stay off the API.
- **Cons:** Two different serving code paths to build, test, and reason about, for a benefit (per-chunk re-authorization during streaming) that Option B's short URL expiry already covers adequately at this phase's scope.

**Recommendation:** **Option B (Redirect to a presigned GET URL)** — S3-compatible `GetObject` already implements `Range` as a core part of the API, so this option gets working range-based streaming without the API touching video bytes at all, consistent with TD-02's upload strategy and the exercise's general performance constraint. The visibility-check gap during a short-lived URL's validity window is a non-issue at this phase's scope (no visibility rules exist yet) and can be revisited if a future phase's requirements demand tighter per-chunk enforcement.

**Decision:** B (Redirect to a presigned GET URL)
**Libraries:** minio

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Backend | Background Job Queue Technology | BullMQ via `@nestjs/bullmq` | A |
| TD-02 | Backend | Video Upload Strategy for Files up to 10GB | Presigned multipart upload | B |
| TD-03 | Backend | Worker Execution Model & Video Processing Tooling | NestJS standalone worker app + `fluent-ffmpeg` | A |
| TD-04 | Backend | Video Status Lifecycle & Failure Handling | Linear enum + automatic retries + manual retry endpoint | B |
| TD-05 | Backend | Unique Video URL Strategy | Reuse the UUID primary key | A |
| TD-06 | Backend | Video Streaming & Download Serving Strategy | Redirect to a presigned GET URL | B |
