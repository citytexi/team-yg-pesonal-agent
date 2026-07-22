---
id: s002-account-info
title: S-002 계정 정보 화면 (AccountInfo)
status: draft
category: ui-spec
platforms: android
verified:
related_code:
  - NavKeyAccountInfo
  - AccountInfoRoute.kt#AccountInfoRoute
  - AccountInfoScreen.kt#AccountInfoScreen
  - AccountInfoViewModel.kt#AccountInfoViewModel
  - CheckNameValidUseCase.kt#CheckNameValidUseCase
  - NicknameResult.kt#NicknameResult
  - NickNameResultUiText.kt#toStringResource
  - EntryBuilder.kt#featureAppSettingEntryBuilder
related_adr: ADR-0005, ADR-0006, ADR-0009, ADR-0016
related_spec: s102-group-nickname, app-setting-s001
related_architecture: state-management, navigation-flow
supersedes:
superseded_by:
tags: [spec, parfait, setting, account, nickname, s002]
---

# Spec: S-002 계정 정보 화면 (AccountInfo)

> 상태·날짜·대상·관련은 frontmatter가 단일 출처. 본문은 설계에 집중.

- **화면 ID**: S-002 (앱 설정 → 계정 정보)
- **대상 모듈**: `feature/app/setting/impl`(`route/`·`screen/`·`viewmodel/`) + `domain`(공유 UseCase 확장)
- **진입**: S-001 앱 설정([[app-setting-s001]])의 "계정 정보" 항목 → `NavKeyAccountInfo`. Route stub·entry·NavKey는 S-001에서 이미 생성됨 → 이 스펙은 stub 본문을 채운다.
- **입력 유효성**: 위키 [[S-002-앱닉네임-정책-v0.1]]·[[이름-입력-규칙]]. S-102와 규칙 동일(앱/그룹 공통 15자).

## 목표

계정 레벨(앱) 닉네임을 조회·수정하고, 로그아웃·서비스 탈퇴 진입점을 제공하는 화면.
닉네임은 입력 즉시 유효성 검사를 돌려 위반 시 인라인 에러를 노출한다.

## 범위

- 포함: 닉네임 입력 폼(최대 15자)·**입력 시 실시간** 유효성 검사·에러 메시지 인라인 노출·클리어(X)·로그아웃/탈퇴 진입점 UI·뒤로가기.
- 제외(구현 TODO):
  - **닉네임 저장 영속화** — 프로필 API 미연동. `nickname` 초기값은 placeholder, 저장 usecase 없음(로컬 상태+검증까지만).
  - **로그아웃 / 서비스 탈퇴** — Intent는 정의하되 ViewModel 핸들러는 stub(logger + TODO, side effect·API 없음).

## 화면 구성 (전부 기존 DS 컴포넌트 재사용)

- 상단 `YGTopBarBack`(title="계정 정보"), `onIconClick` → 뒤로.
- 섹션 라벨 "닉네임"(`YGTheme.typography` body, Gray).
- `YGTextFormField(value, onValueChange, maxLength = 15, isError, errorDescription)` — 카운터(N/15)·클리어(X)·포커스/에러 테두리 내장.
- `YGDangerZone(topZone = YGActionItem("로그아웃"), bottomZone = YGActionItem("서비스 탈퇴하기"))`.

## API / 인터페이스

```kotlin
// api — 이미 존재(S-001)
@Serializable data object NavKeyAccountInfo : NavKey

// domain — 의미 sealed 결과(ADR-0016). 표시 문자열 미보유.
sealed interface NicknameResult {
    data object Success : NicknameResult
    sealed interface Error : NicknameResult {
        data object Empty : Error
        data object SpaceAtEdge : Error
        data object DuplicatedSpace : Error
        data object InvalidCharacter : Error
    }
}
class CheckNameValidUseCase @Inject constructor() {   // ADR-0009
    operator fun invoke(nickName: String): NicknameResult
}

// core:ui — 표시 문자열 매핑(ADR-0016). setting·groups 공용.
@Composable fun NicknameResult.Error.toStringResource(): String

// impl — MVI (기존 AppSetting 패턴 미러)
data class AccountInfoUiState(
    val nickName: String = /* placeholder */ "",
    val nickNameError: NicknameResult.Error? = null,   // 의미만, 문자열은 Screen이 매핑
) : UiState

sealed interface AccountInfoIntent : UiIntent {
    data class InputWord(val nickName: String) : AccountInfoIntent
    data object ClickBack : AccountInfoIntent
    data object ClickLogout : AccountInfoIntent
    data object ClickWithdraw : AccountInfoIntent
}
sealed interface AccountInfoSideEffect : UiSideEffect {
    data object NavigateBack : AccountInfoSideEffect
}
```

## 동작 / 상태

- **입력**(`InputWord`): `nickName` 갱신 + **즉시** `CheckNameValidUseCase(nickName)` 실행 →
  결과를 `nickNameError = result as? NicknameResult.Error`로 반영(`Success`면 `null`). 확인 버튼이 없으므로 검증은 실시간.
  표시 문자열은 Screen이 `nickNameError?.toStringResource()`로 렌더 시점 매핑(ADR-0016).
