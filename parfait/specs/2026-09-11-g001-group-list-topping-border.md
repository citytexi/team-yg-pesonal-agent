---
id: g001-group-list-topping-border
title: G-001 그룹 목록 최신 토핑에 테두리를 그린다 (Group list topping border)
status: draft
category: ui-spec
platforms: android
verified: 2026-09-11
related_code:
  - YGToppingGroup
  - YGToppingImage.Remote
  - YGToppingCutoutImage
  - rememberToppingOutlines
  - ToppingOutlineCache
  - MyParfaitGroupVO#recentImageBorder
  - ToppingBorder.solidClamped
  - toToppingImage
  - GroupListContent
  - CanvasToppingLayer#ToppingImage
  - YGToppingGroupPreviewScreen
related_adr: ADR-0025, ADR-0030
related_spec: designsystem-grouptag-topping-components, g001-group-list
related_architecture:
  - design-system.md
  - module-structure.md
supersedes:
superseded_by:
tags: [spec, parfait, g001, topping, border]
---

# Spec: G-001 그룹 목록 최신 토핑 테두리

> 티켓 #494, TJYG-Android 브랜치 `feature/#494-group-list-topping-border`.
> 데이터 계층은 PR #496(`1b21725ba`)으로 이미 develop에 들어와 있다. 이 스펙은 그 값을 **화면에 그리는 일**만 다룬다.

## 목표

G-001 그룹 목록의 카드는 그룹마다 오늘 캔버스의 최신 토핑([[토핑]] ([link](../../wiki/concepts/토핑.md)))을
하나씩 보여 준다. 그 토핑에 테두리가 있으면 캔버스와 같은 모양의 테두리를 목록에서도 그린다.
지금은 서버가 `GET /api/parfait-groups` 응답에 테두리 필드 셋을 주고 앱의 `MyParfaitGroupVO.recentImageBorder`까지
받지만, `YGToppingGroup`이 그 값을 받을 자리가 없어 테두리 없이 그린다([open-questions](../synthesis/open-questions.md) OQ-P-316).

## 범위

- 포함
  - `YGToppingImage.Remote`에 테두리를 싣는 자리를 연다.
  - `YGToppingGroup`의 `Remote` 분기가 `YGToppingCutoutImage`로 테두리를 그린다.
  - G-001이 테두리가 있는 토핑의 거리판을 불러와 컴포넌트에 넘긴다.
  - app-preview 카탈로그에 테두리 샘플을 하나 더한다.
- 제외
  - **템플릿 6종·조회 실패 그래픽의 테두리** — 정책이 비어 있다(OQ-P-316 ③).
  - **목록 토핑의 알파 판정·토핑 단위 클릭** — 카드 전체가 클릭 범위인 지금 구조를 바꾸지 않는다(OQ-P-316 ④).
  - **캔버스 쪽 렌더러 변경** — `YGToppingCutoutImage`는 그대로 소비만 한다.
  - `ToppingOutlineCache` 수명·상한 조정(OQ-P-317).

## 확정 결정

브레인스토밍에서 사용자가 고른 것이다. 이유를 함께 적는다.

1. **두께는 서버 dp를 그대로 쓴다.** 캔버스와 같은 규칙이다(`YGToppingCutoutImage`의 `borderWidth`는 화면 기준 dp).
   목록 토핑은 96dp 프레임이고 캔버스 토핑의 기준 긴 변은 캔버스 너비의 40%라, 같은 dp가 목록에서
   **상대적으로 더 굵어 보인다.** 목록 응답에는 토핑 `scale`이 없어 비율로 줄여도 근사치밖에 안 되므로 줄이지 않는다.
2. **토핑을 두께만큼 안쪽으로 줄여 테두리까지 96dp 프레임 안에 넣는다.** `YGToppingCutoutImage`의 띠는 상자 밖으로
   굵기만큼 나가는데, `YGToppingGroup`은 인접 셀을 덮지 않으려고 `clip(RectangleShape)`을 건다. clip 상자를 키우는 안과
   clip을 없애는 안도 있었으나, **바깥 틀과 배치를 한 치도 바꾸지 않는 안**이 선택됐다.
   ⚠️ 대가: 서버 상한인 30dp면 토핑 본체의 긴 변이 36dp까지 줄어든다. 알고 고른 결과다.
3. **거리판은 feature가 불러와 컴포넌트에 넘긴다.** `rememberToppingOutlines`는 `:core:ui`에 있고
   `:core:designsystem`은 `:core:ui`에 의존하지 않는다(`:core:ui`는 `:domain`에 의존한다). 컴포넌트가 직접 부르게
   하려면 디자인시스템이 도메인에 닿아야 해서 기각했다. 캔버스(`CanvasToppingLayer`)와 같은 분업이다.
