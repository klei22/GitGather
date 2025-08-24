# Git Gather

Browse a Git repository in your browser (files-first tree), pick files, copy their merged contents to your clipboard, save selection groups, and run a safe `git fetch --all && git pull --ff-only` update — all from a tiny Flask app.

---

## Features

- 📁 **Files‑first tree view** – folders come after files for quicker targeting.
- 📋 **Selection chips & clipboard merge** – select multiple files and copy a single merged buffer, with headings per file.
- 💾 **Saved groups & most used** – save common selections and reapply them; frequently used files surface automatically.
- 🔄 **One‑click Git update** – fetch all remotes, pick the branch from a drop‑down, and optionally mirror a nested repo between remotes.
- 🌗 **Light/Dark theme** – toggle persists across sessions.
- ⚙️ **Simple configuration** – auto-detect repo root or set it explicitly in `config.ini`.

![Main interface screenshot placeholder](docs/screenshot-ui.png)

---

## Quick start

### 1) Requirements
- **Python** 3.8+
- **Git** installed and on your `PATH`
- **Flask** ≥ 3.0

### 2) Install

```bash
git clone https://github.com/yourname/git-gather.git
cd git-gather
python -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
pip install -U pip
pip install -r requirements.txt
````

Create a minimal `requirements.txt` (if not present):

```txt
Flask>=3.0
```

### 3) Configure (optional)

Create `config.ini` next to `app.py` to pin a repo path/branch:

```ini
[repo]
# If omitted, Git Gather will auto-detect the parent repo of where it's launched.
# Absolute or ~-expanded path to the Git repo root (must contain .git).
path = /path/to/your/repo

# Branch to fast-forward pull. Defaults to "master" if omitted.
branch = main

