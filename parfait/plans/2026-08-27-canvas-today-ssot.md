# PR2 — 오늘 캔버스 인메모리 SSoT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오늘 캔버스를 `:data`의 인메모리 저장소 한 벌에 두고, 캔버스 메인·배경 편집·토핑 배치 세 화면이 `Flow`로 구독하게 한다.

**Architecture:** ADR-0023이 그룹에 세운 구조를 캔버스로 확장한다. `CanvasLocalDataSource`(`@Singleton` + `MutableStateFlow<Map<GroupId, CanvasVO>>`)를 신설하고, `ParfaitRepository`의 `getTodayCanvas`를 **구독(`Flow`)·오늘 갱신·상세 갱신·정리** 넷으로 가른다. 값을 얻는 길이 둘이면 캐시가 곧 두 번째 출처가 되므로 갱신 함수는 `Result<Unit>`만 돌려준다. 세 ViewModel은 조회 대신 구독한다.

**Tech Stack:** Kotlin, Coroutines/Flow, Hilt, MockK, Turbine, kotlinx-coroutines-test

**Spec:** [`parfait/specs/2026-08-27-canvas-today-ssot-polling.md`](../specs/2026-08-27-canvas-today-ssot-polling.md) 「PR2 — 오늘 캔버스 인메모리 SSoT」
**대응 ADR:** [`parfait/adr/0029-canvas-today-ssot-polling.md`](../adr/0029-canvas-today-ssot-polling.md)

**작업 저장소:** `TJYG-Android` (remote `mash-up-kr/TJYG-Android`). 로컬 절대경로는 `wiki/personal-private/project-paths.md`에 있다. **PR1 위에 쌓는다.**

## Global Constraints

- **커밋은 하되 push·PR은 사용자 확인 후에만.**
- **코드 주석·KDoc 규약**(`parfait/CLAUDE.md`):
  - 코드가 이미 말하는 것은 쓰지 않는다.
  - `@return`·`@param`은 타입·이름이 말하지 못할 때만 쓴다.
  - 다른 컴포넌트의 현재 상태를 단정하지 않는다(낡는다). 써야 하면 근거 문서를 가리킨다.
  - 아키텍처 결정은 코드가 아니라 `parfait/adr/`·`parfait/architecture/`에 쓰고 코드에는 포인터 한 줄만 둔다.
- **주석·KDoc은 한국어로 쓴다.** 기존 파일의 문체를 따른다.
- **매퍼 단독 테스트를 만들지 않는다.** 판단이 든 변환은 DataSource 테스트의 케이스로 덮는다.
- **테스트는 `runTest(mainDispatcherRule.dispatcher)` 형태로 스케줄러를 하나로 묶는다.** `core.testing.MainDispatcherRule`이 이미 있고 `dispatcher`를 공개한다.
- **hot flow 수집은 `backgroundScope`나 Turbine의 `flow.test { }`로 한다.** `TestScope`에서 맨 `collect`를 부르면 테스트가 멈춘다.
- **이 PR은 폴링을 넣지 않는다.** 갱신 계기는 기존 `Enter`와 최초 구독뿐이다.
- **하루 경계 보장을 이 PR의 검증 기준으로 삼지 않는다.** 날짜 필터는 방출 시점에만 평가되고, 실제 보장은 PR3의 티커가 만든다.

---

## File Structure

**신설**

| 파일 | 책임 |
|------|------|
| `data/src/main/java/com/teamyg/parfait/data/source/parfait/local/CanvasLocalDataSource.kt` | 인터페이스 — 오늘 캔버스 구독·저장·정리 |
| `data/src/main/java/com/teamyg/parfait/data/source/parfait/local/CanvasLocalDataSourceImpl.kt` | `@Singleton` 인메모리 구현 |
| `domain/src/main/java/com/teamyg/parfait/domain/usecase/parfait/GetTodayParfaitFlowUseCase.kt` | 구독 + 날짜 낡음 필터 |
| `domain/src/main/java/com/teamyg/parfait/domain/usecase/parfait/RefreshTodayParfaitUseCase.kt` | 기존 `GetTodayParfaitUseCase` 이관 |
| `data/src/test/java/com/teamyg/parfait/data/source/parfait/local/CanvasLocalDataSourceImplTest.kt` | 저장소 테스트 |
| `domain/src/test/java/com/teamyg/parfait/domain/usecase/parfait/GetTodayParfaitFlowUseCaseTest.kt` | 날짜 필터 테스트 |

**변경**

| 파일 | 변경 |
|------|------|
| `domain/.../repository/parfait/ParfaitRepository.kt` | `getTodayCanvas` 제거, 넷으로 분리 |
| `data/.../repository/parfait/ParfaitRepositoryImpl.kt` | 로컬 데이터소스 조율 |
| `data/.../di/LocalDataSourceModule.kt` | `CanvasLocalDataSource` 바인딩 |
| `domain/.../usecase/auth/LogoutUseCase.kt` | 캔버스 캐시 정리 추가 |
| `data/.../network/TokenAuthenticator.kt` | 캔버스 캐시 정리 추가 |
| `feature/.../viewmodel/CanvasMainViewModel.kt` | 구독 이관, `viewedCanvas` → `pastCanvas` + `displayedCanvas` |
| `feature/.../viewmodel/CanvasBGEditViewModel.kt` | 구독 이관(최초 방출 시딩) |
| `feature/.../viewmodel/CanvasToppingPlaceViewModel.kt` | 구독 이관 |
| 도메인 테스트 페이크 3종 | `GetTodayParfaitUseCaseTest`·`GetParfaitHistoriesUseCaseTest`·`GetParfaitYearsUseCaseTest` |

**삭제**

`domain/.../usecase/parfait/GetTodayParfaitUseCase.kt`와 그 테스트는 `RefreshTodayParfaitUseCase`로 옮겨 간다.

---

### Task 1: `CanvasLocalDataSource`를 만든다

**Files:**
- Create: `data/src/main/java/com/teamyg/parfait/data/source/parfait/local/CanvasLocalDataSource.kt`
- Create: `data/src/main/java/com/teamyg/parfait/data/source/parfait/local/CanvasLocalDataSourceImpl.kt`
- Test: `data/src/test/java/com/teamyg/parfait/data/source/parfait/local/CanvasLocalDataSourceImplTest.kt`

