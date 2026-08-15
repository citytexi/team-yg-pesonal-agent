---
id: session-token-refresh-infra
title: 세션 인프라 — 401 자동 재발급 · 강제 로그아웃 이벤트 · 로그아웃 결선 (Token Refresh Infra)
status: draft
category: behavior-spec
platforms: android
verified: 2026-08-15
related_code: TokenAuthenticator, SessionEventBus, AuthInterceptor, TokenStore, EncryptedTokenStore, AuthRemoteDataSource, AuthRepositoryImpl, AuthService#postAuthReissue, AuthService#postAuthLogout, NetworkModule, AppSettingViewModel
related_adr: ADR-0021, ADR-0019, ADR-0017, ADR-0020
related_spec: network-envelope-token-storage, a002-kakao-login-api
related_architecture: data-layer
supersedes:
superseded_by:
tags: [spec, parfait, auth, network, session]
---

# Spec: 세션 인프라 — 401 자동 재발급 · 강제 로그아웃 · 로그아웃 결선

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처. 본문은 설계 내용에 집중.

## 목표

access token이 만료되면 화면이 알아채지 못한 채 재발급되고 원요청이 이어지게 한다. 재발급까지
실패하면 앱 전체가 한 번에 로그인 화면으로 빠진다. 사용자가 직접 누르는 로그아웃도 같은
정리 경로를 쓴다.

지금은 `reissue`가 `AuthRemoteDataSource`까지만 있고 호출부가 없다. `AuthInterceptor`는 헤더를
붙이기만 하므로 access token이 만료되는 순간 모든 인증 API가 401로 깨진다. 로그아웃은
`AppSettingViewModel`에 stub으로 남아 있다.

## 범위

- **포함**
  - `TokenAuthenticator`(OkHttp `Authenticator`) — 401 가로채 재발급 후 원요청 재시도
  - 동시 401 직렬화 · 선점 확인 · 재시도 루프 가드
  - 강제 로그아웃 이벤트(`SessionEvent.ForcedLogout`)와 앱 루트 단일 구독
  - 로그아웃 API 결선(`AuthRepository.logout()` → `LogoutUseCase` → `AppSettingViewModel`)
- **제외**
  - **userInfo SSoT**(`GET /api/v1/users/me` → DataStore) — 후속 스펙. 이 스펙은 토큰만 정리한다
  - **자동로그인 라우팅**(스플래시 분기) — 후속 스펙. 이 인프라 위에 얹는다
  - **회원 탈퇴** — 서버에 엔드포인트 계약이 없다(`api/auth.md`)
  - 401 외 상태코드의 자동 재시도

## API / 인터페이스

```kotlin
// data/network/TokenAuthenticator.kt
class TokenAuthenticator @Inject constructor(
    private val tokenStore: TokenStore,
    private val authService: Provider<AuthService>,
    private val sessionEventBus: SessionEventBus,
) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request?
}
```

`Provider<AuthService>`인 이유 — `Retrofit`이 `OkHttpClient`를 요구하고 `OkHttpClient`가 이
`Authenticator`를 요구한다. 직접 주입하면 Dagger 순환이므로 지연 주입으로 끊는다.

```kotlin
// domain/model/session/SessionEvent.kt
sealed interface SessionEvent {
    /** refresh token 이 서버에 거절당해 세션을 더 유지할 수 없다 */
    data object ForcedLogout : SessionEvent
}

// domain/repository/session/SessionEventSource.kt
interface SessionEventSource {
    val events: Flow<SessionEvent>
}
```

feature 모듈은 `:data`를 보지 않으므로(ADR-0001) 인터페이스는 `:domain`에 두고 구현체
`SessionEventBus`(`data/session`, `@Singleton`)가 발행과 구독을 겸한다.

**`Channel(CONFLATED)` + `receiveAsFlow()`를 쓴다.** `SharedFlow`가 아닌 이유는 ADR-0020이
이펙트에서 정리한 것과 같다 — 구독자가 없는 순간 발행해도 버퍼에 남아야 하고, 이미 소비한
이벤트가 재구독으로 다시 오면 안 된다. 소비자가 앱 루트 하나뿐이라는 것도 `Channel`의 단일
소비자 성질과 맞는다. `CONFLATED`인 이유는 401이 여러 건 터져 `ForcedLogout`이 연달아
발행돼도 이동은 한 번이어야 하기 때문이다.

