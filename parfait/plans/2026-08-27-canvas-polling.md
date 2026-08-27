# PR3 — 캔버스 주기 폴링 · 병합 규칙 · 하루 경계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오늘 캔버스 저장소 위에 주기 폴링을 얹어, 다른 멤버가 올린 토핑이 화면을 나갔다 오지 않아도 나타나게 한다.

**Architecture:** 폴링 로직은 `:data`의 `CanvasPoller`(`@Singleton`) 하나가 소유하고, 수명은 `BaseViewModel`에 새로 세우는 **구독 수 기반 헬퍼**에 매단다. 라우트가 이미 `collectAsStateWithLifecycle()`을 쓰므로 화면이 백그라운드로 가거나 컴포지션에서 빠지면 구독이 끊기고 폴러의 참조 계수도 내려간다. 주기 갱신은 **부작용 없는 상세 조회**를 쓰고, 캔버스를 만들어야 하는 최초 획득·하루 경계 전환에만 오늘 조회를 쓴다. 모든 갱신이 폴러를 통과하며 갱신마다 주기를 다시 센다.

**Tech Stack:** Kotlin, Coroutines/Flow, Hilt, MockK, Turbine, kotlinx-coroutines-test

**Spec:** [`parfait/specs/2026-08-27-canvas-today-ssot-polling.md`](../specs/2026-08-27-canvas-today-ssot-polling.md) 「PR3 — 폴링 · 병합 규칙 · 하루 경계 · `positionZ` 재계산」
**대응 ADR:** [`parfait/adr/0029-canvas-today-ssot-polling.md`](../adr/0029-canvas-today-ssot-polling.md)

**작업 저장소:** `TJYG-Android` (remote `mash-up-kr/TJYG-Android`). 로컬 절대경로는 `wiki/personal-private/project-paths.md`에 있다. **PR2 위에 쌓는다.**

## Global Constraints

- **커밋은 하되 push·PR은 사용자 확인 후에만.**
- **코드 주석·KDoc 규약**(`parfait/CLAUDE.md`):
  - 코드가 이미 말하는 것은 쓰지 않는다.
  - `@return`·`@param`은 타입·이름이 말하지 못할 때만 쓴다.
  - 다른 컴포넌트의 현재 상태를 단정하지 않는다(낡는다). 써야 하면 근거 문서를 가리킨다.
  - 아키텍처 결정은 코드가 아니라 `parfait/adr/`·`parfait/architecture/`에 쓰고 코드에는 포인터 한 줄만 둔다.
- **주석·KDoc·문서는 한국어로 쓴다.**
- **매직 넘버 대신 이름 있는 상수.** 폴링 주기는 `CANVAS_POLL_INTERVAL`, 구독 정지 유예는 `SUBSCRIPTION_STOP_TIMEOUT`.
- **테스트는 `runTest(mainDispatcherRule.dispatcher)`로 스케줄러를 하나로 묶는다.** 폴링 테스트는 실제 시간을 기다리지 않고 `advanceTimeBy`로 민다.
- **폴러는 주입받은 `CoroutineScope`에서 돈다.** `Dispatchers.IO`를 하드코딩하면 가상 시간이 안 먹는다.
- **hot flow 수집은 `backgroundScope`나 Turbine의 `flow.test { }`로 한다.**
- **`:data`가 `:domain`을 보는 방향은 유지한다.** 폴러는 `ParfaitRepository`를 주입받지 않는다 — 저장소가 폴러를 주입받으므로 순환이 된다.

---

## File Structure

**신설**

| 파일 | 책임 |
|------|------|
| `data/src/main/java/com/teamyg/parfait/data/source/parfait/local/CanvasPoller.kt` | 그룹별 참조 계수 + 주기 갱신 루프 + 강제 갱신 |
| `data/src/main/java/com/teamyg/parfait/data/di/ApplicationScopeModule.kt` | `@ApplicationScope CoroutineScope` 제공 |
| `domain/src/main/java/com/teamyg/parfait/domain/usecase/parfait/ObserveParfaitDayBoundaryUseCase.kt` | 파르페 하루 경계 티커 |
| `data/src/test/java/com/teamyg/parfait/data/source/parfait/local/CanvasPollerTest.kt` | 폴러 테스트 |
| `domain/src/test/java/com/teamyg/parfait/domain/usecase/parfait/ObserveParfaitDayBoundaryUseCaseTest.kt` | 티커 테스트 |
| `core/ui/src/test/java/com/teamyg/parfait/core/ui/BaseViewModelSubscriptionTest.kt` | 구독 수명 헬퍼 테스트 |

**변경**

| 파일 | 변경 |
|------|------|
| `core/ui/.../BaseViewModel.kt` | `launchWhileSubscribed` 헬퍼 |
| `data/.../repository/parfait/ParfaitRepositoryImpl.kt` | 구독에 폴러 계수 연동, 갱신을 폴러로 위임 |
| `data/.../network/TokenAuthenticator.kt` | 정리 시 폴러 중단 |
| `domain/.../usecase/auth/LogoutUseCase.kt` | 정리 시 폴러 중단(저장소 표면 경유) |
| `domain/.../repository/parfait/ParfaitRepository.kt` | `clearTodayCanvas` 계약에 폴링 중단 명시 |
| `feature/.../viewmodel/CanvasMainViewModel.kt` | 구독 헬퍼 전환, 경계 티커, 스포트라이트 해제, `Enter` 갱신 제거, 지난 날 구독 중단 |
| `feature/.../viewmodel/CanvasBGEditViewModel.kt` | 구독 헬퍼 전환, dirty·툼스톤 병합, `confirmedToppings` 제거, 쓰기 뒤 강제 갱신 |
| `feature/.../viewmodel/CanvasToppingPlaceViewModel.kt` | 구독 헬퍼 전환, `positionZ` 재계산, 쓰기 뒤 강제 갱신 |
| `parfait/architecture/state-management.md` | 구독 수명 헬퍼 규약 한 절 |

---

### Task 1: `BaseViewModel`에 구독 수명 헬퍼를 세운다

이 저장소에는 `stateIn`·`SharingStarted`·`WhileSubscribed`가 한 건도 없고, `architecture/state-management.md`가 "구독은 ViewModel 수명에 걸린다"를 규약으로 두고 있다. 그대로 두면 카메라 흐름은 물론 앱이 백그라운드에 있어도 폴링이 계속 돈다.

**Files:**
- Modify: `core/ui/src/main/java/com/teamyg/parfait/core/ui/BaseViewModel.kt`
- Test: `core/ui/src/test/java/com/teamyg/parfait/core/ui/BaseViewModelSubscriptionTest.kt`

**Interfaces:**
- Consumes: `BaseViewModel._state`(내부)
- Produces: `protected fun <T> launchWhileSubscribed(stopTimeout: Duration = SUBSCRIPTION_STOP_TIMEOUT, flow: () -> Flow<T>, collector: suspend (T) -> Unit): Job`

