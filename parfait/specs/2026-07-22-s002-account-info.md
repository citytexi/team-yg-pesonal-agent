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
  - NameValidResult.kt#NameValidResult
  - GroupCreateConfig.kt#GroupCreateConfig
  - core/ui/res/values/strings.xml
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
>
> ⚠️ **선행 리팩터가 먼저 머지됨(2026-07-29, PR #179)** — 이 스펙이 Task 1로 예정했던 domain 리팩터(빈 값 규칙 추가 +
> 의미 sealed 반환)를 **다른 작업(A-005 그룹 생성)이 먼저 구현해 develop에 넣었다.** 형태가 이 스펙·[ADR-0016](../adr/0016-domain-result-presentation-string-mapping.md) 원안과 다르다:
> `NicknameResult` → **`NameValidResult`**(그룹명 공용), `Error.Empty` → **`Error.EmptyString`**(enum 순서상 마지막이나 결과 동일),
> UseCase 패키지에서 `group` 제거·인자명 `name`, 길이 상한은 `domain` **`GroupCreateConfig`**,
> **`core:ui` `toStringResource()` 확장은 머지되지 않았고** 표시 매핑은 각 feature ViewModel이 `@StringRes` ID로 수행한다.
> 에러 문자열 리소스는 `core:ui` `strings.xml`에 이미 존재(닉네임용 4종). 아래 본문은 **as-built 계약 기준으로 갱신**했고,
> 매핑 위치를 원안(core:ui 확장)으로 되돌릴지는 미결 → [open-questions](../synthesis/open-questions.md) [2026-07-29].
> **남은 구현 범위는 `feature/app/setting/impl`의 AccountInfo 3종(Route/Screen/ViewModel)뿐이다.**

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

// domain — 의미 sealed 결과(ADR-0016 방향). 표시 문자열 미보유. **as-built, #179로 이미 머지됨(무변경)**
sealed interface NameValidResult {
    data object Success : NameValidResult
    sealed interface Error : NameValidResult {
        data object EmptyString : Error
        data object SpaceAtEdge : Error
        data object DuplicatedSpace : Error
        data object InvalidCharacter : Error
    }
}
class CheckNameValidUseCase @Inject constructor() {   // ADR-0009, 패키지 domain.usecase
    operator fun invoke(name: String): NameValidResult
}

// core:ui — 에러 문자열 리소스(닉네임용 4종). **as-built, #179로 이미 머지됨(무변경)**
//   원안의 NicknameResult.Error.toStringResource() 확장은 미머지 → VM이 리소스 ID로 매핑.