```kotlin
// domain/repository/auth/AuthRepository.kt — 추가
suspend fun logout(): Result<Unit>

// domain/usecase/auth/LogoutUseCase.kt
class LogoutUseCase @Inject constructor(private val authRepository: AuthRepository) {
    suspend operator fun invoke(): Result<Unit> = authRepository.logout()
}
```

## 동작 / 상태

### 401 재발급 순서

`authenticate()`는 아래 순서로 판단한다. 각 단계는 앞 단계가 통과했을 때만 실행된다.

1. **루프 가드** — `response.priorResponse` 체인을 세어 2 이상이면 `null`. 서버가 새 토큰에도
   401을 주는 경우 무한 재시도를 끊는다
2. **`Mutex` 획득** — 재발급 호출을 직렬화한다. 401이 동시에 여러 건 나도 재발급은 하나씩
3. **선점 확인** — 실패한 요청이 들고 갔던 `Authorization` 헤더 값과 지금 `TokenStore`의 access
   token을 비교한다. 다르면 앞선 요청이 이미 갱신을 끝낸 것이므로 **재발급을 건너뛰고** 새
   토큰으로 요청만 다시 만든다
4. **재발급** — `AuthService.postAuthReissue(refreshToken)`. 성공하면 `TokenStore.save()` 후 새
   access token을 단 요청을 반환한다

`Authenticator`는 동기 API라 `runBlocking`을 쓴다. 기존 `TokenStoreTokenProvider`가 이미 같은
방식이라 새로 들이는 관례가 아니다.

선점 확인이 없으면 `Mutex`만으로는 부족하다 — 직렬화될 뿐 대기하던 요청들이 차례로 각자
재발급을 쏜다.

### 실패 갈래

| 상황 | 판단 | 토큰 | 이벤트 | 반환 |
|---|---|---|---|---|
| 재발급 401 (`INVALID_TOKEN`·`EXPIRED_TOKEN`·`FORBIDDEN_REFRESH_TOKEN`) | refresh token이 죽었다 | `clear()` | `ForcedLogout` | `null` |
| 재발급 네트워크 실패·타임아웃 | 세션은 살아있을 수 있다 | **유지** | 없음 | `null` |
| 재발급 5xx | 서버 장애 | **유지** | 없음 | `null` |
| refresh token 부재 | 로그인한 적 없다 | 그대로(지울 것 없음) | 없음 | `null` |

네트워크 실패를 강제 로그아웃으로 보지 않는 이유 — 연결이 끊긴 것과 자격증명이 죽은 것은 다른
사건이다. 지하철·엘리베이터에서 앱을 켠 것만으로 재로그인을 요구하게 된다. `null`을 반환하면
원요청이 401로 화면에 도달하고, 화면은 기존 `AppError` 경로로 실패를 표시한다(ADR-0020).

refresh token 부재를 따로 가르는 이유 — 로그인 전 화면이 인증 API를 때리면 이 경로로 들어온다.
여기서 `ForcedLogout`을 쏘면 로그인 화면에서 로그인 화면으로 튕긴다.

### 강제 로그아웃 소비

`SessionEventSource.events`는 **앱 루트 한 곳에서만** 수집한다(NavHost 상위). 화면마다 구독하면
같은 이벤트로 여러 번 이동한다.

```
ForcedLogout 수신 → navigator.clearBackStack() → NavKeyLogin
```

### 사용자 로그아웃

```
ClickLogout → LogoutUseCase → AuthRemoteDataSource.logout(refreshToken) → TokenStore.clear() → NavigateToLogin
```

`AuthRemoteDataSource.logout(refreshToken)`은 **이미 구현돼 있다**(`AuthService.postAuthLogout` +
`ApiCaller.safeApiCallNoContent`). 없는 것은 그 위의 `AuthRepository.logout()`과 호출부다.

**서버 호출이 실패해도 로컬 토큰은 지운다.** 사용자가 로그아웃을 눌렀으면 이 기기에서는 나가는
것이 기대 동작이고, 서버 세션 정리 실패는 로그로만 남긴다. 연타는 `launch(key)` 가드로 막는다.

`POST /api/v1/auth/logout`은 인증 도메인에서 유일하게 화이트리스트 밖이라 **access token과
refresh token이 둘 다 필요하다**(`api/auth.md`). 즉 access token이 만료된 상태의 로그아웃은
`TokenAuthenticator`를 한 번 타고 나간다.

