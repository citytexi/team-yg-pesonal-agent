---
id: ADR-0021
title: 401 자동 재발급 — OkHttp Authenticator + 강제 로그아웃 이벤트
status: proposed
date: 2026-08-15
deciders: Parfait 팀
supersedes:
superseded_by:
related_adr: ADR-0019, ADR-0017, ADR-0020, ADR-0001
related_spec: session-token-refresh-infra
related_architecture: data-layer
platforms: android
tags: [adr, parfait, auth, network, session]
---

# ADR-0021: 401 자동 재발급 — OkHttp Authenticator + 강제 로그아웃 이벤트

> 상태·날짜·결정자·대체 관계는 위 frontmatter가 단일 출처. 본문은 결정 내용에 집중.

## 맥락

[ADR-0019](0019-encrypted-token-storage.md)가 토큰을 저장하고 [ADR-0017](0017-remote-network-datasource.md)의
`AuthInterceptor`가 access token을 헤더에 붙인다. 그러나 **만료를 다루는 주체가 없다.**
`AuthRemoteDataSource.reissue()`는 구현돼 있으나 호출부가 0건이고, access token이 만료되면 모든
인증 API가 401로 깨진 채 각 화면이 알아서 실패를 표시한다.

여기에 두 가지가 겹친다. 재발급은 **여러 요청이 동시에 401을 맞는 상황**을 전제해야 하고,
재발급마저 실패하면 **앱 전체가 반응해야 한다** — 화면 하나가 결정할 수 있는 일이 아니다.

## 결정

**OkHttp `Authenticator`가 401을 가로채 재발급 후 원요청을 재시도하고, 재발급이 서버에 거절당하면
`:domain`에 둔 단일 이벤트 스트림으로 강제 로그아웃을 알린다.**

- **`TokenAuthenticator`**(`data/network`) — `authenticate()`가 루프 가드 → `Mutex` → 선점 확인 →
  재발급 순으로 판단한다. `Authenticator` 계약이 동기라 `runBlocking`을 쓴다(`TokenStoreTokenProvider`
  선례와 동일). `Retrofit`↔`OkHttpClient`↔`Authenticator` Dagger 순환은 `Provider<AuthService>`
  지연 주입으로 끊는다.
- **동시성 방어는 세 겹이고 하나라도 빠지면 뚫린다.** `Mutex`는 재발급을 직렬화할 뿐, 대기하던
  요청들이 깨어나 차례로 각자 재발급을 쏘는 것을 막지 못한다. 그래서 `Mutex` 획득 직후 **실패한
  요청이 들고 갔던 `Authorization` 값과 현재 저장 토큰을 비교**해, 다르면 재발급 없이 새 토큰으로
  재시도만 한다. `priorResponse` 체인 길이 가드는 새 토큰에도 401이 오는 경우의 무한 재시도를 끊는다.
- **실패를 두 부류로 가른다.** 서버가 refresh token을 거절한 경우(401)만 세션을 버리고,
  네트워크 실패·5xx는 **토큰을 유지한 채** `null`을 반환해 원요청 401이 화면에 도달하게 한다.
  refresh token이 아예 없는 경우도 조용히 `null`이다.
- **`SessionEvent.ForcedLogout`은 `:domain`에 둔다.** feature 모듈은 `:data`를 보지 않으므로
  (ADR-0001) 인터페이스 `SessionEventSource`가 `:domain`에 있고, 구현 `SessionEventBus`
  (`@Singleton`, `MutableSharedFlow`)가 `:data`에서 발행과 구독을 겸한다. 수집은 **앱 루트 한 곳**
  — 화면마다 구독하면 한 이벤트로 여러 번 이동한다.
- **사용자 로그아웃은 서버 실패와 무관하게 로컬을 정리한다.** 눌렀으면 이 기기에서는 나가는 것이
  기대 동작이고, 서버 세션 정리 실패는 로그로만 남긴다.

## 대안

- **재발급을 부트스트랩 한 곳에서만 명시적으로 호출** — 스플래시에서 401이면 재발급하고 실패하면
  로그인으로. 호출 지점이 하나뿐이라 동시성 문제가 없고 테스트가 쉽다. 그러나 앱을 쓰는 도중
  만료되는 경우를 전혀 다루지 못한다 — access token 수명이 짧을수록 화면들이 401을 직접 맞는
  빈도가 올라가고, 결국 화면마다 "재로그인해 주세요"를 붙이게 된다.
  **→ 기각:** 만료는 앱 수명 전체에 걸쳐 일어나는 사건이고, 그것을 다루는 자리는 네트워크 계층이다.
- **`Interceptor`에서 401을 처리** — `Authenticator`보다 익숙하고 요청/응답을 자유롭게 다룬다.
  그러나 OkHttp는 인증 재시도를 위해 `Authenticator`를 따로 두고 있고, 재시도 횟수 추적
  (`priorResponse`)과 `Route` 컨텍스트를 그쪽에만 준다. `Interceptor`로 하면 재시도 루프 방어를
  직접 만들어야 한다.
  **→ 기각:** 플랫폼이 이미 제공하는 자리를 두고 재구현할 이유가 없다.
- **재발급 실패를 `AppError`로만 흘리고 전역 이벤트를 두지 않음** — 새 개념을 안 만들고 ADR-0020의
  기존 실패 경로를 그대로 쓴다. 그러나 "이 화면의 요청이 실패했다"와 "세션이 끝났다"는 다른
  사건이다. 후자를 전자로 표현하면 화면마다 로그인 이동을 복제하게 되고, 여러 화면이 동시에
  실패하면 이동이 중복된다.
  **→ 기각:** 전역 사건은 전역 통로가 필요하다. 대신 통로를 하나로 좁히고 수집 지점을 앱 루트로 못박는다.
- **네트워크 실패도 강제 로그아웃** — 분기가 하나로 줄어 구현·테스트가 단순하다. 그러나 일시적
  단절만으로 2주짜리 refresh token을 버린다 — 지하철에서 앱을 켠 것이 로그아웃 사유가 된다.
  **→ 기각:** 연결 실패와 자격증명 만료는 다른 사건이다.

## 영향

**긍정**

- 만료가 화면에 보이지 않는다 — 재발급 성공 경로에서 화면은 로딩도 에러도 겪지 않는다
- 재발급 정책이 한 파일에 모인다. 화면·Repository가 401을 알 필요가 없다
- 세션 종료 반응이 한 곳 — 로그인 이동 로직이 앱 루트에만 존재한다

**트레이드오프**

- `runBlocking`이 OkHttp 디스패처 스레드를 점유한다. `Authenticator` 계약이 동기라 피할 수 없고,
  재발급이 타임아웃까지 늘어지면 그 스레드가 묶인다
- `Provider<AuthService>` 지연 주입은 순환을 감추는 것이기도 하다 — 초기화 순서 문제가 런타임에
  드러날 수 있다
- 수집 지점이 하나여야 한다는 것이 규약일 뿐 기계 검사가 없다

**위험·방어**

- 동시성 세 겹(직렬화·선점 확인·루프 가드)을 각각 MockWebServer 테스트로 고정한다. 특히 **동시
  401 2건에 재발급 1회**가 선점 확인의 회귀 감지선이다
- 네트워크 실패 시 **토큰이 남아 있는지**를 테스트가 직접 단언한다 — 이 분기가 무너지면 오프라인
  진입이 곧 로그아웃이 된다
- refresh token 부재 경로는 이벤트 0건으로 단언한다 — 로그인 화면 자기순환 방어
