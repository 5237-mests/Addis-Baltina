# Database Migrations

This directory is intended for forward-only schema migrations. Since persistence
is not yet wired at runtime (P0), migrations are prepared in advance.

Guidelines:
- Use sequential, timestamped or numeric prefixes (e.g. `0001_*.sql`).
- Keep migrations idempotent where possible or document assumptions.
- Apply migrations before starting the app once MySQL persistence lands.
- Never modify an applied migration; create a new one.
