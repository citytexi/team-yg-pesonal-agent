---
id: data-network-setup
title: 데이터 모듈 원격 네트워크 기초 구조 (Retrofit · OkHttp Network Setup)
status: implemented
category: behavior-spec
platforms: android
verified: 2026-07-26
related_code: ModuleDataConventionPlugin, PropertySettingManager, DataStoreModule, RepositoryModule, LocalDataSourceModule
related_adr: ADR-0017
related_spec:
related_architecture: data-layer
supersedes:
superseded_by:
tags: [spec, parfait]
---

# Spec: 데이터 모듈 원격 네트워크 기초 구조

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처. 본문은 설계 내용에 집중.

## 목표
`:data` 모듈에 Retrofit·OkHttp·kotlinx-serialization 기반 **원격 네트워크 기초 구조**를 세운다.
`data-layer.md`의 "네트워킹(Assumption)"(의존만 준비, 서비스 미정의)을 실제 구조로 확정한다.
실제 API 연동은 후속 — 이번엔 **인프라 + 재사용 패턴의 예시 1세트**까지만.

## 범위
- **포함**:
  - network용 **컨벤션 플러그인** 신설(`AndroidNetworkConventionPlugin`): `buildConfig` 활성 + `BASE_URL` buildConfigField(properties 로드) + `libs.bundles.network`·serialization 의존 이관.
  - `NetworkModule`(Hilt): `OkHttpClient`·`Retrofit`·예시 `Service` provide. `Json`은 기존 `DataStoreModule` 것 재사용(주입).
  - 공통 응답 envelope `ApiResponse<T>` + `safeApiCall` 헬퍼(→ `Result<T>`).
  - `AuthInterceptor` + `TokenProvider`(빈 stub, 헤더 주입 자리만).
  - 예시 1세트: `TempService` + `TempRequest`/`TempResponse` + `source/temp/remote/TempRemoteDataSource(+Impl)` + `RemoteDataSourceModule`.
  - ADR-0017 신설 + `data-layer.md` 네트워킹 섹션 갱신(같은 PR).
- **제외**:
  - 실제 백엔드 엔드포인트 연동, DTO→도메인 매핑, domain Repository/UseCase 소비.
  - 실제 인증 토큰 소스(로그인/토큰 저장) 연동 — `TokenProvider`는 빈 반환 + TODO.
  - debug/release baseUrl 분기(단일 `defaultConfig` buildConfigField로 시작, 후속 확장).
  - ~~구체 에러 타입 계층~~ — 완료: sealed `ApiException`(`Business`/`Http`/`Network`/`Unknown`) 도입([ADR-0017](../adr/0017-remote-network-datasource.md)).

## 컨벤션 플러그인 (build-logic)
서명 플러그인(`AndroidApplicationSigningConventionPlugin` + `PropertySettingManager`) 패턴을 따른다.

```kotlin
// AndroidNetworkConventionPlugin.kt
class AndroidNetworkConventionPlugin : BaseConventionPlugin({
    with(plugins) {
        apply(libs.plugins.kotlin.serialization.get().pluginId)
    }
    // LibraryExtension(또는 CommonExtension) 대상: buildFeatures.buildConfig = true
    //   defaultConfig.buildConfigField("String", "BASE_URL", "\"${loadBaseUrl()}\"")
    setConfigNetwork(...)   // NetworkConfig.kt
    dependencies {
        implementation(libs.bundles.network)
        implementation(libs.kotlinx.serialization)
    }
})
```
- `NetworkConfig.kt`(`buildlogic/`): `Project.setConfigNetwork(LibraryExtension)` — buildConfig 활성 + `buildConfigField(BASE_URL)`.
- `PropertySettingManager.loadBaseUrl(project, rootProject)`: `findProperty` → `local.properties` 순으로 `YG_BASE_URL` 조회, 누락 시 placeholder(`https://TODO.example.com/`) fallback. 서명 키 로드와 동형.
- 등록: convention `build.gradle.kts` `pluginRegister("android.network", "AndroidNetwork")` + `libs.versions.toml` `parfait-android-network` alias.
- `ModuleDataConventionPlugin`: 기존 `bundles.network`·`kotlinx.serialization`·`kotlin.serialization` 3줄 제거 → `apply(libs.plugins.parfait.android.network.get().pluginId)`로 이관(중복 제거, 관심사 이동).

