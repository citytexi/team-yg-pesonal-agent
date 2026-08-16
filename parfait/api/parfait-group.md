---
id: parfait-group
title: 파르페 그룹
server_module: http/parfaitgroup
server_commit: 22717fe
verified: 2026-08-16
android_status: partial
related_spec:
related_adr: ADR-0017
tags: [api, parfait, server-contract, group]
---

# 파르페 그룹 API 계약

> 정본은 서버 코드(`mash-up-kr/TEAMYG-SERVER` `main`). 이 문서는 미러다 — 어긋나면 서버가 옳다.
> 전역 계약(envelope·에러 체계·인증)은 [conventions.md](conventions.md).

base path `/api/parfait-groups`(버전 프리픽스 없음 — [conventions.md](conventions.md)의 URL 규약 관측 참고).
**8개 엔드포인트 전부 인증 필요.** 미인증 401 `UNAUTHORIZED`는 전역 공통이라 아래 표·상세에서 반복하지 않는다.

## 엔드포인트

| 메서드 | 경로 | 인증 | 요청 | 응답 | Android |
|---|---|---|---|---|---|
| GET | `/api/parfait-groups` | 필요 | 없음 | `List<MyParfaitGroupResponse>` | ⚠️불일치[^uploadedat] |
| GET | `/api/parfait-groups/{groupId}` | 필요 | path `groupId` Long | `MyParfaitGroupDetailResponse` | 구현됨 |
| GET | `/api/parfait-groups/join-preview` | 필요 | query `inviteCode` String | `PreviewParfaitGroupJoinResponse` | 구현됨 |
| POST | `/api/parfait-groups/join` | 필요 | `JoinParfaitGroupRequest` | `JoinParfaitGroupResponse` | 구현됨 |
| POST | `/api/parfait-groups` | 필요 | `CreateParfaitGroupRequest` | `CreateParfaitGroupResponse` | 구현됨 |
| PATCH | `/api/parfait-groups/{groupId}/nickname` | 필요 | `ChangeMyParfaitGroupNicknameRequest` | `ChangeMyParfaitGroupNicknameResponse` | 구현됨 |
| DELETE | `/api/parfait-groups/{groupId}/members/me` | 필요 | path `groupId` Long | `LeaveParfaitGroupResponse` | 구현됨 |
| POST | `/api/parfait-groups/{groupId}/reports` | 필요 | `ReportParfaitGroupRequest` | `ReportParfaitGroupResponse` | 구현됨 |

[^uploadedat]: **2026-08-15** — Service·DataSource·DTO는 계약과 맞지만 매퍼가 `recentImageUploadedAt`을
    `kotlin.time.Instant::parse`(오프셋 필수)로 읽는다. 이 응답의 값은 오프셋 없는 로컬 날짜시간이라
    최근 이미지가 있는 그룹이 있으면 목록 조회가 통째로 실패한다 →
    [conventions.md](conventions.md) "Android 불일치" · [open-questions](../synthesis/open-questions.md) [2026-08-15].

요청 DTO(`ParfaitGroupRequest.kt`)에는 Bean Validation 애노테이션이 없다 — auth 도메인과 달리 `@NotBlank`/`@Valid`가
없다. 필드는 Kotlin non-null 타입이라 요청 바디에 없거나 `null`이면 Jackson이 파싱 단계에서 거부한다(결과적으로
`CommonErrorCode.INVALID_REQUEST` 400). 실제 값 검증(길이·패턴·범위)은 컨트롤러 도달 후 도메인 값 객체
(`GroupName`·`GroupNickname`·`GroupMemberLimit`)가 담당하며, 위반 시 `ParfaitGroupApiErrorCode`로 나간다(아래
엔드포인트별 에러 코드 참고).

## 엔드포인트 상세

### GET /api/parfait-groups

- **인증**: 필요
- **성공**: HTTP 200 · envelope `code` = `"OK"`(`ApiResponse.Companion.ok`)
- **요청 필드**: 없음
- **응답 필드**

