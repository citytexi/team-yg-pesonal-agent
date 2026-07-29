---
id: a005-group-create
title: A-005 그룹 생성 화면 (GroupCreate)
status: implemented
category: ui-spec
platforms: android
verified: 2026-07-29
related_code:
  - NavKeyGroupCreate
  - GroupCreateRoute.kt#GroupCreateRoute
  - GroupCreateScreen.kt#GroupCreateScreen
  - GroupCreateViewModel.kt#GroupCreateViewModel
  - CheckNameValidUseCase.kt#CheckNameValidUseCase
  - NameValidResult.kt#NameValidResult
  - GroupCreateConfig.kt#GroupCreateConfig
  - VerticalGridLayout.kt#VerticalGridLayout
  - EntryBuilder.kt#featureGroupCreateEntryBuilder
  - feature/groups/enter/impl/res/values/strings.xml
  - core/ui/res/values/strings.xml
related_adr: ADR-0005, ADR-0006, ADR-0009, ADR-0016
related_spec: s102-group-nickname, s002-account-info
related_architecture: state-management, navigation-flow, module-structure
supersedes:
superseded_by:
tags: [spec, parfait, groups, group-create, a005]
---

# Spec: A-005 그룹 생성 화면 (GroupCreate)

> 상태·날짜·대상·관련은 frontmatter가 단일 출처. 본문은 설계에 집중.
>
> **사후 기록(post-hoc)**: 타 작업자 구현이 선작성 스펙 없이 develop 머지(#179, 2026-07-27)됨.
> as-built 역기록. 코드가 SoT. 입력 유효성·인원 상한은 위키 정책 [[A-005-그룹명-정책-v0.1]]·[[이름-입력-규칙]]·[[그룹]]과 대조 완료(일치).

- **화면 ID**: A-005 (새 그룹 생성 — 그룹명 + 최대 인원수 입력)
- **대상 모듈**: `feature/groups/enter/impl`(`groupcreate/`) + `feature/groups/enter/api`(NavKey) + `domain`(공용 UseCase·설정) + `core:ui`(공용 레이아웃·에러 문자열)

## 목표

그룹명·그룹 인원(최대 인원수)을 입력받아 새 그룹을 만드는 화면. 직전 단계에서 입력한
그룹 내 닉네임을 인자로 받아 읽기 전용으로 함께 보여준다. 확인 시 그룹명 유효성 검사를 통과해야 다음 단계로 넘어간다.

## 범위

- 포함: 그룹명 입력(최대 10자)·닉네임 읽기 전용 표시·인원 선택 그리드(1~12)·확인 버튼 활성 조건·확인 시 그룹명 유효성 검사·에러 인라인 노출·입력 시 에러 초기화·뒤로가기.
- 제외(구현 TODO):
  - **그룹 생성 API 연동** — 확인은 side effect `NavigateToNext`만 발신.
  - **다음 화면 네비게이션** — Route에서 stub(`/* navigate to next */`).
  - **진입 경로** — `NavKeyGroupCreate`로 `goTo` 하는 호출자가 아직 없다(S-102 `NavigateToNext`가 stub) → [open-questions](../../synthesis/open-questions.md) [2026-07-29].

## API / 인터페이스

```kotlin
// api — 인자 있는 NavKey(선례: NavKeySegmentation·NavKeyCanvasEdit·NavKeyGroupHome)
@Serializable data class NavKeyGroupCreate(val nickName: String) : NavKey

// domain — 그룹 생성/참여 공용 상수
object GroupCreateConfig {
    const val GROUP_NAME_MAX_LENGTH   // 그룹명 상한(위키 정책 10자)
    const val NICKNAME_MAX_LENGTH     // 닉네임 상한(위키 정책 15자)
    const val GROUP_COLUMN_COUNT      // 인원 그리드 열 수
    val GROUP_COUNT_LIST              // 선택 가능한 인원 목록(1..12)
}

// impl — MVI. 표시 문자열은 리소스 ID로 보유(as-built, ADR-0016 방향)
data class GroupCreateUiState(
    val groupName: String = "",
    val nickName: String = "",
    val groupNumber: Int? = null,
    val groupNameErrorTextResId: Int? = null,
) : UiState {
    val isValid: Boolean   // groupName·nickName 비어있지 않고 groupNumber 선택됨
}

sealed interface GroupCreateIntent : UiIntent {
    data object ClickNextButton; data object ClickBackButton
    data class InputGroupName(val newGroupName: String)
    data class ClickGroupNumber(val newSelectedNumber: Int)
}
sealed interface GroupCreateSideEffect : UiSideEffect { data object NavigateToBack; data object NavigateToNext }

// ViewModel — 닉네임을 NavKey 인자로 받으므로 Assisted 주입(선례: SegmentationViewModel)
@HiltViewModel(assistedFactory = GroupCreateViewModel.Factory::class)
class GroupCreateViewModel @AssistedInject constructor(
    @Assisted nickName: String,
    private val checkNameValid: CheckNameValidUseCase,
) : BaseViewModel<…>(initialState = GroupCreateUiState(nickName = nickName))
```

## 동작 / 상태

- **그룹명 입력**(`InputGroupName`): `groupName` 갱신 + `groupNameErrorTextResId = null`(입력 시 에러 즉시 해제).
- **인원 선택**(`ClickGroupNumber`): `groupNumber` 갱신(단일 선택, 토글 해제 없음).
- **확인**(`ClickNextButton`): `CheckNameValidUseCase(groupName)` 실행 → `Success`면 에러 클리어 후 `NavigateToNext`,
  `Error` 변형이면 대응 `core:ui` 문자열 리소스 ID를 state에 반영(화면 잔류).
- **뒤로가기**(`ClickBackButton`) → `NavigateToBack` → `navigator.onBack()`.
- **확인 버튼 활성**: `isValid` — 그룹명·닉네임 비어있지 않고 인원이 선택됨. 상세 규칙은 클릭 시 UseCase가 검사.

### 유효성 규칙 (`CheckNameValidUseCase` 공용 — S-102와 동일 규칙)

닉네임과 **같은 UseCase**를 그룹명에도 적용한다. 위키 [[이름-입력-규칙]]이 그룹명·닉네임 공통 규칙이므로 정합.
표시 문자열만 그룹명용 리소스로 분기한다(`core:ui` `strings.xml`에 닉네임용/그룹명용 항목이 별도로 존재).

| 반환 Error | 표시 문자열(그룹명 화면) |
|---|---|
| `Error.SpaceAtEdge` | "그룹명의 처음과 끝에는 공백을 사용할 수 없어요" |
| `Error.DuplicatedSpace` | "공백은 글자 사이에 1칸만 사용할 수 있어요" |
| `Error.InvalidCharacter` | "한글, 영문, 숫자, 띄어쓰기만 사용할 수 있어요" |
| `Error.EmptyString` | "그룹명은 비워둘 수 없어요" |

- **길이 상한 10자**: `GroupCreateConfig.GROUP_NAME_MAX_LENGTH` → `YGTextFormField(maxLength = …)`로 입력 단계 강제(UseCase는 길이 미검사). 위키 [[A-005-그룹명-정책-v0.1]] "1~10자"와 일치.
- **인원 상한 12**: `GroupCreateConfig.GROUP_COUNT_LIST` = 1~12. 위키 [[그룹]] "최대 12명"과 일치.

## 표시·제어 규칙

- 상단 `YGTopBarDetail(title = R.string.group_create)`, 본문은 `LazyColumn`(좌우 `padding7`, 상 `padding6`, 하 `padding10`), 하단 고정 `YGButton(Large)`.
- 섹션 3개 — 각각 `YGLabel` + `gap4` 간격:
  1. **그룹명** — `YGTextFormField`(placeholder·`isError`·`errorDescription`·`maxLength`).
  2. **그룹 속 내 닉네임** — `YGTextFormField(enabled = false, onValueChange = no-op)`로 읽기 전용 표시(NavKey 인자값).
  3. **그룹 인원** — `VerticalGridLayout`(`core:ui`) + `YGInputNumber` 셀, 선택 상태는 `groupNumber == 셀 값`. 하단에 `caption.c01R`/`Gray300` 안내 문구("그룹명과 인원수는 추후 변경할 수 없어요").
- 정적 라벨은 `feature/groups/enter/impl` `res/values/strings.xml`(같은 모듈의 S-102·G-002 화면과 파일 공용), 에러 문자열은 `core:ui` `strings.xml`.
- 엔트리는 `YGScaffold(containerColor = Gray.White, contentWindowInsets = WindowInsets(0.dp))` + `statusBarsPadding()`·`navigationBarsAndImePadding()`.

## 파일 구성

- `api/NavKeyGroupCreate.kt` — 인자 있는 목적지 키.
- `impl/groupcreate/GroupCreateViewModel.kt` — MVI + Assisted 주입, `CheckNameValidUseCase` 사용, 에러→리소스 ID 매핑.
- `impl/groupcreate/GroupCreateScreen.kt` — stateless UI + `PreviewParameterProvider`(빈/기본/입력 3상태) `@YGPreview`.
- `impl/groupcreate/GroupCreateRoute.kt` — VM 배선, back→`onBack`, next stub.
- `impl/navigation/EntryBuilder.kt#featureGroupCreateEntryBuilder` — `entry<NavKeyGroupCreate>`에서 `hiltViewModel(creationCallback = { factory.create(navKey.nickName) })`로 VM 생성 후 Route 호출.
- `impl/navigation/NavigationModule.kt` — 빌더 `@IntoSet` 제공.
- `core/ui/VerticalGridLayout.kt` — 열 수·행/열 간격을 받는 공용 그리드(Column+Row+`IntrinsicSize.Max`, 빈 칸은 `Spacer(weight)`). 스크롤 컨테이너 안에서 쓰려고 `LazyVerticalGrid` 대신 비지연 레이아웃 채택.
- `domain/model/GroupCreateConfig.kt`·`domain/model/NameValidResult.kt`·`domain/usecase/CheckNameValidUseCase.kt` — 공용 도메인(S-102와 공유).

## 주의 / 열린 질문

- **진입 경로 없음** — `NavKeyGroupCreate`를 `goTo` 하는 호출자가 없어 현재 도달 불가. → [open-questions](../../synthesis/open-questions.md) [2026-07-29].
- **그룹 생성 API·다음 화면 미구현** — `NavigateToNext`가 stub.
- **`GroupCreateConfig`가 표시 관심사를 포함** — `GROUP_COLUMN_COUNT`(그리드 열 수)는 UI 레이아웃 값인데 `domain`에 있다. → [open-questions](../../synthesis/open-questions.md) [2026-07-29].
- **`VerticalGridLayout` 프리뷰가 규약 이탈** — `@Preview` + public 프리뷰 함수 + 랜덤 색. `core:ui`는 디자인시스템 프리뷰 규약(`@YGPreview`+`PreviewBox`) 적용 대상이 아니었으나, 공용 UI 컴포넌트가 늘면 규약 범위를 정해야 한다. → [open-questions](../../synthesis/open-questions.md) [2026-07-29].
- **읽기 전용 필드 관용구** — 닉네임 표시에 `YGTextFormField(enabled = false)` + no-op `onValueChange`를 쓴다. 표시 전용 컴포넌트가 없어 입력 컴포넌트를 비활성으로 전용한 형태.
