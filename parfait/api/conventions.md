---
id: conventions
title: 서버 API 전역 계약
server_module: common/response, common/error, http/global
server_commit: 6f5bffc
verified: 2026-08-02
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

### `CommonErrorCode`

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_REQUEST` | 요청 형식이 올바르지 않습니다 |
| 500 | `INTERNAL_SERVER_ERROR` | 서버 내부 오류가 발생했습니다 |

`ParfaitGroupApiErrorCode`는 core 계층 `ParfaitGroupError`와 **이름이 1:1**이다(`from(error) = valueOf(error.name)`).

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

인증 실패는 `AuthErrorCode.UNAUTHORIZED`(401)로 나간다.

`[Feat/#45] 토큰 재발급(refresh) / 로그아웃 API 구현 (#63)`(`6f5bffc`)이 기존 `/api/v1/auth/**` 와일드카드를
위 3경로 개별 등록으로 좁혔다. **`/api/v1/auth/logout`은 화이트리스트에 없어 인증 대상**이다 — 인증 도메인
4개 엔드포인트 중 access token이 필요한 유일한 엔드포인트다(상세는 [auth.md](auth.md)).

**관측 사실**: `HealthController`가 매핑한 `GET /health`(`http/global/health`, #63이 `http/api/health`에서
옮겼다)는 화이트리스트의 `/actuator/health`와 경로가 달라 **인증 대상**이다.

## URL 규약

현재 3형태가 공존한다.

| 형태 | 예 |
|---|---|
| `/api/v1/<도메인>` | `/api/v1/auth/kakao` · `/api/v1/auth/signup` · `/api/v1/auth/reissue` · `/api/v1/auth/logout` |
| `/api/v1/groups/{groupId}/<하위>` | `/api/v1/groups/{groupId}/parfaits/year` |
| `/api/<도메인>` (버전 없음) | `/api/parfait-groups` |

버전 프리픽스 유무가 갈리고, **그룹을 가리키는 경로가 `groups`와 `parfait-groups` 둘**이다.
서버에 URL 규약 문서가 없어 관측 사실로만 적는다 → [open-questions](../synthesis/open-questions.md).

## OpenAPI

서버는 springdoc을 켜 두었다(`OpenApiConfig`, title `Parfait API`, version `v1`) — `/v3/api-docs`·`/swagger-ui`.
이 문서 체계는 **서버 코드 직독**을 근거로 삼고 OpenAPI JSON을 파싱하지 않는다(서버 실행이 필요하고
에러코드 열거·검증 로직이 스키마에 안 잡힌다). 대조 보조 수단으로만 존재를 기록한다.

## Android 불일치

TJYG-Android `:data`의 원격 네트워크 구조([ADR-0017](../adr/0017-remote-network-datasource.md))와 위 계약의 간극.
**세 건 모두 코드 미수정 상태**다.

| # | 불일치 | 영향 |
|---|---|---|
| 1 | Android `ApiResponse`에 `success`·`errorDetail` 필드 없음(`code`/`message`/`data`만) | 서버가 보내는 두 필드를 소비하지 못한다 |
| 2 | Android `ApiResponse.isSuccess`가 `code == "SUCCESS"` 단일 비교(`SUCCESS_CODE` 상수가 `TODO`) — 서버는 `"OK"`/`"CREATED"` | **현 상태로 모든 호출이 `ApiException.Business` 실패 판정** |
| 3 | Android `TokenProvider` 구현이 `EmptyTokenProvider`(항상 null 반환) | 화이트리스트 밖 전 API가 401 |

세 건은 [open-questions](../synthesis/open-questions.md)에 등록돼 있다.
