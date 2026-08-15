---
id: conventions
title: 서버 API 전역 계약
server_module: common/response, common/error, http/global
server_commit: e4ff23f
verified: 2026-08-15
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

### envelope를 쓰지 않는 응답이 둘 있다

`POST /api/v1/auth/logout`과 `DELETE /api/v1/users/me`(2026-08-15 신설)는 **204 No Content에 본문이 없다**
(`@ResponseStatus(HttpStatus.NO_CONTENT)` + 반환 타입 `Unit`). 나머지 전 엔드포인트는 성공이든 실패든
`ApiResponse`를 준다. **envelope를 무조건 파싱하는 클라이언트는 이 둘에서 깨진다**
([auth.md](auth.md)·[member.md](member.md)).

같은 delta의 토핑 삭제(`DELETE .../images/{parfaitImageId}`)는 반대로 **200 + `data: null`**이다
([parfait-image.md](parfait-image.md)) — **두 DELETE가 성공 표현을 달리한다.**

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
| `AuthErrorCode` | `core/auth/exception` | 14 |
| `ParfaitGroupApiErrorCode` | `http/parfaitgroup` | 10 (2026-08-15 `GROUP_NICKNAME_ALREADY_USED` 삭제로 11 → 10) |
| `ImageErrorCode` | `core/image/exception` | 4 |
| `MemberErrorCode` | `core/member/exception` | 2 |
| `ParfaitImageErrorCode` | `core/parfaitimage/exception` | 5 |
| `ParfaitErrorCode` | `core/parfait/exception` | 2 (2026-08-15 신설) |

