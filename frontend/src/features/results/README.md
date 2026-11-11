# Attendance and submitted results

`/instructor/attendance` uses the instructor session picker and cookie-authorized result scope. `/results` is the supervisor equivalent, linked in the supervisor navigation and Device Exports.

Select class, lesson date and optionally student to mark attendance. Submitted assessments show all criteria and timed totals. Corrections create a new operation against the displayed revision; deletion retains audit history. Conflicting corrections stay pending for supervisor review. Supervisors can choose current/incoming values and revoke tablet access grants.

Names are resolved only from the scoped local source roster or a local class package whose dataset/course/swimmer IDs match the registered session. Class-package upload stays in scoped local storage and never creates server bindings. Unresolved students are labeled explicitly. Completed printing requires every student to resolve, no pending class conflicts and one known curriculum version. Private classes split into existing sheets by each swimmer's assessed level. Only accepted, nondeleted server-successful attempts count toward printed checks.

Authenticated class download and sharing register durable dataset, source and enrollment IDs before publication. A fresh browser recovers exact unchanged roster signatures automatically. Server payloads contain opaque SHA256 match keys, never names or contacts. Changed spelling/contact values and newly added entries in previously registered classes require explicit reconciliation under Results. A transfer or genuinely new student uses a new enrollment; existing histories remain attached to their original enrollment. Indistinguishable duplicates must first be corrected in the source roster. Guest packages stay import-only.

`frontend/scripts/generate-results-curriculum.mjs [catalog-path]` generates display-only criterion and skill labels from the tablet's actual catalog. IDs and version are preserved verbatim. This metadata never computes result success.

Synthetic tests cover exact recovery, alias spelling changes, contact changes, duplicates, transfers, wrong local package identities, registration privacy, authenticated share ordering, corrections/revisions, conflict review, grant revocation and completed-print blocking.
