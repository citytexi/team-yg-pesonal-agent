---
id: data-layer
title: 데이터 레이어 (Repository · DataSource · DI)
category: architecture
status: living
platforms: android
verified: 2026-08-14
related_spec: data-network-setup, network-envelope-token-storage, data-api-service-layer, image-api-service-layer, member-parfait-image-api-service-layer
related_adr: ADR-0001, ADR-0004, ADR-0008, ADR-0009, ADR-0011, ADR-0012, ADR-0017, ADR-0019, ADR-0020
related_architecture: state-management
related_code: RecentImageRepository, ImageSegmentationRepository, JsonModule, NetworkModule, PolicyRemoteDataSource, ApiCaller, EncryptedTokenStore, AuthService, ParfaitGroupService, AuthRemoteDataSource, ImageService, MemberService, ParfaitImageService, ParfaitImageRemoteDataSource, AuthRepository, AuthRepositoryImpl, AppError, AppErrorMapper, runSuspendCatching
tags: [architecture, parfait]
---
# 데이터 레이어 (Repository · DataSource · DI)

도메인 인터페이스와 데이터 구현의 분리, 로컬 영속화 흐름. 결정 근거는 [[0001-layered-multi-module]]·[[0004-hilt-ksp-di]]·[[0008-datastore-local-persistence]].

> 근거는 파일명+심볼명으로만.

