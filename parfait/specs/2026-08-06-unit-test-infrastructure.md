---
id: unit-test-infrastructure
title: 유닛 테스트 기반 구조 (Unit Test Infrastructure)
status: draft
category: build-spec
platforms: android
verified: 2026-08-06
related_code:
  - build-logic/convention/src/main/kotlin/BaseConventionPlugin.kt
  - build-logic/convention/src/main/kotlin/com/teamyg/parfait/buildlogic/AndroidConfig.kt#setConfigAndroidLibrary
  - build-logic/convention/src/main/kotlin/com/teamyg/parfait/buildlogic/KotlinJvmConfig.kt#setConfigKotlinJvm
  - gradle/libs.versions.toml
  - domain/src/main/java/com/teamyg/parfait/domain/usecase/CheckNameValidUseCase.kt#CheckNameValidUseCase
  - domain/src/main/java/com/teamyg/parfait/domain/model/DayWindow.kt#DayWindow
  - core/util/jvm/src/main/kotlin/com/teamyg/parfait/core/util/jvm/extension/CharExtension.kt#isKorean
  - data/src/main/java/com/teamyg/parfait/data/source/policy/mapper/VOMapper.kt#toPolicyVO
  - data/src/main/java/com/teamyg/parfait/data/network/AuthInterceptor.kt#AuthInterceptor
  - data/src/main/java/com/teamyg/parfait/data/network/ApiCaller.kt#ApiCaller
related_adr: ADR-0003
related_spec:
related_architecture: module-structure
supersedes:
superseded_by:
tags: [spec, parfait, testing, build-logic]
---

# Spec: 유닛 테스트 기반 구조

> GitHub 이슈: `mash-up-kr/TJYG-Android#215` — "Unit Test가 가능한 구조를 설계"

## 목표

현재 저장소에는 테스트 소스셋과 테스트 의존성이 하나도 없다. 30개가 넘는 모듈 중
어디에도 `src/test/`가 존재하지 않고, 버전 카탈로그에 JUnit·코루틴 테스트·Fake 관련
아티팩트가 전혀 선언돼 있지 않다. 이 스펙은 테스트를 쓸 수 있는 최소 기반을 세우고,
로직이 실제로 있는 모듈 4개에 배선한 뒤, 팀이 따라 쓸 수 있는 시범 테스트와 규약을 남긴다.

컨벤션 플러그인은 unit·계측·Compose UI 3종을 모두 만들되, 실제 적용은 unit을 4개 모듈에,
계측·Compose는 검증용 스모크 모듈 1개씩에만 한다.

## 범위

**포함**

- 버전 카탈로그에 테스트 의존성·번들 추가
- 컨벤션 플러그인 3종 신설 (`parfait-test-unit` / `parfait-test-android` / `parfait-test-compose`)
- `:core:testing` 모듈 신설 (공용 Rule·Fake·픽스처)
- `domain` / `data` / `core:util:jvm` / `core:util:android` 4개 모듈에 unit 배선
- 시범 유닛 테스트 (순수 로직 · 매퍼 · DataSource · HTTP 계층)
- 스모크 계측 테스트 2건 (`core:util:android`, `core:designsystem`)
- `DayWindow.current()`에 `Clock` 주입 (테스트 가능성 확보를 위한 최소 프로덕션 변경)
- GitHub Actions 테스트 워크플로 + 실패 리포트·결과 업로드

**제외**

- Robolectric — 안 넣는다. Android 프레임워크 의존 코드는 이번 unit 테스트 대상이 아니다.
- `feature:*` 모듈 — ViewModel·화면이 데이터 미결선 상태라 테스트 대상으로 적합하지 않다.
  플러그인이 준비돼 있으므로 준비되는 시점에 붙인다.
- Hilt 테스트(`@HiltAndroidTest`·`@TestInstallIn`) — 계측·통합 테스트용이고 이번 범위 밖이다.
  유닛 테스트는 생성자 주입으로 직접 인스턴스화한다.
- 에뮬레이터 실행 — 스모크 계측 테스트는 `assembleDebugAndroidTest` 컴파일까지만 검증한다.
- 커버리지 측정(JaCoCo·Kover) · 스크린샷 테스트 · Gradle Managed Devices

