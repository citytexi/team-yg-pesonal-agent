---
id: navigation-flow
title: 내비게이션 흐름 (Navigation3 + Navigator)
category: architecture
status: living
platforms: android
verified: 2026-08-10
related_spec: designsystem-ygscreen-scaffold, a005-group-create, g001-group-list, c101-camera-picture-confirm, c102-custom-gallery-picker, intro-term-agree
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
- **NavKey**(각 feature `:api`, `@Serializable`) — 목적지 식별. 예: `NavKeyLogin`, `NavKeySegmentation`, `NavKeyCameraCustom`. groups·app 계열은 목적지가 많다: `NavKeyGroupList`·`NavKeyGroupSetting`·`NavKeyGroupInviteCode`, canvas의 `NavKeyCanvasEdit`·`NavKeyCanvasImageAdd`·`NavKeyCanvasImageSelect`·`NavKeyCanvasMove`, `NavKeyAppSetting` 등. 전체 목록은 `feature/*/api`에서 확인(모듈 목록은 [module-structure](module-structure.md)).
- **엔트리 빌더**(각 feature `:impl`) — `entry<NavKeyXxx> { ... }`를 등록하는 함수(예: `featureLoginEntryBuilder()`). Hilt 멀티바인딩 `Set<EntryProviderScope<NavKey>.(Navigator) -> Unit>`로 주입. **빌더 하나가 여러 entry를 등록할 수 있다** — 예: `featureCanvasEntryBuilder()`는 canvas의 4개 NavKey(`ImageAdd`·`Edit`·`ImageSelect`·`Move`) entry를 한 함수에서 등록.
- **MainRoute**(`app`) — 주입된 빌더 집합을 `entryProvider { }` DSL로 순회 등록. NavEntry 데코레이터 적용:
  - `rememberSaveableStateHolderNavEntryDecorator` — 엔트리별 상태 보존.
  - `rememberViewModelStoreNavEntryDecorator` — 엔트리별 ViewModel 수명.
  - `rememberResultEventBusNavEntryDecorator` — 엔트리 간 결과 전달.

## 이동/뒤로
- 이동: ViewModel의 side effect → Screen이 소비 → `navigator.goTo(NavKeyXxx(...))`.
- 뒤로: `navigator.onBack()`. **빈 백스택 접근 가드 필수**(과거 크래시 이력) — `backStack.size <= 1`이면 no-op.
- feature 간 이동은 상대 `:impl`이 아니라 **`:api`의 NavKey만** 참조.

## 앱 진입 체인 (2026-08-09, PR #220)

시작 목적지는 `NavigatorConst.INITIAL_NAVIGATION_KEY = NavKeySplash`(`core:navigation`)다.
그 뒤 체인이 이 PR에서 처음 끝까지 이어졌다:

`NavKeySplash` → `NavKeyLogin` → `NavKeyTermAgree` → `NavKeyGroupList`

- 이전에는 로그인이 `NavKeyGroupHome`(`ResultEventBus` 시연용 임시 화면)으로 갔고, `NavKeyTermAgree`·
  `NavKeyGroupList`는 entry만 등록된 **도달 불가 화면**이었다. 체크리스트 6번의 사례가 하나 닫힌 것.
- **백스택 리셋 관용구**: 되돌아가면 안 되는 경계에서 `navigator.clearBackStack()` 직후
  `navigator.goTo(...)`를 부른다 — `SplashRoute`(→ 로그인), `TermAgreeRoute`(→ 그룹 목록) 2곳.
  `clearBackStack()`은 백스택을 비우기만 하므로 **반드시 같은 블록에서 `goTo`가 따라와야** 한다.
  결과적으로 그룹 목록에서는 백스택이 1개라 뒤로가기가 no-op이다.
- 의존 방향은 규약대로 `:api`만: `feature/login/impl` → `feature/intro/api`,
  `feature/intro/impl` → `feature/groups/list/api`.
- **화면 전이만 결선됐다** — 서버 인증(`/auth/login`·`/auth/signup`)·토큰 저장·약관 동의 저장은
  붙지 않았고 신규/기존 회원 분기도 없다 → [open-questions](../synthesis/open-questions.md) [2026-08-10].

