---
id: clickableyg-ripple-variants
title: clickableYG 리플 변형 + ygScaleRipple Implementation Plan
status: done
type: work-order
created: 2026-07-13
updated: 2026-07-15
platforms: android
owner:
related_adr: ADR-0010
related_spec: clickableyg-ripple-variants
related_code: YGScaleRipple.kt#ygScaleRipple, YGClickable.kt#clickableYG
archived_reason:
tags: [plan, parfait, designsystem]
---

# clickableYG 리플 변형 + ygScaleRipple Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ygScaleRipple`(누르면 축소 IndicationNodeFactory)을 신설하고, clickableYG 코어를 `indications: List<Indication>` 수용으로 바꿔 `clickableYGDimRipple`·`clickableYGScaleRipple`·`clickableYGMergeRipple`·`clickableYG`(=Dim) 공개 변형을 제공한다. 모두 non-`@Composable`.

**Architecture:** 코어 `internal Modifier.clickableYGThrottle(indications: List<Indication>, ...)`의 Node가 자체 `interactionSource`에 리스트의 각 `IndicationNodeFactory`를 delegate(다중). 공개 변형은 적절한 리플 리스트를 넘기는 얇은 팩토리. throttle 상태는 Node에 유지(변경 없음). ripple 파일은 `YGDimRipple.kt`/`YGScaleRipple.kt`로 분리.

**Tech Stack:** Kotlin, Jetpack Compose foundation(`IndicationNodeFactory`)/ui.node(`DelegatingNode`·`DrawModifierNode`)/animation-core(`Animatable`), material.ripple. 자체 테마([ADR-0010](../../adr/0010-custom-compositionlocal-theme.md)).

**Spec:** [specs/2026-07-13-clickableyg-ripple-variants.md](../../specs/archive/2026-07-13-clickableyg-ripple-variants.md)

> **구현 후 갱신** — Task 3 코드블록(커스텀 `ClickableYGNode`)은 이후:
> - 정리 커밋에서 `ClickableYGElement` 수동 `equals`·inspector·`attachIndications` 정돈.
> - (2026-07-14, **PR 리뷰 P1**) 접근성 패리티(focus/키/hover) 위해 **커스텀 노드를 버리고 `Modifier.clickable` 위 throttle 래핑(Approach 2)으로 재설계** — 변형·코어 `@Composable`, throttle은 `remember`된 `YGClickThrottleGate`, 다중 리플은 `YGCompositeIndicationNodeFactory`로 합성. `ClickableYGElement`/`ClickableYGNode` 제거. compile+ktlint 통과.
> - (2026-07-14) **`core:designsystem` → `core:util:android` `clickable/`로 이동**(ripple 색 리터럴화, util:android compose 플러그인). 아래 코드블록의 패키지·경로는 옛 위치.
>
> 현재 코드 기준은 [throttle 스펙](../../specs/archive/2026-07-12-clickableyg-throttle.md) "구조(Approach 2)"·"파일 구성" 참조. 아래 코드블록은 역사 스냅샷.

## Global Constraints
- 대상 repo: `TJYG-Android`. 패키지: `com.teamyg.parfait.core.designsystem.utils.clickable`.
- non-`@Composable` — Node가 source 소유·다중 indication delegate.
- 색·scaleValue는 리터럴/기본값(과도기). 시간원 `TimeSource.Monotonic` 유지.
- 검증: 유닛 TDD 인프라 없음(Compose UI). **compile(`:core:designsystem:compileReleaseKotlin`) + `:core:designsystem:ktlintMainSourceSetCheck` + 기기 육안**으로 대체.
- ktlint 엄격. 커밋 전 `ktlintMainSourceSetFormat`.

---

### Task 1: YGScaleRipple.kt 신설 (ygScaleRipple)

**Files:**
- Create: `core/designsystem/src/main/kotlin/com/teamyg/parfait/core/designsystem/utils/clickable/YGScaleRipple.kt`

**Interfaces:**
- Produces: public `fun ygScaleRipple(scaleEnabled: Boolean = true, scaleValue: Float = 0.98f): IndicationNodeFactory`.

- [ ] **Step 1: 파일 작성**