## 라이브러리 스택

| 아티팩트 | 소스셋 | 용도 |
|---|---|---|
| `junit:junit` | test / androidTest | JUnit4 |
| `kotlin-test` | test | 어서션 (Kotlin 버전에 정렬) |
| `kotlinx-coroutines-test` | test | `runTest`·`StandardTestDispatcher`·가상 시간 |
| `app.cash.turbine:turbine` | test | Flow 방출 검증 |
| `io.mockk:mockk` | test | 상호작용 검증 · Retrofit Service 대역 |
| `com.squareup.okhttp3:mockwebserver3` | test | HTTP 계층 검증 |
| `androidx.test.ext:junit` | androidTest | `AndroidJUnit4` 러너 |
| `androidx.test:runner`·`androidx.test:rules` | androidTest | 계측 러너·룰 |
| `androidx.compose.ui:ui-test-junit4` | androidTest | Compose UI 테스트 |
| `androidx.compose.ui:ui-test-manifest` | **debug** | `ComponentActivity` 매니페스트 병합 |

`androidx.test.ext:junit`은 unit 소스셋에 넣지 않는다. Robolectric을 쓰지 않으므로
`AndroidJUnit4` 러너가 필요 없고, 순수 JVM 테스트는 러너 지정 없이 기본 JUnit4로 돈다.

MockWebServer는 OkHttp 5 계열에서 아티팩트가 둘로 갈리는데(레거시 `okhttp3:mockwebserver`와
신규 `okhttp3:mockwebserver3`), 실물 확인 결과 **둘 다 5.4.0이 배포돼 있다.** OkHttp 버전과
함께 움직이도록 `version.ref = "okhttp"`로 걸고 신규 패키지(`mockwebserver3`)를 쓴다.

번들 3개로 묶는다.

- `test-unit` — junit, kotlin-test, kotlinx-coroutines-test, turbine, mockk, mockwebserver
- `test-android` — androidx.test.ext:junit, androidx.test:runner, androidx.test:rules
- `test-compose` — androidx.compose.ui:ui-test-junit4 (Compose BOM에 정렬)

## 컨벤션 플러그인

기존 build-logic 구조를 따른다 — 플러그인 클래스는 `BaseConventionPlugin`을 상속한 얇은
껍데기이고, 실제 설정은 `com.teamyg.parfait.buildlogic.TestConfig`의 함수에 둔다.
`AndroidApplicationConventionPlugin` → `setConfigAndroidApplication()` 관계와 동일하다.

### `parfait-test-unit` → `setConfigTestUnit()`

- `testImplementation(bundles.test-unit)`
- `testImplementation(projects.core.testing)`
- Android 확장이 있을 때만 `testOptions` 설정 (아래 분기 참고)

`testOptions`는 Android 확장(`LibraryExtension`·`ApplicationExtension`)에만 존재한다.
`domain`·`core:util:jvm`은 `parfait-kotlin-jvm` 기반이라 확장이 없으므로, 의존성은 항상
붙이고 `testOptions` 설정은 확장 존재 여부로 분기한다.

`testOptions.unitTests.isReturnDefaultValues`는 **기본값(false)을 유지한다.** Robolectric을
쓰지 않는 구성에서 이걸 켜면 `android.jar` 스텁 메서드가 예외 대신 기본값을 조용히 반환해
Android 의존 코드가 잘못 통과한다. 예외로 실패하는 편이 "이건 유닛 테스트 대상이 아니다"라는
정확한 신호다.

### `parfait-test-android` → `setConfigTestAndroid()`

- `androidTestImplementation(bundles.test-android)`
- `androidTestImplementation(projects.core.testing)` — Fake를 계측 테스트에서도 재사용
- `testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"`
- `testOptions.animationsDisabled = true` — 계측 테스트 flake의 주원인 차단

### `parfait-test-compose` → `setConfigTestCompose()`

- `androidTestImplementation(bundles.test-compose)` (Compose BOM platform 포함)
- `debugImplementation(androidx.compose.ui:ui-test-manifest)`