## 신규 목적지 등록 체크리스트
1. `feature/xxx/api`에 `@Serializable NavKeyXxx : NavKey` 추가.
2. `feature/xxx/impl`에 `featureXxxEntryBuilder()` 작성: `entry<NavKeyXxx> { YGScaffold { innerPadding -> XxxRoute(modifier = Modifier.padding(innerPadding)) } }`. **엔트리(nav) 레벨 컨테이너는 `YGScaffold`**(`core:designsystem` `screen/`, Material3 `Scaffold` 래퍼, 기본 배경 흰색·`contentWindowInsets` 노출). 화면 최외곽 컨테이너 `YGScreen`과 역할 분리 → [design-system](design-system.md) "화면 컨테이너".
3. 빌더를 Hilt 모듈(`NavigationModule`, ActivityRetainedComponent)의 `Set<...>` 멀티바인딩에 `@IntoSet`으로 제공.
4. 이동 원하는 feature는 대상의 `:api`에 의존 추가(`settings.gradle.kts`/build 파일).
5. 결과가 필요하면 `ResultEventBus` 데코레이터 경로 사용.
   > ⚠️ **반환 경로를 없앨 땐 호출자의 `ResultEffect`도 같이 본다(2026-08-04, PR #191)** — 커스텀
   > 갤러리가 `sendResult` 대신 확인 화면으로 `goTo` 하도록 바뀌었는데, 호출 화면
   > `CanvasImageAddRoute`의 `ResultEffect<String>`는 그대로 남아 아무것도 받지 못한다
   > → [open-questions](../synthesis/open-questions.md) [2026-08-04].
6. **`goTo` 호출자를 같은 PR에 넣는다** — entry만 등록하고 진입 경로가 없으면 도달 불가 화면이 된다(선례: `NavKeyGroupCreate`, [open-questions](../synthesis/open-questions.md) [2026-07-29]).

> ⚠️ **이탈 사례(2026-08-01, PR #173)** — G-001 `featureGroupListEntryBuilder`는 엔트리 컨테이너를
> `YGScaffold`가 아니라 `Box`(전면 배경 이미지)로 두고 `YGScaffold`를 Route 안으로 내렸으며, 그룹 추가
> 오버레이를 **두 번째 `YGScaffold`**(Dim 배경)로 겹친다. 화면 최외곽 `YGScreen`도 쓰지 않는다.
> 배경 이미지·오버레이가 붙는 화면에서 위 2번 관용구가 부족했다는 신호다 →
> [g001-group-list 스펙](../specs/archive/2026-08-01-g001-group-list.md) · [open-questions](../synthesis/open-questions.md) [2026-08-01].

> ⚠️ **인셋 소유가 컴포넌트로 내려간 사례(2026-08-07, PR #194)** — G-001은 `YGTopBarEmpty`가
> `windowInsets`(기본 `WindowInsets.statusBars`)를 자기 패딩으로 흡수하고, 그만큼 엔트리
> `YGScaffold`가 `contentWindowInsets = systemBars.only(Horizontal + Bottom)`으로 상단을 뺀다.
> 둘 다 상단을 주면 인셋이 이중 적용된다. 이로써 develop에 인셋 관용구가 **3형태**(엔트리 `YGScaffold`
> 기본 / 화면이 직접 `windowInsetsPadding`(C-101) / 컴포넌트 흡수(G-001)) 공존한다 →
> [open-questions](../synthesis/open-questions.md) [2026-08-07].

> **의도적 예외(2026-08-01, PR #182)** — C-101 카메라 entry는 `YGScaffold`를 쓰되 **`innerPadding`을
> 화면에 먹이지 않는다**. 카메라 피드가 시스템 바 아래까지 덮어야 하고 인셋은 컨트롤 영역이
> `windowInsetsPadding`으로 직접 처리하기 때문이다(코드 주석에 근거 명시). 전체화면 카메라·미디어
> 화면의 관용구로 볼지는 위 이탈 사례와 함께 정리 대상 → [c101 스펙](../specs/archive/2026-08-01-c101-camera-picture-confirm.md).

## 인자 있는 목적지 (`data class NavKey`)

목적지가 값을 받으면 `data object`가 아니라 `@Serializable data class NavKeyXxx(val …)`로 정의한다
(`NavKeySegmentation`·`NavKeyCanvasEdit`·`NavKeyCanvasMove`·`NavKeyGroupCreate`·
`NavKeyPictureConfirm`).
**ViewModel이 없는 화면이면 엔트리 빌더가 `navKey.…` 값을 Route 파라미터로 그냥 넘긴다**
(`NavKeyPictureConfirm(uri, source)` → `PictureConfirmRoute(uri = …, source = …)`, #182·#191).
**여러 진입점이 한 화면을 공유하면 출처를 NavKey 인자(`@Serializable` enum)로 넘긴다** — 확인 화면은
카메라·갤러리 공용이고 `PictureConfirmSource`로 문구만 가른다(#191). 이때 호출하는 feature는 대상
feature의 `:api`만 참조한다(`feature/gallery/impl` → `feature/camera/api`).
그 값을 ViewModel 초기 상태로 넘길 때는 **Assisted 주입**을 쓴다 — `@HiltViewModel(assistedFactory = …)` + `@AssistedInject` +
`@Assisted` 파라미터, 엔트리 빌더에서 `hiltViewModel<VM, VM.Factory>(creationCallback = { it.create(navKey.…) })`로 생성해 Route에 넘긴다
(`GroupCreateViewModel`·`SegmentationViewModel`).
