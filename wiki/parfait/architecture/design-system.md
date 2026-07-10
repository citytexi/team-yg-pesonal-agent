# Design System — 테마·토큰·컴포넌트 작성 가이드

`core:designsystem` 모듈의 테마 홀더·토큰 계층·컴포넌트 작성 규약. "왜"는 [ADR-0010](../adr/0010-custom-compositionlocal-theme.md)(테마 메커니즘), [ADR-0007](../adr/0007-compose-material3-design-tokens.md)(100% Compose·중앙화 원칙, superseded).

> 근거는 파일명 + 심볼명으로 표기. 라인번호·색 hex값·개수는 적지 않는다(코드에서 직접 확인). 값이 필요하면 `theme/colors/YGAtomicColors.kt` 등 소스를 본다.

## 전체 구조

```
core/designsystem/.../theme/
  YGTheme.kt              ← 진입점 YGCustomTheme() + 접근자 object YGTheme + Local* CompositionLocal
  colors/                 ← 색 2계층 (원자 → 시맨틱)
    YGAtomicColors        원자 팔레트 (Cherry/Melon/Pudding/Soda/Gray/Transparency) — internal
    YGColorScheme         시맨틱 홀더 (primary/secondary/tertiary/danger/warning/success/info/grayScale/transparency)
    YGColorGrayScale, YGColorTransparency   서브 홀더
    YGSemanticColorDefaults    원자→시맨틱 매핑 (YGLightColorScheme / YGDarkColorScheme)
    KakaoDesignGuideColors     외부 가이드 색 참조
  typography/             ← YGTypography(title/body/caption) + YGFontFamily(SUIT) + *Defaults
  shapes/                 ← YGShapes(radius: YGShapeRadius) + YGShapesDefaults
  layout/                 ← YGLayout(gap: YGLayoutGap, padding: YGLayoutPadding) + YGLayoutDefaults
  size/SizeTokens.kt      ← SizeTokens(object) + SizeToken(value class .getDp()) — 홀더 밖 별도
component/
  ygbutton/               ← YGButton (첫 컴포넌트, 작성 패턴 레퍼런스)
res/font/                 ← suit_regular/medium/semi_bold/bold.ttf
res/drawable/             ← ic_* 아이콘 리소스
```

## 테마 접근 규약

- 테마 값은 **항상 `YGTheme.*`로 읽는다**: `YGTheme.colorScheme` / `.typography` / `.shapes` / `.layout`. 전부 `@Composable @ReadOnlyComposable`.
  - 예: `YGTheme.typography.body.b01SB`, `YGTheme.layout.padding.padding4`, `YGTheme.shapes.radius.round`.
- **크기만 예외**: `SizeTokens.Size24.getDp()`로 직접(`SizeToken`은 `@JvmInline value class`, 홀더 밖).
- `Local*` CompositionLocal은 `internal` + 미초기화 시 `error(...)`. → **모든 UI·프리뷰는 `YGCustomTheme { }`로 감싸야** 크래시 안 남.
- **원자 색 직접 참조 금지 원칙** — 컴포넌트는 시맨틱(`YGTheme.colorScheme`)을 읽는다. `YGAtomicColors`는 `internal`이며 시맨틱 매핑(`YGSemanticColorDefaults`)에서만 소비하는 것이 규칙. (현재 `YGButton`은 과도기라 원자 직접 참조 — 아래 참고.)

## 토큰 계층

| 축 | 홀더 | 스케일(심볼) | 기본값 제공 |
|---|---|---|---|
| 색 | `YGColorScheme` | primary/secondary/tertiary + danger/warning/success/info + grayScale/transparency | `YGSemanticColorDefaults` |
| 타이포 | `YGTypography` | title/body/caption 그룹, 각 웨이트·크기 변형(`b01B/b01SB/b01R/b02...`) | `YGTypographyDefaults` |
| 모양 | `YGShapes.radius`(`YGShapeRadius`) | xSmall/small/medium1/medium2/large/xLarge1/xLarge2/round | `YGShapesDefaults` |
| 레이아웃 | `YGLayout.gap`/`.padding` | gap1.. / padding1.. (명명 스케일) | `YGLayoutDefaults` |
| 크기 | `SizeTokens`(홀더 밖) | Size2/4/6/…/80 (`SizeToken`) | — |

색 2계층: `YGAtomicColors`(브랜드 팔레트 — Cherry가 primary 계열, Melon=secondary, Pudding=tertiary, Soda=info 등) → `YGSemanticColorDefaults`가 라이트/다크 스킴으로 매핑. **다크는 현재 라이트와 동일**(`YGDarkColorScheme = YGLightColorScheme`, 코드 `TODO`).

## 신규 토큰 값 추가 체크리스트

1. **원자 색 추가** → `YGAtomicColors`에 팔레트 항목 추가. 시맨틱에 노출하려면 `YGColorScheme` 필드 + `YGSemanticColorDefaults` 매핑까지.
2. **타이포/모양/레이아웃 스케일 추가** → 해당 홀더 data class(`YGTypography*`/`YGShapeRadius`/`YGLayoutGap`·`YGLayoutPadding`)에 필드 추가 + 대응 `*Defaults`에 값 채움.
3. **크기 추가** → `SizeTokens`에 `SizeN` 상수.
4. 홀더 필드를 늘리면 `*Defaults`가 컴파일로 강제되므로 누락 시 빌드 실패(가드).

## 컴포넌트 작성 규약 (레퍼런스: `component/ygbutton/`)

`YGButton`이 첫 컴포넌트이자 패턴 기준.

- **패키지**: `component/<컴포넌트명 소문자>/`. 한 컴포넌트당 파일 분리:
  - `YGButton.kt` — 컴포저블 본체(`clickable`·semantic·`enabled`·`isPressed` 내재화).
  - `YGButtonType.kt` — `sealed interface`로 변형(variant) 정의. 각 변형이 자기 토큰(패딩·radius·textStyle·iconSize·gap·colors)을 `@get:Composable`로 노출. 현재 변형: `XSmall`/`Small`/`SmallSquare`/`Medium.{Primary,Secondary,Transparency}`/`Large`.
  - `YGButtonColors.kt` — 상태별 색 묶음 data class(enabled/disabled/pressed × foreground/background/border/icon).
  - `YGButtonPreviewData.kt` — 프리뷰용 데이터.
- **토큰 참조**: 변형 내부에서 `YGTheme.layout.padding.*`, `YGTheme.shapes.radius.*`, `YGTheme.typography.body.*`, `SizeTokens.*.getDp()`로 읽는다.
- **프리뷰**: `YGCustomTheme { }`로 감싼다(Local 미초기화 크래시 방지). Coil 프리뷰는 `YGCustomTheme`이 `LocalAsyncImagePreviewHandler`를 이미 심음.

> **Assumption / 과도기** — `YGButtonType`의 각 변형 `colors`가 시맨틱(`YGTheme.colorScheme`) 대신 `YGAtomicColors`를 직접 참조하고, 값이 잠정(mock)이다. 코드 주석("Design Token 규칙이 조금 이상… 컴포넌트 완성 시점에 문의 예정")대로 **확정 전 상태**. 확정 시 원자 직접 참조를 시맨틱으로 정리 권장. → [open-questions](../../synthesis/open-questions.md) 후보.

## 관련 ADR
- [ADR-0010](../adr/0010-custom-compositionlocal-theme.md) — 자체 CompositionLocal 테마(why).
- [ADR-0007](../adr/0007-compose-material3-design-tokens.md) — 100% Compose·중앙화 원칙(superseded).
