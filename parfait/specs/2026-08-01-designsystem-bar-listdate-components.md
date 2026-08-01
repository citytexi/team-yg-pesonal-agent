---
id: designsystem-bar-listdate-components
title: 디자인시스템 List-Date·Floating Bar 신설 + Top Bar Canvas 변형 (Bar & List-Date Components)
status: in-progress
category: ui-spec
platforms: android
verified: 2026-08-01
related_code:
  - YGListDate.kt#YGListDate
  - YGFloatingBar.kt#YGFloatingBarBackClose
  - YGFloatingBar.kt#YGFloatingBarClose
  - YGFloatingBar.kt#YGFloatingBarEdit
  - YGFloatingBar.kt#YGFloatingBarEditTab
  - YGTopBar.kt#YGTopBarCanvas
  - YGTopBar.kt#YGTopBarEmpty
  - YGTopBar.kt#YGTopBarContent
  - YGChipButtonColorsDefaults.kt#GrayOutline
  - YGDateButton.kt#YGDateButton
  - YGChipColorIndicator.kt#YGChipColorIndicator
  - YGCircleButton.kt#YGCircleButton
  - YGEditTabButton.kt#YGEditTabButton
  - ComponentCatalog.kt#componentCatalog
  - ComponentEntryBuilders.kt#componentEntryBuilders
related_adr:
  - ADR-0018
related_spec:
  - designsystem-canvas-components
  - designsystem-grouptag-topping-components
  - designsystem-button-missing-components
  - app-preview-component-gallery
related_architecture:
  - design-system
supersedes:
superseded_by:
tags: [spec, parfait, designsystem, figma-sync, top-bar, floating-bar, c-201]
---

# Spec: 디자인시스템 List-Date·Floating Bar 신설 + Top Bar Canvas 변형

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처(source of truth). 본문은 설계 내용에 집중.

