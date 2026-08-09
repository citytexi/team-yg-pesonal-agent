---
id: ci-gradle-cache-seeding
title: CI Gradle 캐시 시딩 (GitHub Actions Gradle cache seeding)
status: draft
category: build-ci
platforms: android
verified: 2026-08-10
related_code: gradle-cache-seed.yml, test.yml, ktlint.yml, setup-android-build/action.yml, gradle.properties
related_adr:
related_spec:
related_architecture:
supersedes:
superseded_by:
tags: [spec, parfait, ci, build]
---

# Spec: CI Gradle 캐시 시딩

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처(source of truth). 본문은 설계 내용에 집중.

## 목표

PR CI의 Gradle 캐시가 한 번도 적중하지 않는 상태를 고친다. 현재 모든 워크플로가
`pull_request` 트리거만 갖고 있어 캐시를 **저장하는 job이 존재하지 않고**, 그 결과 매 PR 런이
콜드 빌드로 돈다. 기본 브랜치(`develop`)에 캐시 생산자 job을 세우고, 캐시에 담길 내용물을
늘려(`org.gradle.caching`) 기존 PR job 둘이 소비자로 동작하게 만든다.

## 진단 근거

관측은 아래 두 런에 고정한다(런 ID가 박혀 있어 나중에 거짓이 되지 않는다).
저장소는 `mash-up-kr/TEAMYG-Android`(구 `TJYG-Android`, 리다이렉트 동작 중).

| 런 | job | `Run unit tests` |
|---|---|---|
| PR #25, run `31323149207` | `unit-test` | 4분대 |
| PR #26, run `31323027198` | `unit-test` | 4분대 |

두 job 로그가 동일하게 보여준 것:

- `gradle/actions/setup-gradle` 입력이 `cache-read-only: true`
- `Gradle User Home cache not found. Will initialize empty.`
- `./gradlew test` 결과가 `651 actionable tasks: 651 executed` — `FROM-CACHE` 0건, up-to-date 0건
- Gradle 배포판 zip을 매 런 새로 내려받음
- 데몬 기동 완료 시각부터 첫 태스크 실행까지 1분 이상(플러그인·의존성 해석 구간)

`setup-gradle`은 **기본 브랜치의 job에서만** 캐시를 저장하고 그 외에는 읽기 전용으로 동작한다.
이 저장소 기본 브랜치는 `develop`인데, 워크플로 4종(`test` · `ktlint` · `claude-code-review` ·
`auto-assign`) 어느 것도 `push` 트리거를 갖지 않는다. 저장하는 쪽이 없으므로 캐시 항목이
생성된 적이 없고, PR job은 존재하지 않는 캐시를 매번 조회만 한다.

두 번째 원인은 캐시의 내용물이다. `gradle.properties`에 `org.gradle.caching`이 없어 빌드 캐시가
꺼져 있다. 이 상태에서는 Gradle User Home에 의존성만 쌓이고 태스크 출력 저장소
(`build-cache-1`)가 비므로, 시딩을 붙여도 태스크 재실행은 그대로 남는다. 두 변경은 함께 가야
의미가 있다.

## 범위

- 포함: `develop` push에서 도는 캐시 시딩 워크플로 신규 1건.
- 포함: `gradle.properties`에 빌드 캐시·병렬 실행 활성화 및 데몬 힙 상향.
- 제외: **configuration cache**. Gradle 9·AGP 9 조합에서 동작 자체는 하지만, config cache
  데이터는 프로젝트의 `.gradle/configuration-cache`에 저장되고 `setup-gradle`이 캐시하는 대상은
  Gradle User Home(`caches`)이라 **매 런 새 러너인 CI에서는 이득이 0이다.** CI에서 이득을 보려면
  `setup-gradle`의 `cache-encryption-key` 입력과 대응 repo secret이 필요하다. 이번 범위에서 빼고
  별건으로 다룬다(→ 주의/열린 질문).
- 제외: 기존 `test.yml` · `ktlint.yml` 의 로직 변경. 생산자/소비자를 분리해 소비자 쪽은 건드리지 않는다.
- 제외: `setup-android-build` 합성 액션 변경. `develop`이 기본 브랜치라 쓰기 모드 전환에 추가 입력이 필요 없다.
- 제외: Node 20 deprecation 경고(annotation 2건) 대응. 별개 사안.

## 변경 대상

### 신규 `.github/workflows/gradle-cache-seed.yml`

