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

## [2026-07-13] ingest | 앱 닉네임 정책 (S-002) v0.1 + 공통 개념 이름-입력-규칙 신설

## [2026-07-13] ingest | 캔버스 정책 (C-001) v0.1 + 개념 캔버스-반응형-레이아웃 신설

## [2026-07-13] ingest | 캘린더 컴포넌트 정의 (C-201) v0.1 + 개념 캘린더-컴포넌트 신설

## [2026-07-13] refactor | wiki/parfait → repo-root parfait/ 분리 (wiki=정책 지식 전용). CLAUDE.md·README.md·wiki/index.md 경로/프레이밍 갱신, [[parfait/index]] 링크는 repo-root vault 기준 유지

## [2026-07-13] lint | 점검 완료, stale 3건(overview 대량·옛 lint 2건·parfait open-questions 위치) + 닉네임 부분해소 미반영 1건. 민감데이터·모순·고아 0

## [2026-07-13] fix | lint 후속 — overview 갱신(정책 8건·개념 4종·논지 확장), open-questions 닉네임 정책 부분해소(⑤ 글자수 확정, 금칙어·중복만 잔존) 반영

## [2026-07-13] maintenance | open-questions parfait 코드 항목 5건 → parfait/open-questions.md 분리
## [2026-07-13] maintenance | lint-2026-07-06-parfait.md(코드 대조 보고서) wiki/synthesis → parfait/ 이동, index 링크 갱신

## [2026-07-14] ingest | C-202 토핑 편집자 확인 규칙 v0.1 + Toast 공통 정책 배치 — sources 2·concepts 2(토핑-spotlight·toast) 신설, 토핑·그룹·nametag-chip 갱신
## [2026-07-18] lint | nametag-chip 정책(12종) vs TJYG-Android YGColorChipType(13+Plus종) 개수 상충 감지 → nametag-chip ⚠️ 마커 + open-questions 등록. parfait 문서 develop 기준선 점검(8cdf942)과 연동
## [2026-07-22] ingest | G-001 간격정책 v0.2 + S-101 컬러규칙 v0.3 배치 — sources 2 신설, 정책설계·간격v0.1·S-101 v0.2 대체 마킹, 개념 3종 갱신(무한-파르페-그리드·토핑·nametag-chip), overview·index 갱신, open-questions 상충 1건(v0.2 160/6타입 vs 토핑-정책-v0.1 180/3타입) 등록
## [2026-07-22] ingest | S-101 그룹칩 Timestamp 컬러 규칙 v0.1 — v0.3에서 분리된 Grouptag-Chip Timestamp 매핑(Cherry-100/200/300, 마지막 변화 유저 기준). sources 1 신설, nametag-chip 개념을 요소별 별개 매핑(토스트 ①/그룹칩 ②) 2표로 정정(이전 "동일 매핑" 오기술 수정), S-101 v0.3 소스/raw 문구 정정, overview·index(36) 갱신. 상충 아님(별개 UI 요소)
## [2026-07-22] lint | 점검 완료, 발견 2건(고아 lint-2026-07-13 index 미등록→등록, stale parfait 링크 방치). 민감데이터·신규 모순 0. 그룹칩 Timestamp vs 토스트 별개 매핑 확인(모순 아님)
## [2026-07-22] lint | parfait 링크 stale 후속 — wiki/index parfait 라인 ADR 개수 정정(14→15, ADR-0015 feature/common 공유 레이어 누락). architecture 5건은 오탐(template 제외 정확)
## [2026-07-23] ingest | 무한 파르페 정책 설계서 v0.2 (G-001) — v0.1 전면 대체, 운영 스펙 확정, open-questions 3해소·1신규
## [2026-07-23] lint | 점검 완료, 이슈 0건 (민감데이터·모순·고아 0). open-questions 3해소 확인, 설계서 v0.2 정합 양호

## [2026-07-25] ingest | 기능정의서_MVP v6 (6차) — G-002 삭제·C-001 직접 진입, 담당자/진행상황 컬럼 raw 미포함

## [2026-07-25] lint | 점검 완료, 이슈 0건 (민감데이터·실명·고아·신규 깨진링크 0). G-002 미포착 미결 해소 확인, v6 정합 양호

## [2026-07-25] ingest | 캔버스 정책 (C-001) v0.2 — Canvas 구성 모델·Area만 16:9·컷 도형+날짜 라벨·Background Dot Grid 신설, Blur 존폐 미결

