---
id: a004-group-invite-code
title: A-004 그룹 참여 초대코드 입력 화면 (GroupInviteCode)
status: implemented
category: ui-spec
platforms: android
verified: 2026-08-16
related_code:
  - NavKeyGroupInviteCode
  - GroupInviteCodeRoute.kt#GroupInviteCodeRoute
  - GroupInviteCodeScreen.kt#GroupInviteCodeScreen
  - GroupInviteCodeViewModel.kt#GroupInviteCodeViewModel
  - InviteCodeInputField.kt#InviteCodeInputField
  - InviteCodeInputFieldElement.kt#InviteCodeInputFieldElement
  - InviteCodePasteBar.kt#InviteCodePasteBar
  - InviteCodeError.kt#InviteCodeError
  - GetGroupJoinPreviewUseCase.kt#GetGroupJoinPreviewUseCase
  - ParfaitGroupRepository.kt#previewJoin
  - ServerErrorCode.kt#ParfaitGroup
  - InviteCode.kt#InviteCode
  - ClipDescription.kt#isSensitive
  - EntryBuilder.kt#featureGroupInviteCodeEntryBuilder
  - GroupInviteCodeViewModelTest
  - InviteCodeTest
  - feature/groups/enter/impl/res/values/strings.xml
  - core/ui/res/values/strings.xml
related_adr: ADR-0005, ADR-0006, ADR-0009, ADR-0016
related_spec: s102-group-nickname, a005-group-create, ygmodalpopup, g001-group-list
related_architecture: state-management, navigation-flow, module-structure
supersedes:
superseded_by:
tags: [spec, parfait, groups, invite-code, a004]
---

# Spec: A-004 그룹 참여 초대코드 입력 화면 (GroupInviteCode)

