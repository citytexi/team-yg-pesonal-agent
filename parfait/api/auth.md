---
id: auth
title: 인증(카카오 로그인·회원가입·토큰 재발급·로그아웃)
server_module: http/auth
server_commit: 5bb2a3a
verified: 2026-08-10
android_status: partial
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
| POST | `/api/v1/auth/kakao` | 불필요(화이트리스트) | `KakaoLoginRequest` | `KakaoLoginResponse` | 구현됨 |
| POST | `/api/v1/auth/signup` | 불필요(화이트리스트) | `SignupRequest` | `SignupResponse` | 구현됨 |
| POST | `/api/v1/auth/reissue` | 불필요(화이트리스트) | `ReissueRequest` | `ReissueResponse` | 구현됨 |
| POST | `/api/v1/auth/logout` | **필요**(화이트리스트 밖) | `LogoutRequest` | 없음(204, envelope 없음) | 구현됨 |

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
| `nonce` | String | 필수(`@NotBlank`) | **앱이 생성한다** — 로그인 직전 만들어 카카오 SDK 요청과 이 API에 같은 값을 보낸다. 서버가 ID 토큰 `nonce` 클레임과 대조해 재생 공격을 검증한다(근거: 팀 명세, [spec/auth-kakao-login.md](spec/auth-kakao-login.md)) |

- **응답 필드**

| JSON 키 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| **`newUser`** | Boolean | 아니오 | 아래 필드 묶음 중 어느 쪽이 채워졌는지를 결정하는 판별자. **서버 DTO 프로퍼티명은 `isNewUser`인데 JSON 키는 `newUser`다** — 아래 참고 |
| `accessToken` | String? | 예 | `newUser=false`일 때만 값 있음 |
| `refreshToken` | String? | 예 | `newUser=false`일 때만 값 있음 |
| `expiresIn` | Long? | 예 | 단위 초(`jwt.access-token-expiration-seconds`, 기본값 3600). `newUser=false`일 때만 값 있음 |
| `registrationToken` | String? | 예 | `newUser=true`일 때만 값 있음 |

  ⚠️ **판별자의 JSON 키는 `newUser`다(`isNewUser` 아님).** 서버 `KakaoLoginResponse`는 Kotlin
  `val isNewUser: Boolean`으로 선언돼 있으나, Jackson이 getter 이름에서 `is` 접두사를 떼고 직렬화해
  **실제 응답 키는 `newUser`**로 나간다(서버가 발행한 OpenAPI 스키마의 `KakaoLoginResponse`가 그렇게
  적혀 있다 — 2026-08-02 확인). 이 도메인에서 `is` 접두사 Boolean을 쓰는 필드는 이것뿐이다.

  **Android 영향**: 응답 타입을 `isNewUser`로 선언하면 값이 항상 채워지지 않아(kotlinx-serialization은
  기본값이 없으면 파싱 실패, 있으면 조용히 기본값) **신규 유저가 기존 회원으로 잘못 분기**되고 존재하지
  않는 `accessToken`을 꺼내게 된다. `@SerialName("newUser")`가 필요하다
  → [open-questions](../synthesis/open-questions.md).

  **응답이 분기한다.** `KakaoLoginResult.ExistingMember`(기존 회원) → `newUser=false` +
  `accessToken`·`refreshToken`·`expiresIn`, `registrationToken`은 `null`. `KakaoLoginResult.NewUser`(신규) →
  `newUser=true` + `registrationToken`, 나머지 셋은 `null`.

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 401 | `INVALID_ID_TOKEN` | 유효하지 않은 ID 토큰입니다 |
| 502 | `KAKAO_JWKS_FETCH_FAILED` | 카카오 공개키 조회에 실패했습니다 |
| 503 | `KAKAO_SERVER_UNAVAILABLE` | 카카오 서버에 연결할 수 없습니다 |

  근거: `KakaoLoginControllerTest`가 세 코드를 이 엔드포인트에서 직접 검증한다. 던지는 지점은
  `KakaoIdTokenVerifyAdapter`(idToken 검증 어댑터, `external` 모듈).