4. **이미지 슬롯 API로 바꾸지 않는다.** `YGToppingImage` 3상태를 주입받아 렌더만 하는 지금 계약을 유지한다.
   슬롯으로 열면 에러 폴백이 호출부로 흩어지고 app-preview 호출부가 전부 바뀐다.

## API / 인터페이스

### `:core:designsystem` — `component/ygtoppinggroup/`

```kotlin
@Immutable
data class YGToppingBorder(
    val color: Color,
    val width: Dp,
    val outline: ToppingOutline?,
)

@Immutable
sealed interface YGToppingImage {
    @Immutable
    data class Remote(
        val url: String,
        val border: YGToppingBorder? = null,
    ) : YGToppingImage
    // Template·Error 는 그대로
}
```

- `border == null`은 "테두리 없음"이다. `ToppingBorder.None`, 색을 읽지 못한 `Solid`가 모두 여기로 접힌다.
  디자인시스템이 도메인 타입을 모르므로 판정은 feature에서 끝내고 **그릴 수 있는 값만** 넘긴다.
- `outline == null`은 "테두리는 있는데 거리판이 아직 없다"이다. `null`인 동안 크기는 줄어든 채로 알맹이만 그린다.
- `ToppingOutline`은 `:core:util:jvm` 타입이고 `:core:designsystem`은 이미 그 모듈에 의존한다.
- 기본값 `null` 덕분에 기존 호출부(`YGToppingGroupPreviewScreen`, `ToppingImageTest`의 `Remote(url)` 비교)는 바뀌지 않는다.

### `:feature:groups:list:impl` — `util/ToppingImage.kt`

```kotlin
internal fun MyParfaitGroupVO.toToppingImage(
    outlines: Map<String, ToppingOutline>,
): YGToppingImage

internal fun List<MyParfaitGroupVO>.borderedImageUrls(): List<String>
```

- `toToppingImage`: `recentImageUrl`이 없으면 지금처럼 `groupId`로 템플릿을 고른다(테두리 값은 보지 않는다).
  있으면 `Remote(url, border)`를 만들고, `recentImageBorder`가 `Solid`이면서 `color.toColorOrNull()`이 성공할 때만
  `YGToppingBorder(color, width.dp, outlines[url])`을 채운다.
- `borderedImageUrls`: 위와 **같은 판정**으로 테두리를 그릴 그룹의 URL만 모은다. 판정 기준을 두 곳에 두지 않으려고
  같은 파일의 비공개 헬퍼 하나를 두 함수가 함께 쓴다.
- 두께 범위는 다시 가두지 않는다 — 데이터 계층의 `ToppingBorder.solidClamped`가 이미 2~30dp로 가뒀다.

## 동작 / 상태

### `YGToppingGroup`의 `Remote` 분기

`AsyncImage`를 걷어 내고 `rememberAsyncImagePainter(model = url, contentScale = ContentScale.Fit)`로 painter를 만든 뒤
`painter.state`를 구독한다.

| painter 상태 | 그리는 것 | 토핑 축소(`padding`) | `borderColor` |
|---|---|---|---|
| `Error` | `painterResource(TOPPING_ERROR_DRAWABLE)`를 `Image`로 | 없음(96dp) | — |
| `Success` | `YGToppingCutoutImage` | `border?.width ?: 0.dp` | `border?.color` |
| 그 밖(`Empty`·`Loading`) | `YGToppingCutoutImage` | `border?.width ?: 0.dp` | `null` |

- **로딩 중에 색을 넘기지 않는 이유**: 플레이스홀더 실루엣이 테두리로 보인다. 캔버스 `CanvasToppingLayer#ToppingImage`와 같은 조건이다.
- **축소를 painter 상태가 아니라 데이터로 정하는 이유**: 거리판·이미지 도착 시점에 토핑 크기가 튀지 않게 한다.
  로딩 중에는 그림이 비어 있어 줄어든 크기가 보이지 않고, 성공하면 줄어든 크기로 떠서 테두리만 뒤따라 붙는다.
- **에러에서만 축소를 풀어 주는 이유**: 에러 그래픽은 테두리가 없는데 줄어들 까닭이 없다. 로딩(빈 그림)에서 에러로
  넘어가는 순간의 크기 변화는 보이지 않는다.
- `Template`·`Error` 분기는 바꾸지 않는다.

### 모디파이어 순서

```text
size(Size96) → offset(type.imageOffset) → rotate(type.rotation) → clip(RectangleShape) → padding(border width)
```

- `padding`이 `clip` **아래**여야 테두리 띠(알맹이 밖으로 굵기만큼)가 clip 상자 안에 들어온다. 위에 두면 clip 상자가
  함께 줄어 띠가 잘린다.
