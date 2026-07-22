#!/usr/bin/env python3
"""Vendor Android/Kotlin/Compose skills into .claude/skills/ with baseline+diff updates.

용법:
    python3 parfait/script/vendor.py --full [--dry-run]     # 전량 벤더(초기 설치)
    python3 parfait/script/vendor.py --update [--dry-run]   # baseline 대비 delta 업데이트

규약: stdlib 전용. repo 루트 = Path(__file__).resolve().parents[2].
"""
import argparse
import json
import re
import shutil
import subprocess
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]   # parfait/script/vendor.py → repo 루트
SKILLS_DIR = REPO_ROOT / ".claude" / "skills"
VENDOR_DIR = REPO_ROOT / ".claude" / "skills-vendor"
CACHE = VENDOR_DIR / ".cache"
SOURCES = VENDOR_DIR / "sources.json"
BASELINE_JSON = VENDOR_DIR / "baseline.json"
MANIFEST_JSON = VENDOR_DIR / "manifest.json"
LICENSES = VENDOR_DIR / "licenses"


def run(cmd, cwd=None):
    return subprocess.run(cmd, cwd=cwd, check=True, capture_output=True, text=True).stdout


def leaf_name(skill_md_path):
    return Path(skill_md_path).parent.name


def _is_skill_path(p):
    return p.endswith("SKILL.md") and not any(seg.startswith(".") for seg in p.split("/"))


def default_branch(url):
    out = run(["git", "ls-remote", "--symref", url, "HEAD"])
    m = re.search(r"ref:\s+refs/heads/(\S+)\s+HEAD", out)
    return m.group(1) if m else "main"


def sync_cache(repo):
    dest = CACHE / repo["name"]
    if not dest.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        run(["git", "clone", "--filter=blob:none", repo["url"], str(dest)])
    branch = repo.get("branch") or default_branch(repo["url"])
    run(["git", "fetch", "origin", branch], cwd=dest)
    run(["git", "checkout", branch], cwd=dest)
    run(["git", "reset", "--hard", f"origin/{branch}"], cwd=dest)
    sha = run(["git", "rev-parse", "HEAD"], cwd=dest).strip()
    return dest, branch, sha


def discover(cache, ref):
    out = run(["git", "ls-tree", "-r", "--name-only", ref], cwd=cache)
    return [p for p in out.splitlines() if _is_skill_path(p) and "/" in p]


def copy_skill(cache, skill_md_rel, leaf):
    src = cache / Path(skill_md_rel).parent
    dst = SKILLS_DIR / leaf
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns(".git*"))


def affected(diff_text):
    res = {}
    for line in diff_text.splitlines():
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        status, path = parts[0], parts[-1]
        if not _is_skill_path(path) or "/" not in path:
            continue
        res[leaf_name(path)] = "del" if status.startswith("D") else "mod"
    return res


def _copy_license(cache, name):
    for lic in ("LICENSE", "LICENSE.txt", "LICENSE.md"):
        p = cache / lic
        if p.exists():
            LICENSES.mkdir(parents=True, exist_ok=True)
            shutil.copy(p, LICENSES / f"{name}.LICENSE")
            return


def _resolve_leaf(md, repo_name, seen):
    leaf = leaf_name(md)
    if leaf in seen:                       # 충돌 시 repo 접두사
        leaf = f"{repo_name.split('-')[0]}-{leaf}"
    seen[leaf] = repo_name
    return leaf


def full_vendor(dry=False):
    sources = json.loads(SOURCES.read_text())["repos"]
    baseline, manifest, seen = {}, {}, {}
    for repo in sources:
        cache, branch, sha = sync_cache(repo)
        baseline[repo["name"]] = {"sha": sha, "branch": branch, "url": repo["url"]}
        for md in discover(cache, "HEAD"):
            leaf = _resolve_leaf(md, repo["name"], seen)
            manifest[leaf] = {"repo": repo["name"], "path": md, "sha": sha}
            if not dry:
                copy_skill(cache, md, leaf)
        if not dry:
            _copy_license(cache, repo["name"])
    if not dry:
        BASELINE_JSON.write_text(json.dumps(baseline, indent=2, ensure_ascii=False) + "\n")
        MANIFEST_JSON.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
        render_docs(baseline, manifest)
    return baseline, manifest


def _desc_of(leaf):
    md = SKILLS_DIR / leaf / "SKILL.md"
    if not md.exists():
        return ""
    m = re.search(r"^description:\s*(.+)$", md.read_text(encoding="utf-8", errors="ignore"), re.M)
    return (m.group(1).strip().strip("\"'")[:140]) if m else ""


