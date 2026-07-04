---
libs:
  "@nestjs/bullmq":
    version: "^11.0.0"
    context7_id: "/nestjs/bull"
    fetched_at: "2026-07-03T17:45:00+01:00"
  "bullmq":
    version: "^5.x"
    context7_id: "/taskforcesh/bullmq"
    fetched_at: "2026-07-03T17:45:00+01:00"
  "minio":
    version: "^8.x"
    context7_id: "/minio/minio-js"
    fetched_at: "2026-07-03T17:45:00+01:00"
  "fluent-ffmpeg":
    version: "^2.1.x"
    context7_id: "/thedave42/node-fluent-ffmpeg"
    fetched_at: "2026-07-03T17:45:00+01:00"
sources_mtime:
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-07-03T17:36:23+01:00"
  docs/decisions/technical-decisions-thumbnail-frame-selection.md: "2026-07-03T17:36:54+01:00"
---

# Library References — Phase 03 Videos

### @nestjs/bullmq

Decided in `phase-03-videos/TD-01` (Background Job Queue Technology, Option A) and used by `phase-03-videos/TD-03` (the worker consumes the same queue).

**Module registration** (mirrors this project's existing `ConfigModule`-based async registration pattern from Phase 01):

```typescript
BullModule.forRootAsync({
  imports: [ConfigModule],
  inject: [queueConfig.KEY],
  useFactory: (config: ConfigType<typeof queueConfig>) => ({
    connection: { host: config.host, port: config.port },
  }),
});

BullModule.registerQueueAsync({
  name: 'video-processing',
  useFactory: () => ({}),
});
```

**Producer side (API)** — inject with `@InjectQueue('video-processing')` and call `queue.add('process-video', { videoId })`.

**Consumer side (worker)** — `@Processor('video-processing')` class extends `WorkerHost`, implements `async process(job: Job)`. `@OnWorkerEvent('completed')` / `('failed')` for lifecycle hooks. Concurrency and other `WorkerOptions` pass as the decorator's second argument.

### bullmq

Underlying queue library `@nestjs/bullmq` wraps. Directly relevant for `phase-03-videos/TD-04`'s retry/backoff decision:

```typescript
await queue.add(
  'process-video',
  { videoId },
  { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
);
```

`job.updateProgress(n)` is available inside the worker's `process()` for future progress reporting if needed. Automatic retries (via `attempts`/`backoff`) are the first line of defense before TD-04's manual retry endpoint kicks in.

### minio

Decided in `phase-03-videos/TD-02` (10GB upload strategy, Option B — presigned multipart) and `phase-03-videos/TD-06` (streaming/download, Option B — presigned GET redirect).

**Multipart upload flow** (server issues presigned URLs per part, client uploads directly, server completes):

```typescript
// 1. Server-side: initiate (authenticated call, not presigned)
const uploadId = await minioClient.initiateNewMultipartUpload(bucket, key, headers);

// 2. Per part: server issues a presigned PUT URL for the client
const partUrl = await minioClient.presignedUrl('PUT', bucket, key, expirySeconds, {
  uploadId,
  partNumber,
});

// 3. Client PUTs each part directly to MinIO using partUrl, collects ETags.

// 4. Server-side: complete (authenticated call)
const { etag } = await minioClient.completeMultipartUpload(bucket, key, uploadId, [
  { part: 1, etag: 'etag-from-client' },
  // ...
]);
```

**Streaming/download (TD-06)** — presigned GET redirect, with `response-content-disposition` override for downloads:

```typescript
// Streaming (playback): plain presigned URL, MinIO/S3 handles Range natively
const streamUrl = await minioClient.presignedGetObject(bucket, key, 3600);

// Download: force attachment filename via response header override
const downloadUrl = await minioClient.presignedGetObject(bucket, key, 3600, {
  'response-content-disposition': `attachment; filename="${filename}"`,
});
```

### fluent-ffmpeg

Decided in `phase-03-videos/TD-03` (worker tooling, Option A) and parameterized by `thumbnail-frame-selection/TD-01` (fixed 10% timestamp).

**Metadata/duration extraction:**

```typescript
ffmpeg.ffprobe(filePath, (err, metadata) => {
  const duration = metadata.format.duration; // seconds
});
```

**Thumbnail generation at a fixed percentage** (per `thumbnail-frame-selection/TD-01`'s decided 10% policy):

```typescript
ffmpeg(filePath)
  .screenshots({
    timestamps: ['10%'],
    filename: 'thumbnail.jpg',
    folder: outputDir,
  })
  .on('end', () => { /* thumbnail written */ })
  .on('error', (err) => { /* handle */ });
```

Percentage timemarks require the input to be a file path (not a stream) — `fluent-ffmpeg` internally probes duration via `ffprobe` to resolve the percentage before seeking, consistent with already downloading/having the uploaded file available to the worker.