> ⚠️ **개정(2026-08-01, PR #173 develop 머지 반영)** — 이 스펙이 대상으로 삼던 `YGTopBarDefault`가
> **develop에서 삭제**되고 `YGTopBarEmpty(rightContent)` 슬롯으로 통합됐다. 그 결과 원안의
> "`Default` 드리프트 제거"는 **대상이 사라졌고**(칩 색·문구는 이제 호출 화면 몫), 남은 드리프트는
> 컴포넌트 프리뷰의 칩 색 하나다. `YGTopBarContent` 확장·`YGTopBarCanvas` 신설은 그대로 유효하되
> 기준 시그니처를 #173 이후 코드로 갱신했다. 이 개정 시점에는 코드 미착수였고, 구현은 그 뒤에 이뤄졌다
> (아래 구현 상태).

> **구현 상태(2026-08-01)** — 3종 + 갤러리 등록 전량 완료. repo 전체 `assembleDebug` + `ktlintCheck`
> 통과, 실기기(Galaxy A35, SM-A356N) 갤러리에서 `YGListDate` 4상태×upload 2, `YGFloatingBar` 4변형 +
> 탭 전환, `YGTopBar` 5섹션을 Figma와 육안 대조 완료.
> **TJYG-Android 커밋은 하지 않았다**(작업자 지시). 브랜치 `feature/sync-component`에 작업 트리
> 변경만 남아 있다(신규 6파일 + 수정 2파일 + `YGTopBar.kt`·`YGTopBarPreviewScreen.kt`).
>
> **설계대로 확인된 것** — `YGListDate`의 미업로드 셀이 자리를 유지해 두 섹션의 셀 높이가 같고,
> `YGFloatingBarClose`가 우측 끝에 붙으며(`Arrangement.End`), `Edit-Tab`에서 탭을 누르면 밑줄이
> 옮겨간다. `YGTopBarContent`에 파라미터 2개를 더한 것이 기존 세 변형과 `GroupListScreen`의
> `YGTopBarEmpty(onIconClick, rightContent)` 호출에 영향을 주지 않았다.
>
> **최종 전체 리뷰가 잡은 결함 2건(수정 완료)** — Task 단위 리뷰 3회가 전부 통과한 뒤 나왔고,
> 둘 다 **같은 종류**다: 가중치 없는 `Text`가 가중치 있는 형제보다 먼저 측정돼, 긴 문자열이 잔여
> 폭을 다 먹으면 옆 요소가 0dp로 밀린다.
> - `YGTopBarCanvas` — 긴 그룹명이 **멤버 칩을 소리 없이 지운다.** 제목도 2줄로 감겨 바 높이가 변한다.
> - `YGFloatingBarEdit` — 긴 문구가 **확인 버튼을 0dp로 민다.**
>
> 둘 다 `Modifier.weight(1f)` + `maxLines = 1` + `TextOverflow.Ellipsis`로 해소했다(`Edit`은
> `TextAlign.Center` 추가, Canvas는 `Spacer` 제거). **이 결함이 프리뷰·갤러리 육안 검증을 통과한
> 이유는 모든 샘플 제목이 4자였기 때문이다** — 이 라운드의 가장 큰 교훈이고, 재발 방지로 두 컴포넌트
> 프리뷰에 긴 제목 변형을 상설했다. 사용자 입력값을 받는 텍스트에는 프리뷰에 긴 문자열 케이스를
> 반드시 둔다.
>
> **미검증**: pressed 상태(자동 캡처 불가), 긴 제목 케이스의 **실기기** 렌더 — 갤러리 화면에는 긴
> 제목 섹션을 두지 않아 컴포넌트 프리뷰 정의로만 확인했다. 갤러리에도 추가하는 것은 후속 과제.
>
> **이월 관찰 2건** — `YGTopBarEmpty.rightContent`(안쪽 슬롯)와 새 `trailingContent`(바깥 슬롯)의
> 측정 의미가 달라 다음 변형 작성자가 헷갈릴 수 있다(다음 Top Bar 라운드에서 통합 검토).
> `YGListDate`의 업로드 점이 TalkBack에 노출되지 않는다(모듈 전체에 상태 접근성 기준이 없어 별건).
>
> **2026-08-01 Figma 재조회로 범위가 늘었다** — 구현 완료 후 Top Bar를 다시 확인하니 `Default`·`Empty`
> 두 변형과 공유 컴포넌트 `Button-Chip-Left`가 바뀌어 있었다. 칩 프리셋 교체·개명, 날짜 표시, 반투명
> 배경 + 배경 블러 세 축이 추가됐다(아래 [`Default`·`Empty` 개편](#figma-defaultempty-개편-2026-08-01-figma-재조회)).
> **직전에 확정한 "프리뷰 칩을 `CherrySubtle`로 정정"은 이 재조회로 무효**가 됐다. `Back`·`Detail`·
> `Canvas` 3변형은 무변경이라 `YGListDate`·`YGFloatingBar`·`YGTopBarCanvas` 산출물은 그대로 살아 있다.

> **2차 라운드 구현 상태(2026-08-01)** — 세 축 전량 완료. repo 전체 `assembleDebug` + `ktlintCheck`
> 통과, 실기기(Galaxy A35 / SM-A356N, **API 36**) 갤러리에서 육안 대조 완료.
>
> **설계대로 확인된 것**
> - 칩이 흰 배경 + 회색 테두리 + 진한 글씨로 바뀌었고, 프리셋 하나를 고치자 소비처 6곳이 전부 따라왔다.
>   `GroupListScreen`·`GroupListAddGroupScreen`의 드리프트도 함께 닫혔다.
> - `Default`·`Empty`에 "December 31 (Wed)"가 표시되고 로고 `ic_plus` placeholder가 사라졌다.
> - **배경 블러가 실제로 동작한다** — 바 영역만 흐리고 바로 아래 줄은 선명하며, **틴트 경계와 흐림
>   경계가 정확히 일치**한다. **스크롤 후에도 정합이 유지**돼 ADR-0018이 경고한 좌표 결함이 없다.
>
> **블러 방식이 도중에 뒤집혔다** — 처음엔 `dev.chrisbanes.haze` 도입으로 정했다가, 작업자가
> `androidx.compose.ui.graphics.BlurEffect`로 되지 않느냐고 물어 재검토했다. 확인 결과 (a) 안드로이드
> 배경 블러는 `RenderEffect` 기반이라 **haze도 API 하한이 31로 동일**하고, (b) C-101 카메라 뷰파인더가
> 이미 같은 `GraphicsLayer` 2회 그리기로 확정돼 있어 라이브러리를 넣으면 **블러 관용이 이원화**된다.
> 자체 구현으로 뒤집고 [ADR-0018](../adr/0018-backdrop-blur-graphicslayer.md)에 관용을 못박았다.
> haze를 먼저 제안할 때 C-101 선례를 확인하지 않은 것이 원인이다.
>
> **미검증**: pressed 상태. API 31 미만 기기(검증 기기가 API 36이라 폴백 경로가 실행되지 않았다).
> 실제 화면(G-001)에서의 블러 — 배경 record 배선이 범위 밖이라 갤러리 데모로만 확인했다.

## 목표

Figma 컴포넌트 3종(`List-Date`·`Top Bar`·`Floating Bar`)을 현재 구현과 1:1 대조해 신설·수정한다.
`List-Date`와 `Floating Bar`는 대응 구현체가 없고, `Top Bar`는 Figma 5변형 중 `Canvas` 1종이 빠져 있다.
Figma의 `Default`에 해당하는 구성은 **#173 이후 `Empty` + `rightContent` 조립**으로 표현된다.

선행 라운드가 남긴 두 이월 항목을 함께 닫는다 — 캔버스 스펙이 C-201 라운드로 미룬 `List-Date`, 그리고
Grouptag·Topping 스펙이 "다른 브랜치 작업 중"으로 제외한 `Chip-Indicator`·`List-Date`. `Chip-Indicator`는
그 사이 `YGChipColorIndicator`로 머지돼 이번엔 재사용만 한다.

## 범위

- **포함**
  - `YGListDate`(Figma `List-Date`) — `YGDateButton` + `YGChipColorIndicator` 합성, 신규 파일 1개
  - `YGFloatingBar*`(Figma `Floating Bar`) — 변형별 공개 함수 4종 + 공통 private 컨테이너
  - `YGTopBarCanvas`(Figma `Top Bar` `Status=Canvas`) — 신규 변형
  - `YGTopBarContent` 확장 — `contentPadding`·`trailingContent` 파라미터 추가
  - **`Button-Chip-Left` 프리셋 교체 + 개명** — `CherrySubtle` → `GrayOutline`(흰 배경 + `Gray500` 테두리)
  - **`YGTopBarEmpty` 날짜 표시** — 로고 placeholder → `date`·`day` 파라미터
  - **`Default`·`Empty` 반투명 배경 + 배경 블러** — `White75` + `BlurEffect`([ADR-0018](../adr/0018-backdrop-blur-graphicslayer.md))
  - 3종을 `:app-preview` 컴포넌트 갤러리에 등록·갱신
- **제외**
  - **`YGTopBarDefault` 재도입** — #173에서 삭제된 변형이다. 칩 색·문구는 호출 화면이 정한다
  - `Button-Chip-Right`(`CherrySolid`) — Figma 무변경
  - 배경 블러의 **공용 모디파이어 추출** — 소비처가 Top Bar·C-101 둘뿐이라 이르다(ADR-0018)
  - **List-Member 실물** — Canvas Top Bar가 슬롯만 열고 겹침 배치·`+N` 계산은 호출자 책임(아래 [List-Member](#list-member))
  - C-201 캘린더 패널 실물 — `YGListDate`를 격자로 배치하는 쪽
  - `YGTopBar`의 logo placeholder(`ic_plus`) 치환 — 이월 todo
  - `YGColorChipType` 13종 + Plus ↔ 정책 12종 드리프트 — 기존 이월 미결
  - `Back`/`Detail`/`Empty` 3변형 — Figma와 일치, 무변경

## 신규 토큰·에셋 없음

`Size44`·`gap.gap1`·`padding3`·`padding6`·`padding7`, 아이콘 `ic_caret_left`·`ic_close`·`ic_check`·
`ic_hamburger`가 모두 존재한다. 버튼 라운드에서 세운 "Figma가 고정한 치수만 토큰으로 못박는다" 원칙에
비춰 추가할 것이 없다.

## `YGListDate`

C-201 캘린더의 날짜 셀 1개. 날짜 버튼 아래에 업로드 여부 점을 붙인다.

```kotlin
@Composable
fun YGListDate(
    text: String,
    isSelected: Boolean,
    isToday: Boolean,
    isEnabled: Boolean,
    isUploaded: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
)
```

구조 — `Column(verticalArrangement = spacedBy(gap.gap1), horizontalAlignment = CenterHorizontally)`:

| 요소 | 규격 |
|---|---|
| 날짜 | `YGDateButton(modifier = Modifier.size(SizeTokens.Size44))` |
| 인디케이터 | `YGChipColorIndicator(isChecked = isUploaded)` |

- 전체 44×50dp(44 + gap 2 + dot 4). Figma 프레임과 일치
- `Upload=False`는 Figma에서 `opacity-0`이고 `YGChipColorIndicator`가 미체크 시 `Color.Transparent`를
  그리므로 **자리를 유지한 채 비노출**된다 — 선택 상태가 바뀌어도 셀 높이가 흔들리지 않는다
- 상태 4종(`isSelected`·`isToday`·`isEnabled`·기본)은 `YGDateButton`이 이미 처리하므로 그대로 위임한다.
  여기서 다시 분기하지 않는다
- `onClick`은 `YGDateButton`에 그대로 넘긴다. 인디케이터는 터치 대상이 아니다

부품 2종은 **수정하지 않는다.** 합성 파일 1개만 늘어난다.

## `YGTopBar`

### `YGTopBarContent` 확장

기존 private 컨테이너에 파라미터 2개를 더한다. 기존 3변형(`Back`·`Detail`·`Empty`)의 호출부는 바뀌지
않는다(기본값이 현재 동작과 동일).

> `Empty`가 #173에서 받은 `rightContent`는 **안쪽 `weight(1f)` Row 안**의 형제이고, 여기서 더하는
> `trailingContent`는 **그 Row 바깥**의 형제다. 위치가 달라 이름을 합치지 않는다 — 합치려면 `Empty`의
> 로고 `Box(weight(1f))` 구성까지 다시 짜야 해서 이번 범위 밖 회귀를 산다.

```kotlin
@Composable
private fun YGTopBarContent(
    @DrawableRes iconResource: Int,
    contentDescription: String?,
    onIconClick: () -> Unit,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(
        start = padding3, top = padding3, end = padding7, bottom = padding3,
    ),
    titleContent: @Composable RowScope.() -> Unit = { },
    trailingContent: @Composable () -> Unit = { },
)
```

- `trailingContent`는 `weight(1f)` Row **바깥**의 형제로 배치한다. Figma가 Info-Group을 flex-1로 두고
  우측 아이콘을 그 형제로 두는 구조와 같다
- `contentPadding`을 뺀 이유는 `Canvas`만 사방 `padding3`이고 나머지 4변형은 좌 `padding3`·우 `padding7`로
  비대칭이기 때문이다. 값 하나 때문에 컨테이너를 복제하지 않는다

대안으로 검토한 것: (a) Canvas를 독립 `Row`로 새로 짜기 — 패딩·아이콘 배치가 두 곳으로 갈라져 다음 Figma
변경 때 드리프트가 난다. (b) 완전 슬롯 API(`leading`/`center`/`trailing`)로 리팩터 — 기존 4변형까지
재작성해야 해서 이번 범위 밖 회귀 위험을 산다. 필요한 차이가 `trailing`과 `padding` 둘뿐이라 확장을 택했다.

### `YGTopBarCanvas` (신규)

C-001 캔버스 화면의 상단 바. 뒤로가기 + 그룹명 + 멤버 목록 + 메뉴.

```kotlin
@Composable
fun YGTopBarCanvas(
    title: String,
    onBackClick: () -> Unit,
    onMenuClick: () -> Unit,
    modifier: Modifier = Modifier,
    memberContent: @Composable RowScope.() -> Unit = { },
)
```

| 요소 | 규격 |
|---|---|
| 컨테이너 | `contentPadding = PaddingValues(padding3)` — 사방 8dp |
| leading | `YGIconButton(ic_caret_left, SIZE_44)` |
| 제목 | `typography.body.b01R`, `Gray.Gray800` |
| 멤버 | `memberContent` 슬롯 |
| trailing | `YGIconButton(ic_hamburger, SIZE_44)` |

제목이 좌측, 멤버가 우측에 붙는다. **안쪽 Row의 `Arrangement`는 건드리지 않는다** — 그 Row를
나머지 세 변형이 공유하기 때문이다. 대신 **제목 `Text`가 `Modifier.weight(1f)`를 갖는다.**

> 초안은 `Text` → `Spacer(weight(1f))` → `memberContent()` 순서였다. Compose가 가중치 없는 자식을
> 먼저 전체 잔여 폭에 대해 측정하므로, 긴 그룹명이 행을 다 먹으면 Spacer가 0으로 접히고 **멤버 칩이
> 0dp가 돼 소리 없이 사라진다.** 제목도 2줄로 감겨 바 높이가 변한다. `title`은 사용자 입력값인데
> 프리뷰가 전부 짧은 문자열이라 육안 검증으로 드러나지 않는 종류의 결함이다.
> 가중치를 `Text`에 주고 Spacer를 없애면 해소된다 — `maxLines = 1` + `TextOverflow.Ellipsis` 동반.

### List-Member

Figma의 List-Member(Nametag-Chip 5개를 -12dp씩 겹치고 끝에 `+N` 카운트 칩)는 **컴포넌트로 만들지 않고
슬롯으로 연다.** Figma가 이것을 별도 컴포넌트로 등록해두지 않았고, 겹침 개수·`+N` 임계값·어떤 유저를
앞에 세울지는 그룹 데이터에 걸린 판단이라 디자인시스템이 정할 근거가 없다.

호출자가 `YGNametagChip(Style28)`을 `Row(horizontalArrangement = Arrangement.spacedBy((-12).dp))`로
겹쳐 나열하고(음수 간격 — `Modifier.offset`과 달리 **측정 폭 자체가 줄어들어** 상위 Row가 실제
차지 폭을 알 수 있다), 초과분은
`YGColorChipType`의 Plus 타입 칩에 `+N` 문자열을 넣어 그린다. 갤러리 프리뷰에 **조립 예시**를 두어
사용법을 남긴다.

> ⚠️ Plus 타입은 `YGColorChipType` 13종 + Plus ↔ 정책 12종 드리프트에 걸려 있는 이월 미결 항목이다.
> 이번 라운드에서 정리하지 않는다.

### Figma `Default`·`Empty` 개편 (2026-08-01 Figma 재조회)

> **경위** — 이 라운드 구현을 끝낸 뒤 Figma를 다시 확인하니 `Top Bar`의 `Default`·`Empty` 두 변형과
> 공유 컴포넌트 `Button-Chip-Left`가 바뀌어 있었다. `Back`·`Detail`·`Canvas` 3변형은 무변경이라
> 이 라운드의 `YGTopBarCanvas`·`YGTopBarContent` 확장 산출물은 그대로 유효하다.
> 직전에 확정했던 "프리뷰 칩을 `CherrySubtle`로 정정" 결론은 **이 재조회로 무효가 됐다** —
> `CherrySubtle`도 더 이상 정본이 아니다.

세 축이 바뀌었다.

**① `Button-Chip-Left` 컴포넌트 자체가 바뀜** — Cherry 계열을 버리고 흰 배경 + 회색 테두리로 갔다.

| 상태 | 배경 | 테두리 | 전경 |
|---|---|---|---|
| Default | `Gray.White` | `Gray.Gray500` 1px | `Gray.Gray900` |
| Pressed | `Gray.Gray200` | `Gray.Gray500` 1px | `Gray.Gray950` |

`YGChipButtonColorsDefaults.CherrySubtle` 프리셋의 **값을 교체하고 이름을 `GrayOutline`으로 바꾼다.**
값만 바꾸면 이름이 내용과 어긋난다(Cherry가 한 톤도 안 들어간다). 선행 라운드에 같은 이유로
`CherryBorderPressed`→`CherrySubtle` 개명을 한 선례가 있다. 프리셋 하나를 고치면 소비처가 전부 따라오므로
`GroupListScreen`·`GroupListAddGroupScreen`의 드리프트도 함께 닫힌다.

> `Button-Chip-Right`는 **무변경**이다(`Cherry100`/`Cherry200` + `Gray950`). `CherrySolid`는 그대로 둔다.

**② 로고 placeholder 자리가 날짜로 확정** — `[logo]`가 사라지고 **"December 31" + "(Wed)"** 가 들어간다.
`b01R`, 사이 `gap.gap3`, 날짜 `Gray.Gray800` / 요일 `Gray.Gray300`.

`YGTopBarEmpty`가 `date`·`day` 문자열을 받아 내부에서 텍스트 2개로 그린다. 기존 `YGDate` 컴포넌트는
**쓰지 않는다** — 그쪽은 흰 배경 + `Gray800` 테두리 + 패딩을 갖는 별개 표현이고, Figma도 Top Bar 안에는
`Date` 심볼 인스턴스가 아니라 인라인 텍스트 그룹을 두었다. 이로써 `YGTopBarEmpty`에 남아 있던
로고 `ic_plus` placeholder todo가 닫힌다.

**③ 컨테이너에 반투명 배경 + 배경 블러** — `Transparency.White75` 배경 위 2px 배경 블러.
`Back`·`Detail`·`Canvas`에는 없고 `Default`·`Empty`에만 붙는다.

구현 관용은 [ADR-0018](../adr/0018-backdrop-blur-graphicslayer.md)을 따른다 — 호출 화면이 배경을
`rememberGraphicsLayer()`에 record해 넘기고, Top Bar가 별도 레이어에 복사·`BlurEffect`를 걸어 자기
영역으로 clip해 그린다. 레이어 파라미터는 nullable이고 `null`이면 틴트만 그린다.

> ⚠️ **API 31 미만에서는 블러가 없다.** `RenderEffect`가 API 31+이고 `minSdk`는 26이다. 26~30에서는
> `White75` 틴트만 남는다. 틴트를 블러와 **독립적으로 항상** 그려 가독성을 보장한다.

### 무변경 3변형

`Back`·`Detail`·`Empty`는 Figma와 일치한다(`Empty`는 슬롯이 비었을 때 기준). Figma의 `Detail`·`Back`에
있는 List-Member는 `opacity-0`이고 제목이 좌측 정렬이라 렌더 결과가 같으므로 비노출이 정답이다.

## `YGFloatingBar`

캔버스·편집 화면 위에 떠 있는 액션 바. 4변형이 컨테이너를 공유한다.

### 공통 컨테이너

```kotlin
@Composable
private fun YGFloatingBarContent(
    modifier: Modifier = Modifier,
    horizontalArrangement: Arrangement.Horizontal = Arrangement.SpaceBetween,
    content: @Composable RowScope.() -> Unit,
)
```

- `Row(padding(top = padding6, start = padding7, end = padding7))`, `verticalAlignment = CenterVertically`
- 폭은 `modifier`로 호출자가 정한다. Figma의 375는 프레임 폭일 뿐이라 컴포넌트에 박지 않는다

### 공개 4종

```kotlin
@Composable fun YGFloatingBarBackClose(onBackClick: () -> Unit, onCloseClick: () -> Unit, modifier: Modifier = Modifier)
@Composable fun YGFloatingBarClose(onCloseClick: () -> Unit, modifier: Modifier = Modifier)
@Composable fun YGFloatingBarEdit(title: String, onCloseClick: () -> Unit, onConfirmClick: () -> Unit, modifier: Modifier = Modifier)
@Composable fun YGFloatingBarEditTab(
    tabs: List<String>,
    selectedIndex: Int,
    onTabSelect: (Int) -> Unit,
    onCloseClick: () -> Unit,
    onConfirmClick: () -> Unit,
    modifier: Modifier = Modifier,
)
```

| 변형 | Arrangement | 좌 | 중앙 | 우 |
|---|---|---|---|---|
| `BackClose` | `SpaceBetween` | Circle `ic_caret_left` | — | Circle `ic_close` |
| `Close` | `End` | — | — | Circle `ic_close` |
| `Edit` | `SpaceBetween` | Circle `ic_close` | `Text(body.b01R, Gray800, weight(1f))` | Circle `ic_check` |
| `EditTab` | `SpaceBetween` | Circle `ic_close` | `YGEditTabButton × n` | Circle `ic_check` |

- 원형 버튼은 전부 `YGCircleButton(type = YGCircleButtonType.Default)` — `White` 배경 / `Black5` 테두리 /
  `Gray900` 아이콘 28dp / `padding3`로 총 44dp. Figma `Button-Circle` `Type=Default`와 일치
- `Close`만 `Arrangement.End`다. `SpaceBetween`에 자식이 하나면 좌측으로 붙어 Figma(`justify-end`)와 어긋난다
- `Edit`의 중앙 텍스트는 **`Modifier.weight(1f)` + `TextAlign.Center` + `maxLines = 1` +
  `TextOverflow.Ellipsis`**를 갖는다. 가중치가 없으면 긴 문구가 잔여 폭을 다 먹어 **확인 버튼이
  0dp로 밀린다**(`YGTopBarCanvas`와 같은 종류의 결함). 가중치를 주면 텍스트가 제 박스 안에서
  중앙 정렬되므로 `SpaceBetween`이 두 버튼을 양 끝에 그대로 고정한다.
  `EditTab`의 중앙은 텍스트가 아니라 탭 `Row`라 이 처리를 적용하지 않는다.
- 좌우 버튼 폭이 44dp로 같아 `SpaceBetween`에서 실질 중앙에 온다. Figma도 같은 구조라
  중앙 정렬을 별도로 강제하지 않는다
- `EditTab`의 탭은 `tabs`·`selectedIndex`·`onTabSelect`로 받아 내부에서 `YGEditTabButton`을 나열한다.
  Figma는 "영역"/"테두리" 2탭이지만 문자열을 주입받으면 개수와 무관하게 동작하므로 2탭으로 박지 않는다
- `tabs: List<String>`은 unstable 타입이지만 strong skipping이 인스턴스 동등성으로 스킵을 유지한다.
  프로젝트에 immutable collections 의존성이 없고, 이것 하나 때문에 도입하지 않는다

부품 2종(`YGCircleButton`·`YGEditTabButton`)은 **수정하지 않는다.**

### 반복 버튼 추출

닫기(`ic_close` + `"닫기"`)는 네 변형 중 넷, 확인(`ic_check` + `"확인"`)은 둘에서 같은 인자로 반복된다.
파일 안 private 컴포저블 `YGFloatingBarCloseButton(onClick)`·`YGFloatingBarConfirmButton(onClick)`으로
묶어 호출 지점을 하나로 만든다 — 아이콘·contentDescription·버튼 타입이 바뀔 때 고칠 자리가 한 곳이다.

- `YGFloatingBarBackClose`의 뒤로가기 버튼은 **묶지 않는다.** 한 번만 쓰이므로 감싸면 읽기만 나빠진다.
- 두 private 함수에 `modifier` 파라미터를 두지 않는다. 호출부 여섯 곳이 전부 넘기지 않는다.

## 검증

선행 디자인시스템 라운드(버튼·캔버스·Grouptag/Topping)와 동일하게 **테스트 없이 프리뷰 + 실기기 갤러리
육안 검증**으로 간다. 세 컴포넌트 모두 상태 없는 순수 렌더라 단위 테스트가 잡을 회귀가 거의 없고,
실제 결함(정렬·잘림·색 대비)은 육안에서만 드러난다는 판단을 유지한다.

- `@YGPreview` + `PreviewBox` 프리뷰
  - `YGListDate` — 상태 4종 × `isUploaded` 2
  - `YGTopBar` — `Back`·`Detail`·`Empty`(슬롯 없음/칩 슬롯 2례)·`Canvas`(List-Member 조립 예시 포함)
  - `YGFloatingBar` — 4변형
- `:app-preview` 갤러리
  - `YGListDate` → `ComponentCategory.BUTTON` (`YGDateButton` 옆)
  - `YGFloatingBar` → `ComponentCategory.BAR`
  - 기존 `YGTopBar` 화면에 Canvas 변형 추가
- `:core:designsystem` + `:app-preview` `assembleDebug`, repo 전체 `ktlintCheck`
- 실기기(Galaxy A35) 갤러리에서 Figma와 육안 대조
- **TJYG-Android 커밋은 하지 않는다**(작업자 지시). 작업 트리 변경만 남기고 보고한다

## 열린 질문

1. **`+N` 카운트 칩 타입** — `YGColorChipType`이 13종 + Plus라 정책 12종과 어긋난 상태가 이어진다.
   Canvas Top Bar 갤러리 예시는 Plus 타입으로 그리되, 정리는 Nametag 라운드로 넘긴다.
2. **`YGFloatingBarEdit`의 중앙 문구 출처** — Figma가 `Text` placeholder만 두어 실제 문구(편집 대상 이름인지
   모드 라벨인지)를 알 수 없다. 파라미터로 열어두고 호출 화면 구현 때 확정한다.
3. **Floating Bar의 배치 책임** — Figma가 상단 패딩 16dp만 주고 화면 어디에 떠 있는지(상단 고정 / 하단 /
   오버레이)는 컴포넌트 밖 정보다. 호출 화면이 정한다.
4. **API 31 미만의 배경 블러 부재** — `minSdk` 26이라 26~30에서는 `White75` 틴트만 남는다. 플랫폼
   제약이라 해결책이 아니라 **수용 여부**의 문제다. 디자인 쪽에 "저사양 기기에서는 블러 없음"이
   허용되는지 확인이 필요하다.
5. **`Default`·`Empty`의 날짜 출처** — Figma가 `December 31 (Wed)`를 영문 표기로 고정했는데, 이 앱은
   한국어 UI다. 로케일·포맷 규칙이 미정이라 컴포넌트는 **완성된 문자열 2개를 받기만** 한다.
   포맷 책임은 호출 화면/도메인이고 그 규칙은 아직 정해지지 않았다.
6. **블러 대상 화면 배선** — Top Bar가 레이어를 받는 구조는 정했으나, G-001 그룹 목록이 실제로 배경을
   record하도록 배선하는 것은 이 라운드 범위 밖이다(디자인시스템만 손댄다). 그 전까지 실사용 화면에서는
   블러가 꺼진 상태(틴트만)로 동작한다.
