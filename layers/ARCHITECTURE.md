# Frontend Layered Architecture

This frontend follows explicit layers to keep UI, business logic, and I/O separated.

## Layers

1. `presentation/`
- UI composition and route-facing layouts/components.
- Can depend on `application/` and `shared/`.
- Must not call infrastructure APIs directly.

2. `application/`
- Use-cases, workflows, state stores, and app-level hooks.
- Can depend on `infrastructure/` and `shared/`.
- Must not import `presentation/`.

3. `infrastructure/`
- HTTP client, API adapters, backend discovery, and external I/O concerns.
- Can depend only on `shared/`.
- Must not import `application/` or `presentation/`.

4. `shared/`
- Cross-cutting constants/utilities with no side effects.
- Can be used by all layers.

## Compatibility Policy

Legacy paths under `lib/`, `store/`, `hooks/`, and older layout component paths are maintained as compatibility adapters that re-export from `layers/*`.

New code should import directly from layer aliases:

- `@/presentation/*`
- `@/application/*`
- `@/infrastructure/*`
- `@/shared/*`

