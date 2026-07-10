---
tags: [plan, parfait, designsystem]
updated: 2026-07-10
---

# YGTextField Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `core:designsystem`에 디자인 스펙의 텍스트필드 폼을 `YGTextField` 컴포넌트로 구현한다(단일 폼, 런타임 상태 idle/focused/error/disabled).

**Architecture:** `BasicTextField`(foundation) 위에 자체 CompositionLocal 테마(`YGTheme.*`)를 읽는 얇은 래퍼. 상태별 색은 `@Immutable` `YGTextFieldColors` data class로 묶고 `YGTextFieldDefaults.colors()`가 테마 기반 기본값을 제공. YGButton 컴포넌트 작성 컨벤션(component/<name>/ 파일 분리, Colors data class + resolver, Defaults object)을 그대로 따른다.

**Tech Stack:** Kotlin, Jetpack Compose(foundation `BasicTextField`, material3 `Text`), 자체 테마([ADR-0010](../adr/0010-custom-compositionlocal-theme.md)).

**Spec:** [specs/2026-07-10-ygtextfield.md](../specs/2026-07-10-ygtextfield.md)

## Global Constraints
- 대상 repo: `TJYG-Android`, 브랜치 `feature/#134-text-field-form`.
- 패키지: `com.teamyg.parfait.core.designsystem.component.textfield`.
- 테마 값은 `YGTheme.*`로만 접근. 크기는 `SizeTokens.*.getDp()`.
- 회색 음영·연핑크 테두리는 시맨틱 슬롯에 없어 `YGAtomicColors` 직접 참조(과도기, YGButton 선례 — [open-questions](../../synthesis/open-questions.md)).
- 검증: 유닛 TDD 인프라 없음(Compose UI). **compile(`compileReleaseKotlin`) + `ktlintMainSourceSetCheck` + `@Preview` 육안**으로 대체.
- ktlint 엄격(단일 표현식 함수는 한 줄). 커밋 전 `ktlintMainSourceSetFormat`.

---

### Task 1: YGTextFieldColors — 상태별 색 홀더

**Files:**
- Create: `core/designsystem/.../component/textfield/YGTextFieldColors.kt`

**Interfaces:**
- Produces: `data class YGTextFieldColors(...)` + resolver:
  - `fun backgroundColor(isEnabled: Boolean): Color`
  - `fun borderColor(isEnabled: Boolean, isFocused: Boolean, isError: Boolean): Color`
  - `fun textColor(isEnabled: Boolean): Color`
  - `fun counterColor(isError: Boolean): Color`

- [x] **Step 1: 파일 작성** — `@Immutable data class`에 색 슬롯(background/disabledBackground, border/focusedBorder/errorBorder, text/disabledText, placeholder, cursor, counter/errorCounter, clearIconTint) + resolver 함수. border 우선순위: `!enabled` → idle, `isError` → error, `isFocused` → focused, else idle.
- [x] **Step 2: 컴파일** — `./gradlew :core:designsystem:compileReleaseKotlin --offline` → BUILD SUCCESSFUL.

### Task 2: YGTextFieldDefaults — 테마 기반 기본 색

**Files:**
- Create: `core/designsystem/.../component/textfield/YGTextFieldDefaults.kt`

**Interfaces:**
- Consumes: `YGTextFieldColors`(Task 1), `YGTheme.colorScheme.danger`, `YGAtomicColors`.
- Produces: `object YGTextFieldDefaults { @Composable @ReadOnlyComposable fun colors(): YGTextFieldColors }`.

- [x] **Step 1: 파일 작성** — `colors()`가 background=`Gray.Gray100`, disabledBackground=`Gray.Gray50`, border=`Gray.Transparent`, focusedBorder=`Cherry.Cherry200`, errorBorder=`colorScheme.danger`, text=`Gray.Gray900`, disabledText=`Gray.Gray400`, placeholder=`Gray.Gray400`, cursor=`Gray.Gray900`, counter=`Gray.Gray400`, errorCounter=`colorScheme.danger`, clearIconTint=`Gray.Gray300` 반환. 원자 색 직접 참조 사유 주석.
- [x] **Step 2: 컴파일** — BUILD SUCCESSFUL.

### Task 3: YGTextField — 컴포저블 본체 + Preview

**Files:**
- Create: `core/designsystem/.../component/textfield/YGTextField.kt`

**Interfaces:**
- Consumes: `YGTextFieldColors`, `YGTextFieldDefaults.colors()`, `YGTheme.{shapes,typography,layout}`, `SizeTokens`, `R.drawable.ic_close_round`, `YGCustomTheme`(preview).
- Produces: `@Composable fun YGTextField(value, onValueChange, modifier, placeholder, enabled, isError, maxLength: Int? = null, colors = YGTextFieldDefaults.colors())`.

- [x] **Step 1: 본체 작성** —
  - focus: `remember { MutableInteractionSource() }` + `collectIsFocusedAsState()`, `BasicTextField(interactionSource=...)`에 전달.
  - `showCounter = maxLength != null && value.isNotEmpty()`; `showClear = enabled && value.isNotEmpty()`.
  - Row(spacedBy `layout.gap.gap3`, CenterVertically): background+border+clip `shapes.radius.medium2`, padding 분기(clear 있음 → start=`padding6`, end=`padding2`, vertical=`padding1`; 없음 → start/end=`padding6`, vertical=`padding5`).
  - 텍스트 영역 Box(weight 1f): 빈값이면 placeholder `Text`(`typography.body.b01R`), `BasicTextField`(singleLine, `textStyle=body.b01R.copy(color=textColor)`, `cursorBrush=SolidColor(cursorColor)`), `onValueChange`에서 `maxLength` 초과 무시.
  - `showCounter` → `Text("${value.length}/$maxLength", body.b02R, counterColor(isError))`.
  - `showClear` → Box(clip CircleShape, clickable Role.Button → `onValueChange("")`, padding `layout.padding.padding4`) { `Image(ic_close_round, tint=clearIconTint, size=SizeTokens.Size24.getDp())` }.
- [x] **Step 2: Preview 작성** — `YGCustomTheme { Column { idle/filled/error/disabled 4개 스택 } }`(focus 테두리는 런타임 전용, 프리뷰 제외).
- [x] **Step 3: 컴파일** — BUILD SUCCESSFUL.
- [x] **Step 4: ktlint** — `ktlintMainSourceSetFormat` 후 `ktlintMainSourceSetCheck` → BUILD SUCCESSFUL(단일 표현식 함수 inline 자동 수정됨).
- [ ] **Step 5: 커밋** — 사용자 승인 후 `feature/#134-text-field-form`에 commit.

---

## 검증 결과 (2026-07-10)
- `:core:designsystem:compileReleaseKotlin` — BUILD SUCCESSFUL.
- `:core:designsystem:ktlintMainSourceSetCheck` — BUILD SUCCESSFUL.
- 육안 프리뷰(idle/filled/error/disabled) — 스펙 부합. focus 핑크 테두리는 기기 확인 필요.

## 열린 질문
- YGButton과 동일하게 원자 색 직접 참조 → 시맨틱 정리 대상([open-questions](../../synthesis/open-questions.md)).
