# Publish and prove the real review cycle

Read when the bundle is validated and the user has authorized publishing, or when you must prove the review cycle in the real viewer.

1. After confirming the authorized destination and write scope above, commit and push built artifacts to that GitHub branch/directory using the repository's commit conventions. Never claim an unpushed local commit is published.
2. Let the signed GitHub webhook trigger synchronization, or use staff **Sync now**. Check the recorded operation until it reports published/unchanged or a useful failure. Compare the recorded source commit and the expected design. Unchanged content may retain the earlier revision commit; the sync operation records the newly observed commit.
3. On failure, fix the cause and retry. The previous published revision must remain active; do not tell reviewers to clear storage as a publication fix.
4. In the actual authorized viewer, verify every frame and relative navigation. At desktop fit scale and after scrolling, place a pin near a clearly labelled element. Confirm it stays at that location, including after reopening the frame. Repeat on mobile and the image-only frame.
5. Use two separate browser sessions to exchange a new thread and a reply, reload both, and confirm server-persisted text and attribution. Test a failed/retried save without representing unsaved text as durable. Staff should resolve/reopen the thread; a client must not have those controls.
6. Publish a second design revision. The already-open viewer stays pinned to its loaded revision. Open the old thread from feedback and confirm it displays its original snapshot and older-revision notice, not the latest layout with old coordinates. Existing pins never migrate automatically.
7. Report the actual published commit/status and precisely what was exercised. If GitHub access, configured sharing destination, preview host, or application runtime is unavailable, report that prerequisite; do not substitute local preview for app-backed evidence.

## Agree the publishing destination

Read staff-provided source configuration: repository `owner/repo`, branch, and repository-relative directory. Inspect existing source and bundles before replacing anything. Never infer a production destination from this example or put credentials into files. If the destination is not provided or discoverable, finish local authoring and ask for that specific publishing prerequisite.

Before any push, synchronization, publication, or application write, obtain explicit user authorization for the repository, branch, directory, target environment, and intended writes. Existing explicit authorization for that scope is sufficient; discovering source configuration or having staff access is not. Include verification writes—test pins/threads/replies, status changes, and a second revision—in that approval. Otherwise remain local or read-only and ask for the missing authorization; never post test feedback into a client environment merely to complete this checklist.

A successful sync publishes immediately. Use a dedicated sharing branch when the design needs approval before clients see it. Copy only the contents of `example/` into the chosen bundle directory to start; do not publish this skill's scripts, documentation, source dependency directories, or authoring inputs.
