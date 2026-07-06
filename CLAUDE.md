# CLAUDE.md

이 저장소는 **LLM이 운영·유지하는 개인 위키**(`wiki/`)와 그 원본(`raw/`)을 담는다.

## 언어

항상 한국어로 답변한다.

## Git 워크플로 (필수)

이 public repo는 **`main`에 직접 커밋·푸시하지 않는다.** 모든 변경은:

1. 브랜치 생성 (`git checkout -b <설명적-브랜치명>`)
2. commit + push
3. PR 생성 (`gh pr create`)
4. `main`에 머지

서브모듈(`wiki/personal-private/`) 변경 절차는 [Public repo 주의](#public-repo-주의) 참고.

## 먼저 읽어라

위키 작업을 하기 전, 위키 진입 허브 **`wiki/index.md`** 부터 읽어라 — 전체 페이지 카탈로그와
현재 논지 요약([[overview]])이 거기 있다. 필요한 페이지만 펼치고 위키 전체를 읽지 말 것.

## 위키 작업일 때만

`wiki/` 또는 `raw/`를 다루거나 ingest/lint/query 작업을 할 때는
**`wiki/CLAUDE.md`(위키 스키마)의 규칙을 따른다.** (해당 디렉토리 파일을 열면 자동 로드됨)

위키와 무관한 작업에는 위 스키마를 적용하지 않는다.

## Public repo 주의

이 repo는 public이다. 식별 가능한 개인정보(실명·연락처·주소·건강·재무·인증 등)는
이 public repo에 커밋하지 않는다. 민감 콘텐츠는 `wiki/personal-private/`에 둔다 —
이 경로는 **private repo(`team-yg-pesonal-agent-privacy-data`)의 git submodule**이라
내용은 private에만 저장되고, public repo에는 gitlink(commit SHA)만 남는다.
서브모듈 내용 수정 시 절차:

1. **서브모듈에서 브랜치 작업**: 부모(public) repo의 현재 브랜치와 **동일한 이름**의 브랜치를
   서브모듈에서 만들고(`git checkout -b <부모-현재-브랜치>`) commit + push 한다.
   서브모듈의 `main`에 직접 커밋하지 않는다.
2. **PR → 머지**: push한 브랜치로 private repo에 PR을 만들고 `main`에 머지한다.
   머지 후 서브모듈 로컬을 `main`으로 갱신(`git checkout main && git pull`).
3. **gitlink 갱신**: public repo에서 `git add wiki/personal-private` 후 gitlink 갱신 commit.
