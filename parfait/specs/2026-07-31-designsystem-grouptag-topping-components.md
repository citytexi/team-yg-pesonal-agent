---
id: designsystem-grouptag-topping-components
title: 디자인시스템 Grouptag-Chip·Topping-Group 컴포넌트 신설 (Grouptag & Topping Group Components)
status: draft
category: ui-spec
platforms: android
verified: 2026-07-31
related_code:
  - YGGrouptagChip.kt#YGGrouptagChip
  - YGGrouptagChipType.kt#YGGrouptagChipType
  - YGToppingGroup.kt#YGToppingGroup
  - YGToppingGroupType.kt#YGToppingGroupType
  - YGToppingImage.kt#YGToppingImage
  - YGToppingTemplate.kt#YGToppingTemplate
  - SizeTokens.kt#SizeTokens
  - ComposeConfig.kt#ComposeConfig
  - ComponentCatalog.kt#componentCatalog
related_adr:
related_spec:
  - designsystem-canvas-components
  - designsystem-button-missing-components
  - app-preview-component-gallery
related_architecture:
  - design-system
supersedes:
superseded_by:
tags: [spec, parfait, designsystem, figma-sync, g-001, topping]
---

# Spec: 디자인시스템 Grouptag-Chip·Topping-Group 컴포넌트 신설

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처(source of truth). 본문은 설계 내용에 집중.

## 목표

Figma "칩"·"기타" 영역 컴포넌트 2종(`Grouptag-Chip`·`Topping-Group`)을 `:core:designsystem`에
신설한다. 두 종 모두 대응 구현체가 없다. G-001 무한 파르페 그리드(그룹 목록) 화면 구현의 선행 작업이다.

## 범위

- **포함**
  - `YGGrouptagChip`(Figma `Grouptag-Chip`) — 이름 + 구분점 + 상대시간 pill, 타입 6종
  - `YGGrouptagChipType` — 타임스탬프 텍스트 컬러 매핑 enum 6종
  - `YGToppingGroup`(Figma `Topping-Group`) — 160dp 프레임에 토핑 이미지 + 그룹 칩 합성
  - `YGToppingGroupType` — 배치 변형 7종(회전·오프셋 상수)
  - `YGToppingImage` — 토핑 콘텐츠 3상태 sealed
  - `YGToppingTemplate` — 이미지 없음 템플릿 6종 enum
  - 토핑 템플릿 에셋 7종(6종 + Error) 6개 density 버킷 반입
  - `SizeTokens`에 `Size96`·`Size160` 추가
  - Coil 3 네트워크 페처(`coil-network-okhttp`) 도입
  - 2종을 `:app-preview` 컴포넌트 갤러리에 등록
