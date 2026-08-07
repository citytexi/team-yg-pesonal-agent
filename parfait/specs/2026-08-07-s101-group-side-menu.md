---
id: s101-group-side-menu
title: 그룹 사이드 메뉴 화면 (S-101 GroupSetting) + S-102 닉네임 편집 모드
status: draft
category: ui-spec
platforms: android
verified: 2026-08-07
related_code: NavKeyGroupSetting.kt, GroupSettingRoute.kt#GroupSettingRoute, GroupSettingScreen.kt#GroupSettingScreen, GroupSettingViewModel.kt#GroupSettingViewModel, GroupSettingViewModel.kt#GroupSettingState, GroupNicknameField.kt#GroupNicknameField, GroupMemberList.kt#GroupMemberList, EntryBuilder.kt#featureGroupSettingEntryBuilder, YGColorChipType.kt, YGNametagChipPreviewData.kt, YGTopBar.kt#YGTopBarDetail, YGTextFormField.kt#YGTextFormField, YGUserChip.kt#YGUserChip, YGInviteCard.kt#YGInviteCard, YGDangerZone.kt#YGDangerZone, YGActionItem.kt#YGActionItem, CheckNameValidUseCase.kt
related_adr: ADR-0005, ADR-0006, ADR-0010, ADR-0016
related_spec: app-setting-s001, s002-account-info, s102-group-nickname, designsystem-grouptag-topping-components, clearfocusontap-modifier
related_architecture: design-system, navigation-flow, state-management, module-structure
supersedes:
superseded_by:
tags: [spec, parfait, feature, groups, setting, navigation]
---

# Spec: 그룹 사이드 메뉴 화면 (S-101) + S-102 닉네임 편집 모드

- 대상: `:feature:groups:setting:api` · `:feature:groups:setting:impl` (+ `core:designsystem` `ygcolorchip` 드리프트 수정)
- 이슈: `mash-up-kr/TEAMYG-Android` #211, 브랜치 `feature/#211-S-101-group-side-menu`
- Figma(파르페 v0.1): `S-101` 기본 `144:7450` · 복사됨 `430:977` · `S-102` 편집 유효 `220:2662` · 편집 오류 `144:8245` · `Nametag-Chip` 컴포넌트셋 `144:5415`
- 위키 화면 정의: `S-` = Sidebar, `S-101`(그룹 메뉴) — [[화면-ID-체계]] / 닉네임 유효성 [[S-102-닉네임-정책-v0.2]] / 컬러칩 [[nametag-chip]]

> 상태·날짜·대상·관련은 frontmatter가 단일 출처. 본문은 설계 내용에 집중.

## 목표

그룹 사이드 메뉴 화면 S-101을 구현한다. 그룹 속 내 닉네임(조회 + 인라인 편집) · 그룹원 목록 · 초대 코드 카드 · Danger Zone(그룹 나가기 / 그룹 신고하기)의 4블록으로 구성한다. 데이터는 이번 범위에서 **ViewModel Mock 상태**로 두고 실제 API는 결선하지 않는다(G-001 그룹 목록과 같은 단계).

Figma의 `S-102`는 별도 화면이 아니라 **이 화면의 닉네임 편집 상태**다. 편집 중에도 그룹원 목록·초대 코드·Danger Zone이 같은 자리에 그대로 남고 하단에 `확인` 버튼과 키보드만 얹힌다. 따라서 라우트를 분리하지 않고 단일 화면의 상태 분기로 구현한다.

## 범위

- **포함**:
  - `GroupSettingRoute`(현재 `// TODO impl` stub) 본문 구현 + `GroupSettingScreen`(stateless) + `GroupSettingViewModel`(MVI).
  - 닉네임 인라인 편집 모드: 포커스 진입 · 실시간 유효성 검사 · `확인` 버튼 활성/비활성 · 확정/취소.
  - 초대 코드 복사(클립보드) + 카드 우측 텍스트 `복사됨` 전환.
  - Danger Zone 2항목 UI + 클릭 stub.
  - 화면 로컬 컴포넌트 2종(`GroupNicknameField`·`GroupMemberList`) + 문자열 리소스.
  - `YGColorChipType` 드리프트 2건 수정(아래 별도 절).
