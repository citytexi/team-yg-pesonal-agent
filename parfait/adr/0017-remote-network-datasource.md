---
id: ADR-0017
title: 원격 네트워크 DataSource·서비스 규약 (AndroidNetworkConventionPlugin + ApiResponse/safeApiCall)
status: accepted
date: 2026-07-26
deciders: Parfait 팀
supersedes:
superseded_by:
related_adr: ADR-0001, ADR-0003, ADR-0004
related_spec: data-network-setup
related_architecture: data-layer
platforms: android
tags: [adr, parfait, network, data]
---

# ADR-0017: 원격 네트워크 DataSource·서비스 규약

> 상태·날짜·결정자·대체 관계는 위 frontmatter가 단일 출처. 본문은 결정 내용에 집중.

## 맥락

`:data` 모듈은 `libs.bundles.network`(Retrofit·OkHttp·kotlinx-serialization 컨버터) 의존만 준비돼
있었고 Retrofit 서비스 정의는 없었다([[data-layer]] "네트워킹" 섹션 참고). 원격 API 연동을 시작하려면
컨벤션 플러그인 배치, 공통 응답 계약, 인증 헤더 주입 자리, remote DataSource 배치 관례를 먼저
확정해야 한다.

## 결정

network 관심사를 전용 컨벤션 플러그인으로 응집하고, 공통 응답 envelope·인증 자리·remote
DataSource 배치 관례를 확립한다.

- **컨벤션 플러그인**: `AndroidNetworkConventionPlugin`(plugin id `com.teamyg.parfait.plugin.android.network`,
  alias `parfait-android-network`)이 `buildConfig` 활성화 + `BuildConfig.BASE_URL` buildConfigField를
  부여한다. `NetworkConfig`의 `setConfigNetwork`가 값을 채우고, `PropertySettingManager`의
  `loadBaseUrl`이 project property → `local.properties`(`YG_BASE_URL`) → placeholder fallback
  순으로 조회한다(서명 키 로드 관례와 동형). `libs.bundles.network`·kotlinx-serialization 의존과
  serialization 플러그인 적용을 `ModuleDataConventionPlugin`에서 이 플러그인으로 이관한다.
- **DI 배치**: DI 모듈은 `di/` 아래 **관심사(+도메인)별 하위 패키지**로 쪼갠다 —
  `di/network/NetworkModule`, `di/service/<도메인>/TempServiceModule`,
  `di/source/<도메인>/TempRemoteDataSourceModule`, `di/datastore/DataStoreModule`,
  `di/repository/<도메인>/…`, `di/source/{file,image}/…`. 관심사가 도메인에 매이지 않는 것만
  `di/` 루트에 둔다(`JsonModule`, `SingletonInjectModule`). 도메인이 늘 때 기존 모듈 파일을
  키우지 않고 같은 패턴으로 파일을 추가하는 것이 목적이다.
  - `NetworkModule`(object, `@InstallIn(SingletonComponent::class)`): `provideTokenProvider`
    (=`EmptyTokenProvider`)·`provideAuthInterceptor`·`provideOkHttpClient`·`provideRetrofit`.
  - `TempServiceModule`(object): `provideTempService(retrofit)` — Retrofit 서비스 생성은
    도메인별 모듈 소관이라 `NetworkModule`에 쌓지 않는다.
  - `TempRemoteDataSourceModule`(interface, `@Binds`): `TempRemoteDataSourceImpl` → 인터페이스.
- **`Json` 한정자**: `Json`은 용도별로 분리해 `@Qualifier`로 구분한다 — 로컬(DataStore)용
  `@LocalJson`, 원격(Retrofit)용 `@RemoteJson`. 두 한정자는 `model/qualifier` 패키지에 두고,
  **두 인스턴스 모두 `JsonModule`(`provideLocalJson`·`provideRemoteJson`)이 제공**한다(같은 관심사를
  한 파일에 모아 설정 차이를 나란히 본다 — `DataStoreModule`은 `DataStore<Preferences>`만 제공).
  같은 `SingletonComponent`에 동일 타입 `Json`이 둘이어도 한정자로 구분돼 중복 바인딩이 아니다.
  현재 두 인스턴스의 직렬화 설정(`ignoreUnknownKeys`·`coerceInputValues`·`encodeDefaults`)은
  동일하나, 원격은 서버 응답 규약에 맞춰 독립적으로 조정할 수 있다.