> 상태·날짜·대상·관련은 frontmatter가 단일 출처. 본문은 설계에 집중.
>
> **사후 기록(post-hoc)**: 선작성 스펙 없이 develop 머지된 화면의 as-built 역기록. 코드가 SoT.
> 화면은 #156(2026-07-23, 리팩터)부터 있었고 그때는 "변경 심볼이 어느 parfait 문서와도 무충돌"이라
> 문서 대상이 없다고 판단했으나, **#224(2026-08-12)가 확인 모달·그룹명 표시·다음 화면 결선을 넣어
> 참여 플로우의 첫 화면이 되면서** 스펙을 세운다.
>
> **화면 ID 정정** — parfait 문서가 이 화면을 그동안 "G-002 초대코드 화면"이라 불렀는데,
> 위키 정본 [[기능정의서-v6]]에서 **G-002(그룹 진입)는 삭제된 별개 화면**이고 초대 코드 입력은
> **A-004(그룹 참여)**다([[그룹]] "생성 / 참여"). 이 스펙부터 A-004로 쓴다.
>
> ⚠️ **as-built 갱신(2026-08-15, #244 develop 머지)**: **코드 검증도 참여도 실서버를 탄다.**
> mock이던 `CheckInviteCodeValidUseCase`와 `InviteCodeResult`가 **삭제**되고
> `GetGroupJoinPreviewUseCase`(GET `join-preview`)·`JoinGroupUseCase`(POST `join`) 둘로 갈라졌다.
> **합류 시점이 이 화면으로 앞당겨졌다** — 모달의 "참여하기"가 실제로 그룹에 합류하고, 그 응답의
> `groupId`를 다음 화면(S-102)에 인자로 넘긴다. 실패 사유는 `InviteCodeError` enum + 화면 매핑이라
> **domain이 표시 문자열을 들던 마지막 자리도 사라졌다**(ADR-0016 이탈 해소).
>
> ⚠️ **as-built 갱신(2026-08-16, #261 develop 머지)**: **#244가 앞당겼던 합류가 되돌아갔다.**
> 확인 모달과 `JoinGroupUseCase`가 이 화면에서 **통째로 빠져** 다음 화면(S-102)으로 옮겨갔고,
> 여기는 **미리보기까지만** 한다 — 확인 버튼이 `GET join-preview`에 성공하면 곧바로
> `NavKeyGroupNickName(inviteCode, groupName)`으로 넘어간다. 그래서 다음 화면에 넘기는 것이
> **참여 결과(`groupId`)가 아니라 참여에 쓸 재료(초대코드·그룹명)**다. 서버를 부르는 곳이 미리보기
> 하나뿐이라 `isSubmitting`도 조회 전용이고, 모달 관련 상태·인텐트(`groupName`·`isConfirmPopupVisible`·
> `ClickConfirmPopupEnter`·`DismissConfirmPopup`)는 삭제됐다. **미리보기를 먼저 부르는 이유도 바뀌었다** —
> 모달을 띄우기 전에 거르는 것이 아니라, 다음 화면에 띄울 그룹명을 얻는 김에 잘못된 코드를 여기서 막는다.

- **화면 ID**: A-004 (그룹 참여 — 초대 코드 입력)
- **대상 모듈**: `feature/groups/enter/impl`(`invitecode/`) + `feature/groups/enter/api`(NavKey) + `domain`(UseCase·model) + `core:designsystem`(`YGTopBarDetail`·`YGButton`. 🔁 #261에서 `YGModalPopup` 소비가 S-102로 이관)

## 목표

초대 코드를 한 글자씩 칸에 입력받아 그 코드가 어느 그룹을 가리키는지 미리보기로 확인하고,
그룹 내 닉네임 입력(S-102)으로 초대코드와 그룹명을 넘긴다(🔁 #261 — 확인 모달·합류는 S-102 몫).

## 범위

- 포함: 코드 칸 입력·칸 이동/수정 모드·진입 자동 포커스·키보드 동기화·확인 시 코드 미리보기·에러 인라인 노출·
  다음 화면 이동·뒤로가기. ~~참여 확인 모달~~(🔁 #261 S-102로 이관).
- 제외(구현 TODO):
  - ~~**코드 검증 실체**~~ — ✅ **해소(#244)**. 입력한 코드로 `GET /api/parfait-groups/join-preview`를 부른다.
  - ~~**그룹명 실값**~~ — ✅ **해소(#244)**. 미리보기 응답의 `GroupName`을 모달 제목에 쓴다.
  - ~~**실제 참여 처리**~~ — #244에서 모달 "참여하기"가 `POST /api/parfait-groups/join`을 불렀으나,
    🔁 **#261에서 합류가 다시 S-102로 넘어갔다** — 이 화면은 참여 요청을 하지 않는다.
  - ~~**클립보드 자동 붙여넣기** — Route에 `Todo` 주석만 있다.~~ → **2라운드(#237)에서 해소**, 아래 참고.
  - **실패 후 재시도 안내 없음** — 사유 문구는 입력 자리 아래 한 줄로 나가지만 재시도 버튼·안내는 없다(입력을 고치면 문구가 지워진다).

## 2라운드 — 클립보드 붙여넣기 (PR #237, 2026-08-14 머지)

`Todo`로 남아 있던 클립보드 자동 붙여넣기가 **자동 채움이 아니라 "붙여넣기 바" 제안 방식**으로 들어왔다.
사용자가 탭해야 채워지므로 입력 중인 코드를 말없이 덮지 않는다.

- **초대코드 파서를 domain에 둔다** — `InviteCode` value class에 `companion` 확장:
  `LENGTH = 6`(UiState의 `codeLength`가 이제 이 상수를 읽는다 — 매직넘버 소멸) ·
  `parseOrNull(text, messageTemplate)`.
  - 템플릿을 주면 **초대 메시지 템플릿의 코드 자리만** 정규식으로 뽑는다(앞뒤 문구는 `Regex.escape`로 그대로 매치).
  - 템플릿과 형태가 다르면 **텍스트 전체가 코드일 때만** 인정한다(부분 매치 금지). 문장 속 6자 토큰을
    주우면 초대와 무관한 텍스트에서도 코드가 잡히기 때문이다.
  - 200자 초과·공백 텍스트는 파싱하지 않는다.
- **초대 메시지 템플릿이 `core:ui`로 올라갔다** — `group_invite_message`. S-101 그룹 설정의 **복사**와
  A-004의 **붙여넣기 감지**가 같은 문자열을 봐야 하므로 두 feature 모듈이 공유한다
  (`feature/groups/setting/impl`의 `group_setting_invite_message`는 삭제).
- **읽는 시점은 윈도우 포커스**(`LocalWindowInfo.current.isWindowFocused`) — Android 10부터 포커스를 가진
  앱만 클립보드를 읽을 수 있고, 다른 앱에서 코드를 복사하고 돌아온 경우도 이 시점에 다시 잡힌다.
- **읽기 전에 `ClipDescription`으로 거른다** — MIME이 `text/plain`인지, 민감 표시(`EXTRA_IS_SENSITIVE`,
  API 33+)인지 확인한 뒤에야 실제 텍스트를 읽는다. description 조회는 Android 12부터 뜨는
  붙여넣기 안내 토스트를 유발하지 않는다. 판정은 `core:util:android` `extension/ClipDescription.kt#isSensitive`.
- **노출 조건은 상태 계산 프로퍼티**다 — `pasteBarInviteCode`는 클립보드에서 코드를 찾았고 ·
  키보드가 올라와 있고(`focusedIndex != null`) · 그 코드가 아직 입력되지 않았을 때(`code != text`)만 값이 있다.
  별도 가시성 플래그를 두지 않는다.
- **붙여넣기 탭**(`ClickPasteInviteCode`): 코드를 채우고 `focusedIndex = null`로 키보드를 내리며
  `clipboardInviteCode`를 비운다(= 바가 사라진다). 클립보드가 비었으면 상태를 그대로 둔다.
- `InviteCodePasteBar`는 화면 맨 아래 `Gray200` 바(2줄: "클립보드에 복사됨" + 코드)이며
  feature 로컬 컴포넌트다.
- **인셋 정리** — Route의 `Modifier.imePadding()`이 제거됐다(entry의 `navigationBarsAndImePadding()`과
  이중 적용이었다 → [open-questions](../../synthesis/open-questions.md) [2026-08-13] 해소).
  대신 앱 매니페스트에 `android:windowSoftInputMode="adjustResize"`가 붙었다 — **`MainActivity` 단일
  액티비티라 앱 전 화면에 걸리는 변경**이다.
- **검증 실패 시 상태 통째 교체가 `copy`로 바뀌었다** — 아래 "동작 / 상태"의 서술은 #224 시점 기준이며,
  현재는 `copy(errorText = …, isConfirmPopupVisible = false)`라 입력값·포커스가 살아남는다.
- **테스트가 붙었다** — `feature/groups/enter/impl`에 `parfait.test.unit` 적용 +
  `GroupInviteCodeViewModelTest` 6케이스(바 노출 조건 4 · 붙여넣기 2), `domain`에 `InviteCodeTest`.

## API / 인터페이스

```kotlin
// api
@Serializable data object NavKeyGroupInviteCode : NavKey

// domain — ADR-0009(@Inject + operator invoke). 🔁 #244에서 mock 2종이 삭제되고 둘로 갈라짐
class GetGroupJoinPreviewUseCase @Inject constructor(private val parfaitGroupRepository: ParfaitGroupRepository) {
    suspend operator fun invoke(inviteCode: InviteCode): Result<GroupName>   // GET join-preview
}
// 🔁 #261: JoinGroupUseCase 주입이 이 화면에서 빠졌다(S-102로 이동) — 여기는 미리보기만 부른다
// ❌ 삭제(#244): CheckInviteCodeValidUseCase · InviteCodeResult(표시 문자열 보유 — ADR-0016 이탈이었다)

// impl — MVI
data class GroupInviteCodeUiState(
    val text: String = "",
    val focusedIndex: Int? = null,
    val inputMode: InputMode = InputMode.ADD,
    val inviteCodeError: InviteCodeError? = null,   // 🔁 #244 — errorText: String? 에서 교체
    // ❌ 삭제(#261): groupName · isConfirmPopupVisible — 모달이 S-102로 이관되며 함께 나갔다
    val isSubmitting: Boolean = false,       // #244 신설. 🔁 #261 — 미리보기 조회 전용
    val clipboardInviteCode: String? = null, // #237
) : UiState {
    val codeLength = InviteCode.LENGTH       // #237에서 domain 상수로 이관
}
enum class InputMode { ADD, EDIT }

// 실패 사유는 feature 로컬 enum + 화면 매핑(ADR-0016 형태, 소유처는 core:ui가 아니라 이 모듈)
enum class InviteCodeError { INVALID_CODE, ALREADY_JOINED, MEMBER_LIMIT_REACHED, NETWORK, UNKNOWN }
@Composable internal fun InviteCodeError.toStringResource(): String

sealed interface GroupInviteCodeIntent : UiIntent {
    data object ClickNextButton; data object ClickBackButton
    data class InputWord(val index: Int, val word: String)
    data class SelectedTextFieldElement(val index: Int)
    data object HideKeyboard; data object FocusedFirstIndex
    // ❌ 삭제(#261): ClickConfirmPopupEnter · DismissConfirmPopup
    data class ClipboardCodeDetected(val code: String); data object ClickPasteInviteCode  // #237
}
sealed interface GroupInviteCodeSideEffect : UiSideEffect {
    data object NavigateToBack
    // 🔁 #261 — 참여 결과가 아니라 참여에 쓸 재료를 넘긴다(#244의 groupId: Long에서 교체)
    data class NavigateToNext(val inviteCode: String, val groupName: String)
}
```

## 동작 / 상태

- **입력**(`InputWord`): 현재 `inputMode`에 따라 들어온 글자를 다듬는다 — `ADD`는 그대로, `EDIT`는 앞 한 글자를
  버린다(이미 있는 글자 뒤에 새 글자가 붙어 들어오므로). 갱신 후 다음 포커스 인덱스를 계산하고
  `errorText`를 지운다. 총 길이는 `codeLength`로 자른다.
- **칸 선택**(`SelectedTextFieldElement`): 입력된 길이를 넘는 칸은 선택할 수 없다(`coerceAtMost`).
  선택 위치가 마지막 글자 뒤면 `ADD`, 중간이면 `EDIT`.
- **진입 자동 포커스**: Route가 `FocusedFirstIndex`를 한 번 보내 첫 칸을 잡는다.
- **키보드 동기화**: `focusedIndex`가 `null`이면 키보드를 내리고 아니면 올린다. 반대로 IME가 사라지면
  Route가 `HideKeyboard`를 보내 `focusedIndex`를 비운다(양방향).
- **확인**(`ClickNextButton`, 🔁 #261): 입력이 `codeLength`가 아니면 조회하지 않고 로그만 남긴다.
  통과하면 `GetGroupJoinPreviewUseCase(InviteCode(text))` →
  - 성공: 곧바로 `NavigateToNext(inviteCode = text, groupName = 응답값)` — **모달도 합류도 여기서 하지 않는다.**
    미리보기 응답은 상태에 담기지 않고 그대로 다음 화면 인자가 된다(#244의 `groupName` 상태 소멸).
  - 실패: `inviteCodeError` 반영(입력값·포커스는 남는다 — #237의 `copy` 정정).
  - **미리보기를 먼저 부르는 이유**(🔁 #261): 참여 상태를 바꾸지 않는 호출이라, 다음 화면이 띄울 그룹명을
    얻는 김에 잘못된 코드를 여기서 막는다. 실패 사유 3종이 이 화면과 S-102 양쪽에 있는 것은 그 때문이다 —
    미리보기와 참여 사이에 그룹 상태가 바뀌면 같은 사유가 S-102에서 다시 난다.
- **진행 플래그**(`isSubmitting`, #244 / 🔁 #261): 미리보기 조회에만 걸고 `finally`에서 끈다.
  확인 버튼 활성 조건(`text.length == codeLength && isSubmitting.not()`)이 유일한 소비처다
  (모달이 없어져 dismiss 가드는 사라졌다).
- **실패 매핑**(#244): `AppError.Network` → `NETWORK` / `AppError.Server`의
  `INVALID_INVITE_CODE`·`GROUP_ALREADY_JOINED`·`GROUP_MEMBER_LIMIT_REACHED` → 각 사유 / 그 외 `UNKNOWN`.
  ViewModel은 enum만 들고 문구는 화면이 `toStringResource()`로 붙인다 — 안드로이드 리소스를 보지 않아야
  테스트에서 그대로 검증된다는 KDoc.
- **뒤로가기**(`ClickBackButton`) → `NavigateToBack` → `navigator.onBack()`.

## 표시·제어 규칙

- 상단 `YGTopBarDetail(title = R.string.group_enter)`, 본문 `LazyColumn`(좌우 `padding7`·상하 `padding10`),
  제목 `title.t02B`/`Gray900` + 설명 `body.b02R`/`Gray500`, 하단 고정 `YGButton(Large)`.
- 코드 입력은 `InviteCodeInputField` + 칸마다 `InviteCodeInputFieldElement`(`weight(1f)`·`aspectRatio(7/8)`,
  칸 간격 `gap3`). 포커스 칸은 `index == focusedIndex`, 에러는 `inviteCodeError != null`로 전 칸에 함께 걸린다.
- 에러 문구는 입력 필드 아래 `caption.c01R`/`Cherry600`. 문구는 `feature/groups/enter/impl` `strings.xml`
  (`invite_code_error_*` 5종, #244) — 프리뷰 파라미터도 이제 리터럴이 아니라 `InviteCodeError` 값을 넘긴다.
- ~~**확인 모달**~~ — 🔁 **#261에서 이 화면에서 사라졌다**(모달 호출·프리뷰 케이스·`YGModalPopup` import 전부).
  문구(`group_enter_confirm_*`)는 `strings.xml`에 그대로 남아 이제 S-102가 쓴다
  → [s102 스펙](2026-07-22-s102-group-nickname.md).
- 정적 라벨은 `feature/groups/enter/impl` `res/values/strings.xml`(S-102·A-005와 파일 공용).
- 엔트리는 `YGScaffold(contentWindowInsets = WindowInsets(0.dp))` + `statusBarsPadding()`·`navigationBarsAndImePadding()`(S-102·A-005 엔트리와 같은 형태). #224 시점에는 Route가 `Modifier.imePadding()`을 한 번 더 걸어 인셋이 이중이었고, **#237이 Route 쪽을 걷어내 entry 단독으로 정리했다**.

## 파일 구성

- `api/NavKeyGroupInviteCode.kt` — 목적지 키.
- `impl/invitecode/GroupInviteCodeViewModel.kt` — UiState·Intent·SideEffect·MVI 처리.
- `impl/invitecode/GroupInviteCodeScreen.kt` — stateless UI + `PreviewParameterProvider`(🔁 #261 — 모달과 모달 프리뷰 케이스가 빠져 4케이스).
- `impl/invitecode/GroupInviteCodeRoute.kt` — VM 배선, 키보드·IME 동기화, next→`goTo(NavKeyGroupNickName)`.
- `impl/invitecode/component/InviteCodeInputField.kt`·`InviteCodeInputFieldElement.kt` — 칸 배열·개별 칸(feature 로컬).
- `impl/invitecode/component/InviteCodePasteBar.kt` — 클립보드 붙여넣기 제안 바(#237, feature 로컬).
- `domain/model/group/InviteCode.kt` — `LENGTH`·`parseOrNull`(#237). `core:util:android` `extension/ClipDescription.kt`.
- `core/ui` `strings.xml#group_invite_message` — S-101 복사와 공유하는 초대 메시지 템플릿(#237).
- `impl/navigation/EntryBuilder.kt#featureGroupInviteCodeEntryBuilder` · `NavigationModule.kt` — entry 등록·`@IntoSet`.
- `impl/invitecode/InviteCodeError.kt` — 실패 사유 enum + `toStringResource()`(#244 신설).
- `domain/usecase/group/GetGroupJoinPreviewUseCase.kt`(#244 신설). `JoinGroupUseCase.kt`는 남아 있으나
  소비처가 S-102로 옮겨갔다(#261). 삭제: `CheckInviteCodeValidUseCase.kt` · `domain/model/InviteCodeResult.kt`.
- 테스트(#244 / 🔁 #261): `GroupInviteCodeViewModelTest`에서 참여 케이스가 S-102 테스트로 옮겨가고
  미리보기 성공이 "초대코드·그룹명을 들고 이동"을 검증하는 형태로 바뀌었다(붙여넣기 케이스는 유지).

## 정책 대조 (위키)

| 위키 정책 | 코드 | 판정 |
|---|---|---|
| [[그룹]] "참여(A-004): 초대 코드 입력 → 그룹 합류" | 이 화면은 미리보기까지, 합류는 S-102 확인 모달(🔁 #261) | ✅ 방향 일치(합류 시점만 다음 화면) |
| [[기능정의서-v6]] A-004 다음 단계 = **C-001(메인 캔버스)** | 미리보기 통과 → S-102 → **G-001 그룹 목록** | ⚠️ **불일치** → [open-questions](../../synthesis/open-questions.md) [2026-08-12] |
| [[그룹]] 최대 12명 — 인원 초과·이미 가입 에러 케이스 | 서버 코드 `GROUP_MEMBER_LIMIT_REACHED`·`GROUP_ALREADY_JOINED`를 각각 문구로 매핑(#244). #261부터 **미리보기 단계에서 먼저** 걸린다 | ✅ 일치 |
| 초대 코드 자릿수 | `InviteCode.LENGTH`(domain 상수) | **정책 문서 없음** — 코드가 먼저 확정 |
| 실패 문구 | `strings.xml` 5종(#244) | **정책 문서 없음** — 코드가 먼저 확정 |

## 주의 / 열린 질문

- ~~**검증·그룹명이 전부 mock**~~ — ✅ **해소(#244)**. 둘 다 서버 응답이고 실패 분기도 실제로 도달한다.
- ~~**"참여하기"가 참여하지 않는다**~~ — #244가 모달 확인을 합류로 만들었고, 🔁 **#261은 모달째로 S-102에
  옮겨** 참여·닉네임을 한 번의 확인 뒤로 묶었다. 이 화면에는 참여를 약속하는 문구가 남아 있지 않다.
  ✅ **"중간 이탈 시 닉네임 없는 참여"도 함께 해소**됐다 — 미리보기는 참여 상태를 바꾸지 않으므로 여기서
  나가도 남는 것이 없다 → [open-questions](../../synthesis/open-questions.md) [2026-08-15] OQ-P-166.
- ~~**실패 시 상태 통째 교체**~~ → **#237에서 `copy`로 정정**(입력값·포커스가 살아남는다).
- **코드 자릿수 6의 근거는 여전히 코드다** — #237이 `codeLength`를 `InviteCode.LENGTH`로 끌어올려
  domain에 상수 하나로 모았지만, 정책 문서는 아직 없다.
- **`parseOrNull`이 초대 메시지 문구에 묶여 있다** — 템플릿(`core:ui` `group_invite_message`)이 바뀌면
  붙여넣기 감지도 함께 바뀐다. 템플릿을 못 찾으면 "텍스트 전체가 코드"만 인정하므로, 문구가 바뀐 구버전
  메시지를 붙여넣으면 감지되지 않는다.
- ~~**`errorText`가 domain에서 온다**~~ — ✅ **해소(#244)**. `InviteCodeResult`가 삭제되며 domain의
  표시 문자열이 사라졌고, 매핑은 `InviteCodeError.toStringResource()`가 한다.
  다만 소유처는 `core:ui`가 아니라 **feature 로컬**이다 — 단일 소비처라 ADR-0016 결정(공유 규칙엔 공유 매핑)과
  어긋나지 않지만, 같은 형태의 enum이 S-102에도 따로 생겨 **문구·갈래가 두 벌**이다(`NETWORK`·`UNKNOWN` 문구 동일)
  → [ADR-0016](../../adr/0016-domain-result-presentation-string-mapping.md) as-built.
- ~~**프리뷰 에러 문구가 코틀린 리터럴**~~ — ✅ **해소(#244)**. 프리뷰도 enum 값을 넘긴다.
