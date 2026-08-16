---
id: state-management
title: 상태 관리 (MVI) · 데이터 흐름
category: architecture
status: living
platforms: android
verified: 2026-08-16
related_spec: c201-canvas-calendar, session-token-refresh-infra, user-info-ssot
related_adr: ADR-0001, ADR-0005, ADR-0009, ADR-0020, ADR-0021, ADR-0022
related_architecture: data-layer, navigation-flow
related_code: core:ui, BaseViewModel, MviContract, AppError, LoginViewModel, AccountInfoViewModel, AppSettingViewModel, GetMyAccountFlowUseCase
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

> **2026-08-15 갱신** — `BaseViewModel`이 확장됐다([ADR-0020](../adr/0020-mvi-error-effect-infrastructure.md),
> **PR #241로 develop 머지 완료**). 이펙트 전달이 `Channel` 기반으로 바뀌고
> `launch(key, onError, block)`가 생겼다. **3분할 계약은 그대로다** — 설계 도중 4번째
> 스트림(`error`)이 생겼다가 철회됐다.
>
> **화면 밖 이벤트는 이 계약 밖이다**(2026-08-15, PR #260) — 강제 로그아웃은 ViewModel이 아니라
> `:data`의 `SessionEventBus`가 발행하고 앱 루트가 수집한다. 채널 선택 근거(`Channel` + 단일 소비자)는
> 같지만 소유자가 화면이 아니라 세션이다 → [navigation-flow](navigation-flow.md) "세션 종료 이동".

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
  - ⚠️ **이탈 사례(2026-08-16, PR #259)** — C-201 캘린더의 `CanvasImageAddUiState.selectableMonths`가
    State 안 계산 프로퍼티다. 화면만 쓰는 값이 아니라 ViewModel의 연도 이동 계산도 읽어서 화면 헬퍼로
    내리면 로직이 갈린다 → [c201 스펙](../specs/archive/2026-08-16-c201-canvas-calendar.md) ·
    [open-questions](../synthesis/open-questions.md) [2026-08-16].
- **앱 전역 사실은 State가 소유하지 않고 구독한다**(2026-08-16, PR #263). 계정 정보는 화면의 소유물이
  아니라 앱 수명 동안 하나뿐인 사실이라 `:data` SSoT에 살고, S-001·S-002는 `GetMyAccountFlowUseCase`를
  `init`에서 수집만 한다 — 화면 진입마다 다시 조회하지 않고, 한 화면의 닉네임 변경이 구독 중인 모든
  화면에 그대로 전파된다([ADR-0022](../adr/0022-user-info-local-ssot.md)).
  - **`null`은 빈 문자열이 아니라 로딩이다.** mock 문자열을 지우면 기본값이 없어지므로 State가
    nullable을 들고 화면이 그것을 다룬다 — S-002는 레이아웃을 그대로 두고 **입력 필드만 비활성**한다
    (자리를 다른 것으로 바꾸면 값이 도착할 때 화면이 튄다).
  - **편집 화면은 저장값과 입력 버퍼를 나눠 갖는다** — `savedNickname`(SSoT가 준 값)과 `nickname`(입력).
    "서버 값과 다른가"(`isDirty`)를 알아야 확인 버튼 활성·뒤로가기 확인 모달이 성립하는데, 버퍼 하나로는
    사용자가 무엇을 바꿨는지 알 수 없다.
  - **낙관적 갱신을 하지 않는다.** 변경 성공 시에도 State에 직접 쓰지 않고 SSoT 구독이 새 값을
    되돌려준다 — 직접 쓰면 저장이 실패해도 화면만 바뀐 상태가 된다.
- **서버 실패 갈래는 feature 로컬 enum**이다 — S-002의 `GlobalNicknameError` 4종. 형식 오류
  (`NameValidResult.Error`, 요청 전 검사)와 **별개 축**이라 State가 둘을 따로 들고 화면이
  `nicknameError ?: submitError` 순으로 보여준다. 문구 매핑은 같은 모듈의 `@Composable` 확장이 갖는다 —
  소비처가 하나면 feature 로컬이 맞다는 [ADR-0016](../adr/0016-domain-result-presentation-string-mapping.md)
  애드덤이고, `feature` `impl`은 서로를 의존하지 않는 leaf라 형제 화면의 `GroupNickNameError`를 재사용할
  수도 없다(문구 중복은 [open-questions](../synthesis/open-questions.md)가 추적 중이다).
- **요청 중 플래그는 `finally`로 내린다** — S-001 로그아웃(`isLoggingOut`, PR #260)이 `launch(key)` 중복
  가드 위에 State 플래그를 한 겹 더 두는 사례다. `launch(key)`는 두 번째 탭을 삼킬 뿐 버튼이 눌리는
  것처럼 보이므로 비활성은 State로 드러낸다(아래 "안티패턴" 1번의 반대 사례).
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
