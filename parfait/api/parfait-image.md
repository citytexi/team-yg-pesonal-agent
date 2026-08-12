---
id: parfait-image
title: 토핑 배치(배치 확정·위치/크기/각도 수정)
server_module: http/parfaitimage
server_commit: 2c5499a
verified: 2026-08-11
android_status: partial
related_spec:
related_adr: ADR-0017
tags: [api, parfait, server-contract, parfait-image]
---

# 토핑 배치(배치 확정·위치/크기/각도 수정) API 계약

> 정본은 서버 코드(`mash-up-kr/TEAMYG-SERVER` `main`). 이 문서는 미러다 — 어긋나면 서버가 옳다.
> 전역 계약(envelope·에러 체계·인증)은 [conventions.md](conventions.md).

`feat: 토핑 배치 확정 API 구현`(PR #75)과 `feat: 토핑 위치/크기/각도 수정 API 구현`(PR #81)으로 신설됐다.
[image.md](image.md)로 올린 이미지를 **캔버스(파르페) 위 좌표에 놓는** 단계다 — 업로드와 배치가 서로 다른
도메인으로 갈려 있다.

**두 단계가 이어진다.** ① `POST /api/v1/images` + S3 PUT + confirm으로 이미지를 `COMPLETED`로 만들고
([image.md](image.md)) ② 그 `imageId`를 이 API에 넘겨 파르페에 배치한다. `COMPLETED`가 아니면 409다.

## 엔드포인트

| 메서드 | 경로 | 인증 | 요청 | 응답 | Android |
|---|---|---|---|---|---|
| POST | `/api/v1/groups/{groupId}/parfaits/{parfaitId}/images` | 필요 | `PlaceParfaitImageRequest` | `PlaceParfaitImageResponse` | 구현됨 |
| PATCH | `/api/v1/groups/{groupId}/parfaits/{parfaitId}/images/{parfaitImageId}` | 필요 | `UpdateParfaitImageRequest` | `UpdateParfaitImageResponse` | 구현됨 |

둘 다 `SecurityConfig.WHITELIST_PATHS`에 없어 **access token이 필요하다**. `groupId`·`parfaitId`는
경로 변수이고 memberId는 토큰에서 나온다.

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
  `PlaceParfaitImageResponse`에 필드가 없어 되돌려 받지 못한다. 앱이 테두리 상태를 알려면 자기 요청 값을
  기억하거나 목록 조회 API를 기다려야 한다(그런 API는 아직 없다) → [미결](#미결).

  `placedBy.nickname`은 **그룹 닉네임**(`groupMember.groupNickname.value`)이지 전역 닉네임이 아니다
  ([member.md](member.md) 참고).

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

  ⚠️ **테두리를 바꿀 방법이 없다.** 요청에 `borderType`·`borderColor`·`borderWidth`가 없고
  `ParfaitImage.update`도 기존 값을 그대로 복사한다. 배치 후 테두리를 바꾸려면 같은 `imageId`로
  **POST를 다시 쏘는 수밖에 없다**(위 upsert 동작) → [미결](#미결).

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

## 도메인 에러 코드 전수

`ParfaitImageErrorCode`(`core/parfaitimage/exception`) 5종 전부. 귀속이 확인되지 않은 코드는 없다.

| HTTP | code | message | 귀속 |
|---|---|---|---|
| 400 | `INVALID_BORDER` | SOLID 테두리는 색상과 두께가 필요합니다 | POST |
| 404 | `PARFAIT_NOT_FOUND` | 존재하지 않는 파르페입니다 | POST |
| 404 | `PARFAIT_IMAGE_NOT_FOUND` | 존재하지 않는 배치입니다 | PATCH |
| 403 | `PARFAIT_IMAGE_NOT_OWNED` | 본인이 배치한 토핑이 아닙니다 | PATCH |
| 409 | `IMAGE_NOT_CONFIRMED` | 업로드가 확인되지 않은 이미지입니다 | POST |

이 도메인은 자기 enum 밖의 코드도 던진다 — `ImageErrorCode.IMAGE_NOT_FOUND`(404),
`ParfaitGroupApiErrorCode.GROUP_NOT_JOINED`(403). 소비 측은 이 도메인 enum만 보고 분기하면 안 된다.

## Android 매핑

**표면 있음, 소비처 0**(2026-08-12, PR #230 develop 머지).

| 계약 | Android 심볼 |
|---|---|
| `POST .../parfaits/{parfaitId}/images` | `ParfaitImageService.postGroupsByGroupIdParfaitsByParfaitIdImages` → `ParfaitImageRemoteDataSource.placeTopping(groupId, parfaitId, imageId, transform, border)` |
| `PATCH .../images/{parfaitImageId}` | `ParfaitImageService.patchGroupsByGroupIdParfaitsByParfaitIdImagesByParfaitImageId` → `ParfaitImageRemoteDataSource.updateTopping(groupId, parfaitId, parfaitImageId, positionX, positionY, positionZ, scale, rotation)` |

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

**응답 VO에 테두리 필드가 없다** — 서버가 저장만 하고 두 응답 어디에도 돌려주지 않아서다(아래 "미결").
앱은 자기가 보낸 값을 기억해야 하고, 그 사실이 VO 모양에 드러나 있다.

**소비처는 0건이다.** 캔버스 토핑 배치(C-106)는 여전히 화면 로컬 상태로만 동작하고, **배치 목록 조회 API가
서버에 없어** 결선해도 캔버스를 다시 그릴 수 없다 → 아래 "미결"·[open-questions](../synthesis/open-questions.md).

`http/parfait-image.http`가 두 요청을 덮는다 — **선행이 셋**(`auth.http` → `parfait-group.http` → `images.http`
발급·PUT·confirm)이고 `parfaitId`는 조회 API가 없어 리터럴을 손으로 바꿔야 한다.

## 미결

- 좌표·`scale`·`rotation`에 서버 검증이 없다 — 범위를 서버가 강제할지, 앱 책임으로 둘지
  → [open-questions](../synthesis/open-questions.md)
- 같은 `imageId` 재-POST가 남의 배치를 옮기고 소유자를 가져간다(POST에 소유자 검사 없음)
  → [open-questions](../synthesis/open-questions.md)
- 배치 후 테두리를 바꿀 경로가 없고, 두 응답이 테두리 필드를 돌려주지 않는다
  → [open-questions](../synthesis/open-questions.md)
- 배치 **목록 조회**와 **삭제** 엔드포인트가 없다 — 캔버스를 다시 그릴 방법이 서버에 아직 없다
  → [open-questions](../synthesis/open-questions.md)
