# Security

Kinloop holds health information, so it is built to keep it scoped, minimal and out of logs.

| Measure                                                                                                                         | Where                                                               |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Passcodes hashed with scrypt and a per-member salt, compared with `timingSafeEqual`                                             | `src/server/auth/passcode.ts`                                       |
| Lockout after 5 failed sign-ins for 15 minutes, stored in the database                                                          | `src/server/services/circles.ts`                                    |
| Generic sign-in errors that reveal nothing about which part was wrong                                                           | `src/server/services/circles.ts`                                    |
| Signed HS256 session JWT in an `httpOnly`, `Secure`, `SameSite=Lax` cookie, 12 hours; regenerating a passcode ends old sessions | `src/server/auth/session-token.ts`, `src/server/auth/session.ts`    |
| Every query scoped by the circle code from the signed session, never from client input                                          | `src/server/auth/session.ts`, `src/server/repositories/`            |
| One permission function used by every service, with an authorisation-denial test for every mutation                             | `src/domain/permissions.ts`, `src/server/services/services.test.ts` |
| Zod validation with hard limits on every form and body                                                                          | `src/server/validation.ts`                                          |
| Same-origin check on every state-changing request (plus Next.js server-action origin checks)                                    | `src/server/security/origin.ts`, `src/proxy.ts`                     |
| Nonce-based Content-Security-Policy, HSTS, `nosniff`, `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy             | `src/server/security/csp.ts`, `next.config.ts`                      |
| Rate limits on sign-in, circle creation and demo creation, keyed by a salted hash of the IP                                     | `src/app/actions/auth.ts`, `src/server/repositories/`               |
| Cron endpoint authenticated with a 32-byte shared secret compared in constant time                                              | `src/server/security/cron-auth.ts`                                  |
| Structured logs that never carry passcodes, emails or health details                                                            | `src/server/logger.ts`                                              |
| No secrets in code or history; `.env.example` lists names only                                                                  | `.gitignore`, `.env.example`                                        |

Report a vulnerability by opening a private security advisory on this repository.
