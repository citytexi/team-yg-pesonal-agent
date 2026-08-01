---
id: auth
title: 인증(카카오 로그인·회원가입·토큰 재발급·로그아웃)
server_module: http/auth
server_commit: 6f5bffc
verified: 2026-08-02
android_status: none
related_spec:
related_adr: ADR-0017
tags: [api, parfait, server-contract, auth]
---

# 인증(카카오 로그인·회원가입·토큰 재발급·로그아웃) API 계약

> 정본은 서버 코드(`mash-up-kr/TEAMYG-SERVER` `main`). 이 문서는 미러다 — 어긋나면 서버가 옳다.
> 전역 계약(envelope·에러 체계·인증)은 [conventions.md](conventions.md).

## 엔드포인트

| 메서드 | 경로 | 인증 | 요청 | 응답 | Android |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/kakao` | 불필요(화이트리스트) | `KakaoLoginRequest` | `KakaoLoginResponse` | 미구현 |
| POST | `/api/v1/auth/signup` | 불필요(화이트리스트) | `SignupRequest` | `SignupResponse` | 미구현 |
| POST | `/api/v1/auth/reissue` | 불필요(화이트리스트) | `ReissueRequest` | `ReissueResponse` | 미구현 |
| POST | `/api/v1/auth/logout` | **필요**(화이트리스트 밖) | `LogoutRequest` | 없음(204, envelope 없음) | 미구현 |

⚠️ **`logout`만 화이트리스트 밖이라는 비대칭.** `[Feat/#45] 토큰 재발급(refresh) / 로그아웃 API 구현 (#63)`
(`6f5bffc`)이 기존 `/api/v1/auth/**` 와일드카드를 `/api/v1/auth/kakao`·`/api/v1/auth/signup`·
`/api/v1/auth/reissue` 개별 3경로로 좁히면서(`SecurityConfig.WHITELIST_PATHS`) `logout`을 제외했다.
인증 도메인 4개 엔드포인트 중 access token이 필요한 유일한 엔드포인트가 `logout`이다.

## 엔드포인트 상세

### POST /api/v1/auth/kakao

- **인증**: 불필요(화이트리스트 — `/api/v1/auth/kakao`·`/api/v1/auth/signup`·`/api/v1/auth/reissue` 개별
  등록, `logout`은 제외 → 위 비대칭 참고)
- **성공**: HTTP 200 · envelope `code` = `"OK"`(`ApiResponse.ok`)
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `idToken` | String | 필수(`@NotBlank`) | 카카오 ID 토큰 |
| `nonce` | String | 필수(`@NotBlank`) | |

- **응답 필드**

| 필드 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `isNewUser` | Boolean | 아니오 | 아래 필드 묶음 중 어느 쪽이 채워졌는지를 결정하는 판별자 |
| `accessToken` | String? | 예 | `isNewUser=false`일 때만 값 있음 |
| `refreshToken` | String? | 예 | `isNewUser=false`일 때만 값 있음 |
| `expiresIn` | Long? | 예 | 단위 초(`jwt.access-token-expiration-seconds`, 기본값 3600). `isNewUser=false`일 때만 값 있음 |
| `registrationToken` | String? | 예 | `isNewUser=true`일 때만 값 있음 |

  **응답이 분기한다.** `KakaoLoginResult.ExistingMember`(기존 회원) → `isNewUser=false` +
  `accessToken`·`refreshToken`·`expiresIn`, `registrationToken`은 `null`. `KakaoLoginResult.NewUser`(신규) →
  `isNewUser=true` + `registrationToken`, 나머지 셋은 `null`.

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 401 | `INVALID_ID_TOKEN` | 유효하지 않은 ID 토큰입니다 |
| 502 | `KAKAO_JWKS_FETCH_FAILED` | 카카오 공개키 조회에 실패했습니다 |
| 503 | `KAKAO_SERVER_UNAVAILABLE` | 카카오 서버에 연결할 수 없습니다 |

  근거: `KakaoLoginControllerTest`가 세 코드를 이 엔드포인트에서 직접 검증한다. 던지는 지점은
  `KakaoIdTokenVerifyAdapter`(idToken 검증 어댑터, `external` 모듈).

### POST /api/v1/auth/signup

- **인증**: 불필요(화이트리스트 — `/api/v1/auth/kakao`·`/api/v1/auth/signup`·`/api/v1/auth/reissue` 개별
  등록, `logout`은 제외 → 위 비대칭 참고)
- **성공**: HTTP **201** · envelope `code` = `"CREATED"`(`ResponseEntity.status(CREATED)` + `ApiResponse.created`)
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `registrationToken` | String | 필수(`@NotBlank`) | 카카오 로그인이 신규 판정 시 내려준 토큰 |
| `agreements` | List<`TermsAgreementRequest`> | 필수(`@Valid`) | 원소: `termsId` Long · `agreed` Boolean |

- **응답 필드**

| 필드 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `accessToken` | String | 아니오 | 로그인 응답과 달리 셋 다 널 아님 |
| `refreshToken` | String | 아니오 | |
| `expiresIn` | Long | 아니오 | 단위 초(`jwt.access-token-expiration-seconds`, 기본값 3600) |

  흐름 메모: 카카오 로그인이 신규로 판정해 내려준 `registrationToken`을 이 API에 넘겨 가입을 끝낸다.
  회원가입 실패 시 회원 데이터가 남지 않도록 `SignupService.signup` 전체가 하나의 트랜잭션이다(#63에서
  `MemberRegistrar.register` 단독 트랜잭션 범위를 확장).

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 401 | `INVALID_TOKEN` | 유효하지 않은 토큰입니다(`registrationToken` 검증 실패) |
| 401 | `EXPIRED_TOKEN` | 만료된 토큰입니다(`registrationToken` 만료) |
| 409 | `ALREADY_REGISTERED` | 이미 가입된 회원입니다 |
| 400 | `DUPLICATE_TERMS_ID` | 중복된 약관 ID입니다 |
| 400 | `TERMS_NOT_FOUND` | 존재하지 않는 약관입니다 |
| 400 | `REQUIRED_TERMS_NOT_AGREED` | 필수 약관에 모두 동의해야 합니다 |

  근거: `SignupControllerTest`가 여섯 코드를 이 엔드포인트에서 직접 검증한다. `INVALID_TOKEN`·`EXPIRED_TOKEN`은
  `SignupService`가 `TokenValidatePort.validateRegistrationToken`을 통해 던지고, 나머지 넷은 `SignupService`
  본문(약관 검증·중복 가입 검사)에서 직접 던진다.

### POST /api/v1/auth/reissue

- **인증**: 불필요(화이트리스트 — `/api/v1/auth/kakao`·`/api/v1/auth/signup`·`/api/v1/auth/reissue` 개별
  등록, `logout`은 제외 → 위 비대칭 참고)
- **성공**: HTTP 200 · envelope `code` = `"OK"`(`ApiResponse.ok`)
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `refreshToken` | String | 필수(`@NotBlank`) | |

- **응답 필드**

| 필드 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `accessToken` | String | 아니오 | 새로 발급된 access token |
| `refreshToken` | String | 아니오 | 새로 발급된 refresh token(회전) |
| `expiresIn` | Long | 아니오 | 단위 초(`jwt.access-token-expiration-seconds`, 기본값 3600) — access token 만료까지의 초 |

  흐름 메모: 요청 refresh token을 JWT로 검증한 뒤 Redis에 저장된 값과 대조해 위조·재사용을 걸러내고,
  같은 세션(`sessionId`)으로 access/refresh 토큰을 새로 발급한다. 기존 refresh token은 Redis 값을
  덮어쓰는 방식으로 폐기된다(`ReissueService`).

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 401 | `INVALID_TOKEN` | 유효하지 않은 토큰입니다 |
| 401 | `EXPIRED_TOKEN` | 만료된 토큰입니다 |
| 401 | `MEMBER_NOT_FOUND` | 존재하지 않는 회원입니다 |

  `INVALID_TOKEN`은 두 경로에서 나온다 — (1) refresh token이 JWT로서 무효(타입 불일치·서명 불일치·
  파싱 실패, `JwtTokenAdapter.validateRefreshToken`), (2) JWT는 유효하지만 Redis에 저장된 값과
  불일치하거나 저장값 자체가 없음(위조·재사용 의심, `ReissueService` 본문). `EXPIRED_TOKEN`은 refresh
  token JWT 만료(`JwtTokenAdapter`). `MEMBER_NOT_FOUND`는 토큰의 `memberId`에 해당하는 회원이
  존재하지 않을 때(`ReissueService`가 `MemberQueryPort.existsById`로 직접 검사).
  근거: `ReissueControllerTest`(`INVALID_TOKEN`·`EXPIRED_TOKEN`)·`ReissueServiceTest`(4케이스 전부,
  `MEMBER_NOT_FOUND` 포함).

### POST /api/v1/auth/logout

- **인증**: **필요** — 화이트리스트 밖(위 비대칭 참고). Bearer access token 필수.
- **성공**: HTTP **204** · **envelope 없음**. `LogoutController.logout`은 반환 타입이 없는(Unit)
  함수이고 `@ResponseStatus(HttpStatus.NO_CONTENT)`로만 상태 코드를 지정한다 — `ApiResponse.ok`/`created`
  같은 envelope 생성 호출이 코드에 없으므로 **응답 본문 자체가 비어 있다**(코드로 확정, 추측 아님).
  Android가 이 엔드포인트를 소비할 때 `safeApiCallWithoutData`조차 파싱할 JSON 본문이 없다는 뜻이다.
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `refreshToken` | String | 필수(`@NotBlank`) | |

- **응답 필드**: 없음(204, 본문 없음 — 위 참고)

  흐름 메모: 인증된 회원(access token에서 뽑은 `memberId`)과 요청 바디 `refreshToken`이 가리키는
  회원(`claims.memberId`)이 같은지 검증한 뒤 세션(Redis)을 삭제한다(`LogoutService`). 불일치 시 다른
  회원의 토큰을 지우지 못하도록 403으로 거부한다.

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 401 | `UNAUTHORIZED` | 인증이 필요합니다 |
| 401 | `INVALID_TOKEN` | 유효하지 않은 토큰입니다 |
| 401 | `EXPIRED_TOKEN` | 만료된 토큰입니다 |
| 401 | `MEMBER_NOT_FOUND` | 존재하지 않는 회원입니다 |
| 403 | `FORBIDDEN_REFRESH_TOKEN` | 다른 회원의 Refresh Token입니다 |

  `UNAUTHORIZED`는 `Authorization` 헤더가 없거나 `Bearer`가 아닐 때 — `logout`이 화이트리스트 밖이라
  `SecurityConfig`가 전 요청 인증을 강제하고, 미인증이면 `authenticationEntryPoint`가
  `BusinessException(UNAUTHORIZED)`로 응답한다(컨트롤러 도달 전). `MEMBER_NOT_FOUND`는 access token은
  유효하지만 그 `memberId` 회원이 존재하지 않을 때 — `JwtAuthFilter.authenticate`가 컨트롤러 도달 전에
  던진다(모든 보호 엔드포인트에 공통이며 `logout`도 예외 없음). `INVALID_TOKEN`·`EXPIRED_TOKEN`은 요청
  바디 `refreshToken`(access token이 아니라)을 `LogoutService`가 `TokenValidatePort.validateRefreshToken`으로
  검증하다 나오는 예외를 그대로 전파한 것 — reissue와 같은 근거(`JwtTokenAdapter.validateRefreshToken`)지만
  대상 토큰이 다르다는 점에 주의. `FORBIDDEN_REFRESH_TOKEN`은 검증된 `refreshToken`의 `memberId`가
  인증된 `memberId`와 다를 때 `LogoutService` 본문에서 직접 던진다.
  근거: `LogoutControllerTest`(204·`FORBIDDEN_REFRESH_TOKEN`, 미인증 401은 슬라이스 테스트 한계로
  별도 `SecurityConfigIntegrationTest`가 검증한다고 테스트 코드 주석에 명시)·`LogoutServiceTest`(3케이스
  전부)·`JwtAuthFilter` 직독.

## 도메인 에러 코드 전수 — `AuthErrorCode`(12종)

4개 엔드포인트 전부(core·http 서버 코드 직독 + 컨트롤러/서비스 테스트)로 12종 전부의 귀속처를 확인했다
— "귀속 미대조"로 남길 항목이 없다. `UNAUTHORIZED`·`MEMBER_NOT_FOUND`·`INVALID_TOKEN`·`EXPIRED_TOKEN`은
2개 이상 엔드포인트(또는 전역 필터)가 같은 코드를 서로 다른 상황에서 던진다 — 각 엔드포인트 상세 절의
설명이 근거다.

| code | HTTP | 의미 | 귀속 |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | 인증이 필요합니다 | `logout` 미인증(전역 `SecurityConfig`) |
| `INVALID_TOKEN` | 401 | 유효하지 않은 토큰입니다 | `signup`(registrationToken) · `reissue`·`logout`(refreshToken, 근거는 각기 다름) |
| `EXPIRED_TOKEN` | 401 | 만료된 토큰입니다 | `signup`(registrationToken) · `reissue`·`logout`(refreshToken) |
| `MEMBER_NOT_FOUND` | 401 | 존재하지 않는 회원입니다 | `reissue`(`ReissueService`) · `logout`(전역 `JwtAuthFilter`, access token 검증 단계) |
| `INVALID_ID_TOKEN` | 401 | 유효하지 않은 ID 토큰입니다 | `kakao` |
| `KAKAO_JWKS_FETCH_FAILED` | 502 | 카카오 공개키 조회에 실패했습니다 | `kakao` |
| `KAKAO_SERVER_UNAVAILABLE` | 503 | 카카오 서버에 연결할 수 없습니다 | `kakao` |
| `ALREADY_REGISTERED` | 409 | 이미 가입된 회원입니다 | `signup` |
| `DUPLICATE_TERMS_ID` | 400 | 중복된 약관 ID입니다 | `signup` |
| `TERMS_NOT_FOUND` | 400 | 존재하지 않는 약관입니다 | `signup` |
| `REQUIRED_TERMS_NOT_AGREED` | 400 | 필수 약관에 모두 동의해야 합니다 | `signup` |
| `FORBIDDEN_REFRESH_TOKEN` | 403 | 다른 회원의 Refresh Token입니다 | `logout`(`LogoutService`) |

## Android 매핑

없음 — `:data`에 인증 관련 Service·Response·DataSource가 없다.

## 미결

없음 — 4 엔드포인트 전부 core·http 서버 코드와 컨트롤러/서비스 테스트로 확인했다.
