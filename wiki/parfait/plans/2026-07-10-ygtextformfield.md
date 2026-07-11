---
tags: [plan, parfait, designsystem]
updated: 2026-07-10
---

# YGTextFormField Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [YGTextField](2026-07-10-ygtextfield.md) 아래 description(헬퍼 텍스트)을 얹은 `YGTextFormField`를 `core:designsystem`에 추가한다.

**Architecture:** 기존 `internal YGTextFieldImpl`을 재사용하고 그 아래 `description`을 `Column`으로 얹는 얇은 래퍼 컴포저블 1개. 필드 로직은 재구현하지 않는다. description 색은 `YGTextFieldColors.counterColor(isError)`를 재사용(일반 Gray400 / error danger).

**Tech Stack:** Kotlin, Jetpack Compose(foundation/layout, material3 `Text`), 자체 테마(`YGTheme.*`).

**Spec:** [specs/2026-07-10-ygtextformfield.md](../specs/2026-07-10-ygtextformfield.md)

## Global Constraints
- 대상 repo: `TJYG-Android`, 브랜치 `feature/#134-text-field-form`.
- 패키지: `com.teamyg.parfait.core.designsystem.component.textfield`.
- 테마 값은 `YGTheme.*`로만 접근.
- **무변경**: `YGTextField.kt`·`YGTextFieldColors.kt`·`YGTextFieldDefaults.kt`. `YGTextFieldImpl`(internal) 재사용만.
- 검증: 유닛 TDD 인프라 없음(Compose UI). **compile(`compileReleaseKotlin`) + `ktlintMainSourceSetCheck` + `@YGPreview` 육안**으로 대체.
- 커밋 전 `ktlintMainSourceSetFormat`.

---

### Task 1: YGTextFormField — 필드 + description 래퍼

**Files:**
- Create: `core/designsystem/src/main/kotlin/com/teamyg/parfait/core/designsystem/component/textfield/YGTextFormField.kt`

**Interfaces:**
- Consumes: `YGTextFieldImpl(value, onValueChange, modifier, placeholder, enabled, isError, maxLength, colors)`(YGTextField.kt, internal), `YGTextFieldColors.counterColor(isError: Boolean): Color`, `YGTextFieldDefaults.colors()`, `YGTheme.{layout.gap.gap2, typography.caption.c01R}`, `PreviewBox`·`@YGPreview`(utils.preview).
- Produces: `@Composable fun YGTextFormField(value: String, onValueChange: (String) -> Unit, modifier: Modifier = Modifier, placeholder: String = "", enabled: Boolean = true, isError: Boolean = false, maxLength: Int? = null, description: String? = null, colors: YGTextFieldColors = YGTextFieldDefaults.colors())`.

- [ ] **Step 1: 컴포저블 작성**

```kotlin
package com.teamyg.parfait.core.designsystem.component.textfield

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.teamyg.parfait.core.designsystem.theme.YGTheme
import com.teamyg.parfait.core.designsystem.utils.preview.PreviewBox
import com.teamyg.parfait.core.designsystem.utils.preview.YGPreview

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
    colors: YGTextFieldColors = YGTextFieldDefaults.colors(),
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(YGTheme.layout.gap.gap2),
    ) {
        YGTextFieldImpl(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = placeholder,
            enabled = enabled,
            isError = isError,
            maxLength = maxLength,
            colors = colors,
        )
        if (description != null) {
            Text(
                text = description,
                style = YGTheme.typography.caption.c01R,
                color = colors.counterColor(isError = isError),
            )
        }
    }
}
```

- [ ] **Step 2: 프리뷰 작성** (같은 파일 하단)

```kotlin
@YGPreview
@Composable
private fun YGTextFormFieldPreview() = PreviewBox {
    Column(
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.padding(16.dp),
    ) {
        Text("with description")
        YGTextFormField(
            value = "Text",
            onValueChange = {},
            maxLength = 15,
            description = "닉네임은 15자까지만 입력 가능해요",
            modifier = Modifier.fillMaxWidth(),
        )
        Text("error with description")
        YGTextFormField(
            value = "Text",
            onValueChange = {},
            isError = true,
            maxLength = 15,
            description = "닉네임은 15자까지만 입력 가능해요",
            modifier = Modifier.fillMaxWidth(),
        )
        Text("no description")
        YGTextFormField(
            value = "",
            onValueChange = {},
            placeholder = "Text를 입력해 주세요",
            maxLength = 15,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
```

- [ ] **Step 3: 컴파일 검증**

Run: `./gradlew :core:designsystem:compileReleaseKotlin --offline`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: ktlint 검증**

Run: `./gradlew :core:designsystem:ktlintMainSourceSetFormat :core:designsystem:ktlintMainSourceSetCheck --offline`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: 프리뷰 육안 확인** — Android Studio에서 `YGTextFormFieldPreview` 3종(with description / error(빨강 description) / no description) 렌더 확인. error description이 danger 색인지 확인.

- [ ] **Step 6: 커밋** (사용자 승인 후)

```bash
git add core/designsystem/src/main/kotlin/com/teamyg/parfait/core/designsystem/component/textfield/YGTextFormField.kt
git commit -m "feat: YGTextFormField 추가 (YGTextField + description)"
```

---

## Self-Review
- **Spec coverage**: 목표(description 얹기)·API(`description` 파라미터)·구성(Column+YGTextFieldImpl 재사용)·description 색(counterColor 재사용)·타이포(caption.c01R)·간격(gap2)·파일(YGTextFormField.kt만)·무변경 원칙 — 전부 Task 1에 대응.
- **Placeholder**: 없음(코드 전량 기재).
- **Type consistency**: `YGTextFieldImpl` 시그니처·`counterColor(isError)`·`caption.c01R`·`layout.gap.gap2` 모두 기존 코드 심볼과 일치.

## 열린 질문
- description 색을 counter 슬롯 재사용 — 디자인 분화 시 전용 슬롯 분리([open-questions](../../synthesis/open-questions.md), spec 참조).