- **제외**:
  - 그룹 상세 조회·닉네임 변경·그룹 탈퇴·신고 **API 연동**. Repository·UseCase 신설 없음(`ParfaitGroupRemoteDataSource`는 이미 있으나 이번엔 쓰지 않는다).
  - 그룹 나가기·신고 **확인 모달** — Figma 미제공.
  - 상단바 `List-Member`(멤버 겹침 칩) — Figma에서 `opacity 0`이라 비노출이 정답.
  - `+N` 칩(`NametagChipPlus`) — Figma 주석상 캔버스 전용(그룹 멤버수 > 5일 때 남은 수), 이 화면 소관 아님.
  - 신규 디자인시스템 컴포넌트·에셋·토큰 **0건**.

## 모듈 / 파일 구성

```
feature/groups/setting/api/.../
  NavKeyGroupSetting.kt              (기존 유지 — data object, Mock이라 groupId 인자 없음)
feature/groups/setting/impl/.../
  route/GroupSettingRoute.kt         (구현: hiltViewModel + collectAsStateWithLifecycle + effect 수집)
  screen/GroupSettingScreen.kt       (신규: stateless UI)
  viewmodel/GroupSettingViewModel.kt (신규: State/Intent/SideEffect + VM 동거 — S-001 선례)
  component/GroupNicknameField.kt    (신규: YGLabel + YGTextFormField)
  component/GroupMemberList.kt       (신규: YGLabel + YGUserChip 목록)
  navigation/EntryBuilder.kt         (수정: Scaffold 배경 White)
  res/values/strings.xml             (신규)
core/designsystem/.../component/ygcolorchip/
  YGColorChipType.kt                 (수정: 드리프트 2건)
  YGNametagChipPreviewData.kt        (수정: 위 변경 반영)
```

재사용 디자인시스템 심볼: `YGTopBarDetail` · `YGLabel` · `YGTextFormField` · `YGUserChip`/`YGNametagChip` · `YGInviteCard` · `YGDangerZone` + `YGActionItem` · `YGButton(YGButtonType.Large)` · `YGScreen`. 재사용 도메인 심볼: `CheckNameValidUseCase` · `NameValidResult` · `GroupCreateConfig`(닉네임 상한).

## State / ViewModel

한 파일(`GroupSettingViewModel.kt`)에 State + Intent/SideEffect + ViewModel 동거(MVI, `BaseViewModel` 상속). 내비게이션·클립보드는 Intent → SideEffect 경유.

```kotlin
data class GroupMemberUiModel(
    val nickname: String,
    val colorChipType: YGColorChipType,
    val isMe: Boolean,
)

data class GroupSettingState(
    val groupName: String,                 // Mock
    val myNickname: String,                // 확정된 내 닉네임
    val nicknameInput: String,             // 편집 중 입력값
    val isEditing: Boolean = false,
    val nicknameErrorResId: Int? = null,   // @StringRes, core:ui 리소스
    val members: List<GroupMemberUiModel>, // Mock
    val inviteCode: String,                // Mock
    val remainingCount: Int,               // Mock
    val isCodeCopied: Boolean = false,
) : UiState

sealed interface GroupSettingIntent : UiIntent {
    data object ClickBack : GroupSettingIntent
    data class InputNickname(val value: String) : GroupSettingIntent
    data class ChangeNicknameFocus(val isFocused: Boolean) : GroupSettingIntent
    data object ClickConfirmNickname : GroupSettingIntent
    data object ClickCopyInviteCode : GroupSettingIntent
    data object ClickLeaveGroup : GroupSettingIntent
    data object ClickReportGroup : GroupSettingIntent
}

sealed interface GroupSettingSideEffect : UiSideEffect {
    data object NavigateBack : GroupSettingSideEffect
    data class CopyInviteCode(val code: String) : GroupSettingSideEffect
}
```

