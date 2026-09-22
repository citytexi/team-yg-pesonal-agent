"""Figma 코멘트 일일 리포트.

표준 출력에 리포트 원문을 그대로 찍는다. 봇은 이 출력을 한 글자도 고치지 않고
디스코드에 올린다. 그래서 이 파일이 출력 형식의 정본이다.

설정은 전부 환경변수로 받는다. 토큰도 파일 목록도 코드에 박지 않는다.

    FIGMA_TOKEN       Figma Personal Access Token
    FIGMA_FILES       `파일키:라벨` 쌍을 쉼표로 이은 목록
    FIGMA_REPORT_DIR  리포트 txt 를 남길 디렉토리(기본 ./data/reports)
"""

import json
import os
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

KST = timezone(timedelta(hours=9))


# ─────────────────────────────────────────
# 설정
# ─────────────────────────────────────────
def load_files(raw):
    """`키:라벨` 쌍을 읽는다. 라벨에 콜론이 들어갈 수 있어 첫 콜론에서만 가른다."""
    files = []
    for entry in (raw or "").split(","):
        entry = entry.strip()
        if not entry:
            continue
        key, _, label = entry.partition(":")
        key = key.strip()
        label = label.strip() or key
        if not key:
            raise SystemExit(f"FIGMA_FILES entry has no file key: {entry}")
        files.append({"key": key, "label": label})
    return files