## API / 인터페이스
```kotlin
// service/model/ApiResponse.kt
@Serializable
data class ApiResponse<T>(
    val code: String,        // 실제 규약 확정 시 조정
    val message: String,
    val data: T?,
)

// network/safeApiCall.kt
suspend fun <T> safeApiCall(block: suspend () -> ApiResponse<T>): Result<T>
//  runCatching { block() } → envelope.code 성공 검사 → data non-null → Result.success(data)
//  실패/예외(HttpException·IOException) → Result.failure

// network/TokenProvider.kt
interface TokenProvider { fun getToken(): String? }          // stub: 항상 null 반환 + TODO

// network/AuthInterceptor.kt
class AuthInterceptor @Inject constructor(
    private val tokenProvider: TokenProvider,
) : Interceptor                                                // token 있으면 Authorization 헤더 주입

// service/TempService.kt
interface TempService {
    @GET("temp/{id}")
    suspend fun getTemp(@Path("id") id: String): ApiResponse<TempResponse>
}

// source/temp/remote/TempRemoteDataSource.kt
interface TempRemoteDataSource {
    suspend fun getTemp(id: String): Result<TempResponse>
}
```

## 동작 / 데이터 흐름
`RemoteDataSourceImpl` → `ExampleService`(suspend, `ApiResponse<T>` 반환) → `safeApiCall { }`로 감쌈:
- 정상 2xx + envelope 성공 코드 + `data != null` → `Result.success(data)`.
- `HttpException`(4xx/5xx)·`IOException`(네트워크)·envelope 실패 코드·`data == null` → `Result.failure`.

`NetworkModule`(`@InstallIn(SingletonComponent)`, `object`):
- `provideOkHttpClient(authInterceptor)` — `HttpLoggingInterceptor(BODY)` + `AuthInterceptor` + 타임아웃.
- `provideRetrofit(okHttp, json)` — `BuildConfig.BASE_URL` + `json.asConverterFactory(...)`. `json`은 기존 `provideDataStoreJsonParser()` 싱글톤 주입(중복 `@Provides Json` 금지).
- `provideTempService(retrofit)` — `retrofit.create()`.

`RemoteDataSourceModule`(`interface`, `@Binds`): `TempRemoteDataSourceImpl` → `TempRemoteDataSource`.

## 파일 구성
| 파일 | 역할 |
|------|------|
| `build-logic/.../AndroidNetworkConventionPlugin.kt` | network 컨벤션 플러그인 |
| `build-logic/.../buildlogic/NetworkConfig.kt` | `setConfigNetwork`(buildConfig + buildConfigField) |
| `build-logic/.../buildlogic/utils/PropertySettingManager.kt` | `loadBaseUrl()` 추가 |
| `build-logic/convention/build.gradle.kts` | `pluginRegister("android.network", ...)` |
| `gradle/libs.versions.toml` | `parfait-android-network` plugin alias |
| `data/.../di/NetworkModule.kt` | OkHttp·Retrofit·TempService provide |
| `data/.../di/RemoteDataSourceModule.kt` | remote DataSource `@Binds` |
| `data/.../network/AuthInterceptor.kt` | 토큰 헤더 주입 자리 |
| `data/.../network/TokenProvider.kt` | 토큰 소스 인터페이스 + 빈 stub |
| `data/.../network/safeApiCall.kt` | `ApiResponse` → `Result` 매핑 |
| `data/.../service/TempService.kt` | 예시 Retrofit 서비스 |
| `data/.../service/model/ApiResponse.kt` | 공통 응답 envelope |
| `data/.../service/model/TempResponse.kt`·`TempRequest.kt` | 예시 DTO |
| `data/.../source/temp/remote/TempRemoteDataSource.kt`·`...Impl.kt` | 예시 remote DataSource |

## 주의 / 열린 질문
- **예시 도메인 이름**: `temp`로 스캐폴딩(실제 첫 도메인 확정 전 임시 placeholder). 실제 API 시 교체·삭제.
- `TokenProvider` stub 바인딩 위치(`RemoteDataSourceModule` 또는 별도) — 구현 시 확정.
- envelope `code` 성공 판정 규칙은 실제 백엔드 규약 확정 후 조정 → open-questions 연동 가능.
- debug/release baseUrl 분기·구체 에러 타입은 후속 ADR/스펙.