[mirror]
# Optional nested repo to mirror between remotes after updating.
# `path` is relative to the repo root above.
path = nanogpt
pull_remote = upstream
push_remote = origin
```

If `path` is omitted, Git Gather will attempt:

```
git rev-parse --show-toplevel
```

and use that as the repo root.

### 4) Run

```bash
python app.py
```

Open your browser to **[http://localhost:9001](http://localhost:9001)**.

> The server binds to `0.0.0.0:9001` by default. If you’re on a shared network, see the **Security** notes below.

---

## Usage

1. **Browse & select**

   * The tree shows **files before folders** for each directory.
   * Expand a folder (▶) and tick the checkboxes for files you want to gather.

2. **Copy to clipboard**

   * Click **Copy** (top-left).
   * Git Gather reads the selected files and merges them into one buffer with human‑readable dividers:

     ```
     --- relative/path/to/file.ext ---
     <file contents>

     --- another/file.txt ---
     <file contents>
     ```
   * The app uses the modern Clipboard API when available (with a safe fallback).

3. **Save groups**

   * After selecting files, click **Save group** to name and store the selection.
   * Reapply a group anytime via **Saved groups**.

4. **Most used**

   * The **Most used** panel shows frequently copied files (tracked locally in your browser).

5. **Update the repo**

   ![Branch selector screenshot placeholder](docs/branch-dropdown.png)

   * Pick a branch from the drop‑down and click **Update** to run:

    ```bash
    git fetch --all
    git pull --ff-only origin <branch>
    git pull <pull_remote> <branch>:<branch>   # if [mirror] configured
    git push <push_remote> <branch>:<branch>   # if [mirror] configured
    ```
   * Output is shown in an alert; on success the page reloads.

6. **Theme**

   * Toggle **Light / Dark**; preference is saved in `localStorage`.

---

## How it works (code map)

* **`app.py`**

  * `get_repo_root()`

    * Uses `config.ini` if present; else auto-detects the parent repo via `git rev-parse --show-toplevel`.
    * Verifies the repo has a `.git` directory.
  * `build_tree(base, sub=".")`

    * Recursively builds a nested JSON tree.
    * **Sort order:** `files first, folders after`; case-insensitive by name.
    * Skips `.git` and entries starting with `.git`.
  * `read_files` (POST `/read-files`)

    * Accepts `{"paths": ["relative/file1", "dir/file2", ...]}`.
    * Safely validates paths are inside the repo root and merges contents with dividers.
    * Returns `{"merged": "<text>"}`.
  * `update_repo_route` (POST `/update-repo`)

    * Runs `git fetch --all --prune` then `git pull --ff-only origin <branch>`.
    * Returns `{"ok": true/false, "log": "<combined stdout+stderr>"}`.
* **Templates & static**

  * `templates/index.html`

    * Injects the tree JSON, basic layout, and theme tokens.
  * `static/main.js`

    * Renders the tree, handles selection chips, saved groups, most-used counts, clipboard copy, and update flow.
    * Uses `localStorage` for groups and usage counts.

---

## API (if you want to script it)

> Endpoints are intended primarily for the built-in UI but can be scripted.

### `POST /read-files`

* **Body (JSON):**

  ```json
  { "paths": ["relative/path/to/file1", "relative/path/to/file2"] }
  ```
* **Response (JSON):**

  ```json
  { "merged": "...\n--- file1 ---\n...\n--- file2 ---\n..." }
  ```

### `POST /update-repo`

* **Response (JSON):**

  ```json
  { "ok": true, "log": "$ git fetch ...\n..." }
  ```

  or

  ```json
  { "ok": false, "log": "error details" }
  ```

---

## Security & deployment notes

* **Trust boundary**: Git Gather serves files from a Git working tree you control. Do not expose it to untrusted users; there is no authentication.
* **Path safety**: Requests are constrained to the configured repo root. The server rejects paths outside the repo.
* **Clipboard**: Modern browsers may require user interaction/permissions for clipboard access. The app includes a safe fallback.
* **Network**: The default bind is `0.0.0.0`. Prefer `127.0.0.1` if you don’t need LAN access, or front it with a reverse proxy + auth.
* **Git update**: The update action assumes a remote named `origin` and will **fast‑forward only** to avoid accidental merge commits. Ensure your `branch` exists on `origin`.
* **Static caching**: Static files are sent with conditional requests enabled.

---

## Configuration details

**`config.ini`**

```ini
[repo]
# Absolute or ~-expanded path to the repo root (must contain .git).
# If omitted, Git Gather uses `git rev-parse --show-toplevel`.
path = /abs/or/tilde/expanded/path

# The branch Git Gather will fast-forward pull from origin.
# Defaults to "master" if missing or empty.
branch = main

# Optional nested repo to mirror between remotes after a pull.
# `path` is relative to the repo root; omit this section to skip mirroring.
[mirror]
path = nanogpt
pull_remote = upstream
push_remote = origin
```

If `path` is set to a non-repo, the server returns an error. If you run Git Gather **inside** a Git repo and omit `path`, it will use that repo automatically.

---

## Troubleshooting

* **“Not inside a Git repo…”**

  * Either run Git Gather from within a repo, or set `[repo].path` in `config.ini`.
* **Update fails with remote/branch errors**

  * Confirm `origin` exists and the configured `branch` exists on `origin`. Try `git remote -v` and `git branch -vv`.
* **Clipboard copy doesn’t work**

  * Some browsers restrict clipboard on non‑secure origins. The app falls back to a compatible method; make sure you clicked the **Copy** button directly (user gesture).
* **Missing files in the tree**

  * Entries starting with `.git` are skipped by design (e.g., `.git`, `.gitignore`, `.gitattributes`).

---

## Roadmap (ideas)

* Search/filter within the tree.
* Include/exclude glob presets.
* Download gathered selection as a single file.
* Optional basic auth middleware for shared environments.
* Keyboard shortcuts.

---

## What’s new

* **Files‑first sorting** – `build_tree()` now emits files before folders for faster picking.

---

## License

 MIT LICENSE

---

## Acknowledgments

Built with **Flask** and the standard library.
