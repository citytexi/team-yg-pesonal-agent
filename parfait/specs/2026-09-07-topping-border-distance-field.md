---
id: topping-border-distance-field
title: 토핑 테두리 거리장 렌더링 통일 (Distance Field Outline)
status: draft
category: behavior-spec
platforms: android
verified: 2026-09-07
related_code:
  - YGToppingCutoutImage.kt#YGToppingCutoutImage
  - YGToppingCutoutImage.kt#TOPPING_OUTLINE_STAMP_COUNT
  - ToppingBorderOutline.kt#ToppingOutlineDistanceField
  - ToppingBorderOutline.kt#toOutlineDistanceField
  - ToppingBorderOutline.kt#toBorderBands
  - ToppingBorderEditScreen.kt#ToppingBorderEditScreen
  - SegmentationConfirmScreen.kt#SegmentationConfirmScreen
  - CanvasToppingLayer.kt#ToppingImage
  - CanvasToppingLayer.kt#rememberToppingHitEntries
  - CanvasToppingPlaceScreen.kt#CanvasToppingPlaceScreen
  - CanvasBGEditScreen.kt#CanvasToppingImage
  - ToppingAlphaMask.kt#ToppingAlphaMask
  - ToppingAlphaMaskCache.kt#loadToppingAlphaMask
  - ToppingAlphaMaskCache.kt#rememberToppingAlphaMasks
  - ToppingHitTarget.kt#ToppingHitTarget
  - FloatArrayExtension.kt#fillWithSquaredDistance
  - ArgbExtension.kt#fadeArgb
  - ArgbExtension.kt#mixArgb
related_adr: ADR-0025, ADR-0030
related_spec: c103-segmentation-topping-edit, topping-alpha-hit-test, c106-topping-place
related_architecture:
  - design-system.md
  - module-structure.md
supersedes:
superseded_by:
tags: [spec, parfait, topping, border, rendering, hit-test]
---

# Spec: 토핑 테두리 거리장 렌더링 통일

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처(source of truth). 본문은 설계 내용에 집중.

## 목표

토핑 테두리를 그리는 코드가 앱 안에 둘이고 결과가 눈에 띄게 다르다. 편집 화면만 거리장으로
그리고, 나머지 화면 셋은 `YGToppingCutoutImage`의 여덟 방향 스탬프로 그린다. 스탬프 쪽은 구조상
얇은 부위를 메우지 못해 빨대 같은 가는 부위가 여러 갈래로 갈라져 보이고, 볼록한 외곽이 부채꼴로
울퉁불퉁해진다. **렌더러를 거리장 하나로 합쳐 네 화면의 모양을 같게 만들고, 같은 거리장으로
터치 판정까지 처리한다.**

부수적으로 토핑 하나당 프레임 그리기가 아홉 번에서 두 번으로 준다. 캔버스에 토핑이 여럿 올라가는
것이 이 화면의 정상 상태라, 이 감소가 이번 라운드의 성능 근거다.

### 스탬프가 깨지는 이유

`YGToppingCutoutImage`는 반지름 `w` 원 위의 여덟 점에만 실루엣 사본을 찍는다. 이는 원판과의
민코프스키 합이 아니라 **여덟 개 평행이동의 합집합**이다. 인접 스탬프 사이 간격은
`2·w·sin(π/8)`이므로 굵기의 약 0.765배이고, 그보다 가는 부위는 사본이 서로 닿지 않아 따로 찍힌다.
간격을 메우려면 방향 수가 `N ≥ π / asin(f / 2w)`여야 하는데(`f`는 부위의 폭), 굵기 50dp에 폭
10dp인 빨대라면 32방향이 필요하다. 그렇게 늘려도 부채꼴 로브는 남고 그리기는 33회가 된다.

거리장은 픽셀마다 실루엣까지의 거리를 한 번 재고 `거리 ≤ 굵기`인 자리를 칠하므로, 굵기와 무관하게
가장자리가 등거리 곡선으로 이어진다. 이 구현은 이미 `ToppingBorderOutline.kt`에 있고
편집 화면에서 동작한다.

## 범위

**포함**

