---
id: data-layer
title: 데이터 레이어 (Repository · DataSource · DI)
category: architecture
status: living
platforms: android
verified: 2026-07-30
related_spec: data-network-setup
related_adr: ADR-0001, ADR-0004, ADR-0008, ADR-0009, ADR-0011, ADR-0012, ADR-0017
related_architecture: state-management
related_code: RecentImageRepository, ImageSegmentationRepository, JsonModule, NetworkModule, TempRemoteDataSource
tags: [architecture, parfait]
---
# 데이터 레이어 (Repository · DataSource · DI)

도메인 인터페이스와 데이터 구현의 분리, 로컬 영속화 흐름. 결정 근거는 [[0001-layered-multi-module]]·[[0004-hilt-ksp-di]]·[[0008-datastore-local-persistence]].

> 근거는 파일명+심볼명으로만.

## 레이어 배치
- **domain** — Repository **인터페이스**(예: `RecentImageRepository`, `GalleryRepository`, `CameraCacheFileRepository`, `ImageSegmentationRepository`) + UseCase([[0009-usecase-injectable-invoke]]) + 도메인 모델(`InviteCodeResult`, `GalleryImageGroup`, `KakaoLoginResult`, `DayWindow`, `SegmentationResult`, 원격 예시 `TempVO`) + 도메인 예외(sealed `SegmentationException`).
- **data** — Repository **구현**(예: `RecentImageRepositoryImpl`, `ImageSegmentationRepositoryImpl`), DataSource, DI 모듈.

## DataSource 종류
- **파일 기반** — `FileRecentImageLocalDataSource`, `FileCameraCacheLocalDataSource`(내부 저장소 이미지 I/O).
- **DataStore 기반** — `RecentImageLocalDataSource`(메타데이터), `RecentImageEditor`(`data/datastore/`, DataStore 접근 추상화 — 단일 키 `get()`/`set()` 동기 인터페이스로, suspend/flow가 아님).
- **시스템 미디어** — `GalleryMediaProvider`(시스템 갤러리 접근).

## DI 모듈 (data, `@InstallIn(SingletonComponent::class)`)
`di/` 아래 **관심사(+도메인)별 하위 패키지**로 나눈다 — 도메인이 늘 때 기존 모듈을 키우지 않고
같은 자리에 파일을 추가한다([[0017-remote-network-datasource]]). 도메인에 매이지 않는 것만 `di/` 루트.

| 패키지 | 모듈 | 제공/바인딩 |
|------|------|-------------|
| `di/repository/<도메인>` | `CameraRepositoryModule`·`GalleryRepositoryModule`·`ImageRepositoryModule` | Repository 인터페이스 ↔ 구현 `@Binds` |
| `di/source/<종류·도메인>` | `FileLocalDataSourceModule`·`ImageLocalDataSourceModule`·`TempRemoteDataSourceModule` | DataSource 인터페이스 ↔ 구현 `@Binds` |
| `di/service/<도메인>` | `TempServiceModule` | Retrofit 서비스 생성(`retrofit.create`) |
| `di/network` | `NetworkModule` | `TokenProvider`·`AuthInterceptor`·`OkHttpClient`·`Retrofit` |
| `di/datastore` | `DataStoreModule` | `DataStore<Preferences>` 싱글톤 |
| `di/`(루트) | `JsonModule` | `@LocalJson`·`@RemoteJson` `Json` 2종(현재 설정 동일: `ignoreUnknownKeys`·`coerceInputValues`·`encodeDefaults`) |
| `di/`(루트) | `SingletonInjectModule` | 기타 앱 전역 싱글톤 |

## 예: 최근 이미지
`RecentImageRepositoryImpl`이 `RecentImageLocalDataSource`(DataStore, URI 메타)와 `FileRecentImageLocalDataSource`(파일 저장)를 조합. 파일 last-modified로 캐시 축출, `DayWindow`로 날짜 윈도잉.

## 예: 이미지 세그멘테이션(누끼)
`ImageSegmentationRepositoryImpl`이 온디바이스 ML Kit Subject Segmentation으로 전경을 분리([[0012-mlkit-subject-segmentation]]). `contentResolver.decodeUriToBitmap`로 URI→비트맵 디코딩, 결과 비트맵은 `BitmapWrapper`([[0011-cross-module-bitmap-abstraction]])로 도메인에 전달, subject 이미지는 `cacheDir` PNG 파일로 저장해 경로(`subjectImagePath`) 반환. 실패는 `Result<SegmentationResult>` + `SegmentationException`. 소비는 `DecodeImageUseCase`·`SegmentImageUseCase`.

