---
kind: phase
name: phase-03-videos
status: dirty
issue_count: 7
sources_mtime:
  docs/phases/phase-03-videos/context.md: "2026-07-03T16:18:16+01:00"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-07-03T14:22:54+01:00"
issues:
  - id: MD-1
    status: open
    summary: "No TD decides which video frame/timestamp is used for automatic thumbnail generation"
  - id: OQ-1
    status: open
    summary: "TD-01 (Background Job Queue Technology) pending"
  - id: OQ-2
    status: open
    summary: "TD-02 (Video Upload Strategy for Files up to 10GB) pending"
  - id: OQ-3
    status: open
    summary: "TD-03 (Worker Execution Model & Video Processing Tooling) pending"
  - id: OQ-4
    status: open
    summary: "TD-04 (Video Status Lifecycle & Failure Handling) pending"
  - id: OQ-5
    status: open
    summary: "TD-05 (Unique Video URL Strategy) pending"
  - id: OQ-6
    status: open
    summary: "TD-06 (Video Streaming & Download Serving Strategy) pending"
---

# phase-03-videos — Validation

## Findings

### Inconsistencies

_None._

### Ambiguities

_None._

### Missing Decisions

- **MD-1** — Capability "Geração automática de thumbnail a partir de um frame do vídeo" is covered by phase-03-videos/TD-03 for *how* the thumbnail is generated (ffmpeg `.screenshots()` via `fluent-ffmpeg`), but no TD or Recommendation prose decides *which* frame/timestamp is used (e.g., a fixed percentage into the video, a fixed second offset, or the first non-black frame) — the capability's own wording ("a partir de um frame") leaves this open, and a naive first-frame grab is often blank/black in real videos. Explicit choice: extend TD-03 (or add a small parameter note to its Recommendation) specifying the timestamp/percentage policy, then re-run `/plan-validate 03`.

### Dependency Gaps

_None._

### Inherited Constraint Conflicts

_None._

### Unresolved Open Questions

- **OQ-1** — TD-01 pending — Background Job Queue Technology. Resolution: fill the **Decision:** field of TD-01 in `docs/decisions/technical-decisions-phase-03-videos.md`, then re-run `/plan-validate 03`.
- **OQ-2** — TD-02 pending — Video Upload Strategy for Files up to 10GB. Resolution: fill the **Decision:** field of TD-02 in `docs/decisions/technical-decisions-phase-03-videos.md`, then re-run `/plan-validate 03`.
- **OQ-3** — TD-03 pending — Worker Execution Model & Video Processing Tooling. Resolution: fill the **Decision:** field of TD-03 in `docs/decisions/technical-decisions-phase-03-videos.md`, then re-run `/plan-validate 03`.
- **OQ-4** — TD-04 pending — Video Status Lifecycle & Failure Handling. Resolution: fill the **Decision:** field of TD-04 in `docs/decisions/technical-decisions-phase-03-videos.md`, then re-run `/plan-validate 03`.
- **OQ-5** — TD-05 pending — Unique Video URL Strategy. Resolution: fill the **Decision:** field of TD-05 in `docs/decisions/technical-decisions-phase-03-videos.md`, then re-run `/plan-validate 03`.
- **OQ-6** — TD-06 pending — Video Streaming & Download Serving Strategy. Resolution: fill the **Decision:** field of TD-06 in `docs/decisions/technical-decisions-phase-03-videos.md`, then re-run `/plan-validate 03`.

### UI Coverage Gaps

_None._ (No UI scope for this phase — `## UI Inventory` is absent from `context.md` by design.)

## Resolved Issues

_No issues resolved yet._
