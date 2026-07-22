---
id: feature-common-terms-module
title: 약관/개인정보 :feature:common:terms 모듈 분리 Implementation Plan
status: done
type: work-order
created: 2026-07-21
updated: 2026-07-22
platforms: android
owner:
related_adr: ADR-0015
related_spec: feature-common-terms-module
related_code: settings.gradle.kts, NavKeyServiceTerms, NavKeyPrivacyPolicy, ServiceTermsRoute, PrivacyPolicyRoute, ServiceTermsScreen, PrivacyPolicyScreen, ServiceTermsViewModel, PrivacyPolicyViewModel, NotionWebView, EntryBuilder, AppSettingRoute
archived_reason: 구현 완료 — develop 머지 #161(:feature:common:terms:{api,impl} 신설·setting에서 이동).
tags: [plan, parfait, module, terms, common]
---

# 약관/개인정보 `:feature:common:terms` 모듈 분리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development(권장) 또는 superpowers:executing-plans로 task 단위 구현. 단계는 체크박스(`- [ ]`)로 추적.

**Goal:** S-004 약관/개인정보 화면(NavKey 2 + Route/Screen/VM 2세트 + NotionWebView + EntryBuilder)을 `:feature:app:setting`에서 신규 `:feature:common:terms:{api,impl}`로 이동해, A-003 등 다른 feature가 `common:terms:api`로 재사용할 수 있게 한다.

**Architecture:** 기존 feature 관례(`:api` NavKey + `:impl` 화면/VM/엔트리, 컨벤션 플러그인 `parfait.module.feature.api`/`.impl`). 이동 후 소비 feature는 상대 `:api`(NavKey)만 참조해 `goTo`([[0002-feature-api-impl-split]]), 화면 렌더는 impl의 `@IntoSet` 엔트리 빌더가 `MainRoute` Set 주입에 자동 합류([[0006-navigation3-custom-navigator]]). 순수 이동 — 동작·UI 무변경.

**Tech Stack:** Kotlin, Jetpack Compose, Hilt, navigation3, 컨벤션 플러그인, Android WebView.

**Spec:** [specs/2026-07-21-feature-common-terms-module.md](../../specs/archive/2026-07-21-feature-common-terms-module.md) · **ADR:** [adr/0015](../../adr/0015-feature-common-shared-layer.md)

**작업 repo:** TJYG-Android, 신규 브랜치 `feature/common-terms-module`(사용자 확인 후 생성).

## Global Constraints

- **테스트 코드 없음** — 테스트 파일 만들지 않는다.
- **원자적 이동 — 커밋·빌드검증은 Task 5에서 1회.** 이동 중간(Task 1~4)에는 프로젝트가 컴파일되지 않는다(설정·app·setting 재배선 완료 전까지). 중간 task는 파일 편집만; `compileDebugKotlin`/`ktlintCheck`/commit은 Task 5에서 전 영향 모듈 대상 일괄 실행(커밋은 CLAUDE.md 규율상 사용자 확인 후).
- **파일 이동은 `git mv`** 로 히스토리 보존. 이동 후 `package` 선언 + 상호 `import`만 신규 패키지로 변경.
- **동작·UI 무변경**: 로딩/에러/`clipToBounds`/`onRelease`/`update` tag 가드/`LocalInspectionMode` 프리뷰 등 기존 코드 그대로. url placeholder(각 VM `State.url`)도 유지.
- **컨벤션 플러그인이 core·hilt·compose 제공**: impl은 `implementation(projects.feature.common.terms.api)`만 명시(designsystem/core:ui/core:navigation/hilt/navigation3은 `parfait.module.feature.impl`가 제공). `build.gradle.kts`에 그 외 의존 추가 금지.
- **네임스페이스**: api `com.teamyg.parfait.feature.common.terms.api`, impl `com.teamyg.parfait.feature.common.terms.impl`.
- **모듈 경로 접두**: api `feature/common/terms/api/src/main/kotlin/com/teamyg/parfait/feature/common/terms/api/`, impl `feature/common/terms/impl/src/main/kotlin/com/teamyg/parfait/feature/common/terms/impl/`.
- **문자열 키 리네임**: 이동 시 `setting_item_service_terms`→`terms_service_title`, `setting_item_privacy_policy`→`terms_privacy_title`, `setting_webview_error_message`→`terms_webview_error_message`, `setting_webview_retry`→`terms_webview_retry`. setting의 `setting_item_service_terms`·`setting_item_privacy_policy`는 리스트 라벨로 **잔존**.

