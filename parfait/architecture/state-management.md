---
id: state-management
title: 상태 관리 (MVI) · 데이터 흐름
category: architecture
status: living
platforms: android
verified: 2026-08-14
related_spec:
related_adr: ADR-0001, ADR-0005, ADR-0009, ADR-0020
related_architecture: data-layer, navigation-flow
related_code: core:ui, BaseViewModel, MviContract, AppError, LoginViewModel
tags: [architecture, parfait]
---
# 상태 관리 (MVI) · 데이터 흐름

화면 상태를 `core:ui`의 MVI 베이스로 다룬다. 결정 근거는 [[0005-custom-mvi-baseviewmodel]]. 레이어 흐름은 [[0001-layered-multi-module]]·[[data-layer]].

> 근거는 파일명+심볼명으로만.

## 단방향 흐름

```
사용자 입력
  → Screen: viewModel.processIntent(Intent)
  → ViewModel(BaseViewModel): Intent 처리
       ├─ UseCase 호출 → Repository → DataSource
       ├─ state 갱신  → StateFlow<S>  → Screen 재구성
       └─ 1회성 효과  → SharedFlow<E> → Screen에서 소비(내비게이션 등)
```

> **2026-08-14 갱신** — `BaseViewModel`이 확장됐다([ADR-0020](../adr/0020-mvi-error-effect-infrastructure.md),
> 브랜치 `feature/mvi-error-infra-a002-login`, develop 미머지). 이펙트 전달이 `Channel` 기반으로
> 바뀌고 `launch(key, onError, block)`가 생겼다. **3분할 계약은 그대로다** — 설계 도중 4번째
> 스트림(`error`)이 생겼다가 철회됐다.

## 3분할 계약 (`MviContract`)
- **UiState** — 불변. 화면이 그리는 전부. `StateFlow<S>`로 노출.
- **UiIntent** — 사용자 행위/이벤트. `processIntent(intent)` 진입.
- **UiSideEffect** — 내비게이션·토스트 등 1회성. `SharedFlow<E>`로 노출.

예: `LoginState` / `LoginIntent`(`LoginWithKakao`, `LoginWithKakaoSuccess`) / `LoginSideEffect`(`NavigateToGroupList`, `NavigateToTermAgree`, `RequestLoginWithKakao`).

### 이펙트 전달은 `Channel`이다
`Channel(BUFFERED).receiveAsFlow()`. 구독자가 없는 순간 발행해도 버퍼에 남았다가 전달되고, 이미
소비한 이펙트는 재구독해도 다시 오지 않는다. `SharedFlow` + `replay`는 후자를 깨서 화면 재진입·
Activity 재생성 때 내비게이션이 저절로 다시 실행된다 — 명시적으로 기각된 설계다.

대신 **단일 소비자**다. `effect` 수집은 **화면당 한 곳(Route)**이며, 두 곳에서 수집하면 이펙트가
한쪽에만 간다. 조용히 넘어가지 않도록 베이스가 동시 구독자 수를 세어 error 로그를 남긴다.

### 작업 실행은 `launch(key, onError, block)`
```
protected fun launch(key: Any? = null, onError: ((AppError) -> Unit)? = null, block: suspend CoroutineScope.() -> Unit): Job?
```
- 같은 `key`의 작업이 살아 있으면 **새로 시작하지 않고 `null` 반환** — 버튼 연타 차단.
- 블록이 던지면 `AppError.Unexpected`로 감싸 `onError`로. **없으면 로그만.**
- `CancellationException`은 재던진다. `Result.failure`는 값이라 잡지 않는다 — 호출부가 처리한다.

**실패도 이펙트다.** 공용 에러 스트림을 따로 두지 않는다 — 스트림을 나누면 이펙트와의 순서
보장이 사라지고, 실패 경로가 없는 화면까지 빈 채널을 달게 된다. 표현이 필요한 화면이 자기
`SideEffect`에 케이스를 두고 `onError`에서 발행한다.

```kotlin
launch(key = …, onError = { postSideEffect(XxxSideEffect.ShowError(it)) }) { … }
```

