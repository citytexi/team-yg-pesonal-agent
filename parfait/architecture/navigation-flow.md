---
id: navigation-flow
title: 내비게이션 흐름 (Navigation3 + Navigator)
category: architecture
status: living
platforms: android
verified: 2026-08-12
related_spec: designsystem-ygscreen-scaffold, a005-group-create, a004-group-invite-code, s102-group-nickname, g001-group-list, c101-camera-picture-confirm, c102-custom-gallery-picker, intro-term-agree, a002-login-onboarding, c001-canvas-main
related_adr: ADR-0002, ADR-0006
related_architecture:
related_code: core:navigation, Navigator
tags: [architecture, parfait]
---
# 내비게이션 흐름 (Navigation3 + Navigator)

Navigation3 위에 자체 Navigator·엔트리 빌더를 얹는다. 결정 근거는 [[0006-navigation3-custom-navigator]]·[[0002-feature-api-impl-split]].

> 근거는 파일명+심볼명으로만.

## 구성 요소
- **Navigator**(`core:navigation`, `@ActivityRetainedScoped`) — 백스택 = `SnapshotStateList<NavKey>`. `goTo()`, `goToSingleClearTop()`, `goToAndPopCurrent()`, `onBack()`, `clearBackStack()`.
  - `goToSingleClearTop(destination)`(#224 신설) — 대상이 백스택에 있으면 **그 위를 한 번에 잘라내(`removeRange`) 기존 엔트리를 재사용**하고, 없으면 `goTo`처럼 새로 쌓는다. 한 칸씩 빼면 스냅샷 변경이 그만큼 쌓이므로 범위 삭제로 처리한다. 엔트리 재사용이므로 대상 화면의 상태·ViewModel이 그대로 살아난다(돌아온 화면이 새로 조회하지 않는다).
  - `goToAndPopCurrent(destination)`(#221 신설) — 지금 화면을 대상으로 **치환**한다(마지막 칸에 덮어쓰기).
    백스택 깊이가 늘지 않고 뒤로 가면 지금 화면을 건너뛴다. 스택이 비어 있으면 그냥 쌓는다.
    확인·경유 화면처럼 되돌아올 이유가 없는 자리에 쓴다(첫 사용처: C-101-confirm → C-103).
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
- 📌 **체인 첫 화면이 실물이 됐다(2026-08-11, PR #218)** — A-002 로그인의 온보딩 자리가 placeholder
  박스에서 일러스트 3장으로 채워졌다. 전이·인증 구조는 그대로다(카카오 토큰은 여전히 `LoginState`
  안에서 끝난다) → [a002-login-onboarding 스펙](../specs/archive/2026-08-11-a002-login-onboarding.md).

## 그룹 생성·참여 플로우 (2026-08-12, PR #224)

그룹 목록에서 갈라진 두 갈래가 **목록으로 되돌아오며 닫혔다**. 이전에는 양쪽 끝이 stub이라 들어가면 나올 수 없었다.

```
NavKeyGroupList ─┬─ 생성 ─▶ NavKeyGroupCreate(nickName) ──(확인 모달)──┐
                 └─ 참여 ─▶ NavKeyGroupInviteCode ─(확인 모달)─▶ NavKeyGroupNickName ─┤
                                                                                       └─▶ NavKeyGroupList
```

- 복귀는 `clearBackStack()` + `goTo`가 아니라 **`goToSingleClearTop(NavKeyGroupList)`**다 —
  목록 엔트리가 백스택에 이미 있으므로 그 위만 걷어낸다. 목록에서 뒤로가기는 여전히 no-op이다(백스택 1개).
  즉 develop에 **백스택 리셋 관용구가 둘**이다: 되돌아갈 화면이 없는 경계는 `clearBackStack()`+`goTo`
  (Splash·TermAgree), 이미 스택에 있는 화면으로 복귀는 `goToSingleClearTop`(그룹 생성·참여)
  → [open-questions](../synthesis/open-questions.md) [2026-08-12].
- **확인 모달이 전이의 게이트**다 — 두 화면 다 확인 버튼이 곧바로 이동하지 않고 `YGModalPopup`을 띄우며,
  이동은 모달의 Primary 버튼에서 일어난다. 모달 표시 여부는 각 UiState의 `isConfirmPopupVisible`이다
  ([a005](../specs/archive/2026-07-29-a005-group-create.md)·[a004](../specs/archive/2026-08-12-a004-group-invite-code.md) 스펙).
- 의존은 규약대로 `:api`만: `feature/groups/enter/impl` → `feature/groups/list/api`(#224에서 추가).
- ⚠️ **위키 정본과 목적지가 다르다** — [[기능정의서-v6]]은 A-004(참여)·A-005(생성) 다음 단계를
  **C-001(메인 캔버스)**로 적는데(중간 화면 G-002 삭제 후 재배선) 코드는 그룹 목록으로 돌아온다
  → [open-questions](../synthesis/open-questions.md) [2026-08-12].
- ⚠️ **되돌아온 목록이 갱신되지 않는다** — 엔트리 재사용이라 `GroupListViewModel`이 살아 있고, 애초에
  조회 경로가 없어 mock 4건 고정이다. 생성·참여 UseCase도 mock이라 새 그룹이 목록에 나타날 자리가 없다.

## 토핑 생성 플로우 (2026-08-14, PR #221)

촬영·갤러리에서 시작해 캔버스 배치 직전까지가 이어졌다. 상세는
[c103 스펙](../specs/archive/2026-08-15-c103-segmentation-topping-edit.md).

```
NavKeyCameraCustom ─┐
                    ├─▶ NavKeyPictureConfirm(uri, source) ══▶ NavKeySegmentation(sourceImageUri)
NavKeyGalleryPicker ┘        (goToAndPopCurrent — 확인 화면은 걷힌다)          │
                                                                              ▼
                                             NavKeySegmentationConfirm(sourceImageUri, subjectImagePath)
                                                    │  ▲ ToppingEditResult(ResultEventBus)  │
                                                    ▼  │                                    ▼
                                    NavKeyToppingEdit(source, segmentation, borderLayers)   NavKeyCanvasMove(imageUri)
```

- 확인 화면(C-101-confirm) → C-103은 **`goToAndPopCurrent`**다. 확인 화면이 걷히므로 세그멘테이션에서
  뒤로 가면 촬영/갤러리로 바로 돌아간다.
- C-103 안의 두 화면(`Segmentation` → `SegmentationConfirm`)은 평범한 `goTo`다 — 뒤로 가면 인식이
  끝난 화면으로 돌아온다(재추출하지 않는다).
- **편집 결과는 `ResultEventBus` 왕복이다** — `NavKeyToppingEdit`는 `@Serializable` NavKey라
  *들어갈 때의 인자*만 담고, 나올 때는 `sendResult(TOPPING_EDIT_RESULT_KEY, ToppingEditResult)` +
  `onBack()`으로 돌려준다. 확인 화면이 `ResultEffect<ToppingEditResult>`로 받아 `rememberSaveable`에 쌓는다.
  **데코레이터 존치 여부를 묻던 항목이 실사용 소비처를 되찾았다** →
  [open-questions](../synthesis/open-questions.md) [2026-08-10].
- 재편집을 위해 확인 화면이 **최종본과 "테두리 전 알맹이"를 따로** 들고 있다가 알맹이 쪽을 마스크로
  넘긴다. 최종본을 넘기면 테두리 색이 원본 픽셀로 덮여 사라진다.
- ⚠️ **플로우를 나가는 경로가 없다** — 세 화면 + C-101-confirm의 `onClickClose`가 전부 빈 람다다.
  뒤로가기 말고는 출구가 없다 → [open-questions](../synthesis/open-questions.md) [2026-08-15].
- 엔트리 3개는 규약 기본형(`YGScaffold { innerPadding -> …padding(innerPadding) }`)이고
  빌더 하나(`featureSegmentationEntryBuilder`)가 세 entry를 등록한다.

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
   > 📌 **반대로 되살아난 사례(2026-08-14, PR #221)** — 토핑 편집 화면이 `sendResult` +
   > `ResultEffect` 왕복으로 결과를 돌려준다. NavKey가 담지 못하는 **나올 때의 값**을 넘겨야 해서
   > 이 관용구를 다시 골랐다. 즉 "전진하며 `goTo`"와 "결과 반환"이 develop에 공존한다.
6. **`goTo` 호출자를 같은 PR에 넣는다** — entry만 등록하고 진입 경로가 없으면 도달 불가 화면이 된다
   (선례: `NavKeyGroupCreate` — 등록 후 **약 2주 뒤**인 #222에서야 G-001 그룹 추가 오버레이가 호출자가 됐다,
   [open-questions](../synthesis/open-questions.md) [2026-07-29]).
   > 📌 **사례가 하나 더(2026-08-11, PR #199)** — C-001 캔버스 메인이 실물화됐지만 `NavKeyCanvasImageAdd`를
   > `goTo` 하는 호출자가 develop에 0건이다. 유일한 후보인 G-001 `GroupListSideEffect.NavigateToCanvas`
   > 분기는 여전히 `// Todo`다. 화면을 채우는 PR과 진입을 여는 PR이 갈리면 **완성된 화면이 도달 불가로
   > 머지**된다 → [c001-canvas-main 스펙](../specs/archive/2026-08-12-c001-canvas-main.md) ·
   > [open-questions](../synthesis/open-questions.md) [2026-08-12].

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
> 📌 **형태 선택이 화면 정책을 깎은 사례(2026-08-11, PR #199)** — C-001은 ①(엔트리 `YGScaffold` 기본)을
> 골랐는데, 화면 배경 점 격자를 `innerPadding` 안쪽 `Column`에 걸어 위키 [[캔버스-반응형-레이아웃]]이
> 요구하는 "상단바·하단바 포함 화면 전체 뒤"를 못 지킨다. `YGTopBarCanvas`에는 `windowInsets`가 없어
> G-001 관용구를 그대로 쓸 수도 없다 → [c001-canvas-main 스펙](../specs/archive/2026-08-12-c001-canvas-main.md).
> 📌 **4형태째 — 엔트리가 인셋을 소비하는 관용구(2026-08-13, PR #223)** — S-101 그룹 설정은 ①(엔트리
> `YGScaffold` 기본)을 쓰되 `padding(innerPadding)` **뒤에 `consumeWindowInsets(innerPadding)`을 얹는다**.
> 화면 하단 확인 버튼이 `imePadding()`을 쓰는데, 소비하지 않으면 그 `imePadding()`이 창 바닥 기준
> IME 인셋(키보드 + 내비게이션 바)을 통째로 다시 적용해 버튼이 내비게이션 바 높이만큼 떠오른다
> (실기기에서 드러났다). **엔트리가 `innerPadding`을 주고 하위가 `imePadding()`·`navigationBarsPadding()`
> 계열을 쓰는 화면은 소비가 필수**라는 뜻이고, 저장소에서 이 규약을 지키는 곳은 아직 여기뿐이다 —
> `feature/groups/enter/impl`의 세 entry는 `contentWindowInsets = WindowInsets(0.dp)`로 인셋을 끄고
> `statusBarsPadding()` + `navigationBarsAndImePadding()`을 직접 붙이는 **또 다른 형태**이며, 그중
> `GroupInviteCodeRoute`는 거기에 `imePadding()`을 한 번 더 얹어 IME가 이중 적용된다
> → [open-questions](../synthesis/open-questions.md) [2026-08-07]·[2026-08-13].
>
> 📌 **이중 적용은 걷혔다(2026-08-14, PR #237)** — `GroupInviteCodeRoute`의 `imePadding()`이 제거되고
> entry 단독으로 정리됐다. 같은 PR이 매니페스트에 **`android:windowSoftInputMode="adjustResize"`**를
> 붙였는데, `MainActivity` 단일 액티비티라 **앱 전 화면에 걸리는 변경**이다(창이 줄어드는 방식이 바뀌므로
> 다른 입력 화면의 인셋 체감도 함께 달라진다 — 실기기 확인 기록은 없다).

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
**인자 값의 출처는 호출 화면의 상태다** — G-001이 `goTo(NavKeyGroupCreate(nickName = uiState.nickName))`로
A-005를 연다(#222). 현재 그 `nickName`은 `GroupListUiState` 기본값 mock이라, 인자 결선과 값의 진위는
별개 문제로 남아 있다 → [open-questions](../synthesis/open-questions.md) [2026-08-07].
그 값을 ViewModel 초기 상태로 넘길 때는 **Assisted 주입**을 쓴다 — `@HiltViewModel(assistedFactory = …)` + `@AssistedInject` +
`@Assisted` 파라미터, 엔트리 빌더에서 `hiltViewModel<VM, VM.Factory>(creationCallback = { it.create(navKey.…) })`로 생성해 Route에 넘긴다
(`GroupCreateViewModel`·`SegmentationViewModel`).
