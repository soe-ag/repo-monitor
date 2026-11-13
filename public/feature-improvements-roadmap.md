# Focused roadmap

This roadmap stays close to the current personal repository health workflow.

## Next

- **Isolate connections by user before wider access.** The app currently reads a default connection. Add identity-aware ownership and access checks before supporting multiple users.
- **Make scan failures easier to act on.** Preserve partial results while surfacing rate limits, permission gaps, and retryable failures clearly in repository reports.
- **Improve dependency accuracy.** Read lockfiles where supported so update comparisons can use resolved versions as well as manifest ranges.

## Later

- **Show health changes over time.** Compare saved scan runs and highlight new, resolved, and recurring findings on each repository report.
- **Reduce repeated external lookups.** Add short-lived package metadata caching and consider incremental scans once scan history is reliable.

Features such as team workspaces, notifications, automated pull requests, and enterprise policy controls are outside the current project scope.
