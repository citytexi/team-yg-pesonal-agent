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
- 제외: **configuration cache**. Gradle 9·AGP 9 조합에서 동작 자체는 하지만, `setup-gradle`은
  **`cache-encryption-key`가 설정된 경우에만** config cache 데이터를 저장·복원한다(시크릿이
  config cache 항목에 섞여 유출되는 것을 막기 위한 게이트다). 키가 없으면 **매 런 새 러너인
  CI에서 이득이 0이다.** 살리려면 그 입력과 대응 repo secret을 만들어야 한다. 이번 범위에서
  빼고 별건으로 다룬다(→ 주의/열린 질문).
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
  workflow_dispatch:

permissions:
  contents: read

jobs:
  seed:
    runs-on: ubuntu-latest
    timeout-minutes: 45
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
        continue-on-error: true
        run: |
          ./gradlew test ktlintCheck \
            :core:util:android:assembleDebugAndroidTest \
            :core:designsystem:assembleDebugAndroidTest \
            --continue
```

`continue-on-error`가 `--continue`와 별개로 필요하다. `--continue`는 실패한 태스크 뒤의 남은
태스크를 계속 실행할 뿐 **빌드 종료 코드를 성공으로 바꾸지 않는다.** 그것만으로는 플래키 테스트
1건이 `develop`을 빨갛게 만들고, 캐시는 정상 저장됐는데도 누군가 워크플로를 손대게 된다. 캐시
저장은 `setup-gradle`의 post 스텝(`post-if: '!cancelled()'`)이라 스텝 실패와 무관하다.

`workflow_dispatch`는 캐시가 7일 미사용 만료나 10GB LRU 축출로 날아갔을 때 더미 커밋 없이
재시딩하기 위한 것이다.

태스크 목록은 PR 워크플로 둘의 합집합이다. `test`와 두 `assembleDebugAndroidTest`는 `test.yml`이,
`ktlintCheck`는 `ktlint.yml`이 실행한다. 한 job 안에서 한 번의 Gradle 호출로 묶는 이유는 두 가지다.
워크플로 둘에 각각 `push` 트리거를 다는 방식은 job 2개가 동시에 같은 캐시 키에 쓰게 되어 한쪽
저장이 버려질 수 있고, 의존성 해석과 데몬 기동을 두 번 치르게 된다.

`--continue`는 `ktlintCheck` 실패가 뒤따르는 컴파일 태스크의 캐시 적재를 막지 못하게 한다.
시딩 job의 목적은 게이트가 아니라 캐시 적재이므로, 실패해도 최대한 많이 채우는 쪽이 맞다.

`concurrency` 그룹은 두지 않는다. `cancel-in-progress: true`는 캐시 저장 직전의 런을 죽여 목적을
훼손한다. 연속 머지로 두 런이 겹치는 경우도 해가 없는데, 캐시 키에 `github.sha`가 들어가 두 런이
**서로 다른 키**에 저장되고 복원은 프리픽스 폴백으로 최신 항목을 집기 때문이다. 러너 시간 절약이
목적이라면 `cancel-in-progress: false`가 선택지지만 필수는 아니다.

### `gradle.properties`

```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8
kotlin.daemon.jvmargs=-Xmx2048m
org.gradle.caching=true
org.gradle.parallel=true
kotlin.code.style=official
```

- `org.gradle.caching` — 태스크 출력 재사용을 켠다. `setup-gradle`의 `gradle-home-cache-includes`가
  `caches`이고 빌드 캐시 디렉토리(`build-cache-1`)가 그 아래 있으므로, 켜는 것만으로 시딩 대상에 포함된다.
  이 설정 없이는 시딩 워크플로를 붙여도 태스크는 매번 다시 실행된다.
- `org.gradle.parallel` — 모듈이 여럿이고 러너가 멀티코어다. 독립 모듈을 병렬 컴파일한다.
- 힙 상향 — 병렬 워커와 Kotlin 데몬이 함께 뜨면 기존 힙에서 GC 압박을 받는다.
- `kotlin.daemon.jvmargs` — **이걸 적지 않으면 Kotlin 데몬이 Gradle 데몬의 `-Xmx`를 상속한다.**
  즉 힙 상향이 조용히 4GB + 4GB 예약이 되어 8GB 개발 머신이 스와핑한다. 2048m으로 고정한다.
  이 저장소에는 이 프로퍼티가 원래 없었다.
- `MaxMetaspaceSize`는 상향이 아니라 **신규 상한**이다. `org.gradle.jvmargs`를 지정하면 Gradle
  기본값이 통째로 대체되므로, 적지 않으면 메타스페이스가 사실상 무제한이 된다.

이 두 프로퍼티는 CI뿐 아니라 **모든 팀원의 로컬 빌드**에 적용된다. 빌드 캐시가 켜지면
`~/.gradle/caches/build-cache-1`(기본 상한 5GB)이 디스크를 쓰는 것도 같은 성격의 파급이다.

## 검증

1. 로컬 `./gradlew clean test` 1회 — 병렬 실행·힙 변경이 빌드를 깨지 않는지. 모듈 간 암묵적
   의존이 있으면 여기서 드러난다.
2. 로컬 2회차 `./gradlew test` — 로그에 `FROM-CACHE` 태스크가 나타나는지. 안 나오면
   `org.gradle.caching`이 먹지 않은 것이므로 이후 단계가 무의미하다.
3. `develop` 머지 후 seed 런 로그 — Gradle 상태 저장 메시지가 찍히는지.
4. 그다음 PR의 `Run unit tests` — `Gradle User Home cache not found`가 사라지고 태스크 요약에
   from-cache 항목이 잡히는지. 최종 성공 판정.

3·4는 `develop` 머지 이후에만 확인 가능하다. 이 작업은 머지 전에 효과를 증명할 수 없다.

**단, "쓰기 모드로 전환된다"는 전제는 머지를 기다리지 않고 해소됐다.** `setup-gradle@v4`의
`cache-read-only` 기본값이 `github.ref_name != github.event.repository.default_branch`이므로,
`push`/`develop` 이벤트에서는 `ref_name`이 `develop`이라 `false`(=저장)가 되고, `pull_request`
이벤트에서는 `ref_name`이 `25/merge` 형태라 `true`가 된다 — 진단에서 관측한 로그와 정확히
일치한다. 생산자 캐시를 소비자가 읽는 것도 성립하는데, 복원 키가 job 이름을 포함하지 않는
`|<os>-<arch>` 프리픽스까지 폴백하기 때문이다(그렇지 않으면 job 이름이 다른 `seed` → `unit-test`
복원이 조용히 실패한다).

## 주의 / 열린 질문

- **첫 PR은 여전히 느리다.** seed가 `develop`에 들어간 뒤 도는 PR부터 효과가 난다.
- **러너 시간 총량** — 머지마다 seed job이 추가로 돈다. 대신 PR마다 도는 job 둘이 짧아지므로
  PR 수가 머지 수보다 많은 통상적 흐름에서는 총량이 준다.
- **기대 효과의 범위** — 사라지는 것은 의존성 재다운로드와 태스크 재실행이다. 데몬 기동과 설정
  단계는 configuration cache를 범위에서 뺐으므로 그대로 남는다.
- **검증 커버리지 공백: `org.gradle.parallel`은 `test` 태스크 그래프에서만 확인했다.** 병렬
  실행에서 드러나는 미선언 모듈 간 의존은 태스크 그래프마다 다르게 나타난다. `assembleRelease`·
  `bundleRelease`·`lint` 경로는 미검증이라, 다음 릴리스 빌드가 스케줄링 순서에 따라 간헐 실패하면
  "플래키"로 오진되기 쉽다. seed 런 첫 결과가 `assembleDebugAndroidTest` 경로를 메운다.
- **열린 질문: configuration cache를 CI에서 살릴 것인가.** `cache-encryption-key` 입력 +
  repo secret 생성이 필요하고, Crashlytics·google-services 플러그인의 config cache 호환을
  따로 검증해야 한다. 이번 스펙에서 의도적으로 제외했다.
- **미채택으로 판단한 것** — `paths-ignore`(문서만 바뀐 머지에도 시딩이 도는 러너 시간 낭비지만
  캐시 갱신 관점에선 무해) · `concurrency` 그룹(위 근거) · 캐시 키에 `github.sha`가 들어가
  머지마다 새 Gradle Home 항목이 쌓이는 것(10GB LRU 축출로 자기 제한적, 예상된 트레이드오프).
- **열린 질문: Node 20 deprecation.** 두 런 모두 `actions/checkout@v4` · `actions/setup-java@v4` ·
  `actions/upload-artifact@v4` · `dorny/test-reporter@v2` · `gradle/actions/setup-gradle@v4`에 대해
  경고를 냈고, `setup-java@v4`는 별도 deprecation 경고까지 붙었다. 캐시와 무관한 별건.
