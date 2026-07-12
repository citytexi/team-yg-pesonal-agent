---
tags: [plan, parfait, designsystem]
updated: 2026-07-12
---

# YGListItem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `core:designsystem`에 피그마 List-Item 스펙의 리스트 행 `YGListItem`(메인+옵션 sub 텍스트 + 우측 caret 버튼)을 구현한다.

**Architecture:** 루트 `Row`(fillMaxWidth) 안에 텍스트 `Column`(weight 1f, 메인 + 조건부 sub)과 조건부 caret `Box`(고정 클릭 박스 + 중앙 아이콘)를 배치. clickable은 caret Box만. 색·타이포·패딩은 `YGTheme.*` 토큰 + named 파라미터 오버라이드. YGButton·YGTextField 컴포넌트 작성 컨벤션(component/<name>/ 배치, textfield clear 박스 선례, `@YGPreview`/`PreviewBox`)을 따른다.

**Tech Stack:** Kotlin, Jetpack Compose(foundation `Row`/`Column`/`Box`/`clickable`/`Image`, material3 `Text`), 자체 테마([ADR-0010](../adr/0010-custom-compositionlocal-theme.md)).

**Spec:** [specs/2026-07-12-yglistitem.md](../specs/2026-07-12-yglistitem.md)

## Global Constraints
- 대상 repo: `TJYG-Android`, 브랜치 `feature/#136-etc-component`.
- 패키지: `com.teamyg.parfait.core.designsystem.component.etc`.
- 테마 값은 `YGTheme.*`로만 접근. 크기는 `SizeTokens.*.getDp()`. 색은 `YGAtomicColors.*`(gray 음영·caret tint는 시맨틱 슬롯 없어 원자색 직접 참조 — YGButton·YGTextField 선례, 과도기 → [open-questions](../../synthesis/open-questions.md)).
- 검증: 유닛 TDD 인프라 없음(Compose UI). **compile(`compileReleaseKotlin`) + `ktlintMainSourceSetCheck` + `@Preview` 육안**으로 대체.
- ktlint 엄격(단일 표현식 함수 한 줄). 커밋 전 `ktlintMainSourceSetFormat`.

---

### Task 1: YGListItem — 컴포저블 본체 + Preview

**Files:**
- Create: `core/designsystem/src/main/kotlin/com/teamyg/parfait/core/designsystem/component/etc/YGListItem.kt`

**Interfaces:**
- Consumes: `YGTheme.{layout.padding.padding7, layout.padding.padding2, layout.gap.gap2, typography.body.b02R, typography.caption.c01R}`, `SizeTokens.{Size44, Size24}`, `YGAtomicColors.Gray.{Gray800, Gray400, Gray300}`, `R.drawable.ic_caret_right`, `PreviewBox`·`@YGPreview`(utils.preview).
- Produces: public `@Composable fun YGListItem(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, subText: String? = null, showSubText: Boolean = false, showCaret: Boolean = true, textColor: Color = YGAtomicColors.Gray.Gray800, subTextColor: Color = YGAtomicColors.Gray.Gray400, caretTint: Color = YGAtomicColors.Gray.Gray300)`.

- [ ] **Step 1: 본체 작성** — 새 파일 생성.

```kotlin
package com.teamyg.parfait.core.designsystem.component.etc

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import com.teamyg.parfait.core.designsystem.R
import com.teamyg.parfait.core.designsystem.theme.YGTheme
import com.teamyg.parfait.core.designsystem.theme.colors.YGAtomicColors
import com.teamyg.parfait.core.designsystem.theme.size.SizeTokens

@Composable
fun YGListItem(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    subText: String? = null,
    showSubText: Boolean = false,
    showCaret: Boolean = true,
    textColor: Color = YGAtomicColors.Gray.Gray800,
    subTextColor: Color = YGAtomicColors.Gray.Gray400,
    caretTint: Color = YGAtomicColors.Gray.Gray300,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(
                horizontal = YGTheme.layout.padding.padding7,
                vertical = YGTheme.layout.padding.padding2,
            ),
        horizontalArrangement = Arrangement.spacedBy(YGTheme.layout.gap.gap2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = text,
                style = YGTheme.typography.body.b02R,
                color = textColor,
            )
            if (showSubText && subText != null) {
                Text(
                    text = subText,
                    style = YGTheme.typography.caption.c01R,
                    color = subTextColor,
                )
            }
        }

        if (showCaret) {
            // TODO Change Button-Icon component
            Box(
                modifier = Modifier
                    .clickable(role = Role.Button) { onClick() }
                    .size(SizeTokens.Size44.getDp()),
                contentAlignment = Alignment.Center,
            ) {
                Image(
                    painter = painterResource(id = R.drawable.ic_caret_right),
                    contentDescription = null,
                    colorFilter = ColorFilter.tint(caretTint),
                    modifier = Modifier.size(SizeTokens.Size24.getDp()),
                )
            }
        }
    }
}
```

