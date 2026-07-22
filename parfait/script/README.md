# parfait/script

이 repo의 **파이썬 툴링 스크립트 홈**. 스킬(`.claude/skills/*`)이 호출하는 로직·일회성 유틸을 모은다.

## 규약
- **stdlib 전용** — pip 의존성 0. `python3 parfait/script/<name>.py`로 실행.
- 파일명은 기능 기반 snake/kebab(날짜 접두사 없음). 스킬 전용 로직은 스킬명과 연관되게(`vendor.py`·`search.py`).
- 각 스크립트 상단은 [`_script-template.py`](_script-template.py) 헤더 규약(용법 docstring)을 따른다.
- **경로**: repo 루트 = `Path(__file__).resolve().parents[2]`(= `parfait/script/x.py` → 루트) 기준 상대. repo 이동에 무관.
- 스킬이 호출하는 스크립트는 SKILL.md에서 `python3 parfait/script/<name>.py`로 참조(cwd = repo 루트).
- 테스트는 같은 디렉토리에 `test_<name>.py`(`python3 -m unittest`, stdlib `unittest`).

## 인덱스
| 스크립트 | 용도 | 호출 스킬 |
|---|---|---|
| _(구현 후 채움)_ `vendor.py` | 4 repo 스킬 벤더링 + baseline/diff 업데이트 | `update-injected-skills` |
| _(구현 후 채움)_ `search.py` | 벤더 스킬 자연어 검색 랭킹 | `skill-finder` |

## 템플릿
- [`_script-template.py`](_script-template.py) — 파이썬 스크립트 헤더/경로 규약.
- [`SKILL.template.md`](SKILL.template.md) — 새 스킬 `SKILL.md` frontmatter 템플릿.
