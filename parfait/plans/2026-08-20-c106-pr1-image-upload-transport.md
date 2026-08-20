---
id: c106-pr1-image-upload-transport
title: C-106 결선 PR1 — 이미지 업로드 전송 계층 (presigned 발급·S3 PUT·확인)
status: draft
type: work-order
created: 2026-08-20
updated: 2026-08-20
platforms: android
owner: Parfait 팀
related_adr: ADR-0017, ADR-0025, ADR-0026
related_spec: c106-topping-place-api
related_code:
  - NetworkModule.kt#provideUnauthenticatedOkHttpClient
  - NetworkModule.kt#loggingInterceptor
  - AuthInterceptor.kt#intercept
  - ImageRemoteDataSource.kt#issueUploadUrl
  - ImageRemoteDataSource.kt#confirmUpload
  - ImageRemoteDataSourceImpl.kt
  - UnauthenticatedClient.kt
  - ApiException.kt
  - AppErrorMapper.kt#toAppError
  - AppErrorMapper.kt#mapErrorToAppError
  - RemoteDataSourceModule.kt
  - RepositoryModule.kt
archived_reason:
tags: [plan, parfait, image, upload, network]
---

# C-106 결선 PR1 — 이미지 업로드 전송 계층 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development(권장) 또는 superpowers:executing-plans로 task 단위 구현. 단계는 체크박스(`- [ ]`)로 추적.

**Goal:** presigned URL 발급 → S3 PUT → 업로드 확인 3단계를 하나로 닫는 `ImageUploadRepository`를 만든다. 돌려주는 `ImageId`는 이미 서버에서 확정된 것이라 곧바로 토핑 배치에 쓸 수 있다.

**Architecture:** 저장소에 **S3로 바이트를 보내는 경로가 아예 없다.** 그 요청은 Retrofit이 아니라 raw OkHttp라 전용 클라이언트가 필요하고, 그 분리는 성능 선택이 아니라 **기능 전제**다 — 공유 클라이언트를 쓰면 `Authorization`이 붙어 S3가 거절한다. 아래에서 위로 세 층을 쌓는다: 전용 OkHttp 클라이언트 → PUT 전송 DataSource → 3단계를 묶는 Repository. **이 PR에는 소비자가 없다** — 화면 결선은 PR5다.

**Tech Stack:** Kotlin · OkHttp 5 · Hilt · kotlinx-coroutines-test · MockWebServer 3 · MockK · kotlin.test

**Spec:** [`parfait/specs/2026-08-20-c106-topping-place-api.md`](../specs/2026-08-20-c106-topping-place-api.md)

## Global Constraints

- **작업 대상 저장소는 `TJYG-Android`**이고 이 문서가 사는 저장소가 아니다. 로컬 절대경로는 `wiki/personal-private/project-paths.md`에 있다.
- **브랜치는 `feature/#270-c-106-topping-add-api`** 위에서 이어 간다. 그 브랜치에는 이미 사전 커밋 넷(`PARFAIT_ALREADY_CLOSED` 상수·`http/` 문서)이 있고 그대로 둔다.
- **커밋은 태스크마다 한다.** `git push`·`gh pr create`·`gh pr merge`는 **하지 않는다** — 사용자 확인이 필요한 작업이다.
- **주석·KDoc 규약**(`parfait/CLAUDE.md`):
  - 코드가 이미 말하는 것은 쓰지 않는다.
  - `@return`·`@param`은 타입·이름이 말하지 못할 때만 쓴다.
  - 다른 컴포넌트의 현재 상태를 단정하지 않는다(낡는다). 함정과 의도는 쓴다.
- **`contentType`은 한 곳에서만 정한다.** 발급 요청과 PUT 헤더 양쪽이 같은 값을 써야 한다 — 둘 다 S3 서명 대상이고, 어긋난 실패는 서버 로그에 남지 않는다.
- **`filePath`는 파일 시스템 절대경로**다. `file://` uri가 아니다.
- 매퍼 단독 테스트(`XxxVOMapperTest`)는 만들지 않는다. 변환 판단은 DataSource·Repository 테스트 케이스로 잠근다.
- 검증 명령(태스크마다 전부 통과해야 한다):
  ```bash
  ./gradlew :domain:test :data:testDebugUnitTest ktlintCheck
  ```
  마지막 태스크에서만 `./gradlew :app:assembleDebug`까지 돌린다.

## 파일 구성

