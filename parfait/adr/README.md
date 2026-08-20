# Architecture Decision Records

이 디렉토리는 Parfait 프로젝트의 주요 아키텍처 결정을 기록합니다.

> ADR 형식: [Michael Nygard의 경량 ADR](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) 기반
>
> 형식 권위 출처: [`template.md`](template.md)

| ADR | Title | Status | Date | Postscript |
|-----|-------|--------|------|-----------|
| [0001](0001-layered-multi-module.md) | 레이어드 다중 모듈 구조 (core/data/domain/feature) | accepted | 2026-04-19 | 의존 단방향 |
| [0002](0002-feature-api-impl-split.md) | feature 모듈을 :api / :impl로 분리 | accepted | 2026-05-19 | feature 간 :api만 참조 |
| [0003](0003-convention-plugins-version-catalog.md) | build-logic 컨벤션 플러그인 + 버전 카탈로그 | accepted | 2026-05-14 | 플러그인 ID `com.teamyg.parfait.plugin.*` |
| [0004](0004-hilt-ksp-di.md) | Hilt + KSP DI, 스코프 분리 | accepted | 2026-05-14 | Singleton / ActivityRetained |
| [0005](0005-custom-mvi-baseviewmodel.md) | 자체 MVI (BaseViewModel<S,I,E>) | accepted | 2026-05-09 | 외부 MVI 프레임워크 미사용 |
| [0006](0006-navigation3-custom-navigator.md) | Navigation3 + 커스텀 Navigator + 엔트리 빌더 | accepted | 2026-05-19 | alpha(ResultEventBus 목적) |
| [0007](0007-compose-material3-design-tokens.md) | Compose + Material3 + 디자인 토큰 | superseded by 0010 | 2026-05-12 | 100% Compose 원칙은 0010에 승계 |
| [0008](0008-datastore-local-persistence.md) | 로컬 영속화 DataStore — Room 미채택 | accepted | 2026-06-10 | 파일+메타 이원 |
| [0009](0009-usecase-injectable-invoke.md) | UseCase = 주입 클래스 + operator invoke | accepted | 2026-06-21 | 인터페이스 없이 |
| [0010](0010-custom-compositionlocal-theme.md) | 자체 CompositionLocal 디자인시스템 테마 | accepted | 2026-07-10 | 0007 대체, MaterialTheme·dynamic color 배제 |
| [0011](0011-cross-module-bitmap-abstraction.md) | 크로스모듈 비트맵 추상화 (BitmapWrapper/AndroidBitmap) | accepted | 2026-07-12 | domain 순수성 유지, 현재 stub |
| [0012](0012-mlkit-subject-segmentation.md) | 이미지 세그멘테이션 — ML Kit Subject Segmentation 온디바이스 | accepted | 2026-07-12 | beta·GMS·install-time 모델 |
| [0013](0013-firebase-fcm-crashlytics.md) | Firebase 도입 — FCM 푸시 + Crashlytics + Analytics | accepted | 2026-07-18 | app 모듈 집중·토큰 서버전송 후속·GMS 의존 |
| [0014](0014-logging-abstraction-kermit.md) | 로깅 추상화 — Kermit 위임 Logger 인터페이스 | accepted | 2026-07-18 | core:util:jvm, backfill(기준선 이전 존재) |
| [0015](0015-feature-common-shared-layer.md) | feature/common 공유 feature 레이어 도입 | accepted | 2026-07-21 | terms를 S-001+A-003 공유·2소비처 확정 시에만 common |
| [0016](0016-domain-result-presentation-string-mapping.md) | 유효성 결과 — domain 의미 sealed 반환 + 표시 문자열 프레젠테이션 매핑 | accepted | 2026-07-23 | NicknameResult sealed·core:ui `toStringResource`·ui→domain 의존 |
| [0017](0017-remote-network-datasource.md) | 원격 네트워크 DataSource·서비스 규약 (AndroidNetworkConventionPlugin + ApiResponse/safeApiCall) | accepted | 2026-07-26 | `source.<도메인>.remote` 관례, 로깅은 `BuildConfig.DEBUG` 게이팅 |
| [0018](0018-backdrop-blur-haze.md) | 배경 블러에 Haze 도입 (자체 GraphicsLayer 구현 기각) | accepted | 2026-08-01 | `HazeState`는 호출 화면 소유·nullable 파라미터, 틴트는 블러와 독립 상시, API<31 폴백은 틴트만. **자체 `GraphicsLayer`+`BlurEffect`는 실기기에서 세 형태 모두 블러 미적용으로 기각** — `record` 안에 직접 그린 도형엔 effect가 걸리므로 레이어로 옮겨 담는 경로만 실패. C-101 설계도 같은 구조라 그 라운드에서 재검토 필요. 블러 검증은 극단값(40dp) 대조 필수 |
| [0019](0019-encrypted-token-storage.md) | 인증 토큰 암호화 저장 — Android Keystore AES/GCM + Preferences DataStore | accepted | 2026-08-02 | 키 별칭 1개·GCM IV 매회 신규, 복호화 실패 시 예외 전파 대신 `clear()`+`null`(재로그인 유도), Tink·EncryptedSharedPreferences 기각. as-built(#263): 암복호화·폐기가 `EncryptedPreferences` 프록시로 이동, **읽기 IO 실패는 더는 폐기하지 않는다** |
| [0020](0020-mvi-error-effect-infrastructure.md) | MVI 공통 에러·이펙트 인프라 (Channel 이펙트 · AppError · launch 가드) | accepted | 2026-08-13 | 이펙트를 `Channel(BUFFERED)`로 — `postSideEffect` 시그니처 불변이라 19개 VM·21개 수집 지점 무수정. **`SharedFlow` + `replay`는 1회성 이벤트를 재발화시켜 기각**(화면 재진입·Activity 재생성 시 내비게이션이 저절로 다시 실행), `extraBufferCapacity`는 구독자 0명일 때 유실이라 기각. `AppError` 3갈래(Network·Server·Unexpected)를 `:domain`에 두되 `Exception` 하위로 — `Result.failure` 관용구 유지. 변환은 Repository 경계, `CancellationException`은 재던짐. `launch(key)`가 중복 실행 차단, `error` 채널을 `E`와 분리. Orbit 도입·자체 재구현 모두 기각(19개 화면 재작성 비용). 트레이드오프: `Channel`은 단일 소비자 — 2중 수집은 카운트 로그로 드러냄. 🔁 **2026-08-14 결정 ④ 번복** — 공용 `error` 채널·`postError`·`CollectAppError` 철회. 이유가 설계 미덕이 아니라 타입 우회였고(베이스가 `E`를 생성 못 함), 산 것은 로그 한 줄인데 3분할 계약·이펙트와의 순서 보장·실패 없는 화면의 빈 채널을 지불했다. 실패도 화면 어휘(`E`)로 옮기고 `launch(onError=)`가 그 통로다 |
| [0021](0021-token-refresh-forced-logout.md) | 401 자동 재발급 — OkHttp Authenticator + 강제 로그아웃 이벤트 | accepted | 2026-08-15 | `TokenAuthenticator`가 401을 가로채 재발급 후 원요청 재시도. 방어 **네 겹**(`@NoAuth` 재진입 가드 · `Mutex` 직렬화 · 선점 확인 · `priorResponse` 루프 가드) — `Mutex`만으로는 대기 요청들이 차례로 각자 재발급을 쏜다. 실패를 두 부류로: 서버 401만 세션 폐기, **네트워크 실패·5xx는 토큰 유지**(오프라인 진입이 로그아웃이 되면 안 됨), refresh token 부재도 조용히 통과(로그인 화면 자기순환 방어). `SessionEvent.ForcedLogout`은 `:domain`, 구현 `SessionEventBus`는 `:data`, 수집은 앱 루트 한 곳. `Interceptor` 처리·부트스트랩 단일 호출·전역 이벤트 없이 `AppError`만·네트워크 실패도 로그아웃 모두 기각. **구현 중 최종 리뷰가 Critical 1건을 잡아 결정이 보강됐다** — 재발급이 같은 `OkHttpClient`를 타면 `authenticate()`가 디스패처 슬롯을 점유한 채 블록되고 재발급이 같은 호스트 큐에 갇혀(`maxRequestsPerHost=5` 기본) **앱 전체 네트워크가 영구 정지**한다. 재발급 전용 클라이언트(`@AuthClient`, 독립 `Dispatcher`, 인증기·`AuthInterceptor` 미부착)로 분리했고 부수적으로 Dagger 순환이 사라져 `Provider` 지연 주입이 필요 없어졌다. 방어는 세 겹이 아니라 **네 겹**(`@NoAuth` 재진입 가드 추가). 루프 가드는 **401인 선행 응답만** 센다(체인 전체를 세면 리다이렉트 1회에 재발급을 아예 못 한다). 403은 본문 `code`가 거절 코드일 때만 세션 종료 — WAF/프록시 403에 사용자가 조용히 로그아웃되는 것을 막는다. 트레이드오프: `runBlocking`의 스레드 점유는 남고, 재발급 실패 쿨다운 부재로 오프라인 지연이 직렬화된다 |
| [0022](0022-user-info-local-ssot.md) | 계정 정보 로컬 SSoT — 암호화 DataStore + Flow 구독 | accepted | 2026-08-15 | 계정 정보를 `:data` 로컬 저장소 한 곳에 두고 화면은 `Flow`로 **구독만** 한다 — 화면마다 조회하면 진입마다 중복 호출이고 한 화면의 닉네임 변경이 다른 화면에 전달될 길이 없다. 서버 조회는 **세 시점뿐**(로그인 직후·앱 진입·닉네임 변경 성공), 화면 진입마다 갱신하지 않는다. 영속하는 이유는 첫 프레임부터 값이 보이게 하려는 것(ADR-0008 DataStore). 닉네임·`memberId`가 식별 가능한 개인정보라 `CryptoManager`(ADR-0019) 재사용해 암호화하고 복호화 실패 시 저장분 폐기+`null`. `MyAccountVO`가 값 클래스·enum을 품어 그대로 직렬화되지 않으므로 `:data`에 `@Serializable` 전용 저장 모델을 둔다. **토큰과 수명 공유** — 강제 로그아웃은 `TokenAuthenticator`가 토큰을 지우는 그 자리에서 함께 지운다(정리를 이벤트 소비 측에 맡기면 이벤트 유실 시 토큰만 지워지고 계정 정보가 남는다). 화면별 조회·메모리 캐시만·평문 저장·domain이 표시 문자열 반환 모두 기각. 트레이드오프: 갱신 시점이 고정돼 타 기기 변경은 다음 진입까지 낡은 값 |
| [0023](0023-group-in-memory-ssot.md) | 그룹 정보 인메모리 SSoT — 프로세스 수명 캐시 + Flow 구독 | accepted | 2026-08-17 | 그룹 목록·상세를 `:data` 인메모리 저장소 한 곳에 두고 화면은 `Flow`로 **구독만** 한다. 지금은 화면마다 조회해 `UiState`에만 살아서 생성·참여 후 목록이 갱신되지 않고(`goToSingleClearTop`이 기존 백스택 엔트리를 재사용해 `GroupListViewModel.init`이 다시 돌지 않는다), 상세는 그룹명 하나 때문에 목록 조회를 한 번 더 부르며, 캔버스 그룹명은 하드코딩이다. ADR-0022와 형태는 같되 **영속하지 않는다** — 그룹 목록은 남이 바꾸는 서버 상태라 첫 프레임에 보여 줄 값이 낡았을 확률이 계정 닉네임과 비교가 안 되게 높고, 영속을 택하면 저장 모델·매퍼·암호화가 전부 따라온다. 저장하지 않으므로 ADR-0019의 암호화 대칭 판단도 사라진다. **미조회(`null`)와 0건(`emptyList()`)을 구분**한다(섞이면 조회 전에 빈 상태·0건 툴팁이 뜬다). 갱신 시점을 일곱으로 열거하고 후속 재조회 실패가 이미 성공한 조작을 되돌리지 않는다. 세션 종료 정리는 `LogoutUseCase`(단일 자리) + `TokenAuthenticator` — 인메모리라 프로세스가 살아 있는 계정 전환에서 이전 그룹이 남는 것이 위험이다. 그룹명 합성은 저장소가 아니라 `GetGroupDetailUseCase`의 `combine`. 영속 캐시·목록만 캐시·구독 기반 자동 갱신(stale-while-revalidate)·선택 그룹을 저장소가 소유·Repository가 `StateFlow` 직접 보유 모두 기각. 트레이드오프: 재시작마다 첫 조회 대기, 오프라인 진입은 값 없음, 캐시에서 읽는 캔버스 그룹명은 갱신 실패를 알릴 자리가 없음 |
| [0024](0024-nametag-chip-unknown-fold.md) | 모르는 Nametag 칩 값을 UNKNOWN 센티널 없이 DEFAULT 로 접는다 | accepted | 2026-08-20 | 서버가 주는 칩 문자열 중 앱이 모르는 값과 값 없음을 모두 `NametagChipType.DEFAULT`로 접고 이 축의 널 허용을 없앤다. 서버 계약이 이 필드를 비널로 좁힌 뒤(server-baseline `57529ec`, 목록의 `lastPlacedByNameTagChip`은 `COALESCE`로 채워져 토핑 0건이어도 생성자 칩이 온다) VO에서 `null`의 뜻이 "앱이 모르는 값" 하나만 남아, 그 자리를 `DEFAULT`가 대신하면 널 개념 자체가 사라진다. 매퍼에서 멈추지 않고 VO 셋(`MyParfaitGroupVO`·`ParfaitGroupMemberVO`·`CanvasMemberVO`)과 색 변환 셋까지 민 이유는 데이터가 널을 못 만드는데 타입만 널 허용이면 **도달 불가 분기**가 남기 때문이다. 부수 효과로 세 `when`이 exhaustive해져 서버가 13번째 타입을 추가하는 날 컴파일 에러가 난다. 매퍼만 바꾸는 절반 안, 그리고 이 저장소가 다른 서버 유래 enum에 쓰는 `UNKNOWN` 센티널 신설(`LoginProvider`·`ImageStatus`·`CanvasStatus`·`PolicyType`이 그 패턴이고 `ImageType`은 예외임을 KDoc에 명시) 모두 기각 — 후자는 두 상태가 구분된 채 남는 장점이 있으나 팀이 "기본 사양으로 `DEFAULT`"로 합의했고 지금 둘을 가르는 코드가 없다. 트레이드오프: 서버가 타입을 늘리면 "반납된 자리"와 구분 불가이며 데이터 레이어에서 합쳤으므로 위에서 되돌릴 수 없다. 재검토 트리거를 명시 — `YGColorChipType.Default`가 갈라지거나 13번째 타입이 실제로 오면 대안 B로 이행한다 |
| [0025](0025-topping-border-as-server-field.md) | 토핑 테두리를 픽셀에 굽지 않고 서버 필드로 보낸다 | proposed | 2026-08-20 | 테두리를 표현하는 길이 앱 안에 둘 있고 서로를 모른다 — 편집 화면은 `ToppingEditViewModel#completeEdit`에서 픽셀에 굽고, 캔버스는 서버 필드 셋을 받아 `CanvasToppingLayer`가 8방향 스탬프로 그린다. C-106 결선에서 구운 PNG + `borderType=NONE`을 보내면 화면은 맞게 보이지만 서버 필드 셋·`updateToppingBorder`·읽기 렌더러가 전부 죽은 표면이 되고 C-301 재편집이 이미지 재생성이 된다. 전환을 막는 것으로 보였던 다중 겹 우려는 사실이 아니었다 — `borderLayers`는 *"겹칠 수 없으니 마지막에 고른 하나뿐"*이라 **항상 0 또는 1**이고 서버의 단일 `SOLID(color, width)`와 1:1이다. 업로드 대상은 테두리 없는 알맹이의 **트리밍본**이다(현 `cutoutImagePath`는 재편집 좌표계를 지키려 여백을 안 걷는데, 여백이 붙으면 초기 배치 40%·48dp 계산이 어긋난다). 배치 화면·**누끼 확인 화면**·캔버스 셋이 같은 스탬프 컴포저블을 공유해 그림이 갈라질 여지를 없앤다(확인 화면을 빼면 사용자가 한 흐름에서 같은 테두리를 두 굵기로 본다). 기각: 구운 PNG + NONE(그 사이 쌓인 토핑이 전부 NONE이라 전환 비용이 시간에 비례해 커진다) · 구운 PNG + 필드도 채우기(읽기 쪽이 한 겹 더 그려 이중으로 보인다). 트레이드오프: 캐시 PNG가 흐름당 한 장 더 는다 · **굵기 거동이 바뀐다**(구운 것은 토핑과 함께 굵어졌으나 서버 `borderWidth`는 화면 dp 고정) · 편집 화면은 `originPxPerDp`로 환산해 그려 캔버스와 굵기가 어긋날 수 있다(정책 근거 없음). 시각 회귀가 유일한 실질 위험이라 PR 하나로 격리하고 실기기 확인을 붙인다 |
| [0026](0026-topping-draft-datastore-ssot.md) | 토핑 만들기 흐름 상태를 DataStore 초안 한 벌로 모은다 | proposed | 2026-08-20 | 토핑 만들기가 화면 다섯을 지나는데 확정된 편집 결과가 `SegmentationConfirmRoute`의 `rememberSaveable`에만 살아 그 화면을 벗어나면 다음 화면이 볼 길이 NavKey 인자뿐이다. 배치 API 결선이 여기에 `groupId`·`parfaitId`·`nextPositionZ`·테두리를 더하면 `NavKeyCanvasToppingPlace`가 인자 여섯이 되고 `camera`·`segmentation`이 캔버스 개념을 떠안는다(`segmentation-pipeline-hardening`이 `popUpTo` 도입 때 같은 이유로 기각했던 자리). 그래서 `:data` DataStore에 **흐름당 하나뿐인 초안**을 두고 화면들이 읽고 쓴다. **여는 시점은 흐름 진입 하나뿐** — `CanvasMain`이 카메라·갤러리로 떠날 때 캔버스 식별값으로 새로 덮어쓰고 이미지·테두리를 비운다. 낡은 초안 문제가 이 규칙 하나로 닫혀 만료·정리 경로를 따로 두지 않는다. 영속을 고른 이유는 프로세스 사망 복원이다(NavKey·`rememberSaveable`은 직렬화 복원되므로 인메모리로 옮기면 지금 있는 보장을 잃는다). 진입 캔버스가 못 박히므로 하루 경계를 넘어도 다른 캔버스로 조용히 옮겨 가지 않고 409 `PARFAIT_ALREADY_CLOSED`로 거절된다. 기각: 전부 NavKey(중간 모듈이 나르는 남의 인자가 계속 는다) · 인메모리(긴 흐름을 잃었을 때 비용이 크다) · 배치 시점 재조회(사용자가 들어간 캔버스가 아닌 곳에 올라간다). 트레이드오프: 흐름 상태가 암묵적이 되고 배치 화면 시그니처만으로는 의존이 안 보인다. ⚠️ **`TOPPING_EDIT_RESULT_KEY`는 걷지 않는다** — 소비자가 `SegmentationConfirmRoute` 말고 `CanvasBGEditRoute`(C-301 `borderOnly` 재편집)에도 있어, 걷으면 그 경로가 컴파일은 통과한 채 무반응이 된다. 결과 키는 전달 수단으로 남기고 확인 Route가 초안에 옮겨 적는다. `NavKeySegmentationConfirm`의 경로 셋도 화면 열기 인자로 남기되 겹치는 구간은 초안이 정본이다. 방어: `todayCanvas` 없으면 토핑 추가 버튼 비활성(없는 경우는 서버가 아니라 **앱이 아직 못 받은 경우**이고 그 조회 실패 표현도 이 라운드가 함께 연다) · 초안이 비면 확인 비활성 · **경로는 있는데 캐시 파일이 없으면 빈 초안 취급**(세그멘테이션 진입이 `SegmentationCacheDir#clearFiles`로 디렉토리를 비운다) · 덮어쓰기와 비우기를 단위 테스트로 고정 |

## 작성 가이드

- 파일명: `NNNN-kebab-case-title.md` (예: `0001-mvi-store-pattern.md`)
- 번호는 4자리, 순차 증가
- Status: `proposed` / `accepted` / `superseded` / `deprecated`
- 결정이 다른 ADR을 대체하면 Postscript에 supersede 관계 명시
- 새 ADR 추가 시 위 인덱스 테이블에 한 줄 등록 (ADR 파일과 README 인덱스는 같은 커밋)
- 형식 권위 출처: [`template.md`](template.md)

## ⛔ 라인번호·수치 금지 규칙 (가장 중요)

이 wiki는 **"왜 이렇게 결정했는가"(구조 결정)** 만 기록한다. 코드와 함께 바뀌어 금방 거짓이 되는 정보는 **절대 적지 않는다.**

**적지 말 것:**
- **라인번호** — `Store.kt:34`, `:78` 같은 `:NN`. refactor 한 번에 전부 어긋난다.
- **파일/화면 개수** — "화면 74개", "37개 레거시".
- **진행률·비율** — "약 70% 이행".
- **사용 횟수** — "특정 API 206회 호출".
- **빌드 스크립트 라인 번호** — 파일명까지만.

**적을 것 (안정적):**
- **파일명 + 심볼명** — `Store.kt`의 `postState`, `FooRepositoryImpl`의 `flowItems`. 심볼명은 라인보다 훨씬 오래 산다.
- **설계 결정·대안·트레이드오프** — ADR의 본질. 코드가 안 바뀌는 한 유효.
- **방향성** — "A → B로 수렴", 수치 없이.

**현재 수치가 필요하면 코드에서 직접 측정한다** (예시):

```bash
# 화면 수
find . -name '*Screen*.kt' | wc -l
# 특정 API 사용 횟수
grep -rE '\bSomeApi\b' src | wc -l
```

**왜:** 한 번 거짓이 된 수치가 섞이면 문서 전체의 신뢰가 깨진다 — "없는 것보다 못한" 상태. 검증 불가능한 라인번호를 적느니, 검증 가능한 심볼명만 남긴다.

## Frontmatter (필수)
모든 ADR은 YAML frontmatter로 메타를 단다(형식 권위: [`template.md`](template.md)). 필드: `id`(ADR-NNNN) · `title` · `status`(**proposed / accepted / superseded / deprecated**) · `date` · `deciders`(팀/역할, **실명 금지**) · `supersedes` · `superseded_by` · `related_adr` · `related_spec` · `related_architecture` · `platforms`(=android) · `tags`. 대체 시 구 문서 `superseded`+`superseded_by`, 신 문서 `supersedes`.