- 거리장 계산기를 `feature/segmentation/impl`의 `internal`에서 `core:util:{jvm,android}`로 승격.
- `ToppingAlphaMaskCache`를 `core:ui`로 승격하고, 한 번의 디코딩으로 거리장을 내도록 확장.
- `YGToppingCutoutImage`의 여덟 방향 스탬프를 거리장 띠 한 장으로 교체.
- `ToppingHitTarget`의 여덟 방향 되밀기 판정을 거리장 조회로 교체. `ToppingAlphaMask` 제거.
- 테두리가 차지할 자리를 굵기에서 파생(여백 상수와 굵기 상한이 서로를 모르던 문제 해소).
- `retryKey`가 거리장 캐시 키에 들어가 재시도 뒤 테두리·판정이 되살아나게 한다.

**제외**

- **굵기 정책은 건드리지 않는다.** 2~50dp 범위와 화면 dp 고정을 그대로 둔다. 굵기에 정책 소스가
  없다는 사실(OQ-P-208 ③)도 그대로 열려 있다.
- G-001 그룹 목록의 테두리. 서버가 목록 응답에 테두리를 주지 않아 그릴 값이 없다.
- 스크린샷 테스트·매크로벤치마크 신설. 검증은 유닛 테스트와 육안 확인으로 한다.
- `CanvasBGEditScreen`의 `borderLayers`(리스트)와 `CanvasToppingLayer`의 `ToppingBorder.Solid`로
  갈린 모델 이원화. 이번 작업은 두 경로 모두 같은 렌더러를 타게만 한다.
- 편집 화면(`ToppingBorderEditScreen`)의 화면 구조. 코어 API 변경에 맞춰 호출부만 고치고,
  `MAX_BORDER_PADDING_DP`를 `MAX_BORDER_WIDTH_DP`에서 파생시키는 한 줄만 더한다.

## 자료구조와 모듈 배치

현행 `ToppingBorderOutline.kt`는 순수 계산과 `Bitmap` 생성을 한 파일에 들고 있어 그대로 옮길 수
없다. 셋으로 쪼갠다.

| 조각 | 자리 | 내용 |
|------|------|------|
| `ToppingOutline`, `ToppingBorderBand` | `core:util:jvm` | 거리판 보유·이중선형 보간·띠 채우기·불투명 판정. Android 타입 0건 |
| `Bitmap.toToppingOutline()`, `ToppingOutline.toBorderBitmap()` | `core:util:android` | 알파 → 거리판, 픽셀 배열 → `Bitmap` |
| `loadToppingOutline()`, `rememberToppingOutlines()` | `core:ui` | LRU 캐시·in-flight 합류·Coil 디코딩 |
| `YGToppingCutoutImage` | `core:designsystem` (제자리) | 띠 한 장 + 원본 한 장 |

`core:designsystem`은 이미 `core:util:{android,jvm}`에 의존하고, Coil은 `parfait.jetpack.compose`
컨벤션 플러그인이 붙여 준다. **새 모듈도 새 외부 의존도 필요 없다.**

`toBorderBands`는 `feature/segmentation/api`의 `ToppingBorderLayer`를 읽으므로 `core:util:jvm`으로
내려갈 수 없다(core → feature 역방향 의존). 코어는 `ToppingBorderBand(outsetPx, colorArgb)` 쌍만
받고, 겹 목록을 그 쌍으로 펴는 `toBorderBands`는 `feature/segmentation/impl`에 남는다.
`YGToppingCutoutImage`는 ADR-0025대로 겹이 항상 0개 아니면 1개라 색·굵기에서 직접 쌍 하나를 만든다.

### 거리 저장 형식

거리는 `FloatArray`가 아니라 **`ShortArray`에 1/8 필드픽셀 단위**로 담는다. 표현 가능한 거리가
4095 필드픽셀이라 어떤 화면·배율에서도 포화하지 않고, 항목 하나가 `FloatArray`의 절반이다.
긴 변 256 기준으로 항목당 약 128KB이고 캐시 64칸을 다 채워도 8MB다. 사라지는
`ToppingAlphaMask` 비트셋(항목당 약 8KB)을 빼면 순증은 그만큼 작다.

## API / 인터페이스

