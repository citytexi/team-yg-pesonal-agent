---
id: navigation-flow
title: 내비게이션 흐름 (Navigation3 + Navigator)
category: architecture
status: living
platforms: android
verified: 2026-07-12
related_spec:
related_adr: ADR-0002, ADR-0006
related_architecture:
related_code: core:navigation, Navigator
tags: [architecture, parfait]
---
# 내비게이션 흐름 (Navigation3 + Navigator)

Navigation3 위에 자체 Navigator·엔트리 빌더를 얹는다. 결정 근거는 [[0006-navigation3-custom-navigator]]·[[0002-feature-api-impl-split]].

> 근거는 파일명+심볼명으로만.

## 구성 요소
- **Navigator**(`core:navigation`, `@ActivityRetainedScoped`) — 백스택 = `SnapshotStateList<NavKey>`. `goTo()`, `onBack()`, `clearBackStack()`.
- **NavKey**(각 feature `:api`, `@Serializable`) — 목적지 식별. 예: `NavKeyLogin`, `NavKeySegmentation`, `NavKeyCameraCustom`.
- **엔트리 빌더**(각 feature `:impl`) — `entry<NavKeyXxx> { ... }`를 등록하는 함수(예: `featureLoginEntryBuilder()`). Hilt 멀티바인딩 `Set<EntryProviderScope<NavKey>.(Navigator) -> Unit>`로 주입.
- **MainRoute**(`app`) — 주입된 빌더 집합을 `entryProvider { }` DSL로 순회 등록. NavEntry 데코레이터 적용:
  - `rememberSaveableStateHolderNavEntryDecorator` — 엔트리별 상태 보존.
  - `rememberViewModelStoreNavEntryDecorator` — 엔트리별 ViewModel 수명.
  - `rememberResultEventBusNavEntryDecorator` — 엔트리 간 결과 전달.

## 이동/뒤로
- 이동: ViewModel의 side effect → Screen이 소비 → `navigator.goTo(NavKeyXxx(...))`.
- 뒤로: `navigator.onBack()`. **빈 백스택 접근 가드 필수**(과거 크래시 이력).
- feature 간 이동은 상대 `:impl`이 아니라 **`:api`의 NavKey만** 참조.

## 신규 목적지 등록 체크리스트
1. `feature/xxx/api`에 `@Serializable NavKeyXxx : NavKey` 추가.
2. `feature/xxx/impl`에 `featureXxxEntryBuilder()` 작성: `entry<NavKeyXxx> { Scaffold { XxxRoute(...) } }`.
3. 빌더를 Hilt 모듈(`NavigationModule`, ActivityRetainedComponent)의 `Set<...>` 멀티바인딩에 `@IntoSet`으로 제공.
4. 이동 원하는 feature는 대상의 `:api`에 의존 추가(`settings.gradle.kts`/build 파일).
5. 결과가 필요하면 `ResultEventBus` 데코레이터 경로 사용.
