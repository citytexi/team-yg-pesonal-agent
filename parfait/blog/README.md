# blog/ — 기술 블로그 원고

이 repo와 TJYG-Android 작업을 소재로 쓴 외부 공개용 블로그 원고를 둔다.
발행처는 [citytexi.tistory.com](https://citytexi.tistory.com).

## 규약

- 파일명 `YYYY-MM-DD-kebab-topic.md` (parfait 공통 규약)
- 문체·구성은 발행처 기존 글에 맞춘다. 문제 상황 도입 → 설계 근거 → 한계 순.
- **발행 전 `korean-humanizer` 스킬로 검증**하고 등급(A~D)을 확인한다.
- 수치·인용은 실물 대조. 코드 블록은 실제 파일에서 가져오고 손대지 않는다.
- 이 repo는 public이지만 원고에도 실명·연락처 등 개인정보를 넣지 않는다(루트 CLAUDE.md).

## 목록

| 발행일 | 원고 | 주제 | 상태 |
|---|---|---|---|
| 2026-08-03 | [llm-wiki](2026-08-03-llm-wiki.md) | 시리즈 1편. `raw/`→`wiki/` ingest 구조, 판본 체인(`status`/`superseded_by`), 데이터 계약 분리, `lint.py`·`check-status.py` 기계 검사, 라우팅 한계 | 초안 |

## 시리즈 계획

1. **LLM 위키** (위 1편)
2. **parfait** — 정책 위키와 구현 문서 분리, 의존 방향 단방향
3. spec → plan → TDD 루프