```kotlin
package com.teamyg.parfait.core.designsystem.utils.clickable

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.IndicationNodeFactory
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.runtime.Stable
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.node.DelegatableNode
import androidx.compose.ui.node.DelegatingNode
import androidx.compose.ui.node.DrawModifierNode
import kotlinx.coroutines.launch

@Stable
fun ygScaleRipple(
    scaleEnabled: Boolean = true,
    scaleValue: Float = 0.98f,
): IndicationNodeFactory = YGScaleNodeFactory(
    scaleEnabled = scaleEnabled,
    scaleValue = scaleValue,
)

internal class YGScaleNodeFactory(
    private val scaleEnabled: Boolean,
    private val scaleValue: Float,
) : IndicationNodeFactory {
    override fun create(interactionSource: InteractionSource): DelegatableNode = DelegatingYGScaleRippleNode(
        interactionSource = interactionSource,
        scaleEnabled = scaleEnabled,
        scaleValue = scaleValue,
    )

    override fun equals(other: Any?): Boolean {
        if (this === other) {
            return true
        }
        if (other !is YGScaleNodeFactory) {
            return false
        }
        if (scaleEnabled != other.scaleEnabled) {
            return false
        }
        return scaleValue == other.scaleValue
    }

    override fun hashCode(): Int {
        var result = scaleEnabled.hashCode()
        result = 31 * result + scaleValue.hashCode()
        return result
    }
}

private class DelegatingYGScaleRippleNode(
    private val interactionSource: InteractionSource,
    private val scaleEnabled: Boolean,
    private val scaleValue: Float,
) : DelegatingNode(), DrawModifierNode {
    private val animatable = Animatable(1f)

    override fun onAttach() {
        if (!scaleEnabled) {
            return
        }
        coroutineScope.launch {
            interactionSource.interactions.collect { interaction ->
                when (interaction) {
                    is PressInteraction.Press -> {
                        animatable.animateTo(
                            targetValue = scaleValue,
                            animationSpec = tween(
                                durationMillis = 150,
                                easing = FastOutSlowInEasing,
                            ),
                        )
                    }

                    is PressInteraction.Release,
                    is PressInteraction.Cancel,
                    -> {
                        animatable.animateTo(
                            targetValue = 1f,
                            animationSpec = spring(
                                dampingRatio = Spring.DampingRatioMediumBouncy,
                                stiffness = Spring.StiffnessMedium,
                            ),
                        )
                    }
                }
            }
        }
    }

    override fun ContentDrawScope.draw() {
        if (scaleEnabled) {
            val scale = animatable.value
            scale(scale, scale) {
                this@draw.drawContent()
            }
        } else {
            drawContent()
        }
    }
}
```

- [ ] **Step 2: 컴파일** — `./gradlew :core:designsystem:compileReleaseKotlin --offline` → `BUILD SUCCESSFUL`. (미해결 시 `animation-core`는 compose BOM 전이 포함 — compile이 판정.)
- [ ] **Step 3: ktlint** — `./gradlew :core:designsystem:ktlintMainSourceSetFormat :core:designsystem:ktlintMainSourceSetCheck --offline` → `BUILD SUCCESSFUL`.

---

### Task 2: YGRipple.kt → YGDimRipple.kt 리네임

**Files:**
- Rename: `core/designsystem/.../utils/clickable/YGRipple.kt` → `.../utils/clickable/YGDimRipple.kt`

**Interfaces:**
- 내용 불변(`ygDimRipple`·`YGDimRippleAlpha`·`YGDimRippleNodeFactory`·`DelegatingYGDimRippleNode` 그대로). 패키지 동일(`...utils.clickable`)이라 참조·import 변화 없음.

- [ ] **Step 1: git mv** — `git mv core/designsystem/src/main/kotlin/com/teamyg/parfait/core/designsystem/utils/clickable/YGRipple.kt core/designsystem/src/main/kotlin/com/teamyg/parfait/core/designsystem/utils/clickable/YGDimRipple.kt`
- [ ] **Step 2: 컴파일** — `./gradlew :core:designsystem:compileReleaseKotlin --offline` → `BUILD SUCCESSFUL`(파일명만 변경, 심볼 동일).

---

### Task 3: YGClickable.kt — 코어 indications 리스트 + 공개 변형 4종

**Files:**
- Modify: `core/designsystem/src/main/kotlin/com/teamyg/parfait/core/designsystem/utils/clickable/YGClickable.kt`

**Interfaces:**
- Consumes: `ygDimRipple()`(YGDimRipple.kt)·`ygScaleRipple()`(YGScaleRipple.kt, Task 1) — 같은 패키지.
- Produces: public `Modifier.clickableYG` / `clickableYGDimRipple` / `clickableYGScaleRipple` / `clickableYGMergeRipple`(각각 `interactionSource: MutableInteractionSource? = null, enabled = true, onClickLabel = null, role = null, windowMillis = 300L, onClick`), internal `Modifier.clickableYGThrottle(interactionSource, indications: List<Indication>, ...)`.

- [ ] **Step 1: 파일 전체 교체** — 기존 `clickableYG`(단일 indication) 구조를 아래로 교체.

