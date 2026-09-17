#!/usr/bin/env python3
"""
Run 4 palette-class retirement codemod.
Replaces Tailwind palette classes with semantic CSS custom property tokens.

Usage: python3 scripts/run4-palette-codemod.py [--cluster <name>] [--dry-run]
"""

import re
import sys
import os
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
UI_SRC = REPO_ROOT / "ui" / "src"
SCAN_DIRS = [UI_SRC / "components", UI_SRC / "pages"]

DRY_RUN = "--dry-run" in sys.argv
CLUSTER = None
for i, a in enumerate(sys.argv):
    if a == "--cluster" and i + 1 < len(sys.argv):
        CLUSTER = sys.argv[i + 1]

# Files to skip entirely
SKIP_FILES = {
    "InviteLanding.tsx",  # third-party chrome allowlisted
    "DesignGuide.tsx",    # design reference, keep palette for illustration
}

deltas = []  # (file, old_class, new_class, note)

# ──────────────────────────────────────────────────────────────────────────────
# Cluster 1: Red / Rose  → --destructive / --status-task-blocked
# ──────────────────────────────────────────────────────────────────────────────

def apply_red_cluster(content: str, filepath: str) -> str:
    fname = os.path.basename(filepath)

    # 1a. Solid status/badge backgrounds: bg-red-{500,600,700} → bg-(--status-task-blocked)
    content = re.sub(
        r'\bbg-red-(5\d\d|6\d\d|7\d\d)\b',
        'bg-(--status-task-blocked)',
        content
    )

    # 1b. bg-rose-{500,600} → bg-(--status-task-blocked)
    content = re.sub(
        r'\bbg-rose-(5\d\d|6\d\d)\b',
        'bg-(--status-task-blocked)',
        content
    )

    # 1c. Light wash backgrounds: bg-red-{50,100,200} → bg-(--destructive)/8
    def red_bg_wash(m):
        shade = int(m.group(1))
        if shade <= 50:
            return 'bg-(--destructive)/6'
        elif shade <= 100:
            return 'bg-(--destructive)/10'
        else:
            return 'bg-(--destructive)/15'
    content = re.sub(r'\bbg-red-(\d{2,3})\b', lambda m: red_bg_wash(m) if int(m.group(1)) < 300 else m.group(0), content)

    # 1d. bg-rose-{50,100} → bg-(--destructive)/8
    content = re.sub(r'\bbg-rose-(\d{2,3})\b', lambda m: 'bg-(--destructive)/8' if int(m.group(1)) < 300 else 'bg-(--status-task-blocked)' if int(m.group(1)) < 700 else 'bg-(--destructive)', content)

    # 1e. Dark: bg-red-950/20 pattern (inline opacity) → already removed above via wash

    # 2. Text colors: text-red-{any} → text-(--destructive)
    #    Also remove trailing dark:text-red-{any} in same class string
    def red_text_replace(m):
        full = m.group(0)
        deltas.append((fname, full, 'text-(--destructive)', 'red text → destructive'))
        return 'text-(--destructive)'
    content = re.sub(r'\btext-red-\d{2,3}\b', red_text_replace, content)

    # 2b. text-rose-{any} → text-(--destructive)
    content = re.sub(r'\btext-rose-\d{2,3}\b', 'text-(--destructive)', content)

    # 3. dark:text-red-{any} / dark:text-rose-{any} → remove (handled by token dark mode)
    content = re.sub(r'\bdark:text-(?:red|rose)-\d{2,3}\b\s*', '', content)

    # 4. dark:bg-red-{any}(/{opacity})? → remove (token handles dark mode)
    content = re.sub(r'\bdark:bg-(?:red|rose)-\d{2,3}(?:/\d+)?\b\s*', '', content)

    # 5. Border colors
    content = re.sub(r'\bborder-red-\d{2,3}(?:/\d+)?\b', 'border-(--destructive)/25', content)
    content = re.sub(r'\bborder-rose-\d{2,3}(?:/\d+)?\b', 'border-(--destructive)/25', content)
    content = re.sub(r'\bdark:border-(?:red|rose)-\d{2,3}(?:/\d+)?\b\s*', '', content)

    # 6. Ring colors
    content = re.sub(r'\bring-red-\d{2,3}\b', 'ring-(--destructive)', content)
    content = re.sub(r'\bdark:ring-(?:red|rose)-\d{2,3}\b\s*', '', content)

    # 7. Clean up double spaces left by removal of dark: variants
    content = re.sub(r'  +', ' ', content)
    content = re.sub(r'" ', '"', content)  # trailing space before closing quote
    content = re.sub(r' "', '"', content)  # space before quote

    return content


