---
id: s102-group-nickname
title: S-102 그룹 내 닉네임 입력 화면 (GroupNickName)
status: implemented
category: ui-spec
platforms: android
verified: 2026-08-15
related_code:
  - NavKeyGroupNickName
  - GroupNickNameRoute.kt#GroupNickNameRoute
  - GroupNickNameScreen.kt#GroupNickNameScreen
  - GroupNickNameViewModel.kt#GroupNickNameViewModel
  - GroupNickNameViewModelTest
  - GroupNickNameError.kt#GroupNickNameError
  - CheckNameValidUseCase.kt#CheckNameValidUseCase
  - ChangeGroupNicknameUseCase.kt#ChangeGroupNicknameUseCase
  - ParfaitGroupRepository.kt#changeMyNickname
  - ServerErrorCode.kt#ParfaitGroup
  - Navigator.kt#goToSingleClearTop
  - NameValidResult.kt#NameValidResult
  - GroupCreateConfig.kt#GroupCreateConfig
  - core/ui/res/values/strings.xml
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
>
> **as-built 갱신(2026-08-13, #223)**: 위 갈림이 **원안으로 수렴하며 닫혔다**. `errorMessageResId: Int?` →
> **`nicknameError: NameValidResult.Error?`**, VM의 `when` 5분기 → `is NameValidResult.Error` 2분기,
> 표시 변환은 화면이 `nicknameError?.toStringResource(NameFieldType.NICKNAME)`로 한다. 화면 문구·동작 불변
> ([S-101 라운드](2026-08-07-s101-group-side-menu.md)가 4개 화면을 동시에 전환).
>
> **as-built 갱신(2026-08-12, #224)**: 확인이 `EnterGroupUseCase`(mock)를 거쳐 **G-001 그룹 목록으로 복귀**하는
> 데까지 결선됐다. 스펙이 유일한 미구현으로 뒀던 "다음 화면 네비게이션"이 닫혔다 — 다만 목적지는
> 당시 후보였던 A-005(그룹 생성)가 아니라 그룹 목록이다. **그룹 참여 API는 여전히 미연동.**
>
> ⚠️ **as-built 갱신(2026-08-15, #244 develop 머지)**: **화면의 역할이 바뀌었다.** 합류가 앞 화면(A-004)의
> `POST join`으로 옮겨가면서, 여기는 **이미 들어간 그룹의 닉네임을 바꾸는 화면**이 됐다 —
> mock `EnterGroupUseCase`가 삭제되고 `ChangeGroupNicknameUseCase`(PATCH `/{groupId}/nickname`)가 들어왔다.
> 그래서 `NavKeyGroupNickName`이 **`data object` → `data class(groupId: Long)`**로 바뀌고 VM은 Assisted 주입이 된다.
> 서버 실패 사유는 `GroupNickNameError` enum + 화면 매핑으로 입력 자리 아래에 나간다.

- **화면 ID**: S-102 (그룹 참여 시 그룹 내 닉네임)
- **대상 모듈**: `feature/groups/enter/impl`(`nickname/`) + `feature/groups/enter/api`(NavKey) + `domain`(UseCase/model)

## 목표

그룹 참여 플로우에서 "그룹이름에서만 공유되는" 닉네임을 입력받는 화면. 확인 시 유효성 검사를 돌려
통과해야 다음 단계로 진행한다. #244부터는 **참여를 마친 그룹의 닉네임을 적용**하는 단계다.

## 범위

- 포함: 닉네임 입력 폼(최대 15자)·확인 시 유효성 검사·에러 메시지 인라인 노출·입력 시 에러 초기화·진입 시 자동 포커스·뒤로가기.
  **#224 추가**: 유효성 통과 후 호출·진행 중 재진입 가드·완료 후 그룹 목록 복귀.
  **#244 추가**: 그룹 닉네임 변경 API 호출·서버 실패 사유 인라인 노출·진행 중 확인 버튼 비활성.
- 제외(구현 TODO):
  - ~~**그룹 참여 API 연동**~~ — ✅ **해소(#244)**. 다만 이 화면이 부르는 것은 참여가 아니라
    **닉네임 변경**(PATCH)이다 — 합류는 A-004에서 이미 끝났다.
  - ~~다음 화면 네비게이션~~ — #224에서 `goToSingleClearTop(NavKeyGroupList)`로 결선.
  - **건너뛰기·이탈 경로 없음** — 뒤로가기로 나가면 그룹에는 들어가 있고 닉네임만 서버 초기값으로 남는다.

## API / 인터페이스

```kotlin
// api — 🔁 #244: data object → 인자 있는 NavKey
@Serializable data class NavKeyGroupNickName(val groupId: Long) : NavKey

// domain — UseCase(ADR-0009: @Inject + operator invoke). 패키지 domain.usecase (#179에서 .group 제거)
class CheckNameValidUseCase @Inject constructor() {
    operator fun invoke(name: String): NameValidResult
}
// 🔁 as-built(#179): NameValidResult sealed, 문자열 미보유. 표시 문자열은 ViewModel이
//    core:ui strings.xml 리소스 ID로 매핑.
// 🔁 as-built(#223, 2026-08-13): 매핑이 core:ui text/NameValidResultUiText.kt의
//    NameValidResult.Error.toStringResource(NameFieldType)로 이관 — State는 Error?를 그대로 든다.
sealed interface NameValidResult {
    data object Success : NameValidResult
    sealed interface Error : NameValidResult { /* EmptyString, SpaceAtEdge, DuplicatedSpace, InvalidCharacter */ }
}

// domain — 🔁 #244: mock EnterGroupUseCase 삭제, 그룹 닉네임 변경으로 교체
class ChangeGroupNicknameUseCase @Inject constructor(
    private val parfaitGroupRepository: ParfaitGroupRepository,
) {
    suspend operator fun invoke(groupId: GroupId, groupNickname: GroupNickname): Result<GroupNicknameVO>
}

// impl — MVI (🔁 #179 errorMessageResId, #223 nicknameError, #224 isEntering, #244 submitError)
data class GroupNickNameUiState(
    val nickName: String = "",
    val nicknameError: NameValidResult.Error? = null,   // 입력 형식(로컬 검증)
    val submitError: GroupNickNameError? = null,        // 서버만 알 수 있는 사유(#244)
    val isEntering: Boolean = false,
) : UiState

// 서버 실패 사유 — feature 로컬 enum + 화면 매핑(A-004의 InviteCodeError와 같은 형태)
enum class GroupNickNameError { ALREADY_USED, INVALID, NETWORK, UNKNOWN }
@Composable internal fun GroupNickNameError.toStringResource(): String

sealed interface GroupNickNameIntent {
    data object ClickNextButton; data object ClickBackButton
    data class InputWord(val nickName: String)
}
sealed interface GroupNickNameSideEffect { data object NavigateToBack; data object NavigateToNext }

// ViewModel — groupId 를 NavKey 인자로 받으므로 Assisted 주입(#244)
@HiltViewModel(assistedFactory = GroupNickNameViewModel.Factory::class)
class GroupNickNameViewModel @AssistedInject constructor(
    @Assisted groupIdValue: Long,
    private val checkNickNameValid: CheckNameValidUseCase,
    private val changeGroupNickname: ChangeGroupNicknameUseCase,
) : BaseViewModel<…>
```

- 엔트리 빌더가 `hiltViewModel<VM, VM.Factory>(creationCallback = { it.create(navKey.groupId) })`로 VM을 만들어
  Route에 **파라미터로 넘긴다**(#244) — Route의 기본값 `hiltViewModel()`이 제거돼 이제 VM 없이 호출할 수 없다.

## 동작 / 상태

- **입력**(`InputWord`): `nickName` 갱신 + `nicknameError`·`submitError` 모두 `null`(입력 시 에러 즉시 해제).
- **확인**(`ClickNextButton`, 🔁 #244): 먼저 `CheckNameValidUseCase(nickName)`로 형식을 보고, `Error`면 그대로
  표시하고 요청하지 않는다. 통과하면 `launch(key = KEY_CHANGE_NICKNAME)`에서 두 에러를 지우고 `isEntering = true` →
  `ChangeGroupNicknameUseCase(groupId, GroupNickname(nickName))` → 해제는 `finally`(버튼이 영구 비활성으로
  남지 않는다) → **성공이면** `NavigateToNext`. 중복 요청은 job 키 가드가 막는다(🔁 #224의 `isEntering` 조기 return 대체).
- **서버 실패 매핑**(#244): `AppError.Network` → `NETWORK` / `AppError.Server`의
  `GROUP_NICKNAME_ALREADY_USED` → `ALREADY_USED`, `INVALID_GROUP_NICKNAME` → `INVALID`(앱 검증과 서버 규칙이
  어긋났다는 신호) / 그 외 `UNKNOWN`. 결과는 `submitError`에 담기고 입력 필드 아래 한 줄로 나간다.
- **다음 화면**(`NavigateToNext`, #224): `navigator.goToSingleClearTop(NavKeyGroupList)` — 참여 플로우
  (초대코드 → 닉네임)를 한 번에 걷어내고 백스택의 그룹 목록을 재사용한다 → [navigation-flow](../../architecture/navigation-flow.md).
  의존은 규약대로 `:api`만(`feature/groups/enter/impl` → `feature/groups/list/api`, #224에서 추가).
- **뒤로가기**(`ClickBackButton`) → `NavigateToBack` → `navigator.onBack()`.
- **자동 포커스**: 화면 진입 시 `FocusRequester.requestFocus()`(`LaunchedEffect(Unit)`).
- **확인 버튼 활성**: `nickName.isNotEmpty() && isEntering.not()`(🔁 #244 — 진행 중 비활성이 붙었다).
  빈 값만 막고 상세 규칙은 클릭 시 UseCase가 검사한다.

### 유효성 규칙 (`CheckNameValidUseCase`, 순차 검사 — 첫 실패 반환)

> 🔁 **as-built(#179)**: 각 규칙은 문자열 대신 `NameValidResult.Error` 변형을 반환하고, 표시 문자열은 `core:ui` `strings.xml`이 소유한다
> (에러 문자열 리소스는 닉네임용·그룹명용이 별도 항목으로 공존). 매핑 주체는 #179 시점엔 **ViewModel**이었고 **#223(2026-08-13)에 `core:ui` 확장으로 이관**됐다.
> 빈 값 규칙 `CheckEmptyString`(→`Error.EmptyString`)이 추가됐으나 **enum 순서상 마지막**이다 — S-002 스펙은 선두를 전제했으나,
> 빈 문자열은 앞 3규칙을 공백으로 통과하므로 결과는 동일하다. S-102는 확인 버튼 `isNotEmpty()` 비활성으로 런타임 미도달.

| 규칙(enum) | 조건 | 반환 Error / 표시 문자열(닉네임 화면) |
|---|---|---|
| `CheckSpaceStartOrEnd` | 처음/끝 공백 불가 | `Error.SpaceAtEdge` — "닉네임의 처음과 끝에는 공백을 사용할 수 없어요" |
| `CheckDuplicatedSpace` | 연속 공백(`"  "`) 불가 | `Error.DuplicatedSpace` — "공백은 글자 사이에 1칸만 사용할 수 있어요" |
| `CheckValidCharacter` | 완성형 한글/영문/숫자/스페이스만(🔁 #244) | `Error.InvalidCharacter` — "한글, 영문, 숫자, 띄어쓰기만 사용할 수 있어요" |
| `CheckEmptyString` | 빈 값 불가 | `Error.EmptyString` — "닉네임은 비워둘 수 없어요" |

- **길이 상한 15자**: `domain` `GroupCreateConfig.NICKNAME_MAX_LENGTH` → `YGTextFormField(maxLength = …)`로 입력 단계에서 강제(UseCase는 길이 미검사). 위키 [[S-102-닉네임-정책-v0.1]] "1~15자"와 일치. #179에서 Screen 지역 상수 → domain 설정 객체로 이동(A-005 그룹 생성 화면과 공용).
- 🔁 **문자 집합이 서버 정규식에 맞춰 좁혀졌다(#244 라운드의 #243 커밋)** — 구 검사는 `isLetter`·`isDigit`·
  `isWhitespace` + `Char.isKorean()`이라 자모·타 언어·non-breaking space까지 통과했고 서버에서만 400이 났다.
  지금은 `' '`·`가..힣`·`A..Z`·`a..z`·`0..9`뿐이며 `Char.isKorean()`은 **삭제**됐다(`core:util:jvm`).
  상세·정책 공백은 [a005 스펙](2026-07-29-a005-group-create.md) 유효성 절.
- **중복 닉네임은 서버가 막는다**(#244) — 같은 그룹에서 이미 쓰이는 닉네임이면 409(`GROUP_NICKNAME_ALREADY_USED`).
  위키 [[이름-입력-규칙]]이 미결로 둔 "그룹 내 닉네임 중복 처리"에 **서버 계약이 먼저 답을 냈다**(불가·409).

## 표시·제어 규칙

- 상단 `YGTopBarDetail(title=R.string.group_enter, "그룹 참여하기")`, 제목/부제 텍스트, `YGTextFormField`(placeholder·isError·errorDescription·maxLength), 하단 `YGButton` `Large`.
- 에러 상태는 `uiState.nicknameError != null || uiState.submitError != null` → `isError` + 하단 `errorDescription`
  (🔁 #244. 형식 오류가 우선하고 없으면 서버 사유를 띄운다). #223 as-built 기준으로 형식 오류는
  `NameValidResult.Error`, #179~#223 사이엔 `errorMessageResId`, 그 전엔 `errorMessage: String?`였다.
- **정적 UI 라벨은 `feature/groups/enter/impl` `res/values/strings.xml` + `stringResource(R.string.*)`**(상단 타이틀·제목·부제·placeholder·확인 버튼, #166). 같은 모듈의 A-004 초대코드 화면([a004 스펙](2026-08-12-a004-group-invite-code.md))과 문자열 파일 공용(`submit`·`group_enter` 공유). 에러 문자열은 별개 경로 — `core:ui` `toStringResource` 매핑(ADR-0016).

## 파일 구성

- `api/NavKeyGroupNickName.kt` — 목적지 키.
- `domain/usecase/CheckNameValidUseCase.kt` + `domain/model/NameValidResult.kt` — 유효성 도메인 로직(🔁 #179: sealed·문자열 미보유, 패키지에서 `group` 제거).
- `domain/model/GroupCreateConfig.kt` — 이름 길이 상한 등 그룹 생성/참여 공용 상수(🔁 #179 신규).
- `core/ui/res/values/strings.xml` — 유효성 에러 문자열(닉네임/그룹명 각각). ViewModel이 리소스 ID로 참조(🔁 #179 신규, S-002·A-005와 공용).
- ~~`core/util/jvm/extension/CharExtension.kt#isKorean`~~ — **#244 라운드에서 삭제**(테스트 포함).
- `impl/nickname/GroupNickNameError.kt` — 서버 실패 사유 enum + `toStringResource()`(#244 신설).
- `domain/usecase/group/ChangeGroupNicknameUseCase.kt`(#244 신설). 삭제: `EnterGroupUseCase.kt`.
- 테스트(#244): `GroupNickNameViewModelTest`(형식 검증·성공·서버 실패 매핑).
- `impl/nickname/GroupNickNameScreen.kt` — stateless UI(길이 상한은 `GroupCreateConfig` 참조).
- `impl/res/values/strings.xml` — 그룹 참여 플로우(S-102 + A-004 초대코드) 공용 정적 라벨. #166 신설, #224에서 확인 모달 문구 추가.
- `impl/nickname/GroupNickNameRoute.kt` — VM 배선, back→onBack, next stub.
- `impl/nickname/GroupNickNameViewModel.kt` — MVI, `CheckNameValidUseCase` 주입.
- `impl/navigation/EntryBuilder.kt#featureGroupNickNameEntryBuilder` — `entry<NavKeyGroupNickName> { YGScaffold(contentWindowInsets = WindowInsets(0.dp)) { GroupNickNameRoute(...) } }`(ime 패딩 직접 처리).

## 주의 / 열린 질문

- ~~**다음 화면 네비게이션 미구현**~~ — #224에서 결선됐고, 목적지는 A-005가 **아니라** G-001 그룹 목록이다.
  즉 "참여 다음이 생성"이라는 당시 후보 흐름은 성립하지 않고, A-005 진입은 목록 오버레이 하나뿐이다
  → [open-questions](../../synthesis/open-questions.md) [2026-07-29].
- ~~**참여가 mock**~~ — ✅ **해소(#244)**. 다만 이 화면이 부르는 것은 참여가 아니라 닉네임 변경이다.
- ⚠️ **합류와 닉네임이 두 요청으로 갈렸다**(#244) — A-004에서 이미 그룹에 들어간 상태로 이 화면에 오므로,
  **여기서 뒤로 가거나 앱을 닫아도 참여는 유지되고 닉네임만 서버 초기값으로 남는다**. 화면에 건너뛰기·
  취소 개념이 없고 재진입 경로도 S-101 그룹 설정뿐이다 → [open-questions](../../synthesis/open-questions.md) [2026-08-15].
- ~~**참여 중 표시가 없다**~~ — **부분 해소(#244)**. 확인 버튼이 진행 중 비활성이 됐다. 진행 표시(스피너 등)는 여전히 없다.
- **복귀 목적지가 위키 정본과 다름** — [[기능정의서-v6]]은 A-004(참여) 다음 단계를 **C-001(메인 캔버스)**로
  적는다 → [open-questions](../../synthesis/open-questions.md) [2026-08-12].
- 유효성 규칙(공백·문자 종류)은 UseCase, 길이(15)는 `GroupCreateConfig` 상수로 **검사 위치 이원화** — 정책 [[이름-입력-규칙]] 상한과 정합하고 #179로 상수 소유처는 domain 단일화됐으나 검사 자체는 여전히 입력 컴포넌트 소관.