> `core/ui` 모듈에 `test` 소스셋과 `parfait.test.unit` 플러그인이 이미 있는지 확인한다. **없으면 이 태스크를 멈추고 사용자에게 묻는다** — 테스트 하니스 신설은 승인 사항이다. 그동안 헬퍼 검증은 `CanvasMainViewModelTest`에서 간접적으로 한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```kotlin
package com.teamyg.parfait.core.ui

import com.teamyg.parfait.core.testing.MainDispatcherRule
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Rule
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Duration.Companion.seconds

private data class ProbeState(val value: Int = 0) : UiState
private object ProbeIntent : UiIntent
private object ProbeEffect : UiSideEffect

private class ProbeViewModel(
    private val upstream: MutableStateFlow<Int>,
) : BaseViewModel<ProbeState, ProbeIntent, ProbeEffect>(ProbeState()) {
    var openCount = 0
        private set

    init {
        launchWhileSubscribed(
            flow = {
                openCount++
                upstream
            },
            collector = { value -> updateState { copy(value = value) } },
        )
    }

    override fun processIntent(intent: ProbeIntent) = Unit
}

class BaseViewModelSubscriptionTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `구독자가 없으면 업스트림을 열지 않는다`() = runTest(mainDispatcherRule.dispatcher) {
        val viewModel = ProbeViewModel(MutableStateFlow(1))
        advanceUntilIdle()

        assertEquals(0, viewModel.openCount)
    }

    @Test
    fun `구독자가 붙으면 업스트림을 연다`() = runTest(mainDispatcherRule.dispatcher) {
        val upstream = MutableStateFlow(1)
        val viewModel = ProbeViewModel(upstream)

        val job = backgroundScope.launch { viewModel.state.collect { } }
        advanceUntilIdle()

        assertEquals(1, viewModel.openCount)
        assertEquals(1, viewModel.state.value.value)
        job.cancel()
    }

    @Test
    fun `구독이 끊기고 유예가 지나면 업스트림을 닫는다`() = runTest(mainDispatcherRule.dispatcher) {
        val upstream = MutableStateFlow(1)
        val viewModel = ProbeViewModel(upstream)

        val job = backgroundScope.launch { viewModel.state.collect { } }
        advanceUntilIdle()
        job.cancel()
        advanceTimeBy(10.seconds)
        advanceUntilIdle()

        upstream.value = 2
        advanceUntilIdle()

        assertEquals(1, viewModel.state.value.value)
    }

    @Test
    fun `유예 안에 다시 구독하면 업스트림을 다시 열지 않는다`() = runTest(mainDispatcherRule.dispatcher) {
        val upstream = MutableStateFlow(1)
        val viewModel = ProbeViewModel(upstream)

        val first = backgroundScope.launch { viewModel.state.collect { } }
        advanceUntilIdle()
        first.cancel()
        advanceTimeBy(1.seconds)

        val second = backgroundScope.launch { viewModel.state.collect { } }
        advanceUntilIdle()

        assertEquals(1, viewModel.openCount)
        second.cancel()
    }
}
```

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :core:ui:test --tests "*BaseViewModelSubscriptionTest*"`
Expected: 컴파일 실패 — `launchWhileSubscribed` 없음

- [ ] **Step 3: 헬퍼를 구현한다**

`BaseViewModel` 안, `launch` 아래에 넣는다.

```kotlin
    /**
     * 화면이 **실제로 보고 있는 동안에만** [flow] 를 연다. 라우트가
     * `collectAsStateWithLifecycle()` 로 [state] 를 구독하므로, 화면이 백그라운드로 가거나
     * 컴포지션에서 빠지면 여기서 연 업스트림도 함께 끊긴다.
     *
     * [launch] 와 갈라 두는 이유는 수명이 다르기 때문이다 — [launch] 는 ViewModel 수명이라
     * 백스택 아래에 깔린 화면에서도 계속 돈다(`architecture/state-management.md`).
     *
     * @param stopTimeout 마지막 구독자가 떠난 뒤 업스트림을 닫기까지의 유예. 화면 전환·구성
     *   변경의 짧은 공백에서 업스트림이 껐다 켜지지 않게 한다.
     */
    @OptIn(ExperimentalCoroutinesApi::class)
    protected fun <T> launchWhileSubscribed(
        stopTimeout: Duration = SUBSCRIPTION_STOP_TIMEOUT,
        flow: () -> Flow<T>,
        collector: suspend (T) -> Unit,
    ): Job = viewModelScope.launch {
        _state.subscriptionCount
            .map { it > 0 }
            .distinctUntilChanged()
            .flatMapLatest { subscribed ->
                // 구독이 끊겨도 유예 동안은 열어 둔다. 그 사이 다시 붙으면 아래 flatMapLatest 가
                // 이 대기를 취소하므로 업스트림이 이어진다
                if (subscribed) flowOf(true) else flow { delay(stopTimeout); emit(false) }
            }.distinctUntilChanged()
            .flatMapLatest { active -> if (active) flow() else emptyFlow() }
            .collect(collector)
    }

    protected companion object {
        val SUBSCRIPTION_STOP_TIMEOUT: Duration = 5.seconds
    }
```

`flow { … }` 빌더와 파라미터 이름 `flow`가 겹치므로, 빌더 쪽을 `kotlinx.coroutines.flow.flow`로 정규화해 부르거나 파라미터 이름을 `source`로 바꾼다. 겹치지 않는 이름을 쓰는 편이 읽기 쉽다 — **파라미터 이름을 `source`로 둔다.**

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew :core:ui:test --tests "*BaseViewModelSubscriptionTest*"`
Expected: PASS (4건)

- [ ] **Step 5: 규약 문서에 한 절을 더한다**

`parfait/architecture/state-management.md`의 "구독은 `viewModelScope.launch`가 아니라 `BaseViewModel.launch`로 연다" 절 바로 뒤에 붙인다.

```markdown
### 화면이 보는 동안만 살아야 하는 구독은 `launchWhileSubscribed`

`BaseViewModel.launch`로 연 구독은 **ViewModel 수명**에 걸린다 — 백스택 아래에 깔린 화면에서도
계속 돈다. 그것이 맞는 경우가 대부분이지만, 업스트림이 주기적으로 서버를 부르는 종류라면
보이지 않는 화면 때문에 요청이 계속 나간다.

그런 구독은 `launchWhileSubscribed`로 연다. 노출한 `state`의 구독자 수가 0보다 큰 동안에만
업스트림이 살아 있고, 라우트가 `collectAsStateWithLifecycle()`을 쓰므로 화면이 백그라운드로
가거나 컴포지션에서 빠지면 함께 끊긴다. 마지막 구독자가 떠난 뒤 유예를 두어 화면 전환의 짧은
공백에서 업스트림이 껐다 켜지지 않게 한다.

**둘 중 하나를 임의로 고르지 않는다.** 기준은 "이 구독이 서버를 계속 부르는가"다.
자세한 근거는 [ADR-0029](../adr/0029-canvas-today-ssot-polling.md).
```

- [ ] **Step 6: 커밋**

```bash
git add core/ui/src/main/java/com/teamyg/parfait/core/ui/BaseViewModel.kt core/ui/src/test/
git commit -m "feat: 화면이 보는 동안만 사는 구독 헬퍼를 세운다"
```

문서는 다른 저장소이므로 따로 커밋한다.

---

### Task 2: `@ApplicationScope`를 제공한다

**Files:**
- Create: `data/src/main/java/com/teamyg/parfait/data/di/ApplicationScopeModule.kt`

**Interfaces:**
- Produces: `@ApplicationScope` 한정자와 `@Singleton CoroutineScope`

- [ ] **Step 1: 한정자와 제공 모듈을 쓴다**

```kotlin
package com.teamyg.parfait.data.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import javax.inject.Qualifier
import javax.inject.Singleton

/** 프로세스와 수명을 같이 하는 스코프. 화면·ViewModel 보다 오래 살아야 하는 작업에만 쓴다 */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class ApplicationScope

@Module
@InstallIn(SingletonComponent::class)
object ApplicationScopeModule {
    /**
     * [SupervisorJob] 인 이유: 여기서 도는 작업 하나가 실패해도 나머지를 함께 끄면 안 된다.
     */
    @Provides
    @Singleton
    @ApplicationScope
    fun provideApplicationScope(): CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
}
```

이미 같은 역할의 한정자가 있으면 새로 만들지 말고 그것을 쓴다.

- [ ] **Step 2: 컴파일 확인**