## 레이어 배치
- **domain** — Repository **인터페이스**(예: `RecentImageRepository`, `GalleryRepository`, `CameraCacheFileRepository`, `ImageSegmentationRepository`) + UseCase([[0009-usecase-injectable-invoke]]) + 도메인 모델(`InviteCodeResult`, `GalleryImageGroup`, `KakaoLoginResult`, `DayWindow`, `SegmentationResult`, 원격 예시 `PolicyVO`) + 도메인 예외(sealed `SegmentationException`).
  - `domain/model/`은 **루트 평면 선언과 도메인 하위 패키지가 섞여 있다** — 원격 API 라운드가 추가한 VO·value class만 하위 패키지로 들어갔고(PR #197의 `auth/`·`group/`·`id/`·`policy/`에 PR #230이 `image/`·`member/`·`topping/`을 더했다), 그 이전 선언 8개는 루트에 남았다. 하위 패키지가 넷에서 일곱이 되며 **비율은 더 기울었는데 규약은 여전히 없다** — 어디에 새 모델을 둘지 매번 판단해야 하는 상태 → [open-questions](../synthesis/open-questions.md).
- **data** — Repository **구현**(예: `RecentImageRepositoryImpl`, `ImageSegmentationRepositoryImpl`), DataSource, DI 모듈.

## DataSource 종류
- **파일 기반** — `FileRecentImageLocalDataSource`, `FileCameraCacheLocalDataSource`(내부 저장소 이미지 I/O).
- **DataStore 기반** — `RecentImageLocalDataSource`(메타데이터), `RecentImageEditor`(`data/datastore/`, DataStore 접근 추상화 — 단일 키 `get()`/`set()` 동기 인터페이스로, suspend/flow가 아님).
- **시스템 미디어** — `GalleryMediaProvider`(시스템 갤러리 접근).

> **표시 포맷은 data가 만들지 않는다**(2026-08-04, PR #191) — `GalleryImageGroup.date`가 문자열에서
> `LocalDate`로 바뀌고 `GalleryMediaProvider`의 날짜 포맷이 삭제됐다. 포맷은 화면이
> `core:util:jvm` `DateTextFormat`으로 만든다. 날짜 그룹 키의 하루 경계는 `DayWindow`(도메인 모델) 소관.

## DI 모듈 (data, `@InstallIn(SingletonComponent::class)`)
`di/` **평면 배치, 역할당 파일 1개**(하위 패키지 없음). 도메인이 늘면 해당 역할 파일에 바인딩을
추가한다 — 도메인별 분할은 기각([[0017-remote-network-datasource]] 대안 E).

| 모듈 | 제공/바인딩 |
|------|-------------|
| `RepositoryModule` | Repository 인터페이스 ↔ 구현 `@Binds @Singleton`(camera·gallery·image·auth) + `NonceGenerator`. `@Binds`는 `interface` 모듈에만 되므로 `object`인 `SingletonInjectModule` 대신 여기 모은다 |
| `LocalDataSourceModule` | 로컬 DataSource 인터페이스 ↔ 구현(파일·DataStore·`TokenStore` ↔ `EncryptedTokenStore`) |
| `RemoteDataSourceModule` | 원격 DataSource 인터페이스 ↔ 구현 |
| `ServiceModule` | Retrofit 서비스 생성(`retrofit.create`) |
| `NetworkModule` | `TokenProvider`(=`TokenStoreTokenProvider`)·`AuthInterceptor`·`OkHttpClient`·`Retrofit` |
| `DataStoreModule` | `DataStore<Preferences>` 싱글톤 |
| `JsonModule` | `@LocalJson`·`@RemoteJson` `Json` 2종(현재 설정 동일: `ignoreUnknownKeys`·`coerceInputValues`·`encodeDefaults`) |
| `SingletonInjectModule` | 기타 앱 전역 싱글톤 |

## 예: 최근 이미지
`RecentImageRepositoryImpl`이 `RecentImageLocalDataSource`(DataStore, URI 메타)와 `FileRecentImageLocalDataSource`(파일 저장)를 조합. 파일 last-modified로 캐시 축출, `DayWindow`로 날짜 윈도잉.

## 예: 이미지 세그멘테이션(누끼)
`ImageSegmentationRepositoryImpl`이 온디바이스 ML Kit Subject Segmentation으로 전경을 분리([[0012-mlkit-subject-segmentation]]). `contentResolver.decodeUriToBitmap`로 URI→비트맵 디코딩, 결과 비트맵은 `BitmapWrapper`([[0011-cross-module-bitmap-abstraction]])로 도메인에 전달, subject 이미지는 `cacheDir` PNG 파일로 저장해 경로(`subjectImagePath`) 반환. 실패는 `Result<SegmentationResult>` + `SegmentationException`. 소비는 `DecodeImageUseCase`·`SegmentImageUseCase`.

## 실패는 Repository 경계에서 도메인 타입이 된다

`:data`의 `ApiException`은 `:domain`·feature에서 보이지 않는다(모듈 그래프가 강제한다 — feature
impl 컨벤션 플러그인이 주는 것은 `:domain`뿐이다). 그래서 **Repository 구현이 경계에서**
`AppError`(`domain/model/error/AppError.kt`)로 바꿔 넘긴다.

| ApiException | AppError |
|---|---|
| `Business` | `Server(code, statusCode, serverMessage)` |
| `Network` | `Network` |
| `Http`·`EmptyBody`·`Unknown` | `Unexpected` |

`AppError`는 `Exception` 하위 sealed class다 — `Result.failure`가 `Throwable`을 요구해 기존
`Result<T>` 관용구를 그대로 쓰기 위한 제약이다. 변환은 `data/model/error/AppErrorMapper.kt`의
`internal fun Throwable.toAppError()`·`Result<T>.mapErrorToAppError()`이고, `CancellationException`은
변환하지 않고 **재던진다**. 갈래가 셋인 이유·`code`가 String인 이유는
[ADR-0020](../adr/0020-mvi-error-effect-infrastructure.md).

서버 에러 코드 문자열은 `:domain`의 `ServerErrorCode`(도메인별 중첩 object)가 소유한다. 코드
문자열은 도메인 간 유일하지 않으므로(`MEMBER_NOT_FOUND`가 인증 401 / 그룹·이미지·회원 404)
`statusCode`와 함께 본다. **앱이 실제로 분기에 쓰는 코드만** 둔다.

## suspend 를 감싸는 runCatching 은 `runSuspendCatching`

stdlib `runCatching`은 `CancellationException`까지 잡아 `Result.failure`로 만든다. 블록 안에
suspend 호출이 있으면 **취소가 실패로 둔갑한다** — 화면을 벗어났을 뿐인데 호출부는 "작업 실패"로
분기한다. `core:util:jvm`의 `coroutines/RunSuspendCatching.kt`가 취소만 걸러 재던진다.

실제로 물었던 자리가 `EncryptedTokenStore.read`다 — DataStore를 기다리다 취소되면 `null`이
반환돼 호출부(`TokenStoreTokenProvider`)가 **"토큰 없음", 즉 로그아웃 상태로 읽었다.**
회귀 테스트(`EncryptedTokenStoreTest`)로 잠갔다.

**블록에 suspend 호출이 없으면 stdlib `runCatching`을 쓴다.** 바꾸면 "여기 취소 위험이 있다"는
거짓 신호만 남는다. `ApiCaller.runCatchingApi`도 제외 — 이미 명시적으로 재던지고 예외를
타입별로 분류해 `ApiException`을 만들어야 해서, `Result`에 raw `Throwable`을 담는 이 유틸로는
그 분류가 사라진다.

## 신규 데이터 추가 체크리스트
1. **domain**: Repository 인터페이스 + 필요한 도메인 모델 정의.
2. **data**: 구현 클래스 + DataSource(파일/DataStore/원격) 작성. 원격은 `source.<도메인>.remote`
   패키지에 인터페이스+`Impl` 쌍(예: `PolicyRemoteDataSource`/`PolicyRemoteDataSourceImpl`,
   [[0017-remote-network-datasource]]) — 반환 타입은 **도메인 모델**, 서버 응답은
   `source.<도메인>.mapper`의 확장 함수로 변환. `Impl`은 **`ApiCaller`를 생성자로 주입**받아 서비스
   호출을 감싼다(`@Inject constructor(service: XxxService, private val apiCaller: ApiCaller)`) —
   top-level `safeApiCall` import는 더 이상 없다. 아래 "네트워킹 → 응답 계약"의 진입점 4개 중 응답
   형태에 맞는 것을 고른다 — 응답을 도메인 모델로 매핑해야 한다면 `safeApiCall(block, transform)`을
   써서 매핑을 같은 가드 안에 둔다(아래 참고). 인증이 불필요한 엔드포인트라면 서비스 인터페이스
   메서드에 `@NoAuth`를 붙인다(아래 "네트워킹 → 인증").
3. **DI**: 역할에 맞는 기존 모듈(`RepositoryModule`·`LocalDataSourceModule`·`RemoteDataSourceModule`)에
   `@Binds` 추가. 새 파일을 만들지 않는다.
4. 소비: **UseCase**를 통해 노출, ViewModel은 UseCase만 호출([[state-management]]).
5. 반응형이면 `Flow`로 반환.

## 네트워킹
> **develop 반영 범위(2026-08-12 기준)** — 기초 구조(PR #174) + 서버 계약 정합·토큰 저장
> (`network-envelope-token-storage`, PR #190) + API 표면 14(`data-api-service-layer`, PR #197) +
> **image·member·parfait-image 6**(`image-api-service-layer`·`member-parfait-image-api-service-layer`,
> **PR #230 머지 완료**)까지 들어와 있다
> ([[0017-remote-network-datasource]]·[[0019-encrypted-token-storage]]).
> 아래 서술은 전부 develop 코드 기준이다 — `ApiCaller` 진입점 넷, **Service 7개**
> (`AuthService`·`PolicyService`·`ParfaitGroupService`·`ParfaitService`·`ImageService`·`MemberService`·
> `ParfaitImageService`, **20 엔드포인트**), **remote DataSource 7쌍**, `Temp*` 예시 세트 삭제.
> 이로써 **Android가 쓰기로 한 서버 엔드포인트 전량을 덮는다**(서버 21 − 애플 로그인 1) →
> [api/README.md](../api/README.md).
> **2026-08-14 갱신 — 첫 소비처가 생겼다**(브랜치 `feature/mvi-error-infra-a002-login`, develop
> 미머지). `AuthRepository`/`AuthRepositoryImpl` + `LoginWithKakaoUseCase`가 A-002 카카오 로그인을
> 결선했다 → [a002-kakao-login-api](../specs/2026-08-13-a002-kakao-login-api.md).
> 나머지 6 도메인은 여전히 Repository·UseCase 0건이다. **실서버 요청은 아직 0건**(실기기 검증
> 미수행) → [open-questions](../synthesis/open-questions.md).

원격 연동 기초 구조와 서버 계약 정합이 확정됐다([[0017-remote-network-datasource]]). 응답→도메인
매핑 지점도 확정(아래 "응답 매핑"). 실제 백엔드 엔드포인트 연동·Repository/UseCase 소비는 후속.

- **컨벤션 플러그인**: `AndroidNetworkConventionPlugin`(적용 모듈에 `buildConfig` 활성 +
  `BuildConfig.BASE_URL` 부여, `NetworkConfig`의 `setConfigNetwork` + `PropertySettingManager`의
  `loadBaseUrl`이 properties/`local.properties`(`YG_BASE_URL`)에서 값을 로드). `libs.bundles.network`·
  kotlinx-serialization 의존을 이 플러그인이 부여(`ModuleDataConventionPlugin`에서 이관됨).
- **DI(`NetworkModule`, `@InstallIn(SingletonComponent::class)`)**: `provideTokenProvider`
  (=`TokenStoreTokenProvider`)·`provideAuthInterceptor`·`provideOkHttpClient`·`provideRetrofit`를 제공.
  Retrofit 서비스 생성은 `ServiceModule`(예: `providePolicyService`) 소관.
  `Json`은 용도별 `@Qualifier`로 분리 — 로컬(DataStore) `@LocalJson`, 원격(Retrofit) `@RemoteJson`,
  둘 다 `JsonModule` 제공. 한정자는 `model/qualifier` 패키지. 같은 타입이어도 한정자로 구분돼 중복
  바인딩이 아니며, 설정을 용도별로 독립 조정 가능(현재 두 설정은 동일).
- **응답 계약**: 공통 `ApiResponse<T>`(`success`/`code`/`message`/`data`/`errorDetail`,
  `@Serializable`)를 서버 envelope와 필드 단위로 맞췄다. 성공 판정은 **`success` 필드**를 그대로 쓴다
  (서버가 성공 코드를 `"OK"`·`"CREATED"` 2종으로 써서 단일 코드 상수 비교가 불가능했다 — 구 `isSuccess`
  프로퍼티는 제거). `network/ApiCaller.kt`(`@Singleton class ApiCaller @Inject constructor(@RemoteJson json: Json)`)가
  서비스 응답을 `Result<T>`로 변환하고, 진입점은 **넷**이다.

  | 메서드 | 서버 응답 | 언제 |
  |---|---|---|
  | `safeApiCall(block)` | envelope + `data` 필요 | payload를 그대로(도메인 모델 변환 없이) 쓰는 조회·생성 API |
  | `safeApiCall(block, transform)` | envelope + `data` 필요 + 도메인 모델로 매핑 | payload가 있고 VO로 변환해야 하는 API — 지금 있는 매핑 호출부 전부가 이 오버로드를 쓴다 |
  | `safeApiCallWithoutData` | envelope, `data` 안 봄 | 본문은 `ApiResponse<Unit>`이지만 payload가 의미 없는 API |
  | `safeApiCallNoContent` | 본문 자체가 없음(204) | 서비스 메서드가 `Unit` 반환(예: `logout`) |

  네 메서드 모두 `HttpException`을 잡아 에러 envelope 파싱을 시도한다(`toApiException`) — 실패는
  sealed `ApiException`(`Business`/`EmptyBody`/`Http`/`Network`/`Unknown`, `model/exception` 패키지)으로
  분류하고 `CancellationException`은 재던진다(취소 전파 보존).

  **`safeApiCall(block, transform)`이 따로 있는 이유**: 응답을 VO로 매핑해야 할 때 `safeApiCall(block)`이
  반환한 `Result<T>`에 `kotlin.Result.map { }`으로 매핑을 잇는 방식은 함정이 있다 — `Result.map`은
  매핑 람다가 던진 예외를 **삼키지 않고 그대로 rethrow**한다. 즉 매핑이 `ApiCaller`의 `try`/`catch`
  가드 **밖**에서 실행되는 셈이라, 매퍼가 실패하면 `Result` 계약을 벗어나 호출부가 그대로 크래시한다.
  `safeApiCall(block, transform)`은 호출과 매핑을 같은 `try`/`catch` 안에서 실행해 이 경로를 막는다 —
  매퍼가 던지면 다른 실패와 동일하게 `ApiException.Unknown`으로 `Result.failure`가 된다. 새 원격
  DataSource가 응답을 VO로 바꿔야 한다면 `safeApiCall(block)` + `.map { }` 조합을 다시 들여오지 말고
  이 오버로드를 쓴다.
- **패키지 배치(data)**: 서버 타입은 `service/model/request/`·`service/model/response/`로 나눈다
  (`ApiResponse`·`PolicyResponse`=response, `KakaoLoginRequest`=request 예시). 인프라는 `network/`
  (`ApiCaller`·`AuthInterceptor`·`TokenProvider`·`TokenStoreTokenProvider` — 인터페이스와 구현은 파일 분리),
  모듈 전역 타입은 `model/`(`exception/`·`qualifier/`). 토큰 저장소는 `source/token/local/`
  (`TokenStore`·`EncryptedTokenStore`), 암복호화는 `security/`(`CryptoManager`).
  **선언당 파일 하나**가 DTO·도메인 값 객체(VO/value class) 전반의 표준 규약이다 — 파일명은 선언명과
  동일(`KakaoLoginRequest`→`KakaoLoginRequest.kt`). 도메인별로 여러 선언을 한 파일에 묶어두면(예:
  구 `AuthResponses.kt`) ktlint `standard:filename`이 걸리지 않는다 — 이 규칙은 **단일 top-level 선언
  파일에만** 강제되므로, 묶어두는 순간 파일명 검사를 조용히 피해간다. 새 DTO·VO를 추가할 때 기존
  그룹 파일에 얹지 말고 새 파일을 만든다.
  **요청/응답 DTO 프로퍼티는 전부 `@SerialName`을 명시**한다 — 키가 Kotlin 프로퍼티명과 같아도 예외
  없이 붙인다. 목적은 Kotlin 쪽 리네임이 와이어 계약을 조용히 옮기지 못하게 고정하는 것이다(리네임
  시 직렬화 키가 프로퍼티를 따라가 버리면 서버와 어긋나도 컴파일·lint 어디서도 안 잡힌다). 키와
  프로퍼티명이 실제로 다른 유일한 예외는 `KakaoLoginResponse.isNewUser` → `@SerialName("newUser")`
  (서버 Jackson이 getter의 `is` 접두사를 떼고 직렬화한다, [auth.md](../api/auth.md) 참고).
- **에러 타입 계층**: sealed `ApiException`의 `Business(code, serverMessage, statusCode: Int?, errorDetail)`가
  HTTP 4xx/5xx로 오는 서버 에러를 담는다. `code` 문자열이 에러 코드 enum 간 유일하지 않아서(예:
  `MEMBER_NOT_FOUND`가 401·404 둘 다로 쓰임) `statusCode`를 함께 본다. `statusCode`는 nullable —
  `HttpException` 경유(대부분의 실패)는 채워지고, 2xx인데 `success=false`인 경로(서버에 아직 없음)는
  `null`이다.
- **인증**: `AuthInterceptor` + `TokenProvider`(인터페이스, 구현 `TokenStoreTokenProvider`)가
  `Authorization: Bearer` 헤더를 주입한다. `AuthInterceptor`는 시그니처 변경 없이 동기 `TokenProvider`를
  그대로 소비 — `TokenStoreTokenProvider.getToken()`이 `runBlocking { tokenStore.getAccessToken() }`으로
  suspend 경계를 넘는다(OkHttp dispatcher 스레드에서 실행돼 메인 스레드는 막지 않음). 상세는
  [[0019-encrypted-token-storage]]. 인증이 불필요한 엔드포인트(서버 화이트리스트 경로)는 서비스
  메서드에 `@NoAuth`(`network/NoAuth.kt`)를 붙인다 — `AuthInterceptor`가 Retrofit `Invocation` 태그로
  어노테이션 존재를 확인한다. **판정 후에도 토큰 조회는 그대로 수행하고, 헤더 부착만 건너뛴다**
  (PR #190 코드 리뷰 반영으로 early return이 제거됐다) — 화이트리스트 경로에서도 `runBlocking` +
  DataStore 읽기 + Keystore 복호화 비용이 든다. 근거는 [[0017-remote-network-datasource]] "인증".
  `@NoAuth`가 붙는 곳은 서버 화이트리스트 4경로(`postAuthKakao`·`postAuthSignup`·`postAuthReissue`·
  `getPolicies`)다. R8 keep 규칙은 **`data/consumer-rules.pro`**에 두고 컨벤션 플러그인
  `setConfigAndroidLibrary`가 `consumerProguardFiles("consumer-rules.pro")`로 등록한다(PR #197) —
  라이브러리 모듈의 `proguardFiles`는 앱의 R8 실행에 전달되지 않으므로 이 자리가 유일하게 유효하다.
  근거는 같은 ADR "인증"의 R8 절.
- **토큰 저장 경로**: `CryptoManager`(Android Keystore AES/GCM, `security/`) → `EncryptedTokenStore`
  (`TokenStore` 구현, `source/token/local/`, `DataStore<Preferences>`에 `IV+암호문` Base64 문자열 저장) →
  `TokenStore`(`LocalDataSourceModule.bindTokenStore`) → `TokenStoreTokenProvider`
  (`NetworkModule.provideTokenProvider`) → `AuthInterceptor`. 복호화 실패(키 유실) 시
  `EncryptedTokenStore`가 예외를 삼키고 `clear()` 후 `null`을 반환 — 재로그인 유도. 근거·대안은
  [[0019-encrypted-token-storage]]. as-built 기준 `read()`의 `runCatching` 범위는 복호화만이 아니라
  **DataStore 읽기까지 포함**하고, 복구 경로의 `clear()`도 다시 `runCatching`으로 감싼다 — 즉 키 유실뿐
  아니라 저장소 I/O 실패도 토큰 삭제로 이어지고, 삭제 자체가 실패해도 `null` 반환은 보장된다.
- **로깅**: `HttpLoggingInterceptor` 레벨은 `BuildConfig.DEBUG`로 게이팅(debug=`BODY`,
  release=`NONE`) — release에서 토큰·바디 노출 방지. 추가로 `redactHeader("Authorization")`를 걸어
  debug 빌드에서도 헤더 값을 가린다. **바디는 redact 대상이 아니다** — `reissue`·`logout` 요청 바디의
  refresh token은 debug logcat에 평문으로 남는다 → [open-questions](../synthesis/open-questions.md).
- **응답 매핑**: 원격 DataSource는 **도메인 모델을 반환**한다(`PolicyRemoteDataSource.getPolicies():
  Result<List<PolicyVO>>`). 서버 응답 타입(`service.model.response`의 `PolicyResponse`/
  `PolicyItemResponse`)은 data 안에서만 살고, `source.<도메인>.mapper`의 `internal` 확장 함수
  (`PolicyItemResponse.toPolicyVO()`, 파일 `VOMapper.kt`)가 경계에서 변환한다. 변환은
  `ApiCaller#safeApiCall(block, transform)`의 `transform` 인자로 걸어 호출과 같은 가드 안에서
  실행한다(위 "네트워킹 → 응답 계약" 참고) — `.map { }`으로 밖에서 잇지 않는다. data 전용 중간 모델
  (구 `model.dto`)은 두지 않는다 — Response 복제본이라 변환 단계만 늘기 때문. 접미사 규약(`…VO` vs
  기존 무접미사)은 미결 → [open-questions](../synthesis/open-questions.md).

  **매퍼는 단독 테스트하지 않는다(2026-08-11 규약).** 매퍼의 유일한 호출자가 DataSource라
  `XxxRemoteDataSourceImplTest`가 이미 매퍼를 통과시킨다 — 별도 `XxxVOMapperTest`는 같은 것을 두 번
  검증한다. 판단이 든 변환(문자열→enum 매핑과 미지 값 폴백, nullable 처리, 기본값, 단위 변환, 같은
  타입 필드의 배선)은 **DataSource 테스트의 케이스로** 잠근다. 규약 본문과 개정 경위는
  [unit-test-infrastructure 스펙](../specs/archive/2026-08-06-unit-test-infrastructure.md) "테스트 규약" 11번.
  develop의 `data` 유닛 테스트는 `XxxRemoteDataSourceImplTest` 4건 + `ApiCallerTest`·`AuthInterceptorTest`이고
  **`*VOMapperTest`는 0건**이다(PR #230이 `PolicyVOMapperTest`·`ImageVOMapperTest`를 케이스 이관 후 삭제).
- **요청 방향 변환도 같은 `VOMapper.kt`에 둔다.** 응답만 매퍼를 거치는 것이 아니다 — domain 타입이
  wire 형태보다 좁을 때 펴는 일도 매퍼가 한다. 선례는 `source.parfaitimage.mapper`의
  `ToppingTransform.toPlaceRequest(imageId, border)`로, sealed `ToppingBorder`(`None`/`Solid(color, width)`)를
  서버가 받는 평면 3필드(`borderType`·`borderColor`·`borderWidth`)로 편다. **DTO에는 sealed·value class·enum을
  넣지 않는다**는 규약이 그대로라(계약 문서와 눈으로 대조돼야 한다) 좁히는 쪽은 domain, 펴는 쪽은 매퍼다.
  domain을 좁게 잡는 기준은 **필드 사이에 의존이 있을 때**다 — `borderType = SOLID`면 색·두께가 필수라는
  서버 제약이 sealed로 표현 불가능한 상태가 되고, `ToppingTransform`은 `Double` 넷 연속의 순서 사고를 막는다
  ([api/parfait-image.md](../api/parfait-image.md)).
- **예시 1세트**: 참조 예시는 이제 **실제 도메인**이다(placeholder 아님) — `PolicyService` +
  `PolicyResponse`/`PolicyItemResponse`(요청 DTO 없음, 파라미터 없는 GET) + `domain.model.policy.PolicyVO`
  + `source.policy.mapper`(`VOMapper.kt`) + `source.policy.remote`의 `PolicyRemoteDataSource`(+`Impl`,
  `ApiCaller` 생성자 주입) + `RemoteDataSourceModule`(`@Binds`) + `ServiceModule`. service → DTO →
  mapper → DataSource로 이어지는 가장 작은 end-to-end 세트라 새 원격 DataSource를 붙일 때 이 흐름을
  그대로 따라 하면 된다. sealed VO로 응답을 분기해야 하는 경우(예: 판별자 필드로 두 가지 결과 중
  하나를 고르는 응답)의 참고 예시는 `source.auth.mapper`의 `KakaoLoginResponse.toKakaoLoginVO()`다 —
  `KakaoLoginVO`(sealed `ExistingMember`/`NewUser`)로 매핑한다([auth.md](../api/auth.md) 참고).