```kotlin
// core:util:jvm
class ToppingOutline internal constructor(
    val width: Int,
    val height: Int,
    private val distancesEighthPx: ShortArray,
) {
    val hasAnySeed: Boolean

    /**
     * 판 좌표계 거리.
     *
     * **판 밖 좌표는 가장자리 값으로 고정하지 않고 벗어난 만큼을 거리에 더한다.**
     * 씨앗이 모두 판 안에 있으므로 `√(가장자리에서 잰 거리² + 벗어난 거리²)` 가 참값의 하한이고,
     * 가장 가까운 씨앗이 축에 나란할 때 참값과 같다. 고정해 버리면 실루엣이 판 변에 닿은 토핑에서
     * 판 밖 전체가 거리 0 으로 답해, 여백이 통째로 칠해지고 판정도 그만큼 부푼다.
     */
    fun distanceAt(x: Float, y: Float): Float

    /**
     * 거리 0인 자리를 실루엣으로 본다 — 판정이 읽는다.
     * `distanceAt` 과 달리 **보간하지 않고 가장 가까운 칸을 읽는다** — 현행
     * `ToppingAlphaMask.isOpaqueAt` 의 칸 단위 조회와 결과를 같게 유지하기 위해서다.
     */
    fun isOpaqueAt(x: Float, y: Float): Boolean

    /** 단색 띠. 색을 태우지 않아 색이 바뀌어도 다시 만들 필요가 없다 */
    fun buildBorderAlpha(target: ToppingBorderTarget, outsetPx: Float): ByteArray?

    /** 여러 겹을 색까지 태운 띠. 편집 화면이 쓴다 */
    fun buildBorderPixels(target: ToppingBorderTarget, bands: List<ToppingBorderBand>): IntArray?
}

data class ToppingBorderBand(val outsetPx: Float, val colorArgb: Int)

/**
 * 띠를 칠할 판과, 그 판 안에서 알맹이가 놓이는 자리.
 *
 * 알맹이 자리를 따로 받는 것이 핵심이다 — 판은 알맹이보다 사방으로 넓고, 실루엣은 판 전체가
 * 아니라 그 안쪽 사각형에 대응한다. 이 값을 안 받으면 실루엣이 여백까지 채우도록 늘어난다.
 */
data class ToppingBorderTarget(
    val width: Int,
    val height: Int,
    val subjectLeft: Int,
    val subjectTop: Int,
    val subjectWidth: Int,
    val subjectHeight: Int,
)

// core:util:android
fun Bitmap.toToppingOutline(fieldLongSide: Int): ToppingOutline

// core:ui
suspend fun loadToppingOutline(context: Context, model: String, retryKey: Int): ToppingOutline?

@Composable
fun rememberToppingOutlines(models: List<String>, retryKey: Int): Map<String, ToppingOutline>

// core:designsystem
@Composable
fun YGToppingCutoutImage(
    painter: Painter,
    outline: ToppingOutline?,
    borderColor: Color?,
    borderWidth: Dp,
    modifier: Modifier = Modifier,
)
```

`buildBorderAlpha`와 `buildBorderPixels`는 겉만 둘이고 픽셀 순회는 한 벌을 공유한다. 갈리는 것은
칸마다 무엇을 쓰느냐뿐이다 — 앞은 덮은 정도(coverage)를, 뒤는 그 정도로 섞은 ARGB를 쓴다.

`outline`이 `null`이면 테두리를 그리지 않는다. 이미 `borderColor = null`이 같은 뜻이므로
(그림이 아직 안 떴을 때 플레이스홀더 실루엣을 찍지 않으려고 둔 규약) **새 상태가 아니라 기존
상태의 지속 시간이 조금 길어지는 것**이다.

## 동작 / 상태

### 띠 비트맵을 언제 다시 만드는가

전제부터 못박는다. **굵기는 화면 dp 고정이고 알맹이 표시 크기는 변하므로, 알맹이 대비 띠의
비율이 변한다. 따라서 띠 그림은 표시 크기에 의존하며 이것은 피할 수 없다.**