Run: `./gradlew :data:compileDebugKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: 커밋**

```bash
git add data/src/main/java/com/teamyg/parfait/data/di/ApplicationScopeModule.kt
git commit -m "chore: 프로세스 수명 코루틴 스코프를 제공한다"
```

---

### Task 3: `CanvasPoller`를 만든다

폴러는 `ParfaitRepository`를 주입받지 않는다 — 저장소가 폴러를 주입받으므로 순환이 된다. 원격·로컬 데이터소스를 직접 쓴다.

**Files:**
- Create: `data/src/main/java/com/teamyg/parfait/data/source/parfait/local/CanvasPoller.kt`
- Test: `data/src/test/java/com/teamyg/parfait/data/source/parfait/local/CanvasPollerTest.kt`

**Interfaces:**
- Consumes: Task 2의 `@ApplicationScope`, `ParfaitRemoteDataSource`, `CanvasLocalDataSource`
- Produces:
  - `suspend fun acquire(groupId: GroupId)`
  - `suspend fun release(groupId: GroupId)`
  - `suspend fun refreshNow(groupId: GroupId, forceToday: Boolean = false): Result<Unit>`
  - `fun stopAll()`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```kotlin
package com.teamyg.parfait.data.source.parfait.local

import com.teamyg.parfait.domain.model.canvas.CanvasStatus
import com.teamyg.parfait.domain.model.canvas.CanvasVO
import com.teamyg.parfait.domain.model.id.GroupId
import com.teamyg.parfait.domain.model.id.ParfaitId
import com.teamyg.parfait.domain.model.parfaitToday
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.time.Duration.Companion.seconds

private val GROUP = GroupId(1L)

class CanvasPollerTest {
    private class FakeRemote : ParfaitRemoteDataSource {
        var todayCallCount = 0
            private set
        var detailCallCount = 0
            private set

        override suspend fun getTodayCanvas(groupId: GroupId): Result<CanvasVO> {
            todayCallCount++
            return Result.success(canvas())
        }

        override suspend fun getCanvasDetail(groupId: GroupId, parfaitId: ParfaitId): Result<CanvasVO> {
            detailCallCount++
            return Result.success(canvas())
        }

        // 나머지 함수는 error("폴러가 부르지 않는다")
    }

    @Test
    fun `구독이 붙으면 즉시 한 번 부른다`() = runTest {
        val remote = FakeRemote()
        val local = CanvasLocalDataSourceImpl()
        val poller = CanvasPoller(scope = backgroundScope, remote = remote, local = local)

        poller.acquire(GROUP)
        advanceUntilIdle()

        assertEquals(1, remote.todayCallCount)
    }

    @Test
    fun `캐시가 차면 그 뒤 주기 갱신은 상세 조회를 쓴다`() = runTest {
        val remote = FakeRemote()
        val poller = CanvasPoller(scope = backgroundScope, remote = remote, local = CanvasLocalDataSourceImpl())

        poller.acquire(GROUP)
        advanceUntilIdle()
        advanceTimeBy(5.seconds)
        advanceUntilIdle()

        assertEquals(1, remote.todayCallCount)
        assertEquals(1, remote.detailCallCount)
    }

    @Test
    fun `구독자가 둘이어도 주기당 한 번만 부른다`() = runTest {
        val remote = FakeRemote()
        val poller = CanvasPoller(scope = backgroundScope, remote = remote, local = CanvasLocalDataSourceImpl())

        poller.acquire(GROUP)
        poller.acquire(GROUP)
        advanceUntilIdle()
        advanceTimeBy(5.seconds)
        advanceUntilIdle()

        assertEquals(2, remote.todayCallCount + remote.detailCallCount)
    }

    @Test
    fun `마지막 구독자가 떠나면 더 부르지 않는다`() = runTest {
        val remote = FakeRemote()
        val poller = CanvasPoller(scope = backgroundScope, remote = remote, local = CanvasLocalDataSourceImpl())

        poller.acquire(GROUP)
        advanceUntilIdle()
        poller.release(GROUP)
        advanceTimeBy(30.seconds)
        advanceUntilIdle()

        assertEquals(1, remote.todayCallCount + remote.detailCallCount)
    }

    @Test
    fun `강제 갱신이 들어오면 주기를 다시 센다`() = runTest {
        val remote = FakeRemote()
        val poller = CanvasPoller(scope = backgroundScope, remote = remote, local = CanvasLocalDataSourceImpl())

        poller.acquire(GROUP)
        advanceUntilIdle()

        // 주기가 끝나기 직전에 강제 갱신을 넣는다
        advanceTimeBy(4.seconds)
        poller.refreshNow(GROUP)
        advanceUntilIdle()
        val afterForced = remote.todayCallCount + remote.detailCallCount

        // 원래 주기였다면 1초 뒤에 한 번 더 나갔어야 한다
        advanceTimeBy(2.seconds)
        advanceUntilIdle()

        assertEquals(afterForced, remote.todayCallCount + remote.detailCallCount)
    }

    @Test
    fun `정리하면 진행 중인 루프가 멎는다`() = runTest {
        val remote = FakeRemote()
        val poller = CanvasPoller(scope = backgroundScope, remote = remote, local = CanvasLocalDataSourceImpl())

        poller.acquire(GROUP)
        advanceUntilIdle()
        poller.stopAll()
        advanceTimeBy(30.seconds)
        advanceUntilIdle()

        assertEquals(1, remote.todayCallCount + remote.detailCallCount)
    }
}
```

`canvas()`는 `parfaitToday()` 날짜의 `CanvasVO`를 만드는 파일 내 헬퍼다. `FakeRemote`는 `ParfaitRemoteDataSource`의 나머지 함수를 `error("폴러가 부르지 않는다")`로 채운다.

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :data:test --tests "*CanvasPollerTest*"`
Expected: 컴파일 실패 — `CanvasPoller` 없음

- [ ] **Step 3: 폴러를 구현한다**

```kotlin
package com.teamyg.parfait.data.source.parfait.local

import com.teamyg.parfait.data.di.ApplicationScope
import com.teamyg.parfait.data.source.parfait.remote.ParfaitRemoteDataSource
import com.teamyg.parfait.domain.model.id.GroupId
import com.teamyg.parfait.domain.model.parfaitToday
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/** 주기는 실측 전 값이다(OQ-P-320) */
private val CANVAS_POLL_INTERVAL: Duration = 5.seconds

/**
 * 오늘 캔버스를 주기적으로 다시 받아 [CanvasLocalDataSource] 에 싣는다
 * (`adr/0029-canvas-today-ssot-polling.md`).
 *
 * 값이 아니라 **트리거**를 소유한다 — 나중에 푸시로 갈아 끼울 때 바뀌는 자리를 하나로 두기
 * 위해서다. 저장소(`ParfaitRepositoryImpl`)가 이쪽을 주입받으므로 반대로 저장소를 주입받지
 * 않는다.
 */
@Singleton
class CanvasPoller @Inject constructor(
    @ApplicationScope private val scope: CoroutineScope,
    private val remote: ParfaitRemoteDataSource,
    private val local: CanvasLocalDataSource,
) {
    private val mutex = Mutex()
    private val subscriberCounts = mutableMapOf<GroupId, Int>()
    private val pollJobs = mutableMapOf<GroupId, Job>()

    /** 계수가 0 → 1 이 되면 즉시 한 번 부르고 주기 루프에 든다 */
    suspend fun acquire(groupId: GroupId) {
        mutex.withLock {
            val next = (subscriberCounts[groupId] ?: 0) + 1
            subscriberCounts[groupId] = next
            if (next == 1) startPolling(groupId)
        }
    }

    suspend fun release(groupId: GroupId) {
        mutex.withLock {
            val next = (subscriberCounts[groupId] ?: 0) - 1
            if (next <= 0) {
                subscriberCounts.remove(groupId)
                pollJobs.remove(groupId)?.cancel()
            } else {
                subscriberCounts[groupId] = next
            }
        }
    }

    /**
     * 쓰기 직후처럼 주기를 기다릴 수 없을 때 부른다. **주기도 이 시점부터 다시 센다** —
     * 그러지 않으면 강제 갱신 직후에 주기 타이머가 또 터져 요청이 붙어 나간다.
     */
    suspend fun refreshNow(
        groupId: GroupId,
        forceToday: Boolean = false,
    ): Result<Unit> {
        val result = refresh(groupId, forceToday)
        mutex.withLock {
            if (subscriberCounts.containsKey(groupId)) startPolling(groupId)
        }
        return result
    }

    /** 세션이 끝날 때 부른다. 지운 캐시를 낡은 응답이 되살리지 못하게 진행 중인 것까지 끊는다 */
    fun stopAll() {
        pollJobs.values.forEach(Job::cancel)
        pollJobs.clear()
        subscriberCounts.clear()
    }

    /** [mutex] 를 잡은 채로만 부른다 */
    private fun startPolling(groupId: GroupId) {
        pollJobs.remove(groupId)?.cancel()
        pollJobs[groupId] = scope.launch {
            refresh(groupId, forceToday = false)
            while (isActive) {
                delay(CANVAS_POLL_INTERVAL)
                refresh(groupId, forceToday = false)
            }
        }
    }

    /**
     * 오늘 조회는 캔버스가 없으면 서버가 만들어 저장한다(`api/parfait.md`) — 그래서 캔버스를
     * 만들 필요가 있을 때만 쓴다. 캐시가 비었거나 실린 날짜가 오늘이 아니면(하루 경계를 넘겼다)
     * 그 경우다. 나머지는 부작용 없는 상세 조회를 쓴다.
     *
     * 실패는 조용히 넘긴다 — 사용자가 시키지 않은 조회이고, 보여 줄 캐시 값이 이미 있다.
     */
    private suspend fun refresh(
        groupId: GroupId,
        forceToday: Boolean,
    ): Result<Unit> {
        val cached = local.todayCanvas(groupId).first()
        val needsToday = forceToday || cached == null || cached.date != parfaitToday()

        val result = if (needsToday) {
            remote.getTodayCanvas(groupId)
        } else {
            remote.getCanvasDetail(groupId = groupId, parfaitId = cached.parfaitId)
        }

        return result
            .onSuccess { canvas -> local.saveTodayCanvas(groupId, canvas) }
            .map { }
    }
}
```

