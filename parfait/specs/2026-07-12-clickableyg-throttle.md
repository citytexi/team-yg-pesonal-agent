---
id: clickableyg-throttle
title: clickableYG — Node 기반 중복 클릭 방지 Modifier
status: draft
category: behavior-spec
platforms: android
verified: 2026-07-12
related_code: core:designsystem utils/clickable/YGClickable.kt — Modifier.clickableYG
related_adr: ADR-0010
related_spec: ygripple
related_architecture: design-system
supersedes:
superseded_by:
tags: [spec, parfait, designsystem]
---

# Spec: clickableYG — Node 기반 중복 클릭 방지 Modifier

- 대상: `core:designsystem` — `utils/clickable/YGClickable.kt`
- 관련: [ADR-0010](../adr/0010-custom-compositionlocal-theme.md) · [design-system](../architecture/design-system.md) · [[2026-07-13-ygripple|ygDimRipple]](기본 indication) · 이슈 #94

## 목표
연타·중복 탭으로 `onClick`이 여러 번 발화하는 문제를 막는 재사용 clickable modifier `Modifier.clickableYG`를 만든다. 커스텀 `Modifier.Node`로 구현해 `composed{}` 오버헤드 없이 리스트 등 광범위 재사용에 적합하게 한다. (프로젝트 첫 `Modifier.Node`.)

## 범위
- **포함**: leading-edge throttle 클릭 게이트를 가진 `Modifier.clickableYG`, 이를 뒷받침하는 `ModifierNodeElement` + `Modifier.Node`.
- **제외**: 기존 `clickable` 사용처의 `clickableYG` 마이그레이션(후속), 물리 키보드/DPAD-center·hover 클릭 패리티(`clickable` 대비 미구현 — 모바일 터치 앱이라 수용), trailing debounce 시맨틱(버튼엔 leading throttle이 맞음).

## 동작
- **leading-edge throttle**: 첫 클릭은 **즉시** `onClick` 실행. 이후 `windowMillis` 이내의 클릭은 무시. 창이 지나면 다음 클릭이 다시 즉시 통과.
- **시간원**: **`kotlin.time.TimeSource.Monotonic`**(stdlib) — monotonic 보장(경과시간 정확), `android.os`·kotlinx.datetime 의존 없음, 테스트 시 `TimeSource` 대체 가능. wall clock(`System.currentTimeMillis()`·kotlinx.datetime `Clock.System.now()`)은 시계 점프 위험으로 **사용 금지**.
- **게이트 상태**: 마지막 통과 시각을 `TimeSource.Monotonic.ValueTimeMark`(`lastMark`)로 **`Modifier.Node` 인스턴스에 보관**(composition 재구성과 무관하게 유지). 게이트: `lastMark == null || lastMark.elapsedNow() >= window`면 통과 후 `lastMark = TimeSource.Monotonic.markNow()`. `window`는 내부 `Duration`(파라미터 `windowMillis`를 `.milliseconds`로 변환).
- **enabled=false**: 클릭·시맨틱 액션 무반응. `onPress`도 진입 시 live `enabled` 체크(`if (!enabled) return`)로 press interaction을 emit하지 않음 → **ripple도 안 뜸**(clickable disabled와 동일). `enabled`를 이벤트 시점에 읽으므로 `resetPointerInputHandler()` 불필요.

## API / 인터페이스
```kotlin
fun Modifier.clickableYG(
    interactionSource: MutableInteractionSource? = null,
    indication: Indication? = ygDimRipple(),
    enabled: Boolean = true,
    onClickLabel: String? = null,
    role: Role? = null,
    windowMillis: Long = 300L,
    onClick: () -> Unit,
): Modifier
```
- `interactionSource`: 기본 `null` → 노드가 내부 `MutableInteractionSource`를 생성해 사용.
- `indication`: 기본 **`ygDimRipple()`**([[2026-07-13-ygripple|ygDimRipple]]) — 같은 모듈(`core:designsystem`)이라 YG 커스텀 리플을 기본값으로 주입. `null` 전달 시 인디케이션 없음, 다른 `IndicationNodeFactory` 전달로 교체 가능.
- `windowMillis`: throttle 창(기본 300ms). 화면별 조정 가능.
- `onClick`: 게이트를 통과한 탭에서만 호출.

