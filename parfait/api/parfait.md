---
id: parfait
title: 파르페(캔버스) 조회·회전
server_module: http/parfait
server_commit: 36ecd1c
verified: 2026-08-15
android_status: partial
related_spec:
related_adr: ADR-0017
tags: [api, parfait, server-contract, canvas]
---

# 파르페(캔버스) 조회·회전 API 계약

> 정본은 서버 코드(`mash-up-kr/TEAMYG-SERVER` `main`). 이 문서는 미러다 — 어긋나면 서버가 옳다.
> 전역 계약(envelope·에러 체계·인증)은 [conventions.md](conventions.md).

`feat: 오늘의 파르페(캔버스) 조회 API 구현`(PR #92)·`feat: 과거 파르페(캔버스) 목록 조회 API 구현`(PR #94)·
`[Feat/#85] 캔버스 상태 자동 전환 배치(새벽 3시) 구현 (#97)`으로 **1 → 3 엔드포인트 + 테스트 전용 1**이 됐다.
같은 라운드에 `parfait` 테이블이 `status`·`background_type`·`background_value` 세 컬럼을 얻었다
(`V11__add_status_and_background_to_parfait.sql`).

## 엔드포인트

| 메서드 | 경로 | 인증 | 요청 | 응답 | Android |
|---|---|---|---|---|---|
| GET | `/api/v1/groups/{groupId}/parfaits/year` | 필요 | path `groupId` Long | `ParfaitYearsResponse` | 구현됨 |
| GET | `/api/v1/groups/{groupId}/parfaits/today` | 필요 | path `groupId` Long | `GetTodayParfaitResponse` | 미구현 |
| GET | `/api/v1/groups/{groupId}/parfaits` | 필요 | query `from`·`to`(선택) | `PastParfaitsResponse` | 미구현 |
| POST | `/api/v1/test/parfait-canvas/rotate` | **불필요(화이트리스트)** | 없음 | `RotateParfaitCanvasesResponse` | 해당 없음[^test] |

[^test]: **테스트 전용 엔드포인트다.** 서버 컨트롤러(`ParfaitCanvasRotationTestController`)와
`SecurityConfig.WHITELIST_PATHS` 양쪽에 "프로덕션 오픈 전 함께 제거할 것"이라는 TODO가 달려 있다.
앱이 붙일 대상이 아니다 → [미결](#미결).

경로 주의: 그룹을 `groups`로 부르는 유일한 경로다(다른 그룹 API는 `parfait-groups`) —
[conventions.md](conventions.md)의 URL 규약 절 참고.

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

  **배경을 설정하는 API는 아직 없다.** 컬럼(`background_type`·`background_value`)과 응답 필드만 있고
  쓰기 경로가 서버 어디에도 없어 현재는 항상 `null`이다.

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

`ParfaitErrorCode`(`core/parfait/exception`) 2종 전부. 이 라운드에 신설됐다(이전 판본은 "전용 enum 없음"이었다).

| HTTP | code | message | 귀속 |
|---|---|---|---|
| 400 | `INVALID_DATE_RANGE` | 조회 시작일이 종료일보다 늦을 수 없습니다 | 과거 목록 조회 |
| 409 | `PARFAIT_ALREADY_CLOSED` | 이미 마감된 파르페입니다 | **공개 경로 없음** — 아래 |

  ⚠️ **`PARFAIT_ALREADY_CLOSED`에 도달하는 공개 엔드포인트가 없다.** `Parfait.close`·`markEmpty`가
  `status != ACTIVE`일 때 던지는데, 두 메서드를 부르는 곳은 회전 로직뿐이고 회전은 `ACTIVE`만 골라 온다.
  즉 이 코드는 **회전 배치가 동시 실행돼 경합할 때만** 나갈 수 있고, 그때도 응답이 아니라 `failedCount`로
  집계된다. 앱이 이 코드를 받을 경로는 현재 없다.

이 도메인은 자기 enum 밖의 코드도 던진다 — `ParfaitGroupApiErrorCode.GROUP_NOT_JOINED`(403).
소비 측은 이 도메인 enum만 보고 분기하면 안 된다.

## Android 매핑

**연도 조회 1건만 표면이 있고, 이번 delta로 들어온 3건은 표면 0건이다**(TJYG-Android `develop` 기준 —
`ParfaitService`에 `@GET("api/v1/groups/{groupId}/parfaits/year")` 하나뿐).

| 엔드포인트 | Service 함수 | DataSource 함수 |
|---|---|---|
| GET `/api/v1/groups/{groupId}/parfaits/year` | `ParfaitService#getGroupsByGroupIdParfaitsYear` | `ParfaitRemoteDataSource#getYears` |
| GET `.../parfaits/today` | — (미구현) | — (미구현) |
| GET `.../parfaits` | — (미구현) | — (미구현) |
| POST `/api/v1/test/parfait-canvas/rotate` | — (해당 없음) | — (해당 없음) |

- **응답 DTO**: `ParfaitYearsResponse`(`years: List<Int>`) —
  `data/service/model/response/parfait/ParfaitYearsResponse.kt`. 요청 DTO 없음(path 변수만 받는 GET).
  이 저장소는 DTO·도메인 모델을 선언당 파일 하나로 두는 규약이라 파일명이 선언명과 그대로 같다 —
  다른 이름이 붙을 이유가 없는 평범한 경우다.
- **VO 없음** — 응답이 `years` 한 필드뿐이라 mapper가 `List<Int>`를 그대로 반환한다
  (`ParfaitRemoteDataSourceImpl#getYears`의 `transform = { it.years }`). `GroupId` value class는
  `domain/model/id/GroupId.kt`에 있다.
- **Mapper 파일 없음** — 변환이 필드 하나짜리라 별도 mapper 함수를 두지 않는다.

**`today` 조회가 C-001 캔버스 결선의 선행이다.** 지금까지 "배치 목록 조회 API가 없어 캔버스를 다시 그릴 수
없다"고 적혀 있던 자리가 이 엔드포인트로 닫힌다([parfait-image.md](parfait-image.md) 참고) — 다만 앱 표면이
아직 없어 **미구현**이다. `http/parfait.http`도 연도 조회만 덮는다 → [open-questions](../synthesis/open-questions.md).

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