---

### Task 1: `:feature:common:terms:api` 모듈 생성 + NavKey 이동

**Files:**
- Create: `feature/common/terms/api/build.gradle.kts`
- Move: `feature/app/setting/api/.../NavKeyServiceTerms.kt` → `feature/common/terms/api/.../NavKeyServiceTerms.kt`
- Move: `feature/app/setting/api/.../NavKeyPrivacyPolicy.kt` → `feature/common/terms/api/.../NavKeyPrivacyPolicy.kt`
- Modify: `settings.gradle.kts`

**Interfaces:**
- Produces: `com.teamyg.parfait.feature.common.terms.api.NavKeyServiceTerms`, `NavKeyPrivacyPolicy` (둘 다 `data object : NavKey`). setting(Task 4)·common impl(Task 2)·app이 사용.

- [ ] **Step 1: api build.gradle.kts 작성**

```kotlin
plugins {
    alias(libs.plugins.parfait.module.feature.api)
}

android {
    namespace = "com.teamyg.parfait.feature.common.terms.api"
}
```

- [ ] **Step 2: NavKey 2파일 git mv + 패키지 변경**

```bash
mkdir -p feature/common/terms/api/src/main/kotlin/com/teamyg/parfait/feature/common/terms/api
git mv feature/app/setting/api/src/main/kotlin/com/teamyg/parfait/feature/app/setting/api/NavKeyServiceTerms.kt \
       feature/common/terms/api/src/main/kotlin/com/teamyg/parfait/feature/common/terms/api/NavKeyServiceTerms.kt
git mv feature/app/setting/api/src/main/kotlin/com/teamyg/parfait/feature/app/setting/api/NavKeyPrivacyPolicy.kt \
       feature/common/terms/api/src/main/kotlin/com/teamyg/parfait/feature/common/terms/api/NavKeyPrivacyPolicy.kt
```

두 파일의 첫 줄 package 선언을 변경:
```kotlin
package com.teamyg.parfait.feature.common.terms.api
```
(나머지 `import`·`@Serializable data object ... : NavKey` 내용은 그대로.)

- [ ] **Step 3: settings.gradle.kts에 include 추가**

기존 `:feature:app:setting:*` include 블록 아래에 신규 블록 추가:
```kotlin
include(
    ":feature:common:terms:api",
    ":feature:common:terms:impl",
)
```

---

### Task 2: `:feature:common:terms:impl` 모듈 생성 + 화면 7파일 이동 + 엔트리·문자열

**Files:**
- Create: `feature/common/terms/impl/build.gradle.kts`
- Move (7): `ServiceTermsRoute.kt`·`PrivacyPolicyRoute.kt`(route/), `ServiceTermsScreen.kt`·`PrivacyPolicyScreen.kt`(screen/), `ServiceTermsViewModel.kt`·`PrivacyPolicyViewModel.kt`(viewmodel/), `NotionWebView.kt`(component/) — setting:impl → common:terms:impl 동일 하위패키지
- Create: `feature/common/terms/impl/.../navigation/EntryBuilder.kt`, `.../navigation/NavigationModule.kt`
- Create: `feature/common/terms/impl/src/main/res/values/strings.xml`

**Interfaces:**
- Consumes: `NavKeyServiceTerms`/`NavKeyPrivacyPolicy`(Task 1), `Navigator`·`YGTopBarDetail`·`core.ui`·`YGTheme`/`YGAtomicColors`(플러그인 제공).
- Produces: `featureCommonTermsEntryBuilder(navigator: Navigator)` + `@IntoSet` 공급. `ServiceTermsRoute`/`PrivacyPolicyRoute`(internal).

- [ ] **Step 1: impl build.gradle.kts 작성**

```kotlin
plugins {
    alias(libs.plugins.parfait.module.feature.impl)
}

android {
    namespace = "com.teamyg.parfait.feature.common.terms.impl"
}

dependencies {
    implementation(projects.feature.common.terms.api)
}
```

