# Database Seeds

Seed data for local development and staging. Do not seed production data
automatically without approval.

Guidelines:
- Keep seeds idempotent (use INSERT IGNORE / ON DUPLICATE KEY UPDATE where appropriate).
- Avoid seeding production secrets or real customer data.
- Seeds run after migrations.