- `processIntent`는 intent별 private `handle*()`에 위임하고, 각 `handle*`이 `updateState`/`postSideEffect`를 호출한다(S-001 선례와 동일하게 `when` 분기가 직접 `postSideEffect`를 부르지 않는다).
- 파생값은 State의 계산 프로퍼티로 둔다.
  - `isConfirmEnabled` = `nicknameErrorResId == null && nicknameInput != myNickname` — 유효성 통과 + 실제 변경이 있을 때만 활성.
  - `inviteCardStatus` = `remainingCount > 0`이면 `Active`, 아니면 `Invalid`.
  - `memberCount` = `members.size`.
- Mock 데이터는 State 기본값으로 둔다(G-001 `GroupListUiState` 선례). 실연동 시 교체 지점을 한 곳으로 모으기 위해 `// TODO: API 연동` 주석을 기본값 옆에 남긴다.

## 편집 모드 동작

| 사건 | 처리 |
|---|---|
| 닉네임 필드 포커스 획득 | `ChangeNicknameFocus(true)` → `isEditing = true`. `확인` 버튼 노출 |
| 입력 | `InputNickname` → `nicknameInput` 갱신 + **매 입력마다** `CheckNameValidUseCase` 실행해 `nicknameErrorResId` 갱신 |
| 유효성 실패 | 필드 `isError = true`(테두리·카운터 강조) + 하단 에러 문구 + `확인` 비활성. Figma `144:8245` 주석 "닉네임 유효성 검사 통과하지 못할 시 비활성화" |
| `확인` 클릭 | `myNickname = nicknameInput`, `isEditing = false`, 포커스 해제 |
| 배경 탭 / 뒤로가기 | 편집 취소 — `nicknameInput = myNickname`, `nicknameErrorResId = null`, `isEditing = false` |

- 길이 상한은 `YGTextFormField(maxLength = GroupCreateConfig.NICKNAME_MAX_LENGTH)`로 컴포넌트가 입력 자체를 막는다(15자). 카운터 `n/15`·클리어 버튼·포커스/에러 테두리는 `YGTextFieldImpl`에 이미 구현돼 있어 추가 작업이 없다.
- 검증 시점이 기존 `GroupNickNameViewModel`(클릭 시점)과 다르다. 이 화면은 버튼 활성 상태 자체가 검증 결과에 걸려 있어 **입력 시점 검증**이어야 한다 — `AccountInfoViewModel`(S-002)과 같은 방식이다.
- 에러 문자열은 `core:ui`의 기존 리소스를 재사용한다(`error_duplicated_space`·`error_invalid_character`·`error_space_at_edge_nickname`·`error_empty_space_nickname`). ADR-0016의 매핑 위치 미결(도메인 결과 → `@StringRes`)은 이 화면에서 새로 결정하지 않고 S-002 as-built(VM에서 매핑)를 따른다.
- 배경 탭 취소는 `clearFocusOnTap()`(opt-in Modifier)을 화면 루트에 건다. 포커스 해제가 곧 편집 종료이므로 별도 취소 버튼을 두지 않는다.

## UI 매핑 (Figma → 심볼)

루트: `YGScreen(modifier.clearFocusOnTap())` 안에 `Box(fillMaxSize)` — 스크롤 콘텐츠 + 하단 고정 버튼 영역.

| Figma | 구현 |
|---|---|
| Top Bar (Status=Detail) | `YGTopBarDetail(title = state.groupName, onIconClick = onClickBack)` |
| Contents 컨테이너 | `Column(verticalScroll)` · 좌우 `padding.padding7` · 블록 간 `Arrangement.spacedBy(gap.gap8)` · 상단 `padding.padding8` |
| Input-Field | `GroupNicknameField`: `YGLabel` + `YGTextFormField(value, onValueChange, maxLength, isError, errorDescription)`, 라벨↔필드 `gap.gap4` |
| Member-List | `GroupMemberList`: `YGLabel` + `Column(spacedBy(gap.gap4), padding top gap.gap3)` |
| └ User-Chip | `YGUserChip(colorChipType, userFirstName, chip = YGNametagChipStyle.Style40, userName, userStyle)` — 본인은 `YGUserNameStyle.StyleBold` + 이름 뒤 `(나)`, 타인은 `StyleMedium` |
| Invite-Card | `YGInviteCard(label, inviteCode, subText, status, copyButtonText, onCopyClick)` 그대로 사용(신규 없음) |
| Danger-Zone | `YGDangerZone(topZone = YGActionItem(그룹 나가기), bottomZone = YGActionItem(그룹 신고하기))`, `fillMaxWidth` |
| Button-Area (편집 모드) | `Box`의 `Alignment.BottomCenter` + `Modifier.imePadding()`, 배경 `YGAtomicColors.Gray.White` + 사방 `padding.padding7`, `YGButton(text = 확인, buttonType = YGButtonType.Large, isEnabled = state.isConfirmEnabled)`. `isEditing`일 때만 컴포지션 |