## [2026-07-25] ingest | 카메라 화면 정책 (C-101) v0.1 — 뷰파인더 반응형(여백 고정·비율 무고정)+프레임 안/밖 분리 블러. 카메라-뷰파인더 개념 신설

## [2026-07-25] lint | 점검 완료 — 실명 노출 2건 발견·HEAD 마스킹 처리(07-22·07-25 보고서). 고아·신규 깨진링크 0, 모순 3건 open-questions 등록됨

## [2026-07-25] ingest | 이미지 렌더링 정책(공용) v0.1 — Max Bounding Box + 비율 조건부 분기(Case A 단독/Case B 흰 컨테이너+테두리). 이미지-렌더링-정책 개념 신설(화면 비종속)

## [2026-07-25] lint | 점검 완료, 이슈 0건 (민감데이터·실명·고아·실깨진링크 0). 이미지 렌더링 정책 v0.1 ingest 후 정합 양호

## [2026-07-25] ingest | 누끼 이미지 정책 (C-103-Selected) v0.1 — 누끼 캔버스 생성(바운딩+20%·투명 확장)+노출(Aspect Fit). 누끼-따기 개념에 편입

## [2026-07-25] lint | 점검 완료, 이슈 0건 (민감데이터·실명·고아·실깨진링크 0). C-103-Selected 누끼 정책 ingest 후 정합 양호

## [2026-07-25] ingest | 누끼 편집 정책 (C-104) v0.1 — 수동 편집 뷰포트·제스처(2핑거 확대·축소 차단·Clamping)·가이드(Opacity 50→100)·브러시/테두리 2~50px. 누끼-편집 개념 신설

## [2026-07-25] lint | 점검 완료, 이슈 0건 (민감데이터·실명·고아·실깨진링크 0). C-104 누끼 편집 정책 ingest 후 정합 양호

## [2026-07-25] ingest | 토핑 배치 정책 (C-106) v0.1 — 초기 렌더링(Max Dim=캔버스 40%·정중앙·48px 방어)+경계(이탈 허용·Clipping Mask). 토핑 개념에 배치 규격 편입

## [2026-07-25] lint | 점검 완료, 이슈 0건 (민감데이터·실명·고아·실깨진링크 0). C-106 토핑 배치 정책 ingest 후 정합 양호

## [2026-07-26] lint | 점검 완료, 이슈 0건 (민감데이터·실명·고아·실깨진링크·raw↔sources 정합 0). 중복 소스 2건 스킵 확인

## [2026-07-27] ingest | G-001 무한파르페 간격 정책 v0.3 — 그룹 토핑 인셋 정책 변경(좌/우 인셋 4·같은 side 갭 -12·Left 268/416/564·Right 354/502/650·템플릿 고정 갭·저개수 좌표화·정렬 동률 타이브레이크). v0.2 대체, 개념 2건 갱신(무한-파르페-그리드·토핑), open-questions 2건 신규

## [2026-07-27] lint | 점검 완료, 차단 이슈 0건 (민감데이터·실명·고아·깨진링크·raw↔sources 정합 0). stale 4건 수정(v0.2 정본 표기 → v0.3 현행화·index updated 정합)

## [2026-07-27] schema | 근거 우선순위·판본 상태(status) 스키마 도입 — 리뷰 지적 3건 반영. sources/ 프론트매터에 status(current/superseded/partial)+superseded_by/supersedes/scope 필수화(28건 부여), index는 투영으로 격하, 근거 우선순위 concepts→open-questions→sources로 명문화(sources 한정 금지), open-questions 상태는 부정 매칭(해소됨 아니면 미결), lint 점검 항목 7 신설 + wiki/script/check-status.py 검사 자동화

## [2026-07-27] lint | 2차 점검(status 스키마 도입 후) 완료, 차단 이슈 0건. status 무결성 28건 위반 0·민감데이터 0·고아 0·깨진링크 실질 0. stale 6건 수정(폐기본을 현행 근거로 인용 — overview 토핑 v0.2→v0.3, 그룹 조회근거 설계서 v0.1→v0.2, nametag-chip 토핑규격 v0.2→v0.3, open-questions 3곳), 마커 공백 3곳 보강(화면-ID-체계 G-002 권한검증·에딧모드, 무한-파르페-그리드 크림/체리). raw/C-001-캔버스-정책-v0.1.md 파일명 NFD 1건 미수정(raw 불변, 사용자 확인 대기)