- **제외**
  - Figma `Chip-Indicator`·`List-Date` — **다른 브랜치에서 작업 중**(작업자 확인)
  - G-001 그룹 목록 화면(`feature/groups/list`) 실구현 — 이 컴포넌트를 쓰는 쪽
  - 템플릿 6종 랜덤 부여·영속 로직 — feature/domain 책임(아래 [계층 분할](#계층-분할) 참고)
  - `YGColorChipType`(Nametag-Chip) 14종 ↔ 정책 12종 드리프트 정리 — 기존 이월 미결

## 계층 분할

위키 [[토핑]] 대체 그래픽 조항은 "6종 중 1종 랜덤 최초 부여 → 첫 토핑 등록 전까지 고정, 새로고침·재접속·타
그룹 갱신에도 불변"을 요구한다. 이 정책을 디자인시스템에 넣지 않는다. 근거 3가지:

1. **"첫 토핑 등록 전까지"는 서버 데이터에 걸린 조건.** 그룹에 토핑이 생겼는지를 UI 컴포넌트는 모른다.
2. **"조회 실패"와 "이미지 없음"은 원인이 다른 별개 상태.** URL이 null인지로 추론하면 두 상태가 뭉개진다 —
   API가 실패한 것인지, 성공했는데 토핑이 없는 것인지 구분할 수 없다.
3. 위키는 **플랫폼 비종속 정책 SoT**다. iOS도 같은 규칙을 쓰므로 규칙은 도메인 쪽에 있어야 한다.

| 책임 | 주체 |
|---|---|
| 에셋 7종 보유, 3상태 렌더, Coil 로드 실패 시 Error 그래픽 fallback | `:core:designsystem` (이번 범위) |
| 어느 상태인지 판정, 6종 중 랜덤 부여, 첫 토핑 전까지 고정·영속 | feature/domain (범위 밖) |

컴포넌트는 `YGToppingImage` 3상태를 **명시적으로 주입받는다.** 상태 추론을 하지 않는다.

## `YGGrouptagChip`

G-001에서 그룹 대표 토핑에 붙는 라벨. 이름과 상대시간을 한 줄로 보여준다.

```kotlin
@Composable
fun YGGrouptagChip(
    name: String,
    timestamp: String,
    type: YGGrouptagChipType,
    modifier: Modifier = Modifier,
)
```

구조 — `Row`, 3요소 고정(슬롯 없음):

| 요소 | 규격 |
|---|---|
| 컨테이너 | 배경 `Transparency.Black75`, `shapes.radius.round`, 가로 `padding.padding5`·세로 `padding.padding2`, `gap.gap2` |
| 이름 | `typography.body.b02SB`, `Gray.White` |
| 구분점 | 1.25dp 정사각 원(`radius.round`), `Transparency.White50` |
| 타임스탬프 | `typography.caption.c01R`, 타입별 색(아래 표) |

**이름 말줄임** — 위키 [[무한-파르페-그리드]] 라벨 정책 "이름 80px 초과 시 초과분부터 `…`"(픽셀 기준, 문자수
기준은 폐기)를 따른다. 이름 텍스트에 `widthIn(max = Size80)` + `maxLines = 1` +
`TextOverflow.Ellipsis`. 타임스탬프는 "항상 전체 노출"이므로 잘리지 않는다.

### 타입 매핑

```kotlin
enum class YGGrouptagChipType(val timestampColor: Color)
```

기준 = 해당 그룹에서 **마지막으로 변화를 가한 유저의 타입**(위키 [[nametag-chip]] ② 표).
Nametag-Chip 원형칩(`YGColorChipType`)과는 **매핑이 별개**이므로 타입도 별개로 둔다 —
정책 문서가 이미 두 표로 분리돼 있고, 기존 `YGColorChipType`은 13종 + Plus로 정책 12종과 어긋나 있다.

| enum | 정책 컬러명 | 토큰 |
|---|---|---|
| `TYPE_1_2` | 연핑크 | `Cherry.Cherry100` |
| `TYPE_3_4` | 진핑크 | `Cherry.Cherry200` |
| `TYPE_5_6` | 체리 | `Cherry.Cherry300` |
| `TYPE_7_8` | 그레이 | `Gray.Gray200` |
| `TYPE_9_10` | 멜론 | `Melon.Melon500` |
| `TYPE_11_12` | 푸딩 | `Pudding.Pudding500` |

> ⚠️ 그레이(Type 7/8)는 위키 ② 표가 `White`인데 Figma는 `Gray-200`이다. Figma를 따라 구현하고
> 위키 쪽 확인 대상으로 남긴다(아래 [열린 질문](#열린-질문)).

## `YGToppingGroup`

G-001 그리드의 셀 1개. 토핑 이미지를 살짝 기울여 얹고 우측 하단에 그룹 칩을 겹친다.

```kotlin
@Composable
fun YGToppingGroup(
    image: YGToppingImage,
    name: String,
    timestamp: String,
    chipType: YGGrouptagChipType,
    type: YGToppingGroupType,
    modifier: Modifier = Modifier,
)
```

- 프레임 **160dp 정사각**(`Size160`), 이미지 **96dp**(`Size96`)
- **클리핑 없음.** 회전·오프셋으로 프레임을 넘어가는 픽셀과 칩을 자르지 않는다(위키 G-001 오버플로우 조항).
  C-106 캔버스 클리핑은 경계가 다른 별개 규칙이라 여기 적용 대상이 아니다.
- `onClick` **없음.** C-001 이동은 호출자가 `clickableYG`로 감싼다 — 그리드 셀의 터치 범위를 셀 쪽이
  결정해야 하고, 컴포넌트가 프레임 밖 칩까지 터치 범위에 넣을지 판단할 근거가 없다.
- 이미지·칩 모두 프레임 **중심 기준 오프셋**으로 절대 배치한다(Figma가 center 기준으로 좌표를 준다).

### 콘텐츠 3상태

```kotlin
sealed interface YGToppingImage {
    data class Remote(val url: String) : YGToppingImage
    data class Template(val type: YGToppingTemplate) : YGToppingImage
    data object Error : YGToppingImage
}
```

| 상태 | 렌더 | 대응 정책 |
|---|---|---|
| `Remote` | `AsyncImage(url)`, `error` 파라미터에 Error 드로어블 지정 | 정상 대표 토핑. **Coil 로드 실패는 자동으로 Error 그래픽으로 떨어진다** |
| `Template` | 템플릿 6종 중 지정된 1종 | 그룹에 아직 첫 토핑 없음 |
| `Error` | 물음표 그래픽 1종 | 특정 토핑 조회 실패 |

세 상태 모두 **그룹 칩은 정상 노출**된다(위키 조항).

### 배치 변형

```kotlin
enum class YGToppingGroupType(
    val rotation: Float,
    val imageOffset: DpOffset,
    val chipOffset: DpOffset,
)
```

프레임 중심(0, 0) 기준. 회전은 시계방향 양수(Compose `Modifier.rotate` 규약).

| enum | 회전 | 이미지 오프셋 | 칩 오프셋 |
|---|---|---|---|
| `TYPE_1_LEFT` | −6° | (−1.25, −11.25) | (−0.5, +49.23) |
| `TYPE_1_RIGHT` | +6° | (−1.25, −11.25) | (−0.5, +49.23) |
| `TYPE_2_LEFT` | −12° | (+1.06, −12.07) | (+0.13, +54.69) |
| `TYPE_2_RIGHT` | +16° | (+1.5, −12.63) | (+0.13, +58.13) |
| `TYPE_3_LEFT` | +8° | (−0.79, −10.79) | (−0.5, +49.5) |
| `TYPE_3_RIGHT` | +8° | (−0.79, −10.79) | (−0.5, +49.5) |
| `TEMPLATE` | 0° | (−0.79, −10.79) | (−0.5, +49.5) |

- **Figma 소수값을 반올림하지 않고 그대로 쓴다.** Compose는 소수 dp를 그대로 다루므로 정밀도를 버릴
  이유가 없고, 반올림하면 나중에 Figma와 대조할 때 "의도적 차이"인지 "드리프트"인지 구분이 안 된다.
- Left/Right 선택과 변형 번호(1/2/3) 랜덤 재부여는 **호출자 책임**이다(위키: index%2로 side 결정,
  번호는 목록 조회 응답 1회 재추첨·리렌더 시 재추첨 금지).
- `TEMPLATE`은 회전 0°인 **배치 변형**일 뿐이고, 안에 무엇을 그릴지는 `image` 파라미터가 정한다.
  `TEMPLATE` + `Remote` 조합도 컴파일된다 — 모순 조합 방지 책임은 호출자에게 있다(캔버스 라운드에서
  불리언 플래그로 통일하며 받아들인 것과 같은 트레이드오프).

> ⚠️ `TYPE_3_LEFT`와 `TYPE_3_RIGHT`가 Figma에서 회전·오프셋이 **완전히 동일**하다. 다른 Left 변형은
> 전부 음수 회전인데 3번만 Left도 양수(+8°)다. 디자인 의도인지 Figma 누락인지 불명 — Figma 그대로
> 구현하고 확인 대상으로 남긴다(아래 [열린 질문](#열린-질문)).

## 에셋

원본: 작업자 제공 `Topping-Template/Android/{ldpi,mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/`
(`Template01~06.png` + `Template-Error.png`).

- 반입 위치: `core/designsystem/src/main/res/drawable-{density}/` 6버킷
- 파일명은 안드로이드 리소스 규칙(소문자·스네이크)으로 변환: `img_topping_template_01.png` …
  `img_topping_template_06.png`, `img_topping_template_error.png`
- 에셋 6종의 그림 내용은 위키 [[G-001-그룹-토핑-템플릿-정책-v0.2]](별×2·음표×2·소용돌이×2)와 일치.
  구 v0.1의 음식 이름 6종(딸기·키위·…) 서술은 이미 위키에서 상충으로 등록된 항목이라 여기서 다루지 않는다.

## 빌드 변경

**Coil 3 네트워크 페처 도입** — 현재 `coil-compose`만 있고 네트워크 페처가 없어 원격 URL이 로드되지
않는다. 캔버스 라운드에서 `YGCanvasBackground.Image`가 미검증으로 남은 원인이 이것이다.
`YGToppingGroup.Remote`가 같은 문제를 그대로 물려받으므로 이번 라운드에서 해소한다.

- `gradle/libs.versions.toml` — `coil-network-okhttp` 라이브러리 항목 추가(`coil` 버전 참조 재사용)
- `build-logic` `ComposeConfig.kt` — `implementation(libs.coil.network.okhttp)` 추가.
  기존 `coil-compose`가 여기 있으므로 같은 자리에 둔다.

부수 효과로 `YGCanvasBackground.Image`의 원격 로딩도 함께 살아난다.

## 크기 토큰

`SizeTokens`에 `Size96`·`Size160` 추가. 둘 다 **Figma가 고정한 치수**다(토핑 이미지 96, 프레임 160).
버튼 라운드에서 세운 원칙 — "패딩으로 도출되는 치수는 하드코딩하지 않고, Figma가 고정한 곳만 토큰으로
못박는다" — 에 해당한다.

## 검증

기존 디자인시스템 라운드와 동일하게 **테스트 없이 프리뷰 + 실기기 갤러리 육안 검증**으로 간다.
컴포넌트가 상태 없는 순수 렌더라 단위 테스트가 잡아낼 회귀가 거의 없고, 실제 결함(색 대비·잘림·오프셋)은
육안 검증에서만 드러난다는 선행 라운드 판단을 유지한다.

- `@YGPreview` + `PreviewBox` 프리뷰: `YGGrouptagChip` 6타입 + 긴 이름 말줄임 케이스,
  `YGToppingGroup` 배치 7변형 × 콘텐츠 3상태
- `:app-preview` 갤러리에 2종 등록(카테고리는 기존 그룹 체계에 맞춤)
- `:core:designsystem`·`:app-preview` `assembleDebug` + repo 전체 `ktlintCheck`
- 실기기에서 `Remote` 성공 상태 로딩 확인(네트워크 페처 도입 효과 검증 포함)
- **TJYG-Android 커밋은 하지 않는다**(작업자 지시). 작업 트리 변경만 남기고 보고한다.

## 열린 질문

1. **그레이 타입 타임스탬프 색** — 위키 [[nametag-chip]] ② 표는 Type 7/8 = `White`, Figma는
   `Gray-200`. Figma 우선 구현했으나 어느 쪽이 정본인지 확인 필요. 위키 정정 대상일 수 있다.
2. **`TYPE_3_LEFT`/`TYPE_3_RIGHT` 동일** — 회전·오프셋이 같아 두 변형이 시각적으로 구분되지 않는다.
   Left가 음수 회전이어야 하는데 Figma가 양수(+8°)인 것도 함께 확인 필요.
3. **템플릿 부여 주체** — 서버가 `templateType`을 내려주면 재접속·기기변경에도 불변이고 iOS와 같은
   그림이 나온다. 클라이언트 랜덤 + 로컬 영속은 기기변경에서 깨진다. API 미확정.
4. **`YGColorChipType` 13종 + Plus ↔ 정책 12종 불일치** — 기존 이월 미결. 이번 신설한
   `YGGrouptagChipType`은 정책 6타입(=12종 쌍)과 정확히 일치하므로 두 enum의 타입 수가 어긋난 상태로
   공존한다. Nametag 쪽 정리 시 함께 봐야 한다.
