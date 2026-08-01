---
id: module-structure
title: 모듈 구조
category: architecture
status: living
platforms: android
verified: 2026-08-01
related_spec: a005-group-create, g001-group-list
related_adr: ADR-0001, ADR-0002, ADR-0003, ADR-0011, ADR-0015, ADR-0016
related_architecture:
related_code: settings.gradle.kts
tags: [architecture, parfait]
---
# 모듈 구조

전체 모듈의 목적·주요 의존·레이어 그룹. 결정 근거는 [[0001-layered-multi-module]]·[[0002-feature-api-impl-split]]·[[0003-convention-plugins-version-catalog]].

> 모듈 등록 SoT = `settings.gradle.kts`. 버전·의존 SoT = `gradle/libs.versions.toml`.
> 근거는 파일명+심볼명으로만. 라인번호·모듈 개수 등 수치는 적지 않는다(→ [`../adr/README.md`](../adr/README.md)).

## 의존 방향 (단방향)

```
app / app-preview
  └─ feature/*/impl ── (이동 대상) ──▶ 다른 feature/*/api
       └─ core/{ui, navigation, designsystem, util}
            └─ domain (순수 Kotlin)
            └─ data ──▶ domain
```

## 레이어별 모듈

| 그룹 | 모듈 | 목적 | 적용 컨벤션 플러그인 |
|------|------|------|----------------------|
| 진입 | `app`, `app-preview` | 앱 진입점(`BaseApplication`, `MainActivity`, `MainRoute`), 전체 조립 | `AndroidApplication*`, 서명 |
| core | `core:ui` | MVI 베이스(`BaseViewModel`, `MviContract`), 공유 전환 스코프, 여러 feature 공용 레이아웃(`VerticalGridLayout`)·공용 문자열 리소스(유효성 에러 문구, [[0016-domain-result-presentation-string-mapping]]) | android-library + compose |
| core | `core:designsystem` | 테마(`YGMaterialTheme`)·토큰(`YGSemanticColors`, `SizeTokens` 등) | android-library + compose |
| core | `core:navigation` | `Navigator`, NavKey 레지스트리, 엔트리 등록 | android-library |
| core | `core:util:android` | Android 전용 유틸(`decodeUriToBitmap`, `AndroidBitmap`) + Compose clickable 유틸(`clickable/`: `clickableYG`·`ygDimRipple`·`ygScaleRipple`, 테마 비의존) + Compose 확장(`extension/`: `Modifier.navigationBarsAndImePadding`·`Modifier.drawTooltipCornerTop`·`AnnotatedString.Builder.withStyle`). `core:util:jvm` 의존 | android-library + compose |
| core | `core:util:jvm` | 순수 Kotlin 유틸·로깅·플랫폼 무관 추상(`BitmapWrapper`) + 공용 날짜 포맷(`model/DateFormat`, `kotlinx-datetime`) | kotlin-jvm |
| domain | `domain` | UseCase, Repository 인터페이스, 도메인 모델 | `ModuleDomain`(kotlin-jvm) |
| data | `data` | Repository 구현, DataSource, DI 모듈 | `ModuleData` |
| feature | `feature/{login,segmentation,camera,gallery,intro}/{api,impl}` | 화면·VM(impl) / NavKey 계약(api) | `ModuleFeatureApi` / `ModuleFeatureImpl` |
| feature | `feature/groups/{canvas,enter,home,list,setting}/{api,impl}` | 그룹 관련 화면 묶음 | 동일 |
| feature | `feature/app/setting/{api,impl}` | 앱 설정 화면(`NavKeyAppSetting`, `AppSettingRoute`) | 동일 |
| feature | `feature/common/terms/{api,impl}` | 약관·개인정보 화면(`NavKeyServiceTerms`/`NavKeyPrivacyPolicy`, `ServiceTermsRoute`/`PrivacyPolicyRoute`, `NotionWebView`) — 여러 feature 공유([[0015-feature-common-shared-layer]]) | 동일 |

## 규칙
- feature 간 이동은 상대 **`:api`(NavKey)만** 참조. `:impl`끼리 직접 의존 금지([[0002-feature-api-impl-split]]).
- `domain`은 Android 의존 금지(순수 Kotlin 유지). Android 타입이 도메인에 필요하면 `core:util:jvm`의 플랫폼 무관 추상으로 감싼다 — 비트맵은 `BitmapWrapper`([[0011-cross-module-bitmap-abstraction]]).
- 새 모듈 = 알맞은 컨벤션 플러그인 적용 + `settings.gradle.kts` 등록(같은 커밋).
- **여러 feature가 공유하는 화면**은 특정 도메인 feature 밑이 아니라 `feature/common/*`에 둔다([[0015-feature-common-shared-layer]]). 단, **2개 이상 소비처가 확정된 경우에만**(단일 소비면 소유 feature 유지).
- **표시 문자열은 `strings.xml` + `stringResource`**(코틀린 리터럴 금지). 화면 전용 정적 라벨은 그 화면의 `feature/*/impl` `res/values/strings.xml`
  (같은 모듈의 여러 화면이 한 파일 공용), **여러 feature가 공유하는 문구**(유효성 에러 등)는 `core:ui` `res/values/strings.xml`([[0016-domain-result-presentation-string-mapping]]).
  `domain`은 표시 문자열을 보유하지 않는다. 미착수 화면에 잔존한 리터럴은 [open-questions](../synthesis/open-questions.md) [2026-07-26]에서 추적.

## 현재 수치가 필요하면 코드에서 측정
```bash
# 모듈 목록
grep -E '^\s*include' settings.gradle.kts
# feature 목록
find feature -maxdepth 2 -name build.gradle.kts
```