```kotlin
package com.teamyg.parfait.core.designsystem.utils.clickable

import androidx.compose.foundation.Indication
import androidx.compose.foundation.IndicationNodeFactory
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.ui.Modifier
import androidx.compose.ui.node.DelegatableNode
import androidx.compose.ui.node.DelegatingNode
import androidx.compose.ui.node.ModifierNodeElement
import androidx.compose.ui.node.SemanticsModifierNode
import androidx.compose.ui.node.invalidateSemantics
import androidx.compose.ui.input.pointer.SuspendingPointerInputModifierNode
import androidx.compose.ui.platform.InspectorInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsPropertyReceiver
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.TimeSource

fun Modifier.clickableYG(
    interactionSource: MutableInteractionSource? = null,
    enabled: Boolean = true,
    onClickLabel: String? = null,
    role: Role? = null,
    windowMillis: Long = 300L,
    onClick: () -> Unit,
): Modifier = clickableYGDimRipple(
    interactionSource = interactionSource,
    enabled = enabled,
    onClickLabel = onClickLabel,
    role = role,
    windowMillis = windowMillis,
    onClick = onClick,
)

fun Modifier.clickableYGDimRipple(
    interactionSource: MutableInteractionSource? = null,
    enabled: Boolean = true,
    onClickLabel: String? = null,
    role: Role? = null,
    windowMillis: Long = 300L,
    onClick: () -> Unit,
): Modifier = clickableYGThrottle(
    interactionSource = interactionSource,
    indications = listOf(ygDimRipple()),
    enabled = enabled,
    onClickLabel = onClickLabel,
    role = role,
    windowMillis = windowMillis,
    onClick = onClick,
)

fun Modifier.clickableYGScaleRipple(
    interactionSource: MutableInteractionSource? = null,
    enabled: Boolean = true,
    onClickLabel: String? = null,
    role: Role? = null,
    windowMillis: Long = 300L,
    onClick: () -> Unit,
): Modifier = clickableYGThrottle(
    interactionSource = interactionSource,
    indications = listOf(ygScaleRipple()),
    enabled = enabled,
    onClickLabel = onClickLabel,
    role = role,
    windowMillis = windowMillis,
    onClick = onClick,
)

fun Modifier.clickableYGMergeRipple(
    interactionSource: MutableInteractionSource? = null,
    enabled: Boolean = true,
    onClickLabel: String? = null,
    role: Role? = null,
    windowMillis: Long = 300L,
    onClick: () -> Unit,
): Modifier = clickableYGThrottle(
    interactionSource = interactionSource,
    indications = listOf(ygDimRipple(), ygScaleRipple()),
    enabled = enabled,
    onClickLabel = onClickLabel,
    role = role,
    windowMillis = windowMillis,
    onClick = onClick,
)

internal fun Modifier.clickableYGThrottle(
    interactionSource: MutableInteractionSource? = null,
    indications: List<Indication>,
    enabled: Boolean = true,
    onClickLabel: String? = null,
    role: Role? = null,
    windowMillis: Long = 300L,
    onClick: () -> Unit,
): Modifier = this then ClickableYGElement(
    interactionSource = interactionSource,
    indications = indications,
    enabled = enabled,
    onClickLabel = onClickLabel,
    role = role,
    windowMillis = windowMillis,
    onClick = onClick,
)

private data class ClickableYGElement(
    val interactionSource: MutableInteractionSource?,
    val indications: List<Indication>,
    val enabled: Boolean,
    val onClickLabel: String?,
    val role: Role?,
    val windowMillis: Long,
    val onClick: () -> Unit,
) : ModifierNodeElement<ClickableYGNode>() {
    override fun create(): ClickableYGNode = ClickableYGNode(
        interactionSource = interactionSource,
        indications = indications,
        enabled = enabled,
        onClickLabel = onClickLabel,
        role = role,
        windowMillis = windowMillis,
        onClick = onClick,
    )

    override fun update(node: ClickableYGNode) {
        node.update(
            interactionSource = interactionSource,
            indications = indications,
            enabled = enabled,
            onClickLabel = onClickLabel,
            role = role,
            windowMillis = windowMillis,
            onClick = onClick,
        )
    }

    override fun InspectorInfo.inspectableProperties() {
        name = "clickableYG"
        properties["enabled"] = enabled
        properties["windowMillis"] = windowMillis
        properties["role"] = role
        properties["onClickLabel"] = onClickLabel
    }
}

private class ClickableYGNode(
    private var interactionSource: MutableInteractionSource?,
    private var indications: List<Indication>,
    private var enabled: Boolean,
    private var onClickLabel: String?,
    private var role: Role?,
    private var windowMillis: Long,
    private var onClick: () -> Unit,
) : DelegatingNode(), SemanticsModifierNode {
    private var lastMark: TimeSource.Monotonic.ValueTimeMark? = null

    private var ownSource: MutableInteractionSource? = null
    private val source: MutableInteractionSource
        get() = interactionSource ?: ownSource ?: MutableInteractionSource().also { ownSource = it }

    private val indicationNodes = mutableListOf<DelegatableNode>()

    init {
        delegate(
            SuspendingPointerInputModifierNode {
                detectTapGestures(
                    onPress = { offset ->
                        if (!enabled) {
                            return@detectTapGestures
                        }
                        val press = PressInteraction.Press(offset)
                        source.emit(press)
                        val released = tryAwaitRelease()
                        source.emit(
                            if (released) PressInteraction.Release(press) else PressInteraction.Cancel(press),
                        )
                    },
                    onTap = { performClick() },
                )
            },
        )
    }

    override fun onAttach() {
        attachIndications()
    }

    private fun attachIndications() {
        indicationNodes.forEach { undelegate(it) }
        indicationNodes.clear()
        indications.forEach { indication ->
            if (indication is IndicationNodeFactory) {
                indicationNodes += delegate(indication.create(source))
            }
        }
    }

    private fun performClick() {
        if (!enabled) {
            return
        }
        val mark = lastMark
        if (mark == null || mark.elapsedNow() >= windowMillis.milliseconds) {
            lastMark = TimeSource.Monotonic.markNow()
            onClick()
        }
    }

    override fun SemanticsPropertyReceiver.applySemantics() {
        this@ClickableYGNode.role?.let { role = it }
        onClick(label = onClickLabel) {
            performClick()
            true
        }
        if (!enabled) {
            disabled()
        }
    }

    fun update(
        interactionSource: MutableInteractionSource?,
        indications: List<Indication>,
        enabled: Boolean,
        onClickLabel: String?,
        role: Role?,
        windowMillis: Long,
        onClick: () -> Unit,
    ) {
        val indicationsChanged = this.indications != indications || this.interactionSource != interactionSource
        val semanticsChanged = this.enabled != enabled || this.role != role || this.onClickLabel != onClickLabel

        this.interactionSource = interactionSource
        this.indications = indications
        this.enabled = enabled
        this.onClickLabel = onClickLabel
        this.role = role
        this.windowMillis = windowMillis
        this.onClick = onClick

        if (indicationsChanged) {
            attachIndications()
        }
        if (semanticsChanged) {
            invalidateSemantics()
        }
    }
}
```

