# and va em

Angular 22 standalone application with routing, SCSS, and the Firebase JavaScript SDK.

## Development

Use a Node.js version supported by Angular 22: ^22.22.3, ^24.15.0, or >=26.0.0.

```powershell
npm.cmd install
npm.cmd start
```

Open http://localhost:4200. On shells without PowerShell script restrictions, `npm` works in place of `npm.cmd`.

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
```

## Project structure

The app follows the [Angular style guide](https://angular.dev/style-guide): group
code by feature, keep each component's TypeScript, template, styles, and tests
together, and keep domain logic separate from presentation.

```text
src/
  app/
    auth/
      login/                  Letter login component and its tests
      auth.routes.ts          Lazy authentication routes
      auth.service.ts         Google sign-in and session state
      auth.guard.ts           Protects signed-in routes
    home/
      home.ts                 Welcome page linking to the date planner
      home.routes.ts          Protected home route
      love-note/              Decorative note component
    date-plans/
      plans-page/             Dedicated date planner and user actions
      plan-card/              Plan display and action outputs
      plan-editor/            Form inputs and save/close outputs
      date-plan.ts            Firebase-independent domain types
      date-plan.validation.ts Pure input validation
      date-plans.service.ts   Realtime Database reads, writes, and state
      date-plans.routes.ts    Lazy date-planning routes
    firebase/                 Firebase configuration and initialization
    shared/
      brand/                  Shared brand link component
      member-layout/          Signed-in header, navigation, and footer
    app.routes.ts             Top-level feature entry routes
    app.config.ts             Application providers
    app.ts                    Root router outlet
  styles/
    _theme.scss               Pink palette and typography tokens
    _base.scss                Global element and accessibility styles
    _buttons.scss             Shared button styles
    _utilities.scss           Common text, errors, and loading styles
    _fonts.scss               Self-hosted font declarations
  styles.scss                 Global stylesheet entry point
  main.ts                     Application bootstrap
```

Each component uses standalone imports and explicit `OnPush` change detection.
Pages coordinate authentication and data access; plan cards and editors receive
signal inputs and emit outputs without depending on Firebase services. Type-only
imports keep presentation components independent of the database implementation.
Tests are co-located with the code they cover, including pure validation and
feature-route navigation tests.

Add a new component inside its owning feature, keeping matching file names and
one component per folder. Put code in `shared` only when multiple features use
it. Keep Firebase operations in services, validation in domain functions, and
page composition in the route component. Each feature owns its child routes;
the root route table loads features lazily. Styling shared across the app belongs
in `src/styles`; component-specific styling stays with its component.

## Firebase

The supplied configuration is in `src/app/firebase/firebase.config.ts` and targets `plocandnhi`.
`src/app/app.config.ts` initializes Firebase at startup through `FirebaseService`.
Analytics loads asynchronously in supported browsers; failures do not block app startup.

Inject `FirebaseService` and use its `app` with Firebase SDK services as features are added.
The `/login` page presents a sealed letter. Google sign-in opens the envelope,
then takes the user to the protected `/home` route. Saved Google sessions are
restored on refresh; signing out returns to the letter.

### Date plans

The first featured project is **Đà Lạt 3N2Đ | Adventure & Chill**, available at
`/date-plans/da-lat-3n2d`. It preserves the supplied itinerary, day-by-day tables,
budget, preparation checklist, and weather alternatives. The original is kept
in `plan/da-lat-3n2d.md`. No departure date is assumed; prices and schedules remain
the supplied planning estimates.

Select **Lưu lịch trình vào sổ hẹn** on its detail page to save a complete copy
to the signed-in account. A database transaction uses a stable ID so repeat
imports do not create duplicates or overwrite edits. Once saved, the itinerary
appears first among saved plans. The app supports notes up to 20,000 characters;
deploy the updated database rules before importing this longer plan.

The home page links to **Du an ma cua chung ta**, a separate protected page at
`/date-plans`. Shared navigation links both pages. Users can add and edit plans
with a title, optional date, place, and note; filter planned/completed dates; mark
plans complete; and delete them after confirmation. Plans sync in real time
through Firebase Realtime Database under `users/{uid}/datePlans/{planId}` and are
private to each Google account. Two different Google accounts have separate data.
New plans use generated push keys and a server timestamp; updates preserve the
original creation time.

Before saving plans in production:

1. Open [Realtime Database](https://console.firebase.google.com/project/plocandnhi/database)
   and select `plocandnhi-default-rtdb`. The app is configured to use
   `https://plocandnhi-default-rtdb.asia-southeast1.firebasedatabase.app` through
   `databaseURL` in `src/app/firebase/firebase.config.ts`.
2. Authenticate with `npm.cmd run firebase:login`, then deploy the included
   owner-only rules with `npm.cmd run deploy:rules`.
