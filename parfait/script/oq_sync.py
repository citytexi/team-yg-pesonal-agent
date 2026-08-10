#!/usr/bin/env python3
"""open-questions 문서를 GitHub 이슈로 단방향 투영한다.

용법:
    python3 parfait/script/oq_sync.py assign-ids [--check]
    python3 parfait/script/oq_sync.py plan [--out PATH]
    python3 parfait/script/oq_sync.py apply PATH [--limit N]

규약:
- stdlib 전용(pip 의존성 0).
- repo 루트 = Path(__file__).resolve().parents[2] 기준 상대 경로.
- 정본은 문서다. 이슈 → 문서 역방향 반영은 하지 않는다.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# (계열, repo 루트 기준 문서 경로)
DOCS = [
    ("W", "wiki/synthesis/open-questions.md"),
    ("P", "parfait/synthesis/open-questions.md"),
]

HEADING_RE = re.compile(r"^### \[(\d{4}-\d{2}-\d{2})\]\s+(.+?)\s*$", re.M)
# ID 줄은 줄바꿈까지 함께 잡아 제거 시 빈 줄이 남지 않게 한다.
ID_LINE_RE = re.compile(r"^- \*\*ID\*\*:\s*(OQ-[WP]-\d+)[ \t]*\n?", re.M)
STATUS_RE = re.compile(r"^- \*\*상태\*\*:\s*(.+?)\s*$", re.M)
COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
NEXT_RE = re.compile(r"<!--\s*oq-next:\s*(\d+)\s*-->")

SERIES_LABEL = {"W": "oq:wiki", "P": "oq:parfait"}
STATE_LABEL = {
    "open": "oq:open",
    "partial": "oq:partial",
    "blocked": "oq:blocked",
    "resolved": "oq:resolved",
}
LABEL_SPECS = [
    {"name": "oq:wiki", "color": "0075ca", "desc": "정책·기획 미결(wiki open-questions)"},
    {"name": "oq:parfait", "color": "5319e7", "desc": "구현·계약 미결(parfait open-questions)"},
    {"name": "oq:open", "color": "d73a4a", "desc": "미결"},
    {"name": "oq:partial", "color": "fbca04", "desc": "부분 해소 — 잔존 항목 있음"},
    {"name": "oq:blocked", "color": "cfd3d7", "desc": "보류"},
    {"name": "oq:resolved", "color": "0e8a16", "desc": "해소됨"},
]
TITLE_LIMIT = 256
SOT_NOTE = (
    "> 정본은 문서다. 이 이슈는 문서의 투영이며, 문서가 바뀌면 이 본문은 덮어써진다. "
    "여기서 고친 내용은 문서에 반영되지 않는다."
)

ISSUE_FETCH_LIMIT = 1000  # `gh issue list --limit` 상한. 도달하면 계획이 잘릴 수 있다(경고 출력).
WRITE_INTERVAL_SEC = 1.0  # 쓰기 액션 사이 대기(2차 rate limit 방어). 테스트에서 0으로 낮춘다.
MAX_CONSECUTIVE_FAILURES = 5  # 연속 실패 시 중단(대량 실패로 rate limit을 계속 두드리는 것을 막는다).
PLAN_APPLIED_SUFFIX = ".applied"  # 계획 파일 소비 표시 마커의 접미사.


def strip_html_comments(text):
    """HTML 주석을 공백으로 치환한다 — 길이와 줄 수를 보존한다.

    문서 말미의 '항목 추가 형식' 예시가 유령 항목으로 잡히는 것을 막는다.
    길이를 보존하는 이유: assign-ids가 원본 텍스트의 오프셋에 삽입하기 때문.
    """

    def repl(m):
        return "".join("\n" if ch == "\n" else " " for ch in m.group(0))

    return COMMENT_RE.sub(repl, text)


def field(body, name):
    """`- **name**: 값`에서 값을 뽑는다. 없으면 빈 문자열."""
    m = re.search(r"^- \*\*" + re.escape(name) + r"\*\*:\s*(.+?)\s*$", body, re.M)
    return m.group(1).strip() if m else ""


def parse_doc(text, series, doc_path):
    """문서 텍스트에서 미결 항목 목록을 뽑는다."""
    clean = strip_html_comments(text)
    matches = list(HEADING_RE.finditer(clean))
    items = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(clean)
        raw_body = clean[m.end() : end]
        id_m = ID_LINE_RE.search(raw_body)
        stripped = ID_LINE_RE.sub("", raw_body)
        # 줄 끝 공백 제거(주석 치환이 남긴 공백 포함) 후 앞뒤 빈 줄 정리
        body = "\n".join(ln.rstrip() for ln in stripped.splitlines()).strip("\n")
        st = STATUS_RE.search(body)
        items.append(
            {
                "series": series,
                "doc": doc_path,
                "date": m.group(1),
                "title": m.group(2),
                "heading_text": m.group(0).strip(),
                "oq_id": id_m.group(1) if id_m else None,
                "body": body,
                "status": st.group(1).strip() if st else "",
            }
        )
    return items


def item_hash(body):
    """항목 본문의 정규화 해시. 줄 끝 공백·빈 줄에는 불변, 내용 변경에는 가변."""
    lines = [ln.rstrip() for ln in body.splitlines()]
    lines = [ln for ln in lines if ln]
    joined = "\n".join(lines)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()[:12]


def github_anchor(heading_text):
    """GitHub 헤딩 slug. 문서 내부에서 쓰이는 앵커와 같은 결과를 낸다."""
    t = heading_text.lstrip("#").strip().lower()
    t = "".join(ch for ch in t if ch.isalnum() or ch in " -_")
    return t.replace(" ", "-")


def classify(status):
    """문서 상태 서술을 이슈 액션용 분류로 접는다.

    평가 순서가 중요하다 — '미해결 (부분 해소 …)'처럼 접두는 미해결이지만
    부분 해소인 항목이 실재한다.
    """
    s = status.strip()
    if s.startswith("해소됨"):
        return "resolved"
    if "부분 해소" in s:
        return "partial"
    if s.startswith("보류"):
        return "blocked"
    return "open"


def next_counter(text, series):
    """다음 채번 값. 문서 내 최대 ID+1과 하이워터마크 중 큰 쪽."""
    clean = strip_html_comments(text)
    used = [int(m.group(1)) for m in re.finditer(r"OQ-" + series + r"-(\d+)", clean)]
    hi = max(used) + 1 if used else 1
    m = NEXT_RE.search(text)
    if m:
        hi = max(hi, int(m.group(1)))
    return hi


def _write_next_marker(text, counter):
    marker = "<!-- oq-next: %d -->" % counter
    if NEXT_RE.search(text):
        return NEXT_RE.sub(marker, text)
    return text.rstrip("\n") + "\n\n" + marker + "\n"


def assign_ids(text, series):
    """ID 없는 항목에 번호를 부여한다. 멱등 — 이미 있는 ID는 건드리지 않는다."""
    clean = strip_html_comments(text)
    counter = next_counter(text, series)
    matches = list(HEADING_RE.finditer(clean))
    pieces = []
    cursor = 0
    assigned = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(clean)
        if ID_LINE_RE.search(clean[m.end() : end]):
            continue
        oq_id = "OQ-%s-%03d" % (series, counter)
        counter += 1
        pieces.append(text[cursor : m.end()])
        pieces.append("\n- **ID**: " + oq_id)
        cursor = m.end()
        assigned.append((oq_id, m.group(2)))
    pieces.append(text[cursor:])
    out = "".join(pieces)
    return _write_next_marker(out, counter), assigned


def marker(body, name):
    """이슈 본문의 `<!-- name: 값 -->` 마커를 읽는다."""
    m = re.search(r"<!--\s*" + re.escape(name) + r":\s*(.+?)\s*-->", body or "")
    return m.group(1).strip() if m else ""


def issue_title(item):
    t = re.sub(r"[`*]", "", item["title"]).strip()
    prefix = "[%s] " % item["oq_id"]
    limit = TITLE_LIMIT - len(prefix)
    if len(t) > limit:
        t = t[: limit - 1] + "…"
    return prefix + t


def issue_body(item, repo):
    url = "https://github.com/%s/blob/main/%s#%s" % (
        repo,
        item["doc"],
        github_anchor(item["heading_text"]),
    )
    return "\n".join(
        [
            "<!-- oq-id: %s -->" % item["oq_id"],
            "<!-- oq-hash: %s -->" % item_hash(item["body"]),
            "<!-- oq-source: %s -->" % item["doc"],
            "",
            SOT_NOTE,
            "> 원본: [%s](%s)" % (item["doc"], url),
            "",
            "**발견일**: %s" % item["date"],
            "",
            item["body"],
            "",
        ]
    )


def labels_for(item):
    return [SERIES_LABEL[item["series"]], STATE_LABEL[classify(item["status"])]]


ACTION_KINDS = ["create", "update", "close", "reopen", "noop", "orphan", "unmanaged", "duplicate"]
NO_WRITE_KINDS = ("orphan", "unmanaged", "noop", "duplicate")  # apply가 건드리지 않는 액션(보고 전용 포함)


def gh(args, input_=None):
    """`gh` CLI 래퍼. 실패하면 stderr를 담아 예외를 던진다.

    `cwd`를 repo 루트로 고정한다 — 지정하지 않으면 실행 시점의 cwd에 있는 리모트를
    따라가서, 다른 저장소 디렉토리에서 실행하면 그쪽에 이슈가 생긴다. 이 도구는
    이 저장소 하나만 대상으로 한다.
    """
    proc = subprocess.run(
        ["gh"] + args, capture_output=True, text=True, input=input_, cwd=str(REPO_ROOT)
    )
    if proc.returncode != 0:
        raise RuntimeError("gh %s 실패: %s" % (" ".join(args), (proc.stderr or proc.stdout).strip()))
    return proc.stdout


def current_repo():
    return json.loads(gh(["repo", "view", "--json", "nameWithOwner"]))["nameWithOwner"]


def fetch_issues():
    """이슈 전량을 받아온다.

    `--label`을 여러 번 주면 gh는 AND로 묶어 oq:wiki·oq:parfait 동시 지정 시
    결과가 0건이 된다. 라벨로 거르지 않고 마커로 판별한다.
    """
    out = gh(
        [
            "issue", "list", "--state", "all", "--limit", str(ISSUE_FETCH_LIMIT),
            "--json", "number,title,body,state,labels",
        ]
    )
    data = json.loads(out)
    if len(data) >= ISSUE_FETCH_LIMIT:
        print(
            "경고: 이슈 조회가 상한 %d건에 도달했다. 계획이 부정확할 수 있다." % ISSUE_FETCH_LIMIT
        )
    return data


def _label_diff(current, wanted):
    """우리가 관리하는 라벨만 대상으로 add/remove를 계산한다."""
    managed = set(SERIES_LABEL.values()) | set(STATE_LABEL.values())
    cur = set(current) & managed
    want = set(wanted)
    return sorted(want - cur), sorted(cur - want)


def build_plan(items, issues, repo):
    """문서 항목과 기존 이슈를 대조해 액션 계획을 만든다. 순수 함수."""
    groups = {}
    actions = []
    for iss in issues:
        oq_id = marker(iss.get("body") or "", "oq-id")
        if oq_id:
            groups.setdefault(oq_id, []).append(iss)
        elif (iss.get("state") or "").upper() == "OPEN":
            actions.append(
                {
                    "action": "unmanaged",
                    "oq_id": "",
                    "issue": iss.get("number"),
                    "title": iss.get("title") or "",
                }
            )

    # 같은 oq-id가 2건 이상이면 이슈 번호가 가장 작은 것(먼저 만들어진 것)을 대표로 남기고
    # 나머지 중 OPEN인 것은 duplicate로 보고한다(자동으로 닫지 않는다 — orphan과 같은 철학).
    by_id = {}
    for oq_id, group in groups.items():
        group_sorted = sorted(group, key=lambda g: g.get("number") or 0)
        by_id[oq_id] = group_sorted[0]
        for extra in group_sorted[1:]:
            if (extra.get("state") or "").upper() == "OPEN":
                actions.append(
                    {
                        "action": "duplicate",
                        "oq_id": oq_id,
                        "issue": extra.get("number"),
                        "title": extra.get("title") or "",
                    }
                )

    noop = 0
    seen = set()
    for it in items:
        seen.add(it["oq_id"])
        kind = classify(it["status"])
        title = issue_title(it)
        body = issue_body(it, repo)
        wanted = labels_for(it)
        iss = by_id.get(it["oq_id"])

        if iss is None:
            if kind == "resolved":
                continue
            actions.append(
                {
                    "action": "create",
                    "oq_id": it["oq_id"],
                    "title": title,
                    "body": body,
                    "labels": wanted,
                }
            )
            continue

        current = [l.get("name") for l in (iss.get("labels") or [])]
        add, remove = _label_diff(current, wanted)
        stale = (
            marker(iss.get("body") or "", "oq-hash") != item_hash(it["body"])
            or (iss.get("title") or "") != title
        )
        is_open = (iss.get("state") or "").upper() == "OPEN"

        if is_open and kind == "resolved":
            memo = field(it["body"], "해소 메모")
            comment = "문서 상태가 `%s`로 바뀌어 닫는다." % it["status"]
            if memo:
                comment += "\n\n**해소 메모**: " + memo
            actions.append(
                {
                    "action": "close",
                    "oq_id": it["oq_id"],
                    "issue": iss["number"],
                    "comment": comment,
                    "title": title,
                    "body": body,
                    "add_labels": add,
                    "remove_labels": remove,
                }
            )
        elif is_open and (stale or add or remove):
            actions.append(
                {
                    "action": "update",
                    "oq_id": it["oq_id"],
                    "issue": iss["number"],
                    "title": title,
                    "body": body,
                    "add_labels": add,
                    "remove_labels": remove,
                }
            )
        elif not is_open and kind != "resolved":
            actions.append(
                {
                    "action": "reopen",
                    "oq_id": it["oq_id"],
                    "issue": iss["number"],
                    "title": title,
                    "body": body,
                    "add_labels": add,
                    "remove_labels": remove,
                }
            )
        else:
            noop += 1

    for oq_id, iss in by_id.items():
        if oq_id in seen:
            continue
        if (iss.get("state") or "").upper() != "OPEN":
            continue
        actions.append(
            {
                "action": "orphan",
                "oq_id": oq_id,
                "issue": iss["number"],
                "title": iss.get("title") or "",
            }
        )

    summary = {k: 0 for k in ACTION_KINDS}
    summary["noop"] = noop
    for a in actions:
        summary[a["action"]] += 1
    return {"repo": repo, "summary": summary, "actions": actions}


def render_plan_table(plan):
    lines = ["| 액션 | 건수 |", "|---|---|"]
    for k in ACTION_KINDS:
        lines.append("| %s | %d |" % (k, plan["summary"][k]))
    for a in plan["actions"]:
        if a["action"] in ("orphan", "unmanaged", "duplicate"):
            lines.append(
                "- %s: #%s %s" % (a["action"], a.get("issue"), a.get("title", ""))
            )
    return "\n".join(lines)


def ensure_labels():
    """라벨을 만든다. `--force`라 이미 있으면 갱신된다(멱등)."""
    for spec in LABEL_SPECS:
        gh(
            [
                "label", "create", spec["name"],
                "--color", spec["color"],
                "--description", spec["desc"],
                "--force",
            ]
        )


def _edit_args(act):
    args = ["issue", "edit", str(act["issue"]), "--title", act["title"], "--body-file", "-"]
    for name in act.get("add_labels") or []:
        args += ["--add-label", name]
    for name in act.get("remove_labels") or []:
        args += ["--remove-label", name]
    return args


def apply_action(act):
    """액션 하나를 실행한다. orphan·unmanaged·duplicate는 보고 전용이라 아무것도 하지 않는다."""
    kind = act["action"]
    if kind in NO_WRITE_KINDS:
        return
    if kind == "create":
        args = ["issue", "create", "--title", act["title"], "--body-file", "-"]
        for name in act.get("labels") or []:
            args += ["--label", name]
        gh(args, input_=act["body"])
    elif kind == "update":
        gh(_edit_args(act), input_=act["body"])
    elif kind == "close":
        gh(_edit_args(act), input_=act["body"])
        gh(["issue", "comment", str(act["issue"]), "--body-file", "-"], input_=act["comment"])
        gh(["issue", "close", str(act["issue"])])
    elif kind == "reopen":
        gh(["issue", "reopen", str(act["issue"])])
        gh(_edit_args(act), input_=act["body"])
    else:
        raise RuntimeError("알 수 없는 액션: %s" % kind)


def apply_plan(plan, limit=None):
    """계획을 순차 실행하고 실패 목록을 돌려준다.

    쓰기 액션 사이 `WRITE_INTERVAL_SEC`만큼 대기하고, 연속 실패가
    `MAX_CONSECUTIVE_FAILURES`에 도달하면 남은 액션을 실행하지 않고 중단한다
    (GitHub 2차 rate limit — 콘텐츠 생성 분당 약 80건 — 을 계속 두드리는 것을 막는다).
    성공하면 연속 실패 카운터는 0으로 리셋한다.
    """
    actions = [a for a in plan["actions"] if a["action"] not in NO_WRITE_KINDS]
    if limit is not None:
        actions = actions[:limit]
    failures = []
    consecutive_failures = 0
    for i, act in enumerate(actions, 1):
        label = "%s %s" % (act["action"], act.get("oq_id") or act.get("issue"))
        try:
            apply_action(act)
            print("[%d/%d] %s" % (i, len(actions), label))
            consecutive_failures = 0
        except Exception as exc:  # noqa: BLE001 — 실패해도 나머지를 계속 실행한다(단, 연속 실패는 중단)
            failures.append((act.get("oq_id", ""), str(exc)))
            consecutive_failures += 1
            print("[%d/%d] 실패 %s — %s" % (i, len(actions), label, exc))
            if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                remaining = len(actions) - i
                print(
                    "연속 실패 %d건으로 중단한다. 남은 %d건은 실행하지 않았다."
                    % (consecutive_failures, remaining)
                )
                return failures
        if WRITE_INTERVAL_SEC:
            time.sleep(WRITE_INTERVAL_SEC)
    return failures


def read_docs():
    """두 문서를 읽어 항목 전량을 돌려준다. ID 미부여 항목이 있으면 중단한다."""
    items = []
    missing = []
    for series, rel in DOCS:
        text = (REPO_ROOT / rel).read_text(encoding="utf-8")
        for it in parse_doc(text, series, rel):
            if it["oq_id"] is None:
                missing.append("%s — %s" % (rel, it["title"]))
            items.append(it)
    if missing:
        raise SystemExit(
            "ID 미부여 항목 %d건. 먼저 assign-ids를 실행하라:\n  " % len(missing)
            + "\n  ".join(missing[:10])
        )
    return items


def cmd_assign_ids(args):
    total = 0
    for series, rel in DOCS:
        path = REPO_ROOT / rel
        text = path.read_text(encoding="utf-8")
        new_text, assigned = assign_ids(text, series)
        total += len(assigned)
        if assigned and not args.check:
            path.write_text(new_text, encoding="utf-8")
        for oq_id, title in assigned:
            print("%s  %s" % (oq_id, title))
    if args.check:
        print("미부여 %d건" % total)
        return 1 if total else 0
    print("부여 %d건" % total)
    return 0


def cmd_plan(args):
    items = read_docs()
    repo = current_repo()
    plan = build_plan(items, fetch_issues(), repo)
    print(render_plan_table(plan))
    out = Path(args.out)
    out.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n계획 저장: %s" % out)
    return 0


def cmd_apply(args):
    plan_path = Path(args.plan)
    marker_path = Path(str(plan_path) + PLAN_APPLIED_SUFFIX)
    if marker_path.exists():
        raise SystemExit(
            "이 계획은 이미 apply됐다(%s). 같은 계획 파일에는 실행 이력이 없어 재실행하면 "
            "이미 만든 이슈를 다시 만든다. plan을 다시 산출한 뒤 apply하라." % marker_path
        )

    plan = json.loads(plan_path.read_text(encoding="utf-8"))

    plan_repo = plan.get("repo")
    repo = current_repo()
    if plan_repo != repo:
        raise SystemExit(
            "계획의 repo(%s)가 현재 repo(%s)와 다르다. 이 도구는 이 저장소 하나만 대상으로 "
            "한다 — plan을 다시 산출하라." % (plan_repo, repo)
        )

    ensure_labels()
    failures = apply_plan(plan, limit=args.limit)
    marker_path.write_text("applied\n", encoding="utf-8")
    if failures:
        print("\n실패 %d건:" % len(failures))
        for oq_id, msg in failures:
            print("  %s — %s" % (oq_id, msg))
        return 1
    print("\n완료")
    return 0


def main():
    ap = argparse.ArgumentParser(description="open-questions → GitHub 이슈 단방향 동기화")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_ids = sub.add_parser("assign-ids", help="ID 없는 항목에 안정 ID 부여")
    p_ids.add_argument("--check", action="store_true", help="수정하지 않고 미부여 건수만 보고")
    p_ids.set_defaults(func=cmd_assign_ids)

    p_plan = sub.add_parser("plan", help="계획 산출(리모트 읽기만)")
    p_plan.add_argument("--out", default="oq-plan.json", help="계획 JSON 저장 경로")
    p_plan.set_defaults(func=cmd_plan)

    p_apply = sub.add_parser("apply", help="계획 실행(리모트 쓰기)")
    p_apply.add_argument("plan", help="계획 JSON 경로")
    p_apply.add_argument("--limit", type=int, default=None, help="실행 건수 상한")
    p_apply.set_defaults(func=cmd_apply)

    args = ap.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