// impl — MVI (기존 AppSetting 패턴 미러 + GroupNickNameViewModel as-built 미러)
data class AccountInfoUiState(
    val nickName: String = /* placeholder */ "",
    val nickNameErrorResId: Int? = null,   // VM이 NameValidResult.Error → core:ui @StringRes 매핑
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
  결과를 `when`으로 분기해 `nickNameErrorResId`에 `core:ui` 문자열 리소스 ID를 담는다(`Success`면 `null`).
  확인 버튼이 없으므로 검증은 실시간. Screen은 `stringResource(id)`로 렌더한다(as-built 관용구, `GroupNickNameViewModel` 미러).
- **길이 상한**: `domain` `GroupCreateConfig.NICKNAME_MAX_LENGTH` → `YGTextFormField(maxLength = …)`가
  16번째 글자 입력을 하드 차단. UseCase는 길이 미검사(입력 단계에서 강제). 위키 "1~15자"와 일치.
  (#179에서 상수 소유처가 Screen 지역 상수 → domain 설정 객체로 이동됨 — 화면별 상수 재정의 금지.)
- **뒤로가기**(`ClickBack`) → `NavigateBack` → `navigator.onBack()`.
- **로그아웃/탈퇴**(`ClickLogout`/`ClickWithdraw`): VM 핸들러 stub(logger + TODO). side effect·네비게이션 없음.

### 유효성 규칙 (`CheckNameValidUseCase`, 순차 검사 — 첫 실패 반환)

**이 절은 #179로 이미 머지 완료 — S-002 구현 시 domain 변경은 없다.** 4케이스 전부 공용 UseCase가 단일 소유하고,
각 규칙은 `NameValidResult.Error` 변형을 반환한다. 표시 문자열은 `core:ui` `strings.xml` 소유(ADR-0016 방향). 위키 정책 이미지 매핑:

| 순서(as-built) | 규칙(enum) | 조건 | 반환 Error | 표시 문자열(core:ui) |
|---|---|---|---|---|
| 1 | `CheckSpaceStartOrEnd` | 처음/끝 공백 불가 | `Error.SpaceAtEdge` | "닉네임의 처음과 끝에는 공백을 사용할 수 없어요" |
| 2 | `CheckDuplicatedSpace` | 연속 공백(`"  "`) 불가 | `Error.DuplicatedSpace` | "공백은 글자 사이에 1칸만 사용할 수 있어요" |
| 3 | `CheckValidCharacter` | 한글/영문/숫자/공백만 | `Error.InvalidCharacter` | "한글, 영문, 숫자, 띄어쓰기만 사용할 수 있어요" |
| 4 | `CheckEmptyString` | 빈 값 불가 | `Error.EmptyString` | "닉네임은 비워둘 수 없어요" |

> 원안은 빈 값 규칙을 **선두**에 두려 했으나 as-built는 마지막이다. 빈 문자열은 앞 3규칙을 모두 공백 통과하므로 결과는 같다.

- **에러 문자열 출처**: domain은 `Error` 변형만 반환, 문자열은 `core:ui` `strings.xml`이 소유(다국어 통합). setting·groups 공용.
  단 **매핑 코드는 각 feature ViewModel**에 있다(as-built) — 원안의 `core:ui` 확장으로 수렴할지는 미결.
- **S-102·A-005 동반**: 같은 UseCase를 그룹 내 닉네임(S-102)·그룹명(A-005)이 공유한다. 그룹명 화면은 `SpaceAtEdge`·`EmptyString`만 그룹명용 문자열로 분기.
  `EmptyString`은 S-102·S-002 모두 입력 비어있을 때만 도달.

## 파일 구성

- `feature/app/setting/api/NavKeyAccountInfo.kt` — 목적지 키(**기존, 무변경**).
- `feature/app/setting/impl/navigation/EntryBuilder.kt` — `entry<NavKeyAccountInfo>` 이미 `AccountInfoRoute` 연결(**무변경**).
- `feature/app/setting/impl/route/AccountInfoRoute.kt` — VM 배선(`hiltViewModel`·`collectAsStateWithLifecycle`·`LaunchedEffect` effect 수집), back→onBack. **stub 본문 채움**.
- `feature/app/setting/impl/screen/AccountInfoScreen.kt` — stateless UI(길이 상한은 `GroupCreateConfig` 참조). `@YGPreview`(기본/포커스/에러 상태 PreviewParameter).
- `feature/app/setting/impl/viewmodel/AccountInfoViewModel.kt` — MVI, `CheckNameValidUseCase` 주입 + `NameValidResult.Error` → `core:ui` `@StringRes` 매핑.
- `feature/app/setting/impl/res/values/strings.xml` — `account_info_title`·`account_info_nickname_label`·`account_info_logout`·`account_info_withdraw`(닉네임 에러 문자열은 core:ui 소유라 제외).
- ~~`domain` 모델·UseCase 변경~~ — **#179로 머지 완료(무변경)**: `NameValidResult` sealed, `CheckNameValidUseCase`(`domain.usecase`) 4규칙, `GroupCreateConfig` 길이 상한.
- ~~`core/ui` 매핑 확장·strings 신설~~ — 에러 문자열 4종은 **#179로 `core:ui` `strings.xml`에 이미 존재**. 매핑 확장(`toStringResource`)은 미머지이며 as-built는 VM 매핑(→ open-questions).

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
