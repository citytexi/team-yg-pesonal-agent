---
id: navigation-flow
title: 내비게이션 흐름 (Navigation3 + Navigator)
category: architecture
status: living
platforms: android
verified: 2026-08-18
related_spec: designsystem-ygscreen-scaffold, a005-group-create, a004-group-invite-code, s102-group-nickname, g001-group-list, c101-camera-picture-confirm, c102-custom-gallery-picker, intro-term-agree, a002-login-onboarding, c001-canvas-main, a002-kakao-login-api, c301-canvas-background-edit, session-token-refresh-infra, c201-canvas-calendar, user-info-ssot, c301-topping-edit-tab, ygscaffold-v2-common-loading-error, s101-group-setting-api
related_adr: ADR-0002, ADR-0006, ADR-0021, ADR-0022
related_architecture:
related_code: core:navigation, Navigator
tags: [architecture, parfait]
---
# 내비게이션 흐름 (Navigation3 + Navigator)

Navigation3 위에 자체 Navigator·엔트리 빌더를 얹는다. 결정 근거는 [[0006-navigation3-custom-navigator]]·[[0002-feature-api-impl-split]].

> 근거는 파일명+심볼명으로만.

## 구성 요소
- **Navigator**(`core:navigation`, `@ActivityRetainedScoped`) — 백스택 = `SnapshotStateList<NavKey>`. `goTo()`, `goToSingleClearTop()`, `goToAndPopCurrent()`, `replaceAll()`, `popUpTo()`, `onBack()`.
  - `replaceAll(destination)`(#260 신설, **`clearBackStack()` 대체**) — 백스택을 비우고 목적지 하나만
    남긴다. 비우기와 채우기를 나눠 노출하면 그 사이에 **빈 백스택**이 생기고 채우는 것은 호출부의
    규약일 뿐이라, 빈 상태를 만들 수 있는 API 자체를 없앴다(빈 백스택은 `onBack`이 이미 방어하고 있는
    크래시 원인이다). `clearBackStack()`은 제거됐고 기존 호출부 3곳(`SplashRoute`·`TermAgreeRoute`·
    `LoginRoute`)이 함께 옮겨졌다. `NavigatorTest`가 이 성질을 잠근다 — 저장소에서 `Navigator`에
    테스트가 붙은 것도 이번이 처음이다.
  - `goToSingleClearTop(destination)`(#224 신설) — 대상이 백스택에 있으면 **그 위를 한 번에 잘라내(`removeRange`) 기존 엔트리를 재사용**하고, 없으면 `goTo`처럼 새로 쌓는다. 한 칸씩 빼면 스냅샷 변경이 그만큼 쌓이므로 범위 삭제로 처리한다. 엔트리 재사용이므로 대상 화면의 상태·ViewModel이 그대로 살아난다(`init` 조회는 다시 돌지 않는다 — 돌아온 화면이 다시 조회하려면 화면 쪽에 `Enter` 인텐트가 있어야 하고, G-001·C-001이 #297에서 그것을 갖췄다 → [state-management](state-management.md)).
  - `goToAndPopCurrent(destination)`(#221 신설) — 지금 화면을 대상으로 **치환**한다(마지막 칸에 덮어쓰기).
    백스택 깊이가 늘지 않고 뒤로 가면 지금 화면을 건너뛴다. 스택이 비어 있으면 그냥 쌓는다.
    확인·경유 화면처럼 되돌아올 이유가 없는 자리에 쓴다(첫 사용처: C-101-confirm → C-103).
  - `popUpTo<T>()` / `popUpTo(type: KClass<out NavKey>)`(`Navigator.kt#popUpTo`, 세그멘테이션 라운드
    신설, 2026-08-18) — 백스택에서 `T` 타입 키를 뒤에서부터 찾아 있으면 그 위를 전부 걷어내고
    `true`를, 없으면 아무것도 하지 않고 `false`를 준다. **`goToSingleClearTop` 대신 이것을 쓰는 경우는
    호출부가 목적지 키의 인자를 모를 때다** — `goToSingleClearTop`은 키 동등성 비교라 `NavKeyCanvasMain`의
    `groupId`를 알아야 하는데, 카메라·세그멘테이션 쪽 닫기 콜백은 그 값을 들고 있지 않다. NavKey 다섯
    개에 `groupId`를 실어 나르는 대안은 배경 편집처럼 그 값이 무의미한 경로에도 인자를 붙이게 돼
    기각했다. reified 버전은 호출부 편의이고 `KClass` 버전이 실제 구현·테스트 대상이다. 첫
    소비처는 `PictureConfirmRoute`(`returnResultOnly = false`)·`SegmentationRoute`·
    `SegmentationConfirmRoute`의 닫기 → `popUpTo<NavKeyCanvasMain>()`
    ([segmentation-pipeline-hardening 스펙](../specs/2026-08-18-segmentation-pipeline-hardening.md)).
- **NavKey**(각 feature `:api`, `@Serializable`) — 목적지 식별. 예: `NavKeyLogin`, `NavKeySegmentation`, `NavKeyCameraCustom`. groups·app 계열은 목적지가 많다: `NavKeyGroupList`·`NavKeyGroupSetting`·`NavKeyGroupInviteCode`, canvas의 `NavKeyCanvasEdit`·`NavKeyCanvasMain`·`NavKeyCanvasImageSelect`·`NavKeyCanvasMove`(#290 이후 도달 불가)·`NavKeyCanvasBGEdit`(#231)·`NavKeyCanvasToppingPlace`(#290), `NavKeyAppSetting` 등. 전체 목록은 `feature/*/api`에서 확인(모듈 목록은 [module-structure](module-structure.md)).
- **엔트리 빌더**(각 feature `:impl`) — `entry<NavKeyXxx> { ... }`를 등록하는 함수(예: `featureLoginEntryBuilder()`). Hilt 멀티바인딩 `Set<EntryProviderScope<NavKey>.(Navigator) -> Unit>`로 주입. **빌더 하나가 여러 entry를 등록할 수 있다** — 예: `featureCanvasEntryBuilder()`는 canvas NavKey(`ImageAdd`·`BGEdit`·`Edit`·`ImageSelect`·`Move`) entry를 한 함수에서 등록.
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

> 📌 **첫 화면이 갈림길이 됐다(2026-08-16, PR #263)** — 스플래시가 더는 무조건 로그인으로 가지 않는다.
> `BootstrapSessionUseCase`가 저장된 refresh token 유무를 보고, 있으면 `users/me`로 세션을 검증하면서
> 계정 정보 SSoT를 채운 뒤 **`NavKeySplash` → `NavKeyGroupList`**로 바로 넘긴다. 목적지 판단은 전부
> 도메인이 하고(`SessionBootstrap.ToGroupList`/`ToLogin`) 화면은 그것을 이펙트로 옮기기만 한다 —
> 스플래시가 "토큰이 있나", "조회가 됐나"를 알지 않는다. 실패는 종류와 무관하게 `ToLogin`이고
> 갈리는 것은 정리 범위뿐이다(인증 거절만 세션 파기) →
> [user-info-ssot 스펙](../specs/archive/2026-08-15-user-info-ssot.md).
> ⚠️ **네트워크 실패도 로그인 화면으로 보낸다** — 오프라인에서 앱을 켜면 토큰이 남아 있어도 로그인
> 화면이다(그룹 목록을 캐시로 그릴 수단이 아직 없다) → [open-questions](../synthesis/open-questions.md).
> 📌 **떠나는 시점에 조건이 하나 더 붙었다(2026-08-18, PR #305)** — 스플래시가 로띠를 재생하게 되면서
> **부트스트랩 응답과 애니메이션 종료가 모두 끝나야** 이동 이펙트가 나간다. 둘은 서로를 기다리지 않고
> 각자 끝나므로 순서가 정해져 있지 않고, `SplashState(destination, isAnimationFinished)`에 각각 남겨
> 나중에 끝난 쪽이 이동을 일으킨다. 화면은 "다음이 어디인가"를 여전히 모르고 **"내 애니메이션이
> 끝났다"만 인텐트로 올린다**(`SplashIntent.AnimationFinished`). 같은 신호가 두 번 와도 첫 번만
> 받아들인다 — 컴포지션이 다시 서면 백스택을 두 번 갈아 끼우게 된다. 로띠 **파싱 실패도 '끝'으로
> 넘긴다**(그 신호가 없으면 스플래시를 벗어날 방법이 아예 없다). 대기 상한이 없고 실기기 확인도
> 없다 → [open-questions](../synthesis/open-questions.md).

- 이전에는 로그인이 `NavKeyGroupHome`(`ResultEventBus` 시연용 임시 화면)으로 갔고, `NavKeyTermAgree`·
  `NavKeyGroupList`는 entry만 등록된 **도달 불가 화면**이었다. 체크리스트 6번의 사례가 하나 닫힌 것.
- **백스택 리셋 관용구**: 되돌아가면 안 되는 경계에서 **`navigator.replaceAll(...)`** 한 줄을 부른다 —
  `SplashRoute`(→ 로그인 **또는 그룹 목록**), `TermAgreeRoute`(→ 그룹 목록),
  `LoginRoute`(기존 회원 → 그룹 목록) 3곳.
  결과적으로 그룹 목록에서는 백스택이 1개라 뒤로가기가 no-op이다.
  > 🔁 **2026-08-15(PR #260)** — 그전까지는 `clearBackStack()` + `goTo(...)` 두 줄이었고 "반드시 같은
  > 블록에서 `goTo`가 따라와야 한다"가 암묵 규약이었다. 그 규약을 타입에서 지우려고 두 함수를
  > `replaceAll`로 합치고 `clearBackStack()`을 제거했다 → [open-questions](../synthesis/open-questions.md) [2026-08-12].
  > 📌 **네 번째 자리가 생겼다(2026-08-17, PR #287)** — S-101 그룹 나가기·신고 성공 시
  > `replaceAll(NavKeyGroupList)`다. 앞의 셋과 달리 **되돌아갈 화면이 없어서가 아니라 되돌아가면
  > 전부 403이라서**다 — 백스택에 쌓인 화면이 방금 떠난 그룹의 것이고, 그 그룹의 상세·닉네임 변경·
  > 신고는 나간 뒤 `GROUP_NOT_JOINED`로 떨어진다. 부수 효과로 목록이 새 엔트리라 다시 조회된다.
- 의존 방향은 규약대로 `:api`만: `feature/login/impl` → `feature/intro/api`,
  `feature/intro/impl` → `feature/groups/list/api`.
- ~~**화면 전이만 결선됐다**~~ → ✅ **데이터까지 이어졌다(2026-08-15, PR #241·#242)**. 로그인이
  카카오 `idToken`으로 서버 인증을 하고 `isNewUser`로 갈라(기존 회원은 목록, 신규는 약관) 약관 화면이
  `POST /auth/signup`으로 동의를 보내고 **세션을 저장한 뒤** 목록으로 넘어간다. 즉 이 체인의 세 구멍
  (인증·회원 분기·동의 저장)이 닫혔다 → [open-questions](../synthesis/open-questions.md) [2026-08-10].
  **기존 회원은 약관 화면을 거치지 않으므로 백스택 리셋 지점이 두 곳**이다 — `LoginRoute`가 기존 회원이면
  `replaceAll(NavKeyGroupList)`, 신규면 리셋 없이 `goTo(NavKeyTermAgree(registrationToken))`이라
  약관 화면에서 뒤로 가면 로그인으로 돌아간다. 리셋은 그 뒤 `TermAgreeRoute`가 한다.
- 📌 **체인 첫 화면이 실물이 됐다(2026-08-11, PR #218)** — A-002 로그인의 온보딩 자리가 placeholder
  박스에서 일러스트 3장으로 채워졌다. 전이·인증 구조는 그대로다(카카오 토큰은 여전히 `LoginState`
  안에서 끝난다) → [a002-login-onboarding 스펙](../specs/archive/2026-08-11-a002-login-onboarding.md).

## 세션 종료 이동 (2026-08-15, PR #260)

화면이 아니라 **네트워크 계층이 이동을 일으키는 첫 경로**다. 상세는
[session-token-refresh-infra 스펙](../specs/archive/2026-08-15-session-token-refresh-infra.md).

```
TokenAuthenticator(재발급 거절) → SessionEventBus.postForcedLogout()
    → MainRoute의 LaunchedEffect 단일 수집 → navigator.replaceAll(NavKeyLogin)
```

- **수집 지점은 앱 루트 `MainRoute` 한 곳**이다(`NavDisplay` 상위 `LaunchedEffect`). 화면마다 구독하면
  한 이벤트로 이동이 여러 번 일어난다. `SessionEventSource`는 `MainActivity`가 주입받아 내려준다.
- 통로는 `Channel(CONFLATED)`이라 **단일 소비자**이고, 401이 여러 건 터져도 이동은 한 번이다. 이
  성질이 규약이 아니라 타입에서 나온다는 점이 화면 이펙트(`BaseViewModel`)와 같다([ADR-0020](../adr/0020-mvi-error-effect-infrastructure.md)).
- 사용자가 직접 누르는 로그아웃은 같은 목적지를 화면 이펙트로 간다 — S-001 앱 설정의
  `AppSettingSideEffect.NavigateToLogin` → `replaceAll(NavKeyLogin)`. 즉 **같은 이동에 진입점이 둘**이고
  둘 다 백스택을 비운다.
- ⚠️ **수집 지점이 하나라는 것은 규약일 뿐 기계 검사가 없다** → [open-questions](../synthesis/open-questions.md) [2026-08-16].

## 그룹 생성·참여 플로우 (2026-08-12, PR #224)

그룹 목록에서 갈라진 두 갈래가 **목록으로 되돌아오며 닫혔다**. 이전에는 양쪽 끝이 stub이라 들어가면 나올 수 없었다.

```
NavKeyGroupList ─┬─ 생성 ─▶ NavKeyGroupCreate(nickName) ──(확인 모달 = POST 생성)──┐
                 └─ 참여 ─▶ NavKeyGroupInviteCode ─(GET 미리보기)─▶ NavKeyGroupNickName(inviteCode, groupName) ─(확인 모달 = POST 참여 + PATCH 닉네임)─┤
                                                                                                                                                        └─▶ NavKeyGroupList
```

> 📌 **실서버 결선(2026-08-15, PR #243·#244)** — 두 갈래의 mock UseCase가 전부 걷혔다. 그때는 **합류 시점이
> 앞당겨져** A-004 확인 모달이 `POST /api/parfait-groups/join`으로 합류하고 그 `groupId`를 다음 화면에 넘겼다.
> 🔁 **되돌아왔다(2026-08-16, PR #261)** — 확인 모달이 통째로 S-102로 옮겨가 **참여와 닉네임 적용이 한 확인
> 뒤에 연달아** 일어난다. A-004는 미리보기까지만 하고 **초대코드·그룹명**을 NavKey 인자로 넘기므로,
> 닉네임 화면에서 이탈하면 참여 자체가 없다(OQ-P-166 해소). 참여 성공 뒤 닉네임 PATCH가 실패해도 흐름은
> 멈추지 않는다 — 전역 닉네임을 쓴 채 목록으로 간다.

- 복귀는 `clearBackStack()` + `goTo`가 아니라 **`goToSingleClearTop(NavKeyGroupList)`**다 —
  목록 엔트리가 백스택에 이미 있으므로 그 위만 걷어낸다. 목록에서 뒤로가기는 여전히 no-op이다(백스택 1개).
  📌 **새 그룹이 바로 보이는 것은 이 관용구가 아니라 목록 화면이 다시 묻기 때문이다**(#297) — 엔트리
  재사용은 그대로 두고 `GroupListIntent.Enter`가 재조회한다(OQ-P-169 해소).
  즉 develop에 **백스택 리셋 관용구가 둘**이다: 되돌아갈 화면이 없는 경계는 `replaceAll`
  (Splash·TermAgree·Login·강제 로그아웃), 이미 스택에 있는 화면으로 복귀는 `goToSingleClearTop`
  (그룹 생성·참여) → [open-questions](../synthesis/open-questions.md) [2026-08-12].
- **확인 모달이 전이의 게이트**다 — 각 갈래의 **마지막 입력 화면**(생성은 A-005, 참여는 S-102)에서 확인 버튼이
  곧바로 이동하지 않고 `YGModalPopup`을 띄우며, 서버 요청과 이동은 모달의 Primary 버튼에서 일어난다.
  모달 표시 여부는 각 UiState의 `isConfirmPopupVisible`이다
  ([a005](../specs/archive/2026-07-29-a005-group-create.md)·[s102](../specs/archive/2026-07-22-s102-group-nickname.md) 스펙).
  🔁 **#261 전에는 참여 갈래의 모달이 A-004에 있었다** — 중간 화면이 게이트를 쥐면서 이후 화면 이탈이
  참여를 되돌리지 못했기 때문에 마지막 화면으로 내려왔다.
- 의존은 규약대로 `:api`만: `feature/groups/enter/impl` → `feature/groups/list/api`(#224에서 추가).
- ⚠️ **위키 정본과 목적지가 다르다** — [[기능정의서-v6]]은 A-004(참여)·A-005(생성) 다음 단계를
  **C-001(메인 캔버스)**로 적는데(중간 화면 G-002 삭제 후 재배선) 코드는 그룹 목록으로 돌아온다
  → [open-questions](../synthesis/open-questions.md) [2026-08-12].
- ⚠️ **되돌아온 목록이 갱신되지 않는다** — 엔트리 재사용이라 `GroupListViewModel`이 살아 있고 조회는
  `init`과 pull-to-refresh에만 걸려 있다. 목록 조회가 붙은 뒤(#248)에도 **생성·참여 직후 새 그룹이 바로
  보이지 않고 당겨야 나타난다** → [open-questions](../synthesis/open-questions.md) [2026-08-15].

## 토핑 생성 플로우 (2026-08-14, PR #221)

촬영·갤러리에서 시작해 캔버스 배치 직전까지가 이어졌다. 상세는
[c103 스펙](../specs/archive/2026-08-15-c103-segmentation-topping-edit.md).

```
NavKeyCameraCustom ─┐
                    ├─▶ NavKeyPictureConfirm(uri, source) ══▶ NavKeySegmentation(sourceImageUri)
NavKeyGalleryPicker ┘        (goToAndPopCurrent — 확인 화면은 걷힌다)          │
                                                                              ▼
                          NavKeySegmentationConfirm(sourceImageUri, subjectImagePath, trimmedSubjectImagePath)
                                                    │  ▲ ToppingEditResult(ResultEventBus)  │
                                                    ▼  │                                    ▼
                                    NavKeyToppingEdit(source, segmentation, borderLayers)   NavKeyCanvasToppingPlace(imageUri)
                                                                                             │ goTo(NavKeyCanvasMain(groupId = 0L))
                                                                                             ▼
                                                                                        C-001 캔버스 (⚠️ 아래 참고)
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

> 📌 **마지막 목적지가 실물로 바뀌었다(2026-08-19, PR #290)** — 확인 화면의 "다음"이 자리채움이던
> `NavKeyCanvasMove`를 버리고 **`NavKeyCanvasToppingPlace(imageUri)`**로 간다. 넘기는 값도 파일
> 경로가 아니라 `File(...).toUri()`로 감싼 `file` 스킴 uri이고(배치 화면이 Coil로 읽는다), 그 대상은
> 여백을 걷어낸 **트리밍본**이다(확인 화면이 `key.trimmedSubjectImagePath`로 초기화한다) →
> [c106-topping-place 스펙](../specs/archive/2026-08-19-c106-topping-place.md).
>
> ⚠️ **끝이 아직 흐름을 닫지 못한다.** 배치 확정은 서버로 가지 않고 이펙트만 쏘며, Route가
> **`goTo(NavKeyCanvasMain(groupId = 0L))`**로 이동한다 — 그룹 id가 하드코딩(NavKey가 `imageUri`만
> 싣는다)이고 `goTo`라 촬영·세그멘테이션·편집 화면이 **백스택에 그대로 쌓인다**. `popUpTo<T>()`가
> 필요한 자리인데 그 확장은 아직 develop에 없다(미머지 `refactor/segmentation-develop`) →
> [open-questions](../synthesis/open-questions.md) OQ-P-238.
>
> ⚠️ **`NavKeyCanvasMove`·`CanvasMoveRoute`·`CanvasMoveScreen`은 호출자를 잃은 채 남았다** — 엔트리도
> 등록돼 있어 컴파일은 되지만 도달할 수 없다 → OQ-P-239.

## 캔버스 배경 편집 플로우 (2026-08-15, PR #231)

C-001 캔버스 메인의 편집 버튼이 C-301 배경 편집(`NavKeyCanvasBGEdit`)으로 결선되고, 그 화면이
**촬영·갤러리·확인 세 화면을 토핑 생성 플로우와 공유**한다. 상세는
[c301 스펙](../specs/archive/2026-08-15-c301-canvas-background-edit.md).

```
NavKeyCanvasMain ─▶ NavKeyCanvasBGEdit ─┬─▶ NavKeyCameraCustom(showGuideToast=false, returnResultOnly=true) ─┐
                                            └─▶ NavKeyCustomGalleryPicker(동일 인자) ───────────────────────────┤
                                                                                                                 ▼
                                                        NavKeyPictureConfirm(uri, source, returnResultOnly=true)
                                                             │ sendResult(PictureConfirmResult) + onBack ×2
                                                             ▼
                                                        NavKeyCanvasBGEdit (ResultEffect<PictureConfirmResult>)
```

- **분기의 주체가 NavKey 인자다** — 같은 확인 화면이 `returnResultOnly`가 false면 종전대로
  `goToAndPopCurrent(NavKeySegmentation)`으로 전진하고, true면 결과를 돌려주고 물러난다.
  `showGuideToast`도 같은 부류로, 카메라·갤러리 가이드 토스트를 토핑 생성 경로에서만 띄운다.
  즉 **화면이 그릴 값이 아니라 호출자가 고르는 동작 플래그가 백스택 키에 실린 첫 사례**다.
- **복귀가 `onBack()` 2회 하드코딩**이다(확인 화면 → 카메라/갤러리). 스택 깊이를 가정하므로 중간에
  화면이 하나 끼면 어긋난다 — `goToSingleClearTop`·`goToAndPopCurrent` 같은 명시적 관용구를 쓰지 않았다.
- 카메라 실패·취소 경로는 여전히 `sendResult(uri: String?)`라 `ResultEffect<PictureConfirmResult>`인
  배경 편집 화면은 **실패를 받지 못한다**(C-001의 死 `ResultEffect`와 같은 부류)
  → [open-questions](../synthesis/open-questions.md) [2026-08-15].
- ~~⚠️ **플로우 전체가 도달 불가다**~~ → ✅ **닫혔다(2026-08-17, PR #268)**. G-001 그룹 카드의 토핑
  클릭이 `goTo(NavKeyCanvasMain(groupId))`로 이어져 진입 화면 C-001에 호출자가 생겼고, 이 플로우
  전체가 함께 도달 가능해졌다
  → [c001-canvas-today-detail 스펙](../specs/archive/2026-08-17-c001-canvas-today-detail.md).

### 토핑 테두리 재편집 왕복 (2026-08-16, PR #264)

같은 화면의 **토핑 탭**이 편집 화면을 한 번 더 재사용한다. 상세는
[c301-topping-edit-tab 스펙](../specs/archive/2026-08-16-c301-topping-edit-tab.md).

```
NavKeyCanvasBGEdit ─(선택된 토핑의 편집 버튼)─▶ NavKeyToppingEdit(source, segmentation, borderLayers, borderOnly = true)
        ▲                                                          │ sendResult(TOPPING_EDIT_RESULT_KEY, ToppingEditResult) + onBack
        └──────────────────────────────────────────────────────────┘
```

- **`NavKeyToppingEdit`의 세 번째 호출자**이자, 그 목적지를 **모드로 가른 첫 사례**다 —
  `borderOnly = true`면 영역 탭 없이 테두리 편집만 열린다. `returnResultOnly`(#231)와 같은 부류의
  동작 플래그가 백스택 키에 하나 더 늘었다 → [open-questions](../synthesis/open-questions.md) [2026-08-15].
- 결과는 종전대로 `ResultEventBus` 왕복이지만, **받는 쪽이 어느 토핑인지 알아야 한다.**
  그 id를 ViewModel이 아니라 Route의 `rememberSaveable`(`editingToppingId`)이 들고 있다가
  인텐트에 실어 준다 → [open-questions](../synthesis/open-questions.md) [2026-08-16].
- 복귀는 편집 화면의 `onBack()` 1회다(배경 이미지 왕복의 `onBack()` 2회와 달리 스택 깊이 가정이 없다).

## 그룹 설정 진입·이탈 (2026-08-17, PR #285·#287)

상세는 [s101-group-setting-api 스펙](../specs/archive/2026-08-17-s101-group-setting-api.md).

```
NavKeyCanvasMain(groupId) ─(상단 메뉴)─▶ NavKeyGroupSetting(groupId)
                                             │ 나가기·신고 성공
                                             ▼
                                        replaceAll(NavKeyGroupList)
```

- **도달 불가가 닫혔다** — `NavKeyGroupSetting`이 `data object` → `data class(groupId)`가 되고
  C-001이 호출자가 됐다(OQ-P-138). 인자 출처는 C-001이 Assisted로 들고 있던 `groupId`라
  **화면 상태가 그대로 다음 목적지의 인자**다. 체크리스트 6번(호출자 없이 머지된 목적지) 사례가
  또 하나 닫혔고, 도달 불가 기간은 약 4일이었다.
- 나가기·신고의 이탈은 `onBack()`이 아니라 `replaceAll`이다 — 위 "백스택 리셋 관용구" 참고.
- `feature/groups/canvas/impl` → `feature/groups/setting/api`, `feature/groups/setting/impl` →
  `feature/groups/list/api`. 둘 다 규약대로 `:api`만 본다.

## 신규 목적지 등록 체크리스트
1. `feature/xxx/api`에 `@Serializable NavKeyXxx : NavKey` 추가.
2. `feature/xxx/impl`에 `featureXxxEntryBuilder()` 작성: `entry<NavKeyXxx> { XxxRoute(navigator = navigator, modifier = Modifier.fillMaxSize()) }`.
   > 🔁 **정본 변경 (2026-08-16, PR #267 develop 머지)** — **엔트리는 더 이상 스캐폴드를 감싸지 않는다.** 스캐폴드는
   > `YGScaffoldV2`이고 **Route가 소유**한다 — `hiltViewModel()`이 Route 안에 있어 EntryBuilder는
   > `isLoading`도 실패 이펙트도 볼 수 없기 때문이다. 아래 인셋 관용구 논의는 구 형태(엔트리
   > `YGScaffold`) 기준의 역사이고, 인셋은 이제 Route의 `YGScaffoldV2(contentWindowInsets = …)`가 정한다.
   > 규약 본문 → [design-system](design-system.md) "화면 컨테이너", 설계 →
   > [ygscaffold-v2 스펙](../specs/archive/2026-08-16-ygscaffold-v2-common-loading-error.md).

   (구 형태) `entry<NavKeyXxx> { YGScaffold { innerPadding -> XxxRoute(modifier = Modifier.padding(innerPadding)) } }`. 화면 최외곽 컨테이너 `YGScreen`과의 역할 분리는 그대로 → [design-system](design-system.md) "화면 컨테이너".
   **develop에는 두 형태가 공존한다** — 신형은 `featureAppSettingEntryBuilder`·`featureLoginEntryBuilder`·
   `featureGroupSettingEntryBuilder`(#285) 4화면, 구 형태가 **7파일** 남았다
   → [open-questions](../synthesis/open-questions.md) [2026-08-17] OQ-P-204.
3. 빌더를 Hilt 모듈(`NavigationModule`, ActivityRetainedComponent)의 `Set<...>` 멀티바인딩에 `@IntoSet`으로 제공.
4. 이동 원하는 feature는 대상의 `:api`에 의존 추가(`settings.gradle.kts`/build 파일).
5. 결과가 필요하면 `ResultEventBus` 데코레이터 경로 사용.
   > ⚠️ **반환 경로를 없앨 땐 호출자의 `ResultEffect`도 같이 본다(2026-08-04, PR #191)** — 커스텀
   > 갤러리가 `sendResult` 대신 확인 화면으로 `goTo` 하도록 바뀌었는데, 호출 화면
   > `CanvasMainRoute`의 `ResultEffect<String>`는 그대로 남아 아무것도 받지 못한다
   > → [open-questions](../synthesis/open-questions.md) [2026-08-04].
   > 📌 **반대로 되살아난 사례(2026-08-14, PR #221)** — 토핑 편집 화면이 `sendResult` +
   > `ResultEffect` 왕복으로 결과를 돌려준다. NavKey가 담지 못하는 **나올 때의 값**을 넘겨야 해서
   > 이 관용구를 다시 골랐다. 즉 "전진하며 `goTo`"와 "결과 반환"이 develop에 공존한다.
   > 📌 **같은 화면이 둘 다 하는 사례(2026-08-15, PR #231)** — C-101-confirm이 `NavKeyPictureConfirm`
   > 인자 `returnResultOnly`로 갈린다: false면 전진(`goToAndPopCurrent`), true면
   > `sendResult(PictureConfirmResult)` + 물러남. 반환 타입이 `String?`(카메라 실패 경로)과
   > `PictureConfirmResult`(확인 성공)로 **한 플로우 안에서 둘**이라, 받는 쪽이 타입을 하나만 구독하면
   > 나머지는 조용히 버려진다.
6. **`goTo` 호출자를 같은 PR에 넣는다** — entry만 등록하고 진입 경로가 없으면 도달 불가 화면이 된다
   (선례: `NavKeyGroupCreate` — 등록 후 **약 2주 뒤**인 #222에서야 G-001 그룹 추가 오버레이가 호출자가 됐다,
   [open-questions](../synthesis/open-questions.md) [2026-07-29]).
   > 📌 **사례가 하나 더(2026-08-11, PR #199)** — C-001 캔버스 메인이 실물화됐지만 `NavKeyCanvasMain`를
   > `goTo` 하는 호출자가 develop에 0건이다. 유일한 후보인 G-001 `GroupListSideEffect.NavigateToCanvas`
   > 분기는 여전히 `// Todo`다. 화면을 채우는 PR과 진입을 여는 PR이 갈리면 **완성된 화면이 도달 불가로
   > 머지**된다 → [c001-canvas-main 스펙](../specs/archive/2026-08-12-c001-canvas-main.md) ·
   > [open-questions](../synthesis/open-questions.md) [2026-08-12].
   > ✅ **그 사례가 닫혔다(2026-08-17, PR #268) — 벌어진 기간은 6일이다.** 진입을 여는 데 필요한 것이
   > 클릭 배선만이 아니었다: 캔버스는 `groupId`가 있어야 조회되므로 `NavKeyCanvasMain`를
   > `data object` → `data class(groupId)`로 바꾸는 것이 선행이었다. **도달 불가 기간이 길어지는 이유가
   > 대개 이것**이다 — 호출자가 없는 화면은 자기가 무엇을 인자로 받아야 하는지도 모른 채 머지된다.
7. **닫기 경로를 빈 람다로 비워 두지 않는다** — 진입 경로가 있어도 나가는 경로가 없으면 화면이
   막다른 길이 된다(선례: C-101-confirm 이후 세그멘테이션 3화면이 전부 `onClickClose = {}` TODO로
   머지됐다가 벌어진 기간 동안 [OQ-P-055](../synthesis/open-questions.md)로 남았다). 닫기가 되돌아갈
   대상 화면의 인자를 모르면(`groupId` 같은) `goToSingleClearTop` 대신 `popUpTo<T>()`를 쓴다 — 위
   `popUpTo` 항목 참고. 배경 편집처럼 캔버스까지 튀면 안 되는 진입 경로가 섞여 있으면 그 경로만
   `onBack`으로 분기한다(`returnResultOnly` 선례).

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
`NavKeyPictureConfirm`·`NavKeyTermAgree`·`NavKeyGroupNickName`·
`NavKeyCameraCustom`·`NavKeyCustomGalleryPicker`(뒤 둘은 #231에서 `data object` → `data class` 승격)·
`NavKeyCanvasMain`(#268 승격 — `groupId`)·`NavKeyGroupSetting`(#285 승격 — `groupId`)·
`NavKeyWebView`(#296 신설 — `title`·`url`)·`NavKeyCanvasToppingPlace`(#290 신설 — `imageUri`)).
**목적지 둘이 인자 하나로 합쳐진 첫 사례가 #296이다** — `NavKeyServiceTerms`·`NavKeyPrivacyPolicy`
두 `data object`가 삭제되고 `NavKeyWebView(title, url)` 하나가 됐다. 두 화면은 상단바 제목과 여는
주소만 달랐고 그 둘이 이제 서버 응답 값이라(`GET /api/v1/policies`의 `title`·`url`,
[api/policy.md](../api/policy.md)) **화면을 종류별로 나눌 근거가 사라졌다.** 앞선 사례들이
"같은 화면을 재사용하려고 인자를 붙인" 것이라면 이쪽은 **인자가 생겨서 화면이 하나로 줄어든** 방향이다.
동반해 Route/Screen/ViewModel 2벌이 1벌로 줄고 **ViewModel은 아예 사라졌다**(상태가 인자뿐이고 부를
API가 없다) → [s004-terms-privacy-webview 스펙](../specs/archive/2026-07-20-s004-terms-privacy-webview.md).
**인자가 표시 값이 아니라 동작 플래그인 형태가 #231에서 처음 나왔다** — `showGuideToast`·
`returnResultOnly`는 화면이 그릴 데이터가 아니라 호출자가 고르는 분기이고, 기본값이 있어 기존
호출부는 `NavKeyCameraCustom()`처럼 생성자 호출만 바꾸면 됐다. 재사용 화면의 동작 차이를 NavKey에
싣는 방식이 관용구인지는 미결이다 → [open-questions](../synthesis/open-questions.md) [2026-08-15].
**서버 응답 값이 다음 화면의 인자가 되는 형태가 develop에 자리 잡았다**(2026-08-15) — 로그인 응답의
가입 토큰이 `NavKeyTermAgree(registrationToken)`으로, 참여 응답의 그룹 ID가 `NavKeyGroupNickName(groupId)`로
간다. 두 값 다 원시 타입으로 넘기고 **받는 쪽에서 value class로 감싼다**(`RegistrationToken`·`GroupId`) —
NavKey는 `@Serializable`이라 도메인 타입을 직접 싣지 않는다.
**ViewModel이 없는 화면이면 엔트리 빌더가 `navKey.…` 값을 Route 파라미터로 그냥 넘긴다**
(`NavKeyPictureConfirm(uri, source)` → `PictureConfirmRoute(uri = …, source = …)`, #182·#191).
**여러 진입점이 한 화면을 공유하면 출처를 NavKey 인자(`@Serializable` enum)로 넘긴다** — 확인 화면은
카메라·갤러리 공용이고 `PictureConfirmSource`로 문구만 가른다(#191). 이때 호출하는 feature는 대상
feature의 `:api`만 참조한다(`feature/gallery/impl` → `feature/camera/api`).
**반대로 출처를 안 넘기는 사례가 #296이다** — `NavKeyWebView`는 설정(S-001)과 온보딩 약관 동의
(TermAgree) 양쪽에서 열리는데 화면이 출처에 따라 달라질 것이 없어(제목·주소가 이미 인자다) 출처
인자를 두지 않았다. 즉 출처 인자는 "공유 화면이면 붙인다"가 아니라 **그려야 할 것이 갈릴 때만**
붙는다. 여기서도 의존은 `:api`뿐이다(`feature/intro/impl` → `feature/common/terms/api`, #296 신설).
**인자 값의 출처는 호출 화면의 상태다** — G-001이 `goTo(NavKeyGroupCreate(nickName = uiState.nickName))`로
A-005를 연다(#222). 현재 그 `nickName`은 `GroupListUiState` 기본값 mock이라, 인자 결선과 값의 진위는
별개 문제로 남아 있다 — **#243부터는 그 값이 실서버 그룹 생성 요청으로 나간다**
→ [open-questions](../synthesis/open-questions.md) [2026-08-07]·[2026-07-29].
그 값을 ViewModel 초기 상태로 넘길 때는 **Assisted 주입**을 쓴다 — `@HiltViewModel(assistedFactory = …)` + `@AssistedInject` +
`@Assisted` 파라미터, 엔트리 빌더에서 `hiltViewModel<VM, VM.Factory>(creationCallback = { it.create(navKey.…) })`로 생성해 Route에 넘긴다
(`GroupCreateViewModel`·`SegmentationViewModel`·`GroupNickNameViewModel`(#244)·`TermAgreeViewModel`(#242)·
`CanvasMainViewModel`(#268)·`GroupSettingViewModel`(#285)).
**생성 위치는 두 형태가 공존한다** — 엔트리 빌더에서 만들어 Route 파라미터로 넘기거나(`GroupNickName`),
Route의 기본 인자에서 만들거나(`TermAgree`·`CanvasMain`). 후자는 Route가 인자 값을 받아 팩토리에 넘긴다.
**인자 출처가 "목록에서 누른 항목"인 첫 사례가 #268이다** — G-001이 `ClickTopping(groupId)`으로 누른
카드의 식별자를 인텐트에 실어 이펙트까지 나른다(첫 그룹으로 고정하면 두 번째 그룹의 캔버스에 들어갈
방법이 없다). 클릭은 디자인시스템 컴포넌트(`YGToppingGroup`, `onClick` 없음)가 아니라 **호출부가
`modifier`로** 붙인다.
