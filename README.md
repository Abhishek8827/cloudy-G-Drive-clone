# Google Drive Clone

A React-based application that mimics Google Drive functionality with Firebase backend integration.
# Cloudy G-Drive Clone

A simple Google Drive–like clone built with React and Firebase (Firestore + Storage).

## Summary

This project demonstrates a file manager UI with:
- Google Sign-In (Firebase Authentication)
- File upload to Firebase Storage
- File and folder metadata in Firestore
- Real-time updates via Firestore listeners
- A Gemini/AI panel integration for interacting with files

## Quick setup (local)

1. Install dependencies (use the lockfile):

```powershell
npm ci
```

2. Start the dev server:

```powershell
npm start
```

3. Build for production:

```powershell
npm run build
```

## Firebase

The Firebase config is stored in `src/firebase.js`. For security in production, replace the hard-coded config with environment variables and a safe hosting setup.

## Notes about CI / GitHub Pages

- If you see an `npm ci` error in GitHub Actions complaining about `package-lock.json`, ensure `package.json` and `package-lock.json` are in sync locally and pushed to the repository.
- Use `npm ci` in CI for reproducible installs.

## Security & Secrets

Do NOT commit production Firebase credentials to a public repo. Use GitHub Secrets and environment vars for deploy workflows.

## Contact

If you want, I can:
- Re-run the GitHub Actions workflow
- Create a GitHub Pages deployment workflow
- Remove hard-coded Firebase config and show how to use secrets
