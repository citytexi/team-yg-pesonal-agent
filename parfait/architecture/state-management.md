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

## 3분할 계약 (`MviContract`)
- **UiState** — 불변. 화면이 그리는 전부. `StateFlow<S>`로 노출.
- **UiIntent** — 사용자 행위/이벤트. `processIntent(intent)` 진입.
- **UiSideEffect** — 내비게이션·토스트 등 1회성. `SharedFlow<E>`로 노출.

예: `LoginState` / `LoginIntent`(`LoginWithKakao`, `LoginWithKakaoSuccess`) / `LoginSideEffect`(`NavigateToNext`, `RequestLoginWithKakao`).

## 신규 화면 추가 체크리스트
1. **api 모듈**: `NavKeyXxx`(@Serializable) 정의([[navigation-flow]]).
2. **impl 모듈**:
   - `XxxState : UiState`, `XxxIntent : UiIntent`, `XxxSideEffect : UiSideEffect` 정의.
   - `@HiltViewModel class XxxViewModel @Inject constructor(...) : BaseViewModel<XxxState, XxxIntent, XxxSideEffect>(초기상태)` — `processIntent` 구현.
   - `XxxScreen`/`XxxRoute` Composable: `state` 수집·렌더, `effect` 수집·처리(내비게이션은 `Navigator`).
   - 엔트리 빌더(`featureXxxEntryBuilder()`) 노출 + DI 등록([[navigation-flow]]).
3. 필요한 도메인 동작은 **UseCase**로([[0009-usecase-injectable-invoke]]), 데이터 접근은 Repository로.

## 안티패턴 (금지)
- side effect(내비게이션 등)를 **state에 담기** → 재구성 시 중복 실행. 반드시 `SharedFlow<E>`.
- Screen에서 Repository/UseCase 직접 호출 → 반드시 ViewModel 경유.