- 목록은 최대 12명(위키 [[그룹]])이라 `LazyColumn` 대신 `Column` + `verticalScroll`을 쓴다. 화면 전체가 하나의 스크롤 축이어야 초대 코드·Danger Zone까지 자연스럽게 따라온다.
- 닉네임 첫 글자는 `nickname.first()`로 뽑는다(`YGUserChip.userFirstName`).
- `imePadding()`은 `GroupInviteCodeRoute` 선례와 같고, `MainActivity`가 `enableEdgeToEdge()`를 켜둬 IME 인셋이 전달된다.

## 초대 코드 복사

- `ClickCopyInviteCode` → `postSideEffect(CopyInviteCode(state.inviteCode))` + `isCodeCopied = true`.
- `GroupSettingRoute`가 effect를 받아 Compose 클립보드 API로 복사한다(화면 밖 플랫폼 자원이므로 VM이 직접 만지지 않는다).
- 카드 우측 문구는 `isCodeCopied`면 `복사됨`(Figma `430:977`), 아니면 `N명 남음`. `remainingCount == 0`이면 `YGInviteCardStatus.Invalid`로 떨어지며 이때 문구는 컴포넌트 규약대로 별도 문자열을 넘긴다.
- **`복사됨`의 복귀 규칙이 디자인에 없다.** 이 스펙은 *화면을 벗어나기 전까지 유지*로 확정한다(타이머 없음) — 근거 없는 초 단위 값을 만들지 않기 위함. → 열린 질문.

## `YGColorChipType` 드리프트 수정 (동반 변경)

Figma 컴포넌트셋 `144:5415`는 타입 `1~12` + `+` = 13종인데 코드는 `NametagChip1~13` + `NametagChipPlus` = 14종이다. 대조 결과 원인 2건:

1. **`NametagChip11`이 `NametagChip3`과 완전 중복**(Cherry400 / Cherry100 / Melon500). 이 중복 때문에 뒤 항목이 한 칸씩 밀려 코드 `12`가 Figma `11`, 코드 `13`이 Figma `12`에 대응한다.
2. **`NametagChip9`의 텍스트 색 드리프트** — Figma 9번은 Melon500 / Cherry50 / **Pudding500**인데 코드는 텍스트도 Cherry50이라 글자색이 테두리색과 같다.

조치: `NametagChip11`(중복)을 삭제하고 이후 항목을 재번호(`12`→`11`, `13`→`12`)해 **12종 + Plus**로 Figma와 정렬한다. `NametagChip9`의 `textColor`를 `Pudding.Pudding500`으로 정정한다. `YGNametagChipPreviewData`의 목록도 함께 맞춘다.

영향 범위 확인됨 — `YGColorChipType` 실사용처는 `YGNametagChipPreviewData`와 `YGTopBar` 프리뷰(`NametagChip5`, 변경 대상 아님)뿐이고 화면 코드 사용처는 0건이다. 이 수정으로 위키 [[nametag-chip]] "12종"과 코드가 일치하며, [open-questions](../synthesis/open-questions.md)의 12종/14종 불일치 항목이 닫힌다.

## 컬러칩 배정 규칙

- 타입 배정 주체는 **미정**이다(위키 [[nametag-chip]]: 타입은 유저별로 고정, 부여 주체 미기재). 서버 `ParfaitGroupMemberResponse`도 `memberId`·`groupNickname` 2필드뿐이라 타입 정보가 없다.
- 이번 범위는 Mock이므로 **목록 인덱스 순환**으로 배정하고, 실연동 시 교체할 지점에 TODO를 남긴다. 12종을 넘는 인덱스는 나머지 연산으로 감싼다.