```yaml
name: gradle-cache-seed

on:
  push:
    branches: [ develop ]

permissions:
  contents: read

jobs:
  seed:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: ./.github/actions/setup-android-build

      - name: Restore app secrets
        uses: ./.github/actions/restore-app-secrets
        with:
          kakao-native-app-key: ${{ secrets.KAKAO_NATIVE_APP_KEY }}
          google-services-json: ${{ secrets.GOOGLE_SERVICES_JSON }}

      # PR 워크플로(test·ktlint)가 쓰는 태스크를 한 번의 Gradle 호출로 돌려 캐시를 데운다.
      # --continue: 하나가 실패해도 나머지 태스크 출력은 캐시에 남긴다.
      - name: Warm Gradle caches
        run: |
          ./gradlew test ktlintCheck \
            :core:util:android:assembleDebugAndroidTest \
            :core:designsystem:assembleDebugAndroidTest \
            --continue
```

태스크 목록은 PR 워크플로 둘의 합집합이다. `test`와 두 `assembleDebugAndroidTest`는 `test.yml`이,
`ktlintCheck`는 `ktlint.yml`이 실행한다. 한 job 안에서 한 번의 Gradle 호출로 묶는 이유는 두 가지다.
워크플로 둘에 각각 `push` 트리거를 다는 방식은 job 2개가 동시에 같은 캐시 키에 쓰게 되어 한쪽
저장이 버려질 수 있고, 의존성 해석과 데몬 기동을 두 번 치르게 된다.

`--continue`는 `ktlintCheck` 실패가 뒤따르는 컴파일 태스크의 캐시 적재를 막지 못하게 한다.
시딩 job의 목적은 게이트가 아니라 캐시 적재이므로, 실패해도 최대한 많이 채우는 쪽이 맞다.

`concurrency` 그룹은 두지 않는다. `cancel-in-progress: true`는 캐시 저장 직전의 런을 죽여 목적을
훼손하고, 연속 머지로 두 런이 겹쳐도 나중 저장이 "이미 존재하는 키"로 무시될 뿐 해가 없다.

### `gradle.properties`

```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8
org.gradle.caching=true
org.gradle.parallel=true
kotlin.code.style=official
```

- `org.gradle.caching` — 태스크 출력 재사용을 켠다. `setup-gradle`의 `gradle-home-cache-includes`가
  `caches`이고 빌드 캐시 디렉토리(`build-cache-1`)가 그 아래 있으므로, 켜는 것만으로 시딩 대상에 포함된다.
  이 설정 없이는 시딩 워크플로를 붙여도 태스크는 매번 다시 실행된다.
- `org.gradle.parallel` — 모듈이 여럿이고 러너가 멀티코어다. 독립 모듈을 병렬 컴파일한다.
- 힙 상향 — 병렬 워커와 Kotlin 데몬이 함께 뜨면 기존 힙에서 GC 압박을 받는다. 러너 메모리와
  일반적인 개발 머신 모두 여유가 있다.

## 검증

1. 로컬 `./gradlew clean test` 1회 — 병렬 실행·힙 변경이 빌드를 깨지 않는지. 모듈 간 암묵적
   의존이 있으면 여기서 드러난다.
2. 로컬 2회차 `./gradlew test` — 로그에 `FROM-CACHE` 태스크가 나타나는지. 안 나오면
   `org.gradle.caching`이 먹지 않은 것이므로 이후 단계가 무의미하다.
3. `develop` 머지 후 seed 런 로그 — Gradle 상태 저장 메시지가 찍히는지. `setup-gradle`이 기본
   브랜치에서 쓰기 모드로 전환된다는 전제를 실제 런으로 확인하는 지점이다.
4. 그다음 PR의 `Run unit tests` — `Gradle User Home cache not found`가 사라지고 태스크 요약에
   from-cache 항목이 잡히는지. 최종 성공 판정.

3·4는 `develop` 머지 이후에만 확인 가능하다. 이 작업은 머지 전에 효과를 증명할 수 없다.

## 주의 / 열린 질문

- **첫 PR은 여전히 느리다.** seed가 `develop`에 들어간 뒤 도는 PR부터 효과가 난다.
- **러너 시간 총량** — 머지마다 seed job이 추가로 돈다. 대신 PR마다 도는 job 둘이 짧아지므로
  PR 수가 머지 수보다 많은 통상적 흐름에서는 총량이 준다.
- **기대 효과의 범위** — 사라지는 것은 의존성 재다운로드와 태스크 재실행이다. 데몬 기동과 설정
  단계는 configuration cache를 범위에서 뺐으므로 그대로 남는다.
- **열린 질문: configuration cache를 CI에서 살릴 것인가.** `cache-encryption-key` 입력 +
  repo secret 생성이 필요하고, Crashlytics·google-services 플러그인의 config cache 호환을
  따로 검증해야 한다. 이번 스펙에서 의도적으로 제외했다.
- **열린 질문: Node 20 deprecation.** 두 런 모두 `actions/checkout@v4` · `actions/setup-java@v4` ·
  `actions/upload-artifact@v4` · `dorny/test-reporter@v2` · `gradle/actions/setup-gradle@v4`에 대해
  경고를 냈고, `setup-java@v4`는 별도 deprecation 경고까지 붙었다. 캐시와 무관한 별건.
