---
id: s102-group-nickname
title: S-102 그룹 내 닉네임 입력 화면 (GroupNickName)
status: implemented
category: ui-spec
platforms: android
verified: 2026-07-22
related_code:
  - NavKeyGroupNickName
  - GroupNickNameRoute.kt#GroupNickNameRoute
  - GroupNickNameScreen.kt#GroupNickNameScreen
  - GroupNickNameViewModel.kt#GroupNickNameViewModel
  - CheckNameValidUseCase.kt#CheckNameValidUseCase
  - NickNameResult.kt#NickNameResult
  - CharExtension.kt#isKorean
  - EntryBuilder.kt#featureGroupNickNameEntryBuilder
related_adr: ADR-0005, ADR-0006, ADR-0009
related_spec:
related_architecture: state-management, navigation-flow
supersedes:
superseded_by:
tags: [spec, parfait, groups, nickname, s102]
---

# Spec: S-102 그룹 내 닉네임 입력 화면 (GroupNickName)

> 상태·날짜·대상·관련은 frontmatter가 단일 출처. 본문은 설계에 집중.
>
> **사후 기록(post-hoc)**: 타 작업자 구현이 선작성 스펙 없이 develop 머지(#154, 2026-07-22)됨.
> as-built 역기록. 코드가 SoT. 입력 유효성은 위키 정책 [[S-102-닉네임-정책-v0.1]]·[[이름-입력-규칙]]과 대조 완료(일치).

- **화면 ID**: S-102 (그룹 참여 시 그룹 내 닉네임)
- **대상 모듈**: `feature/groups/enter/impl`(`nickname/`) + `feature/groups/enter/api`(NavKey) + `domain`(UseCase/model) + `core/util/jvm`(CharExtension)

## 목표

그룹 참여 플로우에서 "그룹이름에서만 공유되는" 닉네임을 입력받는 화면. 확인 시 유효성 검사를 돌려
통과해야 다음 단계로 진행한다.

## 범위

- 포함: 닉네임 입력 폼(최대 15자)·확인 시 유효성 검사·에러 메시지 인라인 노출·입력 시 에러 초기화·진입 시 자동 포커스·뒤로가기.
- 제외(구현 TODO): **다음 화면 네비게이션** — `NavigateToNext` Route에서 stub(`/* navigate to next */`).

## API / 인터페이스

```kotlin
// api
@Serializable data object NavKeyGroupNickName : NavKey

// domain — UseCase(ADR-0009: @Inject + operator invoke)
class CheckNameValidUseCase @Inject constructor() {
    operator fun invoke(nickName: String): NickNameResult
}
data class NickNameResult(val isSuccess: Boolean, val errorMessage: String?)

// impl — MVI
data class GroupNickNameUiState(val nickName: String = "", val errorMessage: String? = null) : UiState
sealed interface GroupNickNameIntent {
    data object ClickNextButton; data object ClickBackButton
    data class InputWord(val nickName: String)
}
sealed interface GroupNickNameSideEffect { data object NavigateToBack; data object NavigateToNext }
```

## 동작 / 상태

- **입력**(`InputWord`): `nickName` 갱신 + `errorMessage = null`(입력 시 에러 즉시 해제).
- **확인**(`ClickNextButton`): `CheckNameValidUseCase(nickName)` 실행 → `isSuccess`면 에러 클리어 후 `NavigateToNext`, 실패면 `errorMessage` 반영(화면 잔류).
- **뒤로가기**(`ClickBackButton`) → `NavigateToBack` → `navigator.onBack()`.
- **자동 포커스**: 화면 진입 시 `FocusRequester.requestFocus()`(`LaunchedEffect(Unit)`).
- **확인 버튼 활성**: `nickName.isNotEmpty()`(빈 값만 막고, 상세 규칙은 클릭 시 UseCase가 검사).

### 유효성 규칙 (`CheckNameValidUseCase`, 순차 검사 — 첫 실패 반환)

| 규칙(enum) | 조건 | 에러 메시지 |
|---|---|---|
| `CheckSpaceStartOrEnd` | 처음/끝 공백 불가 | "닉네임의 처음과 끝에는 공백을 사용할 수 없어요" |
| `CheckDuplicatedSpace` | 연속 공백(`"  "`) 불가 | "공백은 글자 사이에 1칸만 사용할 수 있어요" |
| `CheckValidCharacter` | 한글/영문/숫자/공백만(`isKorean`·`isDigit`·`isLetter`·`isWhitespace`) | "한글, 영문, 숫자, 띄어쓰기만 사용할 수 있어요" |

- **길이 상한 15자**: `GroupNickNameScreen`의 `NICKNAME_MAX_LENGTH = 15` → `YGTextFormField(maxLength = 15)`로 입력 단계에서 강제(UseCase는 길이 미검사). 위키 [[S-102-닉네임-정책-v0.1]] "1~15자"와 일치.
- `Char.isKorean()`(`core/util/jvm`) — 자모(`ㄱ..ㆎ`, `ㅏ..ㅣ`) + 완성형(`가..힣`) 허용.

## 표시·제어 규칙

- 상단 `YGTopBarDetail(title="그룹 참여하기")`, 제목/부제 텍스트, `YGTextFormField`(placeholder·isError·errorDescription·maxLength), 하단 `YGButton` `Large`.
- 에러 상태는 `uiState.errorMessage != null` → `isError` + 하단 `errorDescription`.

## 파일 구성

- `api/NavKeyGroupNickName.kt` — 목적지 키.
- `domain/usecase/group/CheckNameValidUseCase.kt` + `domain/model/NickNameResult.kt` — 유효성 도메인 로직.
- `core/util/jvm/extension/CharExtension.kt#isKorean` — 한글 판별 확장(신규).
- `impl/nickname/GroupNickNameScreen.kt` — stateless UI + 상수 `NICKNAME_MAX_LENGTH`.
- `impl/nickname/GroupNickNameRoute.kt` — VM 배선, back→onBack, next stub.
- `impl/nickname/GroupNickNameViewModel.kt` — MVI, `CheckNameValidUseCase` 주입.
- `impl/navigation/EntryBuilder.kt#featureGroupNickNameEntryBuilder` — `entry<NavKeyGroupNickName> { YGScaffold(contentWindowInsets = WindowInsets(0.dp)) { GroupNickNameRoute(...) } }`(ime 패딩 직접 처리).

## 주의 / 열린 질문

- **다음 화면 네비게이션 미구현**(`NavigateToNext` stub) — 그룹 참여 다음 단계 확정 필요.
- 유효성 규칙(공백·문자 종류)은 UseCase, 길이(15)는 Screen 상수로 **검사 위치 이원화** — 정책 [[이름-입력-규칙]] 상한과 정합하나 단일 소유처는 아님(향후 UseCase 통합 여지).