- `clip`이 `rotate` 안쪽이어야 한다는 기존 조건은 그대로다.
- `YGToppingCutoutImage`에는 `Modifier.fillMaxSize()`를 준다.

### G-001 — `GroupListContent`

```kotlin
val borderedUrls = remember(groupList) { groupList.borderedImageUrls() }
val outlines = rememberToppingOutlines(models = borderedUrls, retryKey = 0)
// …
YGToppingGroup(image = group.toToppingImage(outlines), …)
```

- 목록 전체가 아니라 **테두리를 그릴 토핑만** 거리판을 뜬다. 거리판 한 장은 이미지 디코딩 + 전 픽셀 순회다.
- 새로고침 중에는 `GroupListScreen`이 `groupList`를 비우므로 `models`도 빈다. 새 목록이 오면 새 URL만 뜨고
  이미 뜬 URL은 `ToppingOutlineCache`에서 곧바로 온다.
- `retryKey`는 0으로 고정한다. 목록에는 이미지 재시도 경로가 없다.

## 파일 구성

| 모듈 | 파일 | 변경 |
|---|---|---|
| `:core:designsystem` | `component/ygtoppinggroup/YGToppingBorder.kt` | 신설 |
| `:core:designsystem` | `component/ygtoppinggroup/YGToppingImage.kt` | `Remote`에 `border` |
| `:core:designsystem` | `component/ygtoppinggroup/YGToppingGroup.kt` | `Remote` 분기 교체, 프리뷰에 테두리 샘플 |
| `:feature:groups:list:impl` | `util/ToppingImage.kt` | 시그니처 변경 + `borderedImageUrls` |
| `:feature:groups:list:impl` | `route/GroupListScreen.kt` | `GroupListContent`가 거리판을 불러 넘긴다 |
| `:feature:groups:list:impl` | `test/.../util/ToppingImageTest.kt` | 케이스 추가, 기존 호출을 `toToppingImage(emptyMap())`로 |
| `:app-preview` | `screen/component/YGToppingGroupPreviewScreen.kt` | "Remote + 테두리" 샘플(`rememberToppingOutlines` 사용 — 모듈이 `:core:ui`에 의존한다) |

## 테스트

새 테스트 하니스·빌드 설정은 만들지 않는다.

**`ToppingImageTest`(JVM 유닛)** — 거리판은 `ToppingOutline.of`로 만든다.

| 경우 | 기대 |
|---|---|
| `Solid`(유효 색) + 거리판 있음 | `Remote(url, YGToppingBorder(color, width.dp, outline))` |
| `Solid`(유효 색) + 거리판 없음 | `border`는 있고 `outline == null` |
| `Solid` + 파싱 불가 색 | `border == null` |
| `None` | `border == null` |
| `recentImageUrl == null` (+ 테두리 값 아무거나) | `Template` — 기존 템플릿 케이스 그대로 |
| `borderedImageUrls` | 유효 `Solid`인 그룹의 URL만, 목록 순서대로 |

**렌더(`YGToppingGroup`)** — 자동 테스트를 새로 두지 않는다. `@YGPreview`와 app-preview 카탈로그 샘플로 확인하고,
실기기에서 ① 테두리가 잘리지 않는지 ② 테두리 없는 토핑의 크기가 지금과 같은지 ③ 이미지 로드 실패 시 에러 그래픽이 96dp인지 본다.

## 머지 후 문서 반영

develop 머지 뒤 기준선 점검(`sync-tjyg-develop-baseline`)에서 반영한다. 지금 쓰면 아직 없는 코드를 사실로 적게 된다.

- [design-system.md](../architecture/design-system.md) — `YGToppingGroup` 항목: `Remote`의 `border`, 축소 규칙,
  "테두리를 그리는 화면" 수(ADR-0025 영향 절이 넷으로 센 목록에 G-001 추가).
- [open-questions](../synthesis/open-questions.md) OQ-P-316 — 렌더 부분 해소, ③④는 잔존.
- 이 스펙 — `status: implemented`로 바꾸고 `archive/`로 이동.

## 주의 / 열린 질문

- **거리판 캐시를 캔버스와 나눠 쓴다.** `ToppingOutlineCache` 상한은 64칸이다. 한 사용자가 속할 수 있는 그룹 수의
  상한은 계약 문서([api/parfait-group.md](../api/parfait-group.md))에서 찾지 못했다. 넘어도 깨지지 않고 LRU로 밀려나
  다시 뜰 뿐이다. 캐시 수명 문제는 OQ-P-317이 추적한다.
- **목록 두께가 캔버스보다 굵어 보인다**(결정 1). 디자인 확인에서 다른 값이 나오면 이 스펙의 결정 1을 고친다.
- 템플릿·조회 실패 그래픽 테두리, 목록 토핑 알파 판정은 OQ-P-316 ③④에 그대로 남는다.
