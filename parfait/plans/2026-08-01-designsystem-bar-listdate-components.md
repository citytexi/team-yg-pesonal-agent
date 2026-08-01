---
id: designsystem-bar-listdate-components
title: List-Date·Floating Bar 신설 + Top Bar Canvas 변형 구현 계획
status: draft
type: work-order
created: 2026-08-01
updated: 2026-08-01
platforms: android
owner: TJYG-Android 디자인시스템
related_adr:
related_spec:
  - designsystem-bar-listdate-components
related_code:
  - YGListDate.kt#YGListDate
  - YGFloatingBar.kt#YGFloatingBarBackClose
  - YGFloatingBar.kt#YGFloatingBarClose
  - YGFloatingBar.kt#YGFloatingBarEdit
  - YGFloatingBar.kt#YGFloatingBarEditTab
  - YGTopBar.kt#YGTopBarCanvas
  - YGTopBar.kt#YGTopBarEmpty
  - YGTopBar.kt#YGTopBarContent
  - ComponentCatalog.kt#componentCatalog
  - ComponentEntryBuilders.kt#componentEntryBuilders
archived_reason:
tags: [plan, parfait, designsystem, figma-sync, top-bar, floating-bar, c-201]
---

# List-Date·Floating Bar·Top Bar Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development(권장) 또는
> superpowers:executing-plans로 task 단위 구현. 단계는 체크박스(`- [ ]`)로 추적.

