---
id: data-layer
title: 데이터 레이어 (Repository · DataSource · DI)
category: architecture
status: living
platforms: android
verified: 2026-07-26
related_spec: data-network-setup
related_adr: ADR-0001, ADR-0004, ADR-0008, ADR-0009, ADR-0011, ADR-0012, ADR-0017
related_architecture: state-management
related_code: RecentImageRepository, ImageSegmentationRepository, RepositoryModule
tags: [architecture, parfait]
---
# 데이터 레이어 (Repository · DataSource · DI)

도메인 인터페이스와 데이터 구현의 분리, 로컬 영속화 흐름. 결정 근거는 [[0001-layered-multi-module]]·[[0004-hilt-ksp-di]]·[[0008-datastore-local-persistence]].

> 근거는 파일명+심볼명으로만.

## 레이어 배치
- **domain** — Repository **인터페이스**(예: `RecentImageRepository`, `GalleryRepository`, `CameraCacheFileRepository`, `ImageSegmentationRepository`) + UseCase([[0009-usecase-injectable-invoke]]) + 도메인 모델(`InviteCodeResult`, `GalleryImageGroup`, `KakaoLoginResult`, `DayWindow`, `SegmentationResult`) + 도메인 예외(sealed `SegmentationException`).
- **data** — Repository **구현**(예: `RecentImageRepositoryImpl`, `ImageSegmentationRepositoryImpl`), DataSource, DI 모듈.

## DataSource 종류
- **파일 기반** — `FileRecentImageLocalDataSource`, `FileCameraCacheLocalDataSource`(내부 저장소 이미지 I/O).
- **DataStore 기반** — `RecentImageLocalDataSource`(메타데이터), `RecentImageEditor`(`data/datastore/`, DataStore 접근 추상화 — 단일 키 `get()`/`set()` 동기 인터페이스로, suspend/flow가 아님).
- **시스템 미디어** — `GalleryMediaProvider`(시스템 갤러리 접근).

## DI 모듈 (data, `@InstallIn(SingletonComponent::class)`)
| 모듈 | 제공/바인딩 |
|------|-------------|
| `RepositoryModule` | Repository 인터페이스 ↔ 구현 `@Binds @Singleton` |
| `LocalDataSourceModule` | LocalDataSource 인터페이스 ↔ 구현 |
| `DataStoreModule` | `DataStore<Preferences>` 싱글톤, JSON 파서(`ignoreUnknownKeys`·`coerceInputValues`·`encodeDefaults`) |
| `SingletonInjectModule` | 기타 앱 전역 싱글톤 |

## 예: 최근 이미지
`RecentImageRepositoryImpl`이 `RecentImageLocalDataSource`(DataStore, URI 메타)와 `FileRecentImageLocalDataSource`(파일 저장)를 조합. 파일 last-modified로 캐시 축출, `DayWindow`로 날짜 윈도잉.

## 예: 이미지 세그멘테이션(누끼)
`ImageSegmentationRepositoryImpl`이 온디바이스 ML Kit Subject Segmentation으로 전경을 분리([[0012-mlkit-subject-segmentation]]). `contentResolver.decodeUriToBitmap`로 URI→비트맵 디코딩, 결과 비트맵은 `BitmapWrapper`([[0011-cross-module-bitmap-abstraction]])로 도메인에 전달, subject 이미지는 `cacheDir` PNG 파일로 저장해 경로(`subjectImagePath`) 반환. 실패는 `Result<SegmentationResult>` + `SegmentationException`. 소비는 `DecodeImageUseCase`·`SegmentImageUseCase`.

## 신규 데이터 추가 체크리스트
1. **domain**: Repository 인터페이스 + 필요한 도메인 모델 정의.
2. **data**: 구현 클래스 + DataSource(파일/DataStore/원격) 작성. 원격은 `source.<도메인>.remote`
   패키지에 인터페이스+`Impl` 쌍(예: `TempRemoteDataSource`/`TempRemoteDataSourceImpl`,
   [[0017-remote-network-datasource]]).
3. **DI**: `RepositoryModule`/`LocalDataSourceModule`에 `@Binds` 등록.
4. 소비: **UseCase**를 통해 노출, ViewModel은 UseCase만 호출([[state-management]]).
5. 반응형이면 `Flow`로 반환.

## 네트워킹
원격 연동 기초 구조가 확정됐다([[0017-remote-network-datasource]]). 실제 도메인 API 연동·DTO→도메인
매핑은 후속.

- **컨벤션 플러그인**: `AndroidNetworkConventionPlugin`(적용 모듈에 `buildConfig` 활성 +
  `BuildConfig.BASE_URL` 부여, `NetworkConfig`의 `setConfigNetwork` + `PropertySettingManager`의
  `loadBaseUrl`이 properties/`local.properties`(`YG_BASE_URL`)에서 값을 로드). `libs.bundles.network`·
  kotlinx-serialization 의존을 이 플러그인이 부여(`ModuleDataConventionPlugin`에서 이관됨).
- **DI(`NetworkModule`, `@InstallIn(SingletonComponent::class)`)**: `provideTokenProvider`
  (=`EmptyTokenProvider`)·`provideAuthInterceptor`·`provideOkHttpClient`·`provideRemoteJson`·
  `provideRetrofit`·`provideTempService`를 제공. `Json`은 용도별 `@Qualifier`로 분리 — 로컬(DataStore)
  `@LocalJson`(`DataStoreModule`), 원격(Retrofit) `@RemoteJson`(`NetworkModule.provideRemoteJson`).
  한정자는 `model/qualifier` 패키지. 같은 타입이어도 한정자로 구분돼 중복 바인딩이 아니며, 설정을 용도별로
  독립 조정 가능(현재 두 설정은 동일).
- **응답 계약**: 공통 `ApiResponse<T>`(`code`/`message`/`data`, `@Serializable`, `isSuccess`) +
  `safeApiCall`(함수)이 서비스 응답을 `Result<T>`로 변환. 실패는 sealed `ApiException`
  (`Business`/`Http`/`Network`/`Unknown`)으로 분류하고 `CancellationException`은 재던진다(취소 전파 보존).
- **인증**: `AuthInterceptor` + `TokenProvider`(인터페이스, stub `EmptyTokenProvider`)가
  `Authorization: Bearer` 헤더 주입 자리를 제공. 실제 토큰 소스 연동은 후속.
- **로깅**: `HttpLoggingInterceptor` 레벨은 `BuildConfig.DEBUG`로 게이팅(debug=`BODY`,
  release=`NONE`) — release에서 토큰·바디 노출 방지.
- **예시 1세트**: `TempService` + `TempRequest`/`TempResponse` + `source.temp.remote`의
  `TempRemoteDataSource`(+`Impl`) + `RemoteDataSourceModule`(`@Binds`). 실제 도메인 확정 전
  placeholder — 신규 원격 DataSource는 이 세트를 복제해 `source.<도메인>.remote`에 배치.