3. Deploy the app with `npm.cmd run deploy`. The Hosting command deploys Hosting
   only; publish rules separately when they change.
4. Sign in, add a plan, refresh, and sign into the same Google account on another
   device to check synchronization. Sign out to verify the home page is protected.

Database failures display an error; the app does not claim to have saved a plan
when a write fails. Existing drafts stay open after a failed save. A missing
database URL shows a configuration error and leaves save controls disabled.
Subscriptions are removed on sign-out and late events from previous accounts
are ignored.

Access rules are in `database.rules.json`. They allow only the signed-in owner
to read and change plans, validate plan fields, reject extra properties, and
preserve creation timestamps. Existing data in another database product is not
copied automatically; this change does not modify or delete remote data.

Unit tests mock the Realtime Database SDK. To test the actual rules and SDK
against an isolated local database, install Java 21+ and run:

```powershell
npm.cmd run test:rules
```

This starts the Firebase Realtime Database emulator with the `demo-and-va-em`
project, checks owner access and rejected writes, and verifies updates between
two simulated devices. It does not use the production database. Live end-to-end
sync still requires the configured URL and deployed access rules.

The letter animation respects reduced-motion settings. The Lora typeface is
self-hosted in `public/fonts` with its SIL Open Font License.

### Enable Google sign-in

1. Open [Firebase Authentication](https://console.firebase.google.com/project/plocandnhi/authentication/providers)
   and select **Sign-in method > Google**. Enable the provider, choose a support
   email, and save.
2. In **Authentication > Settings > Authorized domains**, add `localhost` for
   development and any custom domain used to serve this app. Confirm the Firebase
   Hosting domain is listed too.
3. Run `npm.cmd start`, open `http://localhost:4200/login`, and select
   **Continue with Google**. Allow the sign-in pop-up. Refresh to verify session
   persistence, then select **Sign out**.

Authentication uses the existing Firebase project configuration. The Google flow
creates a Firebase user on first sign-in. The Firebase SDK manages persistence
and tokens. Unit tests mock Firebase and do not contact Google or create users.

See [Firebase's Google sign-in guide](https://firebase.google.com/docs/auth/web/google-signin).

Setup references: [Angular](https://angular.dev/installation) and [Firebase](https://firebase.google.com/docs/web/setup).

## Firebase Hosting deployment

`.firebaserc` selects `plocandnhi`. `firebase.json` serves the production build
from `dist/locnhi/browser` and routes application URLs to `index.html`.

The GitHub Actions workflow `.github/workflows/firebase-hosting.yml` installs
dependencies, runs tests, and builds on pull requests and pushes to `main`.
Successful pushes to `main` deploy to the live Firebase Hosting channel. You can
also run the workflow manually from the Actions tab on `main`.

Before the first deployment, add the repository Actions secret
`FIREBASE_SERVICE_ACCOUNT_PLOCANDNHI` containing the deployment service-account
JSON for this Firebase project. The client Firebase API key does not authorize
deployment. Use the [Firebase GitHub setup](https://firebase.google.com/docs/hosting/github-integration)
or the [service-account setup instructions](https://github.com/FirebaseExtended/action-hosting-deploy/blob/main/docs/service-account.md)
to provision deployment access. Keep the service-account JSON out of Git.

The workflow uses `npm ci` with `package-lock.json` for reproducible installs.
Include the lockfile when committing the deployment setup.

For a manual deployment from the project folder:

```powershell
npm.cmd ci
npm.cmd run firebase:login
npm.cmd run deploy
```

The project includes a pinned Firebase CLI dependency. `npm run deploy` builds
the production app first, then deploys only Hosting to `plocandnhi`. Sign in
with a Google account that can deploy to this Firebase project.

The Hosting address is https://plocandnhi.web.app (also available at
https://plocandnhi.firebaseapp.com). After deploying, open `/login`, complete
Google sign-in, refresh, and sign out to verify the hosted authentication flow.

For automatic deployments, add the service-account JSON in
[GitHub repository Actions secrets](https://github.com/lploc1711/locnhi/settings/secrets/actions)
under the exact name `FIREBASE_SERVICE_ACCOUNT_PLOCANDNHI`, then commit and push
to `main`. Pull requests run validation without publishing. Service-account
setup is described in the Firebase GitHub integration guide linked above.

## Heart Blocks

Open **Heart Blocks** after signing in. Create a private room and share the invite link. A second Google account can join. Drag a piece, or select a piece then tap a board cell. Each player gets the same piece sequence and sees both scores. The higher score wins when both boards finish. Both players can ask for a rematch. A copied invite also restores a player's board when reopening the room.

The tab uses the existing Firebase Realtime Database. Apply the checked-in database rules to the same project as Hosting when releasing this feature. Run `npm run test:rules` for the local access and match protocol tests. Scores are replayed from each participant's append-only moves on both clients. This is a private casual game.