**SDK 다이얼로그처럼 `launch` 바깥에서 뜨는 조작**은 `launch(key)` 가드가 못 막는다. State의
`isLoading` 가드를 한 겹 더 둔다 → [a002-kakao-login-api](../specs/archive/2026-08-13-a002-kakao-login-api.md).

## 신규 화면 추가 체크리스트
1. **api 모듈**: `NavKeyXxx`(@Serializable) 정의([[navigation-flow]]).
2. **impl 모듈**:
   - `XxxState : UiState`, `XxxIntent : UiIntent`, `XxxSideEffect : UiSideEffect` 정의.
   - `@HiltViewModel class XxxViewModel @Inject constructor(...) : BaseViewModel<XxxState, XxxIntent, XxxSideEffect>(초기상태)` — `processIntent` 구현.
   - `XxxScreen`/`XxxRoute` Composable: `state` 수집·렌더, `effect` 수집·처리(내비게이션은 `Navigator`).
   - 엔트리 빌더(`featureXxxEntryBuilder()`) 노출 + DI 등록([[navigation-flow]]).
3. 필요한 도메인 동작은 **UseCase**로([[0009-usecase-injectable-invoke]]), 데이터 접근은 Repository로.

## UI State가 담는 것 / 담지 않는 것

- **표시 문자열·리소스 ID를 State에 담지 않는다.** State는 도메인 의미를 들고, 표시 변환은 화면이 렌더 시점에 한다. 유효성 결과가 대표 사례다 — `NameValidResult.Error?`를 담고 화면이 `core:ui`의 `toStringResource(fieldType)` 확장으로 문자열을 얻는다([ADR-0016](../adr/0016-domain-result-presentation-string-mapping.md), 원안 수렴 — #223 develop 머지 2026-08-13). ViewModel이 `@StringRes Int`를 산출해 담던 과도기 형태는 같은 매핑을 feature마다 복제해 폐기됐다.
- **도메인 VO 보유는 허용**하되 강제는 아니다. S-101(`GroupSettingUiState`, #223 develop 머지)이 `GroupName`·`GroupNickname`·`InviteCode`를 State에 들인 첫 사례다. 단 **편집 중 입력값처럼 유효성이 보장되지 않는 값은 원시 타입으로 둔다** — VO로 감싸면 "타입은 맞는데 유효하지 않다"는 모순이 생긴다.
- 표시 규칙에 따른 분기(문구 선택·상태 enum 산출)는 화면의 private 헬퍼가 갖는다. State가 계산 프로퍼티로 들 이유가 없다.
- ⚠️ **UI 타입 보유 사례(2026-08-15, PR #231)** — C-301 배경 편집의 `CanvasBGEditUiState`가 Compose
  `Color`를, `CanvasBGEditEffect.ConfirmBackground`가 디자인시스템 타입 `YGCanvasBackground`를 든다.
  선택 팔레트(`CanvasBackgroundPaletteColors`)도 ViewModel 파일의 public 상수다. 위 "표시 문자열을
  담지 않는다"의 같은 결에서 보면 이탈이지만, 배경색은 **도메인 의미가 아직 없는 값**(저장·서버 계약이
  없다)이라 대체 표현도 정해져 있지 않다 → [c301 스펙](../specs/archive/2026-08-15-c301-canvas-background-edit.md) ·
  [open-questions](../synthesis/open-questions.md) [2026-08-15].

## 안티패턴 (금지)
- `launch` 블록의 **마지막 줄**에서 로딩 플래그를 되돌리기 → 던지거나 취소되면 도달하지 못해
  버튼이 영구 비활성으로 남는다. `finally`에 둔다.
- 한 ViewModel의 `effect`를 **두 곳에서 수집** → 이펙트가 한쪽에만 간다(로그로 드러난다).
- side effect(내비게이션 등)를 **state에 담기** → 재구성 시 중복 실행. 반드시 `SharedFlow<E>`.
- Screen에서 Repository/UseCase 직접 호출 → 반드시 ViewModel 경유.
- 표시 문자열 매핑을 **feature마다 복제** → 공유 도메인 규칙엔 공유 매핑([ADR-0016](../adr/0016-domain-result-presentation-string-mapping.md)).
