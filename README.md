# team-yg-agent

**AI 스킬 · LLM 운영 위키 repo.** 실제 코드 작업은 별도 repo에서 하고, 이 repo는 그 작업을 돕는 위키·문서·AI 스킬을 담는다.

> 팀원 전부가 AI를 쓰는 건 아니어서 **코드 repo와 AI/위키 repo를 분리**했다. 배경·경로는 [docs/project-context.md](docs/project-context.md).

## 구성

| 경로 | 내용 |
|------|------|
| [`wiki/`](wiki/index.md) | LLM이 운영·유지하는 **정책 지식 위키**. 진입 허브부터 읽는다 |
| [`parfait/`](parfait/index.md) | Parfait(TJYG-Android) **구현 위키** — ADR · architecture · specs · plans. `wiki/`와 형제 디렉토리, 위키 스키마 미적용 |
| `wiki/personal-private/` | 민감 개인정보. **private submodule**(별도 접근 권한 필요), 이 repo엔 gitlink만 |
| `raw/` | 위키의 **불변 원본** 소스 (읽기 전용) |
| [`docs/`](docs/project-context.md) | 프로젝트 컨텍스트·운영 문서 |
| [`llm-wiki.md`](llm-wiki.md) | 이 위키 방식의 원리 설명 |
| [`CLAUDE.md`](CLAUDE.md) | 에이전트 운영 규칙 (진입점) |

## 두 종류의 위키
- **정책 지식 위키** (`wiki/`의 `entities`·`concepts`·`sources`·`synthesis`) — `raw/` 원본을 ingest해 엔티티·개념으로 축적. 방식은 [llm-wiki.md](llm-wiki.md) 참고.
- **구현(아키텍처) 위키** (`parfait/`) — 코드베이스 결정(ADR)·구현 가이드(architecture)·설계 스펙(specs)·작업 계획(plans). "왜/어떻게/무엇을" 구조. `wiki/`와 분리된 루트 디렉토리(위키 ingest/lint 스키마 미적용).

## 작업 규칙 (요약 — 상세는 [CLAUDE.md](CLAUDE.md))
- `main` **직접 커밋 금지** — 브랜치 → PR → 머지.
- `git commit` / `push` / PR **실행 전 사용자 확인**.
- 이 repo는 **public** — 식별 가능한 개인정보(실명·연락처·주소·인증 등)는 추적 파일에 커밋하지 않는다. 민감 콘텐츠는 private submodule에 둔다.

## 라이선스
[LICENSE](LICENSE)
