---
id: data-layer
title: 데이터 레이어 (Repository · DataSource · DI)
category: architecture
status: living
platforms: android
verified: 2026-07-12
related_spec:
related_adr: ADR-0001, ADR-0004, ADR-0008, ADR-0009, ADR-0011, ADR-0012
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
- **DataStore 기반** — `RecentImageLocalDataSource`(메타데이터), `RecentImageEditor`(DataStore 접근 추상화).
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
2. **data**: 구현 클래스 + DataSource(파일/DataStore/원격) 작성.
3. **DI**: `RepositoryModule`/`LocalDataSourceModule`에 `@Binds` 등록.
4. 소비: **UseCase**를 통해 노출, ViewModel은 UseCase만 호출([[state-management]]).
5. 반응형이면 `Flow`로 반환.

## 네트워킹 (Assumption)
`libs.bundles.network`에 Retrofit·OkHttp·kotlinx-serialization 컨버터가 준비돼 있으나, 현재 스냅샷에서 Retrofit 서비스 정의는 확인되지 않음 — **원격 연동은 후속**으로 보인다. 실제 도입 시 별도 ADR로 원격 DataSource·서비스 규약을 기록한다.