- **응답 계약**: 공통 `ApiResponse<T>`(`code`/`message`/`data`, `@Serializable`, `isSuccess`
  프로퍼티)를 모든 서비스 응답 타입으로 쓰고, `safeApiCall`(함수, `SafeApiCall.kt`)이 이를
  `Result<T>`로 변환한다.
- **에러 타입 계층**: 실패는 sealed `ApiException`(`ApiException.kt`)으로 분류한다 — `Business`(HTTP
  성공이나 envelope 실패 코드), `Http`(4xx/5xx, `HttpException` + `statusCode`), `Network`
  (`IOException`), `Unknown`(그 외). `safeApiCall`이 `try/catch`로 예외를 이 타입들에 매핑하고,
  `CancellationException`은 다시 던져 코루틴 취소 전파를 보존한다(`runCatching`의 취소 삼킴 회피).
  소비자는 `Result.exceptionOrNull()`을 `ApiException`으로 분기해 재시도·재인증 등을 판단할 수 있다.
- **인증**: `AuthInterceptor`가 `TokenProvider`(인터페이스, stub 구현 `EmptyTokenProvider`)로부터
  토큰을 받아 `Authorization: Bearer` 헤더를 주입할 자리를 만든다. 현재 `EmptyTokenProvider`는
  항상 null을 반환 — 실제 토큰 소스 연동은 후속.
- **로깅**: `HttpLoggingInterceptor` 레벨을 `BuildConfig.DEBUG`로 게이팅한다(debug=`BODY`,
  release=`NONE`). release 빌드에서 `Authorization` 토큰과 요청/응답 바디가 로그로 노출되는 것을
  막기 위한 결정이다. `OkHttpClient`는 connect/read/write 타임아웃 3종을 설정한다.
- **remote DataSource 배치**: 원격 DataSource는 `source.<도메인>.remote` 패키지에 인터페이스+`Impl`
  쌍으로 둔다. 예시 1세트로 `TempService`+`TempRequest`/`TempResponse`+`TempRemoteDataSource`(+`Impl`)를
  두고, `TempRemoteDataSourceModule`(`@Binds`)로 바인딩한다.
- **응답 → 도메인 매핑 위치**: 원격 DataSource의 **반환 타입은 도메인 모델**이다
  (`TempRemoteDataSource.getTemp(id): Result<TempVO>`). 서버 응답 타입(`service.model`의
  `TempResponse`)은 data 안에서만 살고, `source.<도메인>.mapper`의 확장 함수
  (`TempResponse.toTempVO()`, 파일 `VOMapper.kt`, `internal`)가 경계에서 변환한다. data 전용
  중간 모델(구 `data.model.dto.TempDto`)은 두지 않는다 — Response와 필드가 같아 값 없는 3단
  변환(Response→DTO→도메인)이 되기 때문이다. 도메인 모델은 `domain.model`에 둔다.

## 대안

- **대안 A — 모듈 `build.gradle`에 buildConfig·network 의존을 인라인** — 별도 플러그인 없이 `:data`
  모듈 스크립트에 직접 작성하면 당장은 빠르다. 그러나 서명 플러그인
  (`AndroidApplicationSigningConventionPlugin`)이 세운 "환경별 설정은 전용 컨벤션 플러그인" 관례를
  이탈하고, 다른 모듈이 network를 필요로 할 때 재사용할 수 없다.
  **→ 기각:** 관례 일치·재사용성을 위해 전용 플러그인으로 분리.
- **대안 B — 단일 `Json`을 로컬·원격이 공유(한정자 없음)** — 로컬(DataStore)용 `Json` 하나를
  Retrofit 컨버터가 그대로 주입받아 쓰면 인스턴스가 하나로 단순하다. 그러나 로컬 영속화와 원격 응답
  파싱은 요구되는 직렬화 관용(예: `isLenient`·`explicitNulls`·미지 키 처리)이 갈라질 수 있는데, 공유
  인스턴스는 한쪽 설정을 바꾸면 다른 쪽까지 영향을 준다.
  **→ 기각:** `@LocalJson`/`@RemoteJson` 한정자로 두 인스턴스를 분리해, 중복 바인딩 없이 용도별로
  독립 조정 가능하게 한다.
