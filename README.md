# ObsiSync

[![Download for Windows](https://img.shields.io/badge/Download-Windows%20Installer-blue)](https://github.com/Pers8/obsisync/releases/latest)

> Sync your Obsidian vaults to GitHub automatically

ObsiSync is an app that watches your Obsidian vaults and periodically commits & pushes changes to a GitHub repo. It runs from the system tray and shows lightweight in-app toasts. Discord Rich Presence is supported.

---

## Features
- Add multiple vaults, each with its own repo/branch & interval
- Auto-commit and push (only-if-changed option)
- Toast overlay + optional OS notifications
- Quick stats: files, commits, storage size
- Schedulers with per-vault intervals (min 30s)
- Built-in Git history line for latest commit per vault
- Discord Rich Presence

---

## Requirements
- **Windows 10/11**
- **Git** installed and available on **PATH** (`git --version` should work in PowerShell or CMD)
- A **GitHub repository** you own (HTTPS or SSH URL)

---

## Install
1. Download **`ObsiSync-Setup-x.y.z.exe`** from the [Latest Release](https://github.com/Pers8/obsisync/releases/latest).
2. Run the installer and follow the prompts.
3. Launch **ObsiSync** from the Start Menu (it appears in the **system tray**).

---

## Quick Start (How to use)
1. **Add your Obsidian vault** → browse to your vault folder  
2. **Link your repo** → paste SSH or HTTPS URL  
   Example:  
   `git@github.com:username/vault-backup.git`  
   or  
   `https://github.com/username/vault-backup.git`
3. **Set your branch** (`main` by default) and sync interval (in seconds)  
4. Hit **“Sync Now”** to test  
5. The app auto-syncs from the tray at your set interval

---

## Troubleshooting
- **Git not found**  
  Make sure Git is installed and on PATH:  
  <https://git-scm.com/downloads> → reinstall with “Add Git to PATH”.
- **SmartScreen: “Unknown Publisher”**  
  Click **More info → Run anyway**. (Code signing planned.)
- **App window didn’t appear**  
  Look for the **tray icon**. From the tray menu choose **Open ObsiSync**.
- **Nothing is pushing**  
  - Open the vault folder in a terminal and run `git status` to confirm access.  
  - Ensure your repo URL and **branch** are valid and you have **push** rights.  
  - For SSH URLs, make sure your SSH keys are set up.

---

## Privacy & Permissions
- **Files touched:** only within **vaults you add**.  
  - We run `git add/commit/push` inside those folders.  
  - We never read or modify other locations.
- **Local storage:** app settings are saved via `electron-store` in your OS user profile.
- **Network:** Git traffic is done by your local `git` to your configured **GitHub repo**.
- **No telemetry.** No analytics, no tracking.

## Auto-updates
ObsiSync uses **GitHub Releases** for optional self-updates.  
If `electron-updater` is enabled in `main.js`, the app can automatically fetch and install new versions when you publish future releases.

---

## Build from Source
```bash
npm install
npm run dev     # dev environment
npm run build   # production build (creates dist/)
npm run release # build + publish to GitHub (requires GH_TOKEN)
```


## Credits
**Background artwork:** [JimDesignsCo](https://x.com/JimDesignsCo/status/1634618698353848321)  
  Used with credit under fair use / personal use context.
  
Licensed under [CC BY-NC 4.0](./LICENSE) © 2025 Peres Eldad