# ──────────────────────────────────────────────────────────────────────────────
# Cluster 2: Green / Emerald  → --status-task-done
# ──────────────────────────────────────────────────────────────────────────────

def apply_green_cluster(content: str, filepath: str) -> str:
    fname = os.path.basename(filepath)

    # Solid fills
    content = re.sub(r'\bbg-(?:green|emerald)-(?:4\d\d|5\d\d|6\d\d)\b', 'bg-(--status-task-done)', content)
    # Light washes
    content = re.sub(r'\bbg-(?:green|emerald)-(\d{2,3})\b', lambda m: 'bg-(--status-task-done)/10' if int(m.group(1)) < 300 else m.group(0), content)
    # Text
    content = re.sub(r'\btext-(?:green|emerald)-\d{2,3}\b', 'text-(--status-task-done)', content)
    content = re.sub(r'\bdark:text-(?:green|emerald)-\d{2,3}\b\s*', '', content)
    content = re.sub(r'\bdark:bg-(?:green|emerald)-\d{2,3}(?:/\d+)?\b\s*', '', content)
    # Border
    content = re.sub(r'\bborder-(?:green|emerald)-\d{2,3}(?:/\d+)?\b', 'border-(--status-task-done)/30', content)
    content = re.sub(r'\bdark:border-(?:green|emerald)-\d{2,3}(?:/\d+)?\b\s*', '', content)

    content = re.sub(r'  +', ' ', content)
    return content


# ──────────────────────────────────────────────────────────────────────────────
# Cluster 3: Amber / Yellow → --status-task-todo
# ──────────────────────────────────────────────────────────────────────────────

def apply_amber_cluster(content: str, filepath: str) -> str:
    # Solid fills
    content = re.sub(r'\bbg-(?:amber|yellow)-(?:4\d\d|5\d\d|6\d\d)\b', 'bg-(--status-task-todo)', content)
    # Light washes
    content = re.sub(r'\bbg-(?:amber|yellow)-(\d{2,3})\b', lambda m: 'bg-(--status-task-todo)/10' if int(m.group(1)) < 300 else m.group(0), content)
    # Text
    content = re.sub(r'\btext-(?:amber|yellow)-\d{2,3}\b', 'text-(--status-task-todo)', content)
    content = re.sub(r'\bdark:text-(?:amber|yellow)-\d{2,3}\b\s*', '', content)
    content = re.sub(r'\bdark:bg-(?:amber|yellow)-\d{2,3}(?:/\d+)?\b\s*', '', content)
    # Border
    content = re.sub(r'\bborder-(?:amber|yellow)-\d{2,3}(?:/\d+)?\b', 'border-(--status-task-todo)/30', content)
    content = re.sub(r'\bdark:border-(?:amber|yellow)-\d{2,3}(?:/\d+)?\b\s*', '', content)

    content = re.sub(r'  +', ' ', content)
    return content


# ──────────────────────────────────────────────────────────────────────────────
# Cluster 4: Blue / Sky / Cyan / Indigo → --status-task-in_progress
# ──────────────────────────────────────────────────────────────────────────────

