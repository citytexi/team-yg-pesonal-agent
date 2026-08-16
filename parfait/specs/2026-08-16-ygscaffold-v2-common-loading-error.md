---
id: ygscaffold-v2-common-loading-error
title: YGScaffoldV2 — 공통 로딩 오버레이·에러 토스트 (common loading & error scaffold)
status: in-progress
category: ui-spec
platforms: android
verified: 2026-08-16
related_code: YGScaffold.kt#YGScaffold, YGToast.kt#YGToastType, YGToastPolicy.kt#YGToastPolicy, YGToastPolicy.kt#YGToastHost, BaseViewModel.kt#launch, GroupListRoute.kt#GroupListRoute
related_adr: ADR-0020, ADR-0016, ADR-0007
related_spec: mvi-error-infrastructure
related_architecture: design-system, state-management
supersedes:
superseded_by:
tags: [spec, parfait, designsystem]
---

# Spec: YGScaffoldV2 — 공통 로딩 오버레이·에러 토스트

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처(source of truth). 본문은 설계 내용에 집중.

## 목표

`YGScaffold`에 **공통 로딩 오버레이와 공통 에러 토스트 자리**를 더한 `YGScaffoldV2`를 만들고,
기존 화면을 점진적으로 이관한다.

지금은 로딩·실패 표현이 화면마다의 손일이다. `SegmentationLoadingScreen`이 자기 로딩 화면을
직접 그리고, `LoginScreen`이 `isLoading`을 파라미터로 받아 자기 안에서 처리하며,
`CustomCameraScreen`·`CustomGalleryPickerScreen`은 `YGToastPolicy`를 Route에서 만들어
Screen까지 파라미터로 내린 뒤 `YGToastHost`를 자기 레이아웃에 꽂는다. 같은 배선이 화면 수만큼
복제된다.

[ADR-0020](../adr/0020-mvi-error-effect-infrastructure.md)이 공용 error 채널을 철회하면서 남긴
문장 — *"에러 UX가 '전 화면 공통'으로 정해지면 화면마다 케이스 추가가 필요하다"* — 의 그 지점이다.
이 스펙은 **공통 실패 표현을 토스트로 확정**해 그 자리를 닫는다.

## 범위

- **포함**
  - `YGScaffoldV2` 신설 — `isLoading`·`toastPolicy` 2개 파라미터 추가
  - `YGLoadingOverlay` 신설 — Dim + 인디케이터 + 터치 삼킴 (**임시 구현**, 디자인 미확정)
  - `YGToastPolicy.showError(text)` 확장 — 에러 토스트는 `YGToastType.Fail` 고정
  - `YGScaffold`(V1)에 `@Deprecated` + `ReplaceWith` 부착
  - 계측 테스트 5건(as-built 9건 — 접근성 차단 2건과 로딩 대조 2건이 리뷰 라운드에서 추가됨)