### `CommonErrorCode`

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_REQUEST` | 요청 형식이 올바르지 않습니다 |
| 500 | `INTERNAL_SERVER_ERROR` | 서버 내부 오류가 발생했습니다 |

`ParfaitGroupApiErrorCode`는 core 계층 `ParfaitGroupError`와 **이름이 1:1**이다(`from(error) = valueOf(error.name)`).

### 코드 문자열은 enum 간 유일하지 않다

`code` 문자열은 **각 enum 내부에서만** 유일하다 — enum을 넘어서는 전역 유일성 보장이 없다. 실례:
`MEMBER_NOT_FOUND`는 `AuthErrorCode`에서 **401**(존재하지 않는 회원, [auth.md](auth.md) "도메인 에러 코드
전수" 참고)이고 `ParfaitGroupApiErrorCode`·`ImageErrorCode`·`MemberErrorCode`에서는 **404**(같은 의미지만
다른 status, [parfait-group.md](parfait-group.md)·[image.md](image.md)·[member.md](member.md) "도메인 에러
코드 전수" 참고)다. **소비 측은 envelope `code` 문자열 단독이 아니라 HTTP status와 함께 판정해야 한다** —
`code`만으로 분기하면 서로 다른 네 상황(토큰의 회원 부재 vs 그룹 관련 회원 부재 vs 업로드 URL 발급 시
회원 부재 vs 계정 조회·닉네임 변경 시 회원 부재)을 한 브랜치로 뭉갠다. **같은 문자열을 가진 enum이 넷**이
됐다(2026-08-11 member 도메인 신설).

⚠️ **한 엔드포인트가 같은 `code`를 서로 다른 status로 낼 수도 있다.** `GET /api/v1/users/me`가 그렇다 —
`JwtAuthFilter`가 던지면 **401**, `MemberService`가 던지면 **404**인데 문자열은 둘 다 `MEMBER_NOT_FOUND`다
([member.md](member.md)).

## 인증

JWT Bearer. `JwtAuthFilter`가 검증하고 인증 주체의 이름(`Authentication.name`)이 **memberId(Long 문자열)**다.
컨트롤러는 `Authentication.memberId(): Long = name.toLong()` 확장으로 꺼낸다.

`SecurityConfig`는 세션을 쓰지 않고(STATELESS), 아래 화이트리스트 외 **전 요청 인증 필수**다.

- `/actuator/health`
- `/swagger-ui.html` · `/swagger-ui/**`
- `/favicon.ico`
- `/v3/api-docs/**`
- `/api/v1/auth/kakao`
- `/api/v1/auth/apple`
- `/api/v1/auth/signup`
- `/api/v1/auth/reissue`
- `/api/v1/policies`
- `/api/v1/test/parfait-canvas/rotate` ⚠️ **테스트 전용**

인증 실패는 `AuthErrorCode.UNAUTHORIZED`(401)로 나간다.

⚠️ **화이트리스트에 테스트 전용 경로가 들어왔다(2026-08-15).** `/api/v1/test/parfait-canvas/rotate`는
**인증 없이 전체 그룹의 캔버스를 즉시 마감·재생성**한다([parfait.md](parfait.md)). 서버 코드가 컨트롤러와
이 등록 양쪽에 "프로덕션 오픈 전 함께 제거" TODO를 달아 두었다 → [open-questions](../synthesis/open-questions.md).

`[Feat/#45] 토큰 재발급(refresh) / 로그아웃 API 구현 (#63)`(`6f5bffc`)이 기존 `/api/v1/auth/**` 와일드카드를
위 auth 경로 개별 등록으로 좁혔다. **`/api/v1/auth/logout`은 화이트리스트에 없어 인증 대상**이다 — 인증 도메인
5개 엔드포인트 중 access token이 필요한 유일한 엔드포인트다(상세는 [auth.md](auth.md)).
`/api/v1/policies`는 `[Feat/#64] 약관 목록 조회 API 구현 (#65)`(`69654bc`)이,
`/api/v1/auth/apple`은 `[Feat/#50] 애플 로그인 API 구현 (#76)`(`96affd0`)이 같은 개별 등록 방식으로
추가했다(상세는 [policy.md](policy.md)·[auth.md](auth.md)).

**2026-08-10 image 도메인 2건이 들어왔지만 화이트리스트는 그대로다** — `/api/v1/images`와
`/api/v1/images/{imageId}/confirm`은 **인증 대상**이다(상세는 [image.md](image.md)). 단 confirm은
토큰 유효성만 보고 **이미지 소유자를 대조하지 않는다** → [open-questions](../synthesis/open-questions.md).

**2026-08-15 delta의 신규 5건**(파르페 오늘·과거 목록 · 토핑 테두리 수정·삭제 · 회원 탈퇴)**도 전부
화이트리스트 밖이라 인증 대상**이다. 위 테스트 전용 회전 1건만 예외다.

**2026-08-11 member 2건·parfait-image 2건도 화이트리스트 밖이라 전부 인증 대상**이다
([member.md](member.md)·[parfait-image.md](parfait-image.md)). 네 엔드포인트 모두 대상 회원을 요청이 아니라
**토큰에서** 정한다 — 남의 계정을 지목할 경로가 없다. 다만 토핑 배치(POST)는 배치자 대조가 없어
**같은 그룹의 다른 멤버가 남의 배치를 덮어쓸 수 있다** → [parfait-image.md](parfait-image.md).

**관측 사실**: `HealthController`가 매핑한 `GET /health`(`http/global/health`, #63이 `http/api/health`에서
옮겼다)는 화이트리스트의 `/actuator/health`와 경로가 달라 **인증 대상**이다.

## URL 규약

현재 3형태가 공존한다.

| 형태 | 예 |
|---|---|
| `/api/v1/<도메인>` | `/api/v1/auth/kakao` · `/api/v1/auth/apple` · `/api/v1/auth/signup` · `/api/v1/auth/reissue` · `/api/v1/auth/logout` · `/api/v1/policies` · `/api/v1/images` |
| `/api/v1/<도메인>/{id}/<동작>` | `/api/v1/images/{imageId}/confirm` |
| `/api/v1/<도메인>/me/<하위>` | `/api/v1/users/me` · `/api/v1/users/me/nickname` |
| `/api/v1/groups/{groupId}/<하위>` | `/api/v1/groups/{groupId}/parfaits` · `.../parfaits/year` · `.../parfaits/today` · `.../parfaits/{parfaitId}/images/{parfaitImageId}/border` |
| `/api/v1/test/<도메인>/<동작>` | `/api/v1/test/parfait-canvas/rotate` (테스트 전용) |
| `/api/<도메인>` (버전 없음) | `/api/parfait-groups` |

버전 프리픽스 유무가 갈리고, **그룹을 가리키는 경로가 `groups`와 `parfait-groups` 둘**이다.
서버에 URL 규약 문서가 없어 관측 사실로만 적는다 → [open-questions](../synthesis/open-questions.md).

**URL 세그먼트와 서버 도메인 이름이 갈리는 사례가 늘었다** — `users`↔`member`,
그룹 하위 `images`↔`parfaitimage`. 도메인 파일명 규약은 경로 기준이지만([README.md](README.md))
이 둘은 경로만으로 이름이 겹치거나(`images`) 뜻이 흐려져(`users`) **서버 도메인 이름을 따랐다** —
`users` 경로는 [member.md](member.md)가, 그룹 하위 `images` 경로는 [parfait-image.md](parfait-image.md)가
다룬다.

⚠️ **`images`라는 세그먼트가 두 도메인에 있다** — 최상위 `/api/v1/images`는 업로드([image.md](image.md)),
그룹 하위 `.../parfaits/{parfaitId}/images`는 배치([parfait-image.md](parfait-image.md))다.

## 직렬화 규약

### Boolean 필드의 `is` 접두사는 JSON 키에 **남는다**

> 🔁 **2026-08-11 정정.** 2026-08-02~08-10 판본은 이 절을 "`is` 접두사가 사라진다"로 적었다. **틀렸다.**
> 근거를 OpenAPI 스키마 하나에만 뒀던 것이 원인이다.

서버 `http` 모듈이 `tools.jackson.module:jackson-module-kotlin`을 의존한다. 이 모듈이 붙으면 Jackson이
getter 이름이 아니라 **Kotlin 주 생성자 파라미터명**으로 프로퍼티를 잡으므로, `val isXxx: Boolean`의
**JSON 키는 `isXxx` 그대로**다.

해당 필드는 둘이다 — `KakaoLoginResponse`·`AppleLoginResponse`의 `isNewUser`
(→ [auth.md](auth.md) "판별자 키"). `KakaoLoginControllerTest`·`AppleLoginControllerTest`가 실제 직렬화된
응답 본문에 대해 `jsonPath("$.data.isNewUser")`를 단언한다.

**OpenAPI 스키마는 이 필드를 `newUser`로 적는다.** springdoc이 swagger-core의 자체 ObjectMapper로 모델을
유도하는데 거기엔 Kotlin 모듈이 없어 bean 규칙(`is` 제거)이 적용되기 때문이다. **런타임 직렬화 결과와
다르다** — 아래 [OpenAPI](#openapi) 절의 "코드가 정본" 규칙이 그대로 적용된다.

**소비 측 규칙**: 서버 DTO 프로퍼티명을 **그대로** JSON 키로 본다. 스키마가 다르게 적어도 스키마를 믿지
않는다. Android는 어느 쪽이든 `@SerialName`으로 키를 명시하되 **값은 서버 DTO 프로퍼티명**이어야 한다 —
어긋나면 기본값 없는 필드에서 `MissingFieldException`이 나고 호출이 통째로 실패한다.

### 응답 `null` 필드는 생략되지 않는다

`spring.jackson.default-property-inclusion: always`(`application.yaml`)라, 분기 응답에서 채워지지 않은
쪽도 **키가 `null` 값으로 실려 온다.** 키 존재 여부로 분기를 판정하면 안 된다는 뜻이다.

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

- **코드만 아는 것**: 에러 코드 열거(스키마는 성공 응답만 문서화한다), 검증 규칙, 그리고 **실제 HTTP
  상태 코드**. `POST /api/v1/auth/signup`이 대표적이다 — 스키마는 **200**으로 적었으나 컨트롤러가
  `ResponseEntity.status(HttpStatus.CREATED)`를 쓰므로 실제는 **201**이다. springdoc이 `ResponseEntity`의
  런타임 status를 읽지 못한 것이다. 같은 이유로 `@ResponseStatus`를 쓴 엔드포인트는 정확히 나온다.
- **스키마가 틀리는 것**: 직렬화 키와 `required` 목록. 둘 다 springdoc이 **앱의 ObjectMapper가 아닌
  자기 ObjectMapper**로 유도해 생기는 차이다 → 위 [직렬화 규약](#직렬화-규약)·아래 `required` 절.

> 🔁 **2026-08-11 정정.** 이전 판본은 여기에 "스키마만 아는 것: 직렬화 결과"를 두고 `isNewUser` → `newUser`
> 변환을 그 예로 들었다. 실제로는 **스키마가 틀린 사례**였다 — 직렬화 결과도 코드(컨트롤러 테스트의
> 응답 본문 단언)가 답한다.

**규칙**: 두 근거가 갈리면 **코드가 정본**이다. 스키마는 코드 대조를 대체하지 못한다 — 지금까지 확인된
스키마-코드 차이는 3건(성공 status, `required` 목록, 직렬화 키)이고 전부 코드가 옳았다.

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

**2026-08-11 delta로 이 간극이 넓어졌다.** 스키마 실물을 다시 받지는 않았으나(서버 실행 필요) 규칙상
아래가 예측된다 — 애노테이션이 하나도 없어 `required`가 통째로 비고 실제로는 전부 필수다.

| 요청 DTO | 스키마 `required`(예측) | 실제 비널 필드 |
|---|---|---|
| `AppleLoginRequest` | `identityToken`·`nonce` | 같음(둘 다 `@NotBlank`) — 2026-08-15에 `authorizationCode`가 빠졌다 |
| `ChangeGlobalNicknameRequest` | `nickname` | 같음 |
| `PlaceParfaitImageRequest` | (없음) | `imageId`·`positionX`·`positionY`·`positionZ`·`scale`·`rotation`·`borderType` |
| `UpdateParfaitImageRequest` | (없음) | (없음 — 전 필드가 널 허용, 빈 바디도 유효) |
| `UpdateParfaitImageBorderRequest` | (없음) | `borderType` (2026-08-15 신설) |

빠진 필드도 **누락하면 400이다** — jackson-module-kotlin이 비널 파라미터 부재에서 실패하고
`GlobalExceptionHandler`의 bad-request 핸들러가 `INVALID_REQUEST`로 바꾼다.

**소비 측 규칙**: **스키마에서 클라이언트 모델을 생성하지 않는다.** 생성하면 비널 필드가 nullable로
떨어져 "보내도 되고 안 보내도 되는" 것처럼 보인다. 각 도메인 문서의 "필수" 열이 이 구분을 이미
표기하고 있다 — `필수(@NotBlank)`(스키마에도 있음) vs `필수(non-null 타입)`(스키마에는 없음).

## Android 불일치

TJYG-Android `:data`의 원격 네트워크 구조([ADR-0017](../adr/0017-remote-network-datasource.md))와 위 계약의 간극.

⚠️ **2026-08-15 기준 1건.**

| 항목 | 계약(서버) | Android | 영향 |
|---|---|---|---|
| `MyParfaitGroupResponse.recentImageUploadedAt` 파싱 | `LocalDateTime` — 오프셋 없는 `yyyy-MM-ddTHH:mm:ss`(컨트롤러 테스트가 검증) | `data/source/group/mapper/VOMapper.kt`가 `kotlin.time.Instant::parse`(오프셋 필수) | 최근 이미지가 있는 그룹이 하나라도 있으면 매퍼가 던져 **G-001 목록 조회 전체가 실패**(→ `AppError.Unexpected`) → [open-questions](../synthesis/open-questions.md) [2026-08-15] |

앱 쪽 변경 의도는 "벽시계가 아니라 절대 시점으로 든다"이고 방향은 타당하다 — 어긋난 것은 **서버가 아직
오프셋을 싣지 않는다는 점**이다. 어느 쪽을 고칠지(서버가 오프셋 포함 포맷으로 바꾸거나, 앱이
`LocalDateTime` + 고정 타임존으로 읽거나)는 미결이다.

✅ 오래 걸려 있던 로그인 판별자 키 불일치(응답 키가 `isNewUser`인데 Android가
`@SerialName("newUser")`를 붙였던 건)는 **PR #241로 정정됐고 와이어 계약 테스트가 잠갔다**
([auth.md](auth.md) 각주). 계약 해석의 근거는 위 [직렬화 규약](#직렬화-규약)이다.

> ⚠️ **다만 `http/auth.http`는 아직 `newUser`를 가르친다** — 정정이 앱 DTO와 `http/README.md`에는
> 닿았고 요청 모음 파일 하나에 안 닿았다. 계약 표에 남길 불일치는 아니지만 그 파일로 실서버 응답을
> 확인하려는 사람이 조용히 잘못된 분기를 탄다 → [open-questions](../synthesis/open-questions.md).

**2026-08-04 기준 남은 항목 없음.** 오래 걸려 있던 3건(Android `ApiResponse`에 `success`·`errorDetail`
부재 / `isSuccess`가 `code == "SUCCESS"` 단일 비교 / `TokenProvider`가 항상 null)은
`network-envelope-token-storage` 라운드가 **PR #190으로 develop에 머지되며 전부 해소**됐다 —
envelope 5필드 정합, 성공 판정은 `success` 필드, `TokenProvider`는 `TokenStoreTokenProvider`
([ADR-0019](../adr/0019-encrypted-token-storage.md)). 대응 [open-questions](../synthesis/open-questions.md)
항목도 해소 처리했다.

> **다만 "일치"가 "검증됨"은 아니다.** 14 엔드포인트 Service·DataSource는 2026-08-06 PR #197로,
> 나머지 6개는 2026-08-12 PR #230으로 develop에 들어왔고, **2026-08-15에 다섯 라운드**(PR #241·#242·
> #243·#244·#248)가 카카오 로그인·약관 조회·회원가입·그룹 목록/생성/참여/닉네임 변경 **8 엔드포인트를
> 화면까지** 이었다. 그럼에도 **실서버 요청 검증은 여전히 0건**이다(실기기 미수행) — 위 표의 시각 파싱
> 불일치도 그래서 아직 코드 대조로만 드러난 상태다 → [open-questions](../synthesis/open-questions.md).

**2026-08-15 기준 서버 엔드포인트는 26개(+테스트 전용 1)고 Android 표면은 20개다.** 분모에서 빠지는 것은
애플 로그인 1건(`해당 없음`)과 테스트 전용 회전 1건이라 **20/25, 공백 5**다 — 파르페 오늘 조회·과거 목록,
토핑 테두리 수정·삭제, 회원 탈퇴. 2026-08-12에 닫혔던 공백이 **서버 delta 한 번에 다시 벌어졌다**
(2026-08-10·08-11에 이어 세 번째다) → [open-questions](../synthesis/open-questions.md).

새 간극이 발견되면 이 절에 표를 다시 세운다.
