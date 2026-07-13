---
tags: [log, meta]
---

# Wiki Log

append-only. 새 항목은 파일 끝에 추가.
`grep "^## \[" wiki/log.md | tail -10` 으로 최근 10개 이력 확인.

---

## [2026-06-10] init | 위키 구조 초기화
## [2026-06-10] refactor | 피드백 반영 — 링크 규약 통일, overview/open-questions 추가, 프라이버시 정책 명문화
## [2026-07-06] ingest | 기능정의서 MVP v2~v5 (배치) — 소스 4, 엔티티 1, 개념 5 생성, open-questions 4건 등록
## [2026-07-06] ingest | G-001 무한 파르페 정책 설계 — 소스 1, 개념 1(무한-파르페-그리드) 생성, 그룹·토핑·앱·overview 갱신, open-questions 2건 등록
## [2026-07-06] lint | 점검 완료, 3건 발견 (parfait 서브트리 메인 허브 미연결, index 페이지수 stale, parfait↔제품 브리지 부재). 민감데이터·모순·메인 고아 없음
## [2026-07-06] fix | lint 3건 자동 수정 — index Projects 섹션·페이지수 28·협업앱 parfait 브리지·보고서 카탈로그
## [2026-07-06] lint | parfait 내용 정합성(문서 vs TJYG-Android 코드) — 링크·상태표·규율 통과, 코드 대조 발견 7건(중간 3·낮음 4). 병렬 3에이전트 검증
## [2026-07-06] fix | parfait 중간 3건 문서 수정 — module-structure feature/app/setting 추가, ADR-0002 :api navigation 번들 명시, ADR-0007 토큰 심볼명 정정(YGSemanticColors/YGTypography)
## [2026-07-10] sync | parfait 코드 drift 반영 — 2026-07-06 이후 core:designsystem 재설계(#118 YGButton, #121 theme). ADR-0010 신설(자체 CompositionLocal 테마, 0007 supersede), architecture/design-system.md 신설, adr/architecture README·index 갱신
## [2026-07-10] spec | parfait specs/ 신설 — 구현 전 설계 스펙 위치 도입. YGTextField 스펙(component/textfield, idle/focused/error/disabled) 작성. parfait/index·CLAUDE.md에 specs 라우팅 배선
## [2026-07-10] plan | YGTextField 구현 계획(회고형, 완료 체크) 작성 — wiki/parfait/plans/2026-07-10-ygtextfield.md. plans/README 등록. 코드는 TJYG-Android feature/#134에 구현·검증 완료(커밋 대기)
## [2026-07-10] sync | YGTextField 수동 코드 수정 반영 — spec/plan 현행화(배경 semantic white75, idle 테두리 Gray100, radius small, 테두리 Size1, clear 고정 Size44, error 카운터 b02SB, colors() 파라미터화, YGTextFieldImpl 분리, PreviewBox). ADR-0010 변경 없음
## [2026-07-10] spec | YGTextFormField 스펙 작성 — YGTextFieldImpl 재사용 + 하단 description(counterColor 재사용, caption c01R). YGTextField 스펙 상태 '구현 완료'로 갱신
## [2026-07-10] plan | YGTextFormField 구현 계획 작성 — Task 1(YGTextFieldImpl 재사용 + description Column, 전량 코드 포함). plans/README·index 갱신
## [2026-07-10] sync | textfield gap 조정 반영 — YGTextFieldImpl 트레일링 gap3→gap2 + 카운터/clear 내부 Row 그룹핑, YGTextFormField description gap3→gap2. spec/plan 2쌍 동기화. ADR 무관
## [2026-07-10] sync | YGTextFormFieldColors 신설 반영 — description 색 전용 슬롯 분리(counter 재사용 폐기). spec/plan 갱신, 파일 3종(FormField+Colors+Defaults). 코드 compile·ktlint 통과. open-question 해소
## [2026-07-12] adr | segmentation(subject detection) 머지 분석 — ADR-0011(크로스모듈 비트맵 추상 BitmapWrapper/AndroidBitmap)·ADR-0012(ML Kit Subject Segmentation 온디바이스) 신설. architecture(module-structure·data-layer) 갱신, open-questions 3건 등록(BitmapWrapper stub·ML Kit beta·예외 처리 불일치). adr/README·parfait index 갱신
## [2026-07-12] spec | YGHorizontalDivider 스펙 작성 — 피그마 Divider(1dp 수평선, gray-100) 브레인스토밍 확정. Spacer 기반, modifier/thickness/color 파라미터, Colors 홀더·vertical variant 제외. specs/README 등록
## [2026-07-12] plan | YGHorizontalDivider 구현 계획 작성 — component/etc 단일 파일 Task(본체+프리뷰, compile·ktlint·육안 검증). 구현 완료(서브에이전트, compile·ktlint 통과), 커밋 대기. plans/README 등록
## [2026-07-12] spec | YGListItem 스펙 작성 — 피그마 List-Item(메인+옵션 sub 텍스트 + caret 버튼, caret만 clickable) 브레인스토밍 확정. b02R/gray-800 메인, sub는 caption c01R/gray-400 잠정. specs/README 등록
## [2026-07-12] plan | YGListItem 구현 계획 작성 — component/etc 단일 파일 Task(Row+Column weight+caret Box, compile·ktlint·육안 검증). 구현 완료(서브에이전트, compile·ktlint 통과), 커밋 대기. plans/README 등록
## [2026-07-12] spec/plan | YGListItem 구현 반영 + archive 정리 — 실제 구현이 스펙과 drift(showSubText/showCaret 삭제→subText/trailingIcon null 게이팅, showCaret→@DrawableRes trailingIcon 일반화, caretTint→trailingIconColor, sub 타이포 caption.c01R→body.b02SB·세로스택→Row 가로). yglistitem spec/plan 갱신. 4개 컴포넌트(ygtextfield·ygtextformfield·yghorizontaldivider·yglistitem) 대상 repo 구현·시그니처 일치 확인 → spec+plan 8개 specs/plans archive/ 이동, 상대링크 깊이 보정, 양 README 아카이브 테이블 재구성
## [2026-07-12] spec/plan | YGIconButton·YGActionItem 문서화 (사후) — TJYG-Android 머지분(feature/#126-buton-icon) 기록. YGIconButton(component/ygiconbutton, 재사용 아이콘 버튼: Box+Image tint, YGIconButtonSize enum SIZE_44/48, enabled/pressed gray tint, PreviewParameterProvider) = YGListItem·YGTextField의 "TODO IconButton" 실체. YGActionItem(component/ygactionitem, 텍스트 액션 버튼, pressed Gray700/기본 Gray500, Role.Button). spec+plan 각 2개 archive에 작성·양 README 등록. design-system 컴포넌트 인벤토리 추가 + 컨벤션 분기(폴더 네이밍·프리뷰 방식) 노트. open-questions 1건 등록. ADR 신규 없음(아키텍처 결정 아님, ADR-0010/design-system 커버)
## [2026-07-12] spec | YGTextField clear→YGIconButton 교체 스펙 작성 — YGTextFieldImpl clear 인라인 Box+Image(// TODO Change IconButton)를 YGIconButton(SIZE_44, ic_close_round, contentDescription="clear")으로 치환. clearIconTint를 YGTextFieldColors/Defaults에서 제거(기본 Gray300=YGIconButton 기본 tint 동일, pressed Gray400 피드백 신규). YGTextFormField는 Impl 위임으로 무편집 자동 반영. 3파일 범위. specs/README 등록. 브레인스토밍 확정(스코프·tint 결정)
## [2026-07-12] plan | YGTextField clear→YGIconButton 교체 계획 작성 — 2 Task(Task1 YGTextFieldImpl clear 블록을 YGIconButton(SIZE_44)으로 치환+미사용 import 정리, Task2 YGTextFieldColors/Defaults에서 clearIconTint 제거). 순서상 각 Task 후 컴파일 성립. compile+ktlint+프리뷰 검증. plans/README 등록
## [2026-07-12] plan | YGTextField clear→YGIconButton 교체 구현 완료 + archive — TJYG-Android(feature/textfield-clear-iconbutton)에서 서브에이전트로 구현: YGTextFieldImpl clear→YGIconButton(SIZE_44) 치환+미사용 import 정리, YGTextFieldColors/Defaults clearIconTint 제거. ktlintFormat/compileReleaseKotlin/ktlintCheck 전부 BUILD SUCCESSFUL, diff 육안 검증. 코드는 미커밋(사용자 별도 처리). spec 상태 구현 완료로 바꾸고 spec+plan을 archive로 이동, 양 README 갱신
## [2026-07-12] spec/plan | YGListItem trailing 아이콘→YGIconButton 교체 문서화 + 구현 — clear 교체에 이은 두 번째 인라인 아이콘 통일. TJYG-Android(feature/#136-etc-component)에서 YGListItem trailing 인라인 Box+Image→YGIconButton(SIZE_44) 치환, trailingIconColor 파라미터 제거, 미사용 import 정리. ktlintFormat/compileReleaseKotlin/ktlintCheck 전부 BUILD SUCCESSFUL. 코드 미커밋(사용자 별도 처리). 1 Task 단일 파일(색이 직접 파라미터라 clear의 2 Task와 달리 1 Task). spec+plan archive에 작성(구현 완료), 양 README·index 갱신. pressed Gray400 피드백 신규
## [2026-07-13] spec | clickableYG(중복 클릭 방지) 스펙 작성 — 이슈 #94. core:ui에 leading-edge throttle clickable Modifier. 커스텀 Modifier.Node(첫 Node), 시간원 kotlin.time.TimeSource.Monotonic, windowMillis 기본 300ms, lastMark 노드 상태. delegated pointer-input(탭)/indication/semantics. theme-agnostic(indication 파라미터로 받음, 테마색 ripple 기본값은 designsystem 후속). 브레인스토밍 확정(Node vs Flow, throttle vs debounce, TimeSource vs kotlinx.datetime, disabled ripple 게이트). specs/README 등록
## [2026-07-13] plan | clickableYG 구현 계획 + 구현 — core:ui Modifier.kt 단일 파일(clickableYG + ClickableYGElement + ClickableYGNode). TJYG-Android(feature/#94-solve-duplicate-clickable-issue)에서 서브에이전트 구현, API 보정 0(foundation 1.11.0 그대로 컴파일), 후속 리뷰로 init{} unused 정리·onPress enabled 게이트(disabled ripple 차단) 추가. compileReleaseKotlin/ktlintCheck BUILD SUCCESSFUL. 코드 미커밋(사용자 별도). plans/README·index 갱신
## [2026-07-13] spec/plan | ygRipple(커스텀 dim ripple IndicationNodeFactory) 문서화 + 구현 — clickableYG indication용 YG 리플. core:designsystem ripple/YGRipple.kt 단일 파일(ygRipple 팩토리 + YGRippleNodeFactory + DelegatingYGRippleNode + YGDimRippleAlpha 0.15). createRippleModifierNode 위임(material-ripple 전이 포함, 의존 추가 불필요), 기본색 Gray900. skt idDimRipple 패턴 미러. 서브에이전트 구현 API 보정 0, compile/ktlintCheck BUILD SUCCESSFUL. 코드 미커밋(사용자 별도). theme 색 토큰화·designsystem clickable wrapper·ygScaleRipple은 후속. specs/plans README·index 갱신
## [2026-07-13] sync | 리베이스 반영 — clickableYG를 core:ui→core:designsystem(utils/clickable/YGClickable.kt) 이동 + indication 기본값 ygDimRipple() 배선(themed 기본값을 wrapper 없이 clickableYG에 접음), ygRipple→ygDimRipple 리네임(YGRippleNodeFactory/DelegatingNode 포함), YGRipple.kt 위치 utils/clickable·패키지 버그(core.ui.ripple) 수정. 코드 compile+ktlint BUILD SUCCESSFUL(미커밋). clickableYG·ygRipple spec+plan, specs/plans README, design-system 인벤토리 갱신. ADR 무변경. YGInputNumber(develop #129, 타인) 문서 gap 미결
## [2026-07-13] spec/plan | YGInputNumber 사후 문서화 — develop #129(이슈 #125, 타 작업자) 머지분 기록. component/yginputnumber/YGInputNumber(+PreviewData): 50×50 고정 숫자 선택 셀, isSelected 반전(bg White↔Gray900·테두리 Gray100↔Gray900·텍스트 Gray900↔White), radius xSmall, b01R, Role.Button, @Preview+YGCustomTheme+PreviewParameterProvider. spec+plan archive에 작성(구현 완료), specs/plans README·design-system 인벤토리·index 갱신. 과도기: 50.dp/1.dp 리터럴·원자색 직접·프리뷰 방식 혼재
## [2026-07-13] spec/plan | clickableYG 리플 변형 + ygScaleRipple — 이슈 #94 후속. ygScaleRipple(YGScaleRipple.kt, Press 축소 tween150/Release spring bounce, DrawModifierNode) 신설, 코어를 indications: List로 전환(Node가 자체 source에 다중 delegate → non-composable), 공개 clickableYG(=Dim)/clickableYGDimRipple/clickableYGScaleRipple/clickableYGMergeRipple. YGRipple.kt→YGDimRipple.kt 리네임. skt ScaleNodeFactory/idClickable 포팅. 서브에이전트 3 Task 구현 API 보정 0, compile/ktlintCheck BUILD SUCCESSFUL, 코드 미커밋. merge draw 순서·색/scaleValue 토큰화 후속. spec+plan(active)·specs/plans README·index 갱신

## [2026-07-13] ingest | 토핑 정책 (G-001 · Topping) v0.1

## [2026-07-13] ingest | 무한 파르페 정책 · 간격(갭) (G-001) v0.1

## [2026-07-13] ingest | 그룹명 정책 (A-005) v0.1

## [2026-07-13] ingest | 프로필 이미지 및 토스트 닉네임 컬러 규칙 (S-101) v0.2 정본 (+v0.1 이력)

## [2026-07-13] ingest | 닉네임 정책 (S-102) v0.1 — 그룹명 미확정 메모 확정