> ⚠️ **개정(2026-08-01, PR #173 develop 머지 반영)** — `YGTopBarDefault`가 develop에서 삭제되고
> `YGTopBarEmpty(rightContent)`로 통합됐다. Task 3의 "Default 드리프트 제거"는 대상이 사라져
> **프리뷰 칩 색 정정**으로 축소했고, 기준 시그니처를 #173 이후 코드로 갱신했다. 착수 전이라 체크박스는
> 전부 미완이다.

**Goal:** Figma `List-Date`·`Floating Bar`를 `:core:designsystem`에 신설하고, `Top Bar`에 `Canvas`
변형을 더한 뒤 `:app-preview` 갤러리에서 실기기로 검증한다.

**Architecture:** 세 컴포넌트가 서로를 소비하지 않으므로 독립 Task 3개 + 통합 검증 Task 1개다.
전부 기존 부품(`YGDateButton`·`YGChipColorIndicator`·`YGCircleButton`·`YGEditTabButton`·`YGIconButton`)
위에 얹는 합성이라 **부품 쪽 파일은 한 줄도 고치지 않는다.** Task 3만 기존 파일(`YGTopBar.kt`)을 수정한다.

**Tech Stack:** Kotlin, Jetpack Compose, Hilt, Navigation3, Gradle 컨벤션 플러그인.

## Global Constraints

- 작업 대상 repo는 **`TJYG-Android`**(이 repo 아님). 로컬 절대경로는
  `wiki/personal-private/project-paths.md` 참고. 아래 모든 경로는 그 repo 루트 기준.
- **TJYG-Android에 커밋하지 않는다**(작업자 지시). 작업 트리 변경만 남기고 보고한다.
  각 Task 말미의 "커밋" 단계는 **의도적으로 없다.**
- 테스트를 작성하지 않는다. 선행 디자인시스템 라운드 6회에서 확립된 판단 — 상태 없는 순수 렌더
  컴포넌트라 단위 테스트가 잡을 회귀가 거의 없고, 실제 결함(정렬·잘림·색 대비)은 육안 검증에서만
  드러난다. Task별 검증 사이클은 **`assembleDebug` + `ktlintCheck` + 프리뷰/갤러리 육안**이다.
- 색·치수는 반드시 **토큰 심볼**로 참조한다. hex 리터럴·raw dp 금지. 예외는 갤러리 화면의
  레이아웃 여백뿐이며, 이는 기존 프리뷰 화면들이 이미 `16.dp`·`8.dp`를 직접 쓰는 관행을 따른다.
- 프리뷰 관용구는 `@YGPreview` + `PreviewBox` 고정(`@Preview` + `YGCustomTheme` 금지).
- 패키지명은 소문자 컴포넌트명(`component/yglistdate/`), 파일명은 PascalCase.
- ktlint는 **repo 전체**(`./gradlew ktlintCheck`)로 돌린다. 모듈 단위로만 돌리면 갤러리 모듈
  위반을 놓친다.
- **신규 토큰·에셋을 만들지 않는다.** 이번 라운드에 필요한 `SizeTokens.Size44`, `gap.gap1`,
  `padding.padding3`/`padding6`/`padding7`, 드로어블 `ic_caret_left`·`ic_close`·`ic_check`·
  `ic_hamburger`가 모두 실재한다(2026-08-01 확인).

---

## Task 1: `YGListDate` 신설

**Files:**
- Create: `core/designsystem/src/main/kotlin/com/teamyg/parfait/core/designsystem/component/yglistdate/YGListDate.kt`
- Create: `app-preview/src/main/kotlin/com/teamyg/parfait/preview/navigation/key/NavKeyYGListDate.kt`
- Create: `app-preview/src/main/kotlin/com/teamyg/parfait/preview/screen/component/YGListDatePreviewScreen.kt`
- Modify: `app-preview/src/main/kotlin/com/teamyg/parfait/preview/model/ComponentCatalog.kt`
- Modify: `app-preview/src/main/kotlin/com/teamyg/parfait/preview/navigation/entry/ComponentEntryBuilders.kt`

**Interfaces:**
- Consumes: 기존 `YGDateButton(text: String, isSelected: Boolean, isToday: Boolean, isEnabled: Boolean, onClick: () -> Unit, modifier: Modifier)`,
  기존 `YGChipColorIndicator(modifier: Modifier = Modifier, isChecked: Boolean)`
- Produces: `YGListDate(text: String, isSelected: Boolean, isToday: Boolean, isEnabled: Boolean, isUploaded: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier)`
  — 반환값 없는 `@Composable`. C-201 캘린더 패널이 나중에 격자로 배치한다.

**배경:** Figma `List-Date`는 44dp 날짜 버튼 아래 2dp 띄우고 4dp 업로드 점을 붙인 44×50 셀이다.
두 부품이 이미 있으므로 합성만 한다. `Upload=False`는 Figma에서 `opacity-0`이고
`YGChipColorIndicator`가 미체크 시 `Color.Transparent`를 그리므로 **자리를 유지한 채 비노출**된다 —
선택이 바뀌어도 셀 높이가 흔들리지 않는다.

- [ ] **Step 1: `YGListDate.kt` 작성**

```kotlin
package com.teamyg.parfait.core.designsystem.component.yglistdate

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.teamyg.parfait.core.designsystem.component.ygcolorchip.YGChipColorIndicator
import com.teamyg.parfait.core.designsystem.component.ygdatebutton.YGDateButton
import com.teamyg.parfait.core.designsystem.theme.YGTheme
import com.teamyg.parfait.core.designsystem.theme.size.SizeTokens
import com.teamyg.parfait.core.designsystem.utils.preview.PreviewBox
import com.teamyg.parfait.core.designsystem.utils.preview.YGPreview

/**
 * Figma List-Date
 */
@Composable
fun YGListDate(
    text: String,
    isSelected: Boolean,
    isToday: Boolean,
    isEnabled: Boolean,
    isUploaded: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(YGTheme.layout.gap.gap1),
        modifier = modifier,
    ) {
        YGDateButton(
            text = text,
            isSelected = isSelected,
            isToday = isToday,
            isEnabled = isEnabled,
            onClick = onClick,
            modifier = Modifier.size(SizeTokens.Size44.getDp()),
        )
        YGChipColorIndicator(isChecked = isUploaded)
    }
}

@YGPreview
@Composable
private fun YGListDatePreview() = PreviewBox {
    Row(
        horizontalArrangement = Arrangement.spacedBy(YGTheme.layout.gap.gap3),
        modifier = Modifier.background(color = Color.White),
    ) {
        YGListDate(
            text = "31",
            isSelected = false,
            isToday = false,
            isEnabled = true,
            isUploaded = true,
            onClick = {},
        )
        YGListDate(
            text = "31",
            isSelected = true,
            isToday = false,
            isEnabled = true,
            isUploaded = true,
            onClick = {},
        )
        YGListDate(
            text = "31",
            isSelected = false,
            isToday = true,
            isEnabled = true,
            isUploaded = false,
            onClick = {},
        )
        YGListDate(
            text = "31",
            isSelected = false,
            isToday = false,
            isEnabled = false,
            isUploaded = false,
            onClick = {},
        )
    }
}
```

- [ ] **Step 2: 갤러리 NavKey 작성**

Create `app-preview/.../navigation/key/NavKeyYGListDate.kt`:

```kotlin
package com.teamyg.parfait.preview.navigation.key

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

@Serializable
data object NavKeyYGListDate : NavKey
```

- [ ] **Step 3: 갤러리 화면 작성**

Create `app-preview/.../screen/component/YGListDatePreviewScreen.kt`:

```kotlin
package com.teamyg.parfait.preview.screen.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.teamyg.parfait.core.designsystem.component.yglistdate.YGListDate
import com.teamyg.parfait.core.designsystem.component.ygtopbar.YGTopBarBack
import com.teamyg.parfait.core.designsystem.utils.preview.PreviewBox
import com.teamyg.parfait.core.designsystem.utils.preview.YGPreview

@Composable
internal fun YGListDatePreviewScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        YGTopBarBack(onIconClick = onBack)
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item {
                PreviewSection("upload = true") {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        YGListDate(
                            text = "31",
                            isSelected = false,
                            isToday = false,
                            isEnabled = true,
                            isUploaded = true,
                            onClick = {},
                        )
                        YGListDate(
                            text = "31",
                            isSelected = true,
                            isToday = false,
                            isEnabled = true,
                            isUploaded = true,
                            onClick = {},
                        )
                        YGListDate(
                            text = "31",
                            isSelected = false,
                            isToday = true,
                            isEnabled = true,
                            isUploaded = true,
                            onClick = {},
                        )
                        YGListDate(
                            text = "31",
                            isSelected = false,
                            isToday = false,
                            isEnabled = false,
                            isUploaded = true,
                            onClick = {},
                        )
                    }
                }
            }
            item {
                PreviewSection("upload = false") {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        YGListDate(
                            text = "31",
                            isSelected = false,
                            isToday = false,
                            isEnabled = true,
                            isUploaded = false,
                            onClick = {},
                        )
                        YGListDate(
                            text = "31",
                            isSelected = true,
                            isToday = false,
                            isEnabled = true,
                            isUploaded = false,
                            onClick = {},
                        )
                        YGListDate(
                            text = "31",
                            isSelected = false,
                            isToday = true,
                            isEnabled = true,
                            isUploaded = false,
                            onClick = {},
                        )
                        YGListDate(
                            text = "31",
                            isSelected = false,
                            isToday = false,
                            isEnabled = false,
                            isUploaded = false,
                            onClick = {},
                        )
                    }
                }
            }
        }
    }
}

@YGPreview
@Composable
private fun PreviewYGListDatePreviewScreen() = PreviewBox {
    YGListDatePreviewScreen(onBack = {})
}
```

- [ ] **Step 4: 카탈로그 등록**

`ComponentCatalog.kt` — import 블록에 알파벳 순으로
`import com.teamyg.parfait.preview.navigation.key.NavKeyYGListDate` 추가하고,
`componentCatalog` 리스트에서 `label = "YGDateButton"` 항목 **바로 뒤에** 아래를 넣는다:

```kotlin
    ComponentEntry(
        category = ComponentCategory.BUTTON,
        label = "YGListDate",
        navKey = NavKeyYGListDate,
    ),
```

- [ ] **Step 5: 엔트리 배선**

`ComponentEntryBuilders.kt` — import 2줄 추가
(`...navigation.key.NavKeyYGListDate`, `...screen.component.YGListDatePreviewScreen`),
그리고 `entry<NavKeyYGDateButton> { ... }` 블록 **바로 뒤에** 아래를 넣는다:

```kotlin
    entry<NavKeyYGListDate> {
        ScreenScaffold { modifier ->
            YGListDatePreviewScreen(
                onBack = navigator::onBack,
                modifier = modifier,
            )
        }
    }
```

- [ ] **Step 6: 빌드 확인**

Run: `./gradlew :core:designsystem:assembleDebug :app-preview:assembleDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 7: ktlint 확인**

Run: `./gradlew ktlintCheck`
Expected: BUILD SUCCESSFUL. 실패하면 `./gradlew ktlintFormat` 후 재실행.

- [ ] **Step 8: 프리뷰 육안 확인**

Android Studio에서 `YGListDate.kt`의 `YGListDatePreview`를 연다.
Expected: 4개 셀이 나란히 보이고, 앞의 둘만 날짜 아래 빨간 점이 있으며 **네 셀의 높이가 모두 같다.**

---

## Task 2: `YGFloatingBar` 4변형 신설

**Files:**
- Create: `core/designsystem/src/main/kotlin/com/teamyg/parfait/core/designsystem/component/ygfloatingbar/YGFloatingBar.kt`
- Create: `app-preview/src/main/kotlin/com/teamyg/parfait/preview/navigation/key/NavKeyYGFloatingBar.kt`
- Create: `app-preview/src/main/kotlin/com/teamyg/parfait/preview/screen/component/YGFloatingBarPreviewScreen.kt`
- Modify: `app-preview/src/main/kotlin/com/teamyg/parfait/preview/model/ComponentCatalog.kt`
- Modify: `app-preview/src/main/kotlin/com/teamyg/parfait/preview/navigation/entry/ComponentEntryBuilders.kt`

**Interfaces:**
- Consumes: 기존 `YGCircleButton(iconResource: Int, type: YGCircleButtonType, contentDescription: String?, onClick: () -> Unit, modifier: Modifier, interactionSource: MutableInteractionSource)`,
  기존 `YGEditTabButton(text: String, isSelected: Boolean, onClick: () -> Unit, modifier: Modifier, interactionSource: MutableInteractionSource)`
- Produces:
  - `YGFloatingBarBackClose(onBackClick: () -> Unit, onCloseClick: () -> Unit, modifier: Modifier = Modifier)`
  - `YGFloatingBarClose(onCloseClick: () -> Unit, modifier: Modifier = Modifier)`
  - `YGFloatingBarEdit(title: String, onCloseClick: () -> Unit, onConfirmClick: () -> Unit, modifier: Modifier = Modifier)`
  - `YGFloatingBarEditTab(tabs: List<String>, selectedIndex: Int, onTabSelect: (Int) -> Unit, onCloseClick: () -> Unit, onConfirmClick: () -> Unit, modifier: Modifier = Modifier)`

**배경:** Figma `Floating Bar` 4변형은 상단 16dp·좌우 20dp 패딩의 한 `Row`를 공유하고, 그 안에
`Button-Circle`(`Type=Default`)을 좌·우로 배치한다. 폭 375는 Figma 프레임 폭일 뿐이라 컴포넌트에
박지 않고 호출자가 `modifier`로 정한다.

`Close` 변형만 `Arrangement.End`인 이유: `SpaceBetween`에 자식이 하나면 좌측으로 붙어 Figma의
`justify-end`와 어긋난다.

`Edit`의 중앙 텍스트는 좌우 버튼 폭이 44dp로 같아 `SpaceBetween`에서 실질 중앙에 온다. Figma도 같은
구조라 중앙 정렬을 별도로 강제하지 않는다.

- [ ] **Step 1: `YGFloatingBar.kt` 작성**

```kotlin
package com.teamyg.parfait.core.designsystem.component.ygfloatingbar

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.teamyg.parfait.core.designsystem.R
import com.teamyg.parfait.core.designsystem.component.ygcirclebutton.YGCircleButton
import com.teamyg.parfait.core.designsystem.component.ygcirclebutton.YGCircleButtonType
import com.teamyg.parfait.core.designsystem.component.ygedittabbutton.YGEditTabButton
import com.teamyg.parfait.core.designsystem.theme.YGTheme
import com.teamyg.parfait.core.designsystem.theme.colors.YGAtomicColors
import com.teamyg.parfait.core.designsystem.utils.preview.PreviewBox
import com.teamyg.parfait.core.designsystem.utils.preview.YGPreview

/**
 * Figma Floating Bar / Status=Back-Close
 */
@Composable
fun YGFloatingBarBackClose(
    onBackClick: () -> Unit,
    onCloseClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    YGFloatingBarContent(modifier = modifier) {
        YGCircleButton(
            iconResource = R.drawable.ic_caret_left,
            type = YGCircleButtonType.Default,
            contentDescription = "뒤로가기",
            onClick = onBackClick,
        )
        YGFloatingBarCloseButton(onClick = onCloseClick)
    }
}

/**
 * Figma Floating Bar / Status=Close
 */
@Composable
fun YGFloatingBarClose(
    onCloseClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    YGFloatingBarContent(
        modifier = modifier,
        horizontalArrangement = Arrangement.End,
    ) {
        YGFloatingBarCloseButton(onClick = onCloseClick)
    }
}

/**
 * Figma Floating Bar / Status=Edit
 */
@Composable
fun YGFloatingBarEdit(
    title: String,
    onCloseClick: () -> Unit,
    onConfirmClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    YGFloatingBarContent(modifier = modifier) {
        YGFloatingBarCloseButton(onClick = onCloseClick)
        Text(
            text = title,
            style = YGTheme.typography.body.b01R,
            color = YGAtomicColors.Gray.Gray800,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        YGFloatingBarConfirmButton(onClick = onConfirmClick)
    }
}

/**
 * Figma Floating Bar / Status=Edit-Tab
 */
@Composable
fun YGFloatingBarEditTab(
    tabs: List<String>,
    selectedIndex: Int,
    onTabSelect: (Int) -> Unit,
    onCloseClick: () -> Unit,
    onConfirmClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    YGFloatingBarContent(modifier = modifier) {
        YGFloatingBarCloseButton(onClick = onCloseClick)
        Row(verticalAlignment = Alignment.CenterVertically) {
            tabs.forEachIndexed { index, label ->
                YGEditTabButton(
                    text = label,
                    isSelected = index == selectedIndex,
                    onClick = { onTabSelect(index) },
                )
            }
        }
        YGFloatingBarConfirmButton(onClick = onConfirmClick)
    }
}

@Composable
private fun YGFloatingBarCloseButton(onClick: () -> Unit) {
    YGCircleButton(
        iconResource = R.drawable.ic_close,
        type = YGCircleButtonType.Default,
        contentDescription = "닫기",
        onClick = onClick,
    )
}

@Composable
private fun YGFloatingBarConfirmButton(onClick: () -> Unit) {
    YGCircleButton(
        iconResource = R.drawable.ic_check,
        type = YGCircleButtonType.Default,
        contentDescription = "확인",
        onClick = onClick,
    )
}

@Composable
private fun YGFloatingBarContent(
    modifier: Modifier = Modifier,
    horizontalArrangement: Arrangement.Horizontal = Arrangement.SpaceBetween,
    content: @Composable RowScope.() -> Unit,
) {
    Row(
        horizontalArrangement = horizontalArrangement,
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier.padding(
            start = YGTheme.layout.padding.padding7,
            top = YGTheme.layout.padding.padding6,
            end = YGTheme.layout.padding.padding7,
        ),
        content = content,
    )
}

@YGPreview
@Composable
private fun YGFloatingBarPreview() = PreviewBox {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(color = Color.White),
    ) {
        YGFloatingBarBackClose(
            onBackClick = {},
            onCloseClick = {},
            modifier = Modifier.fillMaxWidth(),
        )
        YGFloatingBarClose(
            onCloseClick = {},
            modifier = Modifier.fillMaxWidth(),
        )
        YGFloatingBarEdit(
            title = "토핑 편집",
            onCloseClick = {},
            onConfirmClick = {},
            modifier = Modifier.fillMaxWidth(),
        )
        YGFloatingBarEditTab(
            tabs = listOf("영역", "테두리"),
            selectedIndex = 0,
            onTabSelect = {},
            onCloseClick = {},
            onConfirmClick = {},
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
```

- [ ] **Step 2: 갤러리 NavKey 작성**

Create `app-preview/.../navigation/key/NavKeyYGFloatingBar.kt`:

```kotlin
package com.teamyg.parfait.preview.navigation.key

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

@Serializable
data object NavKeyYGFloatingBar : NavKey
```

- [ ] **Step 3: 갤러리 화면 작성**

`Edit-Tab`은 상호작용이 있으므로 `remember`로 선택 상태를 들고 실제로 탭이 전환되는지 확인한다.

Create `app-preview/.../screen/component/YGFloatingBarPreviewScreen.kt`:

```kotlin
package com.teamyg.parfait.preview.screen.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.teamyg.parfait.core.designsystem.component.ygfloatingbar.YGFloatingBarBackClose
import com.teamyg.parfait.core.designsystem.component.ygfloatingbar.YGFloatingBarClose
import com.teamyg.parfait.core.designsystem.component.ygfloatingbar.YGFloatingBarEdit
import com.teamyg.parfait.core.designsystem.component.ygfloatingbar.YGFloatingBarEditTab
import com.teamyg.parfait.core.designsystem.component.ygtopbar.YGTopBarBack
import com.teamyg.parfait.core.designsystem.utils.preview.PreviewBox
import com.teamyg.parfait.core.designsystem.utils.preview.YGPreview

@Composable
internal fun YGFloatingBarPreviewScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        YGTopBarBack(onIconClick = onBack)
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                PreviewSection("Back-Close") {
                    YGFloatingBarBackClose(
                        onBackClick = {},
                        onCloseClick = {},
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
            item {
                PreviewSection("Close") {
                    YGFloatingBarClose(
                        onCloseClick = {},
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
            item {
                PreviewSection("Edit") {
                    YGFloatingBarEdit(
                        title = "토핑 편집",
                        onCloseClick = {},
                        onConfirmClick = {},
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
            item {
                PreviewSection("Edit-Tab") {
                    var selectedIndex by remember { mutableIntStateOf(0) }
                    YGFloatingBarEditTab(
                        tabs = listOf("영역", "테두리"),
                        selectedIndex = selectedIndex,
                        onTabSelect = { selectedIndex = it },
                        onCloseClick = {},
                        onConfirmClick = {},
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
    }
}

@YGPreview
@Composable
private fun PreviewYGFloatingBarPreviewScreen() = PreviewBox {
    YGFloatingBarPreviewScreen(onBack = {})
}
```

- [ ] **Step 4: 카탈로그 등록**

`ComponentCatalog.kt` — import 블록에 알파벳 순으로
`import com.teamyg.parfait.preview.navigation.key.NavKeyYGFloatingBar` 추가하고,
`category = ComponentCategory.BAR`인 `label = "YGTopBar"` 항목 **바로 뒤에** 아래를 넣는다:

```kotlin
    ComponentEntry(
        category = ComponentCategory.BAR,
        label = "YGFloatingBar",
        navKey = NavKeyYGFloatingBar,
    ),
```

- [ ] **Step 5: 엔트리 배선**

`ComponentEntryBuilders.kt` — import 2줄 추가
(`...navigation.key.NavKeyYGFloatingBar`, `...screen.component.YGFloatingBarPreviewScreen`),
그리고 `entry<NavKeyYGTopBar> { ... }` 블록 **바로 뒤에** 아래를 넣는다:

```kotlin
    entry<NavKeyYGFloatingBar> {
        ScreenScaffold { modifier ->
            YGFloatingBarPreviewScreen(
                onBack = navigator::onBack,
                modifier = modifier,
            )
        }
    }
```

- [ ] **Step 6: 빌드 확인**

Run: `./gradlew :core:designsystem:assembleDebug :app-preview:assembleDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 7: ktlint 확인**

Run: `./gradlew ktlintCheck`
Expected: BUILD SUCCESSFUL. 실패하면 `./gradlew ktlintFormat` 후 재실행.

- [ ] **Step 8: 프리뷰 육안 확인**

Android Studio에서 `YGFloatingBar.kt`의 `YGFloatingBarPreview`를 연다.
Expected: 4행. 1행 좌 `<`·우 `×`, 2행 **우측에만** `×`, 3행 좌 `×`·중앙 "토핑 편집"·우 `✓`,
4행 좌 `×`·중앙 "영역"(밑줄 있음)/"테두리"(밑줄 없음)·우 `✓`.

---

## Task 3: `YGTopBar` — Canvas 변형 신설 + 프리뷰 칩 색 정정

**Files:**
- Modify: `core/designsystem/src/main/kotlin/com/teamyg/parfait/core/designsystem/component/ygtopbar/YGTopBar.kt`
- Modify: `app-preview/src/main/kotlin/com/teamyg/parfait/preview/screen/component/YGTopBarPreviewScreen.kt`

**Interfaces:**
- Consumes: 기존 `YGIconButton`, `YGChipButton`, `YGChipButtonColorsDefaults.CherrySubtle`,
  기존 `YGNametagChip(colorChipType: YGColorChipType, userFirstName: String, chip: YGNametagChipStyle, modifier: Modifier)`,
  기존 `YGColorChipType.NametagChipPlus`
- Produces:
  - `YGTopBarCanvas(title: String, onBackClick: () -> Unit, onMenuClick: () -> Unit, modifier: Modifier = Modifier, memberContent: @Composable RowScope.() -> Unit = { })`

**배경:** private `YGTopBarContent`에 파라미터 2개(`contentPadding`·`trailingContent`)만 더해
Canvas를 수용한다. 기본값이 현재 동작과 같아 기존 3변형(`Back`·`Detail`·`Empty`) 호출부는 바뀌지 않는다.
`trailingContent`를 `weight(1f)` Row **바깥**의 형제로 두는 것이 Figma가 Info-Group을 flex-1로 두고
우측 아이콘을 형제로 두는 구조와 같다. `Empty`의 `rightContent`(#173 신설)는 그 Row **안쪽** 형제라
역할이 겹치지 않는다.

Canvas의 제목/멤버 우측 정렬은 안쪽 Row의 `Arrangement`를 바꾸지 않고 `titleContent` 안에서
`Spacer(Modifier.weight(1f))`로 만든다 — 안쪽 Row의 arrangement를 건드리면 나머지 4변형에 영향이 간다.

- [ ] **Step 1: `YGTopBarContent` 확장**

`YGTopBar.kt`의 `YGTopBarContent`를 아래로 교체한다.

```kotlin
@Composable
private fun YGTopBarContent(
    @DrawableRes iconResource: Int,
    contentDescription: String?,
    onIconClick: () -> Unit,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(
        start = YGTheme.layout.padding.padding3,
        top = YGTheme.layout.padding.padding3,
        end = YGTheme.layout.padding.padding7,
        bottom = YGTheme.layout.padding.padding3,
    ),
    titleContent: @Composable RowScope.() -> Unit = { },
    trailingContent: @Composable () -> Unit = { },
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier.padding(contentPadding),
    ) {
        YGIconButton(
            iconResource = iconResource,
            size = YGIconButtonSize.SIZE_44,
            contentDescription = contentDescription,
            onClick = onIconClick,
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f),
            content = titleContent,
        )
        trailingContent()
    }
}
```

import 추가: `androidx.compose.foundation.layout.PaddingValues`.
`androidx.compose.foundation.layout.padding`은 이미 import돼 있다.

- [ ] **Step 2: `YGTopBarCanvas` 추가**

`YGTopBarEmpty` **뒤**, `YGTopBarContent` **앞**에 넣는다(공개 함수들이 모여 있는 구역).

```kotlin
@Composable
fun YGTopBarCanvas(
    title: String,
    onBackClick: () -> Unit,
    onMenuClick: () -> Unit,
    modifier: Modifier = Modifier,
    memberContent: @Composable RowScope.() -> Unit = { },
) {
    YGTopBarContent(
        iconResource = R.drawable.ic_caret_left,
        contentDescription = "뒤로가기",
        onIconClick = onBackClick,
        modifier = modifier,
        contentPadding = PaddingValues(YGTheme.layout.padding.padding3),
        titleContent = {
            Text(
                text = title,
                style = YGTheme.typography.body.b01R,
                color = YGAtomicColors.Gray.Gray800,
            )
            Spacer(modifier = Modifier.weight(1f))
            memberContent()
        },
        trailingContent = {
            YGIconButton(
                iconResource = R.drawable.ic_hamburger,
                size = YGIconButtonSize.SIZE_44,
                contentDescription = "메뉴",
                onClick = onMenuClick,
            )
        },
    )
}
```

import 추가: `androidx.compose.foundation.layout.Spacer`.

- [ ] **Step 3: 프리뷰 칩 색 정정**

`YGTopBar.kt` 맨 아래 `YGTopBarPreview`의 칩 슬롯 예시에서 `colors`만 바꾼다. 컴포넌트 API는 손대지 않는다.

```kotlin
        YGTopBarEmpty(
            onIconClick = {},
            rightContent = {
                YGChipButton(
                    text = "그룹 추가하기",
                    colors = YGChipButtonColorsDefaults.CherrySubtle, // was: CherrySolid
                    onClick = {},
                    startIconResource = R.drawable.ic_plus,
                )
            },
        )
```

Figma 정본이 `CherrySubtle`(`Cherry50` 배경 / `Gray600` 전경)이고 실제 호출부(G-001 `GroupListScreen`)도
이미 `CherrySubtle`이라, 프리뷰만 어긋나 있다.

- [ ] **Step 4: 컴포넌트 프리뷰에 Canvas 추가**

`YGTopBar.kt` 맨 아래 `YGTopBarPreview`의 `Column` 안, 칩 슬롯 예시(Step 3) 뒤에 추가한다.

```kotlin
        YGTopBarCanvas(
            title = "그룹이름",
            onBackClick = { },
            onMenuClick = { },
            modifier = Modifier.fillMaxWidth(),
            memberContent = {
                YGNametagChip(
                    colorChipType = YGColorChipType.NametagChip5,
                    userFirstName = "김",
                    chip = YGNametagChipStyle.Style28,
                )
            },
        )
```

import 추가:
`com.teamyg.parfait.core.designsystem.component.ygcolorchip.YGColorChipType`,
`com.teamyg.parfait.core.designsystem.component.ygcolorchip.YGNametagChip`,
`com.teamyg.parfait.core.designsystem.component.ygcolorchip.YGNametagChipStyle`.

- [ ] **Step 5: 갤러리 화면에 Canvas 섹션 + List-Member 조립 예시 추가**

`YGTopBarPreviewScreen.kt`의 `LazyColumn` 안, `"YGTopBarDefault"` 라벨 item(내용은 #173 이후
`YGTopBarEmpty` + 칩 슬롯) 뒤에 아래 item을 추가하고,
파일 하단(`PreviewYGTopBarPreviewScreen` 앞)에 `MemberListSample`을 정의한다.

겹침은 `Arrangement.spacedBy((-12).dp)`로 만든다 — Figma의 `mr-[-12px]`와 같고, 나중에 오는 칩이
위에 그려지는 순서까지 Figma와 일치한다. 이 조립 코드가 **호출자 책임의 참조 구현**이다.

```kotlin
            item {
                PreviewSection("YGTopBarCanvas") {
                    YGTopBarCanvas(
                        title = "그룹이름",
                        onBackClick = {},
                        onMenuClick = {},
                        memberContent = { MemberListSample() },
                    )
                }
            }
```

```kotlin
@Composable
private fun MemberListSample() {
    val members = listOf(
        YGColorChipType.NametagChip5 to "김",
        YGColorChipType.NametagChip4 to "이",
        YGColorChipType.NametagChip1 to "박",
        YGColorChipType.NametagChip2 to "최",
        YGColorChipType.NametagChip12 to "정",
    )
    Row(
        horizontalArrangement = Arrangement.spacedBy((-12).dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        members.forEach { (type, name) ->
            YGNametagChip(
                colorChipType = type,
                userFirstName = name,
                chip = YGNametagChipStyle.Style28,
            )
        }
        YGNametagChip(
            colorChipType = YGColorChipType.NametagChipPlus,
            userFirstName = "+7",
            chip = YGNametagChipStyle.Style28,
        )
    }
}
```

import 추가:
`androidx.compose.foundation.layout.Row`,
`androidx.compose.ui.Alignment`,
`com.teamyg.parfait.core.designsystem.component.ygcolorchip.YGColorChipType`,
`com.teamyg.parfait.core.designsystem.component.ygcolorchip.YGNametagChip`,
`com.teamyg.parfait.core.designsystem.component.ygcolorchip.YGNametagChipStyle`,
`com.teamyg.parfait.core.designsystem.component.ygtopbar.YGTopBarCanvas`.

- [ ] **Step 6: 기존 호출부 회귀 확인**

Run: `rg -n "YGTopBar(Empty|Back|Detail)\(" --glob '!**/build/**'`
Expected: 세 변형 호출부(`app-preview` 프리뷰 화면들, G-001 `GroupListScreen`)가 기존 파라미터만
넘기고 있어 `YGTopBarContent` 확장이 컴파일에 영향을 주지 않음을 눈으로 확인.
`YGTopBarDefault` 호출부는 **0건이어야 한다**(#173에서 삭제됨).

- [ ] **Step 7: 빌드 확인**

Run: `./gradlew :core:designsystem:assembleDebug :app-preview:assembleDebug :app:assembleDebug`
Expected: BUILD SUCCESSFUL. `:app`까지 도는 이유는 `YGTopBar*`가 feature 모듈에서 실제로 쓰이고
있어 시그니처 변경 회귀를 여기서 잡아야 하기 때문이다.

- [ ] **Step 8: ktlint 확인**

Run: `./gradlew ktlintCheck`
Expected: BUILD SUCCESSFUL. 실패하면 `./gradlew ktlintFormat` 후 재실행.

- [ ] **Step 9: 프리뷰 육안 확인**

Android Studio에서 `YGTopBar.kt`의 `YGTopBarPreview`를 연다.
Expected: 5행(`Back`·`Detail`·`Empty`·`Empty`+칩·`Canvas`). 칩 행이 **연분홍 배경 + 회색 글씨
"그룹 추가하기"**로 바뀌어 있고, 마지막 `Canvas` 행은 좌 `<`·"그룹이름"·우측에 네임태그 1개와
햄버거 아이콘이 보인다.

---

## Task 4: 통합 검증 + 문서 갱신

**Files:**
- Modify: `parfait/specs/2026-08-01-designsystem-bar-listdate-components.md` (이 repo)
- Modify: `parfait/specs/README.md` (이 repo)
- Modify: `parfait/plans/2026-08-01-designsystem-bar-listdate-components.md` (이 repo)
- Modify: `parfait/plans/README.md` (이 repo)

**Interfaces:**
- Consumes: Task 1~3의 산출물 전부
- Produces: 없음(검증·기록 Task)

- [ ] **Step 1: repo 전체 빌드**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 2: repo 전체 ktlint**

Run: `./gradlew ktlintCheck`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: 갤러리 설치**

Run: `./gradlew :app-preview:installDebug`
Expected: 실기기(Galaxy A35)에 설치 성공

- [ ] **Step 4: 실기기 육안 대조 — YGListDate**

갤러리 → `Button` → `YGListDate`.
Expected: `upload = true` 4셀 전부 날짜 아래 빨간 점, `upload = false` 4셀은 점이 없으나
**두 섹션의 셀 높이가 동일**. 각 섹션 안에서 default/selected/today/disabled가 Figma
`Button-Date` 4상태와 일치.

- [ ] **Step 5: 실기기 육안 대조 — YGFloatingBar**

갤러리 → `Bar` → `YGFloatingBar`.
Expected: `Close` 행의 버튼이 **우측 끝**에 붙어 있고(좌측 아님), `Edit` 행의 텍스트가 중앙,
`Edit-Tab` 행에서 "테두리"를 탭하면 밑줄이 그쪽으로 옮겨간다.

- [ ] **Step 6: 실기기 육안 대조 — YGTopBar**

갤러리 → `Bar` → `YGTopBar`.
Expected: 칩 슬롯 섹션의 칩이 연분홍 배경 + 회색 "그룹 추가하기". `YGTopBarCanvas` 섹션에서
네임태그 6개가 12dp씩 겹쳐 있고 마지막이 `+7` 흰 칩이며, 우측 끝에 햄버거 아이콘이 있다.
Back/Detail/Empty 3섹션은 이전과 동일.

- [ ] **Step 7: 결함 발견 시 처리**

육안에서 어긋난 것이 있으면 **원인이 컴포넌트인지 갤러리 화면인지 먼저 가른다.** 선행 라운드에서
결함 4건 중 3건이 갤러리 화면 한정이었다. 컴포넌트 결함이면 Task 1~3 해당 파일을 고치고 Step 1~6을
다시 돈다. 갤러리 결함이면 `app-preview`만 고친다. 어느 쪽이든 **무엇이 왜 틀렸는지**를 Step 8의
기록 대상에 넣는다.

- [ ] **Step 8: parfait 문서 갱신 (이 repo)**

- 스펙 파일 머리말에 "구현 상태(2026-08-01)" 블록 추가 — 완료 범위, 육안 검증 결과, 발견·수정한
  결함, 미검증으로 남은 것(pressed 상태 등), TJYG-Android 미커밋 사실과 브랜치명
- 스펙 `status`를 `draft` → `in-progress`로 변경
- 이 계획서 `status`를 `todo` → `done`으로 변경하고 머리말에 실행 결과 블록 추가
- `parfait/specs/README.md`·`parfait/plans/README.md`의 해당 행에 실행 결과 요약 반영
- **이 repo는 브랜치 → 커밋까지만.** push·PR은 작업자 확인 후

- [ ] **Step 9: 최종 보고**

TJYG-Android 작업 트리 변경 목록(`git status --short`)과 미커밋 사실, 육안 검증 결과, 남은
열린 질문을 작업자에게 보고한다.

---

## 열린 질문 (스펙에서 이월)

1. **`+N` 카운트 칩 타입** — `YGColorChipType`이 13종 + `NametagChipPlus`라 정책 12종과 어긋난
   상태가 이어진다. 갤러리 예시는 `NametagChipPlus`로 그리되 정리는 Nametag 라운드로 넘긴다.
2. **`YGFloatingBarEdit`의 중앙 문구 출처** — Figma가 `Text` placeholder만 두어 실제 문구를 알 수
   없다. 프리뷰·갤러리에서는 `"토핑 편집"`을 샘플로 쓰고, 실제 값은 호출 화면 구현 때 확정한다.
3. **Floating Bar의 배치 책임** — Figma가 상단 패딩 16dp만 주고 화면 어디에 떠 있는지는 컴포넌트
   밖 정보다. 호출 화면이 정한다.