- [ ] **Step 2: 컴파일** — `./gradlew :core:designsystem:compileReleaseKotlin --offline` → `BUILD SUCCESSFUL`. `clickableYG`가 `indication` 파라미터를 잃었으므로 기존 호출부에서 `indication` 전달 시 에러 → 해당 호출을 변형(`clickableYGScaleRipple` 등)으로 바꾸거나 파라미터 제거(사용처 확인).
- [ ] **Step 3: ktlint** — `./gradlew :core:designsystem:ktlintMainSourceSetFormat :core:designsystem:ktlintMainSourceSetCheck --offline` → `BUILD SUCCESSFUL`.
- [ ] **Step 4: 기기 육안** — dim(`clickableYGDimRipple`) 은은한 리플, scale(`clickableYGScaleRipple`) 누르면 0.98 축소·놓으면 bounce, merge(`clickableYGMergeRipple`) 둘 동시. **merge에서 리플이 축소 콘텐츠와 어떻게 겹치는지** 확인 → 어색하면 `clickableYGMergeRipple`의 `listOf(...)` 순서(dim↔scale) 교체.
- [ ] **Step 5: 커밋** (사용자 승인 후)

```bash
git add core/designsystem/src/main/kotlin/com/teamyg/parfait/core/designsystem/utils/clickable/
git commit -m "feat: clickableYG 리플 변형(Dim/Scale/Merge) + ygScaleRipple"
```

---

## Self-Review
- **Spec coverage**: ygScaleRipple(Task 1)·YGDimRipple 분리(Task 2)·코어 indications 리스트 + 4 변형(Task 3)·non-composable·merge 다중 delegate·draw 순서 확인·파일 3종 — 모두 대응.
- **Placeholder**: 없음(파일 전량 코드). merge 순서·기존 호출부 보정은 육안/compile 조건부(구체 지시 명시).
- **Type consistency**: `clickableYGThrottle(indications: List<Indication>)` ↔ `ClickableYGElement.indications` ↔ `ClickableYGNode.indications` ↔ `update(indications)` 동일. 변형 4종 시그니처(interactionSource/enabled/onClickLabel/role/windowMillis/onClick) 통일. `ygDimRipple()`/`ygScaleRipple()` 반환 `IndicationNodeFactory`.

## 열린 질문
- **merge draw 순서**: dim↔scale delegate 순서의 시각 정답은 기기 확인 후 확정.
- **기존 clickableYG 호출부**: `indication` 인자를 쓰던 곳 있으면 변형으로 이관(Task 3 Step 2).
- **과도기**: 리플 색 Gray900·scaleValue 0.98 리터럴 → 토큰화 후속([open-questions](../../synthesis/open-questions.md)).
