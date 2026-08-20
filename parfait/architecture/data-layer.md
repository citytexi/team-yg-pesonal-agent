---
id: data-layer
title: 데이터 레이어 (Repository · DataSource · DI)
category: architecture
status: living
platforms: android
verified: 2026-08-20
related_spec: segmentation-pipeline-hardening, data-network-setup, network-envelope-token-storage, data-api-service-layer, image-api-service-layer, member-parfait-image-api-service-layer, session-token-refresh-infra, user-info-ssot, c001-canvas-today-detail, c201-canvas-calendar-server, group-ssot
related_adr: ADR-0001, ADR-0004, ADR-0008, ADR-0009, ADR-0011, ADR-0012, ADR-0017, ADR-0019, ADR-0020, ADR-0021, ADR-0022, ADR-0023
related_architecture: state-management
related_code: RecentImageRepository, ImageSegmentationRepository, SegmentationCacheDir, SegmentationMask, ClearSegmentationCacheUseCase, DecodeImageUseCase, JsonModule, NetworkModule, PolicyRemoteDataSource, ApiCaller, EncryptedTokenStore, AuthService, ParfaitGroupService, AuthRemoteDataSource, ImageService, MemberService, ParfaitImageService, ParfaitImageRemoteDataSource, AuthRepository, AuthRepositoryImpl, AppError, AppErrorMapper, runSuspendCatching, TokenAuthenticator, SessionEventBus, UnauthenticatedClient, EncryptedPreferences, UserInfoLocalDataSource, MemberRepository, MemberRepositoryImpl, UserInfoEntity, ParfaitRepository, ParfaitRepositoryImpl, ParfaitRemoteDataSource, ParfaitGroupRepository, ParfaitGroupRepositoryImpl, GetGroupDetailUseCase, GroupDetailVO, GroupLocalDataSource, GroupLocalDataSourceImpl, GetMyGroupsFlowUseCase, RefreshMyGroupsUseCase, RefreshGroupDetailUseCase, LogoutUseCase, WithdrawUseCase
tags: [architecture, parfait]
---
# 데이터 레이어 (Repository · DataSource · DI)

도메인 인터페이스와 데이터 구현의 분리, 로컬 영속화 흐름. 결정 근거는 [[0001-layered-multi-module]]·[[0004-hilt-ksp-di]]·[[0008-datastore-local-persistence]].

> 근거는 파일명+심볼명으로만.

