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
├── index.html    # Recovery landing page and read-only viewer markup
├── privacy/      # Public Privacy Policy route
├── terms/        # Public Terms & Conditions route
├── styles.css    # Responsive interface and viewer styles
├── app.js        # Password generator, file selection, viewer state, and rendering
└── crypto.js     # Pass & Note container validation and decryption
```

## Deployment

Deploy the four application files to a static web host. Production must use HTTPS. The page includes a restrictive Content Security Policy and makes no application network connections.

Before release:

- Test all three formats against real files exported by the mobile app.
- Test incorrect passwords, corrupted files, and mismatched file extensions.
- Verify background Privacy Lock in supported desktop and mobile browsers.
- Verify the 2, 5, and 10-minute inactivity options and default reset.
- Verify 16, 32, and 64-character password generation and clipboard copying.
- Confirm that the production host does not inject analytics or third-party scripts.
- Complete publisher, support, privacy, and legal information.
