---
id: c202-canvas-spotlight
title: C-202 캔버스 토핑 Spotlight — 타인 토핑 탭 강조·Dim·작성자 토스트 (Canvas Spotlight)
status: implemented
category: ui-spec
platforms: android
verified: 2026-08-21
related_code:
  - CanvasToppingLayer.kt#CanvasToppingLayer
  - CanvasToppingLayer.kt#CanvasTopping
  - CanvasMainViewModel.kt#CanvasMainUiState.spotlightedToppingId
  - CanvasMainViewModel.kt#handleOnClickTopping
  - CanvasMainViewModel.kt#resetSpotlight
  - CanvasMainViewModel.kt#CanvasMainEffect.ShowSpotlightToast
  - CanvasMainViewModel.kt#GroupMemberChip
  - CanvasMainRoute.kt#CanvasMainRoute
  - CanvasMainScreen.kt#CanvasMainScreen
  - SpotlightTimeLabel.kt#toSpotlightTimeLabel
  - SpotlightToastColor.kt#toSpotlightToastNameColor
  - InstantExtension.kt#ElapsedTimeBucket
  - InstantExtension.kt#toElapsedTimeBucket
  - YGCanvas.kt#YGCanvas
  - YGToast.kt#YGToastType.Record
related_adr: ADR-0005, ADR-0010, ADR-0014
related_spec: c001-canvas-today-detail, c201-canvas-calendar-server, ygtoast, designsystem-canvas-components, c106-topping-place-api
related_architecture: design-system, state-management
supersedes:
superseded_by:
tags: [spec, parfait, canvas, topping, c-202, ui]
---

# Spec: C-202 캔버스 토핑 Spotlight

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처. 본문은 설계 내용에 집중.

> **사후 기록(post-hoc)** — 선작성 스펙 없이 develop 머지(PR #298, 브랜치 `feature/spotlight-topping`,
> 2026-08-20 `9b112e86`). as-built 역기록이고 **코드가 SoT**다.

## 목표

C-001 캔버스에 놓인 토핑을 탭하면 그 하나만 남기고 나머지를 어둡게 덮은 뒤, 누가 언제 쌓았는지를
토스트로 한 번 알린다. 위키 [[C-202-토핑-편집자-확인-규칙-v0.1]]([[토핑-spotlight]])이 정의한
Default ↔ Spotlighted 두 상태를 코드로 옮긴 첫 라운드다.

## 범위

- **포함**: 토핑 탭 수신 · Spotlight 상태 필드 · Dim 레이어 · 그리기 순서 재배치 ·
  작성자 토스트 1회 노출(닉네임·닉네임 색·상대 시각) · 백그라운드 복귀 시 해제 ·
  `YGCanvas`의 토스트 자리(`overlayContent` 슬롯) 신설 · `YGToastType.Record`의 닉네임 색 파라미터화 ·
  경과 시간 갈래 유틸(`ElapsedTimeBucket`).
- **제외**: **본인 토핑 탭 → C-305 편집 진입**(목적지가 아직 없다) · 탈퇴·이탈 사용자 토스트 표기 ·
  Pull-to-Refresh 시 해제(캔버스 화면에 당겨 새로고침이 없다) · **테스트**(이 라운드는 신규 유닛 0건) ·
  실기기 확인.

## 상태 기계

상태는 `CanvasMainUiState.spotlightedToppingId: ParfaitImageId?` 하나이고 `null`이 Default다.
파생 `spotlightedTopping`은 그 id로 현재 목록을 되짚어, **강조 중이던 토핑이 재조회로 사라지면
자동으로 `null`**이 된다.

| 전이 | 계기 | 코드 |
|---|---|---|
| Default → Spotlighted | 토핑 탭 | `handleOnClickTopping` |
| Spotlighted → Default | Dim 영역 탭 | `OnClickSpotlightDim` → `resetSpotlight` |
| Spotlighted → Default | 앱 백그라운드 복귀 | `OnAppReturnedFromBackground` → `resetSpotlight` |
| Spotlighted → Spotlighted | **불가** | `handleOnClickTopping`이 `spotlightedToppingId != null`이면 즉시 반환 |

직접 전환을 막은 것은 정책이 "다른 토핑을 고르려면 Default를 경유한다"고 정해 둔 그대로다.
백그라운드 복귀 감지는 Route의 `LifecycleStartEffect`이고, 같은 이유로 `ON_START` 구독 관용구가
이 화면에서 `LifecycleResumeEffect`(재진입 재조회)와 나란히 서게 됐다.

`resetSpotlight`를 별도 함수로 뽑아 둔 것은 Pull-to-Refresh가 붙을 자리를 비워 둔 것이다 —
정책은 "먼저 Default로 되돌린 뒤 새로고침"을 규정하는데 캔버스에는 아직 당겨서 새로고침이 없다.

