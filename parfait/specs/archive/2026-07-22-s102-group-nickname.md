---
id: s102-group-nickname
title: S-102 그룹 내 닉네임 입력 화면 (GroupNickName)
status: implemented
category: ui-spec
platforms: android
verified: 2026-07-29
related_code:
  - NavKeyGroupNickName
  - GroupNickNameRoute.kt#GroupNickNameRoute
  - GroupNickNameScreen.kt#GroupNickNameScreen
  - GroupNickNameViewModel.kt#GroupNickNameViewModel
  - CheckNameValidUseCase.kt#CheckNameValidUseCase
  - NameValidResult.kt#NameValidResult
  - GroupCreateConfig.kt#GroupCreateConfig
  - core/ui/res/values/strings.xml
  - CharExtension.kt#isKorean
  - EntryBuilder.kt#featureGroupNickNameEntryBuilder
  - feature/groups/enter/impl/res/values/strings.xml
related_adr: ADR-0005, ADR-0006, ADR-0009, ADR-0016
related_spec:
related_architecture: state-management, navigation-flow
related_spec: s002-account-info
supersedes:
superseded_by:
tags: [spec, parfait, groups, nickname, s102]
---

# Spec: S-102 그룹 내 닉네임 입력 화면 (GroupNickName)

> 상태·날짜·대상·관련은 frontmatter가 단일 출처. 본문은 설계에 집중.
>
> **사후 기록(post-hoc)**: 타 작업자 구현이 선작성 스펙 없이 develop 머지(#154, 2026-07-22)됨.
> as-built 역기록. 코드가 SoT. 입력 유효성은 위키 정책 [[S-102-닉네임-정책-v0.1]]·[[이름-입력-규칙]]과 대조 완료(일치).
>
> **as-built 갱신(2026-07-26, #166)**: 화면 정적 문자열이 하드코딩 → `strings.xml` + `stringResource`로 이동. 문구 자체는 불변.
>
> **as-built 갱신(2026-07-29, #179)**: 유효성 결과가 [ADR-0016](../../adr/0016-domain-result-presentation-string-mapping.md) 방향으로 리팩터됐으나
> **ADR 설계와 형태가 다르다**(아래 "유효성 규칙" 참고). `NickNameResult(isSuccess, errorMessage: String?)` →
> `NameValidResult` sealed(`Success`/`Error.{EmptyString, SpaceAtEdge, DuplicatedSpace, InvalidCharacter}`),
> UseCase 패키지 `domain.usecase.group` → `domain.usecase`, 길이 상한이 Screen 상수 → `domain` `GroupCreateConfig.NICKNAME_MAX_LENGTH`,
> UiState `errorMessage: String?` → `errorMessageResId: Int?`(ViewModel이 `core:ui` `strings.xml` 리소스 ID로 매핑).
> ADR-0016이 설계한 `core:ui` `toStringResource()` 확장은 **머지되지 않았다** → [open-questions](../../synthesis/open-questions.md) [2026-07-29].

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

// domain — UseCase(ADR-0009: @Inject + operator invoke). 패키지 domain.usecase (#179에서 .group 제거)
class CheckNameValidUseCase @Inject constructor() {
    operator fun invoke(name: String): NameValidResult
}
// 🔁 as-built(#179): NameValidResult sealed, 문자열 미보유. 표시 문자열은 ViewModel이
//    core:ui strings.xml 리소스 ID로 매핑(ADR-0016의 toStringResource 확장은 미머지).
sealed interface NameValidResult {
    data object Success : NameValidResult
    sealed interface Error : NameValidResult { /* EmptyString, SpaceAtEdge, DuplicatedSpace, InvalidCharacter */ }
}

// impl — MVI (🔁 as-built #179: errorMessage:String? → errorMessageResId:Int?)
data class GroupNickNameUiState(val nickName: String = "", val errorMessageResId: Int? = null) : UiState
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

> 🔁 **as-built(#179)**: 각 규칙은 문자열 대신 `NameValidResult.Error` 변형을 반환하고, 표시 문자열은 **ViewModel**이
> `core:ui` `strings.xml` 리소스 ID로 매핑한다(에러 문자열 리소스는 닉네임용·그룹명용이 별도 항목으로 공존).
> 빈 값 규칙 `CheckEmptyString`(→`Error.EmptyString`)이 추가됐으나 **enum 순서상 마지막**이다 — S-002 스펙은 선두를 전제했으나,
> 빈 문자열은 앞 3규칙을 공백으로 통과하므로 결과는 동일하다. S-102는 확인 버튼 `isNotEmpty()` 비활성으로 런타임 미도달.

| 규칙(enum) | 조건 | 반환 Error / 표시 문자열(닉네임 화면) |
|---|---|---|
| `CheckSpaceStartOrEnd` | 처음/끝 공백 불가 | `Error.SpaceAtEdge` — "닉네임의 처음과 끝에는 공백을 사용할 수 없어요" |
| `CheckDuplicatedSpace` | 연속 공백(`"  "`) 불가 | `Error.DuplicatedSpace` — "공백은 글자 사이에 1칸만 사용할 수 있어요" |
| `CheckValidCharacter` | 한글/영문/숫자/공백만(`isKorean`·`isDigit`·`isLetter`·`isWhitespace`) | `Error.InvalidCharacter` — "한글, 영문, 숫자, 띄어쓰기만 사용할 수 있어요" |
| `CheckEmptyString` | 빈 값 불가 | `Error.EmptyString` — "닉네임은 비워둘 수 없어요" |

- **길이 상한 15자**: `domain` `GroupCreateConfig.NICKNAME_MAX_LENGTH` → `YGTextFormField(maxLength = …)`로 입력 단계에서 강제(UseCase는 길이 미검사). 위키 [[S-102-닉네임-정책-v0.1]] "1~15자"와 일치. #179에서 Screen 지역 상수 → domain 설정 객체로 이동(A-005 그룹 생성 화면과 공용).
- `Char.isKorean()`(`core/util/jvm`) — 자모(`ㄱ..ㆎ`, `ㅏ..ㅣ`) + 완성형(`가..힣`) 허용.

## 표시·제어 규칙

- 상단 `YGTopBarDetail(title=R.string.group_enter, "그룹 참여하기")`, 제목/부제 텍스트, `YGTextFormField`(placeholder·isError·errorDescription·maxLength), 하단 `YGButton` `Large`.
- 에러 상태는 `uiState.errorMessage != null` → `isError` + 하단 `errorDescription`.
- **정적 UI 라벨은 `feature/groups/enter/impl` `res/values/strings.xml` + `stringResource(R.string.*)`**(상단 타이틀·제목·부제·placeholder·확인 버튼, #166). 같은 모듈의 G-002 초대코드 화면과 문자열 파일 공용(`submit`·`group_enter` 공유). 에러 문자열은 별개 경로 — `core:ui` `toStringResource` 매핑(ADR-0016).

## 파일 구성

- `api/NavKeyGroupNickName.kt` — 목적지 키.
- `domain/usecase/CheckNameValidUseCase.kt` + `domain/model/NameValidResult.kt` — 유효성 도메인 로직(🔁 #179: sealed·문자열 미보유, 패키지에서 `group` 제거).
- `domain/model/GroupCreateConfig.kt` — 이름 길이 상한 등 그룹 생성/참여 공용 상수(🔁 #179 신규).
- `core/ui/res/values/strings.xml` — 유효성 에러 문자열(닉네임/그룹명 각각). ViewModel이 리소스 ID로 참조(🔁 #179 신규, S-002·A-005와 공용).
- `core/util/jvm/extension/CharExtension.kt#isKorean` — 한글 판별 확장(신규).
- `impl/nickname/GroupNickNameScreen.kt` — stateless UI(길이 상한은 `GroupCreateConfig` 참조).
- `impl/res/values/strings.xml` — 그룹 참여 플로우(S-102 + G-002 초대코드) 공용 정적 라벨. #166 신설.
- `impl/nickname/GroupNickNameRoute.kt` — VM 배선, back→onBack, next stub.
- `impl/nickname/GroupNickNameViewModel.kt` — MVI, `CheckNameValidUseCase` 주입.
- `impl/navigation/EntryBuilder.kt#featureGroupNickNameEntryBuilder` — `entry<NavKeyGroupNickName> { YGScaffold(contentWindowInsets = WindowInsets(0.dp)) { GroupNickNameRoute(...) } }`(ime 패딩 직접 처리).

## 주의 / 열린 질문

- **다음 화면 네비게이션 미구현**(`NavigateToNext` stub) — #179로 다음 단계 후보인 A-005 그룹 생성 화면([a005-group-create](2026-07-29-a005-group-create.md))이 들어왔으나 `NavKeyGroupCreate`로의 `goTo`가 아직 없다 → [open-questions](../../synthesis/open-questions.md) [2026-07-29].
- 유효성 규칙(공백·문자 종류)은 UseCase, 길이(15)는 `GroupCreateConfig` 상수로 **검사 위치 이원화** — 정책 [[이름-입력-규칙]] 상한과 정합하고 #179로 상수 소유처는 domain 단일화됐으나 검사 자체는 여전히 입력 컴포넌트 소관.