- [ ] **Step 2: 화면 7파일 git mv**

```bash
BASE_OLD=feature/app/setting/impl/src/main/kotlin/com/teamyg/parfait/feature/app/setting/impl
BASE_NEW=feature/common/terms/impl/src/main/kotlin/com/teamyg/parfait/feature/common/terms/impl
mkdir -p $BASE_NEW/route $BASE_NEW/screen $BASE_NEW/viewmodel $BASE_NEW/component $BASE_NEW/navigation
git mv $BASE_OLD/route/ServiceTermsRoute.kt        $BASE_NEW/route/ServiceTermsRoute.kt
git mv $BASE_OLD/route/PrivacyPolicyRoute.kt       $BASE_NEW/route/PrivacyPolicyRoute.kt
git mv $BASE_OLD/screen/ServiceTermsScreen.kt      $BASE_NEW/screen/ServiceTermsScreen.kt
git mv $BASE_OLD/screen/PrivacyPolicyScreen.kt     $BASE_NEW/screen/PrivacyPolicyScreen.kt
git mv $BASE_OLD/viewmodel/ServiceTermsViewModel.kt  $BASE_NEW/viewmodel/ServiceTermsViewModel.kt
git mv $BASE_OLD/viewmodel/PrivacyPolicyViewModel.kt $BASE_NEW/viewmodel/PrivacyPolicyViewModel.kt
git mv $BASE_OLD/component/NotionWebView.kt        $BASE_NEW/component/NotionWebView.kt
```

- [ ] **Step 3: 이동 파일 package·import·문자열 참조 변경**

`com.teamyg.parfait.feature.app.setting.impl` → `com.teamyg.parfait.feature.common.terms.impl` 로 전 파일 package/import 치환. 세부:

- **ServiceTermsViewModel.kt / PrivacyPolicyViewModel.kt**: package만 `...common.terms.impl.viewmodel`. (core.ui import·url 그대로.)
- **NotionWebView.kt**: package `...common.terms.impl.component`. `import ....feature.app.setting.impl.R` → `import com.teamyg.parfait.feature.common.terms.impl.R`. 문자열 참조 `R.string.setting_webview_error_message`→`R.string.terms_webview_error_message`, `R.string.setting_webview_retry`→`R.string.terms_webview_retry`.
- **ServiceTermsScreen.kt**: package `...common.terms.impl.screen`. import `....setting.impl.component.NotionWebView`→`....common.terms.impl.component.NotionWebView`, `....setting.impl.R`→`....common.terms.impl.R`. 문자열 `R.string.setting_item_service_terms`→`R.string.terms_service_title`. (YGTopBarDetail·PreviewBox·YGPreview import 그대로.)
- **PrivacyPolicyScreen.kt**: 동일 요령, 문자열 `R.string.setting_item_privacy_policy`→`R.string.terms_privacy_title`.
- **ServiceTermsRoute.kt**: package `...common.terms.impl.route`. import `....setting.impl.screen.ServiceTermsScreen`·`....setting.impl.viewmodel.ServiceTerms*` → `....common.terms.impl.*`. (Navigator import 그대로.)
- **PrivacyPolicyRoute.kt**: 동일 요령(PrivacyPolicy*).

- [ ] **Step 4: strings.xml 작성 (신규)**

`feature/common/terms/impl/src/main/res/values/strings.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="terms_service_title">서비스 이용약관</string>
    <string name="terms_privacy_title">개인정보 처리 방침</string>
    <string name="terms_webview_error_message">페이지를 불러오지 못했어요</string>
    <string name="terms_webview_retry">다시 시도</string>
</resources>
```

- [ ] **Step 5: EntryBuilder.kt 작성 (setting에서 이관한 2 entry)**

