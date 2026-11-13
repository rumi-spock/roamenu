# Roamenu improvement roadmap

Covers all three projects: the consumer app (`apps/roamenu`), the restaurant-owner app (`apps/restaurant-owner`) and the website/API (`../roamenu-website`). Last updated 2026-11-13.

## Status

| Phase | Status |
|---|---|
| 0. Automated checks (CI) | Done |
| 1. Critical security, cost and correctness fixes | Done |
| 2. Hardening and consistent API responses | Next |
| 3. Database foundation | To do |
| 4. Consumer app quality | To do |
| 5. Repositories, shared definitions, documentation | To do |
| 6. Product improvements | To do |

The Phase 0 and 1 changes were left uncommitted on 2026-11-13 for review. Include the website's `.env.example`, which git previously ignored and is now allowed by `.gitignore`.

### What Phases 0 and 1 delivered

- **CI.** `.github/workflows/ci.yml` in both repositories:
  - Website: lint, type check, tests (including Postgres integration tests against a CI database) and build.
  - Apps: type check and tests.
- **Sign-in and accounts:**
  - Login tokens carry an issue time and can be revoked.
  - Account deletion removes the profile, password login and share links in one transaction, and revokes existing tokens.
  - Production refuses to run with a missing or placeholder `AUTH_SECRET`, or without `DATABASE_URL`.
- **Scan endpoint:**
  - Checks sign-in and the image before charging quota, and refunds quota when a scan fails.
  - Runs for up to 300 seconds, with a 4 MB upload limit.
- **Share links:**
  - Require sign-in, are rate-limited and size-capped, store their owner and last 7 days.
  - The app creates a link only when the user taps Copy, WhatsApp or QR.