## [2026-07-27] schema | wiki/templates/ 5종 신설(source·concept·entity·synthesis-analysis·synthesis-lint). 본문 섹션 미강제, frontmatter 필수 필드·`## 연관`/`## 미결` 섹션명·판본 표기 `(vX 현행, [[소스]])`·⚠️ 마커 형식만 고정. CLAUDE.md 템플릿 위치 규약으로 교체(인라인 복제 제거), lint에 templates·script 검사 제외 + 항목 2에 "해소분 하류 반영" 검사 추가. 섹션명 정규화 4건(관련/참고→연관, 미해결→미결), 2차 lint가 놓친 stale 3건 수정(그룹 정렬 "확정 아님"→활동순 확정·2-1 스태거→지그재그, 협업-캔버스-앱 2-1 스태거)

## [2026-07-27] schema | 외부 llm-wiki 구현체(nashsu·nvk) 검토 반영 — wiki/script/lint.py 신설(기계 검사 고정: 민감패턴·frontmatter·링크·의존방향·고아/약연결·raw정합·출처추적·status), 의존 방향 단방향 규약(구현→위키, 콘텐츠 페이지의 구현 문서 링크 금지 — iOS 등 타 플랫폼 재사용 대비), 작업 후 lint 자동 실행 의무화, 2단계 ingest(분석→생성, 배치도 분석 필수), 약연결 검사. 위반 수정: 출처추적 6건(본문 인용 소스가 frontmatter sources 누락) + 의존방향 1건(협업-캔버스-앱 → parfait 링크 제거). 앱 인프라·벡터검색·커뮤니티 검출·멀티토픽 허브·세션 캡처는 규모 미달로 기각

## [2026-07-27] audit | raw ↔ sources 감사(재생성 없음, 전체 재ingest 대안). 수치 커버리지 측정 28건 중 18건 90%+, 최저 G-001-무한파르페-정책설계-v0.2 53.6%. 결함 2건: ① 설계서 v0.2 인셋 28 vs 간격정책 v0.3 인셋 4 → 설계서를 status: partial(§8.2 좌표·타입 상수 절만 대체)로 정정·요약에 해당 절 추가·open-questions 해소됨 등록 ② 토핑 개념이 폐기된 "오버플로우 안 자름(clip OFF)"을 현행으로 기술 — 설계서 v0.2가 명시 폐기했고 v0.3엔 조항 없음. 단 폐기 근거("절대 벗어나지 않음")가 기하학적으로 거짓(Left-2 80.9·Right-2 81.4 > 반폭 80) → 결론 없이 open-questions 미해결 등록 + ⚠️ 마커. ③ 개정이력 표 19건 백필(판본 관계 1차 근거). 기능정의서 화면 상세(201·302~305) 위키 부재는 범위 결정 대기

## [2026-07-27] ingest | G-001 무한파르페 정책설계서 v0.3 — 설계서 v0.2 전면 대체(v0.2는 superseded, 간격정책 v0.3의 supersedes에서 제거). 신규 확정: 좌표 컨테이너=파르페 템플릿 전체(가로 324.3)·좌우 인셋 4(x=4/160.3)·Left↔Right 3.7 겹침은 파생값·토핑이 크림 폭 넘는 것 정상, 저개수 +12 대상 N=1/2/3, Right=Left+86 실측("사이 높이"로 서술 정정), 변형 번호 랜덤 재부여(구 그룹ID 고정 시드 명시 폐기)·재추첨=목록 조회 응답 1회, 크림 가로폭 고정 이미지+중앙 정렬 확정(1안 폐기), 상태 2종 신설(토핑 조회 실패/이미지 없음 템플릿 6타입), 목록 캐싱 안 함 종결, 적용 플랫폼 Android·iOS 명시. open-questions 3건 해소(N=3 y=280·Right y 수치 정본·크림 가로폭) + 1건 신규(참조하나 raw 미수집 문서 2건: G-001-Empty 툴팁 v0.1·토핑-정책 v0.2) + 토핑-정책 항목 "미발행→미수집" 정정. 개념 갱신: 무한-파르페-그리드·토핑

## [2026-07-27] schema | wiki/conventions.md 신설 — 데이터 계약을 CLAUDE.md에서 분리. 계기: iOS 리뷰 CI가 프롬프트 오염 방지로 `rm .llm-wiki/CLAUDE.md .llm-wiki/wiki/CLAUDE.md`를 수행 → 스키마 문서에만 있던 규약(근거 우선순위·status 의미·미결 부정 매칭)이 외부 소비자에게 도달하지 않음. conventions.md는 에이전트 지시 없이 데이터 의미만 기술(계층·신뢰도, status 필드·부정 매칭·체인, open-questions 자유 서술, ⚠️/🔁 마커, 동음이의(토핑 2맥락), 링크·의존 방향 단방향, 검증 스크립트, 개인정보). CLAUDE.md의 중복 서술은 참조로 축약(§1~3·6). index Overview에 등록. lint.py에 코드 펜스 제외 추가(플레이스홀더 오탐 제거)