| 파일 | 책임 |
|---|---|
| `data/model/qualifier/UploadClient.kt` (신규) | S3 전송 표면을 가리키는 Hilt 한정자 |
| `data/di/NetworkModule.kt` (수정) | 업로드 전용 `OkHttpClient` 제공 |
| `data/model/exception/PresignedUploadException.kt` (신규) | S3가 준 비-2xx 상태 코드를 실어 나른다 |
| `data/source/image/remote/PresignedUploadDataSource.kt` (신규) | PUT 전송 계약 |
| `data/source/image/remote/PresignedUploadDataSourceImpl.kt` (신규) | raw OkHttp로 파일을 스트리밍 전송 |
| `data/di/RemoteDataSourceModule.kt` (수정) | 위 구현 바인딩 |
| `domain/repository/image/ImageUploadRepository.kt` (신규) | 3단계를 하나로 닫는 도메인 계약 |
| `data/repository/image/ImageUploadRepositoryImpl.kt` (신규) | 발급 → PUT → 확인 조율 + `AppError` 변환 |
| `data/di/RepositoryModule.kt` (수정) | 위 구현 바인딩 |

---

### Task 1: 업로드 전용 OkHttp 클라이언트

**Files:**
- Create: `data/src/main/java/com/teamyg/parfait/data/model/qualifier/UploadClient.kt`
- Modify: `data/src/main/java/com/teamyg/parfait/data/di/NetworkModule.kt`
- Test: `data/src/test/java/com/teamyg/parfait/data/di/UploadClientTest.kt`

**Interfaces:**
- Consumes: 없음(이 PR의 첫 태스크)
- Produces: `@UploadClient` 한정자 · `NetworkModule.provideUploadOkHttpClient(): OkHttpClient`

- [ ] **Step 1: 실패 테스트 작성**

`data/src/test/java/com/teamyg/parfait/data/di/UploadClientTest.kt`:

```kotlin
package com.teamyg.parfait.data.di

import com.teamyg.parfait.data.network.AuthInterceptor
import okhttp3.Authenticator
import okhttp3.logging.HttpLoggingInterceptor
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class UploadClientTest {
    @Test
    fun provideUploadOkHttpClient_hasNoAuthInterceptor() {
        // Given·When 업로드 전용 클라이언트를 만든다
        val client = NetworkModule.provideUploadOkHttpClient()

        // Then 자격증명을 붙이는 인터셉터가 없다 — 붙으면 presigned URL 을 S3 가 거절한다
        assertFalse(client.interceptors.any { it is AuthInterceptor })
    }

    @Test
    fun provideUploadOkHttpClient_hasNoAuthenticator() {
        // Given·When 업로드 전용 클라이언트를 만든다
        val client = NetworkModule.provideUploadOkHttpClient()

        // Then 401 을 만나도 재발급을 시도하지 않는다
        assertEquals(Authenticator.NONE, client.authenticator)
    }

    @Test
    fun provideUploadOkHttpClient_doesNotLogRequestBody() {
        // Given·When 업로드 전용 클라이언트를 만든다
        val client = NetworkModule.provideUploadOkHttpClient()

        // Then 본문 로깅이 없다 — 원본 해상도 PNG 가 매 업로드마다 문자열로 힙에 올라간다
        val logging = client.interceptors.filterIsInstance<HttpLoggingInterceptor>()
        assertTrue(logging.none { it.level == HttpLoggingInterceptor.Level.BODY })
    }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

```bash
./gradlew :data:testDebugUnitTest --tests "com.teamyg.parfait.data.di.UploadClientTest"
```

Expected: 컴파일 실패 — `Unresolved reference: provideUploadOkHttpClient`

- [ ] **Step 3: 한정자를 만든다**

`data/src/main/java/com/teamyg/parfait/data/model/qualifier/UploadClient.kt`:

```kotlin
package com.teamyg.parfait.data.model.qualifier

import javax.inject.Qualifier

/**
 * S3 presigned URL 로 파일 바이트를 보내는 표면.
 *
 * 자격증명을 붙이지 않고, 재발급 표면과 `Dispatcher` 를 공유하지 않으며, 본문을 로깅하지 않는다.
 * 이름은 사용처가 아니라 이 표면의 성질을 가리킨다.
 */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class UploadClient
