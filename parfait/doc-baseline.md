# 문서-코드 검증 기준선 (Doc Baseline)

> parfait 문서(spec/plan/architecture/adr/open-questions)를 **어느 `develop` 커밋 기준으로 마지막 검증했는지** 기록하는 단일 출처(SoT).
> 사용자가 "develop 기준 문서 점검"을 요청하면, 아래 기준선부터 현재 `origin/develop`까지의 **delta(신규 머지)만** 감사하고, 끝나면 기준선을 갱신한다.

## 현재 기준선
- **repo**: `TJYG-Android` (`mash-up-kr/TJYG-Android`) `develop`
- **커밋**: `01ba72ed56e2d402a14117ca80d2d7aceed59034`
- **요약**: `Merge pull request #156 from mash-up-kr/feature/invite-code`
- **검증일**: 2026-07-23
- **미머지 제외 항목**: 없음.

## 점검 절차 (다음 요청 시)
로컬 경로는 개인정보라 `wiki/personal-private/project-paths.md` 참고(아래 `<TJYG-Android>`).

1. **최신화**: `git -C <TJYG-Android> fetch origin develop`
2. **신규 머지 나열**: `git -C <TJYG-Android> log --oneline --merges <기준선>..origin/develop`
   - 각 머지 PR/브랜치가 어떤 컴포넌트·모듈을 건드렸는지 확인:
     `git -C <TJYG-Android> show --stat <merge-hash>`
3. **문서 대조**: 변경된 심볼(컴포넌트/토큰/시그니처)이 parfait 문서와 어긋나는지 검사.
   - 관련 spec/plan `status`·`related_code`, `architecture/*` 인벤토리, `synthesis/open-questions.md` "미머지" 항목.
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
| 2026-07-19 | `ce4e9b8` | Merge #158 (design-system-preview) | delta 머지 1건(#158, 이전 미머지 추적 항목). 프리뷰 관용구 `@YGPreview`+`PreviewBox` 통일 + `YGAtomicColors` internal→public. preview-migration spec `implemented`·plan `done`·archive 이동(+README 등록). design-system(YGAtomicColors public·원자참조 원칙 이탈·프리뷰 통일 완료)·ADR-0010·open-questions(프리뷰 ② 해소, YGAtomicColors public 코드머지·원칙 ADR 잔존) 마커 해소. 미머지: `feature/sync-design-system-260719`(dashed·radius none, in-progress 스펙 2건) |
| 2026-07-20 | `7b954a8` | Merge #160 (#85 app-side-menu) | delta 머지 1건(#160). S-001 앱 설정 화면 구현(ProfileCard+List 4항목·MVI ViewModel·계정/약관/개인정보 NavKey+stub Route+entry). 선작성 spec/plan과 대조: VM·Route·EntryBuilder·Screen·stub·strings 전부 설계 일치. **드리프트 1건**: ProfileCard 각짐이 설계 `radius.none` → 실제 `RectangleShape` 직접 참조(토큰 미머지 우회). app-setting-s001 spec `implemented`·plan `done`·archive 이동(+README 등록), spec/plan 각짐 문구·코드 실제 반영, open-questions [2026-07-20] 등록(radius-none-sync 머지에 종속). 미머지: `feature/sync-design-system-260719`(dashed·radius none, in-progress 스펙 2건) 유지 |
| 2026-07-22 | `23ef432` | Merge #162 (yg-screen) | delta 머지 4건(#153·#154·#161·#162). **#162**(추적 스펙 in-progress): `core:designsystem screen/` YGScreen·YGScaffold·YGScreenScope + feature :impl EntryBuilder 리팩터 — 코드=설계 완전 일치, ygscreen-scaffold spec `implemented`·archive, open-q [2026-07-20] YGScreen ADR 항목 "코드 머지 확정"으로 갱신(ADR·통합 방향만 잔존). **#161**(draft 스펙/플랜 2건): `:feature:common:terms:{api,impl}` 신설(NavKey 2 + Route/Screen/VM 2 + NotionWebView + EntryBuilder), setting에서 이동 — s004-terms-privacy-webview·feature-common-terms-module spec `implemented`/plan `done`·archive(s004는 최종 위치 common:terms 노트 추가). ADR-0015·module-structure는 선작성 상태로 이미 정합. **#153 term-agree**·**#154 group-nick-name**: parfait 스펙 없던 신규 화면 → 사후 스펙 2건 작성(`implemented`·archive): intro-term-agree·s102-group-nickname. 코드 검증 정상(#154 길이 15·문자 규칙 위키 S-102 일치, term-agree는 저장·랜딩URL·다음nav TODO 잔존). 미머지: 없음 |
| 2026-07-23 | `01ba72e` | Merge #156 (invite-code) | 신규 delta 1건(#156 feature/invite-code). ⚠️ 직전 "현재 기준선" 블록이 `23ef432`로 스테일(step 5 미갱신) — 이력 표 최신 행은 `526f4c9`였음. 두 기준선 합집합(`develop ^23ef432 ^526f4c9`)으로 신규 머지를 재산정 → #156 단일 건만 미검증. #156 = G-002 그룹 초대코드 입력 화면 리팩터(`GroupInviteCode` Route/Screen/VM + `InviteCodeInputFieldElement` + `CheckInviteCodeValidUseCase`): codeLength 5→6, `FocusedFirstIndex` 인텐트(첫 필드 자동 포커스), 입력 시 errorText 리셋, InputFieldElement border/RoundedCornerShape 제거 재스타일. **화면은 두 직전 기준선에 이미 존재(신규 아님, 리팩터)**, parfait 스펙 없던 feature-local 화면. 변경 심볼이 어느 parfait 문서와도 무충돌 — `NavKeyGroupInviteCode`(navigation-flow)·`feature/groups/enter/{api,impl}`(module-structure) 불변, `YGInviteCard`(design-system, 별개 카드 컴포넌트) 미변경, codeLength는 매직넘버라 파르페 규율상 문서 미기재. **드리프트 0건 → 문서 콘텐츠 변경 없음, 기준선 해시만 갱신**(#157/#158 선례와 동일). 미검증 TODO 잔존(UseCase 검증·클립보드 자동복붙, 코드 주석). 미머지: 없음 |
| 2026-07-22 | `526f4c9` | Merge #159 (sync-design-system-260719) | delta 머지 2건(#163, #159). **#159**(추적하던 미머지 브랜치): YGDangerZone 점선 재설계(`dashedBorder()`·`YGHorizontalDashedDivider` 신규)·`radius.none` 토큰 신설·YGTextField(none/white)·YGInviteCard(none)·YGButtonType SmallSquare(none) 각짐 sync. 코드=설계 완전 일치, in-progress 스펙 2건([ygdangerzone-dashed]·[radius-none-sync]) `implemented`·archive 이동, 구 solid ygdangerzone `superseded`. **#163**: `:app-preview` 컴포넌트 갤러리(카탈로그 5카테고리·NavKey17·showcase17·@IntoSet 배선) — 선작성 spec/plan과 구조 일치, `implemented`/`done`·archive 이동. design-system(radius none·dashed 프리미티브·YGDangerZone 재설계·textfield/invitecard/button sync 마커) 갱신. open-questions: ProfileCard 종속 해소(코드 교체만 잔존)·YGDangerZone 피그마 델타(gap-5·고정폭) [2026-07-22] 신규. 미머지: 없음 |