**Interfaces:**
- Consumes: `CanvasVO`, `GroupId`
- Produces:
  - `fun todayCanvas(groupId: GroupId): Flow<CanvasVO?>`
  - `fun saveTodayCanvas(groupId: GroupId, canvas: CanvasVO)`
  - `fun clear()`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```kotlin
package com.teamyg.parfait.data.source.parfait.local

import app.cash.turbine.test
import com.teamyg.parfait.domain.model.canvas.CanvasStatus
import com.teamyg.parfait.domain.model.canvas.CanvasVO
import com.teamyg.parfait.domain.model.id.GroupId
import com.teamyg.parfait.domain.model.id.ParfaitId
import com.teamyg.parfait.domain.model.parfaitToday
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

private val GROUP_A = GroupId(1L)
private val GROUP_B = GroupId(2L)

class CanvasLocalDataSourceImplTest {
    private fun canvas(parfaitId: Long) = CanvasVO(
        parfaitId = ParfaitId(parfaitId),
        date = parfaitToday(),
        status = CanvasStatus.ACTIVE,
        lastClosedDate = null,
        members = emptyList(),
        background = null,
        toppings = emptyList(),
    )

    @Test
    fun `저장 전에는 null 을 낸다`() = runTest {
        val dataSource = CanvasLocalDataSourceImpl()

        dataSource.todayCanvas(GROUP_A).test {
            assertNull(awaitItem())
        }
    }

    @Test
    fun `저장하면 그 그룹 구독자에게 값이 간다`() = runTest {
        val dataSource = CanvasLocalDataSourceImpl()

        dataSource.todayCanvas(GROUP_A).test {
            assertNull(awaitItem())

            dataSource.saveTodayCanvas(GROUP_A, canvas(100L))

            assertEquals(ParfaitId(100L), awaitItem()?.parfaitId)
        }
    }

    @Test
    fun `다른 그룹 저장은 이 구독자를 흔들지 않는다`() = runTest {
        val dataSource = CanvasLocalDataSourceImpl()

        dataSource.todayCanvas(GROUP_A).test {
            assertNull(awaitItem())

            dataSource.saveTodayCanvas(GROUP_B, canvas(200L))

            expectNoEvents()
        }
    }

    @Test
    fun `정리하면 다시 null 이 된다`() = runTest {
        val dataSource = CanvasLocalDataSourceImpl()
        dataSource.saveTodayCanvas(GROUP_A, canvas(100L))

        dataSource.todayCanvas(GROUP_A).test {
            assertEquals(ParfaitId(100L), awaitItem()?.parfaitId)

            dataSource.clear()

            assertNull(awaitItem())
        }
    }
}
```

`CanvasVO`의 실제 생성자 파라미터가 위와 다르면 실제 정의에 맞춘다(`domain/.../model/canvas/CanvasVO.kt`).

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :data:test --tests "*CanvasLocalDataSourceImplTest*"`
Expected: 컴파일 실패 — `CanvasLocalDataSourceImpl` 없음

- [ ] **Step 3: 인터페이스와 구현을 쓴다**

`CanvasLocalDataSource.kt`:

```kotlin
package com.teamyg.parfait.data.source.parfait.local

import com.teamyg.parfait.domain.model.canvas.CanvasVO
import com.teamyg.parfait.domain.model.id.GroupId
import kotlinx.coroutines.flow.Flow

/**
 * 오늘 캔버스의 인메모리 SSoT (`adr/0029-canvas-today-ssot-polling.md`).
 *
 * 지난 날 캔버스는 여기 두지 않는다 — 마감돼 바뀌지 않으므로 공유해 얻을 것이 없고,
 * 날짜 축을 들이면 무효화 규칙이 그만큼 늘어난다.
 *
 * IO 가 없어 모든 함수가 non-suspend 다.
 */
interface CanvasLocalDataSource {
    /** 아직 한 번도 못 받았으면 `null`. 오늘 캔버스는 서버가 없으면 만들어 주므로 "0건"이 없다 */
    fun todayCanvas(groupId: GroupId): Flow<CanvasVO?>

    /** [CanvasVO] 에 `groupId` 가 없어 따로 받는다 */
    fun saveTodayCanvas(groupId: GroupId, canvas: CanvasVO)

    fun clear()
}
```

`CanvasLocalDataSourceImpl.kt`:

```kotlin
package com.teamyg.parfait.data.source.parfait.local

