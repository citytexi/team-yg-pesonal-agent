---
id: module-structure
title: 모듈 구조
category: architecture
status: living
platforms: android
verified: 2026-08-15
related_spec: a005-group-create, g001-group-list, c101-camera-picture-confirm, unit-test-infrastructure
related_adr: ADR-0001, ADR-0002, ADR-0003, ADR-0011, ADR-0015, ADR-0016
related_architecture:
related_code:
  - settings.gradle.kts
  - build-logic/convention/src/main/kotlin/com/teamyg/parfait/buildlogic/TestConfig.kt#setConfigTestUnit
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
| core | `core:ui` | MVI 베이스(`BaseViewModel`, `MviContract`), 공유 전환 스코프, 여러 feature 공용 레이아웃(`VerticalGridLayout`)·공용 문자열 리소스(유효성 에러 문구) + **도메인 결과 → 표시 문자열 매핑**(`text/NameValidResultUiText.kt`, [[0016-domain-result-presentation-string-mapping]]). `:domain` 의존(#223, 2026-08-13) | android-library + compose |
| core | `core:designsystem` | 테마(`YGMaterialTheme`)·토큰(`YGSemanticColors`, `SizeTokens` 등) | android-library + compose |
| core | `core:navigation` | `Navigator`, NavKey 레지스트리, 엔트리 등록 | android-library |
| core | `core:util:android` | Android 전용 유틸(`decodeUriToBitmap`, `AndroidBitmap`) + Compose clickable 유틸(`clickable/`: `clickableYG`·`clickableYGNoRipple`·`ygDimRipple`·`ygScaleRipple`, 테마 비의존) + 포커스 유틸(`focus/`: `Modifier.clearFocusOnTap`) + Compose·플랫폼 확장(`extension/`: `Modifier.navigationBarsAndImePadding`·`Modifier.drawTooltipCornerTop`·`AnnotatedString.Builder.withStyle`·`List<Offset>.toPath`/`toAndroidPath`·`ClipDescription.isSensitive`). `core:util:jvm` 의존 | android-library + compose |
| core | `core:util:jvm` | 순수 Kotlin 유틸·로깅·플랫폼 무관 추상(`BitmapWrapper`) + 공용 날짜 포맷(`model/DateFormat`·`model/DateTextFormat`, `kotlinx-datetime`) + 픽셀 연산 확장(`extension/`: `Int.fadeArgb`·`Int.mixArgb`·`FloatArray.fillWithSquaredDistance`) | kotlin-jvm |
| core | `core:testing` | **테스트 전용** 공용 유틸(`MainDispatcherRule`). 테스트 소스셋만 소비하므로 위 의존 방향 그래프에 없다 | kotlin-jvm |
| domain | `domain` | UseCase, Repository 인터페이스, 도메인 모델 | `ModuleDomain`(kotlin-jvm) |
| data | `data` | Repository 구현, DataSource, DI 모듈 | `ModuleData` |
| feature | `feature/{login,segmentation,camera,gallery,intro}/{api,impl}` | 화면·VM(impl) / NavKey 계약(api) | `ModuleFeatureApi` / `ModuleFeatureImpl` |
| feature | `feature/groups/{canvas,enter,list,setting}/{api,impl}` | 그룹 관련 화면 묶음 | 동일 |
| feature | `feature/app/setting/{api,impl}` | 앱 설정 화면(`NavKeyAppSetting`, `AppSettingRoute`) | 동일 |
| feature | `feature/common/terms/{api,impl}` | 약관·개인정보 화면(`NavKeyServiceTerms`/`NavKeyPrivacyPolicy`, `ServiceTermsRoute`/`PrivacyPolicyRoute`, `NotionWebView`) — 여러 feature 공유([[0015-feature-common-shared-layer]]) | 동일 |

> **픽셀 연산이 `core:util:jvm`으로 올라온 이유(2026-08-14, PR #221)** — 토핑 테두리를 거리장으로 그리려면
> 픽셀 배열을 직접 훑어야 해서 색 하나마다 Compose `Color` 변환을 태울 수 없다. ARGB 정수를 그대로 만지는
> 연산(`fadeArgb`·`mixArgb`)과 2-pass 제곱거리 변환(`fillWithSquaredDistance`)은 Android 타입이 없어
> jvm 쪽에 두고 유닛 테스트로 덮었다. **화면에 쓸 색은 여전히 Compose `Color`가 맞다** — 여기 있는 것은
> 픽셀 루프 전용이다(파일 상단 주석이 그 경계를 적어 둔다).

> **`feature/groups/home/{api,impl}` 삭제(2026-08-09, PR #220)** — `NavKeyGroupHome`·`GroupHomeRoute`는
> `ResultEventBus` 왕복을 시연하던 임시 화면이었고, 로그인 다음 목적지가 온보딩 체인으로 바뀌면서
> 모듈 2개가 `settings.gradle.kts`·`app`·`core:navigation`에서 함께 빠졌다. 그룹 개별 화면은 별도
> 목적지 없이 G-001 목록에서 캔버스(C-001)로 직접 가는 구조라 대체 모듈을 만들지 않았다.

## 규칙
- feature 간 이동은 상대 **`:api`(NavKey)만** 참조. `:impl`끼리 직접 의존 금지([[0002-feature-api-impl-split]]).
- `domain`은 Android 의존 금지(순수 Kotlin 유지). Android 타입이 도메인에 필요하면 `core:util:jvm`의 플랫폼 무관 추상으로 감싼다 — 비트맵은 `BitmapWrapper`([[0011-cross-module-bitmap-abstraction]]).
- 새 모듈 = 알맞은 컨벤션 플러그인 적용 + `settings.gradle.kts` 등록(같은 커밋).
- **`core:testing`은 프로덕션 코드에서 참조 금지.** 배선은 `setConfigTestUnit()`이 `testImplementation`으로
  넣어주고, 계측 소스셋에는 붙지 않는다. 이 모듈은 junit4·coroutines-test를 `api`로 재노출하지
  않으므로 `bundles.test-unit`과 짝일 때만 성립한다([spec](../specs/archive/2026-08-06-unit-test-infrastructure.md)).
  **`parfait.test.unit`은 화면 결선 라운드마다 그 feature `impl`에 붙는다**(2026-08-15 기준 인트로·로그인·
  그룹 목록·그룹 참여·그룹 설정·앱 설정). 적용 목록의 SoT는 각 `build.gradle.kts`다.
- **`core:util:jvm`의 `Char.isKorean()`은 삭제됐다**(2026-08-15, PR #243) — 이름 유효성 검사가 서버 정규식과
  같은 문자 집합(`가-힣A-Za-z0-9` + 스페이스)을 직접 쓰게 되며 유일한 사용처가 사라졌다.
- **여러 feature가 공유하는 화면**은 특정 도메인 feature 밑이 아니라 `feature/common/*`에 둔다([[0015-feature-common-shared-layer]]). 단, **2개 이상 소비처가 확정된 경우에만**(단일 소비면 소유 feature 유지).
- **표시 문자열은 `strings.xml` + `stringResource`**(코틀린 리터럴 금지). 화면 전용 정적 라벨은 그 화면의 `feature/*/impl` `res/values/strings.xml`
  (같은 모듈의 여러 화면이 한 파일 공용), **여러 feature가 공유하는 문구**(유효성 에러 등)는 `core:ui` `res/values/strings.xml`([[0016-domain-result-presentation-string-mapping]]).
  `domain`은 표시 문자열을 보유하지 않는다. 미착수 화면에 잔존한 리터럴은 [open-questions](../synthesis/open-questions.md) [2026-07-26]에서 추적.
- **`core:ui` → `:domain` 의존**(#223 develop 머지, 2026-08-13) — 표시 매핑 확장(`NameValidResult.Error.toStringResource`)의 리시버가 도메인 타입이라 필요하다. 방향은 허용(ui → domain)이나 **`implementation`이라 public API 시그니처에 domain 타입이 노출되면서 의존은 숨어 있다** — 소비 feature가 컨벤션 플러그인으로 `:domain`을 직접 갖고 있어 지금은 컴파일된다. 저장소에 `api(...)` 선언이 0건이고 컨벤션 플러그인에 `api` 확장 함수 자체가 없어 승격은 팀 결정 대상 → [open-questions](../synthesis/open-questions.md) [2026-08-13].

## 현재 수치가 필요하면 코드에서 측정
```bash
# 모듈 목록
grep -E '^\s*include' settings.gradle.kts
# feature 목록
find feature -maxdepth 2 -name build.gradle.kts
```