def apply_blue_cluster(content: str, filepath: str) -> str:
    # Solid fills
    content = re.sub(r'\bbg-(?:blue|sky|cyan|indigo)-(?:4\d\d|5\d\d|6\d\d)\b', 'bg-(--status-task-in_progress)', content)
    # Light washes
    content = re.sub(r'\bbg-(?:blue|sky|cyan|indigo)-(\d{2,3})\b', lambda m: 'bg-(--status-task-in_progress)/10' if int(m.group(1)) < 300 else m.group(0), content)
    # Text
    content = re.sub(r'\btext-(?:blue|sky|cyan|indigo)-\d{2,3}\b', 'text-(--status-task-in_progress)', content)
    content = re.sub(r'\bdark:text-(?:blue|sky|cyan|indigo)-\d{2,3}\b\s*', '', content)
    content = re.sub(r'\bdark:bg-(?:blue|sky|cyan|indigo)-\d{2,3}(?:/\d+)?\b\s*', '', content)
    # Border
    content = re.sub(r'\bborder-(?:blue|sky|cyan|indigo)-\d{2,3}(?:/\d+)?\b', 'border-(--status-task-in_progress)/30', content)
    content = re.sub(r'\bdark:border-(?:blue|sky|cyan|indigo)-\d{2,3}(?:/\d+)?\b\s*', '', content)

    content = re.sub(r'  +', ' ', content)
    return content


# ──────────────────────────────────────────────────────────────────────────────
# Cluster 5: Violet / Purple → --status-task-in_review
# ──────────────────────────────────────────────────────────────────────────────

def apply_violet_cluster(content: str, filepath: str) -> str:
    content = re.sub(r'\bbg-(?:violet|purple)-(?:4\d\d|5\d\d|6\d\d)\b', 'bg-(--status-task-in_review)', content)
    content = re.sub(r'\bbg-(?:violet|purple)-(\d{2,3})\b', lambda m: 'bg-(--status-task-in_review)/10' if int(m.group(1)) < 300 else m.group(0), content)
    content = re.sub(r'\btext-(?:violet|purple)-\d{2,3}\b', 'text-(--status-task-in_review)', content)
    content = re.sub(r'\bdark:text-(?:violet|purple)-\d{2,3}\b\s*', '', content)
    content = re.sub(r'\bdark:bg-(?:violet|purple)-\d{2,3}(?:/\d+)?\b\s*', '', content)
    content = re.sub(r'\bborder-(?:violet|purple)-\d{2,3}(?:/\d+)?\b', 'border-(--status-task-in_review)/30', content)
    content = re.sub(r'\bdark:border-(?:violet|purple)-\d{2,3}(?:/\d+)?\b\s*', '', content)
    content = re.sub(r'  +', ' ', content)
    return content


# ──────────────────────────────────────────────────────────────────────────────
# Cluster 6: Zinc / Slate / Gray / Neutral → muted-foreground, border, etc.
# ──────────────────────────────────────────────────────────────────────────────

def apply_neutral_cluster(content: str, filepath: str) -> str:
    # Text: zinc/slate/gray/neutral → muted-foreground
    content = re.sub(r'\btext-(?:zinc|slate|gray|neutral)-\d{2,3}\b', 'text-(--muted-foreground)', content)
    content = re.sub(r'\bdark:text-(?:zinc|slate|gray|neutral)-\d{2,3}\b\s*', '', content)

    # bg: light shades → muted/accent; dark shades → card/background
    def neutral_bg(m):
        shade = int(m.group(2))
        if shade <= 200:
            return 'bg-(--muted)'
        elif shade <= 400:
            return 'bg-(--accent)'
        elif shade <= 600:
            return 'bg-(--muted-foreground)/20'
        elif shade <= 800:
            return 'bg-(--card)'
        else:
            return 'bg-(--background)'
    content = re.sub(r'\bbg-(zinc|slate|gray|neutral)-(\d{2,3})\b', neutral_bg, content)
    content = re.sub(r'\bdark:bg-(?:zinc|slate|gray|neutral)-\d{2,3}(?:/\d+)?\b\s*', '', content)

    # Border
    content = re.sub(r'\bborder-(?:zinc|slate|gray|neutral)-\d{2,3}(?:/\d+)?\b', 'border-(--border)', content)
    content = re.sub(r'\bdark:border-(?:zinc|slate|gray|neutral)-\d{2,3}(?:/\d+)?\b\s*', '', content)

    content = re.sub(r'  +', ' ', content)
    return content


