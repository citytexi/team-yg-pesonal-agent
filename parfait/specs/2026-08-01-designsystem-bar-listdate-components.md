---
id: designsystem-bar-listdate-components
title: 디자인시스템 List-Date·Floating Bar 신설 + Top Bar Canvas 변형 (Bar & List-Date Components)
status: draft
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
  - YGDateButton.kt#YGDateButton
  - YGChipColorIndicator.kt#YGChipColorIndicator
  - YGCircleButton.kt#YGCircleButton
  - YGEditTabButton.kt#YGEditTabButton
  - ComponentCatalog.kt#componentCatalog
  - ComponentEntryBuilders.kt#componentEntryBuilders
related_adr:
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
> 기준 시그니처를 #173 이후 코드로 갱신했다. 코드 미착수(스펙 `draft`)라 개정 비용은 문서뿐이다.

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
  - `YGTopBar` 프리뷰 칩 색 정정 — `CherrySolid` → `CherrySubtle`(Figma 정본, 실제 호출부와도 일치)
  - 3종을 `:app-preview` 컴포넌트 갤러리에 등록·갱신
- **제외**
  - **`YGTopBarDefault` 재도입** — #173에서 삭제된 변형이다. 칩 색·문구는 호출 화면이 정한다
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

Info-Group은 `Arrangement.SpaceBetween` — 제목이 좌측, 멤버가 우측에 붙는다.

### List-Member

Figma의 List-Member(Nametag-Chip 5개를 -12dp씩 겹치고 끝에 `+N` 카운트 칩)는 **컴포넌트로 만들지 않고
슬롯으로 연다.** Figma가 이것을 별도 컴포넌트로 등록해두지 않았고, 겹침 개수·`+N` 임계값·어떤 유저를
앞에 세울지는 그룹 데이터에 걸린 판단이라 디자인시스템이 정할 근거가 없다.

호출자가 `YGNametagChip(Style28)`을 `Modifier.offset(x = (-12).dp)`로 겹쳐 나열하고, 초과분은
`YGColorChipType`의 Plus 타입 칩에 `+N` 문자열을 넣어 그린다. 갤러리 프리뷰에 **조립 예시**를 두어
사용법을 남긴다.

> ⚠️ Plus 타입은 `YGColorChipType` 13종 + Plus ↔ 정책 12종 드리프트에 걸려 있는 이월 미결 항목이다.
> 이번 라운드에서 정리하지 않는다.

### Figma `Default` 대응 — 컴포넌트가 아니라 조립

#173이 `YGTopBarDefault`를 지우고 `YGTopBarEmpty(rightContent)`로 통합하면서, 원안이 잡았던 두 드리프트
(칩 색 `CherrySolid`→`CherrySubtle`, 문구 `"새 그룹"`→`"그룹 추가하기"`)는 **호출 화면에서 이미 해소**됐다 —
첫 호출자 G-001이 `CherrySubtle` + `"그룹 추가하기"`로 조립한다([g001-group-list](archive/2026-08-01-g001-group-list.md)).

남은 것은 **컴포넌트 프리뷰 한 곳**이다.

| 항목 | 현재(`YGTopBarPreview`) | Figma(정본) |
|---|---|---|
| 칩 색 프리셋 | `CherrySolid` | `CherrySubtle` (`Cherry50` 배경 / `Gray600` 전경) |

프리뷰 예시만 `CherrySubtle`로 바꾼다. API는 손대지 않는다.

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
| `Edit` | `SpaceBetween` | Circle `ic_close` | `Text(body.b01R, Gray800)` | Circle `ic_check` |
| `EditTab` | `SpaceBetween` | Circle `ic_close` | `YGEditTabButton × n` | Circle `ic_check` |

- 원형 버튼은 전부 `YGCircleButton(type = YGCircleButtonType.Default)` — `White` 배경 / `Black5` 테두리 /
  `Gray900` 아이콘 28dp / `padding3`로 총 44dp. Figma `Button-Circle` `Type=Default`와 일치
- `Close`만 `Arrangement.End`다. `SpaceBetween`에 자식이 하나면 좌측으로 붙어 Figma(`justify-end`)와 어긋난다
- `Edit`의 중앙 텍스트는 좌우 버튼 폭이 44dp로 같아 `SpaceBetween`에서 실질 중앙에 온다. Figma도 같은 구조라
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