## 레이어 배치
- **domain** — Repository **인터페이스**(예: `RecentImageRepository`, `GalleryRepository`, `CameraCacheFileRepository`, `ImageSegmentationRepository`) + UseCase([[0009-usecase-injectable-invoke]]) + 도메인 모델(`GalleryImageGroup`, `KakaoLoginResult`, `DayWindow`, `SegmentationResult`, 원격 예시 `PolicyVO`·`MyParfaitGroupVO`) + 도메인 예외(sealed `SegmentationException` — `ImageNotFound`·`ClientInit`·`ModuleNotReady`·`Process` / `SignUpException.RequiredPolicyNotAgreed`).
  - `domain/model/`은 **루트 평면 선언과 도메인 하위 패키지가 섞여 있다** — 원격 API 라운드가 추가한 VO·value class만 하위 패키지로 들어갔고(PR #197의 `auth/`·`group/`·`id/`·`policy/`에 PR #230이 `image/`·`member/`·`topping/`을, PR #250이 `canvas/`를 더했다), 그 이전 선언 8개는 루트에 남았다. 하위 패키지가 넷에서 여덟이 되며 **비율은 더 기울었는데 규약은 여전히 없다** — 어디에 새 모델을 둘지 매번 판단해야 하는 상태 → [open-questions](../synthesis/open-questions.md).
    2026-08-15~16 라운드가 `session/`(PR #260, `SessionEvent` — **원격 VO가 아닌 첫 하위 패키지**)과
    `parfait/`(PR #259, `ParfaitHistory`)를 더해 **열이 됐다**. "원격 API 라운드가 만든 것만 하위
    패키지"라는 느슨한 기준마저 더는 성립하지 않는다.
    **2026-08-17(PR #279)에 `parfait/`가 통째로 사라져 다시 아홉이 됐다** — 그 안의 유일한 선언
    `ParfaitHistory`가 계약 VO `PastCanvasVO`로 대체됐기 때문이고, 같은 도메인의 날짜 헬퍼
    `parfaitToday()`는 여전히 루트 평면(`model/ParfaitDay.kt`)에 있다. 규약이 없다는 사실은 그대로다.
- **data** — Repository **구현**(예: `RecentImageRepositoryImpl`, `ImageSegmentationRepositoryImpl`), DataSource, DI 모듈.

## DataSource 종류
- **파일 기반** — `FileRecentImageLocalDataSource`, `FileCameraCacheLocalDataSource`(내부 저장소 이미지 I/O).
- **DataStore 기반** — `RecentImageLocalDataSource`(메타데이터), `RecentImageEditor`(`data/datastore/`, DataStore 접근 추상화 — 단일 키 `get()`/`set()` 동기 인터페이스로, suspend/flow가 아님), **`UserInfoLocalDataSource`**(계정 정보 SSoT, 암호화 + `Flow`, PR #263).
- **인메모리** — **`GroupLocalDataSource`**(그룹 목록·상세 SSoT, `@Singleton` + `MutableStateFlow`,
  [ADR-0023](../adr/0023-group-in-memory-ssot.md)). 디스크를 쓰지 않아 **모든 함수가 non-suspend**이고
  실패 채널이 없다 — 계정 정보 SSoT와 형태는 같되 영속·암호화만 뺀 갈래다. 목록은
  `StateFlow<List<MyParfaitGroupVO>?>`이고 **`null`이 "아직 못 받음"**, `emptyList()`가 "그룹 0건"이다.
- **암호화 DataStore 프록시** — `EncryptedPreferences`(`data/datastore/`, PR #263). 저장 형태가 값이 아니라 **암호문**인 저장소들이 공유한다(`EncryptedTokenStore`·`UserInfoLocalDataSourceImpl`) — 아래 "토큰·계정 정보 저장 경로" 참고.
- **시스템 미디어** — `GalleryMediaProvider`(시스템 갤러리 접근).

> **표시 포맷은 data가 만들지 않는다**(2026-08-04, PR #191) — `GalleryImageGroup.date`가 문자열에서
> `LocalDate`로 바뀌고 `GalleryMediaProvider`의 날짜 포맷이 삭제됐다. 포맷은 화면이
> `core:util:jvm` `DateTextFormat`으로 만든다. 날짜 그룹 키의 하루 경계는 `DayWindow`(도메인 모델) 소관.
>
> 📌 **같은 원칙이 원격 시각에도 적용됐다(2026-08-15, PR #248)** — `MyParfaitGroupVO.recentImageUploadedAt`이
> `kotlinx.datetime.LocalDateTime`(벽시계)에서 **`kotlin.time.Instant`(절대 시점)**로 바뀌었고, 상대시간
> 문구는 화면(`GroupTimestamp`)이 만든다. 벽시계 숫자로 들고 있으면 기기 타임존에 따라 다른 시점이 된다는 것이 근거다.
> ⚠️ **다만 매퍼가 `Instant::parse`를 쓰는데 서버는 오프셋 없는 문자열을 내려준다**
> ([api/parfait-group.md](../api/parfait-group.md) 직렬화 포맷) → [open-questions](../synthesis/open-questions.md) [2026-08-15].

## DI 모듈 (data, `@InstallIn(SingletonComponent::class)`)
`di/` **평면 배치, 역할당 파일 1개**(하위 패키지 없음). 도메인이 늘면 해당 역할 파일에 바인딩을
추가한다 — 도메인별 분할은 기각([[0017-remote-network-datasource]] 대안 E).

| 모듈 | 제공/바인딩 |
|------|-------------|
| `RepositoryModule` | Repository 인터페이스 ↔ 구현 `@Binds @Singleton`(camera·gallery·image·auth·policy·parfaitGroup·member) + `NonceGenerator`. `@Binds`는 `interface` 모듈에만 되므로 `object`인 `SingletonInjectModule` 대신 여기 모은다 |
| `LocalDataSourceModule` | 로컬 DataSource 인터페이스 ↔ 구현(파일·DataStore·`TokenStore` ↔ `EncryptedTokenStore`·`UserInfoLocalDataSource` ↔ `UserInfoLocalDataSourceImpl`·`GroupLocalDataSource` ↔ `GroupLocalDataSourceImpl`) |
| `RemoteDataSourceModule` | 원격 DataSource 인터페이스 ↔ 구현 |
| `ServiceModule` | Retrofit 서비스 생성(`retrofit.create`). **같은 `AuthService`를 두 번 만든다** — 기본 것과 `@UnauthenticatedClient` 것(재발급 전용, 아래 "401 자동 재발급") |
| `NetworkModule` | `TokenProvider`(=`TokenStoreTokenProvider`)·`AuthInterceptor`·`TokenAuthenticator`를 단 `OkHttpClient`·`Retrofit` + **`@UnauthenticatedClient` `OkHttpClient`·`Retrofit`**(독립 `Dispatcher`, 인증기·`AuthInterceptor` 없음) |
| `SessionModule` | `SessionEventBus` → `SessionEventSource` 바인딩(#260 신설) |
| `DataStoreModule` | `DataStore<Preferences>` 싱글톤 |
| `JsonModule` | `@LocalJson`·`@RemoteJson` `Json` 2종(현재 설정 동일: `ignoreUnknownKeys`·`coerceInputValues`·`encodeDefaults`) |
| `SingletonInjectModule` | 기타 앱 전역 싱글톤 |

## 예: 최근 이미지
`RecentImageRepositoryImpl`이 `RecentImageLocalDataSource`(DataStore, URI 메타)와 `FileRecentImageLocalDataSource`(파일 저장)를 조합. 파일 last-modified로 캐시 축출, `DayWindow`로 날짜 윈도잉.

## 예: 이미지 세그멘테이션(누끼)
`ImageSegmentationRepositoryImpl`이 온디바이스 ML Kit Subject Segmentation으로 전경을 분리([[0012-mlkit-subject-segmentation]]). `contentResolver.decodeUriToBitmap`로 URI→비트맵 디코딩(반환은 `BitmapWrapper`, [[0011-cross-module-bitmap-abstraction]]), subject 이미지는 `cacheDir`의 **세그멘테이션 전용 하위 디렉토리**에 PNG로 저장해 경로를 반환. 실패는 `Result<SegmentationResult>` + `SegmentationException`. 소비는 `DecodeImageUseCase`·`SegmentImageUseCase`·`SaveEditedImageUseCase`·`ClearSegmentationCacheUseCase`.

**결과 모델 재편(2026-08-14, PR #221)** — `SegmentationResult`가 `BitmapWrapper`를 더 이상 담지 않는다.
`subjectImagePath`(파일 경로) + `subjectBounds: SegmentationBounds?`(원본 픽셀 좌표계 바운딩 박스,
`right`/`bottom`은 exclusive) 두 값뿐이고, 감지 픽셀이 0이면 `subjectBounds`가 null이다.
**결과 전달이 "메모리 비트맵 + 파일 경로" 이원에서 경로 단일로 정리됐다** — 비트맵이 도메인 모델을
타고 화면까지 실려 가지 않는다(대신 화면이 경로를 다시 디코드한다).

> 📌 **경로가 둘이 됐다(2026-08-19, PR #290)** — `trimmedSubjectImagePath`가 붙어 세 값이다.
> 같은 객체를 **두 가지 크기로** 들고 다녀야 하기 때문이다: 수동 편집(C-104/C-105)은 원본과 픽셀
> 단위로 겹쳐 그려야 해 **원본 캔버스 크기**를 유지하고, C-106 배치·미리보기는 40%·48dp 계산이
> 여백까지 세면 어긋나므로 **여백 없는 실제 객체 크기**가 필요하다. `:data`는 이미 구한
> `subjectBounds`로 바로 잘라 두 번째 PNG를 떨구고(bounds가 `null`이면 원본 경로를 그대로 쓴다),
> 편집을 거친 경우는 `ToppingEditMask.trimTransparentBounds()`가 알파 있는 픽셀의 최소 사각형을
> 구한다. **대가는 캐시 파일과 메모리 버퍼가 각각 하나씩 는 것**이다 — `ToppingEditViewModel`의
> "테두리가 없으면 같은 파일을 두 번 떨구지 않는다" 최적화도 이때 사라졌다
> ([open-questions](../synthesis/open-questions.md) OQ-P-003 ③·OQ-P-228) →
> [c106-topping-place 스펙](../specs/archive/2026-08-19-c106-topping-place.md).

**메서드 4개**다 — `decodeImage(uri)` · `segmentImage(bitmapWrapper)` ·
`saveEditedImage(bitmapWrapper)`(손편집 결과를 캐시에 PNG로 떨구고 절대 경로 반환) ·
`clearSegmentationCache()`(PR #309 신설, 아래 캐시 정리 절).
`saveEditedImage`는 **넘겨받은 비트맵을 recycle하지 않는다**(수명은 넘겨준 쪽 몫, 코드 주석에 명시).

**계약 셋 중 `decodeImage`만 `Result`가 아니다 — 감싸는 자리를 UseCase로 올렸다(2026-08-20, PR #309).**
`DecodeImageUseCase`가 `runSuspendCatching`으로 감싸 `Result<BitmapWrapper>`를 주고, 리포지토리
시그니처는 던지는 채로 남았다. 호출부마다 감싸던 것을 한 자리로 모은 이유는 **두 호출부가 쓰던 stdlib
`runCatching`이 `CancellationException`까지 삼켜** 이미 떠난 화면이 자기를 "디코드 실패"로 보고했기
때문이다 — 취소를 실패로 접는 실수가 호출부 수만큼 반복될 자리를 없앴다.

**ML Kit optional module을 사용 직전에 확인한다** — 매니페스트의 `com.google.mlkit.vision.DEPENDENCIES`는
설치 시점 다운로드 힌트일 뿐 보장이 없어서, `ModuleInstall.areModulesAvailable`로 확인하고 없으면
`installModules` 후 재확인한다. 실패는 `SegmentationException.ModuleNotReady`(일시적, 재시도 가능) /
`Process`(그 외)로 가른다 — `Tasks.await`가 원인을 `ExecutionException`으로 감싸므로 한 겹 벗겨
`MlKitException.UNAVAILABLE`을 판정한다.

> ✅ **캐시 파일에 정리 경로가 생겼다(2026-08-20, PR #309)** — 저장 위치가 `cacheDir` 바로 밑에서
> **전용 하위 디렉토리**(`SegmentationCacheDir.kt`)로 내려갔고, 세그멘테이션 진입 시 디코드보다 먼저
> 그 디렉토리를 통째로 비운다(`ClearSegmentationCacheUseCase`). 파일 이름도 밀리초 타임스탬프에서
> `File.createTempFile`로 바뀌었다 — 한 번의 세그멘테이션이 두 장을 연달아 저장해 같은 밀리초에
> 덮어쓸 수 있었다. **누적 상한은 직전 흐름 1회분**이고, 정리 호출 자체는 실패해도 흐름을 막지 않는다
> (best-effort). **카메라 캐시는 여전히 정리 경로가 없다**(`FileCameraCacheLocalDataSourceImpl`, 초
> 단위 파일명이라 충돌도 남는다) → [open-questions](../synthesis/open-questions.md) OQ-P-003 ③.

> ✅ **`foregroundConfidenceMask == null`이 `Result.failure`를 탄다(2026-08-20, PR #309)** — raw
> `error()`가 아니다. 같은 라운드가 마스크 버퍼의 `remaining()`이 `width * height`와 다른 경우도
> 실패로 방어하고(그전까지는 조용히 잘못 읽었다), 저장 구간(`saveToCacheAsPng`의 `IOException`)까지
> `try`로 감싸 `finally`에서 비트맵을 회수한다. `CancellationException`은 그 방어 앞에서 재던져
> 취소가 실패로 접히지 않는다 → [open-questions](../synthesis/open-questions.md) OQ-P-004 ②.

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
`statusCode`와 함께 본다. **앱이 실제로 분기에 쓰는 코드만** 둔다 — 서버 enum 전체를 미리 옮겨
적으면 안 쓰는 상수가 계약 변경 때 방치돼 거짓말이 된다.

중첩 object는 서버 enum 구조를 그대로 따른다 — `Auth`(서버 `AuthErrorCode`) · `ParfaitGroup`
(`ParfaitGroupApiErrorCode`) · **`Member`(`MemberErrorCode`, PR #263 신설: `INVALID_NICKNAME`·
`MEMBER_NOT_FOUND`)** · `Common`(`CommonErrorCode`). `Member.MEMBER_NOT_FOUND`(404)가 같은 문자열의
**세 번째 상수**이고, 소비처 둘이 그것을 서로 다르게 읽는다 — `BootstrapSessionUseCase`는 세션 사망으로
보고 정리하지만 S-002는 표시만 한다(`GlobalNicknameError.ACCOUNT_GONE`). **2026-08-15 그룹 결선 라운드로 선언된 코드가
전부 소비된다** — `Auth`는 **6종으로 늘었고**(#260이 `INVALID_TOKEN`·`EXPIRED_TOKEN`·
`FORBIDDEN_REFRESH_TOKEN` 추가, `TokenAuthenticator`의 세션 종료 판정이 소비한다) 기존 3종은 A-002,
`ParfaitGroup` 7종은 A-004(초대코드·이미 참여·정원)·S-102(닉네임
규칙)·A-005(그룹명·닉네임·정원·회원 없음), `Common.INVALID_REQUEST`는 A-005가 쓴다. "분기에 쓰는 코드만
둔다"는 자기 KDoc 규칙이 다시 지켜지는 상태다.

> 📌 **`GROUP_NICKNAME_ALREADY_USED`가 빠져 8종 → 7종이 됐다**(2026-08-15, PR #250). 서버가 그룹 내
> 닉네임 중복 검사를 없애 그 코드를 더는 내지 않으므로, 상수와 `GroupNickNameError.ALREADY_USED`·문구·
> 매핑 분기를 함께 걷었다 — **"분기에 쓰는 코드만 둔다"를 유지하는 방향의 첫 삭제 사례**다
> ([api/parfait-group.md](../api/parfait-group.md)).

### 원격 Repository 인벤토리 (2026-08-15, 그룹·약관 결선 라운드 반영)

| Repository | 메서드 | 소비 |
|---|---|---|
| `AuthRepository` | `loginWithKakao(idToken, nonce)` · `signUp(registrationToken, agreements)` · `saveSession(session)` · **`logout()`**(#260) | `LoginWithKakaoUseCase` → A-002 · `SignUpUseCase` → 온보딩 약관 · `LogoutUseCase` → S-001 앱 설정 |
| `PolicyRepository` | `getPolicies()` | `GetPoliciesUseCase` → 온보딩 약관 |
| `ParfaitGroupRepository`(#285, #287, 그룹 SSoT 라운드) | **읽기** `myGroups: Flow<List<MyParfaitGroupVO>?>` · `groupDetail(groupId): Flow<ParfaitGroupDetailVO?>` / **갱신** `refreshMyGroups` · `refreshGroupDetail`(둘 다 `Result<Unit>`) / **정리** `clearGroups`(non-suspend) / **명령** `previewJoin` · `joinGroup` · `createGroup` · `changeMyNickname` · `leaveGroup`(#287) · `reportGroup`(#287) | `GetMyGroupsFlowUseCase`·`RefreshMyGroupsUseCase`(G-001·C-001) · `GetGroupDetailUseCase`·`RefreshGroupDetailUseCase`(S-101) · `GetGroupJoinPreviewUseCase`(A-004) · `JoinGroupUseCase`(S-102, #261에 A-004에서 이관) · `CreateGroupUseCase`(A-005) · `ChangeGroupNicknameUseCase`(S-102·S-101) · `LeaveGroupUseCase`·`ReportGroupUseCase`(S-101 Danger Zone) · `LogoutUseCase`(`clearGroups`) |
| `MemberRepository`(#263, #306) | `myAccount: Flow<MyAccountVO?>` · `refreshMyAccount` · `changeGlobalNickname` · `clearMyAccount` · **`withdraw`**(#306) | `GetMyAccountFlowUseCase`(S-001·S-002 구독) · `RefreshMyAccountUseCase`(로그인·가입 직후, 부트스트랩) · `ChangeGlobalNicknameUseCase`(S-002) · `LogoutUseCase` · `WithdrawUseCase`(S-001 Danger Zone) |
| `ParfaitRepository`(#268, #279) | `getYears`(#279) · `getTodayCanvas` · `getPastCanvases` · `getCanvasDetail` | `GetParfaitYearsUseCase`(C-201 연도 드롭다운) · `GetTodayParfaitUseCase`(C-001 진입) · `GetParfaitHistoriesUseCase`(C-201 달력, 연 단위) · `GetParfaitDetailUseCase`(C-001 날짜 선택) |

**`ParfaitRepository`는 DataSource가 가진 다섯 갈래 중 넷을 연다** — 남은 배경 변경은 소비자가
생길 때 올린다(`ParfaitGroupRepository`와 같은 방침: 쓰지 않는 갈래를 미리 열면 어떤 실패를 어떻게
다룰지 정하지 않은 채 계약이 굳는다). #268에서는 셋이었고 **같은 ViewModel 안에서 층이 갈려 있었다**
(캔버스 조회는 이 Repository, 달력 조회는 UseCase 본문 mock) — **#279가 그 방침대로 연도 조회를
소비자와 함께 올려 층 갈림을 닫았다**(OQ-P-183). 그 라운드에 `GetCanvasByDateUseCase`가
`GetParfaitDetailUseCase`로 대체됐다 — 달력이 그 해 목록을 캐시로 들게 되면서 UseCase가 하던
목록→상세 2단 중 앞 단이 화면으로 옮겨 갔다.

**원격과 로컬을 조율하는 Repository는 이제 둘이다**(`MemberRepository`·`ParfaitGroupRepository`).
그룹 쪽은 같은 모양을 **인메모리로** 다시 쓴 것이라 차이가 셋이다 — ① 로컬 쓰기가 IO가 아니라
`runSuspendCatching`이 필요 없고, ② 조회 API를 부르는 시점을 화면이 정하되(`refreshX`) 값을 받는
길은 `Flow` 하나뿐이며(갱신 함수가 `Result<Unit>`이라 반환값으로는 못 받는다), ③ 명령형 함수가
성공 직후 캐시를 갱신한다(생성·참여는 목록 재조회, 닉네임 변경은 상세 재조회, 나가기·신고는 제거).
**뒷정리 재조회가 실패해도 이미 성공한 조작을 실패로 되돌리지 않는다** — ADR-0022의 닉네임 폴백과
같은 판단이다. 세션이 끝나면 `LogoutUseCase`(단일 정리 자리)와 `TokenAuthenticator`(강제 로그아웃)가
**던지지 않는 그룹 캐시부터** 지운다 — 계정 정보 정리는 DataStore IO라 던질 수 있어, 뒤에 두면 그때
그룹 캐시가 남는다([ADR-0023](../adr/0023-group-in-memory-ssot.md)).

**`MemberRepository`는 그중 먼저 생긴 쪽이다 — 원격과 로컬을 조율한다.** 다른 원격 Repository가
DataSource 위임 + `mapErrorToAppError()`뿐인 데 비해, 이쪽은 원격 응답을 **로컬 SSoT에 쓰고** 읽기는
로컬 `Flow`만 노출한다(화면은 조회 API를 부르지 않는다, [ADR-0022](../adr/0022-user-info-local-ssot.md)).
로컬 쓰기·읽기를 `runSuspendCatching`으로 감싸는 것이 여기서 필수다 — `DataStore.edit`·`data.first()`가
던지는 IOException이 원격 `Result` 체인 안에서 무방비로 나가면 `mapErrorToAppError`를 거치지 않고
Repository 경계를 뚫어 소비자가 미포착 예외로 크래시한다(ADR-0020). 한쪽만 감싸면 감싸지 않은 쪽이
그 경로가 된다.

`ParfaitGroupRepository`는 2026-08-15 로그인 라운드에서 화면보다 먼저 경계만 들어왔었고(브랜치
셋이 같은 4파일을 만들어 충돌하기 때문), **같은 날 그룹 화면 세 라운드(#243·#244·#248)가 5 메서드를
전부 소비하며 그 선반영이 닫혔다.** ✅ **나머지 셋(상세·나가기·신고)도 2026-08-17에 올라왔다**
(#285·#287) — S-101 그룹 설정이 요구한 시점이고, **"화면이 요구할 때까지 올리지 않는다"는 방침이
끝까지 지켜진 첫 도메인**이다. DataSource 8함수 = Repository 8함수가 됐다
([spec](../specs/archive/2026-08-17-s101-group-setting-api.md)).

**UseCase 하나가 Repository를 두 번 부르는 첫 사례도 여기서 나왔다** — `GetGroupDetailUseCase`가
`getGroupDetail` + `getMyGroups`였다. 상세 응답에 그룹명이 없어 목록에서 이름만 집어 붙이는 것이었고,
**이름 조회 실패는 실패로 치지 않았다**(빈 이름 + 나머지 표시). 서버 응답 하나에 대응하지 않는 VO
(`GroupDetailVO`)가 그래서 `:data` 매퍼가 아니라 UseCase에서 만들어졌다.
✅ **둘 다 사라졌다(2026-08-20, PR #307·#308 develop 머지)** — 서버 상세 응답이 `groupName`을 싣게 되면서
`GroupDetailVO`는 삭제됐고 이름을 얻으려던 두 번째 호출도 걷혔다. 지금 `GetGroupDetailUseCase`는
`ParfaitGroupDetailVO` 캐시 하나를 구독한다. 즉 **이 사례는 "서버가 필드를 주면 소멸하는 종류"였다** —
합성 자리를 `:data`가 아니라 UseCase에 둔 판단이 그 소멸을 한 줄 삭제로 끝나게 했다
→ [group-ssot 스펙](../specs/archive/2026-08-17-group-ssot.md) ·
[server-delta 스펙](../specs/archive/2026-08-18-server-delta-nametag-chip-day-boundary.md).

**`logout()`은 실패를 전파하지 않는다**(#260) — 서버 호출이 실패해도 `TokenStore.clear()` 후
`Result.success`다. 사용자가 눌렀으면 이 기기에서는 나가는 것이 기대 동작이라는 근거이고, 화면이
갈래를 나눌 이유가 없다. 다만 한 가지를 더 한다: **실패 시 저장소의 refresh token을 다시 읽어
바뀌었으면 새 값으로 정확히 1회 재전송**한다(`retryIfRefreshTokenRotated`). `logout`이 화이트리스트
밖이라 만료 상태의 로그아웃은 `TokenAuthenticator`를 한 번 타는데, 재발급이 refresh token을
회전시키고 인증기는 **헤더만 갈아끼워 같은 본문을 재전송**하므로 그대로 두면 로컬만 정리되고 갓
발급된 서버 세션이 refresh token 수명만큼 살아남는다.

UseCase는 대개 Repository 위임 한 줄이고, 규칙을 더 얹는 것은 넷이다(#285·#306으로 하나씩 늘었다 —
`GetGroupDetailUseCase`가 호출 둘을 조합하고 그중 하나의 실패를 삼킨다) — `CreateGroupUseCase`가
응답 `groupId > 0`을 성공 조건으로 못 박고, `SignUpUseCase`가 필수 약관 미동의를 도메인 예외
(`SignUpException.RequiredPolicyNotAgreed`)로 되돌린 뒤 성공 시 **세션 저장까지** 한다
(`LoginWithKakaoUseCase`와 같은 이유 — 저장 전에 이동하면 다음 화면 첫 요청이 토큰 없이 나간다).
**`WithdrawUseCase`(#306)가 얹는 규칙은 순서다** — 서버가 탈퇴를 받아 준 뒤에만 `LogoutUseCase`로
기기를 정리하고, 거절당하면 아무것도 지우지 않는다. 로그아웃과 반대 방향인데, 서버가 거절했는데
로컬만 지우면 계정이 살아 있는 채로 사용자만 탈퇴했다고 믿게 되기 때문이다. 정리를 직접 하지 않고
`LogoutUseCase`에 맡긴 것은 **"무엇을 지우는가"를 한 자리에 두려는 판단의 연장**이고, 그 UseCase의
호출자는 이로써 셋이 됐다(S-001 로그아웃 · `BootstrapSessionUseCase` · `WithdrawUseCase`).

두 구현 다 하는 일은 DataSource 위임 + `mapErrorToAppError()`뿐이다. 위임만 하는 층처럼 보여도
이 변환 때문에 필요하다 — 없으면 `ApiException`이 domain·feature까지 새어 나간다.

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
> **develop 반영 범위(2026-08-15 갱신)** — 기초 구조(PR #174) + 서버 계약 정합·토큰 저장
> (`network-envelope-token-storage`, PR #190) + API 표면 14(`data-api-service-layer`, PR #197) +
> **image·member·parfait-image 6**(`image-api-service-layer`·`member-parfait-image-api-service-layer`,
> **PR #230 머지 완료**)까지 들어와 있다
> ([[0017-remote-network-datasource]]·[[0019-encrypted-token-storage]]).
> 아래 서술은 전부 develop 코드 기준이다 — `ApiCaller` 진입점 넷, **Service 7개**
> (`AuthService`·`PolicyService`·`ParfaitGroupService`·`ParfaitService`·`ImageService`·`MemberService`·
> `ParfaitImageService`), **remote DataSource 7쌍**, `Temp*` 예시 세트 삭제.
> **2026-08-15 PR #250으로 표면이 25 엔드포인트가 됐다** — 서버 delta가 벌린 5건(파르페 오늘·과거 조회,
> 토핑 테두리 수정·삭제, 회원 탈퇴)이 들어오며 **Android가 쓰기로 한 서버 엔드포인트 전량을 다시 덮는다**
> (서버 26 − 애플 로그인 1 − 테스트 전용 회전 1) → [api/README.md](../api/README.md).
> 이 라운드는 **Service·DataSource가 하나도 안 늘고 함수만 늘어 DI 바인딩이 한 줄도 안 붙은 첫 사례**다
> ([spec](../specs/archive/2026-08-15-parfait-canvas-topping-member-api-service-layer.md)).
> **2026-08-15 갱신 — 첫 소비처가 develop에 들어왔다**(PR #241 `80895eb1`).
> `AuthRepository`/`AuthRepositoryImpl` + `LoginWithKakaoUseCase`가 A-002 카카오 로그인을
> 결선했다 → [a002-kakao-login-api](../specs/archive/2026-08-13-a002-kakao-login-api.md).
> **같은 날 네 라운드가 더 붙어 소비처가 넓어졌다**(PR #242·#243·#244·#248) — 약관 조회·회원가입
> (`PolicyRepository` 신설 + `AuthRepository.signUp`)과 그룹 목록·생성·참여·닉네임 변경이 화면까지 이어졌다.
> 이로써 **auth·policy·parfait-group 세 도메인이 화면 소비처를 가진다**. 나머지 4 도메인
> (parfait·image·member·parfait-image)은 **표면은 전량 있는데 Repository가 0건**이다 — PR #250이 표면을
> 채웠어도 그 위층은 그대로다.
> **2026-08-15 — auth 도메인이 닫혔다**(PR #260). `reissue`는 `TokenAuthenticator`가, `logout`은
> `AuthRepository.logout()` → `LogoutUseCase` → S-001 앱 설정이 소비한다. 애플을 뺀 auth 4 엔드포인트
> 전부가 호출부를 가진다(아래 "401 자동 재발급·세션 종료").
> **2026-08-16 PR #266으로 표면이 27 엔드포인트가 됐다** — 서버 delta가 벌린 2건(캔버스 상세 조회
> `GET .../parfaits/{parfaitId}` · 배경 변경 `PATCH .../parfaits/{parfaitId}/background`)이 **같은 날**
> 들어와 다시 전량을 덮는다(서버 28 − 애플 로그인 1 − 테스트 전용 회전 1). **DI 바인딩이 한 줄도 안 붙는
> 두 번째 라운드**이고, 배경 변경은 parfait 도메인의 **첫 요청 DTO**다
> ([spec](../specs/archive/2026-08-16-canvas-detail-background-api-service-layer.md)).
> ⚠️ **2026-08-16 — parfait 도메인에 표면을 건너뛴 소비자가 생겼다**(PR #259). C-201 캘린더의
> `GetParfaitHistoriesUseCase`·`GetParfaitYearsUseCase`가 KDoc으로 파르페 조회 두 엔드포인트를
> 가리키면서 **`ParfaitRemoteDataSource`를 쓰지 않고 UseCase 본문에서 mock을 만든다** — Repository가
> 0건인 것은 그대로인데 그 자리를 채울 소비자가 mock으로 먼저 생긴 형태다
> ([api/parfait.md](../api/parfait.md) Android 매핑 · [open-questions](../synthesis/open-questions.md)).
> 📌 **2026-08-16 — member 도메인이 Repository를 얻었다**(PR #263). `MemberRepository`가 `users/me`
> 조회와 닉네임 변경을 소비하고 로컬 SSoT에 쓴다 — Repository가 0건이던 네 도메인이 **셋**
> (parfait·image·parfait-image)으로 줄었다. member에 남은 공백은 **탈퇴 하나**다(표면은 있고 화면은
> 여전히 stub) → [api/member.md](../api/member.md).
> 📌 **2026-08-17 — parfait 도메인도 Repository를 얻었다**(PR #268). `ParfaitRepository`가 오늘·목록·상세
> 셋을 열고 UseCase 둘을 거쳐 **C-001 캔버스 화면까지** 이어졌다 — Repository가 0건인 도메인은 **둘**
> (image·parfait-image)로 줄었다. 같은 라운드가 **표면 우회 소비자를 없애지는 않았다** — 달력 UseCase
> 둘은 그대로 mock이다 → [c001-canvas-today-detail 스펙](../specs/archive/2026-08-17-c001-canvas-today-detail.md).
> ✅ **2026-08-17 — 표면 우회 소비자가 사라졌다**(PR #279). 달력 UseCase 둘이 `ParfaitRepository`를
> 주입받고 `getYears`가 인터페이스에 올라왔다. **`:data` 표면을 건너뛰는 프로덕션 소비자는 0건**이 됐고,
> `ParfaitHistory` 삭제로 `domain/model/`의 하위 패키지도 아홉으로 줄었다
> → [c201-canvas-calendar-server 스펙](../specs/archive/2026-08-17-c201-canvas-calendar-server.md).
> ✅ **2026-08-17 — parfait-group 도메인이 표면을 다 소비했다**(PR #285·#287). `ParfaitGroupRepository`가
> 상세·나가기·신고를 더해 **8/8**이 됐고 S-101 그룹 설정이 셋 다 소비한다
> ([api/parfait-group.md](../api/parfait-group.md) `android_status: done`). Repository가 0건인 도메인은
> 그대로 **둘**(image·parfait-image)이다
> → [s101-group-setting-api 스펙](../specs/archive/2026-08-17-s101-group-setting-api.md).
> ✅ **2026-08-19 — member 도메인의 마지막 공백이 닫혔다**(PR #306). `MemberRepository.withdraw`와
> `WithdrawUseCase`가 붙어 S-001 Danger Zone의 탈퇴가 실제 요청을 보낸다
> ([api/member.md](../api/member.md) `android_status: done`). 표면만 있고 소비처가 없는 도메인은
> 그대로 **둘**(image·parfait-image)이다.
> ✅ **2026-08-20 — 그룹 정보가 두 번째 로컬 SSoT를 얻었다**(PR #307 develop 머지, `8ca3329a`).
> `GroupLocalDataSource`(인메모리)가 목록·상세를 들고 `ParfaitGroupRepository`가 읽기를 `Flow`로만
> 노출한다 — G-001·C-001·S-101 세 화면이 조회 결과를 자기 State에 넣지 않고 구독한다. 부수적으로
> **그룹명 하나 때문에 목록을 다시 부르던 두 번째 HTTP 호출이 사라졌다**(OQ-P-216 ③ 해소)
> → [group-ssot 스펙](../specs/archive/2026-08-17-group-ssot.md).
> **`combine`은 오래 안 살았다** — 그 자리를 만든 이유(계약에 그룹명이 없다)가 다음 라운드에 사라져
> PR #308이 `combine`째 걷었다(위 "UseCase 하나가 Repository를 두 번 부르는" 항목).
> 계정 정보(영속)와 갈리는 점은 **프로세스 수명**이다 — 세션 종료 시 비우는 경로가 셋이고
> (`LogoutUseCase`·`TokenAuthenticator`·`WithdrawUseCase` 위임), 캐시 clear를 계정 정보 clear **앞에** 둔다
> (뒤에 두면 DataStore IO가 던질 때 그룹 캐시가 안 지워진다) → [ADR-0023](../adr/0023-group-in-memory-ssot.md).
> **실서버 요청 검증은 여전히 0건**(실기기 미수행) → [open-questions](../synthesis/open-questions.md).

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
  | `safeApiCallWithoutData` | envelope, `data` 안 봄 | 본문은 `ApiResponse<Unit>`이지만 payload가 의미 없는 API — **토핑 삭제**(200 + `data: null`) |
  | `safeApiCallNoContent` | 본문 자체가 없음(204) | 서비스 메서드가 `Unit` 반환 — `logout` · **회원 탈퇴** |

  **네 진입점이 2026-08-15(PR #250)에 전부 소비처를 얻었다.** 그전까지 `safeApiCallWithoutData`만
  프로덕션 호출부가 0건이라 死코드로 지적돼 있었는데, 같은 delta에 들어온 **두 DELETE가 서버 쪽 성공
  표현이 갈려** 각각 다른 진입점으로 붙었다 — 토핑 삭제는 envelope가 오고(200 + `data: null`) 회원
  탈퇴는 본문이 없다(204). 같은 메서드·같은 "삭제"인데 진입점이 다른 이유가 이것이다
  ([api/parfait-image.md](../api/parfait-image.md)·[api/member.md](../api/member.md)).

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
  동일(`KakaoLoginRequest`→`KakaoLoginRequest.kt`). **예외는 중첩 응답 DTO 하나**다: 상위 응답 안에만
  나타나는 객체는 상위 응답 파일에 함께 둔다(`PlaceParfaitImageResponse.kt`의 `PlacedByResponse`,
  `GetTodayParfaitResponse.kt`의 멤버·배경·토핑·배치자, `PastParfaitsResponse.kt`의 원소). 근거는
  **서버가 한 파일에 담은 것을 앱도 한 파일에 담아야 계약 문서와 눈으로 대조된다**는 것이고, 그래서
  `PlacedByResponse`라는 같은 이름이 `response/parfait`·`response/parfaitimage` 두 패키지에 각각 산다
  (서버가 그렇다 — wire DTO는 서버의 거울이라 이름을 바꾸지 않는다). domain VO에는 이 예외가 없다.
  도메인별로 여러 선언을 한 파일에 묶어두면(예:
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
- **401 자동 재발급·세션 종료**(#260 develop 머지, 2026-08-15): 만료를 다루는 주체가 생겼다.
  `TokenAuthenticator`(`network/`, OkHttp `Authenticator`)가 401을 가로채 `@NoAuth` 가드 → 루프 가드
  → `Mutex` → 선점 확인 → 재발급 순으로 판단하고 새 토큰을 단 요청을 돌려준다. 화면은 성공 경로에서
  아무것도 보지 못한다. **재발급은 자격증명을 안 붙이는 전용 표면으로 나간다**
  (`@UnauthenticatedClient` `OkHttpClient`·`Retrofit`·`AuthService`, `model/qualifier/`) — 같은
  클라이언트를 타면 `authenticate()`가 점유한 슬롯 뒤에서 큐잉돼 per-host 한도(기본 5)가 차는 순간
  앱 전체 네트워크가 멈춘다. `newBuilder()` 파생은 부모 `Dispatcher`를 물려받아 무효라 `Dispatcher()`를
  직접 만든다. 부수 효과로 `Retrofit`↔`OkHttpClient`↔`Authenticator` Dagger 순환이 사라져 `Provider`
  지연 주입이 필요 없다. **실패는 두 부류**다 — 서버가 refresh token을 거절한 경우(401, 또는 본문
  `code`가 `INVALID_TOKEN`·`EXPIRED_TOKEN`·`FORBIDDEN_REFRESH_TOKEN`)만 `clear()` + `ForcedLogout`,
  네트워크 실패·5xx·본문 없는 403은 **토큰을 유지**한 채 `null`을 반환해 원요청 401이 화면의 기존
  `AppError` 경로로 간다. 세션 종료는 `:domain`의 `SessionEvent.ForcedLogout`·`SessionEventSource`로
  알리고 구현 `SessionEventBus`(`session/`, `Channel(CONFLATED)` + `receiveAsFlow()`)가 발행·구독을
  겸하며, **수집은 앱 루트 `MainRoute` 한 곳**이다([ADR-0021](../adr/0021-token-refresh-forced-logout.md),
  [spec](../specs/archive/2026-08-15-session-token-refresh-infra.md)). `NetworkModuleTest`가 두
  클라이언트가 `Dispatcher`·인증기·`AuthInterceptor`를 공유하지 않는다는 **배선의 구조적 성질**을
  잠근다 — 데드락 자체는 재현하지 않는다(회귀가 실패가 아니라 무한 대기로 나타난다).
- **토큰·계정 정보 저장 경로**: `CryptoManager`(Android Keystore AES/GCM, `security/`) →
  **`EncryptedPreferences`**(`datastore/`) → `EncryptedTokenStore`(`TokenStore` 구현,
  `source/token/local/`) → `TokenStore`(`LocalDataSourceModule.bindTokenStore`) →
  `TokenStoreTokenProvider`(`NetworkModule.provideTokenProvider`) → `AuthInterceptor`.
  `DataStore<Preferences>`에는 `IV+암호문` Base64 문자열이 들어간다. 근거·대안은
  [[0019-encrypted-token-storage]].
  > 🔁 **2026-08-16(PR #263) — 암호화 접근이 프록시로 모였다.** 같은 저장 형태를 쓰는 저장소가 둘이
  > 되면서(계정 정보 `UserInfoLocalDataSourceImpl`, [ADR-0022](../adr/0022-user-info-local-ssot.md))
  > 쓰기의 암호화·읽기의 복호화·**못 읽는 저장분 폐기**를 `EncryptedPreferences`가 갖는다. 저장소가
  > 넘기는 것은 **폐기 범위**(`onDecodeFailure`)와 **해석 방법**(`decode`)뿐이다 — 토큰은 한 짝 전체를
  > 지우고(같은 키로 암호화돼 하나를 못 읽으면 둘 다 못 읽는다) 계정 정보는 자기 키 하나만 지운다.
  > **폐기 조건이 좁아졌다**: 값을 손에 넣고도 해석하지 못한 경우만 지우고, **저장소 읽기 자체가
  > 실패하면(디스크 IO) 아무것도 지우지 않는다** — 값이 손상됐다는 근거가 없는데 일시적 실패로
  > 지우면 다음 시도에 살아날 세션까지 잃는다(이전 as-built의 "I/O 실패도 토큰 삭제"가 정정됐다).
  > 쓰기는 여러 키를 **한 `edit` 블록**에서 처리해 반쪽만 저장된 상태가 보이지 않고, 읽기 구독은
  > **복호화 전 암호문 상태에서 `distinctUntilChanged`**를 건다 — DataStore를 저장소들이 공유해
  > 토큰 재발급 저장이 무관한 구독자(계정 정보를 보는 편집 중 입력 필드)를 흔들기 때문이고,
  > 복호화 뒤에 끊으면 이미 매번 Keystore를 두드린 뒤라 비용을 못 던다.
- **로깅**: `HttpLoggingInterceptor` 레벨은 `BuildConfig.DEBUG`로 게이팅(debug=`BODY`,
  release=`NONE`) — release에서 토큰·바디 노출 방지. 추가로 `redactHeader("Authorization")`를 걸어
  debug 빌드에서도 헤더 값을 가린다. 설정은 `NetworkModule`의 private `loggingInterceptor()` 한
  자리에서 만들어 **두 클라이언트가 같은 처리를 받는다**(#260). **바디는 redact 대상이 아니다** —
  `reissue`·`logout` 요청 바디의 refresh token은 debug logcat에 평문으로 남고, #260으로 두 요청
  **모두 실제 호출부를 얻었다**(이전에는 이론적 노출이었다) → [open-questions](../synthesis/open-questions.md).
- **응답 매핑**: 원격 DataSource는 **도메인 모델을 반환**한다(`PolicyRemoteDataSource.getPolicies():
  Result<List<PolicyVO>>`). 서버 응답 타입(`service.model.response`의 `PolicyResponse`/
  `PolicyItemResponse`)은 data 안에서만 살고, `source.<도메인>.mapper`의 `internal` 확장 함수
  (`PolicyItemResponse.toPolicyVO()`, 파일 `VOMapper.kt`)가 경계에서 변환한다. 변환은
  `ApiCaller#safeApiCall(block, transform)`의 `transform` 인자로 걸어 호출과 같은 가드 안에서
  실행한다(위 "네트워킹 → 응답 계약" 참고) — `.map { }`으로 밖에서 잇지 않는다. data 전용 중간 모델
  (구 `model.dto`)은 두지 않는다 — Response 복제본이라 변환 단계만 늘기 때문. 접미사 규약(`…VO` vs
  기존 무접미사)은 미결 → [open-questions](../synthesis/open-questions.md).

  **여러 도메인이 같은 변환을 쓰면 `source.common.mapper`로 올린다**(2026-08-19). 첫 사례는
  `NametagChipTypeMapper.kt`의 `String?.toNametagChipType()`으로, group·parfait 두 매퍼가 각각
  `private` 사본을 갖고 있던 것을 `internal` 하나로 합쳤다. 기준은 **소비처가 둘 이상**이라는 것뿐이다 —
  `:data` 안에서 닫히는 변환이라 feature 쪽 복제를 묶어 두는 모듈 가시성 문제가 여기엔 없다
  ([module-structure](module-structure.md)). 도메인 하나만 쓰는 변환은 그대로 `source.<도메인>.mapper`에
  둔다. 플랫폼 헬퍼(`FileProvider`·로거 따위)는 `data/utils` 소관이라 여기 오지 않는다.

  **매퍼는 단독 테스트하지 않는다(2026-08-11 규약).** 매퍼의 유일한 호출자가 DataSource라
  `XxxRemoteDataSourceImplTest`가 이미 매퍼를 통과시킨다 — 별도 `XxxVOMapperTest`는 같은 것을 두 번
  검증한다. 판단이 든 변환(문자열→enum 매핑과 미지 값 폴백, nullable 처리, 기본값, 단위 변환, 같은
  타입 필드의 배선)은 **DataSource 테스트의 케이스로** 잠근다. 규약 본문과 개정 경위는
  [unit-test-infrastructure 스펙](../specs/archive/2026-08-06-unit-test-infrastructure.md) "테스트 규약" 11번.
  develop의 `XxxRemoteDataSourceImplTest`는 **image·member·parfait·parfaitgroup·parfaitimage·policy 여섯**이다
  (PR #250이 parfait를 신설하고 member·parfaitimage를 보강, PR #266이 parfait를 15 → 25 케이스로 보강).
  ✅ **마지막 예외가 닫혔다(2026-08-20, PR #308·#310 develop 머지)** — `ParfaitGroupRemoteDataSourceImplTest`가
  신설되고 `MyParfaitGroupVOMapperTest`가 삭제돼 **저장소에 `XxxVOMapperTest`가 0개**다. 그 파일이 규약
  예외로 살아 있던 동안 무엇을 했는지가 삭제 사유다 — 오프셋 붙은 입력을 스스로 지어 넣고 단언해
  `recentImageUploadedAt` 파싱 버그를 초록으로 지켜 왔다([api/conventions.md](../api/conventions.md)의
  "Android 불일치"가 2건에서 0건이 된 건 중 하나가 이것이다) → [server-delta 스펙](../specs/archive/2026-08-19-server-delta-nametag-chip-keys.md).
- **요청 방향 변환도 같은 `VOMapper.kt`에 둔다.** 응답만 매퍼를 거치는 것이 아니다 — domain 타입이
  wire 형태보다 좁을 때 펴는 일도 매퍼가 한다. 선례는 `source.parfaitimage.mapper`의
  `ToppingTransform.toPlaceRequest(imageId, border)`로, sealed `ToppingBorder`(`None`/`Solid(color, width)`)를
  서버가 받는 평면 3필드(`borderType`·`borderColor`·`borderWidth`)로 편다. 2026-08-15에 테두리 수정
  요청(`ToppingBorder.toUpdateBorderRequest()`)이 붙으며 그 평탄화가 두 곳에서 필요해져
  `private fun ToppingBorder.flatten()`으로 뽑혔다 — **펴는 규칙은 한 자리에 둔다**.
  2026-08-16(PR #266)에 `source.parfait.mapper`의 `CanvasBackgroundEdit.toRequest()`가 붙어 **세 번째
  사례**가 됐다 — 서버 요청이 `{ type, value, imageId }` 평면인데 `type`에 따라 한쪽이 필수인
  **조건부 필수**라, 그 제약을 sealed(`Color(hex)`/`Image(imageId)`)로 세우고 매퍼가 편다. 여기서는
  **읽기 모델을 재사용하지 못한다는 사정이 더 있다** — 이미지 배경이 쓸 때 `imageId`, 읽을 때 URL이라
  `CanvasBackground`(읽기)와 `CanvasBackgroundEdit`(쓰기)가 짝이지만 같은 타입이 아니다
  ([api/parfait.md](../api/parfait.md)). **DTO에는 sealed·value class·enum을
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
