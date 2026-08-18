---
id: intro-term-agree
title: 온보딩 약관 동의 화면 (TermAgree)
status: implemented
category: ui-spec
platforms: android
verified: 2026-08-18
related_code:
  - NavKeyTermAgree
  - TermAgreeRoute.kt#TermAgreeRoute
  - TermAgreeScreen.kt#TermAgreeScreen
  - TermAgreeViewModel.kt#TermAgreeViewModel
  - TermAgreeViewModelTest
  - GetPoliciesUseCase.kt#GetPoliciesUseCase
  - SignUpUseCase.kt#SignUpUseCase
  - SignUpException.kt#SignUpException
  - PolicyRepository.kt#PolicyRepository
  - PolicyRepositoryImpl.kt#PolicyRepositoryImpl
  - AuthRepository.kt#signUp
  - EntryBuilder.kt#featureTermAgreeEntryBuilder
  - NavKeyWebView.kt#NavKeyWebView
  - feature/intro/impl/res/values/strings.xml
related_adr: ADR-0005, ADR-0006, ADR-0016, ADR-0017, ADR-0019, ADR-0020
related_spec: s004-terms-privacy-webview, a002-kakao-login-api, mvi-error-infrastructure
related_architecture: state-management, navigation-flow, data-layer
supersedes:
superseded_by:
tags: [spec, parfait, intro, terms, onboarding]
---

# Spec: 온보딩 약관 동의 화면 (TermAgree)