```

- [ ] **Step 4: 제공자를 만든다**

`NetworkModule.kt`에 import를 더한다:

```kotlin
import com.teamyg.parfait.data.model.qualifier.UploadClient
```

`provideUnauthenticatedOkHttpClient` 바로 아래에 제공자를 더한다:

```kotlin
    /**
     * S3 presigned PUT 전용. **자격증명을 붙이지 않는 것이 이 클라이언트의 존재 이유다** —
     * `AuthInterceptor` 는 Retrofit `Invocation` 태그로 `@NoAuth` 를 판정하는데 raw OkHttp
     * 요청에는 그 태그가 없어 `Authorization` 이 무조건 붙고, presigned URL 에 그 헤더가 실리면
     * S3 가 서명 수단 중복으로 거절한다.
     *
     * [provideUnauthenticatedOkHttpClient] 를 재사용하지 않는 이유는 그쪽이 토큰 재발급의 교착을
     * 피하려고 자기 [Dispatcher] 를 들고 있기 때문이다. 업로드가 그 슬롯을 오래 점유하면 401 이
     * 몰릴 때 재발급이 다시 굶는다.
     *
     * ⚠️ `okHttpClient.newBuilder()` 로 파생하면 **부모의 [Dispatcher] 를 그대로 물려받아**
     * 그 격리가 사라진다. 반드시 새 [OkHttpClient.Builder] 로 만든다.
     *
     * 본문 로깅을 붙이지 않는다 — 보내는 것이 원본 해상도 이미지라 디버그 빌드에서 매 업로드마다
     * 그 크기가 문자열로 힙에 올라간다.
     *
     * `writeTimeout` 은 바이트 사이 유휴 상한이라 전송 전체가 느린 것을 잡지 못한다. 그래서 이
     * 표면만 `callTimeout` 을 함께 둔다.
     */
    @Provides
    @Singleton
    @UploadClient
    fun provideUploadOkHttpClient(): OkHttpClient = OkHttpClient
        .Builder()
        .dispatcher(Dispatcher())
        .addInterceptor(uploadLoggingInterceptor())
        .connectTimeout(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .writeTimeout(UPLOAD_WRITE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .callTimeout(UPLOAD_CALL_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .build()
```

`loggingInterceptor()` 바로 아래에 더한다:

```kotlin
    private fun uploadLoggingInterceptor(): HttpLoggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.HEADERS else HttpLoggingInterceptor.Level.NONE
    }
```

기존 상수 옆에 둘을 더한다:

```kotlin
    private const val UPLOAD_WRITE_TIMEOUT_SECONDS = 60L
    private const val UPLOAD_CALL_TIMEOUT_SECONDS = 120L
```

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다**

```bash
./gradlew :domain:test :data:testDebugUnitTest ktlintCheck
```

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add data/src/main/java/com/teamyg/parfait/data/model/qualifier/UploadClient.kt \
        data/src/main/java/com/teamyg/parfait/data/di/NetworkModule.kt \
        data/src/test/java/com/teamyg/parfait/data/di/UploadClientTest.kt
git commit -m "feat(network): 업로드 전용 OkHttpClient 를 분리한다

presigned URL 에 Authorization 이 실리면 S3 가 거절한다. AuthInterceptor 는
Retrofit Invocation 태그로 @NoAuth 를 판정하므로 raw OkHttp 요청에는 헤더가
무조건 붙는다. 재발급 전용 클라이언트를 재사용하지 않는 이유는 그쪽 Dispatcher 를
업로드가 오래 점유하면 재발급이 다시 굶기 때문이다."
```

---

### Task 2: presigned PUT 전송 DataSource

**Files:**
- Create: `data/src/main/java/com/teamyg/parfait/data/model/exception/PresignedUploadException.kt`
- Create: `data/src/main/java/com/teamyg/parfait/data/source/image/remote/PresignedUploadDataSource.kt`
- Create: `data/src/main/java/com/teamyg/parfait/data/source/image/remote/PresignedUploadDataSourceImpl.kt`
- Modify: `data/src/main/java/com/teamyg/parfait/data/di/RemoteDataSourceModule.kt`
- Test: `data/src/test/java/com/teamyg/parfait/data/source/image/remote/PresignedUploadDataSourceImplTest.kt`

**Interfaces:**
- Consumes: `@UploadClient` 한정자 · `NetworkModule.provideUploadOkHttpClient()`
- Produces:
  - `PresignedUploadDataSource.put(uploadUrl: String, contentType: String, file: File): Result<Unit>`
  - `PresignedUploadException(val statusCode: Int)`

- [ ] **Step 1: 실패 테스트 작성**

`data/src/test/java/com/teamyg/parfait/data/source/image/remote/PresignedUploadDataSourceImplTest.kt`:

```kotlin
package com.teamyg.parfait.data.source.image.remote

import com.teamyg.parfait.data.di.NetworkModule
import com.teamyg.parfait.data.model.exception.ApiException
import com.teamyg.parfait.data.model.exception.PresignedUploadException
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import java.io.File
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PresignedUploadDataSourceImplTest {
    private lateinit var server: MockWebServer
    private lateinit var dataSource: PresignedUploadDataSource
    private lateinit var file: File

    @BeforeTest
    fun setUp() {
        server = MockWebServer()
        server.start()
        dataSource = PresignedUploadDataSourceImpl(NetworkModule.provideUploadOkHttpClient())
        file = File.createTempFile("topping", ".png")
        file.writeBytes(ByteArray(FILE_SIZE) { index -> index.toByte() })
    }

    @AfterTest
    fun tearDown() {
        server.close()
        file.delete()
    }

    @Test
    fun put_serverAccepts_sendsPutWithGivenContentType() = runTest {
        // Given S3 가 200 을 준다
        server.enqueue(MockResponse.Builder().code(200).build())

        // When 발급 때 쓴 contentType 으로 올린다
        val result = dataSource.put(
            uploadUrl = server.url("/upload").toString(),
            contentType = "image/png",
            file = file,
        )

        // Then 성공하고 PUT 으로 그 타입이 그대로 나간다 — 발급 값과 어긋나면 S3 가 거절한다
        assertTrue(result.isSuccess)
        val recorded = server.takeRequest()
        assertEquals("PUT", recorded.method)
        assertEquals("image/png", recorded.headers["Content-Type"])
    }

    @Test
    fun put_serverAccepts_doesNotSendAuthorizationHeader() = runTest {
        // Given S3 가 200 을 준다
        server.enqueue(MockResponse.Builder().code(200).build())

        // When 올린다
        dataSource.put(
            uploadUrl = server.url("/upload").toString(),
            contentType = "image/png",
            file = file,
        )

        // Then Authorization 이 없다. 붙으면 S3 가 서명 수단 중복으로 거절해 업로드가 아예 안 된다
        val recorded = server.takeRequest()
        assertNull(recorded.headers["Authorization"])
    }

    @Test
    fun put_serverAccepts_sendsWholeFile() = runTest {
        // Given S3 가 200 을 준다
        server.enqueue(MockResponse.Builder().code(200).build())

        // When 올린다
        dataSource.put(
            uploadUrl = server.url("/upload").toString(),
            contentType = "image/png",
            file = file,
        )

        // Then 파일 전체가 나간다
        val recorded = server.takeRequest()
        assertEquals(file.length().toString(), recorded.headers["Content-Length"])
    }

    @Test
    fun put_serverRejects_failsWithStatusCode() = runTest {
        // Given S3 가 403 으로 거절한다(서명 불일치·만료가 이 모양으로 온다)
        server.enqueue(MockResponse.Builder().code(403).build())

        // When 올린다
        val result = dataSource.put(
            uploadUrl = server.url("/upload").toString(),
            contentType = "image/png",
            file = file,
        )

        // Then 상태 코드를 실은 실패다 — S3 거절은 서버 로그에 안 남아 이 값이 유일한 단서다
        val unknown = assertIs<ApiException.Unknown>(result.exceptionOrNull())
        val cause = assertIs<PresignedUploadException>(unknown.cause)
        assertEquals(403, cause.statusCode)
    }

    @Test
    fun put_connectionFails_failsAsNetwork() = runTest {
        // Given 아무도 듣지 않는 포트다

        // When 올린다
        val result = dataSource.put(
            uploadUrl = UNREACHABLE_URL,
            contentType = "image/png",
            file = file,
        )

        // Then 재시도가 의미 있는 갈래로 분류된다
        assertIs<ApiException.Network>(result.exceptionOrNull())
    }

    private companion object {
        const val FILE_SIZE = 1024

        /** 특권 포트 1 은 어떤 서버도 듣지 않아 연결이 즉시 거절된다 */
        const val UNREACHABLE_URL = "http://127.0.0.1:1/upload"
    }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

```bash
./gradlew :data:testDebugUnitTest --tests "com.teamyg.parfait.data.source.image.remote.PresignedUploadDataSourceImplTest"
```

Expected: 컴파일 실패 — `Unresolved reference: PresignedUploadDataSourceImpl`

- [ ] **Step 3: 예외 타입을 만든다**

`data/src/main/java/com/teamyg/parfait/data/model/exception/PresignedUploadException.kt`:

```kotlin
package com.teamyg.parfait.data.model.exception

/**
 * S3 가 presigned PUT 을 거절했다.
 *
 * 이 실패는 우리 서버를 거치지 않아 서버 로그에 아무것도 남지 않는다. 그래서 상태 코드를
 * 여기 실어 둔다 — 원인 추적의 유일한 단서다.
 */
class PresignedUploadException(
    val statusCode: Int,
) : Exception("presigned PUT 거절 - statusCode: $statusCode")
```

- [ ] **Step 4: 계약을 만든다**

`data/src/main/java/com/teamyg/parfait/data/source/image/remote/PresignedUploadDataSource.kt`:

```kotlin
package com.teamyg.parfait.data.source.image.remote

import java.io.File

interface PresignedUploadDataSource {
    /**
     * 발급받은 presigned URL 로 파일 바이트를 그대로 올린다. 우리 서버가 아니라 S3 로 나가는
     * 유일한 요청이다.
     *
     * @param contentType URL 을 발급받을 때 보낸 값과 **반드시 같아야 한다.** 서명 대상이라
     *   어긋나면 S3 가 거절하고, 그 실패는 서버 로그에 남지 않는다.
     */
    suspend fun put(
        uploadUrl: String,
        contentType: String,
        file: File,
    ): Result<Unit>
}
```

- [ ] **Step 5: 구현을 만든다**

`data/src/main/java/com/teamyg/parfait/data/source/image/remote/PresignedUploadDataSourceImpl.kt`:

```kotlin
package com.teamyg.parfait.data.source.image.remote

import com.teamyg.parfait.data.model.exception.ApiException
import com.teamyg.parfait.data.model.exception.PresignedUploadException
import com.teamyg.parfait.data.model.qualifier.UploadClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.IOException
import javax.inject.Inject
import kotlin.coroutines.cancellation.CancellationException

class PresignedUploadDataSourceImpl @Inject constructor(
    @UploadClient private val okHttpClient: OkHttpClient,
) : PresignedUploadDataSource {
    override suspend fun put(
        uploadUrl: String,
        contentType: String,
        file: File,
    ): Result<Unit> = withContext(Dispatchers.IO) {
        // asRequestBody 는 파일을 스트리밍으로 읽는다. 바이트를 미리 배열에 담으면 원본 해상도
        // 이미지가 통째로 힙에 올라간다
        val request = Request
            .Builder()
            .url(uploadUrl)
            .put(file.asRequestBody(contentType.toMediaType()))
            .build()

        try {
            okHttpClient.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Result.success(Unit)
                } else {
                    Result.failure(ApiException.Unknown(PresignedUploadException(response.code)))
                }
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: IOException) {
            Result.failure(ApiException.Network(e))
        }
    }
}
```

- [ ] **Step 6: DI 바인딩을 더한다**

`RemoteDataSourceModule.kt`에 import를 더한다:

```kotlin
import com.teamyg.parfait.data.source.image.remote.PresignedUploadDataSource
import com.teamyg.parfait.data.source.image.remote.PresignedUploadDataSourceImpl
```

인터페이스 본문에 바인딩을 더한다:

```kotlin
    @Binds
    @Singleton
    fun bindPresignedUploadDataSource(
        presignedUploadDataSourceImpl: PresignedUploadDataSourceImpl,
    ): PresignedUploadDataSource
```

- [ ] **Step 7: 테스트를 돌려 통과를 확인한다**

```bash
./gradlew :domain:test :data:testDebugUnitTest ktlintCheck
```

Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add data/src/main/java/com/teamyg/parfait/data/model/exception/PresignedUploadException.kt \
        data/src/main/java/com/teamyg/parfait/data/source/image/remote/PresignedUploadDataSource.kt \
        data/src/main/java/com/teamyg/parfait/data/source/image/remote/PresignedUploadDataSourceImpl.kt \
        data/src/main/java/com/teamyg/parfait/data/di/RemoteDataSourceModule.kt \
        data/src/test/java/com/teamyg/parfait/data/source/image/remote/PresignedUploadDataSourceImplTest.kt
git commit -m "feat(image): S3 presigned PUT 전송 경로를 추가한다

파일을 스트리밍으로 태워 원본 해상도 이미지가 힙에 통째로 올라가지 않게 한다.
S3 거절은 우리 서버를 거치지 않아 로그가 없으므로 상태 코드를 예외에 싣는다."
```

---

### Task 3: 3단계를 하나로 닫는 ImageUploadRepository

**Files:**
- Create: `domain/src/main/java/com/teamyg/parfait/domain/repository/image/ImageUploadRepository.kt`
- Create: `data/src/main/java/com/teamyg/parfait/data/repository/image/ImageUploadRepositoryImpl.kt`
- Modify: `data/src/main/java/com/teamyg/parfait/data/di/RepositoryModule.kt`
- Test: `data/src/test/java/com/teamyg/parfait/data/repository/image/ImageUploadRepositoryImplTest.kt`

**Interfaces:**
- Consumes:
  - `PresignedUploadDataSource.put(uploadUrl: String, contentType: String, file: File): Result<Unit>`
  - `ImageRemoteDataSource.issueUploadUrl(fileName: String, contentType: String, imageType: ImageType): Result<ImageUploadUrlVO>`
  - `ImageRemoteDataSource.confirmUpload(imageId: ImageId): Result<ConfirmedImageVO>`
- Produces: `ImageUploadRepository.upload(filePath: String, imageType: ImageType): Result<ImageId>`

- [ ] **Step 1: 실패 테스트 작성**

`data/src/test/java/com/teamyg/parfait/data/repository/image/ImageUploadRepositoryImplTest.kt`:

```kotlin
package com.teamyg.parfait.data.repository.image

import com.teamyg.parfait.data.model.exception.ApiException
import com.teamyg.parfait.data.source.image.remote.ImageRemoteDataSource
import com.teamyg.parfait.data.source.image.remote.PresignedUploadDataSource
import com.teamyg.parfait.domain.model.error.AppError
import com.teamyg.parfait.domain.model.id.ImageId
import com.teamyg.parfait.domain.model.image.ConfirmedImageVO
import com.teamyg.parfait.domain.model.image.ImageStatus
import com.teamyg.parfait.domain.model.image.ImageType
import com.teamyg.parfait.domain.model.image.ImageUploadUrlVO
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import java.io.File
import java.io.IOException
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.time.Duration.Companion.seconds

class ImageUploadRepositoryImplTest {
    private val imageRemoteDataSource: ImageRemoteDataSource = mockk()
    private val presignedUploadDataSource: PresignedUploadDataSource = mockk()
    private val repository = ImageUploadRepositoryImpl(
        imageRemoteDataSource = imageRemoteDataSource,
        presignedUploadDataSource = presignedUploadDataSource,
    )

    private lateinit var file: File

    private val issued = ImageUploadUrlVO(
        imageId = ImageId(7L),
        uploadUrl = "https://s3.example.com/upload",
        imageUrl = "https://cdn.example.com/image.png",
        expiresIn = 900.seconds,
    )

    @BeforeTest
    fun setUp() {
        file = File.createTempFile("topping", ".png")
        file.writeBytes(ByteArray(FILE_SIZE))
    }

    @AfterTest
    fun tearDown() {
        file.delete()
    }

    private fun givenAllStepsSucceed() {
        coEvery { imageRemoteDataSource.issueUploadUrl(any(), any(), any()) } returns Result.success(issued)
        coEvery { presignedUploadDataSource.put(any(), any(), any()) } returns Result.success(Unit)
        coEvery { imageRemoteDataSource.confirmUpload(any()) } returns Result.success(
            ConfirmedImageVO(
                imageId = ImageId(7L),
                imageUrl = "https://cdn.example.com/image.png",
                status = ImageStatus.COMPLETED,
            ),
        )
    }

    @Test
    fun upload_allStepsSucceed_returnsConfirmedImageId() = runTest {
        // Given 발급·전송·확인이 모두 성공한다
        givenAllStepsSucceed()

        // When 업로드한다
        val result = repository.upload(filePath = file.absolutePath, imageType = ImageType.NUKKI)

        // Then 확인까지 마친 imageId 가 나온다
        assertEquals(ImageId(7L), result.getOrNull())
    }

    @Test
    fun upload_allStepsSucceed_usesSameContentTypeForIssueAndPut() = runTest {
        // Given 발급·전송·확인이 모두 성공한다
        givenAllStepsSucceed()
        val issuedContentType = slot<String>()
        val putContentType = slot<String>()
        coEvery {
            imageRemoteDataSource.issueUploadUrl(any(), capture(issuedContentType), any())
        } returns Result.success(issued)
        coEvery {
            presignedUploadDataSource.put(any(), capture(putContentType), any())
        } returns Result.success(Unit)

        // When 업로드한다
        repository.upload(filePath = file.absolutePath, imageType = ImageType.NUKKI)

        // Then 두 값이 같다. 어긋나면 S3 가 서명 불일치로 거절하고 서버 로그에 안 남는다
        assertEquals("image/png", issuedContentType.captured)
        assertEquals(issuedContentType.captured, putContentType.captured)
    }

    @Test
    fun upload_allStepsSucceed_sendsRealFileName() = runTest {
        // Given 발급·전송·확인이 모두 성공한다
        givenAllStepsSucceed()
        val fileName = slot<String>()
        coEvery {
            imageRemoteDataSource.issueUploadUrl(capture(fileName), any(), any())
        } returns Result.success(issued)

        // When 업로드한다
        repository.upload(filePath = file.absolutePath, imageType = ImageType.NUKKI)

        // Then 더미가 아니라 실제 파일명을 보낸다
        assertEquals(file.name, fileName.captured)
    }

    @Test
    fun upload_issueFails_doesNotPutOrConfirm() = runTest {
        // Given 발급이 실패한다
        coEvery { imageRemoteDataSource.issueUploadUrl(any(), any(), any()) } returns Result.failure(
            ApiException.Network(IOException("connection reset")),
        )

        // When 업로드한다
        val result = repository.upload(filePath = file.absolutePath, imageType = ImageType.NUKKI)

        // Then 다음 단계로 넘어가지 않고 도메인 에러로 바뀌어 나온다
        assertIs<AppError.Network>(result.exceptionOrNull())
        coVerify(exactly = 0) { presignedUploadDataSource.put(any(), any(), any()) }
        coVerify(exactly = 0) { imageRemoteDataSource.confirmUpload(any()) }
    }

    @Test
    fun upload_putFails_doesNotConfirm() = runTest {
        // Given 발급은 되고 전송이 실패한다
        coEvery { imageRemoteDataSource.issueUploadUrl(any(), any(), any()) } returns Result.success(issued)
        coEvery { presignedUploadDataSource.put(any(), any(), any()) } returns Result.failure(
            ApiException.Network(IOException("broken pipe")),
        )

        // When 업로드한다
        val result = repository.upload(filePath = file.absolutePath, imageType = ImageType.NUKKI)

        // Then 확인을 부르지 않는다. 부르면 S3 에 없는 객체가 COMPLETED 로 굳는다
        assertIs<AppError.Network>(result.exceptionOrNull())
        coVerify(exactly = 0) { imageRemoteDataSource.confirmUpload(any()) }
    }

    @Test
    fun upload_unsupportedExtension_failsWithoutCallingServer() = runTest {
        // Given 서버가 받지 않는 확장자다
        val gif = File.createTempFile("topping", ".gif")

        // When 업로드한다
        val result = repository.upload(filePath = gif.absolutePath, imageType = ImageType.NUKKI)

        // Then 서버를 부르기 전에 끊는다 — 발급을 부르면 PENDING 행과 S3 키만 남는다
        assertIs<AppError.Unexpected>(result.exceptionOrNull())
        coVerify(exactly = 0) { imageRemoteDataSource.issueUploadUrl(any(), any(), any()) }
        gif.delete()
    }

    private companion object {
        const val FILE_SIZE = 16
    }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

```bash
./gradlew :data:testDebugUnitTest --tests "com.teamyg.parfait.data.repository.image.ImageUploadRepositoryImplTest"
```

Expected: 컴파일 실패 — `Unresolved reference: ImageUploadRepositoryImpl`

- [ ] **Step 3: 도메인 계약을 만든다**

`domain/src/main/java/com/teamyg/parfait/domain/repository/image/ImageUploadRepository.kt`:

```kotlin
package com.teamyg.parfait.domain.repository.image

import com.teamyg.parfait.domain.model.id.ImageId
import com.teamyg.parfait.domain.model.image.ImageType

interface ImageUploadRepository {
    /**
     * 발급·전송·확인 3단계를 하나로 닫는다. 돌려주는 [ImageId] 는 서버에서 확정까지 마친 것이라
     * 곧바로 배치에 쓸 수 있다.
     *
     * 중간에서 실패하면 그 지점의 실패가 그대로 올라오고 **되돌리지 않는다** — 취소 API 가 없어
     * 이미 만들어진 것을 지울 방법이 없다. 다시 부르면 발급부터 전부 다시 탄다.
     *
     * @param filePath 파일 시스템 절대경로다. `file://` uri 가 아니다.
     */
    suspend fun upload(filePath: String, imageType: ImageType): Result<ImageId>
}
```

- [ ] **Step 4: 구현을 만든다**

`data/src/main/java/com/teamyg/parfait/data/repository/image/ImageUploadRepositoryImpl.kt`:

```kotlin
package com.teamyg.parfait.data.repository.image

import com.teamyg.parfait.data.model.error.mapErrorToAppError
import com.teamyg.parfait.data.model.error.toAppError
import com.teamyg.parfait.data.source.image.remote.ImageRemoteDataSource
import com.teamyg.parfait.data.source.image.remote.PresignedUploadDataSource
import com.teamyg.parfait.domain.model.id.ImageId
import com.teamyg.parfait.domain.model.image.ImageType
import com.teamyg.parfait.domain.repository.image.ImageUploadRepository
import java.io.File
import javax.inject.Inject

class ImageUploadRepositoryImpl @Inject constructor(
    private val imageRemoteDataSource: ImageRemoteDataSource,
    private val presignedUploadDataSource: PresignedUploadDataSource,
) : ImageUploadRepository {
    override suspend fun upload(filePath: String, imageType: ImageType): Result<ImageId> {
        val file = File(filePath)
        // 발급 요청과 PUT 헤더가 같은 값을 써야 한다 — 둘 다 S3 서명 대상이고 어긋난 실패는
        // 서버 로그에 남지 않는다. 그래서 여기서 한 번만 정해 양쪽에 넘긴다
        val contentType = contentTypeOf(file) ?: return Result.failure(
            IllegalArgumentException("서버가 받지 않는 확장자다 - ${file.extension}").toAppError(),
        )

        val issued = imageRemoteDataSource
            .issueUploadUrl(fileName = file.name, contentType = contentType, imageType = imageType)
            .getOrElse { return Result.failure(it.toAppError()) }

        presignedUploadDataSource
            .put(uploadUrl = issued.uploadUrl, contentType = contentType, file = file)
            .getOrElse { return Result.failure(it.toAppError()) }

        return imageRemoteDataSource
            .confirmUpload(issued.imageId)
            .map { confirmed -> confirmed.imageId }
            .mapErrorToAppError()
    }

    private fun contentTypeOf(file: File): String? = when (file.extension.lowercase()) {
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        else -> null
    }
}
```

- [ ] **Step 5: DI 바인딩을 더한다**

`RepositoryModule.kt`에 import를 더한다:

```kotlin
import com.teamyg.parfait.data.repository.image.ImageUploadRepositoryImpl
import com.teamyg.parfait.domain.repository.image.ImageUploadRepository
```

인터페이스 본문에 바인딩을 더한다:

```kotlin
    @Binds
    @Singleton
    fun bindImageUploadRepository(
        imageUploadRepositoryImpl: ImageUploadRepositoryImpl,
    ): ImageUploadRepository
```

- [ ] **Step 6: 전체 검증**

```bash
./gradlew :domain:test :data:testDebugUnitTest ktlintCheck :app:assembleDebug
```

Expected: 전부 PASS. `:app:assembleDebug`가 Hilt 그래프까지 확인한다 — `@UploadClient` 제공자가 없거나 바인딩이 빠지면 여기서 깨진다.

- [ ] **Step 7: 커밋**

```bash
git add domain/src/main/java/com/teamyg/parfait/domain/repository/image/ImageUploadRepository.kt \
        data/src/main/java/com/teamyg/parfait/data/repository/image/ImageUploadRepositoryImpl.kt \
        data/src/main/java/com/teamyg/parfait/data/di/RepositoryModule.kt \
        data/src/test/java/com/teamyg/parfait/data/repository/image/ImageUploadRepositoryImplTest.kt
git commit -m "feat(image): 발급·전송·확인을 하나로 닫는 ImageUploadRepository 를 추가한다

contentType 을 한 곳에서 정해 발급 요청과 PUT 헤더가 어긋날 수 없게 한다.
중간 실패는 되돌리지 않는다 — 취소 API 가 없어 지울 방법이 없고, 다시 부르면
발급부터 전부 다시 탄다."
```

---

## 완료 조건

- `./gradlew :domain:test :data:testDebugUnitTest ktlintCheck :app:assembleDebug` 전부 통과
- 신규 테스트 **14건**(Task 1: 3 · Task 2: 5 · Task 3: 6)
- 커밋 3개, push·PR 없음
- 기존 파일 변경은 DI 모듈 셋(`NetworkModule`·`RemoteDataSourceModule`·`RepositoryModule`)뿐이고 **기존 동작은 한 줄도 바뀌지 않는다**

## 이 PR에서 하지 않는 것

- 화면 결선(PR5) · 배치 Repository와 UseCase(PR2) · 토핑 초안(PR3) · 테두리 계약 전환(PR4)
- presigned URL 만료 판정 — 만료는 실패 후 전량 재시도로만 풀린다
- 고아 `PENDING` 이미지·S3 객체 정리 — 서버에 경로가 없다
- 실기기·실서버 확인 — 이 PR에는 소비자가 없어 손으로 밟을 화면이 없다
