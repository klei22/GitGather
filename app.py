"""
Flask repo‑picker with Clipboard & Git‑update support
———————————————————————————————————————————————
Changes since v2:
• build_tree() now sorts so *files first, folders after*.
"""

from pathlib import Path
import subprocess, configparser
from flask import (
    Flask, render_template, jsonify, request, abort, send_from_directory
)

# ── configuration ───────────────────────────────────────────────────
APP_DIR  = Path(__file__).parent
CFG_FILE = APP_DIR / "config.ini"

def load_config():
    cfg = configparser.ConfigParser()
    if CFG_FILE.exists():
        cfg.read(CFG_FILE)
        sec = cfg["repo"]
        return {
            "path": sec.get("path", "").strip() or None,
            "branch": sec.get("branch", "master").strip() or "master",
        }
    return {"path": None, "branch": "master"}

CONF = load_config()

# ── helpers ─────────────────────────────────────────────────────────
def get_repo_root() -> Path:
    """Repo from config or parent‑git autodetect."""
    if CONF["path"]:
        root = Path(CONF["path"]).expanduser().resolve()
        if not (root / ".git").exists():
            abort(500, f'"{root}" is not a Git repo')
        return root
    try:
        return Path(subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"], text=True).strip())
    except subprocess.CalledProcessError:
        abort(500, "Not inside a Git repo and no path set in config.ini")

def build_tree(base: Path, sub: Path = Path(".")) -> dict:
    """Return nested dict, with *files first* then folders, .git excluded."""
    full = base / sub
    if full.is_dir():
        children_paths = sorted(
            (p for p in full.iterdir() if not p.name.startswith(".git")),
            key=lambda p: (p.is_dir(), p.name.lower())   # files (False) before dirs (True)
        )
        return {
            "name": full.name if sub != Path(".") else (full.name or "/"),
            "path": str(sub),
            "type": "dir",
            "children": [build_tree(base, sub / p.name) for p in children_paths],
        }
    return {"name": full.name, "path": str(sub), "type": "file", "children": []}

def update_repo(repo_root: Path) -> str:
    cmds = [
        ["git", "-C", str(repo_root), "fetch", "--all", "--prune"],
        ["git", "-C", str(repo_root), "pull", "--ff-only", "origin", CONF["branch"]],
    ]
    out = []
    for cmd in cmds:
        proc = subprocess.run(cmd, capture_output=True, text=True)
        out.append(f"$ {' '.join(cmd)}\n{proc.stdout}{proc.stderr}")
        if proc.returncode != 0:
            raise RuntimeError(" ".join(cmd) + f" failed ({proc.returncode})")
    return "\n".join(out)

# ── flask app ───────────────────────────────────────────────────────
app = Flask(__name__)

@app.route("/")
def index():
    root = get_repo_root()
    return render_template(
        "index.html",
        tree=build_tree(root),
        branch=CONF["branch"]
    )

@app.route("/read-files", methods=["POST"])
def read_files():
    root  = get_repo_root()
    paths = request.json.get("paths", [])
    if not isinstance(paths, list):
        abort(400, "JSON must contain 'paths' list.")
    parts = []
    for rel in paths:
        f = root / rel
        try:
            f.relative_to(root)
        except ValueError:
            abort(400, f"Illegal path {rel}")
        if f.is_file():
            parts.append(f"\n\n--- {rel} ---\n{f.read_text(errors='replace')}")
    return jsonify({"merged": "".join(parts)})

@app.route("/update-repo", methods=["POST"])
def update_repo_route():
    try:
        log = update_repo(get_repo_root())
        return jsonify({"ok": True, "log": log})
    except RuntimeError as e:
        return jsonify({"ok": False, "log": str(e)}), 500

@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename, conditional=True)

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=9001)
