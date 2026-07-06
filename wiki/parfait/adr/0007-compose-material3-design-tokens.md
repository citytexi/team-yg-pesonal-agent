# ADR-0007: Jetpack Compose + Material3 + 디자인 토큰 시스템

- 상태: accepted
- 날짜: 2026-05-12
- 결정자: Parfait 팀

## 맥락
UI를 XML과 Compose로 혼용하면 스타일·상태 연결 방식이 이원화된다. 또 색·타이포·간격을 화면마다 하드코딩하면 디자인 변경이 전역 수정으로 번진다.

## 결정
UI는 **100% Jetpack Compose**로 작성한다(XML 레이아웃 없음). 테마는 `core:designsystem`의 `YGMaterialTheme`(Material3, Android 12+ dynamic color). Compose 활성은 `JetpackComposeConventionPlugin`이 담당.

디자인 값은 `core:designsystem`의 **토큰 시스템**으로 중앙화:
- `ColorSystem`(시맨틱: Primary/Secondary/Tertiary), `TypographySystem`, `SizeToken`, `ShapeToken`, `GapToken`, `PaddingToken`.
- 아이콘 리소스도 디자인시스템 모듈에 모음.

## 대안
- **XML + Compose 혼용** — 점진 마이그레이션엔 유리. 그러나 신규 프로젝트엔 이원화 비용만.
  **→ 기각:** 처음부터 Compose 단일.
- **화면별 인라인 스타일** — 빠르지만 디자인 변경이 전역 산개.
  **→ 기각:** 토큰 중앙화로 단일 변경점 확보.

## 영향

**긍정**
- 스타일·상태 연결이 Compose 단일 모델. 토큰 한 곳 수정으로 전역 반영(디자인 스펙/Figma 정렬).
- 프리뷰 지원(`PreviewBox`, Coil `AsyncImagePreviewHandler`).

**트레이드오프**
- 토큰 체계 정착 전까지 값 재정비 발생(히스토리: 토큰 값 리팩토링·동기화).

**위험·방어**
- 하드코딩 색·치수 유입 방지를 리뷰 규칙으로. 토큰 외 매직넘버 금지.