`ui-test-manifest`는 반드시 `debugImplementation`이다. 이 아티팩트는
`<activity android:name="androidx.activity.ComponentActivity">` 항목을 병합 매니페스트에
넣는 역할인데, `androidTestImplementation`에 걸면 병합이 안 돼 `createComposeRule()`이
`ActivityNotFoundException`으로 죽는다. `TestManifestGradleConfiguration` lint가 이걸 잡는다.

### 적용 대상

| 플러그인 | 적용 모듈 |
|---|---|
| `parfait-test-unit` | `domain`, `data`, `core:util:jvm`, `core:util:android` |
| `parfait-test-android` | `core:util:android` (스모크) |
| `parfait-test-compose` | `core:designsystem` (스모크) |

계측·Compose 플러그인을 아무 모듈에도 적용하지 않으면 build-logic 컴파일만 통과할 뿐
의존성 좌표 오타·매니페스트 누락 같은 실제 배선 오류가 드러나지 않는다. 스모크 적용 1개씩이
그 검증 공백을 메운다.

## `:core:testing` 모듈

`parfait-kotlin-jvm` 기반 순수 Kotlin 모듈이다. 소비 대상 4개 중 `domain`·`core:util:jvm`은
JVM 모듈이고 `data`·`core:util:android`는 Android 라이브러리인데, Android 모듈이 JVM
라이브러리를 소비하는 건 가능하지만 그 반대는 불가능하다. 따라서 JVM으로 만든다.
`ApplicationProvider` 같은 Android 전용 유틸이 필요해지면 그때 `:core:testing-android`를 분리한다.

`domain`을 `api` 의존으로 당긴다 — repository 인터페이스 대역을 제공해야 하기 때문이다.
테스트 소스셋만 이 모듈을 소비하므로 프로덕션 의존 그래프는 변하지 않는다.

**구성**

- `MainDispatcherRule` — `TestWatcher` 기반, `val dispatcher: TestDispatcher`를 **공개**한다.
- 공유 Fake — `domain`의 repository 인터페이스 대역. 인메모리 구현 + 테스트 전용 seed 헬퍼.
- 픽스처 — 그룹·토큰·닉네임 등 도메인 샘플 상수.

### `MainDispatcherRule`이 dispatcher를 공개해야 하는 이유

androidx 정본은 dispatcher를 private으로 받는 `TestRule` 형태인데, 그대로 쓰면 스케줄러가
둘로 갈린다. `runTest`는 인자 없이 호출하면 자기 `TestCoroutineScheduler`를 새로 만들기
때문에, `advanceUntilIdle()`이 룰 쪽 Main 디스패처의 큐를 비우지 못한다. 결과는 "상태가
아직 Loading"으로 실패하는 테스트다.

`TestWatcher` 변형으로 dispatcher를 노출하고 호출부에서 `runTest(mainRule.dispatcher)`로
명시 전달해 스케줄러를 하나로 묶는다. 기본값은 `StandardTestDispatcher`다 —
`UnconfinedTestDispatcher`는 즉시 디스패치라 순서 버그를 감춘다.

## 테스트 규약

1. **상태를 제공하는 대역은 Fake.** `every { }`로 데이터만 먹이는 mock은 Fake로 대체한다.
2. **MockK는 상호작용 검증에만.** `coVerify`가 있는 테스트에서만 등장한다.
   검증 없는 mock이 보이면 Fake로 바꾼다.
3. **코루틴은 `runTest`.** `runBlocking`·`runBlockingTest` 금지. `StandardTestDispatcher`가
   기본이므로 상태 단언 전에 `advanceUntilIdle()`(또는 `runCurrent()`)을 호출한다.
4. `viewModelScope`·`Dispatchers.Main`을 타면 `MainDispatcherRule` 필수, 본문은
   `runTest(mainRule.dispatcher)`.
5. **Flow 검증은 Turbine.** 핫 플로우를 `TestScope`에서 그냥 `collect`하면 테스트가
   타임아웃까지 멈춘다. `flow.test { }` 또는 `backgroundScope`를 쓴다.
6. `advanceUntilIdle`·`advanceTimeBy`·`runCurrent`를 쓰는 파일에는
   `@file:OptIn(ExperimentalCoroutinesApi::class)`를 붙인다.