> **스펙과의 관계** — 스펙 「하루 경계」는 폴러가 경계 티커를 보고 오늘 조회로 전환한다고 적었다. 여기서는 **캐시에 실린 날짜가 오늘인지**로 같은 판정을 한다. 경계를 넘기면 캐시의 날짜가 어제가 되므로 다음 주기가 저절로 오늘 조회를 고른다. 결과가 같고 폴러가 티커를 몰라도 되므로 이쪽을 쓴다. 티커는 캔버스 메인의 날짜 갱신용으로만 남는다(Task 5). **구현 후 스펙의 「하루 경계」 절과 파일 표를 이 형태로 고친다.**

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew :data:test --tests "*CanvasPollerTest*"`
Expected: PASS (6건)

주기 루프가 `while (isActive) { delay; refresh }`라 `acquire` 직후 즉시 1회 + 주기마다 1회가 된다. 테스트 두 번째 케이스가 이 순서를 고정한다.

- [ ] **Step 5: 커밋**

```bash
git add data/src/main/java/com/teamyg/parfait/data/source/parfait/local/CanvasPoller.kt data/src/test/java/com/teamyg/parfait/data/source/parfait/local/CanvasPollerTest.kt
git commit -m "feat: 오늘 캔버스 폴러를 만든다"
```

---

### Task 4: 저장소가 구독에 폴러를 매달고 갱신을 폴러로 위임한다

**Files:**
- Modify: `data/src/main/java/com/teamyg/parfait/data/repository/parfait/ParfaitRepositoryImpl.kt`
- Modify: `domain/src/main/java/com/teamyg/parfait/domain/repository/parfait/ParfaitRepository.kt` (KDoc만)

**Interfaces:**
- Consumes: Task 3의 `CanvasPoller`
- Produces: 표면 변화 없음 — PR2에서 정한 넷을 그대로 유지한다

- [ ] **Step 1: 구현을 고친다**

```kotlin
class ParfaitRepositoryImpl @Inject constructor(
    private val parfaitRemoteDataSource: ParfaitRemoteDataSource,
    private val canvasLocalDataSource: CanvasLocalDataSource,
    private val canvasPoller: CanvasPoller,
) : ParfaitRepository {
    /**
     * 구독이 붙어 있는 동안만 폴러가 돈다 — 화면이 보지 않는 캔버스를 계속 부르지 않는다.
     * 화면은 폴러의 존재를 모른다.
     */
    override fun todayCanvas(groupId: GroupId): Flow<CanvasVO?> = canvasLocalDataSource
        .todayCanvas(groupId)
        .onSubscription { canvasPoller.acquire(groupId) }
        .onCompletion { canvasPoller.release(groupId) }

    /** 폴러를 지나므로 이 갱신도 주기를 다시 세운다 */
    override suspend fun refreshTodayCanvas(groupId: GroupId): Result<Unit> = canvasPoller
        .refreshNow(groupId, forceToday = true)
        .mapErrorToAppError()

    override suspend fun refreshTodayCanvasDetail(
        groupId: GroupId,
        parfaitId: ParfaitId,
    ): Result<Unit> = canvasPoller
        .refreshNow(groupId)
        .mapErrorToAppError()

    override fun clearTodayCanvas() {
        canvasPoller.stopAll()
        canvasLocalDataSource.clear()
    }
    // 나머지 함수는 그대로
}
```

`refreshTodayCanvasDetail`의 `parfaitId`는 이제 폴러가 캐시에서 읽으므로 쓰이지 않는다. 파라미터를 지우면 도메인 표면이 바뀌므로, **표면은 유지하고 KDoc에 그 사실을 적는다.**

```kotlin
    /**
     * 상세 조회로 오늘 캔버스 캐시를 갱신한다. [refreshTodayCanvas] 와 달리 부작용이 없다.
     *
     * @param parfaitId 호출부가 어느 캔버스를 갱신하려는지 밝히는 값이다. 실제로 부를 대상은
     *   캐시에 실린 것에서 정해지므로, 이 값과 다르면 캐시 쪽이 이긴다.
     */
```

`onSubscription`·`onCompletion` import를 더한다. `clearTodayCanvas`의 KDoc에 폴링 중단을 명시한다.

```kotlin
    /**
     * 세션 종료 정리. 진행 중인 폴링까지 끊는다 — 지우기만 하면 이미 출발한 갱신의 응답이
     * 뒤늦게 도착해 직전 계정의 캔버스를 되살린다.
     *
     * `:domain` 이 `:data` 를 볼 수 없어 저장소 표면으로 낸다.
     */
    fun clearTodayCanvas()
```

- [ ] **Step 2: 컴파일·테스트 확인**

Run: `./gradlew :data:test :domain:test`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add data/src/main/java/com/teamyg/parfait/data/repository/parfait/ParfaitRepositoryImpl.kt domain/src/main/java/com/teamyg/parfait/domain/repository/parfait/ParfaitRepository.kt
git commit -m "feat: 오늘 캔버스 구독에 폴링 수명을 매단다"
```

---

### Task 5: 하루 경계 티커를 만들고 캔버스 메인이 날짜를 다시 세게 한다

지금 `syncToday()`를 부르는 곳은 `handleEnter()` 하나뿐이라, 화면을 계속 열어 둔 채 경계를 넘기면 `today`·`selectedDate`가 어제로 남는다. 그러면 폴링이 받아 온 오늘 캔버스가 **어제 날짜 헤더 아래** 그려진다.

**Files:**
- Create: `domain/src/main/java/com/teamyg/parfait/domain/usecase/parfait/ObserveParfaitDayBoundaryUseCase.kt`
- Test: `domain/src/test/java/com/teamyg/parfait/domain/usecase/parfait/ObserveParfaitDayBoundaryUseCaseTest.kt`
- Modify: `feature/.../viewmodel/CanvasMainViewModel.kt`

