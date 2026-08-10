# Pass & Note Web

Pass & Note Web is a browser-based companion to the Pass & Note iOS app. It can create, open, update, import, and export compatible encrypted password and note files without uploading vault contents to an application server.

## Features

- Create a temporary browser vault protected by a Master Password.
- Open existing `.pnvault` backups created by the web or iOS app.
- Import compatible `.pnpass` password packages and `.pnnote` note packages.
- Add, edit, reveal, copy, and delete password records.
- Create, autosave, export, and delete secure notes.
- Export passwords, notes, or a complete encrypted vault.
- Automatically activate Privacy Lock when the page enters the background.
- Delete the temporary vault after a configurable period of inactivity.

## Run locally

The project has no build step or package dependencies. Serve the directory over HTTP instead of opening `index.html` directly:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Project structure

```text
.
├── index.html    # Application markup and screens
├── styles.css    # Theme and responsive layouts
├── app.js        # Vault state, UI, imports, exports, and session behavior
└── crypto.js     # Pass & Note encryption-format compatibility
```

## Compatible file formats

| Extension | Contents |
| --- | --- |
| `.pnvault` | Complete encrypted vault with passwords and notes |
| `.pnpass` | One or more encrypted password records |
| `.pnnote` | One or more encrypted secure notes |
| `.txt` | One readable, unencrypted note export |

Encrypted files use the same version 1 container as the iOS app:

- AES-256-GCM
- PBKDF2-HMAC-SHA256
- 600,000 derivation rounds
- 32-byte random salt
- CryptoKit-compatible combined AES-GCM payload layout

## Security behavior

- Cryptographic operations run locally through the browser Web Crypto API.
- The raw Master Password is not stored.
- Working vault data is encrypted in `sessionStorage`, not persistent application storage.
- Switching tabs, minimizing, or backgrounding the page removes decrypted state from memory and requires the Master Password again.
- Inactivity expiry deletes the encrypted working session. The available limits are 2, 5, 10, 15, and 30 minutes.
- Users must export a new `.pnvault` before the session ends to retain their changes.
- Pass & Note cannot recover a forgotten Master Password.

This application reduces exposure but cannot protect against a compromised device, malicious browser extensions, clipboard monitoring, screenshots, or someone using an already-unlocked browser.

## Deployment

Deploy the four application files to any static web host. Production hosting must use HTTPS because Web Crypto and related browser security features require a secure context.

Do not add analytics, remote logging, or form-submission services without updating the privacy disclosures and carefully ensuring that vault contents and Master Passwords can never be transmitted.

## Browser support

Use a current version of Safari, Chrome, Edge, or Firefox with support for:

- Web Crypto API
- File and Blob APIs
- `sessionStorage`
- ES2020 JavaScript

## Release checklist

- Test import and export against real iOS-generated files.
- Test incorrect-password and corrupted-file behavior.
- Verify Privacy Lock and every inactivity setting.
- Test desktop, tablet, and mobile layouts.
- Complete publisher, support, privacy, and legal information before public release.
- Serve the production version exclusively over HTTPS.