다행히 두 비용이 겹치지 않는다. 핀치로 크기가 변하는 화면은 배치 화면이고 그때 움직이는 토핑은
하나다. 토핑이 여럿인 캔버스 메인·배경 편집에서는 크기가 정적이다. 그래서 2단으로 나눈다.

| 단 | 무엇 | 키 | 수명 |
|----|------|-----|------|
| 1 | 거리판 | 그리는 모델 + `retryKey` | `core:ui` LRU 64칸 |
| 2 | 띠 비트맵 | 거리판 + 표시 크기 + 굵기px + (폴백 시 색) | 컴포저블 `remember` |

1단은 기존 마스크 캐시의 성질을 그대로 물려받는다 — 같은 `ImageRequest` 한 번의 결과로 만들고,
같은 모델의 동시 요청을 합류시키고, 로드를 컴포지션 밖 스코프에서 돌린다. 디코딩 횟수가 늘지
않는다.

2단은 캐시가 아니라 컴포지션 수명이라 화면에서 사라지면 함께 사라진다. **표시 크기를 격자로
반올림하지 않고 실측값 그대로 쓴다.** 반올림한 값으로 만들면 띠가 실제 알맹이보다 그 격자만큼
크게 그려지고 중심도 어긋난다 — 작은 토핑일수록 오차 비율이 커진다.

핀치 중 매 프레임 다시 만드는 것은 짧은 지연으로 막는다. 크기가 연달아 바뀌는 동안에는 만들지
않고, 멎은 뒤에 한 번 만든다. 그래도 되는 이유는 **핀치로 크기가 변하는 화면에서 움직이는 토핑이
하나**이기 때문이다.

### 띠 비트맵의 형식과 크기

**`ALPHA_8` + 그릴 때 `ColorFilter.tint`** 를 1순위로 한다. 색이 픽셀에 굽히지 않아 색만 바뀔 때
다시 만들 필요가 없고, 크기가 `ARGB_8888`의 1/4이다.

⚠️ `ALPHA_8` `ImageBitmap`에 `ColorFilter.tint`가 하드웨어 가속 캔버스에서 의도대로 먹는지는
**확인되지 않았다.** 계획의 첫 태스크에서 검증하고, 안 되면 `ARGB_8888`로 색을 태우면서 색을 2단
키에 더하는 것을 폴백으로 쓴다. 폴백은 메모리가 네 배가 되고 색 변경 시 재생성이 생길 뿐,
설계의 다른 부분은 그대로다.

판 크기는 `표시 크기 + 사방 ⌈굵기px⌉ + 1px`이다. 띠는 알맹이 바깥으로 나가므로 그 자리가 있어야
한다. **이 유도 규칙이 여백 상수와 굵기 상한이 서로를 모르던 문제(OQ-P-337 ①)를 없앤다** —
`MAX_BORDER_PADDING_DP`와 `MAX_BORDER_WIDTH_DP`가 같은 값이면서 별개 상수로 굳어 있고, 굵기 상한이
올라가면 미리보기가 말없이 다시 깎이던 구조였다.

**띠 판은 알맹이 상자 밖으로 나간다.** 그것이 이 설계의 전제다. 그래서 컴포넌트를 쓰는 쪽이
`alpha < 1` 이나 클리핑 레이어를 씌우면 여전히 잘린다 — `CanvasBGEditScreen` 이 상자를
`outlineInset` 만큼 키우고 안쪽으로 덜어내는 우회를 그래서 **유지한다.** 이전 판본은 이 우회를
걷어도 된다고 적었으나 틀렸다. 오프스크린 버퍼가 레이어 밖을 자르는 조건이 그대로다.

편집 화면은 판을 이 규칙으로 만들지 않는다 — 알맹이를 화면에 `Fit` 으로 앉히고 남는 자리를 여백으로
쓰는 구조라 판이 뷰 크기에 묶여 있다. 대신 **`MAX_BORDER_PADDING_DP`를 `MAX_BORDER_WIDTH_DP`에서
파생시킨다.** 두 상수가 같은 값이면서 서로를 모르던 것이 OQ-P-337 ①의 실체이므로, 파생 한 줄이
그 화면 몫을 닫는다.

### 상태별 동작