7. **테스트 이름은 영문 `메서드_상태_기대`.** 예: `invoke_nameStartsWithSpace_returnsSpaceAtEdge`.
   백틱 메서드명은 기기 API 30+에서만 지원되는데 이 프로젝트 `minSdk`는 26이라 계측
   테스트가 구형 기기에서 깨진다. unit·계측 규약을 하나로 통일한다.
8. 본문 구조는 Given-When-Then 주석 블록으로 드러낸다.
9. **시각·난수는 주입한다.** `Clock.System.now()`·`Random()`을 직접 호출하는 코드는 테스트
   불가능하다. 파라미터로 받고 기본값을 두는 방식으로 해결한다.
10. 소스셋 디렉토리는 각 모듈의 `main`을 따른다 — `domain`·`data`는 `src/test/java/`,
    `core:util:*`·`core:designsystem`은 `src/test/kotlin`·`src/androidTest/kotlin`.

## 프로덕션 코드 변경

`DayWindow.current()`가 `Clock.System.now()`를 직접 호출해 시각을 고정할 수 없다.
`timeZone`은 이미 파라미터인데 시각은 아니라서, 새벽 3시 경계 로직을 실제 그 시각에만
검증할 수 있는 상태다.

```kotlin
fun current(
    timeZone: TimeZone = TimeZone.currentSystemDefault(),
    clock: Clock = Clock.System,
): DayWindow
```

기본값이 있어 기존 호출부는 변경되지 않는다. 이 스펙에서 유일한 프로덕션 코드 변경이다.

## 시범 테스트

| 모듈 | 대상 | 검증 내용 |
|---|---|---|
| `core:util:jvm` | `CharExtension#isKorean` | 한글·영문·숫자·기호·공백 경계 |
| `core:util:jvm` | `DateFormat` · `DateTextFormat` | 포맷 변환 |
| `domain` | `CheckNameValidUseCase` | 검증 규칙 4종 각각 + 규칙 적용 우선순위 |
| `domain` | `DayWindow` | 03시 경계 직전·직후, `contains`의 반열림 구간 |
| `data` | `VOMapper#toPolicyVO` | 응답 → VO 매핑, 미지의 type이 `UNKNOWN`으로 |
| `data` | `PolicyRemoteDataSourceImpl` | Service를 MockK로 대역, 성공·실패 경로 매핑 |
| `data` | `AuthInterceptor` + `ApiCaller` | MockWebServer로 토큰 헤더 부착 · `@NoAuth` 분기 · 에러 변환 |
| `core:util:android` | (unit 없음) | 내용물이 Compose Modifier·Context/Bitmap 확장이라 대상 없음 |
| `core:util:android` | 계측 스모크 1건 | `assembleDebugAndroidTest` 컴파일 검증 |
| `core:designsystem` | Compose 스모크 1건 | `createComposeRule` 동작 + `ui-test-manifest` 배선 검증 |

`data`의 MockWebServer 테스트는 엄밀히는 유닛이 아니라 컴포넌트 성격이지만, 실제 기기가
필요 없으므로 `src/test/`에 둔다.

## CI

기존 `ktlint.yml`에 이미 `./gradlew --info test` 스텝이 있다. 지금은 테스트가 0개라
아무것도 안 하고 통과하지만, 이 스펙을 구현하면 실제로 테스트를 돌리기 시작한다.
새 워크플로를 추가하면 같은 테스트가 두 번 실행되므로 **`ktlint.yml`에서 그 스텝을 제거하고**
테스트 실행을 `test.yml`로 옮긴다. `ktlint.yml`은 포매팅 검사만 담당한다.

`.github/workflows/test.yml`을 신설한다. `ktlint.yml`의 구조를 그대로 따른다 —
PR 타깃 브랜치는 `develop`, JDK 17(temurin), Gradle 캐시, `gradlew` 실행 권한 부여,
그리고 **빌드에 필요한 시크릿 파일 생성 2건**(`local.properties`의 `KAKAO_NATIVE_APP_KEY`,
`app/google-services.json`)까지 동일하다. 이 두 스텝이 없으면 빌드 자체가 실패한다.

