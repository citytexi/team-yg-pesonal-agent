# 벤더 스킬 CATALOG (주제별)

> 갱신: 2026-08-06 | spec/plan 작성 시 `skill-finder`로 검색, 목차는 아래.

## android-skills / build-system
- **agp-9-upgrade** — Upgrades, or migrates, an Android project to use Android Gradle Plugin

## android-skills / camera
- **camerax** — Provide technical guidance for Android camera development with CameraX.

## android-skills / device-ai
- **appfunctions** — Analyzes Android apps to identify key user workflows for AppFunctions

## android-skills / devtools
- **android-cli** — Provides instructions for installing and using the `android` CLI. The `android` command-line tool is a critical tool for Android development

## android-skills / identity
- **verified-email** — Provides a complete workflow for implementing verified email retrieval

## android-skills / jetpack-compose
- **adaptive** — Instructions to make or update an app's UI so that it adapts to different
- **migrate-xml-views-to-jetpack-compose** — Provides a structured workflow for migrating an Android XML View to Jetpack
- **styles** — Use this skill to integrate the Jetpack Compose Styles API into an Android

## android-skills / navigation
- **navigation-3** — Learn how to install and migrate to Jetpack Navigation 3, and how to

## android-skills / performance
- **r8-analyzer** — Analyzes Android build files and R8 keep rules to identify redundancies,

## android-skills / play
- **engage-sdk-integration** — Helps developers integrate, debug, and resolve Play Engage SDK implementation
- **play-billing-library-version-upgrade** — Use this skill when upgrading or migrating an Android project from any
- **play-policy-insights** — Automated auditor designed to verify Android applications against Google Play Policy domains. It cross-references static code analysis with 

## android-skills / profilers
- **perfetto-sql** — Translates natural language data intents into syntactically valid Perfetto
- **perfetto-trace-analysis** — Analyzes Perfetto traces to find the root cause of latency, memory, or

## android-skills / security
- **android-intent-security** — Best practices for Android Intent security. Use this skill when auditing

## android-skills / system
- **edge-to-edge** — Use this skill to migrate your Jetpack Compose app to add adaptive edge-to-edge

## android-skills / testing
- **testing-setup** — Analyze and create a testing strategy for native Android apps - install

## android-skills / wear
- **wear-compose-m3** — Expert guidance for working with Wear OS Compose Material3. Use this

## android-skills / xr
- **display-glasses-with-jetpack-compose-glimmer** — Provides guidelines for developing projected Android XR apps for display

