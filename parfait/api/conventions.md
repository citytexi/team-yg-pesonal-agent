---
id: conventions
title: 서버 API 전역 계약
server_module: common/response, common/error, http/global
server_commit: 5bb2a3a
verified: 2026-08-10
tags: [api, parfait, server-contract, conventions]
---

# 서버 API 전역 계약

> 정본은 서버 코드(`mash-up-kr/TEAMYG-SERVER` `main`). 이 문서는 미러다.
> 도메인별 계약은 [README.md](README.md)의 인덱스 참고.

## 응답 envelope

모든 응답은 `parfait.common.response.ApiResponse<T>`로 감싼다.

| 필드 | 타입 | 비고 |
|---|---|---|
| `success` | Boolean | 성공 여부 |
| `code` | String | 성공 시 `"OK"`/`"CREATED"`, 실패 시 에러 코드 |
| `message` | String | 사람이 읽는 메시지 |
| `data` | T? | 성공 payload, 실패 시 `null` |
| `errorDetail` | Map<String, String>? | **현재 항상 `null`** — 아래 참고 |

생성 지점은 세 개다 — `ApiResponse.ok(data)`(`code`=`"OK"`) · `ApiResponse.created(data)`(`code`=`"CREATED"`) ·
`ApiResponse.error(errorCode, errorDetail)`.

**성공 코드가 2종**이라는 점이 중요하다. 클라이언트가 성공을 단일 상수 비교로 판정하면 `CREATED` 응답을
실패로 분류한다.

### `errorDetail`은 계약에만 있고 채워지지 않는다

`GlobalExceptionHandler`의 네 핸들러(`BusinessException`·`ParfaitGroupException`·bad-request 4종·`Exception`)가
모두 `errorDetail` 인자 없이 `ApiResponse.error(errorCode)`를 호출한다. 검증 실패
(`MethodArgumentNotValidException`)도 필드별 상세 없이 `CommonErrorCode.INVALID_REQUEST` 하나로 뭉개진다.

## 에러 코드 체계

`parfait.common.error.BaseErrorCode` 인터페이스(`status: Int`·`code: String`·`message: String`)를
도메인별 enum이 구현한다.

| enum | 위치 | 종수 |
|---|---|---|
| `CommonErrorCode` | `common/error` | 2 |
| `AuthErrorCode` | `core/auth/exception` | 12 |
| `ParfaitGroupApiErrorCode` | `http/parfaitgroup` | 11 |
| `ImageErrorCode` | `core/image/exception` | 4 |