- **App:**
  - Login token kept in `expo-secure-store` (the device's encrypted storage).
  - Multi-page category bug fixed.
  - Editing preferences no longer replaces the current menu.
  - Allergy warning in all 14 languages.
- **Removed:** the hard-coded localhost and home-network CORS origins, the local-only Google callback route, and the app's web Google redirect setting.

### Current limits

| Limit | Value | Setting |
|---|---|---|
| Successful scans per user | 15 per day; failed scans are refunded | `MENU_SCAN_DAILY_USER_REQUESTS` |
| Scan attempts per user | 3 × the user limit (45 per day); not refunded | (derived) |
| Successful scans across all users | 2,000 per day. Reaching it returns `daily_capacity_reached` and logs `menu_scan_daily_global_limit_reached` | `MENU_SCAN_DAILY_GLOBAL_REQUESTS` |
| Scanning on/off | On; set to `0` to switch off immediately | `MENU_SCAN_ENABLED` |
| Upload size | 4 MB (Vercel rejects bodies over 4.5 MB) | `MENU_SCAN_MAX_UPLOAD_BYTES` |
| Sign-ups per network | 30 per hour | `src/services/rate-limit.ts` |
| Email sign-ins | 50 per 15 min per network; 10 per 15 min per email address | `src/services/rate-limit.ts` |
| Google/Apple sign-ins per network | 60 per 15 min | `src/services/rate-limit.ts` |
| Share links | 50 per user per day; 512 KB maximum; valid 7 days | `MENU_SHARE_TTL_HOURS` (default 168) |

Scans have no per-network limit, because diners on shared restaurant, hotel or mobile networks share one public IP address.

## Before deploying or releasing

- [ ] **Vercel production environment:**
  - `AUTH_SECRET` is a unique random value of at least 32 characters (for example `openssl rand -base64 48`).
  - `DATABASE_URL` is set.
  - Remove `MENU_SHARE_TTL_HOURS=2` if present, so the 7-day default applies.
  - Set `MENU_SCAN_DAILY_GLOBAL_REQUESTS` if 2,000 a day doesn't suit your budget.
  - Set `CORS_ALLOWED_ORIGINS` only if a browser client needs the API.
- [ ] After deploying, `GET /api/health` returns 200. It returns 503 when production is missing the database or a strong `AUTH_SECRET`.
- [ ] Set up an alert on the log event `menu_scan_daily_global_limit_reached`.
- [ ] Any development or preview build installed before Phase 1 must be rebuilt, because `expo-secure-store` is native code. Expo Go already includes it.

## Development builds (testing on your phone without using Expo's build quota)

Local builds compile on your Mac, with no Expo servers or Expo account involved, so they don't count toward your build quota.

**Requirements**
- **iPhone:**
  - Xcode, and the phone connected by cable with Developer Mode on.
  - A paid Apple Developer account for signing. With a free Apple ID, apps expire after 7 days and Xcode may refuse the Sign in with Apple capability.
- **Android:** Android Studio, and USB debugging turned on.

**Commands** (from `apps/roamenu`)
```sh
npx expo run:ios --device       # build and install on an iPhone
npx expo run:android --device   # build and install on an Android phone
npx expo start --clear          # daily development once the build is installed
```
- Rebuild only after adding a package with native code, changing `app.json`, or upgrading the Expo SDK.
- Without `expo-dev-client`, start the server with `npx expo start --dev-client` so it targets the development build instead of Expo Go.
- Installing `expo-dev-client` adds a launcher screen for choosing a server, and makes `npx expo start` target the build automatically. This project keeps its own `ios/` and `android/` folders, so it needs a couple of extra native steps.
- `eas build --local` runs Expo's own build process on your Mac. It also avoids the quota, and can produce signed builds for TestFlight and Google Play.
- `npx expo run:ios --configuration Release --device` installs a standalone copy that runs without your Mac.

**Expo Go or development build?** When `npx expo start` starts, the terminal says "Using Expo Go" or "Using development build". If a development build is missing a native module, it shows a red screen such as "cannot find native module 'ExpoSecureStore'": rebuild it.

**Does a local build replace the installed app?**
- Expo Go is a separate app and is never affected.
- A local build uses the same app ID (`com.roamenu.app`) as Expo cloud builds, so it replaces them.
- On Android you must uninstall the existing copy first, because Expo's builds use a different signing key. That clears the app's data.
- To keep both side by side, give development builds their own app ID (for example `com.roamenu.app.dev`), as in the app-variants guide below.

**Connecting to production or a preview deployment**
- The server comes from `EXPO_PUBLIC_API_URL`, read from `.env` files when the JavaScript is bundled. This works the same in Expo Go and development builds.
- In development, Expo reads `.env.development.local` before `.env.local`. To use production without editing `.env.local`, create `apps/roamenu/.env.development.local`:
  ```
  EXPO_PUBLIC_API_URL=https://roamenu.vercel.app
  EXPO_PUBLIC_PUBLIC_SITE_URL=https://roamenu.vercel.app
  ```
  Then run `npx expo start --clear`. Delete or rename the file to go back to the local server. Git ignores it.
- Release builds read `.env.production.local` instead.
- Mock sign-in is turned off on production and preview; sign in with email, Google or Apple.
- Vercel usually protects preview deployments with a login screen the app can't get past. Turn off Deployment Protection for previews, or test against production. Previews also need their own environment variables (`DATABASE_URL`, `AUTH_SECRET`, and so on).

**Documentation**
- Development builds: https://docs.expo.dev/develop/development-builds/introduction/
- Local debug builds (`npx expo run`): https://docs.expo.dev/guides/local-app-development/
- Expo builds on your own machine (`eas build --local`): https://docs.expo.dev/build-reference/local-builds/
- Environment variables: https://docs.expo.dev/guides/environment-variables/
- Several app variants on one device: https://docs.expo.dev/tutorial/eas/multiple-app-variants/
- iOS Developer Mode: https://docs.expo.dev/guides/ios-developer-mode/

## Phase 2 — Hardening and consistent API responses (next)

1. **Error format.** One error helper next to `corsJson`. Every route returns `{ code, error }` with documented codes. Never return raw exception text on 500 errors. The quota error keeps its current wording and adds a `limit` field.
2. **App errors and tokens.** The app shows translated messages based on `code`. It accepts `token` or `accessToken`; the server returns both for one release, then only `token`.
3. **Passwords.** Use scrypt with p=5, which meets OWASP guidance at the same memory cost. Re-hash on the next successful sign-in. Run a dummy hash for unknown emails, so timing doesn't reveal which accounts exist.
4. **Small fixes:**
   - Apple sign-in nonce: the app generates it and the server verifies it.
   - Send the Gemini key in the `x-goog-api-key` header instead of the URL.
   - Ignore `ROAMENU_DEBUG` in production.
5. **Security headers** in `next.config.ts`: nosniff, referrer policy, frame-ancestors and permissions policy. Add a Content-Security-Policy in report-only mode first, following the Next.js 16 guide in `node_modules/next/dist/docs`.
6. **Optional:** shorter login tokens with silent refresh.
7. **Privacy policy and terms.**
   - Name the processors: Google Gemini, OpenAI when enabled, Vercel, the database host.
   - State how long each kind of data is kept: shares 7 days, rate-limit records about a day, scans on the device only, accounts until deletion.
   - Say exactly what account deletion removes, and that a hashed scan counter is kept so deleting an account can't reset the quota.

## Phase 3 — Database foundation (after Phase 1; can run alongside Phase 4)

1. **Separate databases.** Confirm preview and production use separate databases. The code labels only rate-limit records by environment, which suggests they share one.
2. **Migrations.** Add versioned SQL migrations with a small `npm run db:migrate` runner and a `schema_migrations` table.
   - Baseline the current tables: `user_profiles`, `password_accounts`, `menu_shares` (including `owner_user_id`), `scan_rate_limits` and `revoked_user_tokens`.
   - Then remove the lazy `ensure*Schema` functions.
   - The database client allows one connection (`max: 1`), so never run setup queries inside a transaction.
3. **Fix how JSON is stored (bug found in Phase 1).**
   - Writes like `${JSON.stringify(value)}::jsonb` store JSON as a quoted string instead of real JSON. This is why the old quota check never worked on Postgres.
   - Switch writes to `sql.json(value)`, then convert existing rows with `UPDATE … SET col = (col #>> '{}')::jsonb WHERE jsonb_typeof(col) = 'string'`.
   - Affected columns: `scan_rate_limits.request_times`, `menu_shares.menu` and `user_profiles.food_preferences`.
   - The readers currently accept both formats; keep that until the migration has run everywhere.
4. **Indexes:** `menu_shares(created_at)`, `menu_shares(owner_user_id)` and `scan_rate_limits(updated_at)`.
5. **Scheduled clean-up.** Add a Vercel Cron route protected by `CRON_SECRET` that deletes expired shares and stale rate-limit rows. Then remove the clean-up from share creation.

## Phase 4 — Consumer app quality

1. **Testable logic.** Move core logic into tested modules: a versioned saved-scan format that upgrades the old one, preference matching, and speech locales. `mergeScanPage()` is already done.
2. **Split the main screen.** Apply automatic formatting once, in a separate commit. Then split `src/MenuScanner.tsx` (about 1,200 lines) without changing how the app behaves:
   - hooks: auth session, UI text, scan session, speech, share link;
   - components: sign-in, scan home, result tabs/list/image view, account, QR, preference prompt, scan progress.
3. **Translations.**
   - Create one typed translation list in `packages/shared-utils`, falling back to English. Server translation packs only override known keys.
   - Remove the Split Mesa and trip/expense text from `roamenu-website/src/services/mobile-page-translation-packs.ts` and the website README.
   - Translate the remaining hard-coded English texts: "Scan failed", "Large menu detected", "Copied", "Share menu", "Delete account", "Speech unavailable", "Scan a menu", "Add another page", "Menu pages", "Scan to open this menu", "Close" and "Unable to prepare the QR code."
4. **Interface fixes:**
   - Ask before changing language, offering to keep the current menu.
   - Japanese and Chinese scan results: add `ja` and `zh-CN` to the website's `menuScanLanguages` and the app's `scanLanguages`, then run a live check.
   - Use a virtualised list for long menus.
   - Keep page images in the documents folder; they are currently in a cache folder the phone can clear.
   - Remove microphone permissions: `RECORD_AUDIO` in `app.json`, and `microphonePermission: false` in the image-picker plugin.
   - Set `userInterfaceStyle` to `light` until a dark theme exists.
   - Show a clear error when `EXPO_PUBLIC_API_URL` is missing; the current fallback uses the wrong port.
   - Delete the unused `ViewModeIconGallery` and its icon variants.
5. **Tooling.** Add ESLint (Expo config) and Prettier to both apps, and run them in CI.

## Phase 5 — Repositories, shared definitions, documentation

1. **Git clean-up.**
   - Stop tracking `apps/roamenu/500` (a stray curl cookie file) and `apps/roamenu/android/app/debug.keystore`. Both are confirmed tracked.
   - Fix the root `.gitignore` keystore rule, which only matches `android/app/debug.keystore` at the repository root.
   - Add `*.tsbuildinfo` and `coverage/` to `.gitignore`.
2. **Monorepo (needs your approval).**
   - Move `roamenu-website` into this repository as `apps/website`, keeping its history.
   - Add npm workspaces with one lockfile, and update the Vercel root directory.
   - Add `packages/contracts` (types, validation schemas, language lists, error codes) for the website and both apps.
   - Optionally rename `priceInPence` to `priceMinor`, with a saved-data migration.
3. **Owner app.** Fix the icon path (`../../assets/icon.png` doesn't exist) and add `eas.json` with an EAS project ID. CI already type-checks it.
4. **Documentation:**
   - a root README;
   - `docs/architecture.md` (diagram);
   - `docs/api.md` (all routes, authentication, error codes, limits);
   - `docs/environment.md` (every variable per environment);
   - `docs/release.md` (EAS, Vercel, migrations);
   - a root `AGENTS.md` with commands and conventions for AI agents;
   - complete `.env.example` files.
   This roadmap can move to the root `docs/` folder then.

## Phase 6 — Product improvements (after Phases 1–2)

1. **Shared menus in the browser** at `/menu/[shareId]`, so recipients don't need the app.
   - Show categories, prices, allergens, an "Open in Roamenu" button and store links.
   - Hide the page from search engines and show a friendly page for expired links.
2. **Structured allergens.**
   - The AI returns the 14 EU allergen codes.
   - Preferences come from a picker (the 14 allergens, common diets, plus free text).
   - Match on codes first, with text matching as a fallback. Keep the text matching broad: whole-word matching would miss "walnuts" and compound words.
3. **AI reliability.**
   - Fall back to the other provider within the time limit.
   - Log the prompt version.
   - Keep a manual test script with sample menus: Japanese, Korean, multi-column layouts, and KRW/JPY prices.
4. **Subscriptions (planned before public launch).**
   - 3 free scans per user, then scan packs of 100, 200 or 500, sold through Apple In-App Purchase and Google Play Billing as consumable purchases.
   - Keep the credit balance on the server and verify receipts there; RevenueCat can simplify this.
   - Reuse the existing reserve-and-refund flow, so failed scans don't use free scans or credits.
   - Apply the global daily ceiling to free scans only, never to paid scans.
   - Keep a minimal hashed "free scans used" record that survives account deletion, so deleting and re-signing in doesn't grant new free scans. Mention it in the privacy policy.
   - Keep a generous daily safety cap (about 100) for paying users.
5. **Owner app features.** These need a separate plan. Earlier decisions:
   - It is a separate Expo app.
   - The owner's own language is the authoritative source.
   - Published menus are durable and live at stable public URLs on the website.
   - The website stays the public surface.

## Further considerations

- **Account linking.** One person using Google, Apple and email currently gets three accounts and three quotas. Add `users` and `user_identities` tables, and link accounts by verified email before public launch.
- **Stronger abuse protection than IP addresses:** email verification for password accounts, and Apple App Attest / Google Play Integrity.
- **Generated native folders.** Try `npx expo prebuild --clean` on a branch, and stop committing `ios/` and `android/` if the result shows no hand-made edits.
- **Error reporting.** Add Sentry (or similar) to both apps and the website before launch.

## Decisions so far

- Roamenu is pre-launch or in internal testing, so API and saved-data changes may break older builds. Small compatibility steps are kept for testers.
- Shared links open in the browser with an "Open in app" button, and last 7 days.
- Only successful scans count toward quotas.
- The targets are iOS and Android. Expo web is a development convenience only.
- The restaurant-owner app gets configuration fixes only, until its own plan.
- Moving the website into the monorepo needs explicit approval.

## Testing

- **Website** (`roamenu-website`):
  - `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build`.
  - On a fresh checkout, run `npx next typegen` before `tsc`.
  - After removing a route, delete `.next/dev/types`; the dev server recreates it.
- **Apps** (`apps/roamenu`, `apps/restaurant-owner`): `npm run type-check`, and `npm test` for the consumer app.
- **Tests must never touch the real database or AI providers.** `vitest.config.ts` blanks `DATABASE_URL`, `GEMINI_API_KEY` and `OPENAI_API_KEY`, because direnv exports the real values into your shell.
- **Postgres integration tests** against a throwaway local database (Homebrew Postgres is installed):
  ```sh
  PGTMP=$(mktemp -d /tmp/roamenu-pg.XXXXXX)
  initdb -D "$PGTMP/data" -U postgres -A trust --no-instructions
  pg_ctl -D "$PGTMP/data" -o "-p 55432 -k $PGTMP -c listen_addresses=127.0.0.1" -l "$PGTMP/log" -w start
  ROAMENU_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres npx vitest run tests/postgres.integration.test.ts
  pg_ctl -D "$PGTMP/data" -m fast -w stop && rm -rf "$PGTMP"
  ```