`feature/common/terms/impl/.../navigation/EntryBuilder.kt`:
```kotlin
package com.teamyg.parfait.feature.common.terms.impl.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.teamyg.parfait.core.navigation.Navigator
import com.teamyg.parfait.feature.common.terms.api.NavKeyPrivacyPolicy
import com.teamyg.parfait.feature.common.terms.api.NavKeyServiceTerms
import com.teamyg.parfait.feature.common.terms.impl.route.PrivacyPolicyRoute
import com.teamyg.parfait.feature.common.terms.impl.route.ServiceTermsRoute

fun EntryProviderScope<NavKey>.featureCommonTermsEntryBuilder(navigator: Navigator) {
    entry<NavKeyServiceTerms> {
        Scaffold { innerPadding ->
            ServiceTermsRoute(
                navigator = navigator,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
            )
        }
    }

    entry<NavKeyPrivacyPolicy> {
        Scaffold { innerPadding ->
            PrivacyPolicyRoute(
                navigator = navigator,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
            )
        }
    }
}
```

- [ ] **Step 6: NavigationModule.kt 작성 (@IntoSet 공급)**

`feature/common/terms/impl/.../navigation/NavigationModule.kt`:
```kotlin
package com.teamyg.parfait.feature.common.terms.impl.navigation

import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.teamyg.parfait.core.navigation.Navigator
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.components.ActivityRetainedComponent
import dagger.multibindings.IntoSet

@Module
@InstallIn(ActivityRetainedComponent::class)
object NavigationModule {
    @IntoSet
    @Provides
    fun provideFeatureCommonTermsEntryBuilder(): EntryProviderScope<NavKey>.(Navigator) -> Unit = {
        featureCommonTermsEntryBuilder(navigator = it)
    }
}
```

---

### Task 3: app 모듈 의존 추가

**Files:**
- Modify: `app/build.gradle.kts`

**Interfaces:**
- Consumes: `:feature:common:terms:{api,impl}`(Task 1·2). impl의 `@IntoSet`이 `MainRoute` Set 주입에 합류.

- [ ] **Step 1: app/build.gradle.kts dependencies에 추가**

기존 `implementation(projects.feature.app.setting.impl)` 아래에 추가:
```kotlin
    implementation(projects.feature.common.terms.api)
    implementation(projects.feature.common.terms.impl)
```

---

### Task 4: setting 모듈 정리 (NavKey 참조 재배선 + entry 제거 + 문자열 정리)

**Files:**
- Modify: `feature/app/setting/impl/build.gradle.kts`
- Modify: `feature/app/setting/impl/.../navigation/EntryBuilder.kt`
- Modify: `feature/app/setting/impl/.../route/AppSettingRoute.kt`
- Modify: `feature/app/setting/impl/src/main/res/values/strings.xml`

**Interfaces:**
- Consumes: `NavKeyServiceTerms`/`NavKeyPrivacyPolicy`(이제 `common.terms.api`), `NavKeyAccountInfo`(setting.api 잔존).
- Produces: setting은 terms 화면을 더 이상 소유하지 않음. `goTo(NavKeyServiceTerms/PrivacyPolicy)`는 common의 entry로 라우팅.

- [ ] **Step 1: setting:impl build.gradle.kts에 common api 의존 추가**

```kotlin
dependencies {
    implementation(projects.feature.app.setting.api)
    implementation(projects.feature.common.terms.api)
}
```

- [ ] **Step 2: setting EntryBuilder.kt — terms/privacy entry·import 제거**

`entry<NavKeyServiceTerms>`·`entry<NavKeyPrivacyPolicy>` 두 블록과 아래 import 4개 삭제:
`NavKeyPrivacyPolicy`, `NavKeyServiceTerms`, `ServiceTermsRoute`, `PrivacyPolicyRoute`. 최종:
```kotlin
package com.teamyg.parfait.feature.app.setting.impl.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import androidx.navigation3.runtime.EntryProviderScope
import androidx.navigation3.runtime.NavKey
import com.teamyg.parfait.core.designsystem.theme.colors.YGAtomicColors
import com.teamyg.parfait.core.navigation.Navigator
import com.teamyg.parfait.feature.app.setting.api.NavKeyAccountInfo
import com.teamyg.parfait.feature.app.setting.api.NavKeyAppSetting
import com.teamyg.parfait.feature.app.setting.impl.route.AccountInfoRoute
import com.teamyg.parfait.feature.app.setting.impl.route.AppSettingRoute

fun EntryProviderScope<NavKey>.featureAppSettingEntryBuilder(navigator: Navigator) {
    entry<NavKeyAppSetting> {
        Scaffold(containerColor = YGAtomicColors.Gray.White) { innerPadding ->
            AppSettingRoute(
                navigator = navigator,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
            )
        }
    }

    entry<NavKeyAccountInfo> {
        Scaffold { innerPadding ->
            AccountInfoRoute(
                navigator = navigator,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
            )
        }
    }
}
```