def _topic(path):
    segs = Path(path).parts
    top = segs[0]
    if top == "skills" and len(segs) >= 2:      # kotlin/chrisbanes flat wrapper
        return "skills"
    return top


def render_docs(baseline, manifest):
    today = date.today().isoformat()
    lines = ["# 벤더 스킬 baseline (SoT = baseline.json)", "",
             f"> 갱신: {today}", "", "| repo | branch | SHA |", "|---|---|---|"]
    for name, info in baseline.items():
        lines.append(f"| {name} | {info['branch']} | `{info['sha'][:9]}` |")
    (VENDOR_DIR / "baseline.md").write_text("\n".join(lines) + "\n")

    ml = ["# 벤더 스킬 MANIFEST (SoT = manifest.json)", "",
          f"> 갱신: {today} | 총 {len(manifest)}개", "", "| skill | repo | 원본 경로 |", "|---|---|---|"]
    for leaf in sorted(manifest):
        i = manifest[leaf]
        ml.append(f"| {leaf} | {i['repo']} | `{i['path']}` |")
    (VENDOR_DIR / "MANIFEST.md").write_text("\n".join(ml) + "\n")

    groups = {}
    for leaf, i in manifest.items():
        groups.setdefault((i["repo"], _topic(i["path"])), []).append(leaf)
    cl = ["# 벤더 스킬 CATALOG (주제별)", "",
          f"> 갱신: {today} | spec/plan 작성 시 `skill-finder`로 검색, 목차는 아래.", ""]
    for key in sorted(groups):
        cl.append(f"## {key[0]} / {key[1]}")
        for leaf in sorted(groups[key]):
            cl.append(f"- **{leaf}** — {_desc_of(leaf)}")
        cl.append("")
    (VENDOR_DIR / "CATALOG.md").write_text("\n".join(cl) + "\n")


def update(dry=False):
    baseline = json.loads(BASELINE_JSON.read_text())
    manifest = json.loads(MANIFEST_JSON.read_text())
    sources = json.loads(SOURCES.read_text())["repos"]
    changes = {"added": [], "modified": [], "deleted": []}
    for repo in sources:
        name = repo["name"]
        cache, branch, head = sync_cache(repo)
        base = baseline.get(name, {}).get("sha")
        if base == head:
            continue
        cur = {leaf_name(md): md for md in discover(cache, "HEAD")}
        prev = {leaf for leaf, i in manifest.items() if i["repo"] == name}
        for leaf in list(prev):                       # 삭제분
            if leaf not in cur:
                changes["deleted"].append(leaf)
                if not dry and (SKILLS_DIR / leaf).exists():
                    shutil.rmtree(SKILLS_DIR / leaf)
                manifest.pop(leaf, None)
        for leaf, md in cur.items():                   # 추가/수정분
            d = str(Path(md).parent)
            diff = run(["git", "diff", "--name-only", f"{base}..HEAD", "--", d], cwd=cache) if base else "x"
            if leaf not in manifest:
                changes["added"].append(leaf)
            elif diff.strip():
                changes["modified"].append(leaf)
            else:
                continue
            if not dry:
                copy_skill(cache, md, leaf)
            manifest[leaf] = {"repo": name, "path": md, "sha": head}
        baseline[name] = {"sha": head, "branch": branch, "url": repo["url"]}
    if not dry:
        BASELINE_JSON.write_text(json.dumps(baseline, indent=2, ensure_ascii=False) + "\n")
        MANIFEST_JSON.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
        render_docs(baseline, manifest)
    return changes


def main():
    ap = argparse.ArgumentParser(description="Vendor/update injected skills")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--full", action="store_true", help="전량 벤더(초기 설치)")
    g.add_argument("--update", action="store_true", help="baseline 대비 delta 업데이트")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if a.full:
        b, m = full_vendor(dry=a.dry_run)
        print(f"[full] {len(b)} repos, {len(m)} skills{' (dry)' if a.dry_run else ''}")
    else:
        c = update(dry=a.dry_run)
        print(f"[update] +{len(c['added'])} ~{len(c['modified'])} -{len(c['deleted'])}{' (dry)' if a.dry_run else ''}")
        for k in ("added", "modified", "deleted"):
            if c[k]:
                print(f"  {k}: {', '.join(sorted(c[k]))}")


if __name__ == "__main__":
    main()
