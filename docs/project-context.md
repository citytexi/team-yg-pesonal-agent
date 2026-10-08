# 프로젝트 컨텍스트

## repo 두 개로 분리

팀원 전부가 AI를 쓰는 건 아니어서 **코드 repo**와 **AI 스킬/위키 repo**를 분리했다.

| 구분 | repo | 용도 |
|------|------|------|
| AI 스킬·위키 (여기) | `citytexi/team-yg-pesonal-agent` (public) | 위키(`wiki/`)·원본(`raw/`)·AI 스킬·작업 지시 문서 |
| 코드 프로젝트 | `mash-up-kr/TEAMYG-Android` | 실제 Android 앱 코드 (Kotlin 멀티모듈). 저장소·로컬 디렉토리명 모두 구 `TJYG-Android`에서 바뀌었다. 과거 기록(plans·specs·log 등)에 남은 `TJYG-Android`는 같은 저장소를 가리킨다 |

로컬 **절대경로는 개인정보(username 포함)라 public에 두지 않는다.**
실제 경로는 private submodule의 `wiki/personal-private/project-paths.md` 참고.

민감 개인정보는 여기 repo의 private submodule(`wiki/personal-private/` → `team-yg-pesonal-agent-privacy-data`)에 둔다.

## 서브모듈 사본과 작업 체크아웃

코드 저장소는 로컬에 두 군데 나타날 수 있다. 역할이 다르다.

| 구분 | 위치 | 역할 |
|------|------|------|
| 작업 체크아웃 | private 파일에 적힌 절대경로 | **코드 작업 대상.** 브랜치를 만들고 고치는 곳이다. 그 repo의 `CLAUDE.md`가 적용된다 |
| 서브모듈 사본 | 이 repo 루트의 `TEAMYG-Android/` | **읽기 전용.** `parfait/android/doc-baseline.md`의 기준선 커밋에 고정돼 있다. 로컬 체크아웃이 없는 봇·원격 세션이 코드를 읽는 용도다. 그쪽 `CLAUDE.md`·`wiki/`·`docs/`는 읽지 않는다 |

작업 체크아웃(Obsidian vault로 여는 클론)에서는 서브모듈 사본을 초기화하지 않는다. 초기화하는 곳은
봇 전용 클론뿐이다([../bot/README.md](../bot/README.md) "전용 클론"). 이유는 셋이다.

- 기준선 커밋의 낡은 사본을 작업 대상으로 오인하지 않게 한다.
- 이 저장소는 루트가 Obsidian vault이고 두 저장소에 파일명이 같은 md가 225개 있어, 초기화하면
  위키링크가 사본으로 풀릴 수 있다.
- `parfait/script/check_links.py`를 인자 없이 돌리면 서브모듈 문서까지 검사한다.

gitlink는 `sync-teamyg-develop-baseline`이 기준선을 올릴 때 같은 커밋으로 올린다. 설계는
[superpowers/specs/2026-10-08-teamyg-android-submodule-design.md](superpowers/specs/2026-10-08-teamyg-android-submodule-design.md).

## 작업 방식

- **코드 작업 대상은 항상 `TEAMYG-Android`** (로컬 절대경로는 위 private 파일 참고).
  여기(AI repo)에서 지시를 받아 그 프로젝트를 작업한다.
- `TEAMYG-Android`는 자체 `CLAUDE.md`를 가진 별도 git repo(remote: `git@github.com:mash-up-kr/TEAMYG-Android.git`)다.
  그 repo 규칙은 해당 디렉토리에서 파일을 열면 자동 로드된다. 이는 작업 체크아웃에 대한 서술이다.
  서브모듈 사본에서는 그 규칙을 적용하지 않는다.
- 이 AI repo의 git 워크플로(브랜치→PR→머지, `main` 직접 커밋 금지)는
  [../CLAUDE.md](../CLAUDE.md) 참고. 코드 repo에는 코드 repo 자체 규칙을 따른다.