- [ ] **Step 3: AppSettingRoute.kt — NavKey import 2개를 common.terms.api로 변경**

```kotlin
import com.teamyg.parfait.feature.app.setting.api.NavKeyAccountInfo
import com.teamyg.parfait.feature.common.terms.api.NavKeyPrivacyPolicy
import com.teamyg.parfait.feature.common.terms.api.NavKeyServiceTerms
```
(`goTo(NavKeyServiceTerms)`·`goTo(NavKeyPrivacyPolicy)` 본문 그대로. `AppSettingViewModel`은 SideEffect만 있어 변경 없음.)

- [ ] **Step 4: setting strings.xml — webview 문자열 2개 제거**

`setting_webview_error_message`·`setting_webview_retry` 줄 삭제. 최종:
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="setting_profile_label">내 프로필</string>
    <string name="setting_item_account">계정 정보</string>
    <string name="setting_item_service_terms">서비스 이용약관</string>
    <string name="setting_item_privacy_policy">개인정보 처리 방침</string>
    <string name="setting_item_version">버전 정보</string>
</resources>
```

---

### Task 5: 전체 빌드 검증 + 커밋

**Files:** (없음 — 검증·커밋만)

- [ ] **Step 1: Gradle 동기화 확인 (신규 모듈 인식)**

Run: `./gradlew projects | grep terms`
Expected: `:feature:common:terms:api`, `:feature:common:terms:impl` 출력.

- [ ] **Step 2: 영향 모듈 compile + ktlint**

Run:
```
./gradlew :feature:common:terms:api:compileDebugKotlin \
          :feature:common:terms:impl:compileDebugKotlin \
          :feature:app:setting:impl:compileDebugKotlin \
          :app:compileDebugKotlin \
          ktlintCheck
```
Expected: BUILD SUCCESSFUL. (실패 시 잔여 `setting.impl` import·문자열 키 누락 점검 → 수정 후 재실행. ktlint 위반은 `ktlintFormat`.)

- [ ] **Step 3: 에뮬/실기기 수동 확인**

앱 실행 → 설정(S-001) → **서비스 이용약관** 탭 → 탑바 `서비스 이용약관` + Notion 웹뷰 로딩→콘텐츠, back 복귀. **개인정보 처리 방침** 동일. 크래시·빈 화면 없음(= common entry가 정상 렌더).

- [ ] **Step 4: commit (사용자 확인 후, 이동 원자적 1커밋)**

```bash
git add -A
git commit -m "refactor(terms): extract terms/privacy screens into :feature:common:terms module"
```

---

## Self-Review 메모

- **스펙 커버리지**: 신규 api(Task1)·impl+7파일이동+entry+strings(Task2)·app 배선(Task3)·setting 정리 4항목(Task4)·의존방향/빌드검증(Task5) — spec 전 항목 매핑. ✅
- **placeholder 없음**: 전 파일 실제 코드/명령. 이동 파일은 `git mv` + 명시된 package/import/문자열 치환. ✅
- **타입 일관**: NavKey 패키지 `common.terms.api`로 통일(Task1↔2 EntryBuilder↔4 AppSettingRoute). 문자열 키 `terms_*`(Task2 strings↔screen/webview 참조) 일치. `featureCommonTermsEntryBuilder`(Task2 EntryBuilder↔NavigationModule) 일치. setting entry는 AppSetting/AccountInfo만 잔존. ✅
- **원자적 이동**: 중간 컴파일 불가 명시, 검증·커밋 Task5 1회(플랜 표준의 per-task 커밋을 이동 특성상 조정). ✅
- **gradle**: 신규 모듈은 컨벤션 플러그인만, impl은 api 의존만. app·setting build에 projects 접근자 추가. settings include 추가. ✅
