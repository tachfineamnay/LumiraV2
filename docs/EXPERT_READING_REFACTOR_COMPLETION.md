# Expert Reading Refactor — Completion

## Final workflow

1. The expert opens a paid order in the existing Studio route.
2. A single preparation screen exposes the essential dossier and one expert orientation.
3. Production runs asynchronously through the managed reading queue.
4. SCRIBE generates the structured reading and EDITOR performs the configured quality pass.
5. The expert reviews canonical JSON blocks rather than a global HTML document.
6. Every block update uses an optimistic `readingRevision` guard.
7. Quality issues remain visible beside the reading and block delivery when structural defects remain.
8. PDF preview compiles the real template without S3 upload, email or delivery record.
9. Seal uses the structured reading, creates the immutable ReadingVersion, then delivers PDF, email and audio.

## Canonical API

- `GET /expert/orders/:id/reading`
- `POST /expert/orders/:id/reading/generate`
- `PATCH /expert/orders/:id/reading/draft`
- `PATCH /expert/orders/:id/reading/blocks/:blockId`
- `POST /expert/orders/:id/reading/blocks/:blockId/revise`
- `POST /expert/orders/:id/reading/quality/repair`
- `POST /expert/orders/:id/reading/preview`
- `POST /expert/orders/:id/reading/seal`
- `POST /expert/orders/:id/reading/reopen`
- `GET /expert/orders/:id/reading/history`

## Removed UI residue

- three-step Dossier / Briefing / Revision wizard;
- duplicate permanent client panels;
- global Tiptap document used as the PDF source of truth;
- persistent free-form AI assistant sidebar;
- manual Kanban drag-and-drop for backend-controlled states;
- separate version and delivery drawers.

## Compatibility retained

Legacy endpoints and persisted HTML drafts remain readable during the transition. They are no longer used by the new Desk workflow and can be removed only after production telemetry confirms that no external client still calls them.

No Prisma migration is required. Existing ReadingVersion, DeliveryRecord, S3 objects and historical generatedContent are preserved.

## State machine

- `PAID -> PROCESSING`
- `FAILED -> PROCESSING`
- `PROCESSING -> AWAITING_VALIDATION`
- `AWAITING_VALIDATION -> COMPLETED`
- `COMPLETED -> AWAITING_VALIDATION` through explicit reopen

The frontend does not write order status directly.

## Rollback

The pre-refactor application state is preserved on:

`backup/expert-reading-refactor-post-prompt4`

Rollback the application ref to that branch if the structured workspace must be withdrawn. Database and S3 rollback are unnecessary because this refactor does not introduce a schema migration or destructive data operation.

## Deferred cleanup

The legacy controller methods remain intentionally available as compatibility wrappers. Remove them in a later release only after access logs show zero use for a full observation window.
