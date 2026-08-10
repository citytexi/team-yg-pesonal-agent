---
id: image
title: 이미지(업로드 URL 발급·업로드 확인)
server_module: http/image
server_commit: 5bb2a3a
verified: 2026-08-10
android_status: none
related_spec:
related_adr: ADR-0017
tags: [api, parfait, server-contract, image]
---

# 이미지(업로드 URL 발급·업로드 확인) API 계약

> 정본은 서버 코드(`mash-up-kr/TEAMYG-SERVER` `main`). 이 문서는 미러다 — 어긋나면 서버가 옳다.
> 전역 계약(envelope·에러 체계·인증)은 [conventions.md](conventions.md).

`feat: 이미지 업로드 URL 발급 API 구현`(PR #71)과 `feat: 이미지 업로드 확인 API 구현`(PR #73)으로
신설됐다. 토핑 누끼 PNG와 캔버스 배경 이미지가 이 경로로 올라간다.

**서버를 경유하지 않는 2단계 업로드다.** 앱이 ① 서버에서 presigned PUT URL을 받고 ② 그 URL로
S3에 직접 PUT한 뒤 ③ 서버에 업로드 완료를 알린다. 이미지 바이트가 서버 프로세스를 지나가지
않으므로, 업로드 실패·재시도·진행률은 전부 앱 쪽 책임이다.

## 엔드포인트

| 메서드 | 경로 | 인증 | 요청 | 응답 | Android |
|---|---|---|---|---|---|
| POST | `/api/v1/images` | 필요 | `IssueImageUploadUrlRequest` | `IssueImageUploadUrlResponse` | 미구현 |
| POST | `/api/v1/images/{imageId}/confirm` | 필요 | 없음 | `ConfirmImageUploadResponse` | 미구현 |

두 엔드포인트 모두 `SecurityConfig.WHITELIST_PATHS`에 없어 **access token이 필요하다**.

## 엔드포인트 상세

### POST /api/v1/images

업로드용 presigned URL을 발급하고 `PENDING` 상태의 이미지 메타를 만든다.

- **인증**: 필요. `IssueImageUploadUrlController`가 `Authentication.memberId(): Long = name.toLong()`
  확장으로 memberId를 꺼내 command에 싣는다(전역 규약과 동일, [conventions.md](conventions.md) "인증").
- **성공**: HTTP 200 · envelope `code` = `"OK"`.
  ⚠️ **리소스를 만드는 POST인데 `CREATED`가 아니다.** `@ResponseStatus`가 없고 컨트롤러가
  `ApiResponse.ok(...)`를 반환한다. signup(`ResponseEntity.status(HttpStatus.CREATED)` → 201·`"CREATED"`)과
  다르다 — 성공 판정을 `code` 문자열로 하면 두 API가 갈린다.

- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `fileName` | String | 필수(`@NotBlank`) | ⚠️ **서버가 쓰지 않는다** — 아래 참고 |
| `contentType` | String | 필수(`@NotBlank`) | MIME 타입. **`image/png`·`image/jpeg` 2종만 허용** |
| `imageType` | String(enum) | 필수(non-null 타입) | `NUKKI`(토핑 누끼) · `BACKGROUND`(배경). 검증 애노테이션 없음 — 아래 참고 |

  ⚠️ **`imageType`은 OpenAPI 스키마의 `required` 목록에 없다.** springdoc이 `required`를 Bean Validation
  애노테이션에서만 유도하기 때문이다(`fileName`·`contentType`만 `@NotBlank`가 붙어 있다). Kotlin 비널
  타입이라 **실제로는 빼면 400**인데 스키마는 선택 필드로 광고한다 — 스키마에서 클라이언트 코드를
  생성하면 nullable로 떨어진다. 전역 규칙은 [conventions.md](conventions.md) "OpenAPI" 참고.

  ⚠️ **`fileName`은 요청 계약에만 있고 서버 로직에 닿지 않는다.** `IssueImageUploadUrlRequest.toCommand`가
  `memberId`·`contentType`·`imageType`만 `IssueImageUploadUrlCommand`에 싣는다. S3 키의 파일명 부분은
  `ImageKeyGenerator`가 UUID로 만들고 확장자는 `contentType`에서 유도하므로, 원본 파일명은 어디에도
  남지 않는다. 그런데 `@NotBlank`라 **빈 문자열을 보내면 400이 난다** — 앱은 쓰이지 않을 값을
  반드시 채워야 한다 → [미결](#미결).

  ⚠️ **`imageType`이 enum 밖 값이면 Jackson 역직렬화가 먼저 깨진다.** `@NotNull` 같은 검증
  애노테이션이 아니라 `HttpMessageNotReadableException`을 타고 `GlobalExceptionHandler`의
  bad-request 핸들러로 떨어져 `INVALID_REQUEST`(400)가 나간다(`IssueImageUploadUrlControllerTest`가
  이 케이스를 직접 검증한다). 도메인 에러 코드가 아니라 공통 코드라는 뜻이다.

- **응답 필드**

| JSON 키 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `imageId` | Long | 아니오 | 저장된 `image_meta` 행의 id. confirm 호출과 이후 토핑·캔버스 참조에 쓰는 키 |
| `uploadUrl` | String | 아니오 | **S3 presigned PUT URL.** 여기로 앱이 직접 PUT한다 |
| `imageUrl` | String | 아니오 | 업로드 후 접근할 공개 URL. `https://<bucket>.s3.<region>.amazonaws.com/<key>` 형태로 어댑터가 문자열 조립한다 |
| `expiresIn` | Long | 아니오 | `uploadUrl` 유효 시간(초). 설정 `aws.s3.presigned-url-expiration-seconds` 값이 그대로 내려온다 |

  **S3 키 규칙**은 `ImageKeyGenerator.generate`가 정한다 — `<imageType 소문자>/user<memberId>/<UUID>.<확장자>`.
  확장자는 `contentType` 분기(`image/png`→`png`, `image/jpeg`→`jpg`)에서 나오고, 그 외 값은
  `INVALID_CONTENT_TYPE`을 던진다. **지원 이미지 형식이 2종으로 못박혀 있다** — WebP·HEIC는 400이다.

  ⚠️ **PUT 요청의 `Content-Type` 헤더가 발급 때 보낸 `contentType`과 같아야 한다.**
  `ImageUploadUrlIssueAdapter`가 `PutObjectRequest.builder().contentType(contentType)`으로 만든 요청을
  presign하므로 그 헤더가 서명 대상에 들어간다. 앱이 다른 값으로 PUT하면 S3가 서명 불일치로 거절하고,
  그 실패는 **서버 로그에 남지 않는다**(서버를 지나지 않는 요청이다).

  **저장 시점**: presign 발급 직후 `ImageMeta.createPending`이 `status = PENDING`·`referenceCount = 0`으로
  저장된다. 즉 **실제 업로드 성공 여부와 무관하게 행이 먼저 생긴다.**

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_REQUEST` | 바디 형식 오류 · `imageType` enum 밖 값 · `fileName`/`contentType` 공백(`CommonErrorCode`) |
| 400 | `INVALID_CONTENT_TYPE` | `image/png`·`image/jpeg` 외 MIME(`ImageErrorCode`) |
| 404 | `MEMBER_NOT_FOUND` | 존재하지 않는 회원(`ImageErrorCode`) |
| 401 | `UNAUTHORIZED` | 인증 실패(`AuthErrorCode`, 전역) |

  ⚠️ **`MEMBER_NOT_FOUND`가 세 번째 enum에 등장했다.** `AuthErrorCode`는 **401**,
  `ParfaitGroupApiErrorCode`와 `ImageErrorCode`는 **404**다. `code` 문자열 단독 분기가
  세 상황을 한 브랜치로 뭉갠다 → [conventions.md](conventions.md) "코드 문자열은 enum 간 유일하지 않다".

### POST /api/v1/images/{imageId}/confirm

업로드 완료를 서버에 알려 상태를 `PENDING` → `COMPLETED`로 올린다.

- **인증**: 필요(화이트리스트 밖).
  ⚠️ **그런데 컨트롤러가 `Authentication`을 받지 않는다.** `ConfirmImageUploadController.confirm`의
  파라미터는 `@PathVariable imageId`뿐이고, `ConfirmImageUploadCommand`에도 memberId가 없다.
  `ConfirmImageUploadService`는 `imageMetaQueryPort.findById`로 찾은 뒤 소유자(`uploadedByMemberId`)를
  대조하지 않는다 — **토큰만 유효하면 누구든 남의 `imageId`를 확정할 수 있다** → [미결](#미결).
- **성공**: HTTP 200 · envelope `code` = `"OK"`(`ApiResponse.ok`, `@ResponseStatus` 없음).
- **요청 필드**: 바디 없음. 경로 변수 `imageId`(Long)뿐이다.

- **응답 필드**

| JSON 키 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `imageId` | Long | 아니오 | 확정된 이미지 id |
| `imageUrl` | String | 아니오 | 발급 때 내려준 `imageUrl`과 같은 값(`ImageMeta.url` 그대로) |
| `status` | String | 아니오 | `ImageStatus` 이름 문자열. **성공 응답이면 항상 `"COMPLETED"`** — `PENDING`은 409로 걸러진다 |

  ⚠️ **서버는 S3에 객체가 실제로 있는지 확인하지 않는다.** `ConfirmImageUploadService`는 상태 전이만
  한다(`ImageMeta.confirm`). 앱이 PUT을 건너뛰고 confirm만 불러도 `COMPLETED` 행이 남고, 그 `imageUrl`은
  404를 뱉는 주소다. **업로드 성공을 보증하는 것은 앱의 PUT 응답 확인뿐이다.**

  **`referenceCount`는 도메인·엔티티에 있으나 증감 경로가 없다.** 두 API 어디도 이 값을 건드리지
  않고 응답에도 나오지 않는다 — 토핑/캔버스가 이미지를 참조하기 시작할 때 쓰일 자리로 보인다.

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_REQUEST` | `imageId`가 Long으로 변환되지 않음(`MethodArgumentTypeMismatchException` → `CommonErrorCode`) |
| 404 | `IMAGE_NOT_FOUND` | 존재하지 않는 `imageId`(`ImageErrorCode`) |
| 409 | `IMAGE_ALREADY_CONFIRMED` | 이미 `COMPLETED`인 이미지(`ImageErrorCode`) |
| 401 | `UNAUTHORIZED` | 인증 실패(`AuthErrorCode`, 전역) |

  **409는 재시도 안전장치가 아니라 실패다.** 네트워크 타임아웃 후 앱이 confirm을 재시도하면 첫 호출이
  이미 성공했을 때 409가 돌아온다. 앱은 이 코드를 "성공으로 간주"로 매핑할지 정해야 한다 → [미결](#미결).

## 도메인 에러 코드 전수

`ImageErrorCode`(`core/image/exception`) 4종 전부.

| HTTP | code | message |
|---|---|---|
| 400 | `INVALID_CONTENT_TYPE` | 지원하지 않는 이미지 형식입니다 |
| 404 | `MEMBER_NOT_FOUND` | 존재하지 않는 회원입니다 |
| 404 | `IMAGE_NOT_FOUND` | 존재하지 않는 이미지입니다 |
| 409 | `IMAGE_ALREADY_CONFIRMED` | 이미 확인된 이미지입니다 |

## Android 매핑

**없음.** develop뿐 아니라 **origin의 진행 중 브랜치 전수(2026-08-10 기준)에도 심볼이 0건**이다 —
`ImageService`·`ImageRemoteDataSource`·`UploadUrl`류 이름이 어느 브랜치에도 없다.
`data/source/image/local/RecentImageLocalDataSource`와 `data/source/file/local/FileRecentImageLocalDataSource`는
**기기 갤러리 조회용 로컬 소스**라 이 API와 무관하다.

develop의 원격 표면은 여전히 `AuthService`·`ParfaitGroupService`·`ParfaitService`·`PolicyService`
4개뿐이다(= 14 엔드포인트). 즉 **서버가 앞서 있고 앱이 두 칸 뒤에 있다.**

TJYG-Android 루트의 `http/` 요청 모음에도 `images` 요청 파일이 없다 — PR #197로 "14 엔드포인트 전량"을
덮었던 그 모음이 **이번 서버 delta로 2건 부족해졌다** → [open-questions](../synthesis/open-questions.md).

앱이 이 API를 붙일 때 딸려오는 결정(업로드 전용 타임아웃·`callTimeout`·재시도)은 이미 등록돼 있다
→ [open-questions](../synthesis/open-questions.md) `[2026-07-30] 사진 업로드 경로의 타임아웃 정책 미정`.
그 항목이 "업로드 API 미구현"을 이유로 보류 중이었는데 **이제 전제가 사라졌다.**

## 미결

- `fileName`이 `@NotBlank` 필수인데 서버가 쓰지 않는다 — 계약에서 뺄지, 아니면 S3 키·메타에 반영할지
  → [open-questions](../synthesis/open-questions.md)
- confirm에 소유자 검증이 없어 임의 회원이 남의 `imageId`를 확정할 수 있다
  → [open-questions](../synthesis/open-questions.md)
- 확정되지 않은 `PENDING` 이미지·업로드되지 않은 S3 키를 정리하는 경로가 서버에 없다(스케줄러 0건,
  `ImageMetaRepository`는 `JpaRepository` 기본 메서드뿐) → [open-questions](../synthesis/open-questions.md)
- confirm 재시도 시의 409를 앱이 성공으로 볼지 → 위 open-questions 항목에 함께 적는다
