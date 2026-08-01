---
id: auth
title: 인증(카카오 로그인·회원가입)
server_module: http/auth
server_commit: 6b05b8c
verified: 2026-08-02
android_status: none
related_spec:
related_adr: ADR-0017
tags: [api, parfait, server-contract, auth]
---

# 인증(카카오 로그인·회원가입) API 계약

> 정본은 서버 코드(`mash-up-kr/TEAMYG-SERVER` `main`). 이 문서는 미러다 — 어긋나면 서버가 옳다.
> 전역 계약(envelope·에러 체계·인증)은 [conventions.md](conventions.md).

## 엔드포인트

| 메서드 | 경로 | 인증 | 요청 | 응답 | Android |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/kakao` | 불필요(화이트리스트 `/api/v1/auth/**`) | `KakaoLoginRequest` | `KakaoLoginResponse` | 미구현 |
| POST | `/api/v1/auth/signup` | 불필요(화이트리스트 `/api/v1/auth/**`) | `SignupRequest` | `SignupResponse` | 미구현 |

## 엔드포인트 상세

### POST /api/v1/auth/kakao

- **인증**: 불필요(화이트리스트 `/api/v1/auth/**`)
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

- **인증**: 불필요(화이트리스트 `/api/v1/auth/**`)
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

### 도메인 공통 에러 코드(이 두 엔드포인트에 귀속되지 않음)

`AuthErrorCode`는 총 12종이다(브리프가 나열한 11종 + `FORBIDDEN_REFRESH_TOKEN`). 위 두 엔드포인트가
쓰는 9종을 뺀 나머지 3종은 이 문서 범위 밖 엔드포인트(`ReissueController`·`LogoutController`, 미문서화)와
전역 인증 필터에서 나온다 — "귀속 미대조"가 아니라 **귀속을 확인했지만 범위 밖**이다.

| HTTP | code | 의미 | 귀속 |
|---|---|---|---|
| 401 | `UNAUTHORIZED` | 인증이 필요합니다 | `SecurityConfig`(화이트리스트 밖 요청 전역 인증 실패). kakao·signup은 화이트리스트라 해당 없음 |
| 401 | `MEMBER_NOT_FOUND` | 존재하지 않는 회원입니다 | `JwtAuthFilter`(보호 엔드포인트 전역)·`ReissueService`(미문서화) |
| 403 | `FORBIDDEN_REFRESH_TOKEN` | 다른 회원의 Refresh Token입니다 | `LogoutService`(미문서화) |

## Android 매핑

없음 — `:data`에 인증 관련 Service·Response·DataSource가 없다.

## 미결

- 인증 도메인에는 로그아웃(`LogoutController`)·토큰 재발급(`ReissueController`) 엔드포인트가 서버에
  이미 존재한다(토큰 저장/조회/삭제는 `TokenSavePort`·`TokenQueryPort`·`TokenDeletePort`로 추상화됨).
  이 문서는 브리프 범위(카카오 로그인·회원가입 2건)만 다루므로 두 엔드포인트는 별도 도메인 문서화가
  필요하다 → [open-questions](../synthesis/open-questions.md)
