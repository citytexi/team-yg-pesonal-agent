---
tags: [spec, parfait, designsystem]
updated: 2026-07-13
---

# Spec: clickableYG 리플 변형 세트 + ygScaleRipple

- 상태: 구현 예정
- 날짜: 2026-07-13
- 대상: `core:designsystem` — `utils/clickable/`
- 관련: [[2026-07-12-clickableyg-throttle|clickableYG]](코어 throttle) · [[2026-07-13-ygripple|ygDimRipple]] · [ADR-0010](../adr/0010-custom-compositionlocal-theme.md) · [design-system](../architecture/design-system.md) · 이슈 #94

## 목표
clickableYG(중복 클릭 throttle)에 **리플 종류별 공개 변형**을 제공한다: dim ripple / scale(누르면 축소) / 둘 병합(merge). scale 효과용 `ygScaleRipple` `IndicationNodeFactory`를 신설(skt `ScaleNodeFactory` 포팅). **모두 non-`@Composable`** — Node가 자체 `interactionSource`에 여러 indication을 직접 delegate해 공유 source·`remember` 불필요.

## 범위
- **포함**: `ygScaleRipple` 신설. 코어 throttle modifier를 `indications: List<Indication>` 수용으로 전환. 공개 변형 `clickableYGDimRipple`·`clickableYGScaleRipple`·`clickableYGMergeRipple`·`clickableYG`(=Dim 위임). `YGRipple.kt`를 `YGDimRipple.kt`/`YGScaleRipple.kt`로 분리.
- **제외**: 리플 색·scaleValue 토큰화(과도기, 후속), 추가 리플 종류, 기존 clickable 사용처 마이그레이션.

## API / 인터페이스

### ygScaleRipple (`YGScaleRipple.kt`)
```kotlin
@Stable
fun ygScaleRipple(
    scaleEnabled: Boolean = true,
    scaleValue: Float = 0.98f,
): IndicationNodeFactory
```
- Press 시 컨텐츠를 `scaleValue`로 축소(tween 150ms `FastOutSlowInEasing`), Release/Cancel 시 `1f`로 복귀(spring `MediumBouncy`/`StiffnessMedium`).

### 코어 (internal, `YGClickable.kt`)
```kotlin
internal fun Modifier.clickableYGThrottle(
    interactionSource: MutableInteractionSource? = null,
    indications: List<Indication>,
    enabled: Boolean = true,
    onClickLabel: String? = null,
    role: Role? = null,
    windowMillis: Long = 300L,
    onClick: () -> Unit,
): Modifier
```
- 기존 clickableYG Node를 `indication: Indication?` 단일 → **`indications: List<Indication>`** 로 전환. Node가 리스트의 각 `IndicationNodeFactory`를 **자기 `interactionSource`에 delegate**(다중 delegate).

### 공개 변형 (`YGClickable.kt`, 모두 plain fun)
```kotlin
fun Modifier.clickableYGDimRipple(interactionSource: MutableInteractionSource? = null, enabled: Boolean = true, onClickLabel: String? = null, role: Role? = null, windowMillis: Long = 300L, onClick: () -> Unit): Modifier
fun Modifier.clickableYGScaleRipple(/* 동일 파라미터 */): Modifier
fun Modifier.clickableYGMergeRipple(/* 동일 파라미터 */): Modifier
fun Modifier.clickableYG(/* 동일 파라미터 */): Modifier
```
- `clickableYGDimRipple` → `clickableYGThrottle(indications = listOf(ygDimRipple()), ...)`.
- `clickableYGScaleRipple` → `listOf(ygScaleRipple())`.
- `clickableYGMergeRipple` → `listOf(ygDimRipple(), ygScaleRipple())`.
- `clickableYG` → `clickableYGDimRipple(...)` 위임(기본 진입점).
- 공통 파라미터: `interactionSource`(기본 null → Node 자체 생성), `enabled`/`onClickLabel`/`role`/`windowMillis`(300)/`onClick`. `indication`은 변형이 고정하므로 공개 시그니처에서 노출 안 함.

## 동작 / 구조
- **다중 indication delegate**: 코어 Node(`ClickableYGNode`)의 `attachIndication`이 `indications`를 순회하며 `is IndicationNodeFactory`인 것마다 `delegate(it.create(source))`. 이전 delegate는 재attach 시 `undelegate`.
- **merge draw 순서**: dim(리플 draw)과 scale(`DrawModifierNode`로 컨텐츠 scale)의 delegate 순서가 draw 레이어링에 영향 가능 → `ygDimRipple()` 먼저, `ygScaleRipple()` 나중 delegate를 기본으로 하되 **기기 육안으로 확정**(리플이 축소 콘텐츠 위/아래 어디 그려지는지).
- **throttle**: [[2026-07-12-clickableyg-throttle|clickableYG]] 코어 그대로(leading-edge, `TimeSource.Monotonic`, `lastMark` Node 상태, onPress `enabled` 게이트).
- **non-composable 근거**: Node가 source를 소유하고 모든 indication을 그 source에 delegate → 외부 공유 source·`remember` 불필요. 변형은 순수 Modifier 팩토리.

### ygScaleRipple 구조 (`YGScaleRipple.kt`)
- `YGScaleNodeFactory(scaleEnabled, scaleValue) : IndicationNodeFactory` — `create` → `DelegatingYGScaleRippleNode`, `equals`/`hashCode`(파라미터 기반).
- `DelegatingYGScaleRippleNode : DelegatingNode, DrawModifierNode` — `onAttach`서 `interactionSource.interactions` 수집해 `Animatable` 애니메이트, `draw()`서 `scale(animatable.value) { drawContent() }`. `scaleEnabled=false`면 애니메이션·scale 없이 `drawContent()`.

## 파일 구성 (`core:designsystem` `utils/clickable/`)
- `YGDimRipple.kt` — 기존 `YGRipple.kt`를 리네임. `ygDimRipple` + `YGDimRippleAlpha` + `YGDimRippleNodeFactory` + `DelegatingYGDimRippleNode`.
- `YGScaleRipple.kt` — 신설. `ygScaleRipple` + `YGScaleNodeFactory` + `DelegatingYGScaleRippleNode`.
- `YGClickable.kt` — 코어 `internal clickableYGThrottle`(indications: List) + 공개 `clickableYG`·`clickableYGDimRipple`·`clickableYGScaleRipple`·`clickableYGMergeRipple`.

## 주의 / 열린 질문
- **merge delegate 순서**: draw 레이어링 정답은 기기 확인 후 확정(dim↔scale 순서).
- **과도기**: 리플 색(`Gray.Gray900`)·`scaleValue`(0.98)가 토큰 아닌 리터럴/기본값. 디자인 토큰 확정 시 정리 → [open-questions](../../synthesis/open-questions.md).
- **기존 스펙 관계**: [[2026-07-12-clickableyg-throttle]](코어 throttle)·[[2026-07-13-ygripple]](ygDimRipple)의 API 일부(단일 `indication`, `YGRipple.kt` 파일명)를 이 스펙이 갱신. 구현 시 두 스펙의 해당 부분 동기화.
- **검증**: compile + ktlint + 기기 육안(dim 리플/scale 축소/merge 동시). 정적 프리뷰로 리플·애니메이션 안 보임.
