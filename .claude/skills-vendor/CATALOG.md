# 벤더 스킬 CATALOG (주제별)

> 갱신: 2026-07-22 | spec/plan 작성 시 `skill-finder`로 검색, 목차는 아래.

## android-skills / build
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
- **compose-state-hoisting** — Use when deciding where Jetpack Compose UI element state or UI logic should live: local remember state, hoisted composable parameters, a pla
- **compose-state-holder-ui-split** — Use when a Jetpack Compose screen-level composable takes a ViewModel/component/controller, collects state or effects, handles navigation/sna
- **compose-ui-testing-patterns** — Use when writing or reviewing Jetpack Compose UI tests, screenshot tests, previews, semantics assertions, fake image loading, keyboard input
- **implement-issue** — Use when asked to review, fix, implement, resolve, or work through a specific GitHub, GitLab, Jira, or Linear issue reference.
- **kotlin-control-flow** — Use when writing or reviewing Kotlin branching and control flow: when expressions, guard conditions, sealed type exhaustiveness, smart casts
- **kotlin-coroutines-structured-concurrency** — Use when writing or reviewing Kotlin code that stores CoroutineScope, launches from init/non-suspending APIs, calls runBlocking, or catches 
- **kotlin-flow-state-event-modeling** — Use when writing or reviewing Kotlin Flow state and event APIs with StateFlow, MutableStateFlow.update, SharedFlow, Channel, stateIn, Sharin
- **kotlin-functions** — Use when choosing Kotlin member, top-level, extension, factory, or service functions for String, primitive, collection, Flow, framework, or 
- **kotlin-multiplatform-expect-actual** — Use when designing Kotlin Multiplatform expect/actual or interface boundaries for platform services, native SDKs, source sets, Compose Multi
- **kotlin-types-value-class** — Use when writing or reviewing Kotlin type declarations to choose @JvmInline value class over data class where appropriate, including Compose
- **shepherd** — Use when asked to shepherd, babysit, monitor, or poll open pull requests or merge requests — including triaging review comments, detecting C
- **using-chrisbanes-skills** — Use when a Kotlin, Android, or Jetpack Compose task is too broad for any single focused skill to obviously apply, especially for general rev

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