### `CommonErrorCode`

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_REQUEST` | 요청 형식이 올바르지 않습니다 |
| 500 | `INTERNAL_SERVER_ERROR` | 서버 내부 오류가 발생했습니다 |

`ParfaitGroupApiErrorCode`는 core 계층 `ParfaitGroupError`와 **이름이 1:1**이다(`from(error) = valueOf(error.name)`).

### 코드 문자열은 enum 간 유일하지 않다

`code` 문자열은 **각 enum 내부에서만** 유일하다 — enum을 넘어서는 전역 유일성 보장이 없다. 실례:
`MEMBER_NOT_FOUND`는 `AuthErrorCode`에서 **401**(존재하지 않는 회원, [auth.md](auth.md) "도메인 에러 코드
전수" 참고)이고 `ParfaitGroupApiErrorCode`·`ImageErrorCode`에서는 **404**(같은 의미지만 다른 status,
[parfait-group.md](parfait-group.md)·[image.md](image.md) "도메인 에러 코드 전수" 참고)다. **소비 측은
envelope `code` 문자열 단독이 아니라 HTTP status와 함께 판정해야 한다** — `code`만으로 분기하면 서로 다른
세 상황(만료된 access/refresh 토큰의 회원 부재 vs 그룹 관련 회원 부재 vs 업로드 URL 발급 시 회원 부재)을
한 브랜치로 뭉갠다. 중복 코드는 하나가 아니라 **셋**이 됐다(2026-08-10 image 도메인 신설).

## 인증

JWT Bearer. `JwtAuthFilter`가 검증하고 인증 주체의 이름(`Authentication.name`)이 **memberId(Long 문자열)**다.
컨트롤러는 `Authentication.memberId(): Long = name.toLong()` 확장으로 꺼낸다.

`SecurityConfig`는 세션을 쓰지 않고(STATELESS), 아래 화이트리스트 외 **전 요청 인증 필수**다.

- `/actuator/health`
- `/swagger-ui.html` · `/swagger-ui/**`
- `/favicon.ico`
- `/v3/api-docs/**`
- `/api/v1/auth/kakao`
- `/api/v1/auth/signup`
- `/api/v1/auth/reissue`
- `/api/v1/policies`

인증 실패는 `AuthErrorCode.UNAUTHORIZED`(401)로 나간다.

`[Feat/#45] 토큰 재발급(refresh) / 로그아웃 API 구현 (#63)`(`6f5bffc`)이 기존 `/api/v1/auth/**` 와일드카드를
위 auth 3경로 개별 등록으로 좁혔다. **`/api/v1/auth/logout`은 화이트리스트에 없어 인증 대상**이다 — 인증 도메인
4개 엔드포인트 중 access token이 필요한 유일한 엔드포인트다(상세는 [auth.md](auth.md)).
`/api/v1/policies`는 `[Feat/#64] 약관 목록 조회 API 구현 (#65)`(`69654bc`)이 같은 개별 등록 방식으로
추가했다(상세는 [policy.md](policy.md)).

**2026-08-10 image 도메인 2건이 들어왔지만 화이트리스트는 그대로다** — `/api/v1/images`와
`/api/v1/images/{imageId}/confirm`은 **인증 대상**이다(상세는 [image.md](image.md)). 단 confirm은
토큰 유효성만 보고 **이미지 소유자를 대조하지 않는다** → [open-questions](../synthesis/open-questions.md).

**관측 사실**: `HealthController`가 매핑한 `GET /health`(`http/global/health`, #63이 `http/api/health`에서
옮겼다)는 화이트리스트의 `/actuator/health`와 경로가 달라 **인증 대상**이다.

## URL 규약

현재 3형태가 공존한다.

| 형태 | 예 |
|---|---|
| `/api/v1/<도메인>` | `/api/v1/auth/kakao` · `/api/v1/auth/signup` · `/api/v1/auth/reissue` · `/api/v1/auth/logout` · `/api/v1/policies` · `/api/v1/images` |
| `/api/v1/<도메인>/{id}/<동작>` | `/api/v1/images/{imageId}/confirm` |
| `/api/v1/groups/{groupId}/<하위>` | `/api/v1/groups/{groupId}/parfaits/year` |
| `/api/<도메인>` (버전 없음) | `/api/parfait-groups` |

버전 프리픽스 유무가 갈리고, **그룹을 가리키는 경로가 `groups`와 `parfait-groups` 둘**이다.
서버에 URL 규약 문서가 없어 관측 사실로만 적는다 → [open-questions](../synthesis/open-questions.md).

## 직렬화 규약

### Boolean 필드의 `is` 접두사는 JSON 키에서 사라진다

서버는 Jackson으로 직렬화한다. Kotlin `val isXxx: Boolean`은 getter가 `isXxx()`가 되고, Jackson의
bean 이름 규칙이 `is` 접두사를 떼어 **JSON 키는 `xxx`**로 나간다.

현재 계약에서 해당하는 필드는 하나다 — `KakaoLoginResponse`의 `isNewUser` → **`newUser`**
(→ [auth.md](auth.md) `POST /api/v1/auth/kakao`). 서버가 발행한 OpenAPI 스키마로 확인했다.

**소비 측 규칙**: 서버 DTO에 `is` 접두사 Boolean이 보이면 **JSON 키는 접두사 없는 이름**으로 가정하고,
Android는 `@SerialName`으로 명시한다. 이름이 어긋나면 kotlinx-serialization이 기본값으로 조용히
떨어져 **분기가 반대로 뒤집힌다** — 예외가 나지 않아 발견이 늦다.

### 서버는 평문 HTTP로 서비스된다

개발 서버 base URL이 `https`가 아니라 **평문 `http`**다(포트 지정, 주소는 private submodule
`project-paths.md`·앱 `local.properties` 참고).

TJYG-Android는 `targetSdk = 36`이고 `AndroidManifest.xml`에 `usesCleartextTraffic`도
`networkSecurityConfig`도 **없다.** Android 9(API 28)부터 평문 HTTP는 기본 차단이므로 실제 연동을
시작하면 **모든 요청이 `CLEARTEXT communication not permitted`로 실패한다.**

해결은 서버 HTTPS 적용(권장) 또는 debug 빌드 한정 `network_security_config.xml`로 해당 호스트만
허용하는 것이다 → [open-questions](../synthesis/open-questions.md).

## OpenAPI

서버는 springdoc을 켜 두었다(`OpenApiConfig`, title `Parfait API`, version `v1`) — `/v3/api-docs`·`/swagger-ui`.
이 문서 체계는 **서버 코드 직독**을 근거로 삼고 OpenAPI JSON을 파싱하지 않는다(서버 실행이 필요하고
에러코드 열거·검증 로직이 스키마에 안 잡힌다).

**2026-08-02, OpenAPI 실물을 받아 코드와 대조했다.** 그 결과 두 축이 서로를 보완한다는 것이 확인됐다.

- **스키마만 아는 것**: 직렬화 결과. `isNewUser` → `newUser` 키 변환은 Kotlin 소스만 봐서는 알 수 없고
  스키마가 유일한 근거였다(→ 위 [직렬화 규약](#직렬화-규약)).
- **코드만 아는 것**: 에러 코드 열거(스키마는 성공 응답만 문서화한다), 검증 규칙, 그리고 **실제 HTTP
  상태 코드**. `POST /api/v1/auth/signup`이 대표적이다 — 스키마는 **200**으로 적었으나 컨트롤러가
  `ResponseEntity.status(HttpStatus.CREATED)`를 쓰므로 실제는 **201**이다. springdoc이 `ResponseEntity`의
  런타임 status를 읽지 못한 것이다. 같은 이유로 `@ResponseStatus`를 쓴 엔드포인트는 정확히 나온다.

**규칙**: 두 근거가 갈리면 **코드가 정본**이다. 단 직렬화 키처럼 코드가 답하지 못하는 항목은 스키마를
근거로 삼고, 그 사실을 문서에 남긴다.

### 스키마 `required`는 Bean Validation 애노테이션만 반영한다

**2026-08-10 OpenAPI 실물을 다시 받아 image 도메인 포함 전 요청 DTO를 대조했다.** 스키마 `required`
배열에 들어가는 필드는 `@NotBlank` 같은 Bean Validation 애노테이션이 붙은 것뿐이고, **Kotlin 비널
타입이지만 애노테이션이 없는 필드는 빠진다.**

| 요청 DTO | 스키마 `required` | 실제 비널 필드 |
|---|---|---|
| `KakaoLoginRequest` | `idToken`·`nonce` | 같음 |
| `SignupRequest` | `registrationToken` | + `agreements` |
| `IssueImageUploadUrlRequest` | `fileName`·`contentType` | + `imageType` |
| `CreateParfaitGroupRequest` | (없음) | `groupName`·`groupNickname`·`memberLimit` |

빠진 필드도 **누락하면 400이다** — jackson-module-kotlin이 비널 파라미터 부재에서 실패하고
`GlobalExceptionHandler`의 bad-request 핸들러가 `INVALID_REQUEST`로 바꾼다.

**소비 측 규칙**: **스키마에서 클라이언트 모델을 생성하지 않는다.** 생성하면 비널 필드가 nullable로
떨어져 "보내도 되고 안 보내도 되는" 것처럼 보인다. 각 도메인 문서의 "필수" 열이 이 구분을 이미
표기하고 있다 — `필수(@NotBlank)`(스키마에도 있음) vs `필수(non-null 타입)`(스키마에는 없음).

## Android 불일치

TJYG-Android `:data`의 원격 네트워크 구조([ADR-0017](../adr/0017-remote-network-datasource.md))와 위 계약의 간극.

**2026-08-04 기준 남은 항목 없음.** 오래 걸려 있던 3건(Android `ApiResponse`에 `success`·`errorDetail`
부재 / `isSuccess`가 `code == "SUCCESS"` 단일 비교 / `TokenProvider`가 항상 null)은
`network-envelope-token-storage` 라운드가 **PR #190으로 develop에 머지되며 전부 해소**됐다 —
envelope 5필드 정합, 성공 판정은 `success` 필드, `TokenProvider`는 `TokenStoreTokenProvider`
([ADR-0019](../adr/0019-encrypted-token-storage.md)). 대응 [open-questions](../synthesis/open-questions.md)
항목도 해소 처리했다.

> **다만 "일치"가 "검증됨"은 아니다.** 14 엔드포인트 Service·DataSource는 2026-08-06 PR #197로
> develop에 들어왔지만, 이를 **호출하는 Repository·UseCase·화면이 없어** 서버로 나간 요청은 여전히
> 0건이다(개발 서버 평문 HTTP 차단·`YG_BASE_URL` 부재도 그대로다). 계약 해석의 실동작은 실연동
> 라운드에서 확인한다 → [open-questions](../synthesis/open-questions.md).

**2026-08-10 기준 서버 엔드포인트는 16개고 Android 표면은 14개다.** 늘어난 image 2건은 대응 심볼이
0건이라 **불일치가 아니라 공백**이다(불일치는 심볼이 있는데 어긋날 때만 쓴다, [README.md](README.md) 규약).

새 간극이 발견되면 이 절에 표를 다시 세운다.
