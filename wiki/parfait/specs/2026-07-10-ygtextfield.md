---
tags: [spec, parfait, designsystem]
updated: 2026-07-10
---

# Spec: YGTextField

- 상태: 구현 예정
- 날짜: 2026-07-10
- 대상: `core:designsystem` — `component/textfield/`
- 관련: [ADR-0010](../adr/0010-custom-compositionlocal-theme.md)(자체 테마) · [design-system](../architecture/design-system.md)(컴포넌트 작성 규약) · 이슈 #134

## 목표
디자인 스펙의 텍스트필드 폼을 `core:designsystem` 컴포넌트로 만든다. 한 폼의 **런타임 상태 4종**(idle / focused / error / disabled)을 하나의 컴포저블로 표현. YGButton 컴포넌트 작성 컨벤션을 따른다.

## 범위
- **포함**: 입력 텍스트·placeholder·커서, 글자수 카운터(`현재/최대`), clear(X) 아이콘 버튼, 상태별 테두리/색, `maxLength` 초과 입력 차단.
- **제외**: 하단 description/헬퍼 텍스트(디자인상 존재하나 이번 구현 제외), 크기 variant(현재 폼 1종만), 다크 모드 별도 팔레트(테마가 라이트=다크).

## API / 인터페이스
```kotlin
@Composable
fun YGTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    enabled: Boolean = true,
    isError: Boolean = false,
    maxLength: Int? = null,
    colors: YGTextFieldColors = YGTextFieldDefaults.colors(),
)
```
- `maxLength`: `null`이면 무제한·카운터 없음. 지정 시 카운터 `${value.length}/${maxLength}` 표시 + 초과 입력 무시(자르기 아님).
- `colors`: 상태별 색 묶음. 기본값은 `YGTextFieldDefaults.colors()`(테마 기반).
- `BasicTextField`(foundation) 기반, `cursorBrush = SolidColor(커서색)`.

## 동작 / 상태
상태는 prop + 런타임 focus 조합으로 파생(별도 variant 타입 없음).
- **focused**: `interactionSource`의 `collectIsFocusedAsState()`.
- **enabled / isError**: prop.

| 요소 | idle | focused | error | disabled |
|---|---|---|---|---|
| 배경 | `Gray.Gray100` | `Gray.Gray100` | `Gray.Gray100` | `Gray.Gray50` |
| 테두리 | transparent | `Cherry.Cherry200` | `colorScheme.danger` | transparent |
| 입력 텍스트 | `Gray.Gray900` | `Gray.Gray900` | `Gray.Gray900` | `Gray.Gray400` |
| placeholder | `Gray.Gray400` | — | — | — |
| 커서 | `Gray.Gray900` | — | — | — |
| 카운터 | (숨김) | `Gray.Gray400` | `colorScheme.danger` | `Gray.Gray400` |
| clear(X) tint | (숨김) | `Gray.Gray300` | `Gray.Gray300` | **숨김** |

- 토큰: radius `shapes.radius.medium2`, 입력 텍스트 `typography.body.b01R`, 카운터 `typography.body.b02R`. clear 아이콘 `R.drawable.ic_close_round`.
- error의 danger는 시맨틱 `YGTheme.colorScheme.danger`. 회색 음영(Gray50/100/300/400/900)은 시맨틱 grayScale(transparent/white/black만 노출)에 없어 `YGAtomicColors` 직접 참조.

## 표시·제어 규칙
- **카운터**: `maxLength != null` **AND** `value.isNotEmpty()`.
- **clear(X)**: `enabled` **AND** `value.isNotEmpty()`. 탭 시 `onValueChange("")`. bare 이미지 아닌 **아이콘 버튼**(자체 clickable + 내부 패딩).
- **입력 제어**: `onValueChange` 진입 시 `maxLength` 초과분은 반영하지 않음(콜백에서 게이트).

## 컨테이너 패딩
clear 노출 유무로 분기(clear 아이콘 버튼이 자체 내부 패딩을 가져 end·vertical을 흡수).

| | start | end | top | bottom |
|---|---|---|---|---|
| clear 없음 | `padding.padding6`(16) | `padding.padding6`(16) | `padding.padding5`(12) | `padding.padding5`(12) |
| clear 있음 | `padding.padding6`(16) | `padding.padding2`(4) | `padding.padding1`(2) | `padding.padding1`(2) |

## 파일 구성 (`component/textfield/`)
- `YGTextField.kt` — 컴포저블 본체 + `@Preview`(idle/filled/error/disabled 상태 스택).
- `YGTextFieldColors.kt` — `@Immutable data class`, 상태별 색 슬롯 + resolver 함수.
- `YGTextFieldDefaults.kt` — `@Composable fun colors()`가 테마 기반 기본값 제공(theme `*Defaults` 네이밍 일치).

## 주의 / 열린 질문
- **과도기**: 컴포넌트가 시맨틱 grayScale 대신 `YGAtomicColors` 직접 참조 — YGButton 선례와 동일. 디자인 토큰 규칙 확정 시 시맨틱으로 정리 대상. → [open-questions 2026-07-10 YGButton 디자인 토큰](../../synthesis/open-questions.md).
- focused 테두리(pink)는 실제 focus에서만 보임 → 프리뷰는 idle/filled/error/disabled 중심, focus는 기기 확인.
