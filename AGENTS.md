# Project rules

- Admin checks in the database go through `public.has_role(uid, 'admin')`, which also returns true for holders of the `menteri_sisdigi` title; the client mirrors this in `authStore.isAdmin()`. Why: one place grants admin-equivalent access so RLS policies and UI stay in sync.
- Global library search uses fresh, minimal, role-scoped client queries and relies on database RLS; it never indexes broader page caches. Why: search must not widen existing data access or expose unneeded fields.
