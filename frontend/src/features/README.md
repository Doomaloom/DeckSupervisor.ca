# Feature ownership

Supervisor pages live in `decksupervisor/`; instructor pages live in `instructor/`. Components and domains used by both workspaces live in `../shared/`. Shared modules must not import workspace features.

Each page uses PascalCase names:

```text
PageName/
  PageName.component.tsx
  PageName.logic.ts
  PageName.test.tsx
  services/                    # only when needed
  ChildName/
    ChildName.component.tsx
    ChildName.logic.ts       # when the child owns behavior
    ChildName.test.tsx        # focused behavior coverage when needed
```

Components render and connect callbacks. Logic hooks own state, effects, derivations, and actions. Keep focused existing hooks and pure `.ts` helpers separate. Nest components beneath their owning page; promote cross-page/workspace reuse into shared code. Keep transport/storage infrastructure in `lib` and existing generic UI in `general-components`.

See `docs/frontend-refactor/` at the repository root for the inventory and verification record.