| 상황 | 그리기 | 판정 |
|------|--------|------|
| 거리판 로딩 중·실패 | 테두리 없이 원본만 | 사각형 폴백(현행 유지) |
| 실루엣에 불투명 픽셀 0건(`hasAnySeed == false`) | 테두리 없음 | 사각형 폴백(현행 `hasAnyOpaque` 규칙과 같은 자리) |
| `borderColor`가 `null`이거나 굵기 0 | 테두리 없음 | 테두리만큼 판정을 넓히지 않음(현행 유지) |
| 정상 | 띠 1장 + 원본 1장 | `거리 ≤ 굵기` |

## 표시·제어 규칙

### 터치 판정

거리판이 알파 마스크를 **포함한다.** 거리가 0인 자리가 곧 불투명한 자리이고, 두 구조의 알파 문턱이
이미 128로 같다(`ToppingAlphaMask.ALPHA_THRESHOLD`와 `OUTLINE_ALPHA_THRESHOLD`). 그래서
`ToppingAlphaMask`·`ToppingAlphaMaskCache`를 없애고 판정도 거리판 하나를 읽는다.

```
현행: 사각형 안? → 마스크 불투명? → 여덟 방향으로 되민 점 중 하나라도 불투명?
변경: 사각형 안? → 거리판 값 ≤ 굵기?
```

`TOPPING_OUTLINE_STAMP_COUNT`가 사라진다. 지금은 판정이 "여덟 방향으로 되민 점"이라는 근사라
실제 외형과 어긋나는 자리가 남는데, 변경 후에는 판정 모양이 그리는 모양과 **정의상** 일치한다.

칸 번호를 `floor`로 내리는 규칙은 그대로 유지한다 — `Float.toInt()`는 0 쪽으로 버려서 그림
왼쪽·위쪽 밖의 음수 좌표가 전부 0번 칸으로 뭉개진다.

**그림 사각형 밖의 동작이 바뀐다.** 지금은 마스크가 범위 밖을 투명으로 답해, 실루엣이 그림 왼쪽
변에 닿아 있어도 그 왼쪽 바깥은 눌리지 않는다. 새 판정은 판 밖 거리를 재므로 **테두리를 그린
자리까지 눌린다.** 그리는 모양과 판정을 일치시키는 것이 이 라운드의 목적이므로 이쪽이 맞지만,
이 변화를 지키던 회귀 테스트 둘(`containsPoint_leftOfImageRect_…`·`containsPoint_aboveImageRect_…`)의
의미가 뒤집히므로 기대값을 새 규칙으로 다시 쓰고 그 의도를 주석에 남긴다.

### 정직하게 밝힐 대가 둘

1. **`hitTestEnabled = false`가 더 이상 디코딩을 아끼지 못한다.** 배치 화면이 배경으로 까는 기존
   토핑들은 판정을 끄면서 마스크 로딩도 껐지만(`loadMasks` 파라미터), 거리판은 **그리기에
   필요해서** 어차피 로드된다. 그 화면에서 디코딩이 는다. 대신 같은 화면에서 그리기가 토핑당
   9회에서 2회로 줄어 상쇄되고도 남는다고 본다. `loadMasks` 파라미터는 의미를 잃으므로 걷어낸다.
   **`CanvasBGEditScreen` 도 같은 이유로 는다** — 지금은 `filter { it.topping.isMine }` 로 내 토핑만
   마스크를 뜨는데, 그리기에 거리판이 필요해지므로 남의 토핑까지 디코딩한다. 두 화면의 KDoc
   (`hitTestEnabled`·`loadMasks`·`retryKey`·`rememberBGEditDrawEntries`)이 함께 낡으므로 같이 고친다.
2. **OQ-P-356이 더 눈에 띄게 된다.** `retryKey`가 표시용 요청의 캐시만 건너뛰고 마스크는 다시
   데려오지 않아, 재시도 뒤 판정이 사각형으로 떨어지는 결함이다. 이제 같은 경로가 그리기를 태우므로
   **재시도로 그림이 돌아와도 테두리가 안 나오게 된다.** 그래서 `retryKey`를 거리판 캐시 키에
   포함시켜 이번 라운드에서 함께 닫는다.

### 표시 크기를 읽는 방법

