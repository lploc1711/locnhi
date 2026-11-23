# Locnhi

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

## Firebase

The supplied configuration is in `src/app/firebase/firebase.config.ts` and targets `locnhi-c2d95`.
`src/app/app.config.ts` initializes Firebase at startup through `FirebaseService`.
Analytics loads asynchronously in supported browsers; failures do not block app startup.

Inject `FirebaseService` and use its `app` with Firebase SDK services as features are added.
No authentication flow or database operations are configured yet.

Setup references: [Angular](https://angular.dev/installation) and [Firebase](https://firebase.google.com/docs/web/setup).

## Firebase Hosting deployment

`.firebaserc` selects `locnhi-c2d95`. `firebase.json` serves the production build
from `dist/locnhi/browser` and routes application URLs to `index.html`.

The GitHub Actions workflow `.github/workflows/firebase-hosting.yml` installs
dependencies, runs tests, and builds on pull requests and pushes to `main`.
Successful pushes to `main` deploy to the live Firebase Hosting channel. You can
also run the workflow manually from the Actions tab on `main`.

Before the first deployment, add the repository Actions secret
`FIREBASE_SERVICE_ACCOUNT_LOCNHI_C2D95` containing the deployment service-account
JSON for this Firebase project. The client Firebase API key does not authorize
deployment. Use the [Firebase GitHub setup](https://firebase.google.com/docs/hosting/github-integration)
or the [service-account setup instructions](https://github.com/FirebaseExtended/action-hosting-deploy/blob/main/docs/service-account.md)
to provision deployment access. Keep the service-account JSON out of Git.

The initial workflow uses `npm install` because there is no lockfile yet. Once
`package-lock.json` is generated and committed, use `npm ci` for reproducible installs.

For a manual deployment after installing dependencies and authenticating:

```powershell
npm.cmd exec --package=firebase-tools -- firebase login
npm.cmd run build
npm.cmd exec --package=firebase-tools -- firebase deploy --only hosting --project locnhi-c2d95
```