## [2026-07-29] ingest | G-001-Empty 툴팁 노출 조건 정책 v0.1 — open-questions [2026-07-27] "raw 미수집 2건" 중 ① 해소(② 토핑-정책 v0.2 잔존). 신규 확정: 노출 조건 = "그룹 0건" 상태 자체(최초 1회 노출 플래그 폐기), 닫기 = 툴팁 외 영역 클릭 1종, 닫기 비영속(그룹 생성·합류 없이 이탈 후 재진입 시 재노출). 기존 서술("0건인 동안 상시 노출")과 상충 0건. 신규 개념 페이지 [[g-001-empty-툴팁]] 생성(lint-2026-07-23의 "임계 미달" 판정은 전용 소스 부재 시점 판단 → 뒤집힘). open-questions 2건 신규(툴팁 문구·앵커·스타일 미정 / 닫은 뒤 같은 세션 내 Pull-to-Refresh 재노출 여부). 원문 참조명 불일치 기록: 설계서 v0.3 §4의 `G-001-Empty-툴팁-정책-v0_1.md` = 실제 `G-001-Empty-툴팁-노출-조건-정책-v0.1.md`. 갱신: 무한-파르페-그리드·overview·index

## [2026-07-29] ingest | G-001 그룹 토핑 템플릿 정책 v0.1(2026-07-25)·v0.2(2026-07-26) 배치 — v0.1은 superseded(superseded_by v0.2), v0.2가 current. 설계서 v0.3 §4 상태 매트릭스 2행(특정 토핑 조회 실패 / 이미지 없음)의 상세화. 신규 확정: 조회 실패 그래픽 = 물음표 형태 1종(그룹 칩은 정상 노출), 템플릿 6종 중 1종 랜덤 최초 부여 후 첫 토핑 등록 전까지 고정 — 새로고침·재접속·타 그룹 갱신에도 불변(변형 타입의 "조회 응답마다 재추첨"과 수명이 정반대 → 토핑 개념에 동음이의 주의 절 추가). v0.2에서 에셋 시트 첨부(raw/assets/G-001-그룹-토핑-템플릿-v0.2-그래픽시트.png): Template01~06 = 별(도트/격자)·음표(8분/쌍)·소용돌이(가는/굵은), Template-E = 물음표. open-questions 1건 신규: 6종 정체 상충 — v0.1·설계서 v0.3은 음식 이름(딸기/키위/오레오/딸기과자/파랑젤리/노랑젤리), v0.2 에셋은 별·음표·소용돌이(날짜상 설계서 v0.3이 최신이나 인용 근거는 v0.1). 갱신: 토핑(대체 그래픽 절 신설)·무한-파르페-그리드·overview·index

## [2026-07-29] ingest | S-102 닉네임 정책 v0.2 — v0.1 대체(superseded). 유효성 규칙 3종(허용 문자·1~15자·공백)은 문자 그대로 유지, 번호만 1~3 → 2~4로 재편. 실질 추가 = 앱 닉네임 초기 자동 생성 규칙: 계정 생성 시 1회 형용사/동사 + 파르페 재료를 공백 없이 붙여 랜덤 부여(녹는딸기·몽글한푸딩), 즉시 저장·이후 재계산 없음, 단어 풀 형용사/동사 100 × 재료 30(조합 3000). 적용 순서 = 계정 생성 시 자동 생성 우선 → 사용자가 수정하는 시점부터 유효성 규칙 적용 = 자동 생성물은 유효성 검사 밖. 판본 범위: 표지·적용 범위에 앱 닉네임(S-002)도 병기되나 사용자 확인으로 이 계열은 S-102만 관리 → S-002-앱닉네임-정책-v0.1은 current 유지(규칙 문구 동일, 상충 아님). open-questions 2건 신규: 조합 단어 목록 노션 미수집(목록 없이 구현 불가) / 자동 생성물이 15자 상한을 넘을 수 있는지(단어 길이 상한 미규정 + 유효성 검사 밖). 예시 실명 4건 마스킹(A-005·v0.1과 동일 치환 규칙). 갱신: 이름-입력-규칙(자동 생성 절 신설)·overview·index
