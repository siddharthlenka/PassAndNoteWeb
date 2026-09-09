# Pass & Note Recovery Viewer

Pass & Note Recovery Viewer is a read-only browser companion for the Pass & Note mobile app. It helps users access passwords and secure notes from an encrypted mobile export when their phone is unavailable.

The website does not create a vault, modify records, encrypt new files, or save decrypted data.

The homepage also includes a local password generator with 16, 32, and 64-character options. It uses the browser's cryptographically secure random generator, defaults to 32 characters, and does not store generated passwords.

## Supported files

| Extension | Contents |
| --- | --- |
| `.pnvault` | Complete encrypted backup containing passwords and notes |
| `.pnpass` | Encrypted package containing password records |
| `.pnnote` | Encrypted package containing secure notes |

The files use the Pass & Note version 1 container:

- AES-256-GCM
- PBKDF2-HMAC-SHA256
- 600,000 derivation rounds for current mobile exports
- 32-byte random salt
- CryptoKit-compatible combined AES-GCM payload layout

## Viewer workflow

1. Select a compatible encrypted export.
2. Enter the Master Password used when the mobile app created that file.
3. Read the decrypted passwords or notes.
4. Reveal or copy a password when necessary.
5. Close the file to clear all readable values.

No decrypted download, record editing, or web export is available.

## Getting a file from mobile

- Complete vault: **Vault → Export Vault → Confirm Master Password → Save**
- Passwords: **Passwords → Export → Confirm Master Password → Save**
- Notes: **Notes → Export → Confirm Master Password → Save**

The mobile app remains the primary place to create, edit, organize, import, and export vault data.

## Privacy and session behavior

- Decryption runs locally through the Web Crypto API.
- The selected file, Master Password, and decrypted values are not intentionally transmitted to a Pass & Note server.
- The website does not use `localStorage` or `sessionStorage` for vault data.
- The Master Password is cleared from its input after each attempt.
- Sending the page into the background removes readable values from the DOM and activates Privacy Lock.
- Privacy Lock requires the Master Password again to restore the view.
- Two minutes of inactivity clears the selected file and all recovery data by default.
- Viewer Settings can extend the current file session to 5 or 10 minutes.
- The selected timer exists only in memory and resets to 2 minutes for the next file.
- Closing the file clears recovery data immediately.

This model cannot protect against a compromised device, malicious browser extension, clipboard monitoring, screenshots, or another person viewing an already-unlocked screen.

## Run locally

The project has no build step or runtime dependencies. Serve the directory over HTTP:

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000).

## Project files

```text
.
├── assets/       # App icon used for browser tabs and mobile downloads
├── index.html    # Recovery landing page and read-only viewer markup
├── security/     # Mobile security architecture, threat model, and specifications
├── privacy/      # Public Privacy Policy route
├── terms/        # Public Terms & Conditions route
├── styles.css    # Responsive interface and viewer styles
├── app.js        # Password generator, file selection, viewer state, and rendering
└── crypto.js     # Pass & Note container validation and decryption
```

## Deployment

Deploy the application files, assets directory, and security, privacy, and terms directories to a static web host. Production must use HTTPS. The page includes a restrictive Content Security Policy and makes no application network connections.

Before release:

- Test all three formats against real files exported by the mobile app.
- Test incorrect passwords, corrupted files, and mismatched file extensions.
- Verify background Privacy Lock in supported desktop and mobile browsers.
- Verify the 2, 5, and 10-minute inactivity options and default reset.
- Verify 16, 32, and 64-character password generation and clipboard copying.
- Confirm that the production host does not inject analytics or third-party scripts.
- Complete publisher, support, privacy, and legal information.

## App download links

The homepage has a **Get the app** section linking to the App Store and Google Play. To update either URL, edit the corresponding `href` in the `download` section of `index.html`. The shared website icon is `assets/app-icon.png`.

## Security architecture content

`security/index.html` explains the mobile vault key hierarchy, platform-specific storage and biometric behavior, locking, encrypted exports, browser recovery, threat model, architectural comparison, technical specifications, and FAQ. The homepage links to it and summarizes the mobile protections before the recovery viewer.

The September 2026 content was checked against the local iOS and Android implementations: vault key/envelope services, database opening and password change flows, backup encryption, biometric services, lifecycle and clipboard controls, and dependency declarations. iOS declares SQLCipher 4.10.0 and GRDB.swift 6.24.1; Android declares SQLCipher 4.17.0. SQLCipher defaults are identified as defaults and linked to the upstream documentation. This describes the inspected source, not a verification of published store binaries or an independent audit.

When changing security copy, check the matching implementation and dependency versions. Keep mobile vault encryption separate from export encryption, privacy shielding separate from database locking, and mobile clipboard expiration separate from the browser viewer’s clipboard behavior.