## 렌더링 — 순서가 곧 우선순위다

`CanvasToppingLayer`가 한 `BoxWithConstraints` 안에서 세 덩어리를 순서대로 놓는다.

1. 강조 대상이 **아닌** 토핑 전부(목록 순서 = `positionZ` 오름차순 유지)
2. Dim 레이어 — `matchParentSize` · `Transparency.Black50` · `clickableYGNoRipple`
3. 강조 토핑 하나

결과 z는 정책이 적은 **Spotlight 토핑 > Dim > 나머지 토핑 > 배경**과 같다. 배경은 이 레이어 밖
`YGCanvas`가 그리므로 Dim이 캔버스 배경까지 덮지는 않는다 — 정책의 "선택 토핑 제외 전체 영역"을
**토핑 레이어 범위로 읽은 것**이고, 그림상 캔버스 배경은 어두워지지 않는다.

토핑마다 `clickableYGNoRipple`이 붙는다. 강조 중인 토핑을 눌러도 위 전이 표대로 아무 일도 일어나지
않는다(Spotlighted에서 들어온 탭은 전부 무시).

## 토스트

`ShowSpotlightToast(nickname, nicknameColor, elapsed)` 이펙트를 Spotlight 진입과 **같은 자리에서**
1회 쏜다. 상태가 아니라 이펙트라 회전·재구성으로 다시 뜨지 않는다.

**자리**는 `YGCanvas`에 새로 뚫은 `overlayContent` 슬롯이다. 이 슬롯은 캔버스 본체 `Box`의 형제라
Dim·확장 메뉴·달력보다 위에 그려지고, 상단 여백은 캔버스 위쪽 여백에 맞추되 **폭은 캔버스 폭이
아니라 화면 폭**이다. 화면(`CanvasMainScreen`)이 그 슬롯에 `YGToastHost`를 꽂고 Route가 만든
`YGToastPolicy`를 넘겨받는다 — 이펙트를 처리하는 곳이 Route라 정책 홀더도 Route가 쥔다.

이 결정이 C-001의 다른 토스트 자리까지 정했다 — 오늘 캔버스 조회 실패 토스트도 `YGScaffoldV2`
최상단이 아니라 이 호스트로 간다(OQ-P-167, C-106 결선 PR3).

**문구**는 `{닉네임}님이 {상대시각}에 쌓았어요`다. 정책 문안(`{닉네임} 님이 {상대시간} 전에
쌓았어요`)과 달리 "전"을 시각 쪽 구절이 품는다 — `오래전`처럼 "전"이 붙지 않는 갈래가 있어서다.
`YGToastType.Record.time`의 KDoc이 "조사까지 포함한 완성된 구절"이라고 그 계약을 적는다.

**상대 시각**은 `core:util:jvm`의 `ElapsedTimeBucket`이 갈래로 나누고 문구는 화면이 붙인다
(`SpotlightTimeLabel`, `strings.xml`).

| 갈래 | 조건 | 문구 |
|---|---|---|
| `JustNow` | 1분 미만 | 방금 전 |
| `Minutes` | 1시간 미만 | N분 전 |
| `Hours` | 1일 미만 | N시간 전 |
| `Days` | `LONG_AGO_DAYS` 미만 | N일 전 |
| `LongAgo` | 그 이상 | 오래전 |

기준 시각은 `topping.createdAt.toInstant(PARFAIT_TIME_ZONE)`이다 — 서버가 오프셋 없는 KST 벽시계를
주므로 기기 시간대로 재면 해외 기기에서 어긋난다. 기기 시계가 서버보다 뒤처져 **미래 시각이
들어오면 `JustNow`로 접는다**(음수 경과를 그대로 보여 주지 않는다).

**닉네임 색**은 작성자의 Nametag-Chip 타입에서 나온다(`toSpotlightToastNameColor`). 칩 자체의
글자색과는 다른 토스트 전용 매핑이고 12타입이 6색으로 접힌다. `Default`·`NametagChipPlus`는
그레이 계열과 같은 `White`다. 이 변환 때문에 `YGToastType.Record`가 `userNameColor`를 받게 됐고,
디자인시스템이 들고 있던 `Pudding500` 고정이 호출자 몫으로 내려왔다.

**작성자 칩을 어디서 얻는가가 이 라운드의 임시 결정이다.** 서버는 `placedBy.nameTagChip`을 이미
주지만 앱 DTO에서 멈춰 있어(OQ-P-224 잔여) 도메인까지 오지 않는다. 그래서 화면이 이미 들고 있는
`memberChips`에서 **같은 `groupMemberId`를 찾아 대신 쓴다** — 그 조인을 위해 `GroupMemberChip`에
`groupMemberId`가 붙었다. 목록에 없는 사람(탈퇴·이탈)은 `Default`로 떨어지는데, **서버도 그 경우
`placedBy.nameTagChip`을 `DEFAULT`로 준다**(`groupMembers`는 탈퇴자를 거르고 `placedBy`는 안 거른다,
[api/parfait.md](../../api/parfait.md)). 즉 지금은 두 경로의 결과가 **우연히 같다** — 조인이 임시라는
사실이 화면에 드러나지 않는다.