컴포넌트가 `onSizeChanged`로 크기를 잡되, **양자화한 값이 바뀔 때만** 상태에 쓴다. 그래야 핀치 중
매 프레임 재구성이 일어나지 않는다. 띠 생성은 `produceState`로 `Dispatchers.Default`에서 돌린다.

레이아웃 단계에서 컴포지션으로 되쓰는 모양이지만, 양자화 덕분에 안정된 뒤에는 다시 쓰지 않는다.
같은 배선을 `ToppingBorderEditScreen`이 이미 쓰고 있다.

## 파일 구성

| 파일 | 처리 |
|------|------|
| `core/util/jvm/.../outline/ToppingOutline.kt` | 신설 — 거리판·띠 채우기·불투명 판정 |
| `core/util/android/.../outline/ToppingOutlineBitmap.kt` | 신설 — `Bitmap.toToppingOutline`·`toBorderBitmap` |
| `core/ui/.../outline/ToppingOutlineCache.kt` | 신설 — `ToppingAlphaMaskCache.kt`가 옮겨 오며 거리판으로 바뀐다 |
| `core/designsystem/.../ygtoppingcutout/YGToppingCutoutImage.kt` | 수정 — 스탬프 제거, `outline` 파라미터 |
| `feature/segmentation/impl/.../editor/ToppingBorderOutline.kt` | 축소 — `toBorderBands`만 남는다 |
| `feature/segmentation/impl/.../screen/ToppingBorderEditScreen.kt` | 수정 — 코어 API에 맞춰 호출부만 |
| `feature/segmentation/impl/.../screen/SegmentationConfirmScreen.kt` | 수정 — `outline` 전달 |
| `feature/groups/canvas/impl/.../util/ToppingAlphaMask.kt` | 삭제 |
| `feature/groups/canvas/impl/.../util/ToppingAlphaMaskCache.kt` | 삭제 — `core:ui`로 이동 |
| `feature/groups/canvas/impl/.../util/ToppingHitTarget.kt` | 수정 — 거리판 조회 판정 |
| `feature/groups/canvas/impl/.../component/CanvasToppingLayer.kt` | 수정 — 거리판 전달, `loadMasks` 제거 |
| `feature/groups/canvas/impl/.../screen/CanvasToppingPlaceScreen.kt` | 수정 — `outline` 전달 |
| `feature/groups/canvas/impl/.../screen/CanvasBGEditScreen.kt` | 수정 — `outline` 전달, 인셋 우회 유지 |

## 검증

### 유닛 테스트 (`core:util:jvm`, `parfait.test.unit` 적용됨)

- **원판 회귀** — 씨앗 한 칸에 outset r 을 주면 **거리 r 이하인 칸이 하나도 빠짐없이** 칠해져야
  한다. 여덟 방향 스탬프는 이 자리에서 여덟 갈래 꽃잎을 만들어 스탬프 사이가 빈다.
  ⚠️ 판 끝까지 이어진 긴 막대는 회귀 케이스로 쓸 수 없다 — 180° 스탬프가 열 전체를 덮어
  **스탬프 방식으로도 통과한다.** 스탬프가 실제로 갈라지는 것은 부위가 뻗은 방향과 수직인
  쪽이다.
- 알려진 실루엣(사각형·원)에서 띠 경계가 기대 거리에 오는지.
- 겹 끝 물림(`EDGE_FEATHER_PX`) 덮은 정도 계산.
- 거리 양자화(1/8 필드픽셀 `ShortArray`) 왕복 오차 상한.
- 판 크기와 표시 크기가 다를 때의 이중선형 보간 경로.
- 판정: `거리 ≤ 굵기` 규칙, 굵기 0일 때 실루엣만, 판 밖 좌표.

`Bitmap` 확장(`core:util:android`)과 캐시(`core:ui`)는 Android 런타임이 필요해 유닛으로 덮지
않는다. **따라서 "디코딩 한 번으로 거리판을 만든다"는 기계 검증이 없다.**

### 육안 확인 (실기기)