| 필드 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `groupId` | Long | 아니오 | |
| `groupName` | String | 아니오 | |
| `recentImageUrl` | String? | 예 | 최근 업로드 이미지 없으면 `null` |
| `recentImageUploadedAt` | LocalDateTime? | 예 | 아래 직렬화 포맷 참고. `recentImageUrl`과 함께 `null` 가능 |

  응답은 `List<MyParfaitGroupResponse>`. nullable 필드도 값이 없다고 생략되지 않고 `null`로 내려온다
  (`jackson.default-property-inclusion: always`, `bootstrap/application.yaml`) — `ParfaitGroupControllerTest`의
  "최근 이미지가 없는 그룹도 nullable 필드를 생략하지 않고 null로 응답한다" 테스트로 확인.

  **`recentImageUploadedAt`의 출처**: 애플리케이션 코드가 만든 값이 아니라, `persistence`
  모듈의 `ParfaitGroupMemberRepository.findMyGroupSummaries`(네이티브 쿼리, `MyParfaitGroupSummaryProjection`)가
  `parfait_image` 테이블의 `created_at` 컬럼을 그대로 프로젝션한 값이다.

  **직렬화 포맷(확인됨, 단 아래 한계 참고)**: `ParfaitGroupControllerTest`가
  `LocalDateTime.of(2026, 8, 1, 12, 0)` → 응답 문자열 `"2026-08-01T12:00:00"`을 `jsonPath`로 직접 검증한다.
  ISO-8601 로컬 날짜시간(`yyyy-MM-ddTHH:mm:ss`, 타임존 오프셋 없음) — 별도 `@JsonFormat`이나 커스텀
  `ObjectMapper` 빈이 없어 Jackson 3(`tools.jackson.module:jackson-module-kotlin`, Spring Boot 4.0.6) 기본
  직렬화로 보인다. **한계**: 이 포맷은 Jackson 설정을 직접 읽어 확정한 게 아니라 컨트롤러 테스트의 기대값에서
  역추론한 것이다 — 실제 직렬화기 동작 자체를 확인한 근거는 아니다.

  **타임존**: JSON에 오프셋은 실리지 않지만, `created_at` 컬럼 값은 MySQL 서버가 세션 타임존으로 저장·반환한
  값이고, 커넥션 문자열(`bootstrap/application-{dev,local,prod}.yaml`의 `spring.datasource.url`)이
  `serverTimezone=Asia/Seoul`을 세 환경 전부에서 지정한다. `hibernate.jdbc.time_zone: Asia/Seoul`
  (`bootstrap/application.yaml`)도 JDBC 드라이버가 `LocalDateTime`을 이 타임존으로 주고받도록 맞춘다.
  즉 `created_at`은 Asia/Seoul 벽시계 기준 값이라는 뜻이다. Android가 이 문자열을 UTC로 오인하면 시각이
  어긋난다.

- **에러 코드**: 없음(도메인 고유 에러 없음)

### GET /api/parfait-groups/{groupId}

- **인증**: 필요
- **성공**: HTTP 200 · envelope `code` = `"OK"`
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `groupId` | Long | 필수(path) | |

- **응답 필드**

| 필드 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `groupId` | Long | 아니오 | |
| `groupNickname` | String | 아니오 | 인증 회원 본인의 그룹 닉네임 |
| `inviteCode` | String | 아니오 | |
| `members` | List<`ParfaitGroupMemberResponse`> | 아니오 | 원소: `memberId` Long · `groupNickname` String |

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 404 | `GROUP_NOT_FOUND` | 존재하지 않는 그룹입니다 |
| 403 | `GROUP_NOT_JOINED` | 참여하지 않은 그룹입니다 |

  근거: `ParfaitGroupService.get`이 `findGroupById`(→ `GROUP_NOT_FOUND`)·`findMembership`(→ `GROUP_NOT_JOINED`)을
  순서대로 호출한다.

### GET /api/parfait-groups/join-preview

- **인증**: 필요
- **성공**: HTTP 200 · envelope `code` = `"OK"`
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `inviteCode` | String | 필수(query, `@RequestParam` 기본값이 required) | 6자 영숫자(ASCII). 아래 초대코드 형식 참고 |

- **응답 필드**

