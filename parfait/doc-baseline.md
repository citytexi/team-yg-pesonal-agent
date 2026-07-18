# 문서-코드 검증 기준선 (Doc Baseline)

> parfait 문서(spec/plan/architecture/adr/open-questions)를 **어느 `develop` 커밋 기준으로 마지막 검증했는지** 기록하는 단일 출처(SoT).
> 사용자가 "develop 기준 문서 점검"을 요청하면, 아래 기준선부터 현재 `origin/develop`까지의 **delta(신규 머지)만** 감사하고, 끝나면 기준선을 갱신한다.

## 현재 기준선
- **repo**: `TJYG-Android` (`mash-up-kr/TJYG-Android`) `develop`
- **커밋**: `8f63945c2f6019f3982253ff9017c6e2bbde4bc7`
- **요약**: `Merge pull request #157 from mash-up-kr/fix/YGButton-fix`
- **검증일**: 2026-07-18
- **미머지 제외 항목**: 브랜치 `refactor/design-system-preview`(프리뷰 `@YGPreview`+`PreviewBox` 통일 + `YGAtomicColors` internal→public) — **develop 미머지**. design-system·open-questions·ADR-0010에 미머지 마커 유지. 머지 시 마커 제거·완료 갱신.

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
| 2026-07-16 | `bd844a5` | Merge #141 (ygchipbutton) | 신규 컴포넌트 2건 스펙 작성(implemented·archive): #141 YGChipButton·#142 YGToggleButton. design-system 인벤토리·원자색 확산 노트 갱신, open-questions에 YGToggleButton 규약 이탈 등록. 미머지: #135 modal·#136 etc |
| 2026-07-18 | `8f63945` | Merge #157 (YGButton-fix) | delta 머지 1건(#157 fix/YGButton-fix): `YGButtonType.kt` 변형별 disabled/pressed foreground·background 색값 스왑 수정만. API·심볼·구조·변형 목록 불변 → 파르페 규율상 색값 미기재라 **문서 콘텐츠 변경 없음**. 기준선 해시만 갱신. 미머지: `refactor/design-system-preview`(프리뷰 통일·YGAtomicColors public) |
| 2026-07-18 | `8cdf942` | Merge #151 (#135 modal) | 신규 머지 6건 반영. modal(#151/#135)·invitecard(#148/#136) spec·plan `implemented`/`done`·archive 이동(드리프트 없음). 신규 컴포넌트 spec 5건 작성(implemented·archive): YGColorChip·YGDate/YGLabel·YGTopBar·YGDateButton·YGDangerZone(#150/#152/#147/#148). ADR-0013(Firebase FCM)·ADR-0014(로깅 추상화 backfill) 신규. design-system 인벤토리·원자색·프리뷰·미머지 마커 정리. open-questions: [2026-07-13] 해소 + 신규 5건(YGColorChip 패키지 불일치·nametag 12/14·YGDateButton clickableYG·FCM 토큰·analytics 패키지). 미머지: 없음 |