1. 네 화면에서 같은 토핑·같은 굵기가 같은 모양으로 보이는가.
2. 빨대처럼 가는 부위가 갈라지지 않는가.
3. 누끼 확인 화면에서 테두리가 화면 가장자리에 잘리지 않는가.
4. 토핑이 여럿인 캔버스에서 진입·스크롤이 버벅이지 않는가.
5. 배치 화면 핀치 중 테두리가 따라오는가. 크기가 멎은 뒤 띠가 붙기까지 눈에 띄게 느린가.
6. 이미지 로드 실패 후 재시도했을 때 테두리와 판정이 함께 돌아오는가.

## 주의 / 열린 질문

- **`ALPHA_8` + tint 동작 미확인.** 계획 첫 태스크에서 검증한다. 실패 시 `ARGB_8888` 폴백.
- **거리판 긴 변 256은 판정 정밀도를 기준으로 고른 값이고, 테두리의 요구는 다르다.** 미측정이라는
  지적이 이미 열려 있다(OQ-P-313~316).
- ⚠️ **편집 화면과 나머지 셋의 거리판 해상도가 다르다.** 편집 화면은 화면에 나올 크기 그대로 재고
  (상한 1440), 나머지 셋은 캐시가 준 긴 변 256을 쓴다. 띠의 바깥 곡선은 등거리 곡선이라 굵을 때는
  차이가 안 보이지만, **굵기가 얇을수록 256 격자가 실루엣 잔주름을 뭉갠다.** 확인 화면처럼 토핑이
  화면을 거의 채우는 자리에서 2dp 테두리를 주면 편집 화면과 갈릴 수 있다. 이 라운드는 256으로
  가고 육안 확인 1번이 그 차이를 처음 잰다. 갈리면 512로 올리되 항목당 메모리가 네 배(약 512KB)가
  되므로 캐시 칸 수를 함께 줄인다.
- **굵기에 정책 소스가 없다**(OQ-P-208 ③). 2~50dp는 코드가 먼저 정한 값이고 위키에 대응 정책이
  없다. 이번 라운드는 이 값을 건드리지 않으므로 미결은 그대로 열린 채 남는다. 렌더러를 고쳐도
  굵기 50dp에서는 테두리가 알맹이보다 넓다는 사실은 변하지 않는다.
- **캐시 수명 주체가 여전히 없다**(OQ-P-317). 캐시가 `core:ui`로 옮겨 가도 비우는 호출부는 생기지
  않는다. 항목 수 상한이 있어 누수는 아니지만, 항목당 크기가 8KB에서 128KB로 커지므로 압박 상황의
  체감이 달라질 수 있다.
- **`CanvasToppingLayer`가 마스크를 `topping.imageUrl`로 키를 잡는다.** 캐시의 KDoc은 "그 화면이
  실제로 그리는 모델"을 요구하는데(편집한 토핑은 투명 여백이 트림된 로컬 파일이라 비율이 다르다),
  이 화면은 `imageUrl`만 쓴다. 거리판이 그리기까지 태우면 이 어긋남이 판정뿐 아니라 외형으로도
  드러난다. 이번 라운드에서 확인하고, 실제로 어긋나면 키를 그리는 모델로 맞춘다.

## 해소되는 미결

| ID | 내용 | 해소 방식 |
|----|------|-----------|
| OQ-P-208 ② | 더 싼 방법으로 갈지 | 거리장으로 확정 |
| OQ-P-337 ① | 여백 상수와 굵기 상한이 서로를 모른다 | 판 크기를 굵기에서 파생 |
| OQ-P-337 ② | 한 흐름 안에서 테두리 렌더 규칙이 둘이다 | 렌더러 통일 |
| OQ-P-356 | 재시도가 마스크를 데려오지 않는다 | `retryKey`를 캐시 키에 포함 |

**OQ-P-208 ①(실기기 측정 없음)은 남는다.** 그리기가 9회에서 2회로 주는 것은 코드에서 읽히는
사실이지만 프레임을 잰 것은 아니다. 육안 확인 4번이 체감을 처음 보되 수치는 여전히 없다.
OQ-P-208 ③(굵기 정책 소스 부재)도 남는다. OQ-P-337 ③(실기기 대조 없음)은 육안 확인 1번이
처음으로 그 대조를 수행한다.