## 구조 (Node)
- `ModifierNodeElement<ClickableYGNode>` — 파라미터 보유. `create()`로 노드 생성, `update()`로 파라미터 변경 반영(`windowMillis`/`enabled`/`onClick`/`role` 등). `equals`/`hashCode`는 파라미터 기반.
- `ClickableYGNode : Modifier.Node` — 상태 `lastClickMillis: Long` 보유.
  - **탭 감지**: delegated `SuspendingPointerInputModifierNode`(`detectTapGestures`). 탭 발생 시 게이트 통과하면 `onClick` 호출 + `interactionSource`에 `PressInteraction.Press`/`Release` emit(인디케이션 반응).
  - **시맨틱**: delegated `SemanticsModifierNode` — `role`, `onClickLabel`, `onClick` 액션 등록(TalkBack 더블탭 활성화 경로).
  - `enabled`에 따라 탭·시맨틱 액션 게이팅.
- **인디케이션 연결**: 팩토리에서 public `Modifier.indication(interactionSource, indication)` 체이닝 + `then(ClickableYGElement(...))`.

> 정확한 delegated node API·`detectTapGestures` 시그니처·`update()` 무효화 처리는 [plan](../plans/2026-07-12-clickableyg-throttle.md)에서 Compose BOM `2026.06.00` 기준으로 확정.

## 표시·제어 규칙
- 게이트 통과 조건: `enabled` **AND** (`lastMark == null` **OR** `lastMark.elapsedNow() >= window`).
- 통과 시에만 `lastMark` 갱신·`onClick` 발화.

## 파일 구성 (`core:designsystem`)
- `utils/clickable/YGClickable.kt` — public `Modifier.clickableYG(...)` 팩토리 + `private ClickableYGElement`(`ModifierNodeElement`) + `private ClickableYGNode`(`DelegatingNode`, `SemanticsModifierNode`). 같은 패키지 `utils/clickable/`의 [[2026-07-13-ygripple|YGRipple.kt]]와 함께 위치.
- (이력) 초기 `core:ui`의 `utils/extensions/Modifier.kt`로 구현 후 리베이스에서 `core:designsystem utils/clickable/YGClickable.kt`로 이동 — ygDimRipple을 기본값으로 쓰려면 같은 모듈이어야 해서.

## 주의 / 열린 질문
- **키보드/hover 미지원**: `clickable` 대비 물리 키보드·DPAD-center·hover 클릭 경로 미구현(터치·TalkBack 시맨틱만). 필요 시 후속 확장.
- **검증 한계**: throttle 타이밍은 유닛 테스트 인프라 부재(Compose UI)로 compile + ktlint + `@Preview`/기기 연타 육안으로 확인. 정밀 타이밍 테스트는 별도.
- **첫 Modifier.Node**: 프로젝트에 Node 선례 없음. 성공 시 이후 커스텀 modifier의 참조 패턴이 됨(아키텍처 결정화되면 ADR 검토).
- **indication 기본값 = ygDimRipple (해소)**: 초기에는 `core:ui`(디자인시스템 하위)라 테마·리플을 못 읽어 `indication`을 필수 파라미터로 받고 themed 기본값은 designsystem wrapper 후속으로 미뤘음. 리베이스에서 `clickableYG`를 **`core:designsystem`으로 이동**해 같은 모듈의 [[2026-07-13-ygripple|ygDimRipple]]을 `indication` 기본값으로 직접 주입 → 별도 wrapper 없이 해소. `null` 전달로 무인디케이션, 다른 `IndicationNodeFactory`로 교체 가능.
