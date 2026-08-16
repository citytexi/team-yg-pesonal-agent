---
id: parfait-image
title: 토핑 배치(배치 확정·위치/크기/각도 수정·테두리 수정·삭제)
server_module: http/parfaitimage
server_commit: 22717fe
verified: 2026-08-16
android_status: partial
related_spec: 2026-08-15-parfait-canvas-topping-member-api-service-layer
related_adr: ADR-0017
tags: [api, parfait, server-contract, parfait-image]
---

# 토핑 배치(배치 확정·위치/크기/각도 수정·테두리 수정·삭제) API 계약

> 정본은 서버 코드(`mash-up-kr/TEAMYG-SERVER` `main`). 이 문서는 미러다 — 어긋나면 서버가 옳다.
> 전역 계약(envelope·에러 체계·인증)은 [conventions.md](conventions.md).

`feat: 토핑 배치 확정 API 구현`(PR #75)과 `feat: 토핑 위치/크기/각도 수정 API 구현`(PR #81)으로 신설됐고,
`feat: 토핑 테두리 두께/색깔 수정 API 구현`(PR #83)·`feat: 토핑 삭제 API 구현`(PR #88)으로 **2 → 4**가 됐다.
[image.md](image.md)로 올린 이미지를 **캔버스(파르페) 위 좌표에 놓는** 단계다 — 업로드와 배치가 서로 다른
도메인으로 갈려 있다.

**두 단계가 이어진다.** ① `POST /api/v1/images` + S3 PUT + confirm으로 이미지를 `COMPLETED`로 만들고
([image.md](image.md)) ② 그 `imageId`를 이 API에 넘겨 파르페에 배치한다. `COMPLETED`가 아니면 409다.

**배치된 토핑을 되읽는 경로가 생겼다** — 이 도메인이 아니라 [parfait.md](parfait.md)의
`GET .../parfaits/today`가 `images` 배열로 내려준다. 이 문서의 오래된 "다시 그릴 수 없다"는 그것으로 닫혔다.

## 엔드포인트

| 메서드 | 경로 | 인증 | 요청 | 응답 | Android |
|---|---|---|---|---|---|
| POST | `/api/v1/groups/{groupId}/parfaits/{parfaitId}/images` | 필요 | `PlaceParfaitImageRequest` | `PlaceParfaitImageResponse` | 구현됨 |
| PATCH | `.../images/{parfaitImageId}` | 필요 | `UpdateParfaitImageRequest` | `UpdateParfaitImageResponse` | 구현됨 |
| PATCH | `.../images/{parfaitImageId}/border` | 필요 | `UpdateParfaitImageBorderRequest` | `UpdateParfaitImageBorderResponse` | 구현됨 |
| DELETE | `.../images/{parfaitImageId}` | 필요 | 없음 | `null`(data 없음) | 구현됨 |

넷 다 `SecurityConfig.WHITELIST_PATHS`에 없어 **access token이 필요하다**. `groupId`·`parfaitId`는
경로 변수이고 memberId는 토큰에서 나온다. 클래스 레벨 매핑
(`/api/v1/groups/{groupId}/parfaits/{parfaitId}/images`)이 **컨트롤러 4개에 각각 반복**돼 있다 —
`PlaceParfaitImageController`·`UpdateParfaitImageController`·`UpdateParfaitImageBorderController`·
`DeleteParfaitImageController`가 한 경로를 나눠 갖는다.

⚠️ **`images`라는 세그먼트가 두 도메인에 있다.** 최상위 `/api/v1/images`는 업로드([image.md](image.md)),
그룹 하위 `.../parfaits/{parfaitId}/images`는 배치다. 두 경로의 `imageId`와 `parfaitImageId`는
**다른 키**다 — 전자는 `image_meta` 행, 후자는 배치 행을 가리킨다.

## 엔드포인트 상세

### POST /api/v1/groups/{groupId}/parfaits/{parfaitId}/images

- **인증**: 필요.
- **성공**: HTTP **201** · envelope `code` = `"CREATED"`(`@ResponseStatus(HttpStatus.CREATED)` +
  `ApiResponse.created`). 리소스 생성 POST에 `ApiResponse.ok`를 쓴 [image.md](image.md)와 다르다 —
  같은 서버 안에서 생성 POST의 성공 코드가 두 갈래다.
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `imageId` | Long | 필수(non-null 타입) | `POST /api/v1/images`가 내려준 `imageId`. **`COMPLETED` 상태여야 한다** |
| `positionX` | Double | 필수(non-null 타입) | |
| `positionY` | Double | 필수(non-null 타입) | |
| `positionZ` | Int | 필수(non-null 타입) | 겹침 순서 |
| `scale` | Double | 필수(non-null 타입) | |
| `rotation` | Double | 필수(non-null 타입) | |
| `borderType` | String(enum) | 필수(non-null 타입) | `NONE` · `SOLID` |
| `borderColor` | String? | 선택 | `borderType=SOLID`면 **필수**(아래) |
| `borderWidth` | Double? | 선택 | `borderType=SOLID`면 **필수**(아래) |

  ⚠️ **검증 애노테이션이 하나도 없다.** `PlaceParfaitImageRequest`에 `@NotNull`·`@Positive` 류가 없고
  컨트롤러도 `@Valid`를 붙이지 않는다. 결과는 둘이다 — ① **OpenAPI 스키마의 `required` 배열이 비어 있다**
  (springdoc이 Bean Validation에서만 `required`를 유도한다, [conventions.md](conventions.md) 참고). 스키마에서
  클라이언트를 생성하면 전 필드가 nullable로 떨어지는데 실제로는 비우면 400이다. ② **좌표·배율·각도의
  범위 검증이 서버에 없다** — 음수 `scale`, 캔버스 밖 좌표, 360을 넘는 `rotation`이 그대로 저장된다
  → [미결](#미결).

  ⚠️ **`borderType`이 enum 밖 값이면 Jackson 역직렬화가 먼저 깨져** `HttpMessageNotReadableException`을
  타고 `INVALID_REQUEST`(400)가 된다. 도메인 코드가 아니라 공통 코드다([image.md](image.md)의
  `imageType`과 같은 구조).

  **`SOLID`면 색·두께가 함께 와야 한다.** `ParfaitImage.validateBorder`가 `borderType == SOLID`이고
  `borderColor`나 `borderWidth`가 `null`이면 `INVALID_BORDER`(400)를 던진다. `NONE`이면 둘 다 무시된다
  (값을 보내도 그대로 저장될 뿐 검증하지 않는다).

- **응답 필드**

| JSON 키 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `parfaitImageId` | Long | 아니오 | 배치 행의 id. 이후 PATCH가 쓰는 키 |
| `imageId` | Long | 아니오 | 요청에 넣은 `image_meta` id 그대로 |
| `imageUrl` | String | 아니오 | `ImageMeta.url` — 배치 시점에 복사해 배치 행에 들고 있는다 |
| `positionX` · `positionY` | Double | 아니오 | 저장된 값 |
| `positionZ` | Int | 아니오 | |
| `scale` · `rotation` | Double | 아니오 | |
| `placedBy` | 객체 | 아니오 | `groupMemberId`(Long) · `nickname`(String) |

  ⚠️ **요청에 보낸 `borderType`·`borderColor`·`borderWidth`가 응답에 없다.** 저장은 되지만
  `PlaceParfaitImageResponse`에 필드가 없어 되돌려 받지 못한다. 다만 **되읽을 자리는 생겼다** —
  [parfait.md](parfait.md)의 `GET .../parfaits/today`가 `images[]`에 테두리 3필드를 실어 준다.
  배치 직후 응답으로는 못 받고 캔버스를 다시 조회해야 안다는 뜻이다.

  `placedBy.nickname`은 **그룹 닉네임**(`groupMember.groupNickname.value`)이지 전역 닉네임이 아니다
  ([member.md](member.md) 참고).

  **부수효과: `image_meta.reference_count`가 1 오른다** — 단, **새 배치일 때만**이다
  (`PlaceParfaitImageService`가 `existing == null`인 경우에만 `imageMeta.incrementReferenceCount()`를 저장).
  같은 `(parfaitId, imageId)` 재-POST(아래 upsert)는 카운트를 올리지 않는다. 이 값이 0이 되는 순간 S3 객체가
  지워진다(아래 DELETE 절) — [image.md](image.md)에 "증감 경로가 없다"고 적혀 있던 자리가 이 라운드로 채워졌다.

  ⚠️ **같은 `(parfaitId, imageId)`로 다시 POST하면 새 행이 생기지 않고 기존 배치가 이동한다.**
  `PlaceParfaitImageService`가 `findByParfaitIdAndImageMetaId`로 기존 배치를 찾아 있으면
  `ParfaitImage.reposition`을 호출한다. 이때 **`placedByGroupMemberId`가 호출자로 다시 쓰인다** — 즉
  **남이 배치한 토핑도 같은 `imageId`만 알면 옮기고 소유자까지 가져올 수 있다.** POST에는 소유자 검사가
  없고 PATCH에만 있다(아래) → [미결](#미결).

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_REQUEST` | 바디 형식 오류 · `borderType` enum 밖 값 · 비널 필드 누락(`CommonErrorCode`) |
| 400 | `INVALID_BORDER` | `SOLID`인데 색·두께 없음(`ParfaitImageErrorCode`) |
| 403 | `GROUP_NOT_JOINED` | 그 그룹의 멤버가 아님(`ParfaitGroupApiErrorCode`) |
| 404 | `PARFAIT_NOT_FOUND` | `parfaitId`가 그 그룹의 파르페가 아님(`ParfaitImageErrorCode`) |
| 404 | `IMAGE_NOT_FOUND` | `imageId` 부재(`ImageErrorCode`) |
| 409 | `IMAGE_NOT_CONFIRMED` | 이미지가 `COMPLETED`가 아님(`ParfaitImageErrorCode`) |
| 401 | `UNAUTHORIZED` 외 | 전역 인증(`AuthErrorCode`) |

  **검사 순서**가 코드에 그대로 있다 — 그룹 참여 → 파르페 존재(`existsByIdAndGroupId`) → 이미지 존재 →
  이미지 상태 → 테두리 검증. 앞이 걸리면 뒤는 실행되지 않는다.
  근거: `PlaceParfaitImageControllerTest`가 성공 201 포함 6케이스를 직접 검증한다.

  ⚠️ **`PARFAIT_NOT_FOUND`는 "존재하지 않음"과 "다른 그룹 것"을 구분하지 않는다.**
  `existsByIdAndGroupId(parfaitId, groupId)` 하나로 판정하므로, 남의 그룹 파르페를 지목해도 404다.

  ⚠️ **파르페 상태를 보지 않는다(2026-08-15 확인).** 그 delta로 `parfait.status`(`ACTIVE`·`CLOSED`·`EMPTY`)가
  생겼는데 이 검사 순서 어디에도 상태 조건이 없다 — **마감된 캔버스에도 토핑을 올릴 수 있다.**
  테두리 수정·삭제도 마찬가지다. 마감 이후 편집을 막는 것은 현재 **앱 책임**이다
  ([parfait.md](parfait.md) 회전 규칙) → [미결](#미결).

### PATCH /api/v1/groups/{groupId}/parfaits/{parfaitId}/images/{parfaitImageId}

- **인증**: 필요.
- **성공**: HTTP 200 · envelope `code` = `"OK"`(`ApiResponse.ok`, `@ResponseStatus` 없음)
- **요청 필드** — 전부 널 허용이고, **`null`이면 기존 값을 유지한다**(부분 수정).

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `positionX` | Double? | 선택 | |
| `positionY` | Double? | 선택 | |
| `positionZ` | Int? | 선택 | |
| `scale` | Double? | 선택 | |
| `rotation` | Double? | 선택 | |

  `ParfaitImage.update`가 `positionX ?: this.positionX` 꼴로 병합한다. **빈 바디 `{}`도 유효하고**
  `updatedAt`만 올라간다(에러가 아니다).

  **이 PATCH는 테두리를 다루지 않는다.** 요청에 `borderType`·`borderColor`·`borderWidth`가 없고
  `ParfaitImage.update`도 기존 값을 그대로 복사한다. 테두리는 **형제 엔드포인트 `.../border`**가 맡는다
  (아래) — 2026-08-15 delta 이전에는 그 경로가 없어 같은 `imageId` 재-POST가 유일한 우회였다.

- **응답 필드**

| JSON 키 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `parfaitImageId` | Long | 아니오 | |
| `positionX` · `positionY` | Double | 아니오 | 병합 후 값 |
| `positionZ` | Int | 아니오 | |
| `scale` · `rotation` | Double | 아니오 | |

  POST 응답에 있던 `imageId`·`imageUrl`·`placedBy`가 없다 — **같은 리소스인데 두 응답의 필드 집합이 다르다.**

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_REQUEST` | 바디 형식 오류 · 경로 변수가 Long이 아님(`CommonErrorCode`) |
| 404 | `PARFAIT_IMAGE_NOT_FOUND` | `parfaitImageId` 부재이거나 그 배치의 `parfaitId`가 경로와 다름(`ParfaitImageErrorCode`) |
| 403 | `PARFAIT_IMAGE_NOT_OWNED` | 본인이 배치한 토핑이 아님(`ParfaitImageErrorCode`) |
| 401 | `UNAUTHORIZED` 외 | 전역 인증(`AuthErrorCode`) |

  ⚠️ **그룹 미참여도 `PARFAIT_IMAGE_NOT_OWNED`(403)로 나간다.** `UpdateParfaitImageService`는
  `findByGroupIdAndMemberId`가 `null`이든, 찾은 멤버가 배치자가 아니든 **같은 코드**를 던진다 —
  POST가 미참여를 `GROUP_NOT_JOINED`로 구분하는 것과 다르다. 앱이 "그룹에서 나갔다"와 "남의 토핑이다"를
  구분해 안내하려면 코드만으로는 안 된다.
  근거: `UpdateParfaitImageControllerTest`가 성공 200 + 404 + 403 세 케이스를 검증한다.

  **POST와 PATCH의 권한 모델이 비대칭이다** — PATCH는 배치자 본인만, POST는 그룹 멤버 누구나
  남의 배치를 덮어쓸 수 있다(위 upsert 참고).

### PATCH /api/v1/groups/{groupId}/parfaits/{parfaitId}/images/{parfaitImageId}/border

`feat: 토핑 테두리 두께/색깔 수정 API 구현`(PR #83)으로 신설됐다. 위치 PATCH와 **다른 경로·다른 컨트롤러**다
(`UpdateParfaitImageBorderController`).

- **인증**: 필요.
- **성공**: HTTP 200 · envelope `code` = `"OK"`(`ApiResponse.ok`, `@ResponseStatus` 없음)
- **요청 필드** — 위치 PATCH와 달리 **부분 수정이 아니다.** 보낸 값으로 세 필드가 통째로 덮인다.

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `borderType` | String(enum) | 필수(non-null 타입) | `NONE` · `SOLID` |
| `borderColor` | String? | 선택 | `borderType=SOLID`면 **필수** |
| `borderWidth` | Double? | 선택 | `borderType=SOLID`면 **필수** |

  `ParfaitImage.updateBorder`가 저장 전에 `validateBorder`를 다시 돌린다 — POST와 **같은 규칙, 같은 코드**
  (`SOLID`인데 색·두께 중 하나라도 `null`이면 400 `INVALID_BORDER`). `NONE`으로 바꾸면서 색·두께를 보내면
  검증 없이 그대로 저장된다.

  ⚠️ **검증 애노테이션도 `@Valid`도 없다** — 요청 DTO에 Bean Validation이 하나도 없고 컨트롤러가 `@Valid`를
  붙이지 않는다. POST와 같은 결과다: OpenAPI 스키마 `required`가 비고, `borderWidth` 음수·과대값을 막는 것이
  서버에 없다([conventions.md](conventions.md) `required` 절).

- **응답 필드**

| JSON 키 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `parfaitImageId` | Long | 아니오 | |
| `borderType` | String | 아니오 | 저장된 enum 이름 문자열(`BorderType.name`) |
| `borderColor` | String? | 예 | 저장된 값 |
| `borderWidth` | Double? | 예 | 저장된 값 |

  **이 도메인에서 테두리를 되돌려주는 유일한 응답이다** — POST·위치 PATCH 둘 다 테두리 필드가 없다.

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_REQUEST` | 바디 형식 오류 · `borderType` enum 밖 값·누락(`CommonErrorCode`) |
| 400 | `INVALID_BORDER` | `SOLID`인데 색·두께 없음(`ParfaitImageErrorCode`) |
| 404 | `PARFAIT_IMAGE_NOT_FOUND` | `parfaitImageId` 부재이거나 그 배치의 `parfaitId`가 경로와 다름 |
| 403 | `PARFAIT_IMAGE_NOT_OWNED` | 본인이 배치한 토핑이 아님 · **그룹 미참여도 같은 코드** |
| 401 | `UNAUTHORIZED` 외 | 전역 인증(`AuthErrorCode`) |

  검사 순서와 코드 선택이 위치 PATCH와 문자 그대로 같다(`UpdateParfaitImageBorderService`가
  `UpdateParfaitImageService`와 같은 두 검사를 같은 순서로 한다) — 그룹 미참여와 "남의 토핑"이 한 코드로
  뭉개지는 것도 동일하다. 근거: `UpdateParfaitImageBorderControllerTest`.

### DELETE /api/v1/groups/{groupId}/parfaits/{parfaitId}/images/{parfaitImageId}

`feat: 토핑 삭제 API 구현`(PR #88)으로 신설됐다.

- **인증**: 필요.
- **성공**: HTTP **200** · envelope `code` = `"OK"` · `data` = `null`.
  ⚠️ **204가 아니다.** `@ResponseStatus`가 없고 컨트롤러가 `ApiResponse.ok(null)`을 반환한다 — 같은 delta에
  들어온 회원 탈퇴(`DELETE /api/v1/users/me`)는 **204에 본문 자체가 없다**([member.md](member.md)).
  **같은 서버의 두 DELETE가 성공 표현을 달리한다.**
- **요청 필드**: 없음(경로 변수 3개뿐)
- **응답 필드**: 없음(`data`가 `null`)

  **부수효과가 셋이다** — 이 API의 본체다.
  ① 배치 행 삭제(`ParfaitImageDeletePort.deleteById`).
  ② `image_meta.reference_count` 1 감소(`ImageMeta.decrementReferenceCount`, 하한 0).
  ③ **감소 결과가 0이면 S3 객체를 지운다**(`ImageDeletePort.delete(url)` → `ImageDeleteAdapter`가
  `imageUrl`에서 버킷·리전 접두사를 잘라 키를 얻고 `DeleteObjectRequest`를 보낸다).
  즉 **같은 이미지를 다른 파르페가 참조 중이면 S3 원본은 남는다.**

  ⚠️ **`image_meta` 행 자체는 남는다** — 카운트가 0이어도 메타 행은 삭제되지 않고 `COMPLETED` 상태로
  존속한다. S3 객체만 사라지므로 그 `imageUrl`은 **404를 뱉는 주소**가 되고, 그 `imageId`로 다시 배치하면
  깨진 이미지가 걸린다(배치 시 검사하는 것은 상태가 `COMPLETED`인지뿐이다) → [미결](#미결).

  ⚠️ **S3 삭제가 트랜잭션 안에서 일어난다.** `@Transactional` 메서드 본문에서 외부 호출을 하므로,
  삭제 성공 후 커밋이 실패하면 **DB에는 배치가 남고 S3 객체만 없어진다.** 회원 탈퇴가 같은 문제를
  `afterCommit` 동기화로 피한 것과 다르다([member.md](member.md)).

  `image_meta`가 없으면 `requireNotNull`이 터져 500이다 — FK로 항상 존재한다는 전제를 코드가 주석으로 밝힌다.

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_REQUEST` | 경로 변수가 Long이 아님(`CommonErrorCode`) |
| 404 | `PARFAIT_IMAGE_NOT_FOUND` | `parfaitImageId` 부재이거나 그 배치의 `parfaitId`가 경로와 다름 |
| 403 | `PARFAIT_IMAGE_NOT_OWNED` | 본인이 배치한 토핑이 아님 · **그룹 미참여도 같은 코드** |
| 401 | `UNAUTHORIZED` 외 | 전역 인증(`AuthErrorCode`) |

  근거: `DeleteParfaitImageControllerTest`가 성공(200·`data` 널)·404·403 세 케이스를 검증한다.
  **삭제는 멱등이 아니다** — 같은 `parfaitImageId`를 두 번 지우면 두 번째는 404다.

## 도메인 에러 코드 전수

`ParfaitImageErrorCode`(`core/parfaitimage/exception`) 5종 전부. 귀속이 확인되지 않은 코드는 없다.

| HTTP | code | message | 귀속 |
|---|---|---|---|
| 400 | `INVALID_BORDER` | SOLID 테두리는 색상과 두께가 필요합니다 | POST · 테두리 PATCH |
| 404 | `PARFAIT_NOT_FOUND` | 존재하지 않는 파르페입니다 | POST |
| 404 | `PARFAIT_IMAGE_NOT_FOUND` | 존재하지 않는 배치입니다 | 위치 PATCH · 테두리 PATCH · DELETE |
| 403 | `PARFAIT_IMAGE_NOT_OWNED` | 본인이 배치한 토핑이 아닙니다 | 위치 PATCH · 테두리 PATCH · DELETE |
| 409 | `IMAGE_NOT_CONFIRMED` | 업로드가 확인되지 않은 이미지입니다 | POST |

이 도메인은 자기 enum 밖의 코드도 던진다 — `ImageErrorCode.IMAGE_NOT_FOUND`(404),
`ParfaitGroupApiErrorCode.GROUP_NOT_JOINED`(403). 소비 측은 이 도메인 enum만 보고 분기하면 안 된다.

## Android 매핑

**네 엔드포인트 전부 표면 있음, 소비처 0**(2026-08-12 PR #230 두 건 + **2026-08-15 PR #250 두 건**).

| 계약 | Android 심볼 |
|---|---|
| `POST .../parfaits/{parfaitId}/images` | `ParfaitImageService.postGroupsByGroupIdParfaitsByParfaitIdImages` → `ParfaitImageRemoteDataSource.placeTopping(groupId, parfaitId, imageId, transform, border)` |
| `PATCH .../images/{parfaitImageId}` | `ParfaitImageService.patchGroupsByGroupIdParfaitsByParfaitIdImagesByParfaitImageId` → `ParfaitImageRemoteDataSource.updateTopping(groupId, parfaitId, parfaitImageId, positionX, positionY, positionZ, scale, rotation)` |
| `PATCH .../images/{parfaitImageId}/border` | `ParfaitImageService.patchGroupsByGroupIdParfaitsByParfaitIdImagesByParfaitImageIdBorder` → `ParfaitImageRemoteDataSource.updateToppingBorder(groupId, parfaitId, parfaitImageId, border)` |
| `DELETE .../images/{parfaitImageId}` | `ParfaitImageService.deleteGroupsByGroupIdParfaitsByParfaitIdImagesByParfaitImageId` → `ParfaitImageRemoteDataSource.deleteTopping(groupId, parfaitId, parfaitImageId)` |

**테두리 수정은 nullable 파라미터가 아니라 `ToppingBorder` 하나를 받는다.** 서버가 세 필드를 통째로
덮기 때문이다(위치 수정의 부분 병합과 다르다). sealed를 그대로 받으므로 `SOLID`인데 색·두께가 빠지는
조합을 만들 수 없고, **400 `INVALID_BORDER`는 앱에서 도달 불가**다. 응답 쪽에는 반대 방향 폴백이 있다 —
`SOLID`인데 색·두께가 비면 `ToppingBorder.None`으로 떨어뜨린다(이미 저장된 행 대비).

**두 DELETE가 `ApiCaller` 진입점을 달리 쓴다.** 토핑 삭제는 200 + `data: null`이라
`safeApiCallWithoutData`, 회원 탈퇴는 204·본문 없음이라 `safeApiCallNoContent`다
([member.md](member.md)). 死코드로 지적돼 있던 `safeApiCallWithoutData`가 **첫 프로덕션 소비처**를
얻었다. 설계 근거는
[specs/archive/2026-08-15-parfait-canvas-topping-member-api-service-layer](../specs/archive/2026-08-15-parfait-canvas-topping-member-api-service-layer.md).

**이름이 계층마다 갈린다.** `data`는 서버 언어(`ParfaitImageService`·`PlaceParfaitImageRequest`),
`domain`은 제품 언어(`PlacedToppingVO`·`ToppingTransform`·`ToppingBorder`·`UpdatedToppingVO`) —
제품 어디에도 "parfait image"라는 말이 없고 위키·기획은 전부 "토핑"이다. `source/parfaitimage/mapper/VOMapper.kt`가
그 번역 지점이다. 설계 근거는
[specs/archive/2026-08-11-member-parfait-image-api-service-layer](../specs/archive/2026-08-11-member-parfait-image-api-service-layer.md).

계약의 얽힌 제약 하나를 타입이 강제한다 — **`borderType = SOLID`면 색·두께가 필수**(아니면 400
`INVALID_BORDER`)라는 규칙을 `sealed interface ToppingBorder { None | Solid(color, width) }`로 모델링해
그 실패를 표현 불가능한 상태로 만들었다. 매퍼가 평면 3필드(`borderType`·`borderColor`·`borderWidth`)로 편다.
`ToppingTransform`도 `Double` 넷이 연속이라 순서 뒤바뀜을 막으려고 묶었다. **wire DTO는 계약 문서와 눈으로
대조돼야 해서 평면을 유지**한다.

**POST와 PATCH의 비대칭은 서버 계약의 비대칭이다** — POST는 `ToppingTransform` 통째를 받고 PATCH는
nullable 5파라미터다. PATCH 요청 DTO의 5필드가 전부 `= null` 기본값인데 `@RemoteJson`이
`encodeDefaults = true`라 **안 바꾸는 필드도 `"positionX": null`로 실려 나간다.** 서버 `ParfaitImage.update`가
`?:` 병합이라 키 부재와 동치이므로 동작은 정확하다.

**POST·위치 PATCH 응답 VO에는 여전히 테두리 필드가 없다** — 두 응답이 테두리를 돌려주지 않아서다.
대신 **되읽을 두 자리가 실제로 생겼다**: 테두리 PATCH 응답(`UpdatedToppingBorderVO` —
`domain/model/topping/`, 앱이 테두리를 되받는 첫 자리)과 `parfaits/today`의 `images[]`
(`CanvasToppingVO`). `CanvasToppingVO`를 `PlacedToppingVO`와 합치지 않은 것도 같은 이유다 —
POST 응답에 없는 값을 지어내거나 nullable로 "모른다"와 "없다"를 뭉개게 된다.

**소비처는 0건이다.** 캔버스 토핑 배치(C-106)는 여전히 화면 로컬 상태로만 동작한다. 다만 **"다시 그릴 수
없다"는 사유도, 앱 표면 공백도 사라졌다** — `GET .../parfaits/today`가 배치 전량을 내려주고
([parfait.md](parfait.md)) 네 엔드포인트 전부 DataSource까지 와 있다. 남은 것은 Repository·UseCase·화면
결선이다 → [open-questions](../synthesis/open-questions.md).

`http/parfait-image.http`가 **네 요청을 전부** 덮는다(2026-08-15). **선행이 넷**이 됐다 —
`auth.http` → `parfait-group.http` → `images.http`(발급·PUT·confirm) → `parfait.http`(오늘의 캔버스
조회가 `parfait_id`를 채운다). `parfaitId` 리터럴을 손으로 바꾸던 단계는 사라졌다.

## 미결

- 좌표·`scale`·`rotation`·`borderWidth`에 서버 검증이 없다 — 범위를 서버가 강제할지, 앱 책임으로 둘지
  → [open-questions](../synthesis/open-questions.md)
- 같은 `imageId` 재-POST가 남의 배치를 옮기고 소유자를 가져간다(POST에 소유자 검사 없음)
  → [open-questions](../synthesis/open-questions.md)
- 삭제가 S3 객체를 지우면서 `image_meta` 행은 `COMPLETED`로 남긴다 — 그 `imageId`로 다시 배치하면 깨진
  이미지가 걸린다 → [open-questions](../synthesis/open-questions.md)
- 삭제의 S3 호출이 트랜잭션 안에 있어 커밋 실패 시 DB와 S3가 갈린다
  → [open-questions](../synthesis/open-questions.md)
- 네 엔드포인트 어디도 `parfait.status`를 보지 않아 **마감된 캔버스도 편집된다** — 서버가 막을지 앱 책임으로
  둘지 → [open-questions](../synthesis/open-questions.md)

✅ **2026-08-15 해소** — ① 배치 **삭제** 엔드포인트 신설, ② 배치 후 **테두리 변경 경로** 신설,
③ 배치 **목록 조회** 부재는 [parfait.md](parfait.md) `GET .../parfaits/today`가 대신 닫았다.