- **길이 상한**: `AccountInfoScreen` 상수 `NICKNAME_MAX_LENGTH = 15` → `YGTextFormField(maxLength = 15)`가
  16번째 글자 입력을 하드 차단. UseCase는 길이 미검사(입력 단계에서 강제). 위키 "1~15자"와 일치.
- **뒤로가기**(`ClickBack`) → `NavigateBack` → `navigator.onBack()`.
- **로그아웃/탈퇴**(`ClickLogout`/`ClickWithdraw`): VM 핸들러 stub(logger + TODO). side effect·네비게이션 없음.

### 유효성 규칙 (`CheckNameValidUseCase`, 순차 검사 — 첫 실패 반환)

기존 3규칙에 **빈 값 규칙을 선두에 추가**한다(4케이스 전부 정책 단일 소유). 각 규칙은 `NicknameResult.Error` 변형을 반환하고, 표시 문자열은 core:ui `strings.xml`이 소유(ADR-0016). 위키 정책 이미지 매핑:

| 순서 | 규칙(enum) | 조건 | 반환 Error | 표시 문자열(core:ui) |
|---|---|---|---|---|
| 1 | `CheckEmpty` (신규) | 빈 값 불가 | `Error.Empty` | "닉네임은 비워둘 수 없어요" |
| 2 | `CheckSpaceStartOrEnd` | 처음/끝 공백 불가 | `Error.SpaceAtEdge` | "닉네임의 처음과 끝에는 공백을 사용할 수 없어요" |
| 3 | `CheckDuplicatedSpace` | 연속 공백(`"  "`) 불가 | `Error.DuplicatedSpace` | "공백은 글자 사이에 1칸만 사용할 수 있어요" |
| 4 | `CheckValidCharacter` | 한글/영문/숫자/공백만 | `Error.InvalidCharacter` | "한글, 영문, 숫자, 띄어쓰기만 사용할 수 있어요" |

- **에러 문자열 출처**: domain은 `Error` 변형만 반환, 문자열은 `core:ui` `NickNameResultUiText.kt#toStringResource` + `strings.xml`이 매핑(ADR-0016, 다국어 통합). setting·groups 공용.
- **S-102 동반 리팩터**: `NicknameResult` sealed 전환으로 S-102(GroupNickName VM/Screen)도 동반 수정됨(`nickNameError` 보유·`toStringResource` 매핑). `CheckEmpty`는 S-102 확인 버튼 `isNotEmpty()` 비활성으로 런타임 미도달. [[s102-group-nickname]] as-built 갱신 완료.

## 파일 구성

- `feature/app/setting/api/NavKeyAccountInfo.kt` — 목적지 키(**기존, 무변경**).
- `feature/app/setting/impl/navigation/EntryBuilder.kt` — `entry<NavKeyAccountInfo>` 이미 `AccountInfoRoute` 연결(**무변경**).
- `feature/app/setting/impl/route/AccountInfoRoute.kt` — VM 배선(`hiltViewModel`·`collectAsStateWithLifecycle`·`LaunchedEffect` effect 수집), back→onBack. **stub 본문 채움**.
- `feature/app/setting/impl/screen/AccountInfoScreen.kt` — stateless UI + 상수 `NICKNAME_MAX_LENGTH`. `@YGPreview`(기본/포커스/에러 상태 PreviewParameter).
- `feature/app/setting/impl/viewmodel/AccountInfoViewModel.kt` — MVI, `CheckNameValidUseCase` 주입.
- `feature/app/setting/impl/res/values/strings.xml` — `account_info_title`·`account_info_nickname_label`·`account_info_logout`·`account_info_withdraw`(닉네임 에러 문자열은 core:ui 소유라 제외).
- `domain/.../model/NicknameResult.kt` — sealed interface 전환(`Success`/`Error.*`), 문자열 제거(ADR-0016).
- `domain/.../usecase/group/CheckNameValidUseCase.kt` — `CheckEmpty` 규칙 선두 추가 + `Error` 변형 반환.
- `core/ui/.../text/NickNameResultUiText.kt` — `NicknameResult.Error.toStringResource()`(@Composable) 매핑(신규, 공용).
- `core/ui/res/values/strings.xml` — 닉네임 에러 4문자열(신규). `core/ui/build.gradle.kts`에 `:domain` 의존 추가.

## 검증

프로젝트에 테스트 인프라 없음(S-001·S-102 등 선례 동일) → 유닛테스트 미작성. 다음으로 검증:

- **컴파일**: `:feature:app:setting:impl`·`:domain` 컴파일 통과.
- **ktlint**: `ktlintCheck` 통과.
- **`@YGPreview`**: 기본(placeholder 닉네임)·에러(각 케이스) 상태 프리뷰 렌더 확인.
- **유효성 수동 확인**: `CheckEmpty` 추가로 빈 값→에러, 나머지 3케이스 정책 이미지와 메시지 일치.

## 주의 / 열린 질문

- **닉네임 저장 미구현** — 프로필 조회/수정 API 연동 시 초기값 로드 + 저장 트리거(포커스 해제/IME 완료 등) 확정 필요.
- **로그아웃/탈퇴 미구현** — auth·회원 API 연동 시 확인 모달(YGModalPopup) + 실제 처리 결선 필요.
- 유효성: 문자·공백 규칙은 UseCase, 길이(15)는 Screen 상수로 검사 위치 이원화(S-102와 동일 구조) — 단일 소유처 아님(향후 통합 여지).
