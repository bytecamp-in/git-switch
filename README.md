# GitSwitch (`gitswitch`)

> 🚀 Effortlessly manage and switch between multiple GitHub and Git accounts from your terminal with a single command — including **automatic Windows Credential Manager caching & switching**.

[![npm version](https://img.shields.io/badge/npm-v1.0.0-blue.svg)](https://www.npmjs.com/)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)]()

---

## 🌟 Features

- **Multi-Account Git Config**: Switch `git config user.name` and `user.email` instantly.
- **Windows Credential Manager Integration**:
  - Automatically captures and caches active GitHub tokens before switching.
  - Executes `cmdkey /delete:LegacyGeneric:target=git:https://github.com` so git won't reuse the old account.
  - Automatically restores the target account's cached token into Windows Credential Manager so you can `git push`/`git pull` without re-authenticating every time.
- **Exact Syntax Match**: Supports `-uname`, `-uemail`, `-token`, as well as standard GNU flags.
- **Interactive Terminal UI**: Run `github switch` without arguments for an interactive picker.
- **Security-First**: Tokens are stored privately in `~/.gitswitch/credentials.json` with restricted permissions and masked in CLI outputs.
- **Command Aliases**: Registered under `github`, `gitswitch`, and `git-switch`.

---

## 📦 Installation

```bash
npm install -g gitswitch
```

Or clone and link locally:
```bash
cd c:\Projects\github-switch
npm install
npm link
```

---

## 🔐 How Credential Caching & Switching Works

When you push or pull over HTTPS, Git Credential Manager stores your GitHub login in Windows Credential Manager under:
```text
Target: LegacyGeneric:target=git:https://github.com
```

When you switch between accounts with GitSwitch:
```text
Account A (active in Windows Credential Manager)
        │
        ▼  [Run: github switch "Account B"]
1. Reads and safely caches Account A's token/credential in GitSwitch
2. Executes: cmdkey /delete:LegacyGeneric:target=git:https://github.com
3. Updates: git config --global user.name "Account B"
4. Updates: git config --global user.email "accountB@email.com"
5. Takes Account B's cached token and restores it into Windows Credential Manager!
        │
        ▼
Account B is now active for both git commits AND git push/pull!
```

When you switch back to Account A (`github switch "Account A"`):
- Account B's token is saved to cache.
- Windows Credential Manager is cleared.
- Account A's token is restored back into Windows Credential Manager.

---

## 💻 CLI Commands

### 1. View all saved accounts

```bash
github list
# alias: github ls
```

Displays registered accounts, git status, and whether credentials are cached:

```text
Registered GitHub Accounts:
┌──────────────┬───────────────┬───────────────────┬─────────────┬─────────┬──────────────┐
│ Status       │ Username      │ Email             │ Credentials │ SSH Key │ Added / Used │
├──────────────┼───────────────┼───────────────────┼─────────────┼─────────┼──────────────┤
│ ● Active     │ bytecamp-in   │ dev@bytecamp.in   │ ✔ Cached    │ none    │ used today   │
├──────────────┼───────────────┼───────────────────┼─────────────┼─────────┼──────────────┤
│ -            │ personal-dev  │ me@gmail.com      │ ✔ Cached    │ none    │ added 9/11   │
└──────────────┴───────────────┴───────────────────┴─────────────┴─────────┴──────────────┘
```

---

### 2. Add an account

```bash
# Add with username and email
github add -uname "username" -uemail "email"

# Add with token upfront
github add -uname "username" -uemail "email" -token "ghp_yourTokenHere"
```

---

### 3. Switch active account (with credential swap)

```bash
github switch "username"
# or by email:
github switch "email@example.com"
```

Output:
```text
ℹ Cached active credential for bytecamp-in
ℹ Cleared Windows Credential Manager: cmdkey /delete:LegacyGeneric:target=git:https://github.com
✔ Switched to GitHub account: personal-dev <me@gmail.com> [global]
✔ Restored cached credentials for personal-dev into Windows Credential Manager
```

*Options:*
- `github switch` (interactive arrow-key selector)
- `github switch "username" --local` (switch only inside the current repository)
- `github switch "username" --no-cred` (skip modifying Windows Credential Manager)

---

### 4. Remove an account

```bash
github remove -uname "username"
github remove -uemail "email"
```
*Also removes any cached credentials for that account.*

---

### 5. View current configuration status

```bash
github current
```

Shows:
- Global and local repository `git config`
- Matching GitSwitch profile
- Active Windows Credential Manager entry for `git:https://github.com`

---

### 6. Manage Windows Credential Manager & Tokens directly

GitSwitch provides the `github cred` command:

```bash
# Check Windows Credential Manager status & cached tokens
github cred status

# Explicitly save current Windows Credential Manager token to GitSwitch cache
github cred save

# Manually store or update a token for a user
github cred set <username> [token]

# Restore a cached user token into Windows Credential Manager
github cred restore <username>

# Clear GitHub entry from Windows Credential Manager
github cred clear
```

---

## 🧪 Testing

```bash
npm test
```

All 21 unit and integration tests run via Vitest:
- Argument normalization (`-uname`, `-uemail`, `-token`)
- Configuration store
- Credential caching & masking
- CLI integration (switching, credential swapping, `cmdkey` command calls)

---

## 📄 License

[MIT](LICENSE) © 2026 GitSwitch Contributors