**Interfaces:**
- Consumes: `parfaitToday`, `PARFAIT_TIME_ZONE`, `DayWindow.DAY_BOUNDARY_HOUR`
- Produces: `operator fun ObserveParfaitDayBoundaryUseCase.invoke(clock: Clock = Clock.System): Flow<LocalDate>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```kotlin
    @Test
    fun `구독하면 지금의 파르페 오늘을 먼저 낸다`() = runTest {
        val clock = FixedClock(atKst(year = 2026, month = 8, day = 27, hour = 10))

        ObserveParfaitDayBoundaryUseCase()(clock).test {
            assertEquals(LocalDate(2026, 8, 27), awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `경계를 넘기면 새 날짜를 낸다`() = runTest {
        val clock = MutableClock(atKst(year = 2026, month = 8, day = 28, hour = 2, minute = 59))

        ObserveParfaitDayBoundaryUseCase()(clock).test {
            // 새벽 3시 전이라 아직 27일이다
            assertEquals(LocalDate(2026, 8, 27), awaitItem())

            clock.advanceBy(2.minutes)
            advanceTimeBy(2.minutes)

            assertEquals(LocalDate(2026, 8, 28), awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }
```

`FixedClock`·`MutableClock`은 `kotlin.time.Clock`을 구현하는 테스트 헬퍼다. 저장소에 이미 있으면 그것을 쓰고, 없으면 이 테스트 파일 안에 `private class`로 둔다. `atKst`는 `LocalDateTime(...).toInstant(PARFAIT_TIME_ZONE)` 한 줄이다.

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :domain:test --tests "*ObserveParfaitDayBoundaryUseCaseTest*"`
Expected: 컴파일 실패

- [ ] **Step 3: 티커를 구현한다**

```kotlin
package com.teamyg.parfait.domain.usecase.parfait

import com.teamyg.parfait.domain.model.PARFAIT_TIME_ZONE
import com.teamyg.parfait.domain.model.parfaitToday
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalTime
import kotlinx.datetime.atTime
import kotlinx.datetime.toInstant
import kotlinx.datetime.toLocalDateTime
import javax.inject.Inject
import kotlin.time.Clock

/**
 * 파르페 기준의 오늘을 내고, 하루 경계(새벽 3시)를 넘길 때마다 새 날짜를 다시 낸다.
 *
 * 값 스트림에 필터를 다는 방식으로는 이 판정을 못 한다 — 캔버스 캐시가 조용하면 재방출이 없어
 * 필터가 아예 평가되지 않는다(`specs/2026-08-27-canvas-today-ssot-polling.md` 「하루 경계」).
 */
class ObserveParfaitDayBoundaryUseCase
@Inject
constructor() {
    /**
     * @param clock 경계 판정과 대기 시간 계산에 쓰는 시계. 테스트에서 경계 앞뒤를 고정한다.
     */
    operator fun invoke(clock: Clock = Clock.System): Flow<LocalDate> = flow {
        while (true) {
            val today = parfaitToday(clock)
            emit(today)
            delay(clock.durationUntilNextBoundary())
        }
    }
}

private fun Clock.durationUntilNextBoundary(): kotlin.time.Duration {
    val now = now()
    val nowDateTime = now.toLocalDateTime(PARFAIT_TIME_ZONE)
    val boundaryTime = LocalTime(DayWindow.DAY_BOUNDARY_HOUR, 0)

    val nextBoundaryDate = if (nowDateTime.time < boundaryTime) {
        nowDateTime.date
    } else {
        nowDateTime.date.plus(1, DateTimeUnit.DAY)
    }

    return nextBoundaryDate.atTime(boundaryTime).toInstant(PARFAIT_TIME_ZONE) - now
}
```

`DayWindow`·`DateTimeUnit`·`plus` import를 실제 위치에 맞게 더한다. `DayWindow.DAY_BOUNDARY_HOUR`가 `:domain` 밖에 있으면 그 경로를 쓴다 — **경계 값을 여기 다시 적지 않는다.**

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew :domain:test --tests "*ObserveParfaitDayBoundaryUseCaseTest*"`
Expected: PASS

- [ ] **Step 5: 캔버스 메인이 티커를 보게 한다**

`CanvasMainViewModel` 생성자에 `observeParfaitDayBoundaryUseCase`를 더하고, `init`에 구독을 연다. 이 구독은 화면이 보이지 않을 때 돌 필요가 없으므로 `launchWhileSubscribed`를 쓴다.

```kotlin
    /**
     * 화면을 열어 둔 채 파르페 하루 경계를 넘기면 오늘을 다시 센다. `Enter` 만으로는 부족하다 —
     * 그 사이 폴링이 받아 온 오늘 캔버스가 어제 날짜 헤더 아래 그려진다.
     */
    private fun observeDayBoundary() {
        launchWhileSubscribed(source = { observeParfaitDayBoundaryUseCase() }) { today ->
            updateState {
                if (today == this.today) return@updateState this

                if (isViewingToday) {
                    copy(today = today, selectedDate = today, displayedMonth = today.toFirstDayOfMonth())
                } else {
                    copy(today = today)
                }
            }
        }
    }
```

`syncToday()`는 지우고 `handleEnter()`에서 그 호출도 뺀다 — 티커가 같은 일을 하고 더 넓게 덮는다.

- [ ] **Step 6: 캔버스 메인 테스트를 더한다**

```kotlin
    @Test
    fun `하루 경계를 넘기면 오늘과 선택 날짜가 함께 옮겨간다`() = runTest(mainDispatcherRule.dispatcher) {
        val days = MutableStateFlow(LocalDate(2026, 8, 27))
        every { observeParfaitDayBoundary(any()) } returns days
        // …구독을 붙인 뒤
        days.value = LocalDate(2026, 8, 28)
        advanceUntilIdle()

        assertEquals(LocalDate(2026, 8, 28), viewModel.state.value.today)
        assertEquals(LocalDate(2026, 8, 28), viewModel.state.value.selectedDate)
    }
```

`launchWhileSubscribed`를 쓰므로 테스트가 `viewModel.state`를 실제로 구독해야 업스트림이 열린다. `backgroundScope.launch { viewModel.state.collect { } }`를 먼저 붙인다.

- [ ] **Step 7: 테스트가 통과하는지 확인한다**

Run: `./gradlew :domain:test :feature:groups:canvas:impl:test --tests "*CanvasMainViewModelTest*"`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add domain/ feature/groups/canvas/impl/
git commit -m "feat: 하루 경계를 시간 축으로 판정한다"
```

---

### Task 6: 캔버스 메인의 구독을 헬퍼로 옮기고 스포트라이트를 해제한다

강조 중이던 토핑이 폴링으로 사라지면 파생 `spotlightedTopping`만 null이 되고 상태값 `spotlightedToppingId`는 남는다. 딤이 안 그려져 해제 계기가 사라지고, `handleOnClickTopping`의 첫 줄 가드에 걸려 **토핑 탭이 전부 먹지 않는 화면**이 된다.

**Files:**
- Modify: `feature/.../viewmodel/CanvasMainViewModel.kt`
- Modify: `feature/.../viewmodel/CanvasMainViewModelTest.kt`

**Interfaces:**
- Consumes: Task 1의 `launchWhileSubscribed`
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```kotlin
    @Test
    fun `강조된 토핑이 사라지면 스포트라이트를 푼다`() = runTest(mainDispatcherRule.dispatcher) {
        val canvases = MutableStateFlow<CanvasVO?>(canvasWithToppings(otherTopping(id = 7L)))
        every { getTodayParfaitFlow(GroupId(GROUP_ID), any()) } returns canvases

        val viewModel = createViewModel()
        backgroundScope.launch { viewModel.state.collect { } }
        advanceUntilIdle()

        viewModel.processIntent(CanvasMainIntent.OnClickTopping(otherTopping(id = 7L)))
        advanceUntilIdle()
        assertEquals(ParfaitImageId(7L), viewModel.state.value.spotlightedToppingId)

        canvases.value = canvasWithToppings()
        advanceUntilIdle()

        assertNull(viewModel.state.value.spotlightedToppingId)
    }

    @Test
    fun `강조된 토핑이 남아 있으면 스포트라이트를 유지한다`() = runTest(mainDispatcherRule.dispatcher) {
        // 같은 흐름에서 다른 토핑만 늘어난 경우
    }
```

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :feature:groups:canvas:impl:test --tests "*CanvasMainViewModelTest*"`
Expected: 새 테스트 FAIL

- [ ] **Step 3: 구독을 헬퍼로 옮기고 해제를 넣는다**

```kotlin
    private fun observeTodayCanvas() {
        launchWhileSubscribed(source = { getTodayParfaitFlowUseCase(groupId) }) { canvas ->
            updateState {
                copy(
                    todayCanvas = canvas,
                    memberChips = canvas?.members?.toMemberChips() ?: memberChips,
                    // 강조 중이던 토핑이 사라지면 딤도 사라져 Dim 탭이라는 해제 계기가 없어진다.
                    // 상태값을 그대로 두면 handleOnClickTopping 가드에 걸려 탭이 전부 먹지 않는다
                    spotlightedToppingId = spotlightedToppingId?.takeIf { id ->
                        canvas?.toppings.orEmpty().any { it.parfaitImageId == id }
                    },
                )
            }
        }
    }
```

- [ ] **Step 4: `Enter`의 명시적 갱신을 없앤다**

폴러의 즉시 1회 조회가 그 역할을 한다. 남겨 두면 재진입마다 갱신이 두 번 나간다.

```kotlin
    /**
     * 화면이 앞에 섰다. 오늘 캔버스 갱신은 폴러가 구독 시작에서 이미 하므로 여기서 부르지
     * 않는다(`adr/0029-canvas-today-ssot-polling.md`).
     *
     * 달력 기록은 폴링 대상이 아니라 여기서 받는다 — 다른 멤버가 오늘 토핑을 올리면 오늘 칸의
     * 점이 생기는데, 연 단위 캐시는 그것을 스스로 알 방법이 없다. 바뀔 수 있는 해는 올해뿐이다.
     */
    private fun handleEnter() {
        if (state.value.isViewingToday.not()) return
        loadParfaitHistories(state.value.today.year)
    }
```

`loadTodayCanvas()`는 `handleClickGoToToday`가 아직 부른다면 남기고, 아무도 안 부르면 지운다.

- [ ] **Step 5: 지난 날을 보는 동안 구독을 끊는다**

`launchWhileSubscribed`는 화면 가시성만 본다. 지난 날 조건은 업스트림에서 가른다.

```kotlin
    private fun observeTodayCanvas() {
        launchWhileSubscribed(
            source = {
                state
                    .map { it.isViewingToday }
                    .distinctUntilChanged()
                    .flatMapLatest { viewingToday ->
                        // 마감된 날은 바뀌지 않으므로 오늘 캔버스를 계속 부를 이유가 없다.
                        // 마지막 값은 그대로 둔다 — 비우면 오늘로 돌아올 때 빈 캔버스가 깜빡인다
                        if (viewingToday) getTodayParfaitFlowUseCase(groupId) else emptyFlow()
                    }
            },
        ) { canvas -> /* Step 3 의 본문 */ }
    }
```

`@OptIn(ExperimentalCoroutinesApi::class)`가 필요하면 파일에 붙인다.

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

Run: `./gradlew :feature:groups:canvas:impl:test --tests "*CanvasMainViewModelTest*"`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/viewmodel/CanvasMainViewModel.kt feature/groups/canvas/impl/src/test/
git commit -m "fix: 강조된 토핑이 사라지면 스포트라이트를 푼다"
```

---

### Task 7: 배경 편집의 병합 규칙을 세운다

**Files:**
- Modify: `feature/.../viewmodel/CanvasBGEditViewModel.kt`
- Modify: `feature/.../viewmodel/CanvasBGEditViewModelTest.kt`

**Interfaces:**
- Consumes: Task 1의 `launchWhileSubscribed`
- Produces:
  - `CanvasBGEditUiState.dirtyToppingIds: Set<Long>`
  - `CanvasBGEditUiState.deletedToppingIds: Set<Long>`
  - `CanvasBGEditUiState.confirmedToppings` 제거

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```kotlin
    @Test
    fun `손댄 토핑은 구독 방출에 덮이지 않는다`() = runTest(mainDispatcherRule.dispatcher) {
        val canvases = MutableStateFlow<CanvasVO?>(canvasWith(myTopping(id = 1L, positionX = 0.1)))
        every { getTodayParfaitFlow(GroupId(GROUP_ID), any()) } returns canvases

        val viewModel = createViewModel()
        backgroundScope.launch { viewModel.state.collect { } }
        advanceUntilIdle()

        viewModel.processIntent(CanvasBGEditIntent.OnClickTopping(viewModel.state.value.toppings.first()))
        viewModel.processIntent(CanvasBGEditIntent.OnToppingMoveDrag(deltaX = 0.2f, deltaY = 0f))
        advanceUntilIdle()
        val moved = viewModel.state.value.toppings.first().positionX

        canvases.value = canvasWith(myTopping(id = 1L, positionX = 0.9))
        advanceUntilIdle()

        assertEquals(moved, viewModel.state.value.toppings.first().positionX)
    }

    @Test
    fun `손대지 않은 토핑은 서버 값으로 갈아 끼운다`() = runTest(mainDispatcherRule.dispatcher) {
        val canvases = MutableStateFlow<CanvasVO?>(canvasWith(myTopping(id = 1L, positionX = 0.1)))
        every { getTodayParfaitFlow(GroupId(GROUP_ID), any()) } returns canvases

        val viewModel = createViewModel()
        backgroundScope.launch { viewModel.state.collect { } }
        advanceUntilIdle()

        canvases.value = canvasWith(myTopping(id = 1L, positionX = 0.9))
        advanceUntilIdle()

        assertEquals(0.9f, viewModel.state.value.toppings.first().positionX)
    }

    @Test
    fun `남이 올린 새 토핑이 편집 중에 나타난다`() = runTest(mainDispatcherRule.dispatcher) {
        // 구독 방출에 새 토핑이 늘면 목록에도 는다
    }

    @Test
    fun `지운 토핑은 늦게 온 응답에 되살아나지 않는다`() = runTest(mainDispatcherRule.dispatcher) {
        val canvases = MutableStateFlow<CanvasVO?>(canvasWith(myTopping(id = 1L)))
        every { getTodayParfaitFlow(GroupId(GROUP_ID), any()) } returns canvases
        coEvery { deleteTopping(any(), any(), any()) } returns Result.success(Unit)

        val viewModel = createViewModel()
        backgroundScope.launch { viewModel.state.collect { } }
        advanceUntilIdle()

        viewModel.processIntent(CanvasBGEditIntent.OnClickTopping(viewModel.state.value.toppings.first()))
        viewModel.processIntent(CanvasBGEditIntent.OnClickDeleteToppingButton)
        viewModel.processIntent(CanvasBGEditIntent.OnDeleteToppingDialogConfirm)
        advanceUntilIdle()
        assertTrue(viewModel.state.value.toppings.isEmpty())

        // 삭제 직전에 출발한 응답이 뒤늦게 도착한다
        canvases.value = canvasWith(myTopping(id = 1L), stamp = 2)
        advanceUntilIdle()

        assertTrue(viewModel.state.value.toppings.isEmpty())
    }

    @Test
    fun `서버 목록에서 사라진 토핑은 툼스톤에서도 빠진다`() = runTest(mainDispatcherRule.dispatcher) {
        // 위 흐름에 이어, 서버가 그 토핑을 뺀 응답을 주면 deletedToppingIds 가 빈다
    }

    @Test
    fun `확인은 손댄 토핑만 PATCH 한다`() = runTest(mainDispatcherRule.dispatcher) {
        // 토핑 둘 중 하나만 드래그한 뒤 확인 → updateTopping 이 그 하나로만 불린다
    }
```

`canvasWith(..., stamp)`는 같은 토핑 목록이라도 `CanvasVO`가 달라 보이게 하는 헬퍼다(`distinctUntilChanged`가 방출을 삼키지 않게 한다). 기존 테스트에 그런 헬퍼가 없으면 `lastClosedDate` 같은 무해한 필드를 달리해 만든다.

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :feature:groups:canvas:impl:test --tests "*CanvasBGEditViewModelTest*"`
Expected: 컴파일 실패

- [ ] **Step 3: UiState에 두 집합을 넣고 `confirmedToppings`를 뺀다**

```kotlin
    /**
     * 아직 서버에 반영되지 않은 로컬 변경. 이동·크기조절·회전·테두리 편집이 여기 든다.
     *
     * **삭제는 넣지 않는다** — 삭제는 모달 확인이 곧 DELETE 라 이미 서버에 반영돼 있고,
     * 확인 버튼은 삭제를 다루지 않는다.
     *
     * 같은 화면의 [selectedToppingId] 가 `Long` 이라 그것에 맞춘다.
     */
    val dirtyToppingIds: Set<Long> = emptySet(),
    /**
     * 지운 토핑의 툼스톤. 삭제 직전에 출발한 갱신 응답이 뒤늦게 도착하면 그 토핑이 아직 서버
     * 목록에 있어서, 이게 없으면 방금 지운 토핑이 되살아난다.
     */
    val deletedToppingIds: Set<Long> = emptySet(),
```

`confirmedToppings` 필드와 그것을 갱신하던 자리를 지운다.

- [ ] **Step 4: 병합 함수를 쓴다**

```kotlin
    /**
     * 구독 방출을 받을 때마다 돈다. 최초 방출도 예외가 아니다 — 그때는 두 집합이 비어 있어
     * 결과가 통째 대입과 같아진다. 화면은 그 방출이 폴링에서 왔는지 강제 갱신에서 왔는지
     * 구분하지 않는다.
     */
    private fun CanvasBGEditUiState.mergeToppings(incoming: List<CanvasToppingItem>): CanvasBGEditUiState {
        val incomingIds = incoming.mapTo(mutableSetOf()) { it.parfaitImageId }
        val localById = toppings.associateBy { it.parfaitImageId }

        val merged = incoming
            .filterNot { it.parfaitImageId in deletedToppingIds }
            .map { server ->
                if (server.parfaitImageId in dirtyToppingIds) {
                    localById[server.parfaitImageId] ?: server
                } else {
                    server
                }
            }

        return copy(
            toppings = merged,
            // 서버 목록에서 사라진 것은 두 집합에서도 뺀다 — 없는 토핑에 PATCH 를 보낼 수 없고,
            // 툼스톤도 제 역할을 다했다
            dirtyToppingIds = dirtyToppingIds intersect incomingIds,
            deletedToppingIds = deletedToppingIds intersect incomingIds,
            // 선택된 토핑이 사라졌으면 선택도 푼다
            selectedToppingId = selectedToppingId?.takeIf { it in incomingIds && it !in deletedToppingIds },
        )
    }
```

- [ ] **Step 5: 구독을 헬퍼로 옮기고 병합을 건다**

```kotlin
    private fun observeCanvas() {
        launchWhileSubscribed(source = { getTodayParfaitFlowUseCase(groupId) }) { canvas ->
            if (canvas == null) return@launchWhileSubscribed

            if (hasSeededFromCanvas.not() && canvas.parfaitId != parfaitId) {
                viewModelLogger.e {
                    "편집을 연 캔버스와 조회 결과가 다르다 — 조회 쪽으로 옮긴다" +
                        " (열린 것: ${parfaitId.value}, 받은 것: ${canvas.parfaitId.value})"
                }
                parfaitId = canvas.parfaitId
            }

            val incoming = canvas.toppings
                .sortedBy { topping -> topping.transform.positionZ }
                .map { topping -> topping.toToppingItem() }

            updateState { withCanvas(canvas).mergeToppings(incoming) }
            hasSeededFromCanvas = true
        }
    }
```

`withCanvas`는 PR2에서 배경 시딩만 남겼으므로 토핑 대입을 빼고 배경만 다룬다.

- [ ] **Step 6: 각 조작이 집합을 채우게 한다**

이동·크기조절·회전·테두리 편집 결과 처리에서 대상 id를 `dirtyToppingIds`에 넣는다.

```kotlin
    private fun CanvasBGEditUiState.markDirty(toppingId: Long): CanvasBGEditUiState =
        copy(dirtyToppingIds = dirtyToppingIds + toppingId)
```

삭제 성공 처리에서 `deletedToppingIds`에 넣고 `dirtyToppingIds`에서 뺀다.

```kotlin
                .onSuccess {
                    updateState {
                        copy(
                            toppings = toppings.filterNot { it.parfaitImageId == toppingId },
                            deletedToppingIds = deletedToppingIds + toppingId,
                            dirtyToppingIds = dirtyToppingIds - toppingId,
                            selectedToppingId = null,
                            showDeleteToppingDialog = false,
                        )
                    }
                    refreshCanvas()
                }
```

- [ ] **Step 7: 확인의 PATCH 대상을 집합으로 바꾼다**

`updateToppingIfChanged`가 `confirmedToppings`와 대조하던 자리를 바꾼다.

```kotlin
    /**
     * PATCH 대상은 지금 목록에 있으면서 손댄 토핑뿐이다. 스냅샷 대조를 쓰면 폴링이 들여온
     * 남의 새 토핑이 "스냅샷에 없음 = 바뀜"으로 잡혀 남의 토핑에 PATCH 를 쏜다.
     */
    private suspend fun updateDirtyToppings() {
        val current = state.value
        current.toppings
            .filter { it.parfaitImageId in current.dirtyToppingIds }
            .map { topping ->
                async {
                    updateToppingUseCase(
                        groupId = groupId,
                        parfaitId = parfaitId,
                        parfaitImageId = ParfaitImageId(topping.parfaitImageId),
                        positionX = topping.positionX.toDouble(),
                        positionY = topping.positionY.toDouble(),
                        scale = topping.scale.toDouble(),
                        rotation = topping.rotationDegrees.toDouble(),
                    )
                }
            }.awaitAll()
    }
```

실제 `UpdateToppingUseCase`의 파라미터 이름·타입에 맞춘다. 성공한 id는 `dirtyToppingIds`에서 뺀다. 실패는 기존 as-built대로 화면에 닿지 않고 확인은 그대로 성공한다(OQ-P-276 소관).

- [ ] **Step 8: 확인·삭제 성공 뒤 강제 갱신을 넣는다**

```kotlin
    /** 되감기 전에 한 번 더 받아 둔다. 폴러를 지나므로 주기도 여기서 다시 세어진다 */
    private fun refreshCanvas() {
        launch(key = REFRESH_CANVAS_KEY) {
            refreshTodayParfaitDetailUseCase(groupId = groupId, parfaitId = parfaitId)
        }
    }
```

`ParfaitRepository.refreshTodayCanvasDetail`을 감싸는 UseCase가 없으면 `RefreshTodayParfaitDetailUseCase`를 `:domain`에 하나 만든다(3줄).

- [ ] **Step 9: 테스트가 통과하는지 확인한다**

Run: `./gradlew :feature:groups:canvas:impl:test --tests "*CanvasBGEditViewModelTest*"`
Expected: PASS

- [ ] **Step 10: 커밋**

```bash
git add feature/groups/canvas/impl/ domain/
git commit -m "feat: 배경 편집이 편집 중인 배치를 갱신에서 지킨다"
```

---

### Task 8: 토핑 배치의 `positionZ`를 확정 시점에 다시 센다

**Files:**
- Modify: `feature/.../viewmodel/CanvasToppingPlaceViewModel.kt`
- Modify: `feature/.../viewmodel/CanvasToppingPlaceViewModelTest.kt`

**Interfaces:**
- Consumes: Task 1의 `launchWhileSubscribed`, 구독 값의 `parfaitId`·`toppings`
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```kotlin
    @Test
    fun `같은 캔버스면 구독 값에서 깊이를 다시 센다`() = runTest(mainDispatcherRule.dispatcher) {
        // 초안 nextPositionZ = 3, 구독 캔버스에 z = 1..5 인 토핑 → 6 으로 올린다
        coVerify { addTopping(any(), any(), any(), match { it.positionZ == 6 }) }
    }

    @Test
    fun `구독 캔버스가 초안과 다른 캔버스면 초안 값으로 물러선다`() = runTest(mainDispatcherRule.dispatcher) {
        // 구독 값의 parfaitId 가 초안과 다르면 nextPositionZ = 3 을 그대로 쓴다
        coVerify { addTopping(any(), any(), any(), match { it.positionZ == 3 }) }
    }

    @Test
    fun `캔버스를 못 받았으면 초안 값으로 물러선다`() = runTest(mainDispatcherRule.dispatcher) {
        // 구독 값이 null 이면 nextPositionZ = 3
    }
```

`match { }`의 대상은 실제 `AddToppingUseCase` 시그니처에 맞춘다 — `ToppingTransform`을 받으면 그 안의 `positionZ`를 본다.

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :feature:groups:canvas:impl:test --tests "*CanvasToppingPlaceViewModelTest*"`
Expected: FAIL

- [ ] **Step 3: 구독 값을 상태에 들이고 재계산을 넣는다**

`CanvasToppingPlaceUiState`에 구독 캔버스의 `parfaitId`를 담을 자리를 만든다. 이미 `existingToppings`가 있으므로 그 옆에 둔다.

```kotlin
    /** 구독 중인 오늘 캔버스의 id. 초안이 못 박은 [parfaitId] 와 다를 수 있다(하루 경계) */
    val observedParfaitId: ParfaitId? = null,
```

`withCanvas`에서 함께 채운다. 확인 처리에서 깊이를 정한다.

```kotlin
    /**
     * 흐름 진입 때 초안에 못 박은 값은 카메라·누끼를 거치는 사이 남이 토핑을 올리면 낡는다.
     * 그래서 확정 시점에 다시 센다.
     *
     * **초안과 같은 캔버스일 때만이다** — 구독 값은 "오늘"로 걸러진 캔버스라 하루 경계를 넘기면
     * 초안이 가리키는 캔버스와 다를 수 있고, 그때 재계산한 값을 초안의 캔버스에 실으면 사용자가
     * 들어간 캔버스가 아닌 곳의 깊이를 쓰게 된다(`adr/0026-topping-draft-datastore-ssot.md`).
     *
     * 겹침의 해결이 아니라 완화다 — 폴링 주기 안에 두 사람이 확인을 누르면 여전히 겹친다
     * (OQ-P-322).
     */
    private fun CanvasToppingPlaceUiState.resolvedPositionZ(): Int? {
        val draftZ = nextPositionZ
        if (observedParfaitId == null || observedParfaitId != parfaitId) return draftZ

        return (existingToppings.maxOfOrNull { it.transform.positionZ } ?: 0) + 1
    }
```

`handleOnClickConfirm`에서 `current.nextPositionZ` 대신 `current.resolvedPositionZ()`를 쓴다.

- [ ] **Step 4: 구독을 헬퍼로 옮기고 추가 성공 뒤 강제 갱신을 넣는다**

`observeCanvasOnce`의 `launch`를 `launchWhileSubscribed`로 바꾼다. 토핑 추가 성공 처리에서 되감기 전에 `refreshTodayCanvasDetail`을 한 번 부른다 — 되감긴 캔버스 메인이 폴러의 즉시 조회를 기다리지 않아도 되게 한다.

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `./gradlew :feature:groups:canvas:impl:test`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add feature/groups/canvas/impl/
git commit -m "fix: 토핑 깊이를 확정 시점에 다시 센다"
```

---

### Task 9: 전체 빌드·테스트와 문서 반영

**Files:**
- Modify: `parfait/specs/2026-08-27-canvas-today-ssot-polling.md` (as-built 차이)
- Modify: `parfait/adr/0029-canvas-today-ssot-polling.md` (status)

- [ ] **Step 1: 전체 컴파일**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 2: 전체 유닛 테스트**

Run: `./gradlew testDebugUnitTest`
Expected: PASS

- [ ] **Step 3: 린트**

Run: `./gradlew lintDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 스펙의 as-built 차이를 반영한다**

문서 저장소에서 고친다.

- 「하루 경계」 절 — 폴러는 티커를 구독하지 않고 **캐시에 실린 날짜가 오늘인지**로 오늘 조회 여부를 정한다. 티커는 캔버스 메인의 날짜 갱신용으로만 남는다.
- 「파일 구성」 신설 표 — `ApplicationScopeModule.kt`를 더하고, 티커의 소비자를 캔버스 메인 하나로 적는다.
- 「폴링을 어디에 두는가」 — `refreshTodayCanvasDetail`의 `parfaitId`가 호출부의 의도 표시일 뿐 실제 대상은 캐시가 정한다는 것을 적는다.

- [ ] **Step 5: ADR 상태를 `accepted`로 올린다**

머지된 뒤에 올린다. 머지 전이면 그대로 둔다.

- [ ] **Step 6: 커밋(문서 저장소)**

```bash
git add parfait/specs/2026-08-27-canvas-today-ssot-polling.md parfait/adr/0029-canvas-today-ssot-polling.md
git commit -m "docs: 캔버스 폴링 구현의 as-built 차이를 스펙에 반영한다"
```

---

## 수동 확인 (구현자가 직접)

기기 두 대가 필요한 항목이 있다.

- [ ] 기기 A에서 토핑을 올리면 기기 B의 캔버스에 폴링 주기 안에 나타난다
- [ ] 배경 편집 중 남이 토핑을 올려도 내 배치가 안 밀리고 남의 토핑만 나타난다
- [ ] 배경 편집 중 배경을 고른 뒤 기다려도 그 선택이 서버 배경으로 되돌아가지 않는다
- [ ] 배경 편집에서 토핑을 지운 뒤 지운 것이 다시 나타나지 않는다
- [ ] 카메라·갤러리로 나가 있는 동안 네트워크 요청이 멎는다(프로파일러·프록시로 확인)
- [ ] 앱을 백그라운드로 보내면 요청이 멎고, 돌아오면 즉시 한 번 나간다
- [ ] 달력에서 지난 날을 보는 동안 요청이 멎는다
- [ ] 남의 토핑을 강조한 상태에서 그 사람이 그 토핑을 지우면, 딤이 걷힌 뒤 다른 토핑을 탭할 수 있다
- [ ] 계정 전환 시 이전 계정의 캔버스가 남지 않는다

---

## Self-Review 결과

**스펙 커버리지** — 「폴링을 어디에 두는가」(Task 3·4), 「폴링 수명을 무엇에 매다는가」(Task 1·4·6), 「하루 경계」(Task 3의 캐시 날짜 판정 + Task 5의 티커), 「배경 편집 화면의 병합」(Task 7), 「캔버스 메인의 스포트라이트」(Task 6), 「토핑 배치 화면의 `positionZ`」(Task 8), 「세션 정리와 진행 중인 갱신」(Task 4의 `clearTodayCanvas`), 「검증」(각 태스크 + Task 9).

**타입 일관성** — `launchWhileSubscribed`의 파라미터 이름은 Task 1에서 `source`로 정하고 Task 5·6·7·8이 같은 이름을 쓴다. `CanvasPoller`의 네 함수는 Task 3에서 정의하고 Task 4가 그대로 부른다. `dirtyToppingIds`·`deletedToppingIds`는 Task 7에서만 쓴다.

**스펙과의 as-built 차이 하나** — 폴러가 하루 경계 티커를 구독하는 대신 캐시의 날짜로 판정한다. 결과가 같고 의존이 하나 줄어 이쪽을 택했으며, Task 9에서 스펙에 반영하도록 지시했다.

**남은 불확실** — `core/ui` 모듈에 `test` 소스셋이 있는지는 Task 1에서 확인하고, 없으면 **멈추고 사용자에게 묻도록** 지시했다(테스트 하니스 신설은 승인 사항). `UpdateToppingUseCase`·`AddToppingUseCase`의 정확한 시그니처는 각 태스크에서 실제 정의에 맞추도록 했다.