- **명세 델타** — 팀 명세([spec/auth-kakao-login.md](spec/auth-kakao-login.md))가 이 엔드포인트에
  **429 요청 한도 초과**를 열거하나 서버에 대응 코드가 없다(`AuthErrorCode` 12종에 없고 rate limit 구현
  흔적도 없음). 명세가 코드에서 읽을 수 없는 것을 하나 더 담고 있다 — 위 `nonce` 생성 책임이다.

### POST /api/v1/auth/signup

- **인증**: 불필요(화이트리스트 — `/api/v1/auth/kakao`·`/api/v1/auth/signup`·`/api/v1/auth/reissue` 개별
  등록, `logout`은 제외 → 위 비대칭 참고)
- **성공**: HTTP **201** · envelope `code` = `"CREATED"`(`ResponseEntity.status(CREATED)` + `ApiResponse.created`)
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `registrationToken` | String | 필수(`@NotBlank`) | 카카오 로그인이 신규 판정 시 내려준 토큰 |
| `agreements` | List<`TermsAgreementRequest`> | 필수(`@Valid`) | 원소: `termsId` Long · `agreed` Boolean. **`termsId`는 `GET /api/v1/policies`가 내려주는 값**([policy.md](policy.md)) — 하드코딩하면 약관 개정 시 `TERMS_NOT_FOUND` 400 |

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

- **명세 델타** — 팀 명세([spec/auth-signup.md](spec/auth-signup.md))와 코드가 에러 7종·검증 순서까지
  일치한다. **명세에 없는 코드 동작 2건**: ① 가입 시 서버가 `RandomNicknameGenerator.generate()`로
  **닉네임을 자동 생성**한다(앱은 보내지도 받지도 않는다 — 응답에 닉네임 필드가 없다), ② 애플 로그인은
  `handleProviderSpecificRegistration`에 빈 분기 + TODO(#50)로 자리만 있다. 명세가 흐름에 `/auth/apple`을
  적었으나 서버는 미완이다.

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

- **명세 델타** — 팀 명세([spec/auth-reissue.md](spec/auth-reissue.md))가 **403 정지·탈퇴 회원**을
  열거하나 서버에 없다. `AuthErrorCode`에 정지·탈퇴 코드가 없고 `ReissueService`에 회원 상태 검사도 없다 —
  회원 부재는 **401 `MEMBER_NOT_FOUND`**로 나간다(HTTP 코드·code 문자열 둘 다 다르다)
  → [open-questions](../synthesis/open-questions.md). 또한 명세의 "인증: Refresh Token" 표기는 HTTP 인증
  헤더를 뜻하지 않는다 — 이 경로는 화이트리스트라 **헤더 없이 호출할 수 있다.** 단 `JwtAuthFilter`는
  `shouldNotFilter` 오버라이드가 없어 화이트리스트 경로에서도 실행되므로, `Authorization` 헤더를
  붙이면 필터가 검증을 시도한다 — **만료 토큰을 붙이면 401 `EXPIRED_TOKEN`이 난다.** 검증 자체는
  요청 **바디**의 `refreshToken`으로만 `ReissueService`가 수행한다.

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

- **명세 델타** — 팀 명세([spec/auth-logout.md](spec/auth-logout.md))가 204 응답의 `code`를
  **`NO_CONTENT`**로 적었으나 **서버에 그런 코드가 없다**(envelope `code`는 `"OK"`·`"CREATED"` 두 값뿐이고
  애초에 이 응답은 envelope 자체가 오지 않는다) — 명세 표기 오류다. 또 명세는 401을 `INVALID_TOKEN` 하나로
  적었으나 실제로는 위 표의 4종으로 갈리고, **바디 `refreshToken` 검증 실패**(만료·위조 → 401)는 명세에
  아예 없다. 멱등성("이미 삭제된 세션이어도 204")은 코드와 일치한다.

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

⚠️ **`MEMBER_NOT_FOUND`는 코드 문자열이 유일하지 않다.** `ParfaitGroupApiErrorCode`에도 같은 문자열이
존재하지만 값은 **404**로 다르다([parfait-group.md](parfait-group.md) "도메인 에러 코드 전수",
[conventions.md](conventions.md) "코드 문자열은 enum 간 유일하지 않다" 참고) — 소비 측은 이 문서의 **401**과
혼동하지 않도록 HTTP status를 함께 봐야 한다.

## Android 매핑

`:data`·`:domain`에 API 표면이 구현됐다([spec](../specs/archive/2026-08-03-data-api-service-layer.md)) —
**2026-08-06 PR #197로 develop 머지 완료**다. 이 표면이 딛고 선 공용 인프라(`ApiCaller` 4진입점·
`ApiResponse` envelope·`@NoAuth`·`TokenStoreTokenProvider`)는 PR #190으로 먼저 들어왔고, 아래
Service·DataSource·DTO·VO가 이번에 그 위에 올라갔다.
**⚠️ Repository·UseCase·화면 어느 것도 아직 이 표면을 소비하지 않는다** — 카카오 로그인·회원가입·재발급·
로그아웃 화면 결선은 이후 라운드다. 지금 확인할 수 있는 것은 `:data`가 계약대로 요청을 만들고 응답을
파싱할 수 있다는 것뿐이고, 실제 서버 호출로 검증되지도 않았다(개발 서버 평문 HTTP 차단 —
[open-questions](../synthesis/open-questions.md)).