# 필터 조건
# 조건1: 루트 코멘트 작성일이 오늘 기준 7일 이내
# 조건2: 스레드의 마지막 업데이트가 어제 00:00 KST 이후
def get_filter_range():
    now_kst = datetime.now(KST)
    seven_days_ago = now_kst.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=7)
    yesterday_start = (now_kst - timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return seven_days_ago, yesterday_start


# ─────────────────────────────────────────
# API 호출
# ─────────────────────────────────────────
def fetch_comments(file_key, token):
    req = urllib.request.Request(
        f"https://api.figma.com/v1/files/{file_key}/comments",
        headers={"X-Figma-Token": token},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read()).get("comments") or []


# ─────────────────────────────────────────
# 유틸
# ─────────────────────────────────────────
def parse_dt(s):
    if not s:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(KST)


def get_last_update(thread):
    all_msgs = [thread["root"]] + thread["replies"]
    candidates = []
    for msg in all_msgs:
        if msg.get("resolved_at"):
            candidates.append(parse_dt(msg["resolved_at"]))
        for r in (msg.get("reactions") or []):
            if r and r.get("created_at"):
                candidates.append(parse_dt(r["created_at"]))
        candidates.append(parse_dt(msg.get("created_at")))
    candidates = [d for d in candidates if d]
    return max(candidates) if candidates else None


# ─────────────────────────────────────────
# 스레드 그룹핑 (parent_id 체이닝)
# ─────────────────────────────────────────
def group_threads(comments):
    id_map = {c["id"]: c for c in comments if c}

    def get_root(c):
        visited = set()
        while c.get("parent_id") and c["parent_id"] in id_map:
            if c["parent_id"] in visited:
                break
            visited.add(c["parent_id"])
            c = id_map[c["parent_id"]]
        return c

    groups = {}
    for c in comments:
        if not c:
            continue
        root = get_root(c)
        root_id = root["id"]
        if root_id not in groups:
            groups[root_id] = {"root": root, "replies": []}
        if c["id"] != root_id:
            groups[root_id]["replies"].append(c)

    return list(groups.values())


# ─────────────────────────────────────────
# 필터링
# ─────────────────────────────────────────
def filter_threads(threads, seven_days_ago, yesterday_start):
    result = []
    for t in threads:
        root_created = parse_dt(t["root"].get("created_at"))
        if not root_created or root_created < seven_days_ago:
            continue
        last = get_last_update(t)
        if not last or last < yesterday_start:
            continue
        result.append((t, last))
    return result


# ─────────────────────────────────────────
# 출력 포맷
# ─────────────────────────────────────────
def format_output(label, filtered):
    lines = []
    lines.append(f"\n{'#' * 50}")
    lines.append(f"{label} ({len(filtered)}개)")
    lines.append('#' * 50)

    unresolved = []

    for i, (thread, last_update) in enumerate(filtered, 1):
        root = thread["root"]
        all_msgs = sorted([root] + thread["replies"], key=lambda x: x.get("created_at", ""))
        is_resolved = bool(root.get("resolved_at"))
        status = ":white_check_mark: 완료" if is_resolved else ":large_yellow_circle: 미해결"

        lines.append(f"\n{'─' * 50}")
        lines.append(f"# 코멘트 {i}  {status}")
        lines.append("")

        for msg in all_msgs:
            author = (msg.get("user") or {}).get("handle", "?")
            content = (msg.get("message") or "").strip()
            lines.append(author)
            lines.append(f" {content}")
            lines.append("")

        lines.append(f"마지막 업데이트 시간: {last_update.strftime('%Y-%m-%d %H:%M KST')}")

        if not is_resolved:
            # 미해결 항목 따로 수집 (요약용)
            first_msg = all_msgs[0]
            author = (first_msg.get("user") or {}).get("handle", "?")
            preview = (first_msg.get("message") or "").strip().replace("\n", " ")[:60]
            unresolved.append(f"  - 코멘트 {i}: {author} — {preview}...")

    # 미해결 항목 요약 블록
    if unresolved:
        lines.append(f"\n{'─' * 50}")
        lines.append(f":red_circle: 미해결 항목 ({len(unresolved)}건)")
        lines.extend(unresolved)

    return "\n".join(lines)


# ─────────────────────────────────────────
# 메인
# ─────────────────────────────────────────
def main():
    token = os.environ.get("FIGMA_TOKEN", "").strip()
    if not token:
        raise SystemExit("FIGMA_TOKEN is not set")

    files = load_files(os.environ.get("FIGMA_FILES"))
    if not files:
        raise SystemExit("FIGMA_FILES is empty")

    report_dir = Path(os.environ.get("FIGMA_REPORT_DIR") or "./data/reports")

    seven_days_ago, yesterday_start = get_filter_range()
    now_kst = datetime.now(KST)

    header = "\n".join([
        ":clipboard: Figma 코멘트 일일 리포트",
        f"실행 시각: {now_kst.strftime('%Y-%m-%d %H:%M KST')}",
        f"조건: 루트 작성일 {seven_days_ago.strftime('%Y-%m-%d')} 이후 "
        f"& 마지막 업데이트 {yesterday_start.strftime('%Y-%m-%d %H:%M')} 이후",
    ])

    all_output = [header]

    for file in files:
        try:
            comments = fetch_comments(file["key"], token)
            threads = group_threads(comments)
            filtered = filter_threads(threads, seven_days_ago, yesterday_start)
            all_output.append(format_output(f":file_folder: {file['label']}", filtered))
        except Exception as e:
            all_output.append(f"[오류] {file['label']}: {e}")

    result = "\n".join(all_output)

    # 파일로 보관한다. 봇이 올리는 것은 이 파일이 아니라 아래 표준 출력이다.
    filename = f"figma_report_{now_kst.strftime('%Y%m%d_%H%M')}.txt"
    try:
        report_dir.mkdir(parents=True, exist_ok=True)
        (report_dir / filename).write_text(result, encoding="utf-8")
        saved = filename
    except OSError as e:
        # 보관에 실패해도 리포트 자체는 나가야 한다.
        print(f"[경고] 리포트 파일 저장 실패: {e}", file=sys.stderr)
        saved = None

    print(result)
    # 절대경로에는 사용자 이름이 들어간다. 디스코드로 나가는 줄에는 파일명만 남긴다.
    if saved:
        print(f"\n:page_facing_up: 리포트 저장됨: {saved}")


if __name__ == "__main__":
    main()