- **제외**
  - **기존 사용처 11곳 일괄 이관** — 화면별 API 결선 라운드에 묶어 점진 진행(ADR-0020이 쓴 것과
    같은 전략). 이 스펙은 V1을 삭제하지 않는다.
  - **차단성 에러 UI**(전체화면 대체 + 재시도 유도) — 재시도 동선이 필요한 실패는 그 화면이
    자기 UI로 대응한다. V2가 다루는 것은 "알리고 끝나는" 실패뿐이다.
    현행 `GroupListErrorScreen`·`SegmentationErrorScreen`이 그 갈래이고 손대지 않는다.
  - **화면 고유 로딩 표현** — `SegmentationLoadingScreen`처럼 문구·닫기 버튼을 가진 로딩 화면은
    V2로 흡수하지 않는다.
  - **에러 문구의 공통 매핑**(`AppError` → String) — 이번 라운드 밖. [열린 질문](#주의--열린-질문) 참고.
  - 로딩 중 뒤로가기 차단, 로딩 타임아웃.

## API / 인터페이스

```kotlin
// core/designsystem/.../screen/YGScaffoldV2.kt
@Composable
fun YGScaffoldV2(
    modifier: Modifier = Modifier,
    containerColor: Color = YGAtomicColors.Gray.White,
    contentWindowInsets: WindowInsets = ScaffoldDefaults.contentWindowInsets,
    isLoading: Boolean = false,
    toastPolicy: YGToastPolicy = rememberYGToastPolicy(),
    content: @Composable (PaddingValues) -> Unit,
)

// core/designsystem/.../component/ygloading/YGLoadingOverlay.kt
@Composable
fun YGLoadingOverlay(modifier: Modifier = Modifier)

// core/designsystem/.../component/ygtoast/YGToastPolicy.kt (기존 파일에 추가)
fun YGToastPolicy.showError(text: String)
```

| 파라미터 | 기본값 | 의미 |
|---|---|---|
| `modifier`·`containerColor`·`contentWindowInsets`·`content` | V1과 동일 | V1 시그니처를 그대로 승계한다 |
| `isLoading` | `false` | `true`면 `content` 위에 `YGLoadingOverlay`를 덮고 터치를 삼킨다 |
| `toastPolicy` | `rememberYGToastPolicy()` | 토스트 큐. 호출부가 넘기면 그것을, 안 넘기면 스캐폴드가 만든 것을 쓴다 |

**신규 파라미터는 전부 기본값을 갖는다.** 이것은 편의가 아니라 계약이다 — `ReplaceWith`가
생성하는 치환 코드가 그대로 컴파일되려면 V1 인자만으로 V2를 부를 수 있어야 한다.
필수 파라미터를 하나라도 추가하는 순간 V1의 `ReplaceWith`가 거짓말이 된다.

`toastPolicy`를 `errorMessage: String` 대신 **정책 객체로 받는 이유**: 호스트가 화면당 하나여야
한다. camera·gallery는 실패 외에 `YGToastType.InviteCode`·`Edit` 토스트도 같은 화면에서 띄운다.
V2가 에러 문구만 받으면 그 화면들은 호스트를 하나 더 달아야 하고, Toast 공통 정책의
"나중 것 위로 스택"이 두 스택으로 갈라진다.

### 에러 문구는 호출부 소유

V2는 문구를 만들지 않는다. 실패의 어휘가 화면마다 다르기 때문이다 — 로그인은 카카오 로그인
실패, 갤러리는 저장 실패다. 호출부가 완성된 `String`을 넘긴다.

## 동작 / 상태

### 그리기 순서

```
Scaffold(containerColor, contentWindowInsets) { innerPadding ->
    Box(Modifier.fillMaxSize()) {
        content(innerPadding)                    // 1. 화면
        if (isLoading) YGLoadingOverlay(...)     // 2. 오버레이
        YGToastHost(toastPolicy, ...)            // 3. 최상단
    }
}
```

| 레이어 | 인셋 | 이유 |
|---|---|---|
| `content` | `innerPadding` 전달 | 기존 동작 그대로 |
| `YGLoadingOverlay` | 없음(화면 전체) | Dim이 시스템바 밑에서 끊기면 어설프다 |
| `YGToastHost` | 상태바 인셋만 | Toast 정책이 위→아래 노출이다 |

토스트가 오버레이보다 위인 이유: 로딩 중 발생한 실패도 보여야 한다.

### 상태 → 토큰 매핑

| 요소 | 조건 | 토큰·심볼 |
|---|---|---|
| Dim | `isLoading = true` | `YGAtomicColors.Transparency.Black25` |
| 인디케이터 | 동일 | `CircularProgressIndicator`, `YGAtomicColors.Cherry.Cherry100` |
| 에러 토스트 | `showError()` 호출 | `YGToastType.Fail`(`Cherry500` 문구 · `Black75` 배경) |

Dim 농도·인디케이터 모양은 **디자인 미확정 상태의 자리 채움**이다. 현행 `SegmentationLoadingScreen`이
쓰는 값(`CircularProgressIndicator` + `Cherry100`)을 그대로 따른다 — 새 값을 지어내지 않는다.

### 터치 삼킴

오버레이는 `pointerInput`으로 포인터 이벤트를 consume한다. `clickable`을 쓰지 않는다 —
그쪽은 클릭 시맨틱과 접근성 라벨을 붙여 TalkBack이 오버레이를 버튼으로 읽는다.

토스트 자동 소멸(2초)·스와이프업 닫기·스택은 `YGToastPolicy`·`YGToastHost`가 이미 소유한
동작이고 V2는 배치만 한다.

## 표시·제어 규칙

### 이관 = 스캐폴드를 Route 안으로 내리는 작업

현행 사용처 11곳 중 **9곳이 `EntryBuilder`에서 Route를 감싼다.** `hiltViewModel()`은 Route 안에서
호출되므로 EntryBuilder는 `state.isLoading`을 읽을 수 없고 실패 이펙트도 받을 수 없다. V2를
지금 자리에 그대로 꽂으면 새 파라미터를 채울 방법이 없다.

따라서 화면별 이관은 이름 교체가 아니라 **소유 위치 이동**이다.

```kotlin
// Before — EntryBuilder 가 스캐폴드를 소유
entry<NavKeyLogin> {
    YGScaffold { innerPadding ->
        LoginRoute(navigator, kakaoLoginHelper, Modifier.fillMaxSize().padding(innerPadding))
    }
}

// After — EntryBuilder 는 얇아지고
entry<NavKeyLogin> {
    LoginRoute(navigator, kakaoLoginHelper, Modifier.fillMaxSize())
}

// Route 가 스캐폴드를 소유한다
@Composable
fun LoginRoute(...) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val toastPolicy = rememberYGToastPolicy()

    LaunchedEffect(viewModel) {
        viewModel.effect.collect { effect ->
            when (effect) {
                is LoginSideEffect.ShowError -> toastPolicy.showError(effect.text)
                // …
            }
        }
    }

    YGScaffoldV2(isLoading = state.isLoading, toastPolicy = toastPolicy) { innerPadding ->
        LoginScreen(/* … */, modifier = modifier.padding(innerPadding))
    }
}
```

`GroupListRoute`는 이미 스캐폴드를 Route 안에 두고 있어 파라미터 추가만으로 끝난다.
나머지 9곳이 이동 대상이다.

**기각한 대안 — `LocalYGToastPolicy` CompositionLocal.** 스캐폴드를 EntryBuilder에 남긴 채
토스트 정책만 CompositionLocal로 내려주는 방식. 토스트는 가려지지만 `isLoading`은 못 가린다 —
ViewModel이 Route 안에 있는 한 EntryBuilder는 로딩을 영원히 모른다. 절반만 푸는 우회에
암묵 의존을 하나 더 얹는 거래다.

### V1 Deprecated 사다리

```kotlin
@Deprecated(
    message = "공통 로딩·에러 토스트 처리가 없는 구판이다. 이관은 이름 교체가 아니다 — " +
        "스캐폴드를 EntryBuilder 에서 Route 안으로 내리고 isLoading·toastPolicy 를 넘겨야 " +
        "실제로 로딩·실패 표현을 얻는다.",
    replaceWith = ReplaceWith(
        "YGScaffoldV2(modifier = modifier, containerColor = containerColor, " +
            "contentWindowInsets = contentWindowInsets, content = content)",
        "com.teamyg.parfait.core.designsystem.screen.YGScaffoldV2",
    ),
    level = DeprecationLevel.WARNING,
)
@Composable
fun YGScaffold(/* … */)
```

`WARNING`인 이유: 점진 이관이라 V1 호출 11곳이 당분간 살아 있어야 한다. `ERROR`면 그 자리가
전부 컴파일 에러가 된다. `build-logic`·`gradle.properties`에 `allWarningsAsErrors` 설정이
없으므로 경고가 빌드를 깨지 않는다.

**승급 조건**: **모든 화면이 Route에서 스캐폴드를 소유하고 로딩·실패를 배선했을 때**
`DeprecationLevel.ERROR`로 올리고, 그다음 라운드에 파일을 삭제한다. 두 단계를 한 번에 하지
않는 이유는 삭제가 되돌리기 어렵고 `ERROR` 한 단계가 "남은 호출처가 정말 없는가"를 컴파일러로
확인해 주기 때문이다.

> **기준을 "V1 호출처 0"으로 쓰면 안 된다**(2026-08-16 최종 리뷰 지적으로 정정). IDE의
> "Replace all usages"로 23곳을 한 번에 치환하면 **어느 화면도 공통 로딩·에러를 얻지 못한 채**
> 호출처가 0이 된다. 치환된 자리는 V1과 동작이 같고(로딩 없음 + 빈 토스트 호스트) 겉으로만
> 이관된 것처럼 보인다. 그래서 기준이 세는 대상은 호출처가 아니라 **배선된 화면**이다.
> `@Deprecated` message 도 이 오해를 막는 문구로 쓴다 — 아래 as-built 참고.

## 파일 구성

| 파일 | 상태 | 역할 |
|---|---|---|
| `core/designsystem/.../screen/YGScaffoldV2.kt` | 신설 | 스캐폴드 + 오버레이·토스트 배치 |
| `core/designsystem/.../component/ygloading/YGLoadingOverlay.kt` | 신설 | Dim + 인디케이터 + 터치 삼킴 (**임시**) |
| `core/designsystem/.../component/ygtoast/YGToastPolicy.kt` | 수정 | `showError` 확장 추가 |
| `core/designsystem/.../screen/YGScaffold.kt` | 수정 | `@Deprecated` 부착 |
| `core/designsystem/src/main/res/values/strings.xml` | **신설** | 로딩 `contentDescription` 문자열. 이 모듈에 `values/`가 아직 없다 |
| `core/designsystem/src/androidTest/.../component/ygloading/YGLoadingOverlayTest.kt` | 신설 | 계측 테스트 2건(표시·터치 삼킴) |
| `core/designsystem/src/androidTest/.../screen/YGScaffoldV2Test.kt` | 신설 | 계측 테스트 3건(로딩 on·off·에러 토스트) |

`YGLoadingOverlay`를 V2 안에 인라인하지 않고 파일을 나누는 이유 둘: 로띠 등으로 교체될 때
고칠 곳이 한 곳이고, 스캐폴드 없이 로딩만 필요한 화면이 이미 존재한다.

`YGLoadingOverlay`의 KDoc은 임시 상태를 명시한다.

```kotlin
/**
 * 로딩 중 화면 위에 덮는 오버레이.
 *
 * ⚠️ 임시 구현이다 — 로딩 UI 디자인이 아직 정해지지 않았다. Dim 농도·인디케이터 모양·
 * 문구 유무 전부 확정 전 자리 채움이고, 디자인이 나오면 이 파일만 고친다.
 * 다른 곳에 로딩 UI 를 복제하지 마라 — 그러면 고칠 곳이 늘어난다.
 */
```

### 테스트

`core:designsystem`은 `parfait.test.compose`(계측 `ui-test-junit4` + `ui-test-manifest`)를 이미
적용했고 `androidTest`에 `YGThemeSmokeTest` 선례가 있다. 새 인프라는 필요 없다.

| 파일 | 케이스 | 검증 |
|---|---|---|
| `YGLoadingOverlayTest` | 컴포지션 | 오버레이가 보인다 |
| `YGLoadingOverlayTest` | 가려진 클릭 가능 컨텐츠를 클릭 | **콜백이 불리지 않는다** |
| `YGScaffoldV2Test` | `isLoading = true` | 오버레이가 보인다 |
| `YGScaffoldV2Test` | `isLoading = false` | 오버레이가 없다 |
| `YGScaffoldV2Test` | `showError("…")`, 로딩 켠 상태 | 그 문구가 오버레이 위로 보인다 |

터치 삼킴이 이 컴포넌트의 유일한 비자명 동작이고, 오버레이 자체의 책임이라 오버레이
테스트가 잠근다. 토스트 2초 자동 소멸은 검증하지 않는다 — `YGToastPolicy`가 소유한 동작이라
여기서 다시 잠그면 같은 것을 두 곳에서 잠근다.

**테스트의 노드 식별은 `testTag`**(프로덕션 `const`)로 한다. 텍스트·`contentDescription`
파인더는 문구가 바뀌면 같이 깨진다. 별개로 오버레이는 **접근성용 `contentDescription`을
가진다** — 터치를 통째로 삼키는 것이 TalkBack에 아무것도 아닌 것으로 보이면 스크린리더
사용자는 화면이 멈춘 이유를 알 수 없다. 둘은 목적이 다른 별개 장치다.

이 문자열 때문에 `core:designsystem`에 **모듈 최초의 `strings.xml`이 생긴다**(현재
`res/`에는 `drawable*/`·`font/`만 있다). 디자인시스템이 사용자 노출 문자열을 소유하는 첫
사례이고, 접근성 문구라는 성질이 그 값을 한다고 본다.

**테스트 클럭 함정** — `YGToastHost`는 토스트마다 `delay(2000)`로 자동 소멸시킨다. Compose
테스트 룰은 기본이 `mainClock.autoAdvance = true`라 `assertIsDisplayed()`가 부르는
`waitForIdle()`이 가상 시간을 진행시켜 **단언 전에 토스트가 사라질 수 있다.** 토스트 테스트는
`autoAdvance`를 끄고 진입 애니메이션만큼만 손으로 진행시킨다.

## as-built (2026-08-16 구현, 미머지)

브랜치 `feature/common-error-loading-scaffold`, 커밋 4개(`46b2d4df` 오버레이 · `7de8cf7f` 스캐폴드 ·
`542b9563` Deprecated · `0a2975ee` 최종 리뷰 픽스). 실기기(SM-A356N) 계측 9/9 통과, ktlint 0,
`:app:assembleDebug` 통과(구판 호출 23곳은 경고만).

설계에서 **뒤집힌 결정 0건.** 위 본문이 그대로 as-built다. 구현·리뷰가 더한 것은 다음 4건이다.

**① 로딩 오버레이는 접근성 순회도 막는다** — 본문의 "터치 삼킴"만으로는 부족했다. 오버레이와
`content`는 형제라 오버레이가 아래 시맨틱을 가리지 못하고, **TalkBack의 더블탭은 포인터 이벤트가
아니라 `SemanticsActions.OnClick`을 직접 호출**해 `pointerInput` 소비를 통과한다. 즉 로딩 중에도
스크린리더 사용자는 뒤 버튼을 누를 수 있었다. `YGScaffoldV2`가 `content`를 감싼 `Box`에
`isLoading`일 때만 `semantics { hideFromAccessibility() }`를 건다(겹침 결정이 스캐폴드 소관이라
오버레이가 아니라 여기서 푼다).

**② 그 동작은 `assertDoesNotExist()`로 잠글 수 없다** — `hideFromAccessibility()`는 플랫폼
`AccessibilityNodeInfo` 트리에만 작용하고 Compose 테스트가 걷는 시맨틱 트리에는 노드가 그대로
남는다. 테스트는 `SemanticsMatcher`로 `SemanticsProperties.HideFromAccessibility` 보유를 단언한다 —
"기전이 걸렸는가"까지이고 "TalkBack이 실제로 못 닿는가"는 아니다. 후자를 잠그려면
`UiAutomation.getRootInActiveWindow()`로 플랫폼 트리를 읽어야 하고, 그건 별건이다.

**③ `YGScaffoldV2`는 `YGCustomTheme` 조상을 요구한다** — `YGToastHost` → `YGToast`가
`YGTheme.layout`을 읽어 테마 밖에서는 `IllegalStateException("Not Init Layout")`이 난다. **토스트가
뜨기 전까지는 멀쩡하다가 첫 실패에서 죽는** 형태라 KDoc에 전제로 박았다. 앱 루트와 `PreviewBox`가
이미 감싸므로 실사용 위험은 낮지만, 계측 테스트 `setContent`가 전부 `YGCustomTheme`을 둘러야 했다.

**④ 계획의 테스트 코드 결함 2건** — `assertDoesNotExist`는 top-level 확장이 아니라
`SemanticsNodeInteraction` 멤버라 import가 필요 없고, 위 ③ 때문에 `setContent` 래핑이 필요했다.
둘 다 테스트 파일 안에서 끝났고 프로덕션 계약은 무영향.

### 검토하지 않은 대안 (최종 리뷰 지적)

**`YGScaffoldV2`를 새로 만들지 않고 `YGScaffold`에 파라미터 2개를 기본값으로 추가**하는 안을 이
스펙은 검토하지 않았다. V2 시그니처가 V1의 엄밀한 상위집합이라(그래서 `ReplaceWith`가 성립한다)
그 안이면 호출처 23곳 무변경·deprecation 사다리 불필요·V1/V2 공존 기간이라는 열린 질문 자체가
없다. V2 신설의 실질 이득은 **경고가 이관 압력을 만든다** 하나다. 되돌리자는 뜻이 아니라, 다음
라운드가 같은 논쟁을 처음부터 하지 않도록 남긴다.

## 주의 / 열린 질문

- **로딩 UI 디자인 미확정.** `YGLoadingOverlay`는 자리 채움이다. 디자인이 나오면 이 파일과
  `SegmentationLoadingScreen`의 `// TODO: 로띠 넣을 예정`을 함께 정리한다.
- **`AppError` → 문구 공통 매핑이 없다.** 이번 계약은 `String`이라 화면 고유 문구를 자유롭게
  넘길 수 있지만, 화면 고유 문구가 없는 실패(`AppError.Unexpected` 등)는 어디서나 같은 말을
  해야 한다. 매핑이 없으면 "알 수 없는 오류" 문구가 화면 수만큼 복제된다.
  ADR-0016 수렴본(`NameValidResult.Error.toStringResource(fieldType)` — `core:ui` 소유)이
  같은 문제의 선례이고, `AppError`도 같은 자리에 두는 것이 대칭이다. 이 라운드 범위 밖.
- **V1·V2 공존 기간이 열려 있다.** 점진 이관이라 두 스캐폴드가 얼마나 오래 공존할지 정해지지
  않았다. `ERROR` 승급 조건(호출처 0)은 위에 적었으나 시점은 미정이다.
- **이관은 화면당 `EntryBuilder`+Route 두 파일을 건드린다.** 이관 라운드마다 인셋 회귀를
  살펴야 한다 — S-101 라운드에서 `consumeWindowInsets` 누락으로 버튼이 내비게이션 바 높이만큼
  떠올랐던 선례가 있고, 스캐폴드 위치가 바뀌면 같은 함정을 다시 지난다.
- **camera·gallery의 수동 토스트 배선**(Route에서 정책 생성 → Screen 파라미터 → `YGToastHost`
  직접 배치)은 그 화면들이 V2로 이관될 때 걷어낸다. 이번 라운드에서는 손대지 않는다.
- **토스트가 떠 있는 2초 동안 상단 띠의 탭이 삼켜진다.** Box 히트테스트가 최상위 자식에서 멈추고
  `YGToast`가 전폭이라, 그 시간 동안 상단바 뒤로가기 같은 버튼이 안 눌릴 수 있다. `YGToastHost`의
  기존 동작이고 이번 변경이 만든 것이 아니지만, **V2가 그것을 전 화면 공통으로 승격시킨다.**
- **접근성 차단은 기전까지만 검증됐다.** 위 as-built ②. TalkBack이 실제로 못 닿는지는
  플랫폼 트리를 읽는 별건 테스트가 필요하다.
- **기본 `toastPolicy` 경로에 테스트가 없다.** 정책을 안 넘기고 부를 수 있다는 사실은 다른 두
  테스트가 컴파일된다는 간접 증거뿐이다.
