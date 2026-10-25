# Security policy

## Report a vulnerability privately

Email **support@passandnote.com** with the subject **Pass & Note security report**.
Include the affected repository, app version or commit, platform/OS or browser,
steps to reproduce using dummy data, the expected and observed behaviour, and
the potential impact. A minimal proof of concept is helpful.

Do not open a public issue or pull request containing an undisclosed vulnerability.
Do not send real Master Passwords, vault keys, encrypted personal backups, private
notes, access tokens, or other personal data. Use a fresh test vault with dummy
records. Email is the reporting channel; do not assume it provides end-to-end
encryption for sensitive attachments.

## Scope and maintenance

Reports are welcome for the iOS app, Android app, and browser recovery viewer:

- https://github.com/siddharthlenka/PassNoteVault
- https://github.com/siddharthlenka/PassAndNoteAndroid
- https://github.com/siddharthlenka/PassAndNoteWeb

Include older-version findings when relevant, but check the latest available
source or release when practical. There is no published long-term support matrix,
guaranteed response time, or bug-bounty programme. Please coordinate disclosure
privately so the developer can investigate and prepare a fix.

## Security expectations

Public source availability is not an independent security audit or verification
that published store binaries match the repository. Device compromise, browser
extensions, and clipboard access can affect the confidentiality of unlocked data.
The developer cannot reset a forgotten Master Password or decrypt a user's backup.

Architecture and limitations: https://passandnote.com/security/