## 표시·제어 규칙

- 재발급 성공 경로에서 화면은 아무것도 보지 못한다. 로딩·에러 표시가 생기지 않는다
- `ForcedLogout` 이동은 백스택을 비운다 — 뒤로가기로 인증이 필요한 화면에 돌아갈 수 없다
- 로그아웃 버튼은 요청 중 비활성

## 파일 구성

| 파일 | 역할 |
|---|---|
| `data/network/TokenAuthenticator.kt` | 401 가로채 재발급·재시도. 신규 |
| `data/session/SessionEventBus.kt` | `SessionEventSource` 구현. 발행+구독, `@Singleton`. 신규 |
| `domain/model/session/SessionEvent.kt` | `ForcedLogout`. 신규 |
| `domain/repository/session/SessionEventSource.kt` | 구독 인터페이스. 신규 |
| `domain/usecase/auth/LogoutUseCase.kt` | 신규 |
| `data/di/NetworkModule.kt` | `OkHttpClient`에 `authenticator(...)` 결합 |
| `domain/model/error/ServerErrorCode.kt` | `Auth`에 `INVALID_TOKEN`·`EXPIRED_TOKEN`·`FORBIDDEN_REFRESH_TOKEN` 추가 |
| `data/repository/auth/AuthRepositoryImpl.kt` | `logout()` 추가 |
| `domain/repository/auth/AuthRepository.kt` | `logout()` 추가 |
| `feature/app/setting/.../AppSettingViewModel.kt` | 로그아웃 stub 제거 + `NavigateToLogin` |
| 앱 루트 Composable | `SessionEventSource` 단일 구독 |

## 테스트

**`TokenAuthenticator`** — MockWebServer (`data/src/test/`)

- 401 → 재발급 200 → 원요청 재시도 성공, 새 토큰이 헤더에 실림
- 401 → 재발급 401 → `TokenStore.clear()` + `ForcedLogout` 1건 + 원요청 실패
- 401 → 재발급 네트워크 실패 → **토큰 유지**, 이벤트 0건
- 앞선 401이 갱신을 끝낸 뒤 뒤따라온 401 → **재발급 없이** 새 토큰으로 재시도(선점 확인).
  실제 동시 실행 대신 순차로 검증한다 — 스레드를 띄우면 결과가 스케줄러에 좌우돼 회귀 감지선이
  흐려진다. 막으려는 것은 "대기하다 깨어난 요청이 또 재발급하는 것"이고 그건 순차로 재현된다
- 서버가 계속 401 → 재시도 2회에서 중단(루프 가드)
- refresh token 부재 → 이벤트 0건, `clear()` 없음

**`AuthRepositoryImpl.logout()`** — 기존 `AuthRepositoryImplTest`에 추가

- 서버 성공 → 로컬 clear
- 서버 실패 → **로컬 clear 수행**, 실패는 전파하지 않고 로그만

**`AppSettingViewModel`**

- 로그아웃 클릭 → `LogoutUseCase` 1회 + `NavigateToLogin`
- 연타 → 1회만

앱 루트의 이벤트 구독은 Compose 테스트 비용 대비 이득이 적어 수동 확인으로 둔다. 대신 발행
측(`TokenAuthenticator`)을 위처럼 조인다.

## 주의 / 열린 질문

- **`runBlocking`이 OkHttp 디스패처 스레드를 잡는다.** `Authenticator` 계약이 동기라 피할 수
  없다. 재발급이 타임아웃(15초)까지 늘어지면 그 스레드가 묶인다 — 실측 전이다
- **`ForcedLogout` 수집 지점이 앱 루트 한 곳이라는 것은 규약일 뿐 기계 검사가 없다.**
  `BaseViewModel.effect`가 구독자 수를 세어 로그를 남기는 것과 같은 방어를 둘지 미정
- **재발급 성공 후 원요청이 다시 401이면** 루프 가드에 걸려 그냥 실패한다. 이때 세션을 버릴지
  유지할지 정하지 않았다 — 서버가 access token은 인정하는데 리소스 권한이 없는 경우와
  구분되지 않는다
- 회원 탈퇴는 서버 계약 신설 후 별건. `AppSettingViewModel.handleConfirmWithdraw` stub 유지
