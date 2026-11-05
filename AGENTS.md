# Project rules

- Admin checks in the database go through `public.has_role(uid, 'admin')`, which also returns true for holders of the `menteri_sisdigi` title; the client mirrors this in `authStore.isAdmin()`. Why: one place grants admin-equivalent access so RLS policies and UI stay in sync.
