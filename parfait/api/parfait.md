---
id: parfait
title: 파르페(캔버스) 조회·배경·회전
server_module: http/parfait
server_commit: 22717fe
verified: 2026-08-16
android_status: partial
related_spec: 2026-08-15-parfait-canvas-topping-member-api-service-layer, 2026-08-16-canvas-detail-background-api-service-layer, c201-canvas-calendar, c201-canvas-calendar-server
related_adr: ADR-0017
tags: [api, parfait, server-contract, canvas]
---

# 파르페(캔버스) 조회·배경·회전 API 계약

> 정본은 서버 코드(`mash-up-kr/TEAMYG-SERVER` `main`). 이 문서는 미러다 — 어긋나면 서버가 옳다.
> 전역 계약(envelope·에러 체계·인증)은 [conventions.md](conventions.md).

`feat: 오늘의 파르페(캔버스) 조회 API 구현`(PR #92)·`feat: 과거 파르페(캔버스) 목록 조회 API 구현`(PR #94)·
`[Feat/#85] 캔버스 상태 자동 전환 배치(새벽 3시) 구현 (#97)`으로 **1 → 3 엔드포인트 + 테스트 전용 1**이 됐고,
`feat: 이전 파르페(캔버스) 상세 조회 API 구현`(PR #96)·`feat: 파르페(캔버스) 배경 변경 API 구현`(PR #103)이
**3 → 5**로 올렸다. `parfait` 테이블의 `status`·`background_type`·`background_value` 세 컬럼
(`V11__add_status_and_background_to_parfait.sql`)은 이 라운드에 **쓰기 경로를 얻었다** — 배경 필드가
"읽기만 있고 채우는 코드가 없는" 상태가 닫혔다.

## 엔드포인트

| 메서드 | 경로 | 인증 | 요청 | 응답 | Android |
|---|---|---|---|---|---|
| GET | `/api/v1/groups/{groupId}/parfaits/year` | 필요 | path `groupId` Long | `ParfaitYearsResponse` | 구현됨 |
| GET | `/api/v1/groups/{groupId}/parfaits/today` | 필요 | path `groupId` Long | `GetTodayParfaitResponse` | 구현됨 |
| GET | `/api/v1/groups/{groupId}/parfaits` | 필요 | query `from`·`to`(선택) | `PastParfaitsResponse` | 구현됨 |
| GET | `/api/v1/groups/{groupId}/parfaits/{parfaitId}` | 필요 | path `groupId`·`parfaitId` Long | `GetTodayParfaitResponse`(**재사용**) | 구현됨 |
| PATCH | `/api/v1/groups/{groupId}/parfaits/{parfaitId}/background` | 필요 | `ChangeParfaitBackgroundRequest` | `ChangeParfaitBackgroundResponse` | 구현됨 |
| POST | `/api/v1/test/parfait-canvas/rotate` | **불필요(화이트리스트)** | 없음 | `RotateParfaitCanvasesResponse` | 해당 없음[^test] |

[^test]: **테스트 전용 엔드포인트다.** 서버 컨트롤러(`ParfaitCanvasRotationTestController`)와
`SecurityConfig.WHITELIST_PATHS` 양쪽에 "프로덕션 오픈 전 함께 제거할 것"이라는 TODO가 달려 있다.
앱이 붙일 대상이 아니다 → [미결](#미결).

경로 주의: 그룹을 `groups`로 부르는 유일한 경로다(다른 그룹 API는 `parfait-groups`) —
[conventions.md](conventions.md)의 URL 규약 절 참고.

컨트롤러 주의: 조회 넷은 `ParfaitController` 하나에 모였지만 **배경 변경만 별도 컨트롤러**
(`ChangeParfaitBackgroundController`)다. 같은 `http/parfait` 패키지이고 OpenAPI 태그도 `Parfait`로
같으므로 소비 측에서는 한 도메인으로 본다. 상세 조회의 `@GetMapping("/{parfaitId}")`가 `year`·`today`
같은 고정 세그먼트와 한 컨트롤러 안에서 겹치지만, Spring이 고정 세그먼트를 먼저 매칭하므로
`/parfaits/year`가 `parfaitId = "year"`로 새지 않는다(`year`는 Long 변환도 안 된다).

## 엔드포인트 상세

### GET /api/v1/groups/{groupId}/parfaits/year

- **인증**: 필요
- **성공**: HTTP 200 · envelope `code` = `"OK"`(`ApiResponse.ok`)
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `groupId` | Long | 필수(path) | |

- **응답 필드**

| 필드 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `years` | List<Int> | 아니오 | 해당 그룹에 파르페(캔버스)가 존재하는 연도 목록 |

  **관측 사실**: 경로 세그먼트는 단수 `year`인데 응답 필드는 복수 `years`(목록)다 — 세그먼트 이름과 응답
  형태가 어긋난다. 서버 코드에 의도를 밝히는 주석·문서는 없다.

  용도 메모: C-201 캘린더가 연도 선택지를 그릴 때 쓸 값이다. `ParfaitService.getYears`는 정렬을 직접
  수행하지 않고 `ParfaitQueryPort.findDistinctYearsByGroupId`가 반환한 순서를 그대로 내려준다 —
  다만 그 구현(`ParfaitRepository.findDistinctYearsByParfaitGroupId`)의 JPQL이 `ORDER BY YEAR(...) ASC`를
  들고 있어 실제로는 **오름차순**이다. 보장 주체가 서비스가 아니라 쿼리라는 뜻이다.

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 403 | `GROUP_NOT_JOINED` | 참여하지 않은 그룹입니다 |

  **그룹 미참여 시 동작(권한 검사 유무 확인)**: 권한 검사가 **있다**. `ParfaitService.getYears`가 연도
  조회보다 먼저 `ParfaitGroupMemberQueryPort.existsByGroupIdAndMemberId(groupId, memberId)`로 그룹
  멤버십을 확인하고, 없으면 `ParfaitGroupException(ParfaitGroupError.GROUP_NOT_JOINED)`를 던진다.
  `GlobalExceptionHandler.handleParfaitGroupException`이 `ParfaitGroupApiErrorCode.from(error)`로
  변환해 403으로 응답한다 — parfait 도메인 전용 enum이 아니라 [parfait-group.md](parfait-group.md)의
  `ParfaitGroupApiErrorCode`를 그대로 재사용한 것(`from(error) = valueOf(error.name)`,
  [conventions.md](conventions.md) 참고). 근거: `ParfaitServiceTest`("그룹에 참여하지 않은 회원은 조회를
  거부한다")가 직접 검증.

  **주의**: `getYears`는 그룹 존재 여부를 별도로 확인하지 않는다. `existsByGroupIdAndMemberId`가 그룹
  존재·멤버십을 한 번에 판정하므로, 존재하지 않는 `groupId`를 넘겨도 `GROUP_NOT_FOUND`가 아니라
  `GROUP_NOT_JOINED`가 나온다 — `GROUP_NOT_FOUND`를 `GROUP_NOT_JOINED`보다 먼저 별도로 던지는
  parfait-group 도메인의 상세·닉네임변경·탈퇴·신고 4개 엔드포인트와 다른 동작이다.
  **세 조회 엔드포인트가 전부 이 방식이다.**

### GET /api/v1/groups/{groupId}/parfaits/today

C-001 캔버스 메인이 그릴 **오늘의 캔버스 전체**를 한 번에 내려준다 — 상태·멤버 목록·배경·배치된 토핑 전량이
한 응답에 들어 있다. 배치 목록을 따로 얻는 API는 여전히 없고, **이 엔드포인트가 그 자리를 대신한다.**

- **인증**: 필요
- **성공**: HTTP 200 · envelope `code` = `"OK"`(`ApiResponse.ok`, `@ResponseStatus` 없음)
- **요청 필드**: 경로 변수 `groupId`뿐(쿼리·바디 없음)

  ⚠️ **읽기인데 쓰기가 일어난다.** `GetTodayParfaitService`가 `EnsureActiveCanvasUseCase.ensure(groupId, 오늘)`을
  호출하고, 그 구현(`ParfaitService.ensure`)은 해당 날짜 파르페가 없으면 **`Parfait.createToday`로 새로 만들어
  저장한다**(`@Transactional`, `readOnly`가 아니다). GET 한 번이 행을 만든다는 뜻이다 — 캘린더·연도 목록에도
  그날이 즉시 나타난다 → [미결](#미결).

  ⚠️ **`ensure`는 상태가 아니라 날짜로 찾는다.** `findByGroupIdAndDate`라서, 오늘 날짜 캔버스가 이미
  `CLOSED`·`EMPTY`면 **그것을 그대로 돌려준다**(새로 만들지 않는다). 응답 `status`가 `ACTIVE`가 아닐 수 있고,
  그때는 토핑을 더 올릴 수 없는 캔버스를 "오늘"로 받는다.

- **응답 필드**

| JSON 키 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `parfaitId` | Long | 아니오 | 토핑 배치([parfait-image.md](parfait-image.md))가 쓰는 키 |
| `date` | LocalDate | 아니오 | 캔버스 날짜 |
| `status` | String(enum) | 아니오 | `ACTIVE` · `CLOSED` · `EMPTY` |
| `lastClosedDate` | LocalDate? | 예 | 그 그룹의 **마지막 `CLOSED` 캔버스 날짜**. 아래 참고 |
| `groupMembers` | List<객체> | 아니오 | 원소: `id`(Long, **groupMemberId**) · `nickname`(String) |
| `background` | 객체? | 예 | `type`(`COLOR`·`IMAGE`) · `value`(String) |
| `images` | List<객체>? | **예** | 배치된 토핑. **0건이면 빈 배열이 아니라 `null`** |

  토핑 원소(`TodayParfaitImageResponse`) 필드: `parfaitImageId` · `imageId` · `imageUrl` ·
  `positionX`/`positionY`(Double) · `positionZ`(Int) · `scale`/`rotation`(Double) ·
  `borderType`(`NONE`·`SOLID`) · `borderColor`(String?) · `borderWidth`(Double?) ·
  `placedBy`(`groupMemberId`·`nickname`) · `createdAt`(LocalDateTime).

  ⚠️ **`lastClosedDate`는 `EMPTY`를 세지 않는다.** `ParfaitAdapter.findLastClosedDateByGroupId`가
  `status = CLOSED` 행만 최신순으로 하나 집는다. 토핑 0건으로 마감된 날은 `EMPTY`라 여기 잡히지 않으므로,
  이 값은 "마지막으로 마감된 날"이 아니라 **"마지막으로 토핑이 있던 날"**이다.

  ⚠️ **0건 표현이 `null`이다.** `buildImages`가 빈 목록에서 `null`을 반환한다. `background`도 `type`·`value`
  둘 중 하나라도 없으면 통째로 `null`이다. envelope는 `default-property-inclusion: always`라 키 자체는
  실려 오므로([conventions.md](conventions.md)), 소비 측은 **키 존재가 아니라 값이 `null`인지**로 갈라야 한다.

  ✅ **배경을 설정하는 API가 생겼다**(2026-08-16, PR #103) — 아래
  [PATCH .../background](#patch-apiv1groupsgroupidparfaitsparfaitidbackground). 이전 판본이 "쓰기 경로가
  서버 어디에도 없어 항상 `null`"이라고 적던 자리다. **C-301 배경 편집 화면**(develop, PR #231)이 고른
  배경을 버리던 이유 중 서버 절반이 닫혔고, **앱 표면도 다음 날 붙었다**(PR #266) — 남은 것은
  Repository·UseCase·화면이다 → [open-questions](../synthesis/open-questions.md).

  **`groupMembers`는 탈퇴하지 않은 멤버만**이다(`findAllByGroupIdAndLeftAtIsNullOrderByJoinedAtAscIdAsc` —
  참여 순). ⚠️ **그런데 `placedBy` 조회에는 그 필터가 없다**(`findAllByIdIn`). 탈퇴한 멤버가 남긴 토핑은
  그대로 보이고 그 `placedBy.nickname`은 `GroupNickname.unknown()`이 넣은 **`(알수없음)`**이다
  (탈퇴 시 닉네임이 이 값으로 대체된다 — [parfait-group.md](parfait-group.md)·[member.md](member.md)).
  즉 `images[].placedBy.groupMemberId`가 `groupMembers`에 없을 수 있다 → [미결](#미결).

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 403 | `GROUP_NOT_JOINED` | 그 그룹의 멤버가 아님(`ParfaitGroupApiErrorCode`) |
| 401 | `UNAUTHORIZED` 외 | 전역 인증(`AuthErrorCode`) |

  근거: `ParfaitControllerTest`가 성공·빈 캔버스(`background`·`images` 널)·403 세 케이스를 직접 검증한다.

### GET /api/v1/groups/{groupId}/parfaits

과거 캔버스 목록. C-201 캘린더·목록이 쓸 요약 형태다.

- **인증**: 필요
- **성공**: HTTP 200 · envelope `code` = `"OK"`(`ApiResponse.ok`)
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `from` | LocalDate | 선택(query) | 생략 시 `to - 30일` |
| `to` | LocalDate | 선택(query) | 생략 시 **서버 기준 오늘** |

  **기본 범위는 30일이다**(`GetPastParfaitsService.DEFAULT_RANGE_DAYS`). `to`만 주면 그 날부터 30일 전까지,
  둘 다 생략하면 오늘부터 30일 전까지다. 상한이 없어 **범위를 크게 주면 그만큼 다 내려온다** — 페이지네이션이
  없다.

  `from > to`면 400 `INVALID_DATE_RANGE`다. 기본값이 적용된 **뒤에** 비교하므로, `from`만 미래로 주면
  (`to`는 오늘) 이 에러가 난다.

- **응답 필드**

| JSON 키 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `parfaits` | List<객체> | 아니오 | 0건이면 **빈 배열**(`today`와 반대다) |

  원소 필드: `parfaitId`(Long) · `date`(LocalDate) · `thumbnailUrl`(String?) · `imageCount`(Int).

  ⚠️ **`thumbnailUrl`은 항상 `null`이다.** `GetPastParfaitsService`가 `thumbnailUrl = null`을 리터럴로 넣는다 —
  필드만 있고 채우는 코드가 없다. 앱이 목록 썸네일을 그리려면 다른 값을 써야 한다 → [미결](#미결).

  **정렬은 날짜 내림차순**(`findAllByParfaitGroupIdAndParfaitDateBetweenOrderByParfaitDateDesc`).
  **상태로 거르지 않는다** — 오늘의 `ACTIVE` 캔버스도 범위에 들면 그대로 포함된다.
  `imageCount`는 `ParfaitImageRepository.countAllByParfaitIdIn` 집계이고, 배치가 0건인 파르페는 집계 결과에
  키가 없어 `0`으로 채워진다.

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_DATE_RANGE` | `from`이 `to`보다 늦음(`ParfaitErrorCode`) |
| 400 | `INVALID_REQUEST` | `from`·`to`가 `LocalDate`로 파싱되지 않음(`CommonErrorCode`) |
| 403 | `GROUP_NOT_JOINED` | 그 그룹의 멤버가 아님(`ParfaitGroupApiErrorCode`) |
| 401 | `UNAUTHORIZED` 외 | 전역 인증(`AuthErrorCode`) |

  근거: `ParfaitControllerTest`가 성공·기본값 위임·400·403 네 케이스를 직접 검증한다.

### GET /api/v1/groups/{groupId}/parfaits/{parfaitId}

과거 목록에서 항목을 눌러 들어가는 **캔버스 상세**다. 응답 타입이 `today`와 **같은 클래스**
(`GetTodayParfaitResult`·`GetTodayParfaitResponse`)라 필드 구성이 완전히 동일하다 — 소비 측은 DTO를
하나만 만들면 된다.

- **인증**: 필요
- **성공**: HTTP 200 · envelope `code` = `"OK"`(`ApiResponse.ok`, `@ResponseStatus` 없음)
- **요청 필드**: 경로 변수 `groupId`·`parfaitId`(쿼리·바디 없음)
- **응답 필드**: `today`와 동일 → [위 표](#get-apiv1groupsgroupidparfaitstoday) 참고.
  `lastClosedDate`·`groupMembers`·`background`·`images`의 널 규칙(0건이 빈 배열이 아니라 `null`)도 같다.

  **`today`와 다른 점은 셋이다.**
  ① **부작용이 없다** — `EnsureActiveCanvasUseCase`를 부르지 않고 `@Transactional(readOnly = true)`다.
  없는 날짜를 조회해도 행이 생기지 않는다.
  ② **날짜가 아니라 id로 찾는다**(`ParfaitRepository.findByIdAndParfaitGroupId`). 그룹이 다르면 조회되지
  않으므로 **남의 그룹 캔버스를 id로 훔쳐볼 수 없다**(응답은 404 `PARFAIT_NOT_FOUND`, 403이 아니다).
  ③ **상태로 거르지 않는다** — `ACTIVE`인 오늘 캔버스도 이 경로로 조회된다. "이전 파르페 상세"라는
  이름이지만 계약상 과거 전용이 아니다.

  `lastClosedDate`는 **조회 대상 파르페 기준이 아니라 그룹 기준**이다(`findLastClosedDateByGroupId`) —
  과거 캔버스를 봐도 그 값은 그룹의 최신 마감일이라 **조회 대상 날짜보다 뒤일 수 있다.**

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 404 | `PARFAIT_NOT_FOUND` | 파르페가 없거나 **그 그룹 소속이 아님**(`ParfaitErrorCode`) |
| 403 | `GROUP_NOT_JOINED` | 그 그룹의 멤버가 아님(`ParfaitGroupApiErrorCode`) |
| 400 | `INVALID_REQUEST` | `parfaitId`가 Long으로 파싱되지 않음(`CommonErrorCode`) |
| 401 | `UNAUTHORIZED` 외 | 전역 인증(`AuthErrorCode`) |

  멤버십 검사가 파르페 조회보다 **먼저**다 — 남의 그룹이면 파르페 존재 여부와 무관하게 403이다.
  근거: `ParfaitControllerTest`가 성공·404·403 세 케이스를 직접 검증한다.

### PATCH /api/v1/groups/{groupId}/parfaits/{parfaitId}/background

C-301 배경 편집이 고른 값을 **서버에 저장**하는 경로다. 단색(HEX) 또는 업로드 완료된 이미지 둘 중 하나로
바꾼다.

- **인증**: 필요
- **성공**: HTTP 200 · envelope `code` = `"OK"`(`ApiResponse.ok`, `@ResponseStatus` 없음)
- **요청 필드**(`ChangeParfaitBackgroundRequest`)

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `type` | String(enum) | 필수 | `COLOR` · `IMAGE` |
| `value` | String? | `type = COLOR`일 때 필수 | HEX 문자열. `#` + 6자리(대소문자 무관) |
| `imageId` | Long? | `type = IMAGE`일 때 필수 | [image.md](image.md)의 업로드 확인을 마친 이미지 |

  ⚠️ **Bean Validation 애노테이션이 하나도 없다.** 필수 여부는 서비스(`resolveValue`)와 도메인
  (`Parfait.changeBackground`)이 판정하므로 **OpenAPI 스키마 `required`에는 `type`조차 나오지 않는다**
  ([conventions.md](conventions.md) "OpenAPI가 모르는 것"). `type`은 Kotlin 비널이라 누락하면 검증
  에러가 아니라 역직렬화 실패 → 400 `INVALID_REQUEST`다.

  **타입별로 다른 필드가 필수인데 표현 수단이 널 허용 두 개뿐이다.** `type = COLOR` + `imageId`만,
  또는 `type = IMAGE` + `value`만 보내면 400 `INVALID_BACKGROUND`다. 반대로 **둘 다 채워 보내면 오류가
  아니라 `type`에 해당하는 쪽만 쓰이고 나머지는 조용히 버려진다.**

  **HEX 검증은 도메인이 한다** — `Parfait.changeBackground`의 `HEX_COLOR_PATTERN`이 `#` + 6자리만
  통과시킨다. 3자리 축약형·8자리 알파 포함·`#` 없는 형태는 전부 400 `INVALID_BACKGROUND`다.

- **응답 필드**(`ChangeParfaitBackgroundResponse`)

| JSON 키 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `background` | 객체 | 아니오 | `type`(`COLOR`·`IMAGE`) · `value`(String) |

  **중첩 `BackgroundResponse`는 조회 응답의 것을 그대로 재사용**한다(`GetTodayParfaitResponse.kt`에
  선언된 같은 클래스). 조회에서는 `background`가 널 허용인데 **여기서는 비널**이다 — 방금 설정한 값을
  돌려주기 때문이다.

  ⚠️ **`type = IMAGE`로 저장되는 `value`는 `imageId`가 아니라 이미지 URL이다**(`ImageMeta.url`). 요청은
  id로 받고 응답·조회는 URL로 내려온다. 앱이 "지금 배경이 어느 이미지인지"를 id로 되짚을 방법이
  계약에 없다 → [미결](#미결).

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_BACKGROUND` | 타입에 필요한 값 누락, 또는 HEX 형식 위반(`ParfaitErrorCode`) |
| 404 | `PARFAIT_NOT_FOUND` | 파르페가 없거나 그 그룹 소속이 아님(`ParfaitErrorCode`) |
| 404 | `IMAGE_NOT_FOUND` | `imageId`에 해당하는 이미지 메타 없음(`ImageErrorCode`) |
| 409 | `BACKGROUND_IMAGE_NOT_CONFIRMED` | 이미지가 `COMPLETED`가 아님(`ParfaitErrorCode`) |
| 403 | `GROUP_NOT_JOINED` | 그 그룹의 멤버가 아님(`ParfaitGroupApiErrorCode`) |
| 400 | `INVALID_REQUEST` | 바디 역직렬화 실패(`type` 누락·모르는 enum 값 등, `CommonErrorCode`) |
| 401 | `UNAUTHORIZED` 외 | 전역 인증(`AuthErrorCode`) |

  **한 엔드포인트가 세 enum의 코드를 섞어 낸다**(`ParfaitErrorCode`·`ImageErrorCode`·
  `ParfaitGroupApiErrorCode`). 이미지 미확인은 `ImageErrorCode`가 아니라 **parfait 쪽 enum**
  (`BACKGROUND_IMAGE_NOT_CONFIRMED`)이라는 점이 특히 갈린다 — 소비 측은 도메인별로 분기하면 놓친다.
  근거: `ChangeParfaitBackgroundControllerTest`가 성공 2·400·404 2·409·403 일곱 케이스를 직접 검증한다.

  ⚠️ **마감된 캔버스의 배경도 바꿀 수 있다.** `ChangeParfaitBackgroundService`가 `status`를 보지 않아
  `CLOSED`·`EMPTY` 파르페에도 그대로 저장된다. 토핑 네 엔드포인트도 상태를 보지 않으므로
  ([parfait-image.md](parfait-image.md)) **마감 후 편집을 막는 서버 가드는 지금 어디에도 없다** —
  `PARFAIT_ALREADY_CLOSED`는 회전 로직 안에만 있다 → [미결](#미결).

  ⚠️ **배경 이미지는 `image_meta.reference_count`를 올리지 않는다.** 증감 경로는 토핑 배치(+1)·토핑
  삭제(−1)뿐이고([parfait-image.md](parfait-image.md)) 이 API는 `ImageMetaQueryPort`로 **읽기만** 한다.
  같은 이미지를 토핑으로도 올렸다가 그 토핑을 지우면 카운트가 0이 되어 **S3 객체가 삭제되고 배경이
  깨진다** → [미결](#미결).

### POST /api/v1/test/parfait-canvas/rotate (테스트 전용)

⚠️ **인증 없이 전체 그룹의 캔버스를 즉시 마감·재생성한다.** 화이트리스트에 올라 있어 토큰 없이 호출되고,
대상이 특정 그룹이 아니라 **모든 그룹**이다. 서버 코드의 TODO가 프로덕션 오픈 전 제거를 예고한다
→ [미결](#미결).

- **인증**: 불필요(`SecurityConfig.WHITELIST_PATHS`에 `/api/v1/test/parfait-canvas/rotate` 등재)
- **성공**: HTTP 200 · envelope `code` = `"OK"`
- **요청 필드**: 없음
- **응답 필드**: `closedCount` · `emptyCount` · `createdCount` · `failedCount`(전부 Int)

  `ParfaitService.rotateAll`이 `ParfaitGroupQueryPort.findAllIds()`로 전 그룹을 돌며 그룹당
  `ParfaitCanvasRotator.rotateOne`을 재시도 정책(`canvasRotationRetryTemplate` — 3회·고정 백오프)으로
  실행한다. 그룹 하나가 3회 모두 실패하면 `failedCount`만 올리고 **다음 그룹으로 넘어간다**(전체가 멈추지 않음).

## 캔버스 회전(마감·재생성) 규칙

앱이 부르는 API는 아니지만 **`today` 응답의 `status`·`lastClosedDate`가 이 규칙의 산물**이라 계약의 일부다.

- **시각**: 매일 **03:00 Asia/Seoul**(`ParfaitCanvasRotationScheduler`의 `@Scheduled(cron)`).
  Spring Batch job(`ParfaitCanvasRotationJobConfig`·`ParfaitCanvasRotationTasklet`)으로 돈다
  (`V12__add_spring_batch_schema.sql`가 배치 메타 테이블을 깐다). 위키 [[캔버스-마감-스케줄]]의 03시와 같다.
- **그룹당 1회전**: `findActiveByGroupId`로 `ACTIVE` 캔버스를 찾고, 없으면 아무것도 하지 않는다.
- **마감 분기**: 토핑이 하나라도 있으면 `close()` → `CLOSED`, 0건이면 `markEmpty()` → `EMPTY`.
  **`EMPTY`도 마감 상태다** — "비어 있음"이 아니라 "빈 채로 끝남"이다.
- **다음 캔버스**: 마감한 날 **+1일** 날짜로 새 `ACTIVE`를 만든다. 그 날짜 캔버스가 이미 있으면 생략한다.
- **불변식**: "마감 후 생성" 순서가 **그룹당 `ACTIVE` 최대 1개**를 지키는 유일한 근거다(DB 제약이 없다).
  `findActiveByGroupId`가 이 전제에 기대고 있고 서버 코드 주석이 순서 변경을 금지한다.
- **가드**: 미래 날짜 캔버스는 마감하지 않는다.

## 도메인 에러 코드 전수

`ParfaitErrorCode`(`core/parfait/exception`) 5종 전부. 2026-08-16 delta가 **2 → 5**로 늘렸다.

| HTTP | code | message | 귀속 |
|---|---|---|---|
| 400 | `INVALID_DATE_RANGE` | 조회 시작일이 종료일보다 늦을 수 없습니다 | 과거 목록 조회 |
| 404 | `PARFAIT_NOT_FOUND` | 존재하지 않는 파르페입니다 | 상세 조회 · 배경 변경 |
| 409 | `PARFAIT_ALREADY_CLOSED` | 이미 마감된 파르페입니다 | **공개 경로 없음** — 아래 |
| 400 | `INVALID_BACKGROUND` | 배경 정보가 올바르지 않습니다 | 배경 변경 |
| 409 | `BACKGROUND_IMAGE_NOT_CONFIRMED` | 업로드가 확인되지 않은 이미지입니다 | 배경 변경 |

  ⚠️ **`PARFAIT_ALREADY_CLOSED`에 도달하는 공개 엔드포인트가 없다.** `Parfait.close`·`markEmpty`가
  `status != ACTIVE`일 때 던지는데, 두 메서드를 부르는 곳은 회전 로직뿐이고 회전은 `ACTIVE`만 골라 온다.
  즉 이 코드는 **회전 배치가 동시 실행돼 경합할 때만** 나갈 수 있고, 그때도 응답이 아니라 `failedCount`로
  집계된다. 앱이 이 코드를 받을 경로는 현재 없다.

이 도메인은 자기 enum 밖의 코드도 던진다 — `ParfaitGroupApiErrorCode.GROUP_NOT_JOINED`(403),
그리고 배경 변경의 `ImageErrorCode.IMAGE_NOT_FOUND`(404). 소비 측은 이 도메인 enum만 보고 분기하면 안 된다.

## Android 매핑

**앱 표면이 다섯 전부를 덮는다**(2026-08-16, PR #266 develop 머지). 서버 delta가 벌린 상세 조회·배경
변경 둘이 **같은 날 표면을 얻어** 공백이 하루 만에 닫혔다 — 이 도메인은 테스트 전용 회전을 뺀 전량에
Service·DataSource 함수가 있다.

✅ **소비처가 생겼다**(2026-08-17, PR #268). `ParfaitRepository`/`ParfaitRepositoryImpl`(위임 +
`mapErrorToAppError`, `RepositoryModule` `@Binds` 1줄) → UseCase 둘 → **C-001 캔버스 메인**까지 이어졌다.
**다섯 중 셋만 열었다** — 오늘 조회·과거 목록·상세다. 연도 조회와 배경 변경은 소비자가 생길 때
인터페이스에 올린다(쓰지 않는 갈래를 미리 열면 어떤 실패를 어떻게 다룰지 정하지 않은 채 계약이 굳는다).
`android_status`는 **`partial` 그대로**다.

✅ **같은 날 넷이 됐다**(2026-08-17, PR #279). C-201 캘린더가 mock을 버리면서 **연도 조회**가 그
방침대로 소비자와 함께 올라왔다(`ParfaitRepository#getYears`). 남은 하나는 **배경 변경**이고,
`android_status`는 여전히 `partial`이다 — 표면·계약이 아니라 **소비처가 다섯 중 넷**이라는 뜻이다.

**계약의 두 성질이 소비 방식을 갈랐다.**
① `today`는 **부작용이 있어**(행 생성) 진입 시 `launch(key)`로 1회만 부른다 — 그럼에도 쓰는 이유는
토핑을 얹으려면 `parfaitId`가 있어야 하고, **부작용 없는 두 경로는 없는 날을 만들어 주지 않기** 때문이다.
② 달력에서 날짜를 고를 때는 반대로 **부작용 없는 경로**를 탄다 — 훑는 것만으로 빈 캔버스가 쌓이면
안 된다. "같은 캔버스를 두 경로로 얻는데 한쪽만 부작용이 있다"는 [미결](#미결)이 **앱에서 용도 분리로
굳었다.** 처음에는 하루 범위 목록→상세 2단(`GetCanvasByDateUseCase`)이었고, **#279부터는 달력이 그 해
목록을 이미 캐시로 들고 있어 거기서 `parfaitId`를 꺼내 상세만 부른다**(`GetParfaitDetailUseCase`).
날짜로 캔버스를 찾는 엔드포인트가 없다는 계약 사실은 그대로이고, 그 조회를 화면 캐시가 대신한다.
같은 이유로 **오늘로 되돌아갈 때도 조회를 안 한다** — 받아 둔 오늘 캔버스를 상태에서 갈아 끼운다
(다시 부르면 부작용 있는 `today`가 돈다).

⚠️ **계약이 말하지 않는 것을 앱이 정했다.** 배치 값의 단위·기준이 계약에 없어 렌더가 규칙을 만들었다 —
`positionX`·`positionY`는 **Canvas-Area 대비 0~1 정규화 중심점**, `scale` 1.0은 **긴 변이 그 너비의 40%**
(위키 C-106 초기 크기), `borderWidth` 1.0은 **화면 기준 1dp**(토핑 배율과 무관), `borderColor`는
`#RRGGBB` 6자리(알파 8자리도 읽는다). 서버가 같은 값을 다른 뜻으로 쓰거나 iOS가 달리 해석해도
**계약으로는 드러나지 않는다** → [open-questions](../synthesis/open-questions.md).

⚠️ **`today` 응답의 `date`를 앱이 검증한다.** 자정을 걸친 요청이 어제 캔버스를 받을 수 있어, 오늘을
**응답 뒤에** 읽어 비교하고 어긋나면 딱 한 번 다시 부른다. 그 "오늘"은 기기 시간대가 아니라
**KST**(`PARFAIT_TIME_ZONE`)다 — 캔버스 행이 KST 날짜를 키로 저장되기 때문이고, 기기 시간대로 세면
해외 기기에서 재시도가 하루 한 번이 아니라 **로드마다** 돈다.

⚠️ **과거 목록은 이제 연 단위로 부른다**(2026-08-17, PR #279) — 1월 1일 ~ 12월 31일을 한 번에 받아
화면이 연도별로 캐시한다. 근거는 계약이다 — **페이지네이션도 범위 상한도 없어**(→ [미결](#미결))
최대 366건이 한 응답으로 오고, 달력은 월을 오갈 때마다 다시 부를 이유가 없다.
**정렬은 앱이 한다** — 계약이 순서를 약속하지 않아 UseCase가 날짜 내림차순으로 세운다.
직전 구현(범위를 하루로 좁혀 부르고도 응답 날짜를 다시 보던 것 — 경계 처리가 서버 몫이라 하루가 더
딸려 오면 옆날을 고른 날로 착각한다)은 그 UseCase와 함께 사라졌다.

⚠️ **배경 변경은 이 도메인 첫 쓰기 경로**이고, 그래서 **첫 요청 DTO**(`ChangeParfaitBackgroundRequest`)와
**쓰기 전용 도메인 모델**(`CanvasBackgroundEdit`)이 함께 들어왔다. 읽기 모델 `CanvasBackground`를
재사용하지 않은 이유는 계약이 비대칭이기 때문이다 — 이미지 배경은 **쓸 때 `imageId`, 읽을 때 URL**이라
읽은 값을 그대로 되돌려 보낼 수 없다. 동시에 이 sealed가 **조건부 필수를 컴파일 시점으로 끌어올린다**
(평면 DTO를 도메인에 노출하면 잘못된 조합을 400 `INVALID_BACKGROUND`로만 알게 된다).

⚠️ **표면을 건너뛴 소비자가 생겼다**(2026-08-16, PR #259) — C-201 캘린더의
`GetParfaitHistoriesUseCase`·`GetParfaitYearsUseCase`가 KDoc으로 `GET .../parfaits?from=&to=`와
`GET .../parfaits/year`를 각각 가리키면서 **`ParfaitRemoteDataSource`를 호출하지 않고 UseCase 본문에서
mock을 만든다**. 즉 이 도메인은 "표면은 있는데 소비처가 없다"가 아니라 **소비처가 표면을 우회한
상태**다. 계약 대조 관점에서 두 가지가 미검증으로 남는다 — 응답 매핑(`ParfaitHistory`가 서버 응답의
어느 필드에 대응하는지 코드에 없다)과 `groupId` 전달(화면 `NavKeyCanvasImageAdd`가 `data object`라
그룹 식별자를 들고 있지 않아 UseCase 인자에서 아예 뺐다) → [c201 스펙](../specs/archive/2026-08-16-c201-canvas-calendar.md) ·
[open-questions](../synthesis/open-questions.md).
📌 **막고 있던 이유는 사라졌는데 상태는 그대로다**(2026-08-17, PR #268) — Repository가 생겼고
`NavKeyCanvasImageAdd`가 `groupId`를 들고 다니지만 **두 UseCase는 여전히 mock**이다. 이제 같은
ViewModel 안에서 **캔버스 조회는 계약을 타고 달력 조회는 안 탄다.**
✅ **해소(2026-08-17, PR #279)** — 두 UseCase가 `ParfaitRepository`를 주입받아 **표면 우회가 사라졌다.**
미검증으로 남았던 둘도 닫혔다: 응답 매핑은 `ParfaitHistory`를 **삭제**하고 계약 VO `PastCanvasVO`를
그대로 쓰는 것으로(그래서 "달력이 점을 찍는 기준"이 응답 필드 `imageCount` → VO `toppingCount`가
됐다), `groupId`는 NavKey 인자를 타고 두 UseCase 시그니처에 들어왔다
→ [c201-canvas-calendar-server 스펙](../specs/archive/2026-08-17-c201-canvas-calendar-server.md).

| 엔드포인트 | Service 함수 | DataSource 함수 |
|---|---|---|
| GET `/api/v1/groups/{groupId}/parfaits/year` | `ParfaitService#getGroupsByGroupIdParfaitsYear` | `ParfaitRemoteDataSource#getYears` |
| GET `.../parfaits/today` | `ParfaitService#getGroupsByGroupIdParfaitsToday` | `ParfaitRemoteDataSource#getTodayCanvas(groupId)` |
| GET `.../parfaits` | `ParfaitService#getGroupsByGroupIdParfaits` | `ParfaitRemoteDataSource#getPastCanvases(groupId, from, to)` |
| GET `.../parfaits/{parfaitId}` | `ParfaitService#getGroupsByGroupIdParfaitsByParfaitId` | `ParfaitRemoteDataSource#getCanvasDetail(groupId, parfaitId)` |
| PATCH `.../parfaits/{parfaitId}/background` | `ParfaitService#patchGroupsByGroupIdParfaitsByParfaitIdBackground` | `ParfaitRemoteDataSource#changeCanvasBackground(groupId, parfaitId, background)` |
| POST `/api/v1/test/parfait-canvas/rotate` | — (해당 없음) | — (해당 없음) |

**신규 둘의 앱 쪽 비용은 비대칭이었다.** 상세 조회는 응답이 `GetTodayParfaitResponse` 재사용이라
DTO·VO·매퍼를 그대로 썼다 — Service 함수 하나와 DataSource 함수 하나로 끝났다. 배경 변경은 요청·응답
DTO가 함께 새로 생겼다. **DI 등록 줄은 한 줄도 늘지 않았다**(Service·DataSource가 이미 바인딩돼 있고
함수만 늘었다 — PR #250에 이어 두 번째).

- **응답 DTO**: `ParfaitYearsResponse`(`years: List<Int>`) · `GetTodayParfaitResponse`(중첩
  `GroupMemberResponse`·`BackgroundResponse`·`TodayParfaitImageResponse`·`PlacedByResponse`) ·
  `PastParfaitsResponse`(중첩 `PastParfaitResponse`) · `ChangeParfaitBackgroundResponse`(중첩
  `BackgroundResponse`를 **조회 응답 파일의 것 그대로 재사용** — 서버도 같은 클래스를 쓴다) — 전부
  `data/service/model/response/parfait/`.
- **요청 DTO**: `ChangeParfaitBackgroundRequest`(`data/service/model/request/parfait/`) — **이 도메인 첫
  요청 DTO**다(그전엔 전부 GET). 서버의 거울이라 `type`·`value`·`imageId` 평면·널 허용 그대로 두고,
  잘못된 조합을 막는 일은 domain `CanvasBackgroundEdit`가 한다(DTO에 sealed를 넣지 않는 규약).
  ⚠️ **중첩 응답은 상위 응답 파일 안에 함께 둔다** — `:data`의 "선언당 파일 하나" 규약의 명시적 예외이고
  근거는 "서버가 한 파일에 담은 것을 앱도 한 파일에 담아야 계약 문서와 눈으로 대조된다"이다
  ([data-layer](../architecture/data-layer.md)). `PlacedByResponse`라는 이름이
  `response/parfait`·`response/parfaitimage` **두 패키지에 각각 존재**하는 것도 같은 이유다(서버가 그렇다).
- **domain VO**: `domain/model/canvas/`에 일곱(`CanvasVO`·`PastCanvasVO`·`CanvasStatus`·
  `CanvasBackground`·`CanvasBackgroundEdit`·`CanvasMemberVO`·`CanvasToppingVO`). 이름은 제품 언어라 서버
  `parfait`가 `Canvas`, 응답 필드 `imageCount`가 `toppingCount`다 — 다만 **id 타입은 서버 언어 유지**
  (`ParfaitId`). 연도 조회만 VO가 없다(응답이 `years` 한 필드라 `transform = { it.years }`).
  ⚠️ **`TodayCanvasVO`는 `CanvasVO`로 개명됐다**(2026-08-16, PR #266) — 상세 조회가 같은 응답 클래스를
  쓰면서 한 타입이 오늘과 특정 날짜 양쪽을 담게 됐기 때문이다. 그 대가로 **"이 조회가 캔버스 행을
  만든다"는 경고의 소유가 타입에서 함수로 옮겨졌다** — 오늘 조회만 만들고 상세 조회는 만들지 않으므로
  VO KDoc이 그 성질을 대표할 수 없다 → [open-questions](../synthesis/open-questions.md).
- **Mapper**: `source/parfait/mapper/VOMapper.kt`(이 도메인 첫 매퍼 — 연도 조회뿐이던 시절엔 없었다).
  계약의 "널이 세 가지를 뜻한다"를 여기서 가른다 — `images` `null`은 **빈 목록으로 접고**,
  `background`(미설정)·`lastClosedDate`(마감 이력 없음)의 `null`은 **그대로 둔다**.
  요청 방향 변환(`CanvasBackgroundEdit.toRequest()`)도 같은 파일에 있다 — **조건부 필수를 여기서 편다**
  (색이면 `value`만, 이미지면 `imageId`만 채워 서버가 값을 버릴 경로를 만들지 않는다).
- **배경 변경 반환은 `CanvasBackground?`다.** 응답 `background`는 비널인데 널 허용으로 받는 이유는
  **미지 `type`을 `null`로 접는 규칙을 조회와 통일**했기 때문이다(뜻은 "저장은 됐는데 그릴 수 없다").
  echo를 버리지 않는 이유는 **이미지 배경일 때 앱이 URL을 모르기 때문**이다 — 요청은 id로 보내고 응답에
  저장된 URL이 실려 오며, 그 값이 화면이 그릴 값이다.
- **미지 값 폴백 두 갈래**: `status`가 모르는 값이면 `CanvasStatus.UNKNOWN`(값 자체가 상태라 버릴 수 없다),
  `background.type`이 모르는 값이면 **`null`로 접는다**(미지와 미설정은 화면 처리가 같다).
  토핑 테두리도 `SOLID`인데 색·두께가 비면 `ToppingBorder.None`으로 떨어뜨린다 — 서버가 저장 시점에
  막지만 이미 저장된 행이 있을 수 있어서다.
- **범위 파라미터는 `null` 그대로 보낸다** — `from`·`to`가 `null`이면 Retrofit이 쿼리를 URL에서 빼므로
  서버 기본값(오늘 − 30일 ~ 오늘)이 산다. 문자열 변환(`LocalDate.toString()`)은 DataSource가 한다.

설계 근거는 [specs/archive/2026-08-15-parfait-canvas-topping-member-api-service-layer](../specs/archive/2026-08-15-parfait-canvas-topping-member-api-service-layer.md)와
신규 둘의 사후 스펙 [specs/archive/2026-08-16-canvas-detail-background-api-service-layer](../specs/archive/2026-08-16-canvas-detail-background-api-service-layer.md).
DataSource 테스트는 25 케이스이고, 배경 변경 요청 바디의 **조건부 필수 두 갈래를 `coVerify` 인자 비교로**
잠근다(매퍼 단독 테스트를 만들지 않는 규약 그대로).

**`today` 조회가 C-001 캔버스 결선의 선행이었다.** "배치 목록 조회 API가 없어 캔버스를 다시 그릴 수 없다"던
자리가 이 엔드포인트로 닫혔고([parfait-image.md](parfait-image.md) 참고) **2026-08-17 화면까지 이어졌다.**
⚠️ **부작용 있는 GET을 억제하는 코드 수단은 여전히 없다** — 경고가 Service·DataSource·Repository KDoc에만
있고, 실제 억제는 화면의 `launch(key = LOAD_TODAY_CANVAS_KEY)` **하나**에 걸려 있다(다른 소비자가 생기면
같은 규율을 스스로 지켜야 한다) → [open-questions](../synthesis/open-questions.md).

⚠️ **읽기만 붙었다.** 토핑 배치(POST)·좌표 수정 경로는 소비처가 여전히 0건이라, 화면은 **서버가 가진
배치를 그리기만 하고 새로 얹지 못한다**([parfait-image.md](parfait-image.md)).

## 미결

- **경로 세그먼트 `year`(단수) vs 응답 필드 `years`(복수) 불일치.** 서버 코드로는 의도된 설계인지 실수인지
  확인할 수 없다 — 근거 자료(PR 설명·이슈) 조사는 이번 범위 밖. → [open-questions](../synthesis/open-questions.md)
- `GET .../today`가 조회인데 캔버스 행을 만든다(부작용 있는 GET), 그리고 오늘 날짜가 이미 마감돼 있으면
  마감된 캔버스를 "오늘"로 돌려준다 → [open-questions](../synthesis/open-questions.md)
- 과거 목록의 `thumbnailUrl`이 항상 `null`이고 페이지네이션·범위 상한이 없다
  → [open-questions](../synthesis/open-questions.md)
- 테스트 전용 회전 엔드포인트가 인증 없이 전 그룹 캔버스를 마감한다(프로덕션 제거 TODO)
  → [open-questions](../synthesis/open-questions.md)
- `images[].placedBy`가 탈퇴 멤버를 걸러내지 않아 `groupMembers`에 없는 `groupMemberId`와 `(알수없음)`
  닉네임이 섞인다 → [open-questions](../synthesis/open-questions.md)
- 배경 변경이 캔버스 마감 상태를 보지 않아 `CLOSED`·`EMPTY` 캔버스의 배경도 바뀐다
  → [open-questions](../synthesis/open-questions.md)
- 배경 이미지가 `reference_count`를 올리지 않아 같은 이미지의 토핑을 지우면 배경이 깨질 수 있다
  → [open-questions](../synthesis/open-questions.md)
- 배경 이미지를 요청은 `imageId`로 받고 응답·조회는 URL로만 내려줘 앱이 현재 배경의 이미지 id를 되짚을
  수단이 없다 → [open-questions](../synthesis/open-questions.md)
- 상세 조회가 상태를 거르지 않아 "이전 파르페 상세"라는 이름과 달리 오늘의 `ACTIVE` 캔버스도 조회된다.
  같은 캔버스를 `today`와 상세 두 경로로 얻을 수 있고 **한쪽만 부작용이 있다**
  → [open-questions](../synthesis/open-questions.md)