| 엔드포인트 | Service 함수 | DataSource 함수 |
|---|---|---|
| POST `/api/v1/auth/kakao` | `AuthService#postAuthKakao` | `AuthRemoteDataSource#loginWithKakao` |
| POST `/api/v1/auth/signup` | `AuthService#postAuthSignup` | `AuthRemoteDataSource#signup` |
| POST `/api/v1/auth/reissue` | `AuthService#postAuthReissue` | `AuthRemoteDataSource#reissue` |
| POST `/api/v1/auth/logout` | `AuthService#postAuthLogout` | `AuthRemoteDataSource#logout` |

- **요청 DTO**: `KakaoLoginRequest`·`SignupRequest`(+`TermsAgreementRequest`)·`ReissueRequest`·
  `LogoutRequest` — `data/service/model/request/auth/` 패키지, 선언당 파일 하나(파일명은 선언명과
  동일: `KakaoLoginRequest.kt`·`SignupRequest.kt`·`TermsAgreementRequest.kt`·`ReissueRequest.kt`·
  `LogoutRequest.kt`).
- **응답 DTO**: `KakaoLoginResponse`·`SignupResponse`·`ReissueResponse` — 같은 규약으로
  `data/service/model/response/auth/KakaoLoginResponse.kt`·`SignupResponse.kt`·`ReissueResponse.kt`.
  `logout`은 204라 응답 DTO가 없다(`AuthService#postAuthLogout` 반환 타입이 `Unit`,
  `ApiCaller#safeApiCallNoContent`로 감싼다). `KakaoLoginResponse`는 판별자 프로퍼티를 `isNewUser`로
  선언하고 `@SerialName("newUser")`를 붙여 위 판별자 키 불일치를 흡수한다.
- **VO**: `KakaoLoginVO`(sealed — `ExistingMember`/`NewUser`)·`AuthSessionVO`(signup·reissue가 공유)·
  `TermsAgreement` — `domain/model/auth/KakaoLoginVO.kt`·`AuthSessionVO.kt`·`TermsAgreement.kt`. 토큰은
  `AccessToken`·`RefreshToken`·`RegistrationToken` value class 각각 동명 파일(`domain/model/auth/
  AccessToken.kt`·`RefreshToken.kt`·`RegistrationToken.kt`)로 감싸 서로 대체할 수 없게 한다.
- **Mapper**: `data/source/auth/mapper/VOMapper.kt`(`toKakaoLoginVO`·`toAuthSessionVO`(signup·reissue
  각 1개)·`TermsAgreement#toRequest`). `toKakaoLoginVO`는 `newUser`로 분기하고 반대편 필드가 없으면
  `requireNotNull`로 던진다 — 이 예외는 `ApiCaller#safeApiCall(block, transform)` 가드에 잡혀
  `ApiException.Unknown`이 된다(호출부 크래시 아님).
- **이름 충돌 주의**: `domain/model/auth/KakaoLoginVO`(서버 응답)와 `domain/model/KakaoLoginResult`
  (카카오 **SDK** 로그인 결과)는 다른 것이다. 스펙이 예고한 상호 참조 KDoc은 두 파일 어디에도 없다
  → [open-questions](../synthesis/open-questions.md).

## 미결

없음 — 4 엔드포인트 전부 core·http 서버 코드와 컨트롤러/서비스 테스트로 확인했다.
