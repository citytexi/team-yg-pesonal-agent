---
tags: [spec, parfait, designsystem]
updated: 2026-07-10
---

# Spec: YGTextFormField

- 상태: 구현 예정
- 날짜: 2026-07-10
- 대상: `core:designsystem` — `component/textfield/`
- 관련: [YGTextField 스펙](2026-07-10-ygtextfield.md) · [ADR-0010](../adr/0010-custom-compositionlocal-theme.md) · [design-system](../architecture/design-system.md) · 이슈 #134

## 목표
[YGTextField](2026-07-10-ygtextfield.md) 아래에 **description(헬퍼 텍스트)** 을 붙인 폼 필드. 필드 본체는 기존 `internal YGTextFieldImpl`을 **그대로 재사용**하고, 이 컴포넌트는 description 표시만 얹는 얇은 래퍼.

## 범위
- **포함**: YGTextField의 모든 동작(상태·카운터·clear·입력 제어) + 필드 하단 description.
- **제외**: 필드 자체 로직(YGTextFieldImpl에 이미 있음 — 재구현 금지). 별도 label(상단 제목)·필수표시(*) 등.

## API / 인터페이스
```kotlin
@Composable
fun YGTextFormField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    enabled: Boolean = true,
    isError: Boolean = false,
    maxLength: Int? = null,
    description: String? = null,
    colors: YGTextFormFieldColors = YGTextFormFieldDefaults.colors(),
)
```
- `value`~`maxLength`: [YGTextField](2026-07-10-ygtextfield.md)와 동일 의미. `YGTextFieldImpl`에 위임.
- `description`: `null`이면 미표시. non-null이면 필드 하단에 표시.
- `colors`: **전용 `YGTextFormFieldColors`**(필드 색 + description 색 묶음). 필드 색은 `colors.textFieldColors`로 `YGTextFieldImpl`에 전달.
- 호출측이 "항상 헬퍼" 또는 "error 시에만 메시지"를 모두 표현 가능(후자는 error 아닐 때 `null` 전달).

## 동작 / 구성
- 루트 `Column`(`modifier`, `verticalArrangement = spacedBy(layout.gap.gap2)`):
  1. `YGTextFieldImpl(..., colors = colors.textFieldColors)` — 필드 본체.
  2. `description != null`이면 `Text(description)`. Column `spacedBy(gap2)`가 필드와의 간격을 담당(description 없으면 자식 1개라 여백 없음).
- **description 색**: `colors.descriptionColor(isError)` → 일반 `descriptionColor`, error `errorDescriptionColor`. 기본값은 `Gray.Gray400` / `colorScheme.danger`(빨강).
- **description 타이포**: `typography.caption.c01R`.
- focus/enabled/isError 상태 파생·카운터·clear·패딩은 전부 `YGTextFieldImpl` 소관(이 컴포넌트는 관여 안 함).

## 색 (`YGTextFormFieldColors`)
```kotlin
@Immutable
data class YGTextFormFieldColors(
    val textFieldColors: YGTextFieldColors,   // 필드 본체로 위임
    val descriptionColor: Color,
    val errorDescriptionColor: Color,
) { fun descriptionColor(isError: Boolean): Color }
```
- `YGTextFormFieldDefaults.colors(...)`가 기본값 제공(오버라이드 가능 named 파라미터): `textFieldColors = YGTextFieldDefaults.colors()`, `descriptionColor = Gray.Gray400`, `errorDescriptionColor = colorScheme.danger`.

## 파일 구성 (`component/textfield/`)
- `YGTextFormField.kt` — 신설. `YGTextFormField` 컴포저블 + `@YGPreview`/`PreviewBox` 프리뷰(description 있음/없음·error 조합).
- `YGTextFormFieldColors.kt` — 신설. `@Immutable data class`(textFieldColors + description 색) + `descriptionColor(isError)` resolver.
- `YGTextFormFieldDefaults.kt` — 신설. `@Composable @ReadOnlyComposable fun colors(...)` 기본값 제공.
- **무변경**: `YGTextField.kt`(`YGTextFieldImpl` 재사용), `YGTextFieldColors.kt`, `YGTextFieldDefaults.kt`.

## 주의 / 열린 질문
- ~~description 색 슬롯 재사용~~ **해소**: description 전용 색을 `YGTextFormFieldColors`(`descriptionColor`/`errorDescriptionColor`)로 분리. 초기 안(counter 슬롯 재사용)에서 전용 슬롯으로 전환.
- `YGTextFieldImpl`이 `internal`이라 재사용은 같은 모듈(`core:designsystem`) 한정. 외부 모듈에서 폼 필드가 필요하면 public 진입점은 `YGTextFormField`(또는 `YGTextField`).
