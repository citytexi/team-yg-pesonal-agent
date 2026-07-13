---
id: module-structure
title: 모듈 구조
category: architecture
status: living
platforms: android
verified: 2026-07-12
related_spec:
related_adr: ADR-0001, ADR-0002, ADR-0003, ADR-0011
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
| core | `core:ui` | MVI 베이스(`BaseViewModel`, `MviContract`), 공유 전환 스코프, 프리뷰 | android-library + compose |
| core | `core:designsystem` | 테마(`YGMaterialTheme`)·토큰(`YGSemanticColors`, `SizeTokens` 등) | android-library + compose |
| core | `core:navigation` | `Navigator`, NavKey 레지스트리, 엔트리 등록 | android-library |
| core | `core:util:android` | Android 전용 유틸(`decodeUriToBitmap`, `AndroidBitmap`) + Compose clickable 유틸(`clickable/`: `clickableYG`·`ygDimRipple`·`ygScaleRipple`, 테마 비의존). `core:util:jvm` 의존 | android-library + compose |
| core | `core:util:jvm` | 순수 Kotlin 유틸·로깅·플랫폼 무관 추상(`BitmapWrapper`) | kotlin-jvm |
| domain | `domain` | UseCase, Repository 인터페이스, 도메인 모델 | `ModuleDomain`(kotlin-jvm) |
| data | `data` | Repository 구현, DataSource, DI 모듈 | `ModuleData` |
| feature | `feature/{login,segmentation,camera,gallery,intro}/{api,impl}` | 화면·VM(impl) / NavKey 계약(api) | `ModuleFeatureApi` / `ModuleFeatureImpl` |
| feature | `feature/groups/{canvas,enter,home,list,setting}/{api,impl}` | 그룹 관련 화면 묶음 | 동일 |
| feature | `feature/app/setting/{api,impl}` | 앱 설정 화면(`NavKeyAppSetting`, `AppSettingRoute`) | 동일 |

## 규칙
- feature 간 이동은 상대 **`:api`(NavKey)만** 참조. `:impl`끼리 직접 의존 금지([[0002-feature-api-impl-split]]).
- `domain`은 Android 의존 금지(순수 Kotlin 유지). Android 타입이 도메인에 필요하면 `core:util:jvm`의 플랫폼 무관 추상으로 감싼다 — 비트맵은 `BitmapWrapper`([[0011-cross-module-bitmap-abstraction]]).
- 새 모듈 = 알맞은 컨벤션 플러그인 적용 + `settings.gradle.kts` 등록(같은 커밋).

## 현재 수치가 필요하면 코드에서 측정
```bash
# 모듈 목록
grep -E '^\s*include' settings.gradle.kts
# feature 목록
find feature -maxdepth 2 -name build.gradle.kts
```
