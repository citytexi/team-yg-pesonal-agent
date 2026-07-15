# 문서-코드 검증 기준선 (Doc Baseline)

> parfait 문서(spec/plan/architecture/adr/open-questions)를 **어느 `develop` 커밋 기준으로 마지막 검증했는지** 기록하는 단일 출처(SoT).
> 사용자가 "develop 기준 문서 점검"을 요청하면, 아래 기준선부터 현재 `origin/develop`까지의 **delta(신규 머지)만** 감사하고, 끝나면 기준선을 갱신한다.

## 현재 기준선
- **repo**: `TJYG-Android` (`mash-up-kr/TJYG-Android`) `develop`
- **커밋**: `9085bc7534c276728e3d31271d445c8f31d342c7`
- **요약**: `Merge pull request #143 from mash-up-kr/feature/#94-solve-duplicate-clickable-issue`
- **검증일**: 2026-07-15
- **미머지 제외 항목**(문서 인벤토리에서 "미머지" 주석 유지): `#135` modal(`feature/#135-modal-component`), `#136` etc(`feature/#136-etc-component`)

## 점검 절차 (다음 요청 시)
로컬 경로는 개인정보라 `wiki/personal-private/project-paths.md` 참고(아래 `<TJYG-Android>`).

1. **최신화**: `git -C <TJYG-Android> fetch origin develop`
2. **신규 머지 나열**: `git -C <TJYG-Android> log --oneline --merges <기준선>..origin/develop`
   - 각 머지 PR/브랜치가 어떤 컴포넌트·모듈을 건드렸는지 확인:
     `git -C <TJYG-Android> show --stat <merge-hash>`
3. **문서 대조**: 변경된 심볼(컴포넌트/토큰/시그니처)이 parfait 문서와 어긋나는지 검사.
   - 관련 spec/plan `status`·`related_code`, `architecture/*` 인벤토리, `open-questions.md` "미머지" 항목.
   - 드리프트 발견 → 문서 수정. 구현 완료분(develop 머지) spec→`implemented`·`specs/archive/`, plan→`done`·`plans/archive/`.
4. **기준선 갱신**: 위 "현재 기준선"을 새 `origin/develop` HEAD로 교체하고 아래 이력에 한 줄 추가.
5. **미머지 항목 재확인**: `git -C <TJYG-Android> ls-tree -r --name-only origin/develop | grep <심볼>` 로 존재 여부 확정.

> 드리프트는 대개 **문서 검증일 이후 머지된 PR**에서 발생(예: #140 fix/ygbutton). merge 날짜와 문서 `verified` 날짜를 비교하면 후보를 빨리 좁힐 수 있다.

## 기준선 이력
| 검증일 | develop 커밋 | 요약 | 비고 |
|--------|-------------|------|------|
| 2026-07-15 | `9085bc7` | Merge #143 (#94 clickable) | #94 clickable 반영(PR #47) + #140 ygbutton 드리프트 수정(PR #48). 미머지: #135 modal·#136 etc |