실행 태스크는 모듈 종류에 따라 갈린다 — JVM 모듈은 `test`, Android 모듈은 `testDebugUnitTest`다.
루트에서 `./gradlew test`를 돌리면 전 모듈이 대상이 되고 Android 모듈은 debug·release
유닛 테스트를 둘 다 실행하므로, 이번 범위인 4개 모듈만 명시한다.

```
./gradlew :domain:test :core:util:jvm:test \
          :data:testDebugUnitTest :core:util:android:testDebugUnitTest
```

실패 여부와 무관하게(`if: always()`) 결과를 남긴다.

- `build/test-results/**/*.xml` — JUnit XML, PR에 요약으로 게시
- `build/reports/tests/**` — HTML 리포트, 아티팩트 업로드

## 파일 구성

**신규**

- `build-logic/convention/src/main/kotlin/TestUnitConventionPlugin.kt`
- `build-logic/convention/src/main/kotlin/TestAndroidConventionPlugin.kt`
- `build-logic/convention/src/main/kotlin/TestComposeConventionPlugin.kt`
- `build-logic/convention/src/main/kotlin/com/teamyg/parfait/buildlogic/TestConfig.kt`
- `core/testing/build.gradle.kts` + `MainDispatcherRule`·Fake·픽스처
- 각 대상 모듈의 `src/test/` · 스모크 모듈의 `src/androidTest/`
- `.github/workflows/test.yml`

**수정**

- `.github/workflows/ktlint.yml` — `./gradlew --info test` 스텝 제거(중복 실행 방지)
- `gradle/libs.versions.toml` — 버전·라이브러리·번들·플러그인 id 추가
- `settings.gradle.kts` — `:core:testing` include
- 대상 6개 모듈의 `build.gradle.kts` — 플러그인 alias 추가
- `domain/.../DayWindow.kt` — `clock` 파라미터 추가

## 주의 / 열린 질문

- **`mockwebserver3` API 표면.** 좌표는 확정했지만(`okhttp3:mockwebserver3` 5.4.0) 5.x에서
  `MockResponse` 생성 방식과 `takeRequest()` 반환 타입의 프로퍼티명이 4.x와 다르다.
  구현 시 컴파일 에러가 정확한 이름을 알려주므로 그에 맞춘다.
- **ktlint와 테스트 함수명.** 영문 언더스코어 규약을 택했으므로 백틱 면제 여부는 쟁점이
  아니지만, `function-naming` 규칙이 언더스코어를 허용하는지는 첫 빌드에서 확인한다.
  걸리면 해당 규칙을 테스트 소스셋에 한해 완화한다.
- **스모크 계측 테스트는 실행되지 않는다.** 컴파일만 검증하므로 런타임 오류는 이후 실제로
  기기·에뮬레이터를 붙이는 시점까지 드러나지 않는다. CI에 기기를 붙일 때 재검증이 필요하다.
- **`core:util:android`에 unit 테스트가 0개다.** 플러그인만 적용된 상태로 시작하며,
  Android 비의존 로직이 이 모듈에 추가되는 시점에 채워진다.
- **`MainDispatcherRule`은 현재 사용처가 0이고 검증되지 않았다.** 이 룰은 `viewModelScope`·
  `Dispatchers.Main`을 타는 테스트용인데 이번 범위(`domain`·`data`·`core:util:*`)에는 ViewModel이
  없다. 컴파일만 될 뿐 `Dispatchers.setMain` 적용·복원과 `runTest(rule.dispatcher)` 스케줄러 공유는
  아무것도 증명되지 않았다. **첫 ViewModel 테스트를 쓰는 사람이 여기서 막힐 수 있다** — 특히
  `runTest`를 인자 없이 부르면 스케줄러가 갈려 `advanceUntilIdle()`이 Main 큐를 비우지 못한다.
  그때 룰 자체를 검증하는 테스트를 함께 추가할 것.
- **ADR 동반 여부 판단 필요.** 테스트 스택 선택(JUnit4 · Fake 우선 · MockK는 상호작용 검증
  한정)과 `:core:testing` 모듈 도입은 장기간 유지되는 구조 결정에 해당한다. parfait 규율상
  새 아키텍처 결정에는 ADR을 동반하므로, 구현 PR에서 ADR 신설 여부를 결정한다.