import com.teamyg.parfait.domain.model.canvas.CanvasVO
import com.teamyg.parfait.domain.model.id.GroupId
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CanvasLocalDataSourceImpl @Inject constructor() : CanvasLocalDataSource {
    private val canvases = MutableStateFlow<Map<GroupId, CanvasVO>>(emptyMap())

    /**
     * 맵 전체가 아니라 한 그룹으로 좁혀서 낸다 — [distinctUntilChanged] 가 없으면 남의 그룹
     * 캔버스가 저장될 때마다 이 구독자까지 재방출된다.
     */
    override fun todayCanvas(groupId: GroupId): Flow<CanvasVO?> = canvases
        .map { it[groupId] }
        .distinctUntilChanged()

    override fun saveTodayCanvas(groupId: GroupId, canvas: CanvasVO) {
        canvases.update { it + (groupId to canvas) }
    }

    override fun clear() {
        canvases.value = emptyMap()
    }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew :data:test --tests "*CanvasLocalDataSourceImplTest*"`
Expected: PASS (4건)

- [ ] **Step 5: DI 바인딩을 더한다**

`data/src/main/java/com/teamyg/parfait/data/di/LocalDataSourceModule.kt`의 `bindGroupLocalDataSource` 아래에 넣고, import 두 줄을 알파벳 순서에 맞게 더한다.

```kotlin
    @Binds
    @Singleton
    fun bindCanvasLocalDataSource(canvasLocalDataSourceImpl: CanvasLocalDataSourceImpl): CanvasLocalDataSource
```

- [ ] **Step 6: 컴파일 확인**

Run: `./gradlew :data:compileDebugKotlin`
Expected: BUILD SUCCESSFUL

- [ ] **Step 7: 커밋**

```bash
git add data/src/main/java/com/teamyg/parfait/data/source/parfait/local/ data/src/test/java/com/teamyg/parfait/data/source/parfait/local/ data/src/main/java/com/teamyg/parfait/data/di/LocalDataSourceModule.kt
git commit -m "feat: 오늘 캔버스 인메모리 저장소를 만든다"
```

---

### Task 2: `ParfaitRepository`를 구독·갱신·정리로 가른다

**Files:**
- Modify: `domain/src/main/java/com/teamyg/parfait/domain/repository/parfait/ParfaitRepository.kt`
- Modify: `data/src/main/java/com/teamyg/parfait/data/repository/parfait/ParfaitRepositoryImpl.kt`
- Modify: `domain/src/test/java/com/teamyg/parfait/domain/usecase/parfait/GetTodayParfaitUseCaseTest.kt`
- Modify: `domain/src/test/java/com/teamyg/parfait/domain/usecase/parfait/GetParfaitHistoriesUseCaseTest.kt`
- Modify: `domain/src/test/java/com/teamyg/parfait/domain/usecase/parfait/GetParfaitYearsUseCaseTest.kt`

**Interfaces:**
- Consumes: Task 1의 `CanvasLocalDataSource`
- Produces:
  - `fun todayCanvas(groupId: GroupId): Flow<CanvasVO?>`
  - `suspend fun refreshTodayCanvas(groupId: GroupId): Result<Unit>`
  - `suspend fun refreshTodayCanvasDetail(groupId: GroupId, parfaitId: ParfaitId): Result<Unit>`
  - `fun clearTodayCanvas()`
  - 기존 `getYears`·`getPastCanvases`·`getCanvasDetail`·`changeCanvasBackground`는 그대로

- [ ] **Step 1: 인터페이스를 고친다**

`getTodayCanvas`를 지우고 넷을 넣는다. 기존 `getTodayCanvas`의 KDoc(⚠️ 부작용 경고)은 `refreshTodayCanvas`로 옮긴다.

```kotlin
    /**
     * 오늘 캔버스 구독. 아직 한 번도 못 받았으면 `null` 이다.
     *
     * 값을 얻는 길은 이것 하나뿐이다 — 갱신 함수가 값을 돌려주면 캐시가 곧 두 번째 출처가 된다
     * (`adr/0029-canvas-today-ssot-polling.md`).
     */
    fun todayCanvas(groupId: GroupId): Flow<CanvasVO?>

    /**
     * ⚠️ 조회인데 서버가 캔버스를 만든다 — 오늘 날짜 파르페가 없으면 생성해 저장한다
     * (`api/parfait.md`). 부를 지점을 아껴야 한다.
     *
     * 오늘 날짜가 이미 마감돼 있으면 그것을 그대로 싣는다 — status 가 ACTIVE 가 아닐 수 있다.
     * 그 캔버스에 쓰기를 보내면 409 PARFAIT_ALREADY_CLOSED 로 돌아온다.
     */
    suspend fun refreshTodayCanvas(groupId: GroupId): Result<Unit>

    /**
     * 상세 조회로 오늘 캔버스 캐시를 갱신한다. [refreshTodayCanvas] 와 달리 부작용이 없어
     * 주기 갱신은 이쪽을 쓴다.
     *
     * [getCanvasDetail] 과 같은 엔드포인트지만 캐시에 싣는다는 점이 다르다 — 지난 날 조회가
     * 오늘 캔버스를 덮지 않도록 표면을 갈라 둔다.
     */
    suspend fun refreshTodayCanvasDetail(groupId: GroupId, parfaitId: ParfaitId): Result<Unit>

    /** 세션 종료 정리. `:domain` 이 `:data` 를 볼 수 없어 저장소 표면으로 낸다 */
    fun clearTodayCanvas()
```

`kotlinx.coroutines.flow.Flow` import를 더한다.

- [ ] **Step 2: 구현을 고친다**

```kotlin
class ParfaitRepositoryImpl @Inject constructor(
    private val parfaitRemoteDataSource: ParfaitRemoteDataSource,
    private val canvasLocalDataSource: CanvasLocalDataSource,
) : ParfaitRepository {
    override fun todayCanvas(groupId: GroupId): Flow<CanvasVO?> = canvasLocalDataSource.todayCanvas(groupId)

    override suspend fun refreshTodayCanvas(groupId: GroupId): Result<Unit> = parfaitRemoteDataSource
        .getTodayCanvas(groupId)
        .onSuccess { canvas -> canvasLocalDataSource.saveTodayCanvas(groupId, canvas) }
        .map { }
        .mapErrorToAppError()

    override suspend fun refreshTodayCanvasDetail(
        groupId: GroupId,
        parfaitId: ParfaitId,
    ): Result<Unit> = parfaitRemoteDataSource
        .getCanvasDetail(groupId = groupId, parfaitId = parfaitId)
        .onSuccess { canvas -> canvasLocalDataSource.saveTodayCanvas(groupId, canvas) }
        .map { }
        .mapErrorToAppError()

    override fun clearTodayCanvas() = canvasLocalDataSource.clear()
    // 나머지 함수는 그대로
}
```

클래스 KDoc에 한 줄을 더한다.

```kotlin
/**
 * 위임만 하는 것처럼 보여도 [mapErrorToAppError] 때문에 이 층이 필요하다 — 여기서
 * `ApiException` 을 `AppError` 로 바꿔야 domain·feature 가 `:data` 를 보지 않는다.
 *
 * 오늘 캔버스는 [CanvasLocalDataSource] 인메모리 캐시가 SSoT 다
 * (`adr/0029-canvas-today-ssot-polling.md`) — 조회는 캐시를 읽는 [Flow] 하나, 서버 재조회는
 * [refreshTodayCanvas]·[refreshTodayCanvasDetail] 로 갈라 둔다.
 */
```

- [ ] **Step 3: 도메인 테스트 페이크 셋을 고친다**

세 테스트 파일의 `FakeParfaitRepository`가 `getTodayCanvas`를 override하고 있다. `GetParfaitHistoriesUseCaseTest`·`GetParfaitYearsUseCaseTest`는 그 함수를 쓰지 않으므로 새 표면 넷을 아래처럼 채운다.

```kotlin
        override fun todayCanvas(groupId: GroupId): Flow<CanvasVO?> = error("이 유스케이스는 구독하지 않는다")

        override suspend fun refreshTodayCanvas(groupId: GroupId): Result<Unit> =
            error("이 유스케이스는 오늘 캔버스를 갱신하지 않는다")

        override suspend fun refreshTodayCanvasDetail(
            groupId: GroupId,
            parfaitId: ParfaitId,
        ): Result<Unit> = error("이 유스케이스는 상세를 갱신하지 않는다")

        override fun clearTodayCanvas() = error("이 유스케이스는 캐시를 지우지 않는다")
```

`GetTodayParfaitUseCaseTest`는 Task 3에서 통째로 옮기므로 여기서는 컴파일만 되게 같은 방식으로 채운다.

- [ ] **Step 4: 컴파일 확인**

Run: `./gradlew :domain:compileDebugKotlin :domain:compileDebugUnitTestKotlin :data:compileDebugKotlin`
Expected: 세 ViewModel이 아직 옛 함수를 부르므로 `:feature:groups:canvas:impl`은 아직 깨진다. 이 단계에서는 `:domain`·`:data`만 통과하면 된다.

- [ ] **Step 5: 커밋**

```bash
git add domain/src/main/java/com/teamyg/parfait/domain/repository/parfait/ParfaitRepository.kt data/src/main/java/com/teamyg/parfait/data/repository/parfait/ParfaitRepositoryImpl.kt domain/src/test/java/com/teamyg/parfait/domain/usecase/parfait/
git commit -m "refactor: 오늘 캔버스 조회를 구독과 갱신으로 가른다"
```

---

### Task 3: 갱신 UseCase와 구독 UseCase를 만든다

**Files:**
- Create: `domain/src/main/java/com/teamyg/parfait/domain/usecase/parfait/RefreshTodayParfaitUseCase.kt`
- Create: `domain/src/main/java/com/teamyg/parfait/domain/usecase/parfait/GetTodayParfaitFlowUseCase.kt`
- Delete: `domain/src/main/java/com/teamyg/parfait/domain/usecase/parfait/GetTodayParfaitUseCase.kt`
- Modify(rename): `domain/src/test/java/com/teamyg/parfait/domain/usecase/parfait/GetTodayParfaitUseCaseTest.kt` → `RefreshTodayParfaitUseCaseTest.kt`
- Create: `domain/src/test/java/com/teamyg/parfait/domain/usecase/parfait/GetTodayParfaitFlowUseCaseTest.kt`

**Interfaces:**
- Consumes: Task 2의 `ParfaitRepository.todayCanvas`·`refreshTodayCanvas`
- Produces:
  - `suspend operator fun RefreshTodayParfaitUseCase.invoke(groupId: GroupId, clock: Clock = Clock.System): Result<Unit>`
  - `operator fun GetTodayParfaitFlowUseCase.invoke(groupId: GroupId, clock: Clock = Clock.System): Flow<CanvasVO?>`

- [ ] **Step 1: 구독 UseCase의 실패하는 테스트를 쓴다**

```kotlin
package com.teamyg.parfait.domain.usecase.parfait

import app.cash.turbine.test
import com.teamyg.parfait.domain.model.canvas.CanvasStatus
import com.teamyg.parfait.domain.model.canvas.CanvasVO
import com.teamyg.parfait.domain.model.id.GroupId
import com.teamyg.parfait.domain.model.id.ParfaitId
import com.teamyg.parfait.domain.model.parfaitToday
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.DatePeriod
import kotlinx.datetime.LocalDate
import kotlinx.datetime.minus
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

private val GROUP = GroupId(1L)

class GetTodayParfaitFlowUseCaseTest {
    private fun canvas(date: LocalDate) = CanvasVO(
        parfaitId = ParfaitId(100L),
        date = date,
        status = CanvasStatus.ACTIVE,
        lastClosedDate = null,
        members = emptyList(),
        background = null,
        toppings = emptyList(),
    )

    private fun useCaseWith(canvas: CanvasVO?): GetTodayParfaitFlowUseCase =
        GetTodayParfaitFlowUseCase(FakeParfaitRepository(flowOf(canvas)))

    @Test
    fun `오늘 날짜 캔버스는 그대로 흘린다`() = runTest {
        val today = parfaitToday()

        useCaseWith(canvas(today))(GROUP).test {
            assertEquals(ParfaitId(100L), awaitItem()?.parfaitId)
            awaitComplete()
        }
    }

    @Test
    fun `어제 날짜 캔버스는 null 로 거른다`() = runTest {
        val yesterday = parfaitToday().minus(DatePeriod(days = 1))

        useCaseWith(canvas(yesterday))(GROUP).test {
            assertNull(awaitItem())
            awaitComplete()
        }
    }

    @Test
    fun `미조회는 그대로 null 이다`() = runTest {
        useCaseWith(null)(GROUP).test {
            assertNull(awaitItem())
            awaitComplete()
        }
    }
}
```

`FakeParfaitRepository`는 이 파일 안에 `private class`로 두고 `todayCanvas`만 값을 내며 나머지는 `error("…")`로 채운다. Task 2에서 만든 형태를 그대로 쓴다.

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :domain:test --tests "*GetTodayParfaitFlowUseCaseTest*"`
Expected: 컴파일 실패 — `GetTodayParfaitFlowUseCase` 없음

- [ ] **Step 3: 두 UseCase를 쓴다**

`RefreshTodayParfaitUseCase.kt` — 기존 `GetTodayParfaitUseCase`의 하루 경계 재시도 판단을 그대로 옮기고 반환만 바꾼다.

```kotlin
package com.teamyg.parfait.domain.usecase.parfait

import com.teamyg.parfait.domain.model.id.GroupId
import com.teamyg.parfait.domain.model.parfaitToday
import com.teamyg.parfait.domain.repository.parfait.ParfaitRepository
import javax.inject.Inject
import kotlin.time.Clock

/**
 * 오늘의 캔버스를 받아 캐시에 싣는다. 파르페 하루 경계(새벽 3시)를 지나며 요청이 나가
 * 어제 캔버스를 받으면 한 번만 다시 부른다.
 *
 * 값은 돌려주지 않는다 — 읽는 길은 [GetTodayParfaitFlowUseCase] 하나다.
 */
class RefreshTodayParfaitUseCase
@Inject
constructor(
    private val parfaitRepository: ParfaitRepository,
) {
    /**
     * @param clock 파르페 하루 경계 판정에 쓰는 시계. 테스트에서 경계 앞뒤 시각을 고정한다.
     */
    suspend operator fun invoke(
        groupId: GroupId,
        clock: Clock = Clock.System,
    ): Result<Unit> {
        val first = parfaitRepository.refreshTodayCanvas(groupId)
        if (first.isFailure) return first

        // 캐시에 실린 날짜가 오늘이면 끝이다. 요청이 도는 사이 경계를 넘겼다면 어제 것이 실려 있다
        val cached = parfaitRepository.todayCanvas(groupId).first()
        if (cached == null || cached.date == parfaitToday(clock)) return first

        // 두 번째도 어긋나면 기기와 서버의 시계가 어긋난 것이라 더 불러도 같은 답이 온다
        return parfaitRepository.refreshTodayCanvas(groupId)
    }
}
```

`kotlinx.coroutines.flow.first` import를 더한다.

`GetTodayParfaitFlowUseCase.kt`:

```kotlin
package com.teamyg.parfait.domain.usecase.parfait

import com.teamyg.parfait.domain.model.canvas.CanvasVO
import com.teamyg.parfait.domain.model.id.GroupId
import com.teamyg.parfait.domain.model.parfaitToday
import com.teamyg.parfait.domain.repository.parfait.ParfaitRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import kotlin.time.Clock

/**
 * 오늘 캔버스 구독. 캐시에 실린 것이 오늘 날짜가 아니면 `null` 로 낸다.
 *
 * ⚠️ 이 필터는 업스트림이 방출할 때만 평가된다. 캐시에 `distinctUntilChanged` 가 걸려 있어
 * 값이 안 바뀌면 재방출이 없다 — 화면을 열어 둔 채 하루 경계를 넘기는 경우는 이 필터가 아니라
 * 별도 시간 축이 닫는다(`specs/2026-08-27-canvas-today-ssot-polling.md` 「하루 경계」).
 */
class GetTodayParfaitFlowUseCase
@Inject
constructor(
    private val parfaitRepository: ParfaitRepository,
) {
    /**
     * @param clock 파르페 하루 경계 판정에 쓰는 시계. 주입하지 않으면 낡음 판정을 테스트로
     *   고정할 수 없다.
     */
    operator fun invoke(
        groupId: GroupId,
        clock: Clock = Clock.System,
    ): Flow<CanvasVO?> = parfaitRepository
        .todayCanvas(groupId)
        .map { canvas -> canvas?.takeIf { it.date == parfaitToday(clock) } }
}
```

- [ ] **Step 4: 기존 `GetTodayParfaitUseCase`를 지우고 테스트를 옮긴다**

```bash
git rm domain/src/main/java/com/teamyg/parfait/domain/usecase/parfait/GetTodayParfaitUseCase.kt
git mv domain/src/test/java/com/teamyg/parfait/domain/usecase/parfait/GetTodayParfaitUseCaseTest.kt domain/src/test/java/com/teamyg/parfait/domain/usecase/parfait/RefreshTodayParfaitUseCaseTest.kt
```

옮긴 테스트에서 클래스명·SUT를 바꾸고, 페이크가 `getTodayCanvas` 대신 `refreshTodayCanvas`를 세고 `todayCanvas`로 실린 값을 내게 고친다. 단언은 반환 `CanvasVO` 대신 `callCount`와 캐시 값으로 바꾼다.

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `./gradlew :domain:test`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add domain/
git commit -m "feat: 오늘 캔버스 구독·갱신 유스케이스를 가른다"
```

---

### Task 4: `CanvasMainViewModel`을 구독으로 옮기고 캔버스 필드를 정리한다

**Files:**
- Modify: `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/viewmodel/CanvasMainViewModel.kt`
- Modify: `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/screen/CanvasMainScreen.kt` (파생값 이름이 바뀌는 자리만)
- Modify: `feature/groups/canvas/impl/src/test/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/viewmodel/CanvasMainViewModelTest.kt`

**Interfaces:**
- Consumes: Task 3의 `GetTodayParfaitFlowUseCase`·`RefreshTodayParfaitUseCase`
- Produces:
  - `CanvasMainUiState.pastCanvas: CanvasVO?` (지난 날 전용)
  - `CanvasMainUiState.displayedCanvas: CanvasVO?` (파생)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`CanvasMainViewModelTest`에 세 건을 더한다. 기존 테스트가 쓰는 목킹 방식(MockK)과 `MainDispatcherRule`을 그대로 따른다.

```kotlin
    @Test
    fun `구독 값이 오면 오늘 캔버스가 화면에 실린다`() = runTest(mainDispatcherRule.dispatcher) {
        val canvas = todayCanvas(parfaitId = 100L)
        every { getTodayParfaitFlow(GroupId(GROUP_ID)) } returns flowOf(canvas)
        coEvery { refreshTodayParfait(GroupId(GROUP_ID)) } returns Result.success(Unit)

        val viewModel = createViewModel()
        advanceUntilIdle()

        assertEquals(canvas, viewModel.state.value.todayCanvas)
        assertEquals(canvas, viewModel.state.value.displayedCanvas)
    }

    @Test
    fun `지난 날을 보는 동안에는 구독 값이 화면을 덮지 않는다`() = runTest(mainDispatcherRule.dispatcher) {
        // 달력에서 지난 날을 고른 뒤 오늘 캔버스가 갱신돼도 화면은 지난 날 그대로다
    }

    @Test
    fun `Enter 는 갱신을 부른다`() = runTest(mainDispatcherRule.dispatcher) {
        every { getTodayParfaitFlow(GroupId(GROUP_ID)) } returns flowOf(null)
        coEvery { refreshTodayParfait(GroupId(GROUP_ID)) } returns Result.success(Unit)

        val viewModel = createViewModel()
        viewModel.processIntent(CanvasMainIntent.Enter)
        advanceUntilIdle()

        coVerify(atLeast = 1) { refreshTodayParfait(GroupId(GROUP_ID)) }
    }
```

두 번째 테스트의 본문은 기존 테스트의 달력 조작 헬퍼를 그대로 써서 채운다 — `ClickDate`로 지난 날을 고르고 `getParfaitDetail`을 목킹한 뒤, 구독 flow에 새 오늘 캔버스를 흘려도 `displayedCanvas`가 지난 날 것인지 단언한다. 구독 flow를 도중에 갈아 끼우려면 `flowOf` 대신 `MutableStateFlow`를 목킹 반환값으로 쓴다.

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :feature:groups:canvas:impl:test --tests "*CanvasMainViewModelTest*"`
Expected: 컴파일 실패 — `getTodayParfaitFlow`·`displayedCanvas` 없음

- [ ] **Step 3: UiState를 고친다**

`viewedCanvas`를 `pastCanvas`로 좁히고 파생값을 넣는다.

```kotlin
    /**
     * 오늘 캔버스. 저장소 구독 값이다 — 아직 못 받았거나 조회가 실패했으면 null 이다.
     *
     * [pastCanvas] 와 나눠 두는 이유는 토핑 추가·배경 편집이 언제나 오늘 것을 대상으로 해야
     * 해서다. 지난 날을 보다가 그 캔버스를 고치면 서버가 409 로 되돌려준다.
     */
    val todayCanvas: CanvasVO? = null,
    /** 달력에서 고른 **지난** 날의 캔버스. 오늘을 볼 때는 쓰이지 않는다 */
    val pastCanvas: CanvasVO? = null,
```

파생값과 그것을 보는 getter들:

```kotlin
    /** 화면에 그려지는 캔버스 */
    val displayedCanvas: CanvasVO?
        get() = if (isViewingToday) todayCanvas else pastCanvas

    /** 미설정이면 null. 그때는 [YGCanvas] 의 기본 배경이 그려진다 */
    val canvasBackground: CanvasBackground?
        get() = displayedCanvas?.background

    /** 그리는 순서대로 들고 있다 — positionZ 오름차순이라 뒤쪽이 위에 덮인다 */
    val toppings: List<CanvasToppingVO>
        get() = displayedCanvas?.toppings.orEmpty().sortedBy { it.transform.positionZ }
```

`isCanvasEmpty`·`spotlightedTopping`은 `toppings`를 보므로 그대로 둔다.

- [ ] **Step 4: ViewModel을 구독으로 옮긴다**

생성자에서 `getTodayParfaitUseCase`를 `getTodayParfaitFlowUseCase`·`refreshTodayParfaitUseCase` 둘로 바꾸고, `init`에 구독을 연다.

```kotlin
    init {
        viewModelLogger.i { "CanvasMainViewModel::init" }
        observeTodayCanvas()
        loadCanvasMainInfo()
        // 연도 목록은 해가 바뀔 때만 늘어나 재진입마다 물어볼 값이 아니다
        loadParfaitYears()
    }

    private fun observeTodayCanvas() {
        launch {
            getTodayParfaitFlowUseCase(groupId).collect { canvas ->
                updateState {
                    copy(
                        todayCanvas = canvas,
                        memberChips = canvas?.members?.toMemberChips() ?: memberChips,
                    )
                }
            }
        }
    }
```

`loadTodayCanvas()`는 갱신만 남긴다.

```kotlin
    private fun loadTodayCanvas() {
        launch(key = LOAD_TODAY_CANVAS_KEY) {
            refreshTodayParfaitUseCase(groupId).onFailure { throwable ->
                viewModelLogger.e(throwable) { "오늘 캔버스를 불러오지 못했다 - groupId: ${groupId.value}" }
                if (state.value.todayCanvas == null) {
                    postSideEffect(CanvasMainEffect.ShowTodayCanvasError)
                }
            }
        }
    }
```

`syncToday()`에서 캔버스를 비우는 대입을 걷어낸다 — 날짜 필터가 그 자리를 맡는다.

```kotlin
    private fun syncToday() {
        val today = parfaitToday()
        if (today == state.value.today) return

        updateState {
            if (isViewingToday) {
                copy(today = today, selectedDate = today, displayedMonth = today.toFirstDayOfMonth())
            } else {
                copy(today = today)
            }
        }
    }
```

`handleClickDate`·`handleClickGoToToday`에서 `viewedCanvas = todayCanvas` 대입을 지운다 — 오늘로 돌아가면 파생값이 저절로 오늘 것을 고른다. 지난 날 조회 결과는 `pastCanvas`에 넣는다.

```kotlin
    private fun loadCanvasDetail(date: LocalDate, parfaitId: ParfaitId) {
        launch(key = LOAD_CANVAS_DETAIL_KEY) {
            getParfaitDetailUseCase(groupId = groupId, parfaitId = parfaitId)
                .onSuccess { canvas ->
                    updateState {
                        // 기다리는 사이 다른 날로 옮겼으면 그 날의 캔버스를 덮지 않는다
                        if (selectedDate == date) copy(pastCanvas = canvas) else this
                    }
                }.onFailure { throwable ->
                    viewModelLogger.e(throwable) { "캔버스를 불러오지 못했다 - date: $date" }
                }
        }
    }
```

- [ ] **Step 5: 화면이 파생값을 보게 한다**

`CanvasMainScreen`이 `canvasState.viewedCanvas`를 직접 읽는 자리가 있으면 `displayedCanvas`로 바꾼다. `canvasBackground`·`toppings`만 읽고 있으면 바꿀 것이 없다.

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

Run: `./gradlew :feature:groups:canvas:impl:test --tests "*CanvasMainViewModelTest*"`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/viewmodel/CanvasMainViewModel.kt feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/screen/CanvasMainScreen.kt feature/groups/canvas/impl/src/test/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/viewmodel/CanvasMainViewModelTest.kt
git commit -m "refactor: 캔버스 메인이 오늘 캔버스를 구독하게 한다"
```

---

### Task 5: `CanvasBGEditViewModel`을 구독으로 옮긴다

**Files:**
- Modify: `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/viewmodel/CanvasBGEditViewModel.kt`
- Modify: `feature/groups/canvas/impl/src/test/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/viewmodel/CanvasBGEditViewModelTest.kt`

**Interfaces:**
- Consumes: Task 3의 `GetTodayParfaitFlowUseCase`·`RefreshTodayParfaitUseCase`
- Produces: 없음(화면 내부)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```kotlin
    @Test
    fun `최초 방출에만 배경 선택을 서버 값으로 시딩한다`() = runTest(mainDispatcherRule.dispatcher) {
        val canvases = MutableStateFlow<CanvasVO?>(canvasWithImageBackground(SAVED_IMAGE_URL))
        every { getTodayParfaitFlow(GroupId(GROUP_ID)) } returns canvases
        coEvery { refreshTodayParfait(GroupId(GROUP_ID)) } returns Result.success(Unit)

        val viewModel = createViewModel()
        advanceUntilIdle()
        assertEquals(SAVED_IMAGE_URL, viewModel.state.value.selectedImageUri)

        // 사용자가 갤러리에서 새 배경을 고른다
        viewModel.processIntent(
            CanvasBGEditIntent.OnBackgroundImageResult(
                uri = LOCAL_IMAGE_URI,
                source = PictureConfirmSource.GALLERY,
            ),
        )
        advanceUntilIdle()

        // 그 뒤에 온 구독 방출은 사용자의 선택을 덮지 않는다
        canvases.value = canvasWithImageBackground("https://cdn.example.com/other.png")
        advanceUntilIdle()

        assertEquals(LOCAL_IMAGE_URI, viewModel.state.value.selectedImageUri)
        assertEquals(PictureConfirmSource.GALLERY, viewModel.state.value.selectedImageSource)
    }

    @Test
    fun `최초 방출에만 편집 대상 parfaitId 를 옮긴다`() = runTest(mainDispatcherRule.dispatcher) {
        // 최초 방출의 parfaitId 로 옮기고, 이후 방출로는 옮기지 않는다
    }
```

두 번째 테스트는 확인 버튼이 실제로 어느 `parfaitId`로 나가는지 `coVerify`로 단언해 채운다 — `changeCanvasBackground`가 받는 `parfaitId`를 본다.

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :feature:groups:canvas:impl:test --tests "*CanvasBGEditViewModelTest*"`
Expected: 컴파일 실패

- [ ] **Step 3: 구독으로 옮긴다**

`loadCanvas()`를 구독으로 바꾸고 최초 방출 여부를 든다.

```kotlin
    /** 최초 방출에만 서버 값을 시딩한다 — 이후 방출이 사용자의 선택을 덮으면 안 된다 */
    private var hasSeededFromCanvas = false

    init {
        viewModelLogger.i { "CanvasBGEditViewModel::init" }
        observeCanvas()
        refreshCanvas()
    }

    private fun observeCanvas() {
        launch {
            getTodayParfaitFlowUseCase(groupId).collect { canvas ->
                if (canvas == null) return@collect

                if (hasSeededFromCanvas.not()) {
                    // 편집을 연 캔버스와 조회 결과가 다르면 조회 쪽으로 옮긴다 — 화면에 그려진
                    // 토핑과 저장 대상이 갈라지는 편이 더 나쁘다
                    if (canvas.parfaitId != parfaitId) {
                        viewModelLogger.e {
                            "편집을 연 캔버스와 조회 결과가 다르다 — 조회 쪽으로 옮긴다" +
                                " (열린 것: ${parfaitId.value}, 받은 것: ${canvas.parfaitId.value})"
                        }
                        parfaitId = canvas.parfaitId
                    }
                }

                val toppings = canvas.toppings
                    .sortedBy { topping -> topping.transform.positionZ }
                    .map { topping -> topping.toToppingItem() }
                confirmedToppings = toppings

                updateState { withCanvas(canvas = canvas, toppings = toppings) }
                hasSeededFromCanvas = true
            }
        }
    }

    private fun refreshCanvas() {
        launch(key = LOAD_CANVAS_KEY) {
            refreshTodayParfaitUseCase(groupId).onFailure { throwable ->
                viewModelLogger.e(throwable) { "캔버스를 불러오지 못했다 - parfaitId: ${parfaitId.value}" }
                postSideEffect(effect = CanvasBGEditEffect.ShowError(throwable.toCanvasBGEditError()))
            }
        }
    }
```

`withCanvas`가 배경 선택을 최초에만 시딩하게 고친다.

```kotlin
    /**
     * 배경 선택은 최초 방출에만 서버 값에서 시딩한다 — 이후 방출까지 대입하면 사용자가 방금 고른
     * 배경이 되돌아간다.
     *
     * 저장된 배경 색을 못 읽으면 기본 색으로 두는데, 그때 확인을 누르면 배경이 팔레트 첫 색으로
     * 바뀐다 — 못 읽는 색을 그대로 되돌려 보내는 것보다 낫다.
     */
    private fun CanvasBGEditUiState.withCanvas(
        canvas: CanvasVO,
        toppings: List<CanvasToppingItem>,
    ): CanvasBGEditUiState {
        val withToppings = copy(toppings = toppings)
        if (hasSeededFromCanvas) return withToppings

        return withToppings.copy(
            selectedColor = (canvas.background as? CanvasBackground.Color)
                ?.value
                ?.toColorOrNull()
                ?: selectedColor,
            selectedImageUri = (canvas.background as? CanvasBackground.Image)?.url,
            selectedImageSource = null,
        )
    }
```

> PR2 단계의 토핑 병합 규칙은 **통째 대입**이다. 이 단계엔 폴링이 없어 방출 계기가 최초 로드뿐이고, 지켜야 할 로컬 편집이 없다. PR3이 이 자리를 dirty 집합 병합으로 대체한다.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew :feature:groups:canvas:impl:test --tests "*CanvasBGEditViewModelTest*"`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/viewmodel/CanvasBGEditViewModel.kt feature/groups/canvas/impl/src/test/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/viewmodel/CanvasBGEditViewModelTest.kt
git commit -m "refactor: 배경 편집이 오늘 캔버스를 구독하게 한다"
```

---

### Task 6: `CanvasToppingPlaceViewModel`을 구독으로 옮긴다

**Files:**
- Modify: `feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/viewmodel/CanvasToppingPlaceViewModel.kt`
- Modify: `feature/groups/canvas/impl/src/test/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/viewmodel/CanvasToppingPlaceViewModelTest.kt`

**Interfaces:**
- Consumes: Task 3의 `GetTodayParfaitFlowUseCase`·`RefreshTodayParfaitUseCase`
- Produces: 없음(화면 내부)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```kotlin
    @Test
    fun `구독 값이 null 이면 마지막 배경을 지킨다`() = runTest(mainDispatcherRule.dispatcher) {
        val canvases = MutableStateFlow<CanvasVO?>(canvasWithColorBackground("#FF0000"))
        every { getTodayParfaitFlow(GroupId(GROUP_ID)) } returns canvases
        coEvery { refreshTodayParfait(GroupId(GROUP_ID)) } returns Result.success(Unit)

        val viewModel = createViewModel()
        advanceUntilIdle()
        val seeded = viewModel.state.value.backgroundColor

        canvases.value = null
        advanceUntilIdle()

        assertEquals(seeded, viewModel.state.value.backgroundColor)
    }
```

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :feature:groups:canvas:impl:test --tests "*CanvasToppingPlaceViewModelTest*"`
Expected: 컴파일 실패

- [ ] **Step 3: 구독으로 옮긴다**

`canvasLoadedForGroupId` 가드와 `loadCanvasIfNeeded`를 지우고, 초안이 알려 준 `groupId`로 한 번만 구독을 연다.

```kotlin
    /** 초안이 그룹을 알려 준 뒤에야 구독을 열 수 있다. 그룹은 흐름 내내 바뀌지 않는다 */
    private var canvasObserveJob: Job? = null

    private fun observeCanvasOnce(groupId: GroupId) {
        if (canvasObserveJob != null) return

        canvasObserveJob = launch {
            getTodayParfaitFlowUseCase(groupId).collect { canvas ->
                // null 은 무시한다 — 비우면 배경이 흰색으로 튄다
                if (canvas == null) return@collect
                updateState { withCanvas(canvas) }
            }
        }

        launch(key = LOAD_CANVAS_KEY) {
            refreshTodayParfaitUseCase(groupId).onFailure { throwable ->
                // 조회 실패는 토핑 배치 자체를 막지 않는다 — 기본 배경·빈 토핑 목록으로 그대로 둔다
                viewModelLogger.e(throwable) { "캔버스를 불러오지 못했다 - groupId: ${groupId.value}" }
            }
        }
    }
```

`observeDraft()`의 `draft?.groupId?.let { groupId -> loadCanvasIfNeeded(groupId) }`를 `observeCanvasOnce(groupId)`로 바꾼다.

`BaseViewModel.launch`가 `Job?`을 돌려주는지 확인한다. `key` 없이 부르면 `Job`을 돌려주는 형태라면 그대로 쓰고, 아니면 `viewModelScope.launch` 대신 플래그 하나(`private var isObservingCanvas = false`)로 같은 효과를 낸다.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew :feature:groups:canvas:impl:test --tests "*CanvasToppingPlaceViewModelTest*"`
Expected: PASS

- [ ] **Step 5: 모듈 전체 테스트**

Run: `./gradlew :feature:groups:canvas:impl:test`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add feature/groups/canvas/impl/src/main/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/viewmodel/CanvasToppingPlaceViewModel.kt feature/groups/canvas/impl/src/test/kotlin/com/teamyg/parfait/feature/groups/canvas/impl/viewmodel/CanvasToppingPlaceViewModelTest.kt
git commit -m "refactor: 토핑 배치가 오늘 캔버스를 구독하게 한다"
```

---

### Task 7: 세션 종료 시 캔버스 캐시를 지운다

**Files:**
- Modify: `domain/src/main/java/com/teamyg/parfait/domain/usecase/auth/LogoutUseCase.kt`
- Modify: `data/src/main/java/com/teamyg/parfait/data/network/TokenAuthenticator.kt`
- Modify: `domain/src/test/java/com/teamyg/parfait/domain/usecase/auth/LogoutUseCaseTest.kt`
- Modify: `data/src/test/java/com/teamyg/parfait/data/network/TokenAuthenticatorTest.kt` (있으면)

**Interfaces:**
- Consumes: Task 2의 `ParfaitRepository.clearTodayCanvas`, Task 1의 `CanvasLocalDataSource.clear`
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`LogoutUseCaseTest`에 더한다.

```kotlin
    @Test
    fun `로그아웃은 캔버스 캐시도 지운다`() = runTest {
        useCase()

        verify { parfaitRepository.clearTodayCanvas() }
    }

    @Test
    fun `인메모리 정리를 계정 정보 정리보다 먼저 부른다`() = runTest {
        useCase()

        coVerifyOrder {
            parfaitGroupRepository.clearGroups()
            parfaitRepository.clearTodayCanvas()
            memberRepository.clearMyAccount()
        }
    }
```

`TokenAuthenticatorTest`가 있으면 `canvasLocalDataSource.clear()`가 `userInfoLocalDataSource.clear()`보다 먼저 불리는지 같은 방식으로 단언한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew :domain:test --tests "*LogoutUseCaseTest*"`
Expected: 컴파일 실패

- [ ] **Step 3: `LogoutUseCase`를 고친다**

생성자에 `ParfaitRepository`를 더하고, KDoc의 정리 순서 설명에 캔버스를 넣는다.

```kotlin
class LogoutUseCase @Inject constructor(
    private val authRepository: AuthRepository,
    private val memberRepository: MemberRepository,
    private val parfaitGroupRepository: ParfaitGroupRepository,
    private val parfaitRepository: ParfaitRepository,
) {
    suspend operator fun invoke(): Result<Unit> {
        val result = authRepository.logout()
        parfaitGroupRepository.clearGroups()
        parfaitRepository.clearTodayCanvas()
        runSuspendCatching { memberRepository.clearMyAccount() }
        return result
    }
}
```

기존 KDoc의 "`ParfaitGroupRepository.clearGroups` 는 인메모리라 IO 실패 경로가 없어…" 문단에 캔버스 캐시도 같은 성질이라는 한 구절을 더한다. 새 문단을 만들지 않는다.

- [ ] **Step 4: `TokenAuthenticator`를 고친다**

`groupLocalDataSource.clear()` 바로 뒤, `userInfoLocalDataSource.clear()` 앞에 `canvasLocalDataSource.clear()`를 넣고 생성자에 주입을 더한다.

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `./gradlew :domain:test :data:test`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add domain/src/main/java/com/teamyg/parfait/domain/usecase/auth/LogoutUseCase.kt data/src/main/java/com/teamyg/parfait/data/network/TokenAuthenticator.kt domain/src/test/ data/src/test/
git commit -m "fix: 세션이 끝날 때 캔버스 캐시도 지운다"
```

---

### Task 8: 전체 빌드와 테스트를 확인한다

**Files:** 없음(검증만)

- [ ] **Step 1: 전체 컴파일**

Run: `./gradlew assembleDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 2: 전체 유닛 테스트**

Run: `./gradlew testDebugUnitTest`
Expected: PASS. 실패하면 그 모듈의 페이크·목킹이 새 `ParfaitRepository` 표면을 안 따라온 것이다.

- [ ] **Step 3: 린트**

Run: `./gradlew lintDebug`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 남은 호출자 확인**

Run: `grep -rn "getTodayParfaitUseCase\|GetTodayParfaitUseCase\|getTodayCanvas" --include=*.kt . | grep -v "/build/" | grep -v "ParfaitRemoteDataSource"`
Expected: 결과 없음(원격 데이터소스의 동명 함수만 남는다)

- [ ] **Step 5: 커밋(고칠 것이 있었다면)**

```bash
git add -A
git commit -m "fix: 오늘 캔버스 구독 이관에서 남은 호출자를 고친다"
```

---

## 수동 확인 (구현자가 직접)

실기기에서 확인한다. 이 PR에는 폴링이 없으므로 "다른 기기에서 올린 토핑이 저절로 나타나는지"는 확인 대상이 아니다.

- [ ] 캔버스를 열면 오늘 캔버스가 그려지고 그룹명·멤버 칩이 뜬다
- [ ] 배경 편집으로 들어가면 같은 토핑이 보인다
- [ ] 배경 편집에서 갤러리로 배경을 고르면 그 선택이 유지된다
- [ ] 배경을 저장하고 되감으면 캔버스 메인에 그 배경이 반영된다
- [ ] 토핑을 추가하고 되감으면 캔버스 메인에 그 토핑이 나타난다
- [ ] 달력에서 지난 날을 고르면 그 날 캔버스가 보이고, "오늘의 파르페 가기"로 돌아오면 오늘 것이 보인다
- [ ] 로그아웃 후 다른 계정으로 들어가면 이전 계정의 캔버스가 보이지 않는다

---

## Self-Review 결과

**스펙 커버리지** — 「저장소 구조」(Task 1), 「Repository」(Task 2), 「갱신·무효화 규칙」의 PR2 해당 행(Task 2·4), 「UseCase」(Task 3), 「화면 이관」 셋(Task 4·5·6), 「실패 표현」(Task 4의 `loadTodayCanvas`), 「세션 종료 정리」(Task 7), 「검증」(각 태스크의 테스트 + Task 8).

**타입 일관성** — `CanvasLocalDataSource`의 함수 셋은 Task 1에서 정의하고 Task 2·7에서 그대로 쓴다. `ParfaitRepository`의 새 표면 넷은 Task 2에서 정의하고 Task 3·4·5·6·7이 같은 이름을 쓴다. `displayedCanvas`·`pastCanvas`는 Task 4에서 정의하고 그 뒤로는 안 쓰인다.

**남은 불확실** — `BaseViewModel.launch`가 `Job?`을 돌려주는지는 Task 6에서 확인하도록 지시했다. `TokenAuthenticatorTest`의 존재 여부도 Task 7에서 확인하도록 했다. `CanvasVO`의 실제 생성자 파라미터는 Task 1에서 확인하도록 했다.