# ──────────────────────────────────────────────────────────────────────────────
# Cluster 7: Orange → --status-task-todo (warning-adjacent)
# ──────────────────────────────────────────────────────────────────────────────

def apply_orange_cluster(content: str, filepath: str) -> str:
    content = re.sub(r'\bbg-orange-(?:4\d\d|5\d\d|6\d\d)\b', 'bg-(--status-task-todo)', content)
    content = re.sub(r'\bbg-orange-(\d{2,3})\b', lambda m: 'bg-(--status-task-todo)/10' if int(m.group(1)) < 300 else m.group(0), content)
    content = re.sub(r'\btext-orange-\d{2,3}\b', 'text-(--status-task-todo)', content)
    content = re.sub(r'\bdark:text-orange-\d{2,3}\b\s*', '', content)
    content = re.sub(r'\bdark:bg-orange-\d{2,3}(?:/\d+)?\b\s*', '', content)
    content = re.sub(r'\bborder-orange-\d{2,3}(?:/\d+)?\b', 'border-(--status-task-todo)/30', content)
    content = re.sub(r'\bdark:border-orange-\d{2,3}(?:/\d+)?\b\s*', '', content)
    content = re.sub(r'  +', ' ', content)
    return content


# ──────────────────────────────────────────────────────────────────────────────
# Orchestration
# ──────────────────────────────────────────────────────────────────────────────

CLUSTERS = {
    'red': ('red|rose', apply_red_cluster),
    'green': ('green|emerald', apply_green_cluster),
    'amber': ('amber|yellow', apply_amber_cluster),
    'blue': ('blue|sky|cyan|indigo', apply_blue_cluster),
    'violet': ('violet|purple', apply_violet_cluster),
    'neutral': ('zinc|slate|gray|neutral', apply_neutral_cluster),
    'orange': ('orange', apply_orange_cluster),
}

palette_pattern = re.compile(
    r'\b(bg|text|border|ring|fill|stroke)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|zinc|slate|gray|neutral|stone)-\d{2,3}\b'
)


def has_palette_classes(content: str, colors: str) -> bool:
    pat = re.compile(
        r'\b(bg|text|border|ring|fill|stroke)-(' + colors + r')-\d{2,3}\b'
    )
    return bool(pat.search(content))


def process_file(path: Path, cluster_name: str, apply_fn, colors: str) -> bool:
    """Returns True if file was modified."""
    fname = path.name
    if fname in SKIP_FILES:
        return False

    content = path.read_text(encoding='utf-8')
    if not has_palette_classes(content, colors):
        return False

    new_content = apply_fn(content, str(path))

    if new_content == content:
        return False

    if DRY_RUN:
        print(f"  [DRY] would modify: {path.relative_to(REPO_ROOT)}")
        return True

    path.write_text(new_content, encoding='utf-8')
    print(f"  modified: {path.relative_to(REPO_ROOT)}")
    return True


def run_cluster(name: str):
    colors, apply_fn = CLUSTERS[name]
    print(f"\n=== Cluster: {name} ===")
    changed = []
    for scan_dir in SCAN_DIRS:
        for path in sorted(scan_dir.rglob('*.tsx')):
            if '.test.' in path.name or '.stories.' in path.name:
                continue
            if process_file(path, name, apply_fn, colors):
                changed.append(path)
    print(f"  {len(changed)} files changed")
    return changed


# Main
if CLUSTER:
    if CLUSTER not in CLUSTERS:
        print(f"Unknown cluster: {CLUSTER}. Valid: {list(CLUSTERS.keys())}")
        sys.exit(1)
    run_cluster(CLUSTER)
else:
    total = 0
    for name in CLUSTERS:
        changed = run_cluster(name)
        total += len(changed)
    print(f"\nTotal files changed: {total}")

if deltas:
    print(f"\nVisible deltas recorded: {len(deltas)}")