| 필드 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `groupName` | String | 아니오 | |

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 404 | `INVALID_INVITE_CODE` | 유효하지 않은 초대코드입니다 |
| 409 | `GROUP_ALREADY_JOINED` | 이미 참여한 그룹입니다 |
| 409 | `GROUP_MEMBER_LIMIT_REACHED` | 그룹의 최대 인원이 모두 참여했습니다 |
| 404 | `MEMBER_NOT_FOUND` | 존재하지 않는 회원입니다 |
| 400 | `INVALID_GROUP_NICKNAME` | 그룹 닉네임이 올바르지 않습니다(아래 참고) |

  근거: `ParfaitGroupService.preview`가 `findGroup`(→ `INVALID_INVITE_CODE`) 후 `validateJoin`을 호출한다.
  `validateJoin`은 `ParfaitGroup.validateJoin`(→ `GROUP_ALREADY_JOINED`·`GROUP_MEMBER_LIMIT_REACHED`)과
  `requireMemberNickname`(→ `MEMBER_NOT_FOUND`), `GroupNickname.of`(→ `INVALID_GROUP_NICKNAME`)를
  순서대로 실행한다 — `join`과 완전히 같은 private 함수를
  공유한다. `INVALID_INVITE_CODE`·`GROUP_ALREADY_JOINED`·`GROUP_MEMBER_LIMIT_REACHED`는
  `ParfaitGroupServiceTest`가 preview 경로로 직접 검증(`ParfaitGroupControllerTest`도 `GROUP_MEMBER_LIMIT_REACHED`
  409 응답을 확인). `MEMBER_NOT_FOUND`·`INVALID_GROUP_NICKNAME`은 preview 전용 테스트는 없지만 `validateJoin`
  공유 코드 경로로 확인했다.

  `INVALID_GROUP_NICKNAME`은 요청 바디가 아니라 **회원의 전역 닉네임**에 `GroupNickname.of`를 적용한 결과다
  (`requireMemberNickname`이 반환한 값을 그대로 검증) — 아래 [미결](#미결) 참고.

  🔁 **2026-08-15 — 그룹 내 닉네임 중복 검사가 사라졌다**(`fix: 그룹 내 닉네임 중복 검사 제거`).
  참여·닉네임 변경 양쪽에서 `existsByGroupIdAndNickname` 호출과 그 결과로 던지던
  `GROUP_NICKNAME_ALREADY_USED`가 제거됐고(포트·어댑터·리포지토리 메서드·에러 코드까지 함께 삭제),
  **같은 그룹 안에서 닉네임이 겹쳐도 허용**된다. 서버 설명은 "정책상 허용해야 한다"이나 대응 정책 문서는
  아직 없다 → [미결](#미결).

### POST /api/parfait-groups/join

- **인증**: 필요
- **성공**: HTTP 200 · envelope `code` = `"OK"`
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `inviteCode` | String | 필수(non-null 타입) | 6자 영숫자(ASCII). 아래 초대코드 형식 참고 |

- **응답 필드**

| 필드 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `groupId` | Long | 아니오 | |
| `groupName` | String | 아니오 | |

- **에러 코드**: join-preview와 동일 5종(`INVALID_INVITE_CODE`·`GROUP_ALREADY_JOINED`·
  `GROUP_MEMBER_LIMIT_REACHED`·`MEMBER_NOT_FOUND`·`INVALID_GROUP_NICKNAME`) —
  `ParfaitGroupService.join`이 같은 `findGroup`·`validateJoin`을 호출한 뒤 멤버십을 저장한다. 코드 표는 위
  join-preview 절 참고(중복 서술 생략). 2026-08-15 이전에 있던 `GROUP_NICKNAME_ALREADY_USED`는
  중복 검사와 함께 삭제됐다(위 join-preview 절 참고).

#### 초대코드 형식

`InviteCode`(`core/parfaitgroup/domain/InviteCode.kt`) 값 객체가 판정한다.

- **길이 6**(`InviteCode.LENGTH`, 2026-08-15에 8에서 줄었다 — `refactor: 그룹 참여 코드 자릿수 8자에서 6자로 변경`,
  DB 컬럼도 마이그레이션 V13으로 같이 줄었다).
- 문자는 **ASCII 영숫자만**(`isLetterOrDigit` + `code > 127` 배제) — 한글·특수문자·공백 불가.
- 입력은 **대문자로 정규화**해 조회한다(`InviteCode.of`가 `uppercase()`) → 소문자 입력도 통한다.
- 위반은 값 객체 단계에서 404 `INVALID_INVITE_CODE`다(형식 오류와 "없는 코드"가 **같은 코드로 나간다**).
- 서버 생성 코드는 `InviteCodeGenerator`가 `SecureRandom`으로 뽑고 **알파벳에서 `I`·`O`·`0`·`1`을 뺐다**
  (혼동 방지). 즉 서버가 만드는 코드에는 그 넷이 없지만 **검증은 그것들도 받는다**.

### POST /api/parfait-groups

- **인증**: 필요
- **성공**: HTTP **201** · envelope `code` = `"CREATED"`(`@ResponseStatus(HttpStatus.CREATED)` +
  `ApiResponse.Companion.created`)
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `groupName` | String | 필수(non-null 타입) | 1~10자, 아래 정책 대조 참고 |
| `groupNickname` | String | 필수(non-null 타입) | 1~15자, 아래 정책 대조 참고 |
| `memberLimit` | Int | 필수(non-null 타입) | 1~12 |

- **응답 필드**

| 필드 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `groupId` | Long | 아니오 | |
| `groupName` | String | 아니오 | |
| `inviteCode` | String | 아니오 | 서버가 자동 생성 |
| `memberLimit` | Int | 아니오 | |

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_GROUP_NAME` | 그룹명이 올바르지 않습니다 |
| 400 | `INVALID_GROUP_NICKNAME` | 그룹 닉네임이 올바르지 않습니다 |
| 400 | `INVALID_GROUP_MEMBER_LIMIT` | 그룹 최대 인원은 1명 이상 12명 이하여야 합니다 |
| 404 | `MEMBER_NOT_FOUND` | 존재하지 않는 회원입니다 |

  근거: `ParfaitGroupService.create`가 `GroupNickname.of(groupNickname)`(→ `INVALID_GROUP_NICKNAME`,
  요청 필드 검증) → `requireMember`(→ `MEMBER_NOT_FOUND`) → `ParfaitGroup.create` 내부의
  `GroupName.of(name)`(→ `INVALID_GROUP_NAME`)·`GroupMemberLimit.of(memberLimit)`(→
  `INVALID_GROUP_MEMBER_LIMIT`)를 순서대로 실행한다. 이 4종은 `ParfaitGroupServiceTest`의 성공 케이스로만
  간접 확인되고 실패(에러) 케이스 전용 테스트는 없다 — 코드 직독으로 확정, 테스트 근거는 없음.

### PATCH /api/parfait-groups/{groupId}/nickname

- **인증**: 필요
- **성공**: HTTP 200 · envelope `code` = `"OK"`
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `groupId` | Long | 필수(path) | |
| `groupNickname` | String | 필수(non-null 타입) | 1~15자, 아래 정책 대조 참고 |

- **응답 필드**

| 필드 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `groupId` | Long | 아니오 | |
| `groupNickname` | String | 아니오 | 변경된 닉네임(요청과 동일하면 저장 생략, 응답은 항상 최종 값) |

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 404 | `GROUP_NOT_FOUND` | 존재하지 않는 그룹입니다 |
| 403 | `GROUP_NOT_JOINED` | 참여하지 않은 그룹입니다 |
| 400 | `INVALID_GROUP_NICKNAME` | 그룹 닉네임이 올바르지 않습니다 |

  근거: `ParfaitGroupService.change`가 `findGroupByIdForUpdate`(→ `GROUP_NOT_FOUND`) → `findMembership`(→
  `GROUP_NOT_JOINED`) → `membership.changeNickname`(내부 `GroupNickname.of`, → `INVALID_GROUP_NICKNAME`)
  순서로 실행하고, 값이 바뀐 경우에만 저장한다.

  🔁 **2026-08-15 — `GROUP_NICKNAME_ALREADY_USED`(409)가 사라졌다.** 같은 그룹의 다른 멤버와 같은 닉네임으로
  바꿔도 성공한다(위 join-preview 절 참고). 앱 분기·상수·문구는 PR #250에서 걷혔다 →
  [Android 매핑](#android-매핑).

### DELETE /api/parfait-groups/{groupId}/members/me

- **인증**: 필요
- **성공**: HTTP 200 · envelope `code` = `"OK"`
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `groupId` | Long | 필수(path) | |

- **응답 필드**

| 필드 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `groupId` | Long | 아니오 | |

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 404 | `GROUP_NOT_FOUND` | 존재하지 않는 그룹입니다 |
| 403 | `GROUP_NOT_JOINED` | 참여하지 않은 그룹입니다 |

  근거: `ParfaitGroupService.leave`가 `findGroupByIdForUpdate`(→ `GROUP_NOT_FOUND`) →
  `findMembership`(→ `GROUP_NOT_JOINED`) → `ParfaitGroupMemberLeavePort.leave` 순서로 실행한다. 탈퇴 시
  `groupNickname`은 `GroupNickname.unknown()`("(알수없음)")으로 대체되고 `leftAt`이 기록된다(`ParfaitGroupMember.leave`).

  **2026-08-15 — 같은 전이를 부르는 두 번째 경로가 생겼다.** 회원 탈퇴(`DELETE /api/v1/users/me`,
  [member.md](member.md))가 그 회원의 **모든 그룹 멤버십에 같은 `leave()`를 적용**한다. 즉 이 그룹 API를
  거치지 않고도 멤버가 목록에서 사라질 수 있다.

### POST /api/parfait-groups/{groupId}/reports

- **인증**: 필요
- **성공**: HTTP **201** · envelope `code` = `"CREATED"`(`@ResponseStatus(HttpStatus.CREATED)` +
  `ApiResponse.Companion.created`)
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `groupId` | Long | 필수(path) | |
| `reason` | String | 필수(non-null 타입) | 공백만 있는 값은 `INVALID_GROUP_REPORT_REASON`(`reason.isBlank()`) |

- **응답 필드**

| 필드 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `groupId` | Long | 아니오 | |
| `reportId` | Long | 아니오 | |

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_GROUP_REPORT_REASON` | 신고 사유를 입력해 주세요 |
| 404 | `GROUP_NOT_FOUND` | 존재하지 않는 그룹입니다 |
| 403 | `GROUP_NOT_JOINED` | 참여하지 않은 그룹입니다 |

  흐름 메모: `ParfaitGroupService.report`는 `ParfaitGroupReport.create`(reason 검증, → `INVALID_GROUP_REPORT_REASON`,
  다른 검사보다 먼저 실행) → `findGroupByIdForUpdate`(→ `GROUP_NOT_FOUND`) → `findMembership`(→
  `GROUP_NOT_JOINED`) → 신고 저장 → **같은 트랜잭션에서 신고자 멤버십을 탈퇴 처리**한다(`leave()`). 즉 신고
  성공은 항상 탈퇴를 동반한다. 근거: `ParfaitGroupServiceTest`("그룹 신고는 신고를 저장한 뒤 같은 트랜잭션에서
  탈퇴 이력을 남긴다"·"비어 있는 신고 사유는 신고나 탈퇴 없이 거부한다").

## 도메인 에러 코드 전수 — `ParfaitGroupApiErrorCode`(10종)

`ParfaitGroupApiErrorCode`는 core `ParfaitGroupError`와 이름이 1:1이다(`from(error) = valueOf(error.name)`,
[conventions.md](conventions.md)). 8개 엔드포인트 서비스 코드(`ParfaitGroupService`)와 도메인 값 객체
(`ParfaitGroup`·`ParfaitGroupMember`·`ParfaitGroupReport`·`GroupName`·`GroupNickname`·`GroupMemberLimit`)를 직독해
10종 전부의 귀속처를 확인했다 — "귀속 미대조"로 남길 항목은 없다.
**2026-08-15에 `GROUP_NICKNAME_ALREADY_USED`가 두 enum에서 함께 삭제돼 11 → 10이 됐다.**

| code | HTTP | 의미 | 귀속 |
|---|---|---|---|
| `INVALID_INVITE_CODE` | 404 | 유효하지 않은 초대코드입니다 | join-preview · join(형식 위반·없는 코드 공용) |
| `GROUP_ALREADY_JOINED` | 409 | 이미 참여한 그룹입니다 | join-preview · join |
| `GROUP_MEMBER_LIMIT_REACHED` | 409 | 그룹의 최대 인원이 모두 참여했습니다 | join-preview · join |
| `INVALID_GROUP_NAME` | 400 | 그룹명이 올바르지 않습니다 | 생성 |
| `INVALID_GROUP_NICKNAME` | 400 | 그룹 닉네임이 올바르지 않습니다 | 생성 · 닉네임 변경 · join-preview · join(전역 닉네임 경유, 근거는 각 절 참고) |
| `INVALID_GROUP_MEMBER_LIMIT` | 400 | 그룹 최대 인원은 1명 이상 12명 이하여야 합니다 | 생성 |
| `MEMBER_NOT_FOUND` | 404 | 존재하지 않는 회원입니다 | 생성(`requireMember`) · join-preview · join(`requireMemberNickname`) |
| `GROUP_NOT_FOUND` | 404 | 존재하지 않는 그룹입니다 | 상세 · 닉네임 변경 · 탈퇴 · 신고 |
| `GROUP_NOT_JOINED` | 403 | 참여하지 않은 그룹입니다 | 상세 · 닉네임 변경 · 탈퇴 · 신고 |
| `INVALID_GROUP_REPORT_REASON` | 400 | 신고 사유를 입력해 주세요 | 신고 |

⚠️ **`MEMBER_NOT_FOUND`는 코드 문자열이 유일하지 않다.** `AuthErrorCode`에도 같은 문자열이 존재하지만
값은 **401**로 다르다([auth.md](auth.md) "도메인 에러 코드 전수", [conventions.md](conventions.md)
"코드 문자열은 enum 간 유일하지 않다" 참고) — 소비 측은 이 문서의 **404**와 혼동하지 않도록 HTTP status를
함께 봐야 한다.

## 정책 대조 메모

- **`memberLimit` 1~12**(`GroupMemberLimit.MIN`·`MAX`, `core/parfaitgroup/domain/GroupMemberLimit.kt`)는
  위키 정책 "최대 12명"과 일치하고, Android `GroupCreateConfig` 상한과도 같다.
- **`groupName` 1~10자**(`GroupName.MAX_LENGTH`, `GroupName.kt`)는 위키 정책 "그룹명 1~10자"와 일치한다.
- **`groupNickname` 1~15자**(`GroupNickname.MAX_LENGTH`, `GroupNickname.kt`)는 위키 정책 "닉네임 1~15자"와
  일치한다.
- 두 값 객체가 공유하는 문자 규칙: 정규식 `^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]+(?: [가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]+)*$` —
  완성형 한글·**자모 단독**·영문·숫자를 허용하고 단어 사이 단일 스페이스만 허용한다(선행·후행 공백, 연속 공백,
  그 외 특수문자 불가). 🔁 **2026-08-15에 자모 범위가 추가됐다**(`fix: 그룹/전역 닉네임 자음 모음 단독 입력 허용`,
  사유는 iOS 클라이언트가 통과시키는 `ㅋㅋ`류가 서버에서만 400이 되던 것). 위키 [[이름-입력-규칙]]은 "한글"의
  범위를 정하지 않아 여전히 대조 근거가 없다 → [미결](#미결).
- **초대코드 자릿수 6**은 위키에 대응 정책 문서가 없다(앱 A-004도 코드로만 6을 확정했다) → [미결](#미결).
- **그룹 내 닉네임 중복 허용**(2026-08-15 서버 변경)도 위키 정책에 근거 항목이 없다 → [미결](#미결).
- `INVALID_GROUP_MEMBER_LIMIT`의 메시지("1명 이상 12명 이하")가 곧 규칙 본문이라 http 계층 어디에도 별도
  문서화가 없어도 서버 코드만으로 확정된다 — 브리프가 우려한 "규칙 본문이 http 계층에 없다"는 core 값
  객체(`GroupName`·`GroupNickname`·`GroupMemberLimit`)에서 전부 찾았다.

## Android 매핑

`:data`·`:domain`에 API 표면이 구현됐다([spec](../specs/archive/2026-08-03-data-api-service-layer.md)) —
**2026-08-06 PR #197로 develop 머지 완료**다. 이 표면이 딛고 선 공용 인프라(`ApiCaller` 4진입점·
`ApiResponse` envelope·`@NoAuth`·`TokenStoreTokenProvider`)는 PR #190으로 먼저 들어왔고, 아래
Service·DataSource·DTO·VO가 이번에 그 위에 올라갔다.
**2026-08-15 — Repository 경계가 먼저 들어왔다**(PR #241 `80895eb1`). `ParfaitGroupRepository`/
`ParfaitGroupRepositoryImpl`이 DataSource 8개 중 **5개**를 도메인에 올린다 —
`getMyGroups`·`previewJoin`·`joinGroup`·`createGroup`·`changeMyNickname`. 그룹 상세·탈퇴·신고는
**화면이 요구할 때까지 인터페이스에 올리지 않는다.** 화면 브랜치 셋(#233·#239·#240)이 각자 같은
4파일을 만들고 있어 충돌을 먼저 막은 것이고, `ServerErrorCode.ParfaitGroup` 8종도 같은 커밋이다.

**✅ 2026-08-15 — 다섯 함수 전부 화면까지 결선됐다**(PR #243·#244·#248). 선반영이던 Repository 경계가
같은 날 UseCase·ViewModel을 얻었다.

| Repository 함수 | 반환 | 대응 엔드포인트 | UseCase → 화면 |
|---|---|---|---|
| `getMyGroups()` | `Result<List<MyParfaitGroupVO>>` | GET `/api/parfait-groups` | `GetMyGroupsUseCase` → G-001(진입·당김 재조회) |
| `previewJoin(inviteCode)` | `Result<GroupName>` | GET `/api/parfait-groups/join-preview` | `GetGroupJoinPreviewUseCase` → A-004(확인 모달 전) |
| `joinGroup(inviteCode)` | `Result<JoinedGroupVO>` | POST `/api/parfait-groups/join` | `JoinGroupUseCase` → A-004(모달 확인) |
| `createGroup(groupName, groupNickname, memberLimit)` | `Result<CreatedGroupVO>` | POST `/api/parfait-groups` | `CreateGroupUseCase` → A-005(모달 확인) |
| `changeMyNickname(groupId, groupNickname)` | `Result<GroupNicknameVO>` | PATCH `/api/parfait-groups/{groupId}/nickname` | `ChangeGroupNicknameUseCase` → S-102 |

앱 동작 메모(코드 대조):

- **에러 코드 7종이 실제 분기에 쓰인다** — `INVALID_INVITE_CODE`·`GROUP_ALREADY_JOINED`·
  `GROUP_MEMBER_LIMIT_REACHED`(A-004 문구) · `INVALID_GROUP_NICKNAME`(S-102 문구) ·
  `INVALID_GROUP_NAME`·`INVALID_GROUP_MEMBER_LIMIT`·`MEMBER_NOT_FOUND`(A-005는 로그만).
  ✅ **`GROUP_NICKNAME_ALREADY_USED` 死코드는 걷혔다**(2026-08-15, PR #250) — 상수·
  `GroupNickNameError.ALREADY_USED`·문구·매핑 분기가 함께 제거됐고, 그 코드를 검증하던 두 테스트는
  `INVALID_GROUP_NICKNAME`(400)으로 바뀌어 살았다. **남은 것은 정책 쪽이다** — 같은 그룹에 같은 표시
  이름이 여럿일 때의 구분 수단이 없다 → [open-questions](../synthesis/open-questions.md) [2026-08-15].
- ✅ **닉네임 허용 문자가 다시 맞았다**(2026-08-15, PR #250) — `CheckNameValidUseCase`에
  `'ㄱ'..'ㅎ'`·`'ㅏ'..'ㅣ'`가 더해져 서버 정규식과 같은 집합이다. 앱이 서버보다 **좁아도 안 된다**는
  기준이 KDoc에 명시됐다(좁으면 서버가 받는 이름을 앱이 먼저 막는다). 정책 문서에는 여전히 자모 항목이
  없다 → [open-questions](../synthesis/open-questions.md) [2026-08-15].
- ✅ **초대코드 자릿수가 맞아떨어졌다** — 앱 `InviteCode.LENGTH`·A-004 입력 칸은 처음부터 6이었고 서버가
  이번에 8 → 6으로 내려왔다. 그전까지는 **앱이 보낸 코드가 서버 형식 검증을 통과할 수 없었다**(문서에
  서버 자릿수가 적혀 있지 않아 드러나지 않던 불일치다). 다만 앱은 대문자 정규화를 하지 않는다 —
  서버가 `uppercase()` 하므로 동작은 같다.
- **생성 응답을 한 번 더 검사한다** — `CreateGroupUseCase`가 `groupId > 0`이 아니면 계약 위반으로 보고 실패로 되돌린다.
- **참여 → 닉네임이 두 요청이다** — 합류(POST join)는 A-004에서 끝나고 닉네임(PATCH)은 다음 화면 몫이라,
  중간에 이탈하면 그룹에는 들어간 채 닉네임만 서버 초기값으로 남는다 → [open-questions](../synthesis/open-questions.md) [2026-08-15].
- **A-005가 보내는 `groupNickname`이 아직 mock**이다(G-001 UiState 기본값 리터럴).
- ⚠️ **`recentImageUploadedAt` 파싱이 이 문서의 직렬화 포맷과 어긋난다** — 앱 매퍼가
  `kotlin.time.Instant::parse`(오프셋 필수)를 쓰는데 서버는 오프셋 없는 로컬 날짜시간을 내려준다
  → [open-questions](../synthesis/open-questions.md) [2026-08-15].
- 그룹 상세·탈퇴·신고는 여전히 Repository 인터페이스에 없다(화면이 요구할 때 올린다).

| 엔드포인트 | Service 함수 | DataSource 함수 |
|---|---|---|
| GET `/api/parfait-groups` | `ParfaitGroupService#getParfaitGroups` | `ParfaitGroupRemoteDataSource#getMyGroups` |
| GET `/api/parfait-groups/{groupId}` | `ParfaitGroupService#getParfaitGroupsByGroupId` | `ParfaitGroupRemoteDataSource#getGroupDetail` |
| GET `/api/parfait-groups/join-preview` | `ParfaitGroupService#getParfaitGroupsJoinPreview` | `ParfaitGroupRemoteDataSource#previewJoin` |
| POST `/api/parfait-groups/join` | `ParfaitGroupService#postParfaitGroupsJoin` | `ParfaitGroupRemoteDataSource#joinGroup` |
| POST `/api/parfait-groups` | `ParfaitGroupService#postParfaitGroups` | `ParfaitGroupRemoteDataSource#createGroup` |
| PATCH `/api/parfait-groups/{groupId}/nickname` | `ParfaitGroupService#patchParfaitGroupsByGroupIdNickname` | `ParfaitGroupRemoteDataSource#changeMyNickname` |
| DELETE `/api/parfait-groups/{groupId}/members/me` | `ParfaitGroupService#deleteParfaitGroupsByGroupIdMembersMe` | `ParfaitGroupRemoteDataSource#leaveGroup` |
| POST `/api/parfait-groups/{groupId}/reports` | `ParfaitGroupService#postParfaitGroupsByGroupIdReports` | `ParfaitGroupRemoteDataSource#reportGroup` |

- **요청 DTO**: `JoinParfaitGroupRequest`·`CreateParfaitGroupRequest`·`ChangeMyParfaitGroupNicknameRequest`·
  `ReportParfaitGroupRequest` — `data/service/model/request/group/` 패키지, 선언당 파일 하나(파일명은
  선언명과 동일). 이 도메인은 타입이 많아 이하 DTO/VO 절도 개별 파일명 대신 패키지+규약으로 적는다.
- **응답 DTO**: `MyParfaitGroupResponse`·`MyParfaitGroupDetailResponse`·`ParfaitGroupMemberResponse`·
  `PreviewParfaitGroupJoinResponse`·`JoinParfaitGroupResponse`·`CreateParfaitGroupResponse`·
  `ChangeMyParfaitGroupNicknameResponse`·`LeaveParfaitGroupResponse`·`ReportParfaitGroupResponse` —
  `data/service/model/response/group/` 패키지, 선언당 파일 하나(9개).
- **VO/value class**: `MyParfaitGroupVO`·`ParfaitGroupDetailVO`·`ParfaitGroupMemberVO`·`JoinedGroupVO`·
  `CreatedGroupVO`·`GroupNicknameVO`·`ReportedGroupVO`·`InviteCode`·`GroupName`·`GroupNickname` —
  `domain/model/group/` 패키지, 선언당 파일 하나(10개. 예전엔 `ParfaitGroupVO.kt`·`GroupValues.kt` 두
  파일에 묶여 있었으나 지금은 각 선언이 동명 파일로 분리돼 있다). join-preview·탈퇴는 응답이 필드
  하나뿐이라 래퍼 VO 없이 `GroupName`·`GroupId`를 그대로 반환한다.
- **Mapper**: `data/source/group/mapper/VOMapper.kt`(응답별 `toMyParfaitGroupVO`·
  `toParfaitGroupDetailVO`·`toParfaitGroupMemberVO`·`toJoinedGroupVO`·`toCreatedGroupVO`·
  `toGroupNicknameVO`·`toReportedGroupVO`·`toGroupName`·`toGroupId`). `recentImageUploadedAt`은
  이 mapper가 변환한다. 🔁 **2026-08-15(PR #248)에 `kotlinx.datetime.LocalDateTime.parse()` →
  `kotlin.time.Instant::parse`로 바뀌었고**(VO 타입도 `Instant?`), "오프셋(`Z`)째로 읽는다"는 주석이 붙었다 —
  Asia/Seoul 벽시계 전제를 없애려는 변경이다. **그런데 이 문서의 직렬화 포맷 절이 근거로 삼는 서버
  컨트롤러 테스트의 기대값은 오프셋 없는 `2026-08-01T12:00:00`이라, 그 문자열은 `Instant.parse`가 받지
  못한다** → [open-questions](../synthesis/open-questions.md) [2026-08-15].

## 미결

✅ **회원 전역 닉네임과 그룹 닉네임 규칙 대조 — 2026-08-11 해소.** 두 값 객체가 **문자 그대로 같은
규칙**이다: `core/member/domain/GlobalNickname`과 `core/parfaitgroup/domain/GroupNickname` 모두
`MAX_LENGTH = 15`, 패턴 `^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]+(?: [가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]+)*$`(2026-08-15 자모 추가도
**두 객체 동시**였다), 길이 검사 `1..MAX_LENGTH`.
다른 것은 위반 시 던지는 코드(`INVALID_NICKNAME` vs `INVALID_GROUP_NICKNAME`)와 `GroupNickname.unknown()`
센티널의 존재뿐이다. 따라서 join-preview·join이 회원의 전역 닉네임에 `GroupNickname.of`를 적용해도
**정상 경로에서는 통과한다** — 우려했던 "본인 입력과 무관한 `INVALID_GROUP_NICKNAME`"은 발생하지 않는다.

> ⚠️ 예외 하나. `GroupNickname.unknown()`이 만드는 `(알수없음)`은 괄호를 포함해 **자기 패턴을 통과하지
> 못하는 값**이다.
>
> 🔁 **2026-08-15 — 그 경로가 실제로 생겼고 서버가 특례로 막았다.** 회원 탈퇴가 멤버십을 `leave()`로
> 바꾸면서 `(알수없음)` 행이 DB에 남고, 그 행을 도메인으로 재구성할 때 `GroupNickname.of`가 걸려 터졌다
> (`fix: 탈퇴 멤버 닉네임 재구성 시 GroupNickname 검증 실패 수정`). 지금 `of`는 **입력이 정확히
> `(알수없음)`이면 검증을 건너뛰고 통과시킨다.** 그런데 `of`는 **사용자 입력에도 그대로 쓰인다** —
> 그룹 생성(`ParfaitGroupService.create`)과 닉네임 변경(`ParfaitGroupMember.changeNickname`) 양쪽이다.
> 즉 사용자가 `(알수없음)`을 입력하면 괄호 금지 규칙을 우회해 **탈퇴자와 같은 표시 이름**을 가질 수 있다
> → [open-questions](../synthesis/open-questions.md).

전역 닉네임을 바꾸는 API는 [member.md](member.md)에 있다.

2026-08-15 서버 delta로 새로 열린 것 셋:

- 같은 그룹 안 닉네임 중복이 허용됐는데 **정책 문서에 근거가 없다** — 서버 커밋 메시지의 "정책상 허용"만
  근거다. 앱 S-102는 아직 중복 에러 문구를 갖고 있다 → [open-questions](../synthesis/open-questions.md)
- 닉네임 허용 문자에 자모가 들어왔는데 위키 [[이름-입력-규칙]]은 "한글"의 범위를 정하지 않는다.
  앱은 완성형만 통과시켜 **서버보다 좁다** → [open-questions](../synthesis/open-questions.md)
- 초대코드 자릿수 6이 서버·앱 코드 양쪽에만 있고 정책 문서에 없다 →
  [open-questions](../synthesis/open-questions.md)
