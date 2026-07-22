# CLAUDE.md

이 저장소는 세 축으로 구성된다(모두 저장소 루트의 형제 디렉토리):
- **`raw/`** — 정책 원본 소스(불변, 읽기 전용).
- **`wiki/`** — LLM이 `raw/`를 ingest해 운영·유지하는 **정책 지식 위키**.
- **`parfait/`** — TJYG-Android **구현 문서**(ADR·architecture·specs·plans). 위키 스키마 미적용.

## 프로젝트 컨텍스트 (필수)

이 repo는 **AI 스킬·위키 repo**이고, 실제 **코드 작업 대상은 별도 repo `TJYG-Android`**
(remote `mash-up-kr/TJYG-Android`)다. 여기서 지시를 받아 그 프로젝트를 작업한다.
로컬 절대경로는 개인정보라 private submodule의 `wiki/personal-private/project-paths.md`에 있다.
자세한 내용은 [docs/project-context.md](docs/project-context.md).

## 언어

항상 한국어로 답변한다.

## Git 워크플로 (필수)

**`git commit`, `git push`, PR 생성(`gh pr create`) 실행 전에는 무조건 사용자에게 먼저 물어보고
확인받는다.** 사용자가 명시적으로 승인하기 전까지 이 세 작업을 자동으로 실행하지 않는다.
(코드 편집·브랜치 생성 등은 물어보지 않아도 됨.)

이 public repo는 **`main`에 직접 커밋·푸시하지 않는다.** 모든 변경은:

1. 브랜치 생성 (`git checkout -b <설명적-브랜치명>`)
2. commit + push — **사용자 확인 후**
3. PR 생성 (`gh pr create`) — **사용자 확인 후**
4. `main`에 머지

서브모듈(`wiki/personal-private/`) 변경 절차는 [Public repo 주의](#public-repo-주의) 참고.

## 먼저 읽어라

위키 작업을 하기 전, 위키 진입 허브 **`wiki/index.md`** 부터 읽어라 — 전체 페이지 카탈로그와
현재 논지 요약([[overview]])이 거기 있다. 필요한 페이지만 펼치고 위키 전체를 읽지 말 것.

## 위키 작업일 때만

`wiki/` 또는 `raw/`를 다루거나 ingest/lint/query 작업을 할 때는
**`wiki/CLAUDE.md`(위키 스키마)의 규칙을 따른다.** (해당 디렉토리 파일을 열면 자동 로드됨)

위키와 무관한 작업에는 위 스키마를 적용하지 않는다.

## 작업 유형별 워크플로 라우팅 (필수)

작업 시작 시 **유형을 먼저 판별**하고 아래 워크플로를 탄다.
공통 진입은 항상 `superpowers:brainstorming`(의도·요구 정리) — 코드든 문서든 동일.
그 다음 갈래가 나뉜다.

### A. TJYG-Android 코드 구현 (`.kt`/gradle 편집, 기능·컴포넌트·버그픽스)
→ **superpowers 체인**:
1. `superpowers:brainstorming` → 설계 스펙 확정 (`parfait/specs/`, 아래 [설계 스펙 위치](#설계-스펙-위치-tjyg-android-구현))
2. `superpowers:writing-plans` → 구현 계획 (`parfait/plans/`. writing-plans 기본 위치 `docs/superpowers/plans/`를 이 경로로 override)
3. `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans` → TDD로 실행
- `writing-plans`·`test-driven-development`·`executing-plans`는 **코드 작업 전용**. 제품 문서엔 쓰지 않는다.
- **스킬 적재적소(필수)**: brainstorming(스펙)·writing-plans(계획) 단계에서, 다룰 주제
  (Compose UI/state·recomposition·stability·side-effects·navigation·coroutines·testing·gradle·마이그레이션 등)에 대해
  **`skill-finder`로 먼저 검색**(`python3 parfait/script/search.py "<주제>"`)하고, 상위 후보 중 관련
  벤더 스킬을 네이티브 `Skill`로 로드한 뒤 설계/계획을 확정한다. 전체 목차는
  `.claude/skills-vendor/CATALOG.md`. 벤더 스킬 갱신은 `update-injected-skills`.

### B. 제품 문서 작업 (PRD·positioning·roadmap·user story·discovery 등)
→ **PM-Skills 사용** (`writing-plans` 대신 이쪽이 문서판 대응물):
- PRD → `prd-development` / 포지셔닝 → `positioning-statement`·`positioning-workshop`
- 우선순위 → `prioritization-advisor` / 로드맵 → `roadmap-planning`
- 유저스토리·에픽 → `user-story`·`epic-breakdown-advisor` / 디스커버리 → `discovery-process`·`jobs-to-be-done`
- 그 외 PM 작업은 해당 PM-Skills 스킬 목록에서 선택.
- **출력물은 `parfait/pm/`에 저장**하고 parfait 규약(파일명 `YYYY-MM-DD-kebab-topic.md`)을 따른다.
  (PM-Skills 기본 출력은 일반 템플릿 → 저장 시 이 규약으로 맞춘다.)

### C. 정책 지식 위키 (`wiki/`·`raw/`)
→ 기존 `ingest`/`query`/`lint` 워크플로. `wiki/CLAUDE.md` 스키마를 따른다(변경 없음).

## 설계 스펙 위치 (TJYG-Android 구현)

`TJYG-Android` 기능·컴포넌트를 만들기 전 확정하는 **설계 스펙은 `parfait/specs/`에 작성한다.**
(브레인스토밍의 기본 위치 `docs/superpowers/specs/`를 이 경로로 override.)

> `parfait/`는 저장소 루트의 별도 디렉토리다(`raw/`·`wiki/`와 형제). TJYG-Android 구현
> 문서(ADR·architecture·specs·plans) 전용이며, LLM 위키(`wiki/`) 스키마의 적용을 받지 않는다.

- 파일명 `YYYY-MM-DD-kebab-topic.md`, 구현 완료분은 `specs/archive/`로 이동.
- 형식·인덱스 등록 규칙은 [`parfait/specs/README.md`](parfait/specs/README.md).
- 스펙이 새 아키텍처 결정을 유발하면 대응 ADR을 `parfait/adr/`에 함께 만든다.
- 진입 시 [`parfait/index.md`](parfait/index.md) 허브에서 adr/architecture/specs/plans 라우팅을 본다.

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