## android-testing-skills / adb
- **capturing-screenshots-and-screenrecord** — Use this skill to capture visual artefacts from a device for test failures, golden image generation, QA repro, and demo videos. Covers `adb 
- **connecting-over-wifi** — Use this skill to connect ADB to an Android 11+ device wirelessly with the modern `adb pair` flow (pairing code or QR via `Settings → Develo
- **connecting-to-devices** — >-
- **extracting-logs-with-logcat** — Use this skill to read device logs for test failures, debug, smoke testing, and CI repros. Covers `adb logcat` (stream), `adb logcat -d` (du
- **extracting-test-artifacts** — Use this skill to move files between host and device with `adb pull` and `adb push`, including the modern `-z` (compression), `-Z` (no compr
- **injecting-input-and-state** — Use this skill to drive an Android device from the host shell — inject taps, swipes, text, key events, and drag-and-drop via `adb shell inpu
- **installing-and-managing-apps** — Use this skill to install, uninstall, list, inspect, and reset Android apps via `adb install` (with `-r` reinstall, `-d` allow-downgrade, `-
- **running-instrumented-tests-via-adb** — Use this skill to run instrumented Android tests directly through `adb shell am instrument -w -r` without going through Gradle. Covers the r
- **scripting-adb-for-ci** — Use this skill to wire `adb` reliably into CI — bash idioms, exit codes, parallel device fan-out with `xargs -P`, port forwarding (`adb forw
- **understanding-adb-architecture** — Use this skill to reason about the three-piece ADB topology (client CLI, host server on TCP 5037, on-device daemon `adbd`), the lifecycle co

## android-testing-skills / compose
- **asserting-bounds-and-dimensions** — Use this skill to verify Compose layout measurements from a UI test using `assertWidthIsEqualTo`, `assertHeightIsEqualTo`, `assertWidthIsAtL
- **asserting-node-state-and-text** — Use this skill to verify a Compose semantics node's properties from a UI test using `assertExists`, `assertDoesNotExist`, `assertIsDisplayed
- **auditing-compose-test-suite** — Use this skill to perform an end-to-end review of an existing Jetpack Compose UI test file or test suite. Sequences six audit phases (setup 
- **capturing-preview-screenshots-in-ci** — Use this skill to render every Jetpack Compose `@Preview` as a screenshot on a real Android device or emulator and publish a browsable HTML 
- **choosing-test-rule-vs-runtest** — >-
- **clicking-and-scrolling** — Use this skill to drive Jetpack Compose UI from tests with the high-level action APIs that do not go through a gesture builder — performClic
- **composing-semantics-matchers** — Use this skill to build precise Compose UI test queries by composing `SemanticsMatcher` predicates with `infix and`, `infix or`, and `operat
- **configuring-test-dependencies** — >-
- **controlling-the-test-clock** — Use this skill to drive the Compose test clock by hand with MainTestClock — currentTime, autoAdvance, advanceTimeByFrame, advanceTimeBy(mill
- **developing-with-compose-previews** — Use this skill to make `@Preview` functions the primary feedback loop for Jetpack Compose UI work — preview-driven development. Covers hoist
- **enabling-accessibility-checks** — Use this skill to enable Espresso's `AccessibilityValidator` against the Compose semantics tree via `enableAccessibilityChecks(...)` from `a
- **entering-text** — Use this skill to drive Jetpack Compose text fields from tests with the text-specific actions — performTextInput (insert at cursor via the I
- **finding-nodes-by-tag-text-content** — Use this skill to locate Compose semantics nodes from a UI test using `onNodeWithTag`, `onNodeWithText`, `onNodeWithContentDescription`, `on
- **injecting-mouse-and-keyboard** — Use this skill to drive Jetpack Compose UI from tests with non-touch input — performMouseInput (click, rightClick, doubleClick, tripleClick,
- **injecting-touch-gestures** — Use this skill to drive Jetpack Compose UI with synthetic touch events through performTouchInput and the TouchInjectionScope DSL — click, lo
- **printing-the-semantics-tree** — Use this skill to diagnose "no node matched", "found N nodes", and "useUnmergedTree" failures by dumping the actual semantics tree with `pri
- **setting-up-host-vs-device-tests** — Use this skill to choose between host (Robolectric/JVM) and device (instrumentation) tests for Jetpack Compose, and to configure each correc
- **structuring-a-compose-test** — Use this skill to structure a Jetpack Compose UI test class the way androidx itself writes them — `@MediumTest` + `@RunWith(AndroidJUnit4::c
- **synchronizing-with-idle** — Use this skill to choose the right idle-synchronization primitive in Compose UI tests — waitForIdle, awaitIdle, waitUntil(conditionDescripti
- **testing-animations-deterministically** — Use this skill to write non-flaky Compose animation tests by setting mainClock.autoAdvance = false and stepping frames by hand with advanceT
- **testing-lazy-lists** — Use this skill to test `LazyColumn`, `LazyRow`, and `LazyVerticalGrid` correctly — tag the container with `Modifier.testTag(...)`, tag each 
- **testing-state-restoration** — >-
- **testing-with-espresso-interop** — Use this skill to mix Compose finders and Espresso `onView` in the same test — for Android `Dialog` windows, IME (soft keyboard) state, `Com
- **traversing-the-semantics-tree** — Use this skill to navigate from one Compose semantics node to its relatives via `onParent`, `onChildren`, `onChild`, `onChildAt`, `onSibling
- **validating-compose-stability** — >-

## android-testing-skills / fundamentals
- **applying-testing-strategies** — Use this skill to apply Android-team testing strategies — determinism, hermetic execution, Given-When-Then / Arrange-Act-Assert structure, n
- **choosing-what-to-test** — Use this skill to pick which behaviors to cover in an Android test suite using Google's five-category state vocabulary plus the explicit "wh
- **organizing-test-source-sets** — Use this skill to organize Android test source sets — `src/test/`, `src/androidTest/`, the community `src/sharedTest/` convention, and the m
- **picking-test-doubles** — Use this skill to pick the right test double — fake, mock, stub, spy, dummy, or Robolectric shadow — for an Android test. Encodes Google's v
- **understanding-the-testing-pyramid** — Use this skill to size an Android test suite using Google's small / medium / big scope vocabulary and the qualitative pyramid. Explains why 

## android-testing-skills / instrumentation
- **cross-app-tests-with-uiautomator** — Use this skill to drive cross-app and system-UI flows from instrumentation tests using UiAutomator 2.3.0 — `UiDevice`, `BySelector` / `UiObj
- **launching-activities-with-activityscenario** — Use this skill to launch, drive, and tear down an Activity from an instrumentation test using `ActivityScenario` and the JUnit4 wrapper `Act
- **launching-fragments-with-fragmentscenario** — Use this skill to test a `Fragment` in isolation using `FragmentScenario`, `launchFragmentInContainer<F>()`, and `launchFragment<F>()`. Cove
- **running-instrumented-tests-with-androidjunit4** — Use this skill to stand up an Android instrumentation test source set with the canonical `AndroidJUnit4` runner, the correct `AndroidJUnitRu
- **running-tests-on-gradle-managed-devices** — Use this skill to run instrumented Android tests on Gradle Managed Devices (GMD) — emulators that Gradle provisions, boots, runs tests on, a
- **writing-espresso-tests** — Use this skill to write Espresso 3.7.0 tests against Android Views — `onView(matcher).perform(action).check(matches(...))`, `onData(...)` fo

## android-testing-skills / jvm-tests
- **configuring-junit4-on-android** — Use this skill to stand up a JUnit4-based JVM unit-test suite on an Android module. Covers the canonical Gradle dependency matrix (`junit:ju
- **mocking-with-mockito** — Use this skill to wire Mockito (the dominant Android mocking framework, exclusively used by androidx itself) into a JVM unit-test suite. Cov
- **mocking-with-mockk** — Use this skill to wire MockK (the Kotlin-first mocking framework) into a JVM unit-test suite, especially when coroutines, singleton/`object`
- **testing-coroutines-with-runtest** — Use this skill to test suspend functions and coroutine-using classes on the JVM with kotlinx-coroutines-test. Covers runTest, TestScope, Sta
- **testing-flows-with-turbine** — Use this skill to assert Flow emissions in tests with Cash App Turbine. Covers flow.test entry, ReceiveTurbine API (awaitItem, awaitComplete
- **using-robolectric-correctly** — Use this skill to run Android-aware unit tests on the JVM with Robolectric — the right runner choice (AndroidJUnit4 vs RobolectricTestRunner

## android-testing-skills / kotlin
- **writing-tests-with-kotlin-test** — Use this skill to write tests with the `kotlin.test` library — the multiplatform assertion + annotation API that compiles the same in `commo

## android-testing-skills / platform
- **migrating-from-android-test-classes** — Use this skill to migrate a codebase off the deprecated `android.test.*` testing classes that ship in the Android platform SDK onto AndroidX

## chrisbanes-skills / skills
- **compose-animations** — Use when writing or reviewing Jetpack Compose motion: visibility enter/exit, animating one property toward a target, color or size transitio
- **compose-focus-navigation** — Use when writing or reviewing Jetpack Compose UI for TV, keyboard, desktop, accessibility focus, D-pad navigation, FocusRequester, focusProp
- **compose-modifier-and-layout-style** — Use when writing or reviewing Jetpack Compose layout APIs, modifier parameters, modifier chain construction, hardcoded root layout decisions
- **compose-recomposition-performance** — Use when investigating Jetpack Compose recomposition performance, skippable/restartable composables, composables.txt or compiler reports, La
- **compose-side-effects** — Use when writing or reviewing Jetpack Compose code with LaunchedEffect, DisposableEffect, SideEffect, rememberCoroutineScope, rememberUpdate
- **compose-slot-api-pattern** — Use when designing or reviewing a reusable Jetpack Compose component whose visual regions vary by caller, or when primitive content paramete
- **compose-stability-diagnostics** — Use when writing or reviewing Jetpack Compose parameter stability, compiler reports, skippability, unstable UI state classes, collection par
- **compose-state-authoring** — Use when writing or reviewing Jetpack Compose code with bare local var in a @Composable, remember { mutableStateOf(...) }, mutableStateListO
- **compose-state-deferred-reads** — Use when Jetpack Compose code reads scroll, animation, gesture, or other frame-rate State in composition, passes changing values across comp
- **compose-state-hoisting** — Use when adding or refactoring interactive Jetpack Compose UI that introduces or moves remember state or coordinated UI logic, or when a scr
- **compose-ui-testing-patterns** — Use when writing or reviewing Jetpack Compose UI tests, screenshot tests, previews, semantics assertions, fake image loading, keyboard input
- **kotlin-control-flow** — Use when writing or reviewing Kotlin branching and control flow: when expressions, guard conditions, sealed type exhaustiveness, smart casts
- **kotlin-coroutines-structured-concurrency** — Use when writing or reviewing Kotlin code that stores CoroutineScope, launches from init/non-suspending APIs, calls runBlocking, or catches 
- **kotlin-flow-state-event-modeling** — Use when writing or reviewing Kotlin Flow state and event APIs with StateFlow, MutableStateFlow.update, SharedFlow, Channel, stateIn, Sharin
- **kotlin-functions** — Use when choosing Kotlin member, top-level, extension, factory, or service functions for String, primitive, collection, Flow, framework, or 
- **kotlin-multiplatform-expect-actual** — Use when designing Kotlin Multiplatform expect/actual or interface boundaries for platform services, native SDKs, source sets, Compose Multi
- **kotlin-types-value-class** — Use when writing or reviewing Kotlin type declarations to choose @JvmInline value class over data class where appropriate, including Compose
- **run-github-project** — Use when asked to set up or repair a repository's GitHub Project configuration, reconcile Project epics or human checkpoints, triage Backlog
- **shepherd** — Use when asked to shepherd, babysit, monitor, or poll open pull requests or merge requests — including triaging review comments, detecting C
- **to-plan** — Use when one ready GitHub issue or one explicitly confirmed conversation specification needs a repository-aware implementation plan for a la
- **using-chrisbanes-skills** — Use when debugging, benchmarking, or profiling leads into Kotlin or Jetpack Compose source before the cause is known, or when a broad Kotlin

## compose-performance-skills / audit
- **auditing-compose-performance** — Use this skill to run an end-to-end Jetpack Compose performance audit when the symptom is broad ("the app feels sluggish", "scroll is rough 

## compose-performance-skills / build
- **configuring-r8-for-compose** — Use this skill to configure R8 correctly for a Jetpack Compose application — full mode by default, `proguard-android-optimize.txt`, resource

## compose-performance-skills / hot-reload
- **iterating-with-ai-and-mcp** — Use this skill to drive Compose HotSwan from an AI agent (Claude Code, Cursor, any MCP client) so the agent can edit a Kotlin file, trigger 
- **preserving-state-across-reloads** — Use this skill to keep Jetpack Compose state alive across HotSwan hot reloads by understanding the three escalating tiers Compose HotSwan us
- **setting-up-compose-hotswan** — Use this skill to install and verify Compose HotSwan end to end so a developer goes from zero to working sub-second hot reload on a real dev
- **understanding-hot-reload-limits** — Use this skill to teach Claude exactly which Kotlin and Compose changes hot-reload under Compose HotSwan and which trigger a full incrementa

## compose-performance-skills / lists
- **configuring-lazy-prefetch** — Use this skill to tune Jetpack Compose lazy-layout prefetch with LazyLayoutCacheWindow (Compose Foundation 1.9+, @ExperimentalFoundationApi)
- **optimizing-lazy-layouts** — Use this skill to fix scroll jank, lost item state, and broken animateItem() animations in LazyColumn, LazyRow, LazyVerticalGrid, and LazyHo

## compose-performance-skills / measurement
- **generating-baseline-profiles** — Use this skill to generate and measure Jetpack Compose Baseline Profiles end-to-end with the AGP 8.2+ Baseline Profile Generator module and 
- **testing-compose-in-release-mode** — Use this skill to ensure Jetpack Compose performance numbers reflect production reality by measuring against a release variant with R8 enabl
- **tracing-recompositions-at-runtime** — Use this skill to instrument a Jetpack Compose composable with `@TraceRecomposition` from `skydoves/compose-stability-analyzer` so per-recom

## compose-performance-skills / modifiers
- **migrating-to-modifier-node** — Use this skill to author new custom Jetpack Compose modifiers and migrate legacy ones from Modifier.composed { } to Modifier.Node + Modifier
- **ordering-modifier-chains** — Use this skill to diagnose and fix Jetpack Compose Modifier ordering bugs — wrong paint region for background, wrong click area for clickabl

## compose-performance-skills / recomposition
- **avoiding-subcomposition-pitfalls** — Use this skill when a Compose tree uses SubcomposeLayout, BoxWithConstraints, or Scaffold and the developer reports extra measure passes, sl
- **choosing-derivedstateof** — Use this skill to decide when Jetpack Compose derivedStateOf is the right tool and when it is pure overhead. Covers the "input frequency mus
- **debugging-recompositions** — Use this skill to find which Jetpack Compose composables are recomposing and why, using Android Studio Layout Inspector recomposition counts
- **deferring-state-reads** — Use this skill to push frequently-changing Jetpack Compose state reads (scroll position, animation values, drag offsets) out of the Composit
- **using-strong-skipping-correctly** — Use this skill to reason about Jetpack Compose's Strong Skipping Mode — the default since Kotlin 2.0.20 — including what it changes about sk

## compose-performance-skills / side-effects
- **collecting-flows-safely** — Use this skill to migrate Compose UI from `collectAsState()` to `collectAsStateWithLifecycle()`, hoist `Flow<T>` parameters out of composabl
- **using-efficient-effects** — Use this skill to choose the cheapest correct effect API in Jetpack Compose — `LaunchedEffect`, `DisposableEffect`, `SideEffect`, `rememberU

## compose-performance-skills / stability
- **diagnosing-compose-stability** — Use this skill to diagnose Jetpack Compose stability problems by enabling and reading the Compose Compiler Reports (classes.txt, composables
- **enforcing-stability-in-ci** — Use this skill to set up a CI gate that fails the build when Compose stability silently regresses, using the `skydoves/compose-stability-ana
- **stabilizing-compose-types** — Use this skill to fix unstable Jetpack Compose types once a stability diagnosis has identified them. Covers the three-tier strategy — make t
- **understanding-stability-inference** — Use this skill to explain why the Compose compiler classified a class or composable parameter as stable, runtime, unknown, or unstable. Cove
- **using-stability-analyzer-ide-plugin** — Use this skill to install and operate the `skydoves/compose-stability-analyzer` IntelliJ / Android Studio plugin so the developer sees Compo
- **visualizing-recomposition-cascades** — Use this skill to drive the active investigation features of the `skydoves/compose-stability-analyzer` IntelliJ / Android Studio plugin: the

## kotlin-agent-skills / skills
- **kotlin-backend-jpa-entity-mapping** — >
- **kotlin-tooling-agp9-migration** — >
- **kotlin-tooling-cocoapods-spm-migration** — Migrate KMP projects from CocoaPods (kotlin("native.cocoapods")) to Swift Package Manager (swiftPMDependencies DSL) — replaces pod() with sw
- **kotlin-tooling-immutable-collections-0-5-x-migration** — >
- **kotlin-tooling-java-to-kotlin** — >
- **kotlin-tooling-native-build-performance** — >