- **대안 C — Retrofit `CallAdapter`로 `Result<T>` 직접 반환** — 서비스 인터페이스가 `ApiResponse<T>`
  대신 바로 `Result<T>`를 반환하도록 커스텀 `CallAdapter.Factory`를 두면 `safeApiCall` 래핑이
  호출부에서 사라진다. 그러나 현재는 서비스 1세트뿐이라 CallAdapter 인프라가 과설계다.
  **→ 보류:** 서비스가 늘어나 `safeApiCall` 반복 래핑이 눈에 띄게 부담될 때 재검토.
- **대안 D — data 전용 DTO를 두고 Repository에서 도메인 변환** — `Response → DTO`(data) →
  `DTO → 도메인`(Repository) 2단으로 나누면 DataSource 시그니처가 data 타입으로 닫히고, 서버 응답
  형태가 도메인과 크게 갈라질 때 중간 표현을 붙일 자리가 생긴다. 그러나 현재 예시 세트에서 DTO는
  Response와 필드가 동일한 복제본이라 실제 격리 효과 없이 클래스와 매퍼만 하나씩 늘었다.
  **→ 기각:** DTO를 제거하고 DataSource가 도메인 모델을 반환한다. `:data`는 이미 `:domain`에
  의존하므로([[0001-layered-multi-module]]) 레이어 역전은 아니다. 응답이 도메인과 크게 어긋나는
  도메인이 나오면 그 도메인에 한해 중간 모델을 되살린다.

## 영향

**긍정**

- 서명 플러그인과 동일한 "환경별 설정은 컨벤션 플러그인" 관례를 network에도 적용해 배치가
  일관된다.
- `BASE_URL`이 properties/`local.properties`에서 로드되어 VCS에 원문이 노출되지 않는다.
- `source.<도메인>.remote` + `ApiResponse`/`safeApiCall` 패턴이 확립되어, 다음 도메인의 remote
  DataSource 추가가 예시(`TempRemoteDataSource`)를 복제하는 수준으로 단순해진다.
- DI 모듈이 관심사·도메인별 파일로 갈려 도메인 추가 시 기존 파일 수정 대신 파일 추가로 끝난다
  (머지 충돌 면적도 줄어든다).
- Repository가 서버 응답 타입을 몰라도 되어, 도메인 소비자까지 오는 변환 단계가 1회로 줄었다.

**트레이드오프**

- 현재 소비 모듈이 `:data` 하나뿐인 상태에서 별도 컨벤션 플러그인을 두는 것은 당장은 오버헤드다
  (모듈이 늘 때 재사용성으로 상쇄될 것으로 본다).
- `TempService`/`TempRequest`/`TempResponse`/`TempVO`/`TempRemoteDataSource` 예시 세트가 실제
  도메인 API 확정 전까지 코드베이스에 placeholder로 남는다.
- DI 모듈 파일 수가 늘어난다(바인딩 하나짜리 파일 다수). 어느 파일에 있는지는 패키지 규칙으로
  찾는다.
- DataSource 시그니처가 도메인 타입에 묶여, 서버 응답이 도메인과 갈라지는 도메인이 나오면 그때
  중간 모델을 되살려야 한다(대안 D).

**위험·방어**

- 이번 변경에는 자동화된 테스트가 없다(코드베이스 관례상 무테스트) — `:app:assembleDebug`로 Hilt
  전체 그래프(`TokenProvider`→`AuthInterceptor`→`OkHttpClient`→`Retrofit`→`TempService`→
  `TempRemoteDataSource` 체인, `@LocalJson`/`@RemoteJson` 한정자 해소 정상)를 검증했다.
- `ApiResponse.isSuccess` 판정에 쓰는 성공 코드 규약과 `TokenProvider`의 실제 토큰 소스는
  미확정이다 → [open-questions](../synthesis/open-questions.md)로 추적.
- 도메인 모델 이름이 `TempVO`로 `VO` 접미사를 쓰는데, 기존 `domain.model`은 무접미사
  (`SegmentationResult`·`GalleryImageGroup`·`NameValidResult` 등)다. 접미사 규약이 갈라진 상태 →
  [open-questions](../synthesis/open-questions.md) [2026-07-30]로 추적.
