---
id: state-management
title: 상태 관리 (MVI) · 데이터 흐름
category: architecture
status: living
platforms: android
verified: 2026-07-12
related_spec:
related_adr: ADR-0001, ADR-0005, ADR-0009
related_architecture: data-layer, navigation-flow
related_code: core:ui, BaseViewModel
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

## UI State가 담는 것 / 담지 않는 것

- **표시 문자열·리소스 ID를 State에 담지 않는다.** State는 도메인 의미를 들고, 표시 변환은 화면이 렌더 시점에 한다. 유효성 결과가 대표 사례다 — `NameValidResult.Error?`를 담고 화면이 `core:ui`의 `toStringResource(fieldType)` 확장으로 문자열을 얻는다([ADR-0016](../adr/0016-domain-result-presentation-string-mapping.md), 원안 수렴 — #223 develop 머지 2026-08-13). ViewModel이 `@StringRes Int`를 산출해 담던 과도기 형태는 같은 매핑을 feature마다 복제해 폐기됐다.
- **도메인 VO 보유는 허용**하되 강제는 아니다. S-101(`GroupSettingUiState`, #223 develop 머지)이 `GroupName`·`GroupNickname`·`InviteCode`를 State에 들인 첫 사례다. 단 **편집 중 입력값처럼 유효성이 보장되지 않는 값은 원시 타입으로 둔다** — VO로 감싸면 "타입은 맞는데 유효하지 않다"는 모순이 생긴다.
- 표시 규칙에 따른 분기(문구 선택·상태 enum 산출)는 화면의 private 헬퍼가 갖는다. State가 계산 프로퍼티로 들 이유가 없다.

## 안티패턴 (금지)
- side effect(내비게이션 등)를 **state에 담기** → 재구성 시 중복 실행. 반드시 `SharedFlow<E>`.
- Screen에서 Repository/UseCase 직접 호출 → 반드시 ViewModel 경유.
- 표시 문자열 매핑을 **feature마다 복제** → 공유 도메인 규칙엔 공유 매핑([ADR-0016](../adr/0016-domain-result-presentation-string-mapping.md)).