> 상태·날짜·대상·관련은 frontmatter가 단일 출처. 본문은 설계에 집중.
>
> **사후 기록(post-hoc)**: 타 작업자 구현이 선작성 스펙 없이 develop 머지(#153, 2026-07-22)됨.
> 파르페 완성도 유지를 위해 as-built로 역기록. 코드가 SoT.
>
> **as-built 갱신(2026-07-26, #166)**: 화면 정적 문자열이 하드코딩 → `strings.xml` + `stringResource`로 이동. 문구 자체는 불변.
>
> **as-built 갱신(2026-08-09, #220)**: TODO 3종 중 **다음 화면 네비게이션이 결선**됨 —
> `NavigateToNext` stub → `navigator.clearBackStack()` + `goTo(NavKeyGroupList)`. 동시에 이 화면이
> 로그인의 다음 목적지가 돼(`LoginRoute`가 `NavKeyGroupHome` 대신 `NavKeyTermAgree`로) **도달 불가
> 상태가 해소**됐다. 저장·랜딩 URL TODO는 그대로.
>
> ⚠️ **as-built 갱신(2026-08-15, #242 develop 머지)**: **약관이 서버에서 오고, 동의가 회원가입으로
> 나간다.** 화면 상수 `TERM_CONTENT_LIST`(+`TermContent`)가 통째로 삭제되고 `GET /api/v1/policies`
> 응답(`PolicyVO`)이 그 자리를 채웠으며, "확인"이 `POST /api/v1/auth/signup`을 호출한 뒤 세션까지
> 저장한다. 즉 **신규 가입자가 세션 없이 그룹 목록에 도달하던 과도기가 닫혔다**. 랜딩 URL도 이제
> 서버가 주므로(`PolicyVO.url`) 리터럴 TODO가 사라졌고, 남은 stub은 Route의 `NavigateToUrl` 소비뿐이다.
> 조회 실패 자리와 가입 실패 표현은 임시다(아래 "실패 표현" 절).
>
> ✅ **as-built 갱신(2026-08-18, #296 develop 머지)**: **마지막 stub이던 상세 랜딩이 열렸다.**
> `ClickTermLandingUrl(landingUrl)` → **`ClickTermDetail(policy)`**, `NavigateToUrl(landingUrl)` →
> **`NavigateToPolicyDetail(title, url)`**로 바뀌고 Route의 `/* navigate to url */` 주석이
> `goTo(NavKeyWebView(title, url))`가 됐다. 주소만 넘기던 것을 **제목까지** 넘기는 이유는 여는 화면이
> 상단바에 걸 것을 스스로 조회하지 않기 때문이다 — 목적지는 설정 화면(S-001)과 공유한다
> ([s004 스펙 as-built](2026-07-20-s004-terms-privacy-webview.md)). 화면 콜백도
> `onClickTermLandingUrl(String)` → `onClickTermDetail(PolicyVO)`로 넓어져 `url`을 뽑는 자리가
> ViewModel로 내려갔다. `feature/intro/impl` → `feature/common/terms/api` 의존이 이때 생겼다.
> 조회 실패·가입 실패 표현은 여전히 임시다.

- **대상 모듈**: `feature/intro/impl`(`termagree/`) + `feature/intro/api`(NavKey) + `domain`(UseCase·Repository·예외)
  + `data`(`PolicyRepositoryImpl`·`AuthRepositoryImpl#signUp`). `feature/groups/list/api` 의존(#220, 다음 목적지).
- **흐름 위치**: 온보딩 intro 플로우의 약관 동의 단계. 진입은 `NavKeyLogin`, 다음은 `NavKeyGroupList`
  ([navigation-flow](../../architecture/navigation-flow.md) "앱 진입 체인").

## 목표

앱 진입 온보딩에서 서비스 이용 약관·개인정보 처리방침에 동의받는 화면. 필수 약관 전건 체크 시에만
다음 진행을 허용한다.

## 범위

- 포함: 약관 리스트(필수 마킹) 렌더·개별/전체 토글·필수 충족 시 확인 버튼 활성·항목별 상세 랜딩 진입 콜백·뒤로가기.
  **#242 추가**: 진입 시 약관 목록 서버 조회·조회 실패 표시와 재시도·확인 시 회원가입 요청·가입 중 재진입 가드·세션 저장 후 이동.
- 제외(구현 TODO 상태):
  - ~~**동의 결과 저장 로직**~~ — ✅ **해소(#242)**. `ClickNextButton` → `SignUpUseCase` → `POST /auth/signup` → 세션 저장 → `NavigateToNext`.
  - ~~**랜딩 URL 실값**~~ — ✅ **해소(#242 값 + #296 화면)**. 값은 서버가 주고(`PolicyVO.url`), 탭하면 `NavKeyWebView(title, url)`로 공용 웹뷰가 열린다.
  - **조회 실패 화면** — 지금은 목록 자리에 문구 + "다시 시도" 텍스트 두 줄이고, 코드가 `TODO(공통 에러화면)`으로 공용 에러화면 대체를 예고한다.
  - **가입 실패 표현** — 실패 갈래는 전부 열거돼 있으나 전부 로그뿐이다(아래 "실패 표현" 절).
- 결선 완료(#220): **다음 화면 네비게이션** — `NavigateToNext`가 `clearBackStack()` 후 `NavKeyGroupList`로 `goTo`.

## API / 인터페이스

```kotlin
// api 모듈 — 인자 있는 NavKey(#241, 로그인이 신규 회원으로 판정하며 받은 가입 토큰)
@Serializable data class NavKeyTermAgree(val registrationToken: String) : NavKey

// domain (#242 신설)
interface PolicyRepository { suspend fun getPolicies(): Result<List<PolicyVO>> }
class GetPoliciesUseCase @Inject constructor(private val policyRepository: PolicyRepository) {
    suspend operator fun invoke(): Result<List<PolicyVO>>          // 서버 순서 그대로
}
class SignUpUseCase @Inject constructor(private val authRepository: AuthRepository) {
    suspend operator fun invoke(
        registrationToken: RegistrationToken,
        policies: List<PolicyVO>,          // 화면에 노출한 전체
        agreedTermsIds: Set<TermsId>,
    ): Result<AuthSessionVO>                // 성공 시 세션 저장까지 마친다
}
sealed class SignUpException : Exception { class RequiredPolicyNotAgreed(val termsIds: List<TermsId>) }

// impl — MVI (core.ui BaseViewModel<State, Intent, SideEffect>)
data class TermAgreeState(
    val policies: List<PolicyVO> = emptyList(),
    val agreedTermsIds: Set<TermsId> = emptySet(),
    val isLoading: Boolean = true,
    val isLoadFailed: Boolean = false,      // TODO(공통 에러화면) — 서면 목록 대신 에러화면 예정
    val isSigningUp: Boolean = false,
) : UiState {
    val isAllSelected: Boolean          // 목록이 비지 않고 전 항목 동의
    val isAvailable: Boolean            // 목록이 비지 않고 필수 전건 동의(확인 버튼 활성 조건)
    fun isAgreed(policy: PolicyVO): Boolean
}

sealed interface TermAgreeIntent {
    data class ClickTermAgree(val termsId: TermsId, val newSelected: Boolean)  // 개별 토글(🔁 index → termsId)
    data class ClickTermDetail(val policy: PolicyVO)                     // 상세 진입(🔁 #296, 구 ClickTermLandingUrl(String))
    data class ClickAgreeAllTerm(val newSelected: Boolean)               // 전체 토글
    data object ClickNextButton; data object ClickBackButton
    data object ClickRetryLoad                                           // #242 신설
}
sealed interface TermAgreeSideEffect {
    data class NavigateToPolicyDetail(val title: String, val url: String)  // 🔁 #296, 구 NavigateToUrl(String)
    data object NavigateToBack; data object NavigateToNext
}

// ViewModel — 가입 토큰을 NavKey 인자로 받으므로 Assisted 주입(#242)
@HiltViewModel(assistedFactory = TermAgreeViewModel.Factory::class)
class TermAgreeViewModel @AssistedInject constructor(
    @Assisted registrationTokenValue: String,
    private val getPolicies: GetPoliciesUseCase,
    private val signUp: SignUpUseCase,
) : BaseViewModel<…>
```

## 동작 / 상태

- **약관 조회**(#242): `init`에서 `loadPolicies()`. 로딩 플래그는 `launch` **밖**에서 켠다 — 재시도 클릭이
  중복 실행 가드(`launch(key = …)`)에 막혀도 화면은 "조회 중"이어야 하고 실제로도 조회가 돌고 있기 때문이다.
  해제는 `finally`라 예외·취소 어느 경로로 빠져도 스피너가 남지 않는다.
  성공 시 목록을 반영하며 **사라진 약관의 동의 상태는 버린다**(`agreedTermsIds`를 새 목록과 교집합).
- **개별 토글**(`ClickTermAgree`): `agreedTermsIds`에서 해당 `TermsId`를 더하거나 뺀다(🔁 #242 — 이전엔
  index 기반 `List<Boolean>`이었다. 목록이 서버에서 오므로 순서가 아니라 ID가 식별자다).
- **전체 토글**(`ClickAgreeAllTerm`): 전 항목 ID 집합 또는 빈 집합으로 교체.
- **확인**(`ClickNextButton`, #242): `isAvailable`이 아니면 요청하지 않고 로그만 남긴다(화면 가드 재확인).
  통과하면 `SignUpUseCase`에 **노출한 약관 전체 + 동의한 ID 집합**을 넘긴다 — 서버가 미동의 약관도
  `agreed = false`로 함께 받기 때문이다. 성공하면 `NavigateToNext`.
  중복 요청은 `launch(key = KEY_SIGN_UP)` 가드가 막고 `isSigningUp`은 버튼 잠금 표시로만 쓴다(두 곳에서
  막으면 어긋났을 때 원인을 못 찾는다는 코드 주석).
- **도메인 재검증**: `SignUpUseCase`가 필수 미동의를 `SignUpException.RequiredPolicyNotAgreed`로 되돌린다 —
  화면 가드가 뚫려도 잘못된 요청이 나가지 않는다.
- **세션 저장 주체가 UseCase다**: 가입 응답(`AuthSessionVO`)을 `authRepository.saveSession`으로 저장한 뒤에야
  성공을 반환한다(`LoginWithKakaoUseCase`와 같은 이유 — 저장 전에 이동하면 다음 화면 첫 요청이 토큰 없이 나간다).
  저장은 `runSuspendCatching`으로 감싸 실패를 `AppError.Unexpected`로 되돌린다(취소는 재던짐).
- **확인 버튼 활성**: `state.isAvailable` → `YGButton(isEnabled = ...)`. 목록이 비면(로딩·조회 실패) 항상 비활성.

| 요소 | 토큰/기본값(심볼) |
|------|-------------------|
| 상단 | `YGTopBarBack` |
| 제목 | `typography.title.t01B` / `Gray.Gray900` |
| 모두동의 박스 | 배경 `Gray.Gray100` + `shapes.radius.small`, 체크 tint 선택 `Gray.Black` / 비선택 `Gray.Gray200` |
| 항목 라벨 | 선택 `Gray.Gray800` / 비선택 `Gray.Gray500`, `body.b02R`, 필수 접두 `R.string.prefix_required`("(필수)") |
| 상세 진입 | `ic_caret_right`(tint `Gray.Gray500`) 탭 → `onClickTermLandingUrl` |
| 확인 버튼 | `YGButton` `YGButtonType.Large` |

### 실패 표현 (#242)

- **조회 실패**: `isLoadFailed`가 서면(참이면) 목록 자리에 "약관을 불러오지 못했어요" + "다시 시도"(탭 → `ClickRetryLoad`)를
  띄운다. 코드가 `TODO(공통 에러화면)`으로 이 자리를 공용 에러화면으로 바꿀 것을 예고한다.
- **가입 실패**: `SignUpException.RequiredPolicyNotAgreed`·`AppError.Network`·`AppError.Server`·그 외로
  갈래를 전부 열거하지만 **전부 `viewModelLogger`뿐**이고 화면 표현이 없다(각 자리에 `TODO(에러 UX 미정)`).
  세션 저장 실패도 마지막 갈래로 들어온다. 즉 실패하면 사용자에게는 아무 일도 일어나지 않는다.


## 표시·제어 규칙

- 개별 라벨 영역 탭 = 토글, caret 탭 = 상세 랜딩(두 클릭 영역 분리).
- 필수 미충족 시 확인 버튼 비활성.
- **목록 항목 key는 `termsId`**(#242) — 서버 순서를 그대로 쓰되 재조회로 순서가 바뀌어도 항목이 뒤섞이지 않는다.
- **정적 UI 라벨은 `feature/intro/impl` `res/values/strings.xml` + `stringResource(R.string.*)`**(제목·"모두 동의하기"·"(필수)"·확인 버튼 + #242의 조회 실패·다시 시도 2건). S-001/S-004 플랜이 세운 관용구와 동일.
  **약관 항목 title은 이제 서버 값**이라 코틀린 리터럴이 사라졌다(#242) — [open-questions](../../synthesis/open-questions.md) [2026-07-26] ①이 이 화면에서 닫혔다.
- 목록이 비어 있으면(로딩·조회 실패) 상단 여백만 남지 않도록 항목 앞 `Spacer`를 넣지 않는다(#242).

## 파일 구성

- `api/NavKeyTermAgree.kt` — 인자 있는 목적지 키(`registrationToken`).
- `impl/termagree/TermAgreeScreen.kt` — stateless UI(`LazyColumn`) + 조회 실패 자리 + `PreviewParameterProvider` 4상태.
- `impl/termagree/TermAgreeRoute.kt` — Assisted 팩토리로 VM 생성(#242) + state/effect collect, back→`navigator.onBack()`, next→`clearBackStack()`+`goTo(NavKeyGroupList)`(#220), url은 stub.
- `impl/termagree/TermAgreeViewModel.kt` — MVI State/Intent/SideEffect + `processIntent` + 조회·가입 job 키 2종.
- ~~`impl/termagree/model/TermContent.kt`~~ — **#242에서 삭제**(서버 `PolicyVO`가 대체).
- `impl/res/values/strings.xml` — 화면 정적 라벨(제목·모두동의·(필수)·확인, #166 / 조회 실패·다시 시도, #242).
- `impl/EntryBuilder.kt#featureTermAgreeEntryBuilder` — `entry<NavKeyTermAgree> { YGScaffold { TermAgreeRoute(registrationToken = RegistrationToken(navKey.registrationToken), …) } }`(nav 컨테이너 [YGScaffold](../archive/2026-07-20-designsystem-ygscreen-scaffold.md)).
- `domain/usecase/policy/GetPoliciesUseCase.kt`·`domain/usecase/auth/SignUpUseCase.kt`·`domain/exception/SignUpException.kt`·
  `domain/repository/policy/PolicyRepository.kt` · `data/repository/policy/PolicyRepositoryImpl.kt`(#242 신설).
  `AuthRepository`에 `signUp`이 추가되고 `RepositoryModule`이 `PolicyRepository` 바인딩을 얻었다.
- 테스트(#242): `TermAgreeViewModelTest`(조회·토글·가입 경로) · `SignUpUseCaseTest` · `GetPoliciesUseCaseTest` ·
  `PolicyRepositoryImplTest` · `AuthRepositoryImplTest`(signUp 경로 추가). `feature/intro/impl`에 `parfait.test.unit` 적용.

## 주의 / 열린 질문

- ~~**동의 저장 미구현**~~ — ✅ **해소(#242)**. 가입 요청 + 세션 저장까지 이 화면이 책임진다.
- ~~**랜딩 URL은 값만 왔다**~~ — ✅ **해소(#296)**. caret 탭이 `NavKeyWebView(title, url)`로
  [s004-terms-privacy-webview](2026-07-20-s004-terms-privacy-webview.md)의 `NotionWebView` 화면을 연다
  (후보로 적어 둔 재사용이 그대로 실현됐다).
  ⚠️ 서버 계약상 이 필드는 URL 전용 컬럼이 아니라 약관 본문 컬럼(`Tos.content`) 재사용이라
  **전문이 내려올 수도 있다** → [api/policy.md](../../api/policy.md) 미결.
- **빈 목록이어도 200이다** — 서버가 약관 0건을 정상 응답으로 내려주며(계약 문서 명시), 그 경우 이 화면은
  실패 표시 없이 **빈 목록 + 비활성 확인 버튼**으로 멈춘다. 조회 실패와 구분되는 상태이나 화면 표현은 같지 않다.
- **가입 실패가 로그뿐**(#242) — 네트워크 단절·서버 에러·세션 저장 실패 어느 쪽이든 화면이 조용하다
  → [open-questions](../../synthesis/open-questions.md) [2026-08-15].
- **조회 실패 자리가 임시**(#242) — 목록 안 텍스트 두 줄이고 코드가 공용 에러화면을 예고한다. G-001은 같은
  성격의 실패를 전용 화면(`GroupListErrorScreen`)으로 그린다 — 저장소에 실패 표현이 두 형태다.
- "모두 동의하기" 클릭 영역이 `clickable`(스로틀 `clickableYG` 미사용) — 캘린더 셀 등과 동일한 스로틀 규약 이탈 패턴(연타 방어 부재).
