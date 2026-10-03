# DEC-66 password recovery — October 3, 2026

Self-service recovery is implemented locally at `/forgot-password` and `/reset-password`. A valid email request always receives the same account-existence confirmation. Verification occurs only when the user submits matching new passwords, avoiding consumption by a simple email-link GET. Supabase verifies the recovery hash; the backend keeps its access token in an encrypted HttpOnly cookie rather than returning it to JavaScript. Successful reset clears authentication and returns to sign-in.

## Required configuration before use

No hosted configuration or email template was changed during this cycle.

1. Apply `backend/supabase_recovery.sql` using the normal approved migration process. It is transactional and repeatable. The shared database ledger binds every recovery grant to the authenticated Supabase user and prevents concurrent or repeated password updates.
2. Configure the existing backend `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Recovery uses the anon key and verified caller token; no service-role credential is required.
3. Set backend-only `AUTH_RECOVERY_KEY` to a stable, secret, standard-base64 encoding of 32 random bytes, for example generated with `openssl rand -base64 32`. Share the same key among backend instances. Never expose it through `VITE_*` configuration or commit it. Rotating it invalidates pending recovery cookies.
4. Set backend-only `SUPABASE_RECOVERY_REDIRECT_URL` to the exact frontend URL ending in `/reset-password`, with no query or fragment. Use HTTPS in hosted environments; HTTP is permitted only for localhost or 127.0.0.1 development. Configure the Supabase Site URL and redirect allowlist for the matching frontend origin and recovery URL.
5. Set Supabase's **Reset Password** email template link to the following. This cookie-authenticated application needs a recovery token hash, rather than a URL that places an access token in a fragment:

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a>
   ```

6. Configure and verify the project's email delivery provider. Test a real mailbox using a disposable account after configuration is approved; verify delivery, expiry, reuse denial, password-policy rejection, and subsequent login with the new password. Local mock-provider results below do not demonstrate actual email delivery.

The configuration follows Supabase's [password recovery flow](https://supabase.com/docs/guides/auth/passwords), [email template variables and verification guidance](https://supabase.com/docs/guides/auth/auth-email-templates), and [rate-limit guidance](https://supabase.com/docs/guides/auth/rate-limits).

## Security and behavior

- Four backend endpoints under `/api/auth/recovery`: `request`, `verify`, `status`, and `reset`. Responses disable caching. Browser requests never choose the recovery redirect or user identity.
- The recovery cookie is HttpOnly, SameSite=Lax, restricted to the recovery API path, Secure over HTTPS, and expires within 15 minutes or earlier provider-token expiry. It is not installed as an ordinary sign-in cookie. Provider verification is rechecked before reset.
- A random grant's SHA-256 identifier, user ID, expiry, and pending/claimed/used state are the only database ledger fields. It stores neither passwords nor provider tokens. A transactional claim blocks concurrent resets and replay. Password rejection releases the claim for retry; interrupted processing may require another recovery email.
- Forms require confirmation and at least six characters. Supabase enforces the project's configured password policy. Failed submissions retain both password fields for correction. Invalid, expired, and reused links offer another recovery request.
- Each backend process permits three requests per normalized email and ten per remote IP within 15 minutes; verification and reset have separate ten-attempt IP budgets. Exhaustion returns 429 with Retry-After. Keys are hashed, expired entries are pruned, and memory is bounded. This is a per-process budget, supplemented by Supabase's project-level limits; a multi-instance deployment does not share this local budget. RemoteAddr is used rather than trusting arbitrary forwarded IP headers. A reverse proxy may share the local IP budget among its clients.
- Provider request errors return the same confirmation as unknown accounts. That message confirms receipt of the request, not delivery of an email.

## Validation evidence

Go HTTP/provider tests cover uniform known/unknown responses, fixed redirect, request throttling, invalid and expired hashes, recovery verification purpose, identity derived from the provider, encrypted cookie attributes, missing/tampered cookies, password mismatch, provider-policy rejection with retry, successful reset, used hash/cookie denial, and simulated old-password rejection/new-password login. These provider responses and logins are simulated, not a real Supabase project or mailbox.

React tests cover confirmation and throttling errors, no token verification on initial page load, mismatched confirmation without a provider call, retained input after policy rejection, retry without re-verifying a consumed hash, invalid/expired cookie state, and navigation back to sign-in after success.

The disposable PostgreSQL suite applies the migration twice and verifies RLS isolation, direct-write denial, anonymous denial, expiry, claimed/used replay denial, and release/retry following rejection. The complete existing supervisor and instructor RLS suites, including migration rollback, are also run. Final validation passed: all 179 frontend tests in 55 files, Vite production build, all Go packages, and the complete disposable PostgreSQL suite including migration rollback. The separate TypeScript check still reports existing unrelated baseline errors; no new recovery-module errors were reported.

Production application of the migration, email-template/redirect/key configuration, and real mailbox acceptance remain deployment prerequisites outside this local-only delivery.