- [ ] **Step 2: Preview 작성** — 같은 파일 하단에 추가. caret 유/무·subText 유/무 조합.

```kotlin
@YGPreview
@Composable
private fun YGListItemPreview() = PreviewBox {
    Column(
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.padding(16.dp),
    ) {
        Text("caret + no sub")
        YGListItem(
            text = "서비스 이용약관",
            onClick = {},
        )
        Text("caret + sub")
        YGListItem(
            text = "서비스 이용약관",
            onClick = {},
            subText = "부가 설명 텍스트",
            showSubText = true,
        )
        Text("no caret")
        YGListItem(
            text = "서비스 이용약관",
            onClick = {},
            showCaret = false,
        )
    }
}
```

추가 import (Step 1 import 목록에 병합):

```kotlin
import androidx.compose.ui.unit.dp
import com.teamyg.parfait.core.designsystem.utils.preview.PreviewBox
import com.teamyg.parfait.core.designsystem.utils.preview.YGPreview
```

- [ ] **Step 3: 컴파일 검증**

Run: `./gradlew :core:designsystem:compileReleaseKotlin --offline`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: ktlint 검증**

Run: `./gradlew :core:designsystem:ktlintMainSourceSetFormat :core:designsystem:ktlintMainSourceSetCheck --offline`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: 프리뷰 육안 확인** — Android Studio에서 `YGListItemPreview` 3종 렌더 확인. caret 화살표가 우측, sub 텍스트가 메인 아래 흐린 회색, no caret 시 텍스트만. 행 높이(caret 있을 때 ≈52dp)·좌우 여백 확인.

- [ ] **Step 6: 커밋** (사용자 승인 후)

```bash
git add core/designsystem/src/main/kotlin/com/teamyg/parfait/core/designsystem/component/etc/YGListItem.kt
git commit -m "feat: YGListItem 구현"
```

---

## Self-Review
- **Spec coverage**: 목표(리스트 행)·API(9개 파라미터, 기본값)·동작(Row+Column weight 1f + 조건부 caret Box)·표시 규칙(`showSubText && subText != null`, `showCaret`)·타이포/색 표(b02R/Gray800, c01R/Gray400, caret Gray300)·패딩(padding7/padding2, gap2)·caret 클릭 전용·높이(Hug, caret 지배)·파일(단일 `component/etc/YGListItem.kt`) — Task 1에 대응.
- **Placeholder**: 없음(코드 전량 기재). `// TODO Change Button-Icon component`는 스펙 명시된 후속 과제 주석(구현 완결, 플랜 공백 아님).
- **Type consistency**: `YGTheme.typography.body.b02R`·`caption.c01R`·`layout.padding.{padding7,padding2}`·`layout.gap.gap2`·`SizeTokens.{Size44,Size24}.getDp()`·`YGAtomicColors.Gray.{Gray800,Gray400,Gray300}`·`R.drawable.ic_caret_right` 모두 스펙·코드 심볼과 일치.

## 열린 질문
- **caret 접근성**: `contentDescription = null`(장식 취급). clickable Box에 라벨이 없어 스크린리더가 무명 버튼으로 읽음 — 실제 라벨(예: 행 텍스트 연동)은 후속 a11y 개선 대상. 스펙이 라벨 미정의라 현재는 null.
- **sub 텍스트 스타일**: `caption.c01R`+`Gray.Gray400` 잠정(피그마 미제공). 디자인 확정 시 갱신.
- gray 원자색 직접 참조 → 시맨틱 정리 대상([open-questions](../../synthesis/open-questions.md), YGButton 디자인 토큰 항목과 동일 성격).
