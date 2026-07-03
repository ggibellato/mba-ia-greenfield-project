---
scope_type: ad-hoc
related_phases: [3]
status: pending
date: 2026-07-03
scope_description: "Which video frame/timestamp the automatic thumbnail generation grabs, narrowing phase-03-videos/TD-03 (worker + ffmpeg tooling already decided, but not this parameter)"
---

# Technical Decisions — Thumbnail Frame Selection

_Subprojects in scope:_

- `nestjs-project/` — the video worker (per `phase-03-videos/TD-03`) grabs the frame during processing. This is the only subproject with an open decision here.
- `next-frontend/` — no open decision. Thumbnail *consumption* (rendering) belongs to a future phase's UI; this document is about *generation* only, which happens entirely server-side.

---

## TD-01: Thumbnail Frame/Timestamp Selection Policy

**Scope:** Backend

**Capability:** Geração automática de thumbnail a partir de um frame do vídeo

**Context:** `phase-03-videos/TD-03` already decided *how* the thumbnail is technically generated (ffmpeg via `fluent-ffmpeg`'s `.screenshots()` method, run inside the video worker), but not *which* frame/timestamp to grab. This was flagged as `MD-1` by `/plan-validate 03` because the capability's own wording ("a partir de um frame") leaves the specific frame open, and a naive "always grab frame 0" policy commonly produces a blank/black thumbnail in real videos (intros, fade-ins, black leader frames are common at timestamp 0).

**Options:**

### Option A: Fixed percentage into the video (e.g., 10%)
- `fluent-ffmpeg` accepts percentage timestamps natively (`.screenshots({ timestamps: ['10%'] })`). The offset scales with the video's own duration, so it never depends on an absolute second count.
- **Pros:** Deterministic and simple — one config value, no extra processing pass. Scales correctly for any video length (a 30-second clip and a 2-hour video both skip their respective "into the video" fraction). Reliably clears timestamp-0 issues (black leader frames, fade-ins) since 10% into even a very short video is still past frame 0.
- **Cons:** Doesn't guarantee the frame is visually "interesting" — could still occasionally land on a transition or a mostly-static frame. Purely positional, no content awareness.

### Option B: Fixed time offset in seconds (e.g., 3s)
- `.screenshots({ timestamps: [3] })` grabs the frame at an absolute 3-second mark regardless of total duration.
- **Pros:** Simple, same rationale as Option A for avoiding frame 0.
- **Cons:** Breaks the "avoid the intro" goal at the extremes: for a 2-hour video, 3 seconds in is still deep in an intro/logo sequence; for a video shorter than 3 seconds (a legitimate short clip on a video platform), the timestamp doesn't exist and ffmpeg would need a fallback. A percentage-based approach doesn't have this edge case by construction.

### Option C: Content-aware frame selection (ffmpeg scene-detection filter)
- Use ffmpeg's `select` filter with scene-change detection (e.g., `select='gt(scene,0.4)'`) to pick a frame following a significant visual change, approximating a more "representative" frame — closer to what large platforms like YouTube do.
- **Pros:** Most likely to produce a genuinely representative, non-blank thumbnail.
- **Cons:** Meaningfully more complex ffmpeg invocation, less deterministic (harder to unit-test — the exact frame chosen depends on the video's content, not a fixed rule), and typically requires decoding more of the stream to evaluate scene changes, adding worker processing time. Disproportionate for this phase's literal requirement ("geração automática de thumbnail a partir de um frame do vídeo" — automatic generation from a frame, not "the single best frame").

**Recommendation:** **Option A (Fixed percentage, 10%)** — clears the frame-0 black-frame problem that motivated this research in the first place, scales correctly across the full range of video lengths this platform allows (unlike Option B's fixed-second offset, which has a hard failure mode for short videos), and stays deterministic and cheap to test — a single fixed parameter passed to the already-decided `fluent-ffmpeg` call, with no new dependency or processing pass. Option C's content-awareness is real but disproportionate to what this phase's capability actually requires.

**Decision:** _[pending]_

---

## Decisions Summary

| ID | Scope | Decision | Recommendation | Choice |
|----|-------|----------|---------------|--------|
| TD-01 | Backend | Thumbnail Frame/Timestamp Selection Policy | Fixed percentage (10%) | _[pending]_ |