## 신규 데이터 추가 체크리스트
1. **domain**: Repository 인터페이스 + 필요한 도메인 모델 정의.
2. **data**: 구현 클래스 + DataSource(파일/DataStore/원격) 작성. 원격은 `source.<도메인>.remote`
   패키지에 인터페이스+`Impl` 쌍(예: `TempRemoteDataSource`/`TempRemoteDataSourceImpl`,
   [[0017-remote-network-datasource]]) — 반환 타입은 **도메인 모델**, 서버 응답은
   `source.<도메인>.mapper`의 확장 함수로 변환.
3. **DI**: `di/repository/<도메인>`·`di/source/<종류·도메인>`에 모듈 파일을 **새로 만들어**
   `@Binds` 등록(기존 모듈에 덧붙이지 않는다).
4. 소비: **UseCase**를 통해 노출, ViewModel은 UseCase만 호출([[state-management]]).
5. 반응형이면 `Flow`로 반환.

## 네트워킹
> **미머지**: 아래 네트워킹 구조와 위 DI 모듈 분할은 `feature/network-set-up` 브랜치 기준으로,
> develop 미머지다. 머지 시 심볼 재확인.

원격 연동 기초 구조가 확정됐다([[0017-remote-network-datasource]]). 응답→도메인 매핑 지점도 확정
(아래 "응답 매핑"). 실제 백엔드 엔드포인트 연동·Repository/UseCase 소비는 후속.

- **컨벤션 플러그인**: `AndroidNetworkConventionPlugin`(적용 모듈에 `buildConfig` 활성 +
  `BuildConfig.BASE_URL` 부여, `NetworkConfig`의 `setConfigNetwork` + `PropertySettingManager`의
  `loadBaseUrl`이 properties/`local.properties`(`YG_BASE_URL`)에서 값을 로드). `libs.bundles.network`·
  kotlinx-serialization 의존을 이 플러그인이 부여(`ModuleDataConventionPlugin`에서 이관됨).
- **DI(`di/network/NetworkModule`, `@InstallIn(SingletonComponent::class)`)**: `provideTokenProvider`
  (=`EmptyTokenProvider`)·`provideAuthInterceptor`·`provideOkHttpClient`·`provideRetrofit`를 제공.
  Retrofit 서비스 생성은 도메인별 `di/service/<도메인>`(예: `TempServiceModule.provideTempService`) 소관.
  `Json`은 용도별 `@Qualifier`로 분리 — 로컬(DataStore) `@LocalJson`, 원격(Retrofit) `@RemoteJson`,
  둘 다 `JsonModule` 제공. 한정자는 `model/qualifier` 패키지. 같은 타입이어도 한정자로 구분돼 중복
  바인딩이 아니며, 설정을 용도별로 독립 조정 가능(현재 두 설정은 동일).
- **응답 계약**: 공통 `ApiResponse<T>`(`code`/`message`/`data`, `@Serializable`, `isSuccess`) +
  `safeApiCall`(함수)이 서비스 응답을 `Result<T>`로 변환. 실패는 sealed `ApiException`
  (`Business`/`Http`/`Network`/`Unknown`)으로 분류하고 `CancellationException`은 재던진다(취소 전파 보존).
- **인증**: `AuthInterceptor` + `TokenProvider`(인터페이스, stub `EmptyTokenProvider`)가
  `Authorization: Bearer` 헤더 주입 자리를 제공. 실제 토큰 소스 연동은 후속.
- **로깅**: `HttpLoggingInterceptor` 레벨은 `BuildConfig.DEBUG`로 게이팅(debug=`BODY`,
  release=`NONE`) — release에서 토큰·바디 노출 방지.
- **응답 매핑**: 원격 DataSource는 **도메인 모델을 반환**한다(`TempRemoteDataSource.getTemp(id):
  Result<TempVO>`). 서버 응답 타입(`service.model`의 `TempResponse`)은 data 안에서만 살고,
  `source.<도메인>.mapper`의 `internal` 확장 함수(`TempResponse.toTempVO()`, 파일 `VOMapper.kt`)가
  경계에서 변환한다. data 전용 중간 모델(구 `model.dto`)은 두지 않는다 — Response 복제본이라
  변환 단계만 늘기 때문. 접미사 규약(`…VO` vs 기존 무접미사)은 미결 → [open-questions](../synthesis/open-questions.md).
- **예시 1세트**: `TempService` + `TempRequest`/`TempResponse` + `domain.model.TempVO` +
  `source.temp.mapper`(`VOMapper.kt`) + `source.temp.remote`의 `TempRemoteDataSource`(+`Impl`) +
  `TempRemoteDataSourceModule`(`@Binds`) + `TempServiceModule`. 실제 도메인 확정 전 placeholder —
  신규 원격 DataSource는 이 세트를 복제해 `source.<도메인>.*`에 배치.
