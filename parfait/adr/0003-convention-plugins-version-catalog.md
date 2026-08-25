---
id: ADR-0003
title: build-logic 컨벤션 플러그인 + 버전 카탈로그
status: accepted
date: 2026-05-14
deciders: Parfait 팀
supersedes:
superseded_by:
related_adr: ADR-0001, ADR-0004
related_spec:
related_architecture:
platforms: android
tags: [adr, parfait]
---
# ADR-0003: build-logic 컨벤션 플러그인 + 버전 카탈로그

## 맥락
다중 모듈([[0001-layered-multi-module]])이면 모듈마다 `build.gradle.kts`에 compileSdk·Java 버전·플러그인·공통 의존을 반복 선언하게 된다. 복붙은 곧 드리프트(모듈마다 설정이 미묘하게 다름)를 낳는다.

## 결정
`build-logic/convention`에 커스텀 Gradle 컨벤션 플러그인을 두고, 각 모듈은 `alias(libs.plugins.*)`로 해당 플러그인만 적용한다. 플러그인 ID 접두사는 `com.teamyg.parfait.plugin.*`.

주요 플러그인:
- `AndroidApplicationConventionPlugin`, `AndroidLibraryConventionPlugin` — compileSdk/minSdk/targetSdk·Java 17 공통.
- `AndroidApplicationSigningConventionPlugin` — 서명 키를 `local.properties`에서 로드(`PropertySettingManager`).
  🔁 **as-built(2026-08-16, PR #264)** — `setSigningConfig`이 `signingConfigs`를 만들기만 하던 것에서
  **release 빌드 타입에 release 설정을 결선**하는 데까지 갔다(`buildTypes.getByName("release")`).
  그전까지 release 산출물은 등록만 된 키를 쓰지 않았다. debug 타입은 종전대로 기본 결선을 쓴다.
  🔁 **as-built(2026-08-25, PR #354)** — **키가 없을 때의 거동이 바뀌었다.** `loadReleaseKey`·
  `loadDebugKey`가 `Key?`를 반환해 없으면 `null`이고, 예전처럼 `./error.jks`라는 **없는 경로로
  채우지 않는다** — 가짜 경로를 채우면 AGP가 그것을 그대로 믿어 "어떤 프로퍼티가 비었는가"를
  아무도 말해 주지 않았다. 대신 `failWhenStoreFileMissing`이 `validateSigningRelease`·
  `validateSigningDebug`에 `doFirst`를 얹어 **서명이 실제로 필요한 순간에만** 비어 있는 프로퍼티
  이름과 함께 실패시킨다. 설정 단계에서 터뜨리지 않는 근거는 **CI가 키를 주입하지 않는다**는 것이다
  (`.github/actions/restore-app-secrets`는 카카오 키와 `google-services.json`만 복원한다) — 설정
  단계에서 막으면 ktlint·테스트조차 못 돈다. 두 프로퍼티 키 상수(`YG_RELEASE_STORE_FILE`·
  `YG_DEBUG_STORE_FILE`)가 그 메시지를 만들려고 `internal`에서 공개로 올라갔고, `findProperty` →
  `local.properties` 순회와 `Properties` 로딩이 릴리즈·디버그 공용 함수 하나로 합쳐졌다
  (`loadBaseUrl`도 같은 `localProperties()`를 쓴다). ⚠️ **이 안내가 실제로 발화하는지 확인되지
  않았다** — 태스크 **이름 일치**에 걸려 있어 그 이름의 태스크가 없으면 조용히 아무 일도 하지 않는다
  → [open-questions](../synthesis/open-questions.md) OQ-P-305.
- `JetpackComposeConventionPlugin` — Compose 활성 + Material3 + Coil.
- `DaggerHiltCoreConventionPlugin` / `DaggerHiltComposeConventionPlugin` — Hilt + KSP([[0004-hilt-ksp-di]]).
- `ModuleDataConventionPlugin`, `ModuleDomainConventionPlugin`, `ModuleFeatureApiConventionPlugin`, `ModuleFeatureImplConventionPlugin` — 레이어별 표준 의존·플러그인 묶음.

버전·의존 SoT = `gradle/libs.versions.toml`. `TYPESAFE_PROJECT_ACCESSORS` 활성으로 `projects.feature.login.api` 형태의 타입 안전 모듈 참조 사용.

## 대안
- **모듈별 수기 build.gradle.kts** — 진입 장벽 낮음. 그러나 드리프트·중복.
  **→ 기각:** 모듈 수 증가 시 유지 불가.
- **buildSrc** — 컨벤션 공유 가능하나 변경 시 전체 캐시 무효화.
  **→ 기각:** `build-logic` composite build가 빌드 캐시 친화적.

## 영향

**긍정**
- 새 모듈 = 알맞은 컨벤션 플러그인 한 줄. 설정 일관성 보장.
- 버전 상향(Kotlin·AGP·Compose BOM 등)이 카탈로그 한 곳에서.

**트레이드오프**
- 컨벤션 플러그인 자체를 이해해야 신규 참여자가 빌드 흐름을 파악 가능.

**위험·방어**
- 레이어 규칙(누가 무엇에 의존)을 플러그인이 코드로 강제 → 문서 드리프트 방지.