## 파일 구성

| 자리 | 역할 |
|---|---|
| `core/util/jvm/.../extension/InstantExtension.kt` | `ElapsedTimeBucket` + `toElapsedTimeBucket` |
| `core/designsystem/.../ygcanvas/YGCanvas.kt` | `overlayContent` 슬롯 |
| `core/designsystem/.../ygtoast/YGToast.kt` | `Record.userNameColor` · 문구 조립 변경 |
| `feature/.../canvas/impl/component/CanvasToppingLayer.kt` | Dim·그리기 순서·탭 수신 |
| `feature/.../canvas/impl/util/SpotlightToastColor.kt` | 칩 타입 → 토스트 닉네임 색 |
| `feature/.../canvas/impl/util/SpotlightTimeLabel.kt` | 갈래 → 문구(`Context.getString`) |
| `feature/.../canvas/impl/viewmodel/CanvasMainViewModel.kt` | 상태·전이·이펙트 |

`SpotlightTimeLabel`이 `stringResource` 대신 `Context.getString`을 쓰는 이유는 이펙트 처리가
`LaunchedEffect` 코루틴 안이라 컴포저블 문맥이 없어서다.

## 정책 대조 (위키 [[C-202-토핑-편집자-확인-규칙-v0.1]])

| 정책 | 구현 |
|---|---|
| 타인 토핑 탭 → Spotlight + 작성자 Toast 1회 | 일치 |
| Dim = Transparency/Black-50 | 일치 |
| z: Spotlight 토핑 > Dim > 나머지 토핑 > 배경 | 일치(배경은 Dim 밖이라 어두워지지 않는다) |
| Spotlighted → Spotlighted 직접 전환 불가 | 일치 |
| Dim 포함 강조 토핑 밖 탭 → Default | 일치 |
| 앱 백그라운드 → 복귀 시 Default | 일치 |
| **본인 토핑 탭 → C-305 편집 진입** | **미구현** — `isMine()`이 상수 `false`라 본인 토핑도 Spotlight로 들어가고 자기 닉네임이 뜬다 |
| **탈퇴·이탈 사용자는 Toast에 "알 수 없음"** | **부분** — 서버가 탈퇴 멤버의 `placedBy.nickname`을 `(알수없음)`으로 주므로 뜻은 맞지만, 문장이 정책 예시(`알 수 없는 사용자가 …`)와 달리 `(알수없음)님이 …`가 된다 |
| Pull-to-Refresh 시 먼저 Default 복귀 | 해당 없음(캔버스에 당겨 새로고침 없음) |
| Toast 노출·소멸은 [[toast]] 공통 규칙 | 호스트는 공통(`YGToastHost`)이나 **자리가 화면 상단이 아니라 캔버스 프레임 상단**이다 |

상대 시각의 갈래 경계(1분·1시간·1일·7일)와 `오래전` 문구는 정책에 근거가 없다 — 코드가 정했다.

## 드리프트 / 열린 질문

- ⚠️ **본인 토핑 판정 경로가 없다** — 서버 응답이 "내 `groupMemberId`"를 알려 주지 않아
  `isMine()`이 항상 `false`다. C-305 진입도 `TODO`로 남는다 → OQ-P-250.
- ⚠️ **작성자 칩이 서버 값이 아니라 화면 목록 조인이다** — `placedBy.nameTagChip`이 도메인까지 오면
  그 값으로 바꾼다는 `TODO`가 붙어 있다(OQ-P-224 잔여). 지금은 탈퇴 멤버에서도 두 경로의 결과가
  같아 **틀린 색이 보이지는 않는다** → OQ-P-251.
- 탈퇴 멤버 문장이 `(알수없음)님이 …`가 된다 — 서버 문자열을 그대로 쓰는 결과이고 정책 예시 문안과
  형태가 다르다 → OQ-P-251 ②.
- ⚠️ **이 라운드는 신규 유닛 테스트가 0건이다** — 판단이 몰린 순수 함수 둘
  (`toElapsedTimeBucket`·`toSpotlightToastNameColor`)이 덮이지 않았다 → OQ-P-252.
- 상대 시각 갈래 경계와 `오래전` 문구에 정책 근거가 없다 → OQ-P-251 ③.
- 토스트 폭이 캔버스가 아니라 화면 기준이라, 캔버스 좌우 여백 위까지 토스트가 걸친다.
- 실기기 확인 없음.