## 문자열 리소스 (`res/values/strings.xml`)

| key | 값 |
|---|---|
| `group_setting_nickname_label` | 그룹 속 내 닉네임 |
| `group_setting_member_label` | 그룹원 (%1$d) |
| `group_setting_invite_label` | 그룹 초대 코드 |
| `group_setting_invite_remaining` | %1$d명 남음 |
| `group_setting_invite_copied` | 복사됨 |
| `group_setting_invite_full` | 최대 인원 도달 |
| `group_setting_copy` | 복사 |
| `group_setting_leave` | 그룹 나가기 |
| `group_setting_report` | 그룹 신고하기 |
| `group_setting_confirm` | 확인 |
| `group_setting_me_suffix` | (나) |

정적 UI 라벨만 리소스화한다. 닉네임·그룹명·초대 코드처럼 **데이터인 값은 State 소유**다. 유효성 에러 문구는 `core:ui` 기존 리소스를 재사용한다.

## 네비게이션 배선

- `EntryBuilder`(`featureGroupSettingEntryBuilder`)는 기존 entry 하나를 유지하되 `YGScaffold` 배경을 `YGAtomicColors.Gray.White`로 지정한다(S-101 화면 흰 배경).
- `NavigateBack → navigator.onBack()`.
- 이 화면으로 들어오는 경로(G-001 또는 C-001)는 이번 범위 밖이다. 현재 `goTo(NavKeyGroupSetting)` 호출자는 없다.

## 검증

- **자동화 테스트 없음** — 이 저장소는 테스트 소스셋이 없다(테스트 기반은 별도 스펙 `2026-08-06-unit-test-infrastructure` 진행 중). 별도 지침 전까지 테스트 파일을 만들지 않는다.
- 검증선: `:feature:groups:setting:impl` · `:core:designsystem` **컴파일** + **ktlint** 통과.
- `@YGPreview` + `PreviewBox` 프리뷰: 기본 상태 / 편집 유효 / 편집 오류 / 초대 코드 `복사됨` / `Invalid`(정원 초과) 5종.
- 실기기 육안: 키보드 오르내림에 따라 `확인` 버튼이 붙어 움직이는지, 배경 탭으로 편집이 취소되는지, 클립보드에 코드가 실제로 복사되는지.
- **긴 닉네임 프리뷰를 반드시 포함한다** — `bar-listdate` 라운드에서 짧은 샘플만 쓰다 폭 측정 결함을 놓친 전례가 있다. 15자 닉네임 + 긴 그룹명 케이스를 프리뷰에 넣는다.

## 주의 / 열린 질문

- **`복사됨` 복귀 규칙 없음** — 디자인 미기재. 이 스펙은 화면 이탈 전까지 유지로 가정한다.
- **`NavKeyGroupSetting`에 `groupId`가 없다** — Mock이라 지금은 무해하나 실연동 시 인자 추가가 필요하다.
- **서버 그룹 상세 응답에 `groupName`·`memberLimit`가 없다** — `GET /api/parfait-groups/{groupId}`는 `groupId`·`groupNickname`·`inviteCode`·`members`만 준다([api/parfait-group.md](../api/parfait-group.md)). 상단바 제목과 `N명 남음`의 출처가 계약상 없다. 그룹 목록 API에서 이름을 받아 NavKey로 넘기거나 서버에 필드 추가를 요청해야 한다.
- **컬러칩 타입 부여 주체 미정** — 서버 응답에 타입이 없어 Mock 인덱스 순환으로 대체.
- **그룹 나가기·신고 확인 모달 미제공** — 클릭은 stub(로그 + TODO)이다. Danger Zone 동작 자체가 미구현이라는 뜻이다.
- **화면 진입 경로 없음** — `NavKeyGroupSetting`으로 `goTo` 하는 호출자가 아직 없어 이번 라운드에서는 프리뷰·수동 진입으로만 확인된다.
