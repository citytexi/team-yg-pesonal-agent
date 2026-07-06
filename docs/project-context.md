# 프로젝트 컨텍스트

## repo 두 개로 분리

팀원 전부가 AI를 쓰는 건 아니어서 **코드 repo**와 **AI 스킬/위키 repo**를 분리했다.

| 구분 | repo | 경로 | 용도 |
|------|------|------|------|
| AI 스킬·위키 (여기) | `citytexi/team-yg-pesonal-agent` (public) | `/Users/user/Documents/work_station/mashup/team-yg-pesonal-agent` | 위키(`wiki/`)·원본(`raw/`)·AI 스킬·작업 지시 문서 |
| 코드 프로젝트 | `mash-up-kr/TJYG-Android` | `/Users/user/Documents/work_station/mashup/github/TJYG-Android` | 실제 Android 앱 코드 (Kotlin 멀티모듈) |

민감 개인정보는 여기 repo의 private submodule(`wiki/personal-private/` → `team-yg-pesonal-agent-privacy-data`)에 둔다.

## 작업 방식

- **코드 작업 대상은 항상 `TJYG-Android`** (`/Users/user/Documents/work_station/mashup/github/TJYG-Android`).
  여기(AI repo)에서 지시를 받아 그 프로젝트를 작업한다.
- `TJYG-Android`는 자체 `CLAUDE.md`를 가진 별도 git repo(remote: `git@github.com:mash-up-kr/TJYG-Android.git`)다.
  그 repo 규칙은 해당 디렉토리에서 파일을 열면 자동 로드된다.
- 이 AI repo의 git 워크플로(브랜치→PR→머지, `main` 직접 커밋 금지)는
  [../CLAUDE.md](../CLAUDE.md) 참고. 코드 repo에는 코드 repo 자체 규칙을 따른다.
