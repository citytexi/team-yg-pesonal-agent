---
id: intro-term-agree
title: 온보딩 약관 동의 화면 (TermAgree)
status: implemented
category: ui-spec
platforms: android
verified: 2026-07-22
related_code:
  - NavKeyTermAgree
  - TermAgreeRoute.kt#TermAgreeRoute
  - TermAgreeScreen.kt#TermAgreeScreen
  - TermAgreeViewModel.kt#TermAgreeViewModel
  - TermContent.kt#TermContent
  - EntryBuilder.kt#featureTermAgreeEntryBuilder
related_adr: ADR-0005, ADR-0006
related_spec: s004-terms-privacy-webview
related_architecture: state-management, navigation-flow
supersedes:
superseded_by:
tags: [spec, parfait, intro, terms, onboarding]
---

# Spec: 온보딩 약관 동의 화면 (TermAgree)

> 상태·날짜·대상·관련은 frontmatter가 단일 출처. 본문은 설계에 집중.
>
> **사후 기록(post-hoc)**: 타 작업자 구현이 선작성 스펙 없이 develop 머지(#153, 2026-07-22)됨.
> 파르페 완성도 유지를 위해 as-built로 역기록. 코드가 SoT.

- **대상 모듈**: `feature/intro/impl`(`termagree/`) + `feature/intro/api`(NavKey)
- **흐름 위치**: 온보딩 intro 플로우(splash/login 계열)의 약관 동의 단계.

## 목표

앱 진입 온보딩에서 서비스 이용 약관·개인정보 처리방침에 동의받는 화면. 필수 약관 전건 체크 시에만
다음 진행을 허용한다.

## 범위

- 포함: 약관 리스트(필수 마킹) 렌더·개별/전체 토글·필수 충족 시 확인 버튼 활성·항목별 상세 랜딩 진입 콜백·뒤로가기.
- 제외(구현 TODO 상태):
  - **동의 결과 저장 로직** — `ClickNextButton`에서 `NavigateToNext`만 post, 저장(서버/앱내)은 `// Todo`.
  - **랜딩 URL 실값** — `TermContent.landingUrl`은 빈 문자열(`// Todo : 노션 생성 후`), `NavigateToUrl` effect는 Route에서 stub(`/* navigate to url */`).
  - **다음 화면 네비게이션** — `NavigateToNext` Route에서 stub.

## API / 인터페이스

```kotlin
// api 모듈
@Serializable data object NavKeyTermAgree : NavKey

// impl — MVI (core.ui BaseViewModel<State, Intent, SideEffect>)
data class TermAgreeState(
    val termContentList: List<TermContent> = TERM_CONTENT_LIST,
    val selectedList: List<Boolean> = List(termContentList.size) { false },
) : UiState {
    val isAllSelected: Boolean          // 전 항목 선택 여부
    val isAvailable: Boolean            // 필수 항목이 모두 선택됐는가(확인 버튼 활성 조건)
}

data class TermContent(val isRequired: Boolean, val title: String, val landingUrl: String)

sealed interface TermAgreeIntent {
    data class ClickTermAgree(val index: Int, val newSelected: Boolean)  // 개별 토글
    data class ClickTermLandingUrl(val landingUrl: String)               // 상세 진입
    data class ClickAgreeAllTerm(val newSelected: Boolean)               // 전체 토글
    data object ClickNextButton; data object ClickBackButton
}
sealed interface TermAgreeSideEffect {
    data class NavigateToUrl(val landingUrl: String); data object NavigateToBack; data object NavigateToNext
}
```

## 동작 / 상태

- **개별 토글**(`ClickTermAgree`): `selectedList`의 해당 index만 반전.
- **전체 토글**(`ClickAgreeAllTerm`): 전 항목을 `newSelected`로 일괄 설정. 화면의 "모두 동의하기" 행이 `isAllSelected.not()`을 넘겨 호출.
- **확인 버튼 활성**: `state.isAvailable`(= 필수 항목 전건 선택) → `YGButton(isEnabled = ...)`.
- **필수 항목 상수 데이터**: `TERM_CONTENT_LIST` = 서비스 이용약관(필수)·개인정보 처리방침(필수) 2건. VM 초기 상태 소유.
- 로딩/원격 상태 없음(정적 리스트).

| 요소 | 토큰/기본값(심볼) |
|------|-------------------|
| 상단 | `YGTopBarBack` |
| 제목 | `typography.title.t01B` / `Gray.Gray900` |
| 모두동의 박스 | 배경 `Gray.Gray100` + `shapes.radius.small`, 체크 tint 선택 `Gray.Black` / 비선택 `Gray.Gray200` |
| 항목 라벨 | 선택 `Gray.Gray800` / 비선택 `Gray.Gray500`, `body.b02R`, 필수 접두 "(필수)" |
| 상세 진입 | `ic_caret_right`(tint `Gray.Gray500`) 탭 → `onClickTermLandingUrl` |
| 확인 버튼 | `YGButton` `YGButtonType.Large` |

## 표시·제어 규칙

- 개별 라벨 영역 탭 = 토글, caret 탭 = 상세 랜딩(두 클릭 영역 분리).
- 필수 미충족 시 확인 버튼 비활성.

## 파일 구성

- `api/NavKeyTermAgree.kt` — 목적지 키.
- `impl/termagree/TermAgreeScreen.kt` — stateless UI(`LazyColumn`).
- `impl/termagree/TermAgreeRoute.kt` — `hiltViewModel()` + state/effect collect, back→`navigator.onBack()`, url/next stub.
- `impl/termagree/TermAgreeViewModel.kt` — MVI State/Intent/SideEffect + `processIntent`.
- `impl/termagree/model/TermContent.kt` — 데이터 클래스 + `TERM_CONTENT_LIST` 상수.
- `impl/EntryBuilder.kt#featureTermAgreeEntryBuilder` — `entry<NavKeyTermAgree> { YGScaffold { TermAgreeRoute(...) } }`(nav 컨테이너 [YGScaffold](../archive/2026-07-20-designsystem-ygscreen-scaffold.md)).

## 주의 / 열린 질문

- **동의 저장·랜딩 URL·다음 네비게이션 미구현**(TODO 3종) — 서버/앱내 저장 방침, 노션 공개페이지 URL, 다음 화면 확정 필요. 랜딩은 [s004-terms-privacy-webview](2026-07-20-s004-terms-privacy-webview.md)의 NotionWebView 재사용 후보.
- "모두 동의하기" 클릭 영역이 `clickable`(스로틀 `clickableYG` 미사용) — 캘린더 셀 등과 동일한 스로틀 규약 이탈 패턴(연타 방어 부재).
