---
id: parfait-group
title: 파르페 그룹
server_module: http/parfaitgroup
server_commit: 69654bc
verified: 2026-08-03
android_status: none
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
| GET | `/api/parfait-groups` | 필요 | 없음 | `List<MyParfaitGroupResponse>` | 미구현 |
| GET | `/api/parfait-groups/{groupId}` | 필요 | path `groupId` Long | `MyParfaitGroupDetailResponse` | 미구현 |
| GET | `/api/parfait-groups/join-preview` | 필요 | query `inviteCode` String | `PreviewParfaitGroupJoinResponse` | 미구현 |
| POST | `/api/parfait-groups/join` | 필요 | `JoinParfaitGroupRequest` | `JoinParfaitGroupResponse` | 미구현 |
| POST | `/api/parfait-groups` | 필요 | `CreateParfaitGroupRequest` | `CreateParfaitGroupResponse` | 미구현 |
| PATCH | `/api/parfait-groups/{groupId}/nickname` | 필요 | `ChangeMyParfaitGroupNicknameRequest` | `ChangeMyParfaitGroupNicknameResponse` | 미구현 |
| DELETE | `/api/parfait-groups/{groupId}/members/me` | 필요 | path `groupId` Long | `LeaveParfaitGroupResponse` | 미구현 |
| POST | `/api/parfait-groups/{groupId}/reports` | 필요 | `ReportParfaitGroupRequest` | `ReportParfaitGroupResponse` | 미구현 |

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
| `inviteCode` | String | 필수(query, `@RequestParam` 기본값이 required) | |

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
| 409 | `GROUP_NICKNAME_ALREADY_USED` | 그룹에서 이미 사용 중인 닉네임입니다 |
| 400 | `INVALID_GROUP_NICKNAME` | 그룹 닉네임이 올바르지 않습니다(아래 참고) |

  근거: `ParfaitGroupService.preview`가 `findGroup`(→ `INVALID_INVITE_CODE`) 후 `validateJoin`을 호출한다.
  `validateJoin`은 `ParfaitGroup.validateJoin`(→ `GROUP_ALREADY_JOINED`·`GROUP_MEMBER_LIMIT_REACHED`)과
  `requireMemberNickname`(→ `MEMBER_NOT_FOUND`), `GroupNickname.of`(→ `INVALID_GROUP_NICKNAME`),
  중복 닉네임 검사(→ `GROUP_NICKNAME_ALREADY_USED`)를 순서대로 실행한다 — `join`과 완전히 같은 private 함수를
  공유한다. `INVALID_INVITE_CODE`·`GROUP_ALREADY_JOINED`·`GROUP_MEMBER_LIMIT_REACHED`는
  `ParfaitGroupServiceTest`가 preview 경로로 직접 검증(`ParfaitGroupControllerTest`도 `GROUP_MEMBER_LIMIT_REACHED`
  409 응답을 확인). `MEMBER_NOT_FOUND`·`INVALID_GROUP_NICKNAME`은 preview 전용 테스트는 없지만 `validateJoin`
  공유 코드 경로로 확인했다.

  `INVALID_GROUP_NICKNAME`은 요청 바디가 아니라 **회원의 전역 닉네임**에 `GroupNickname.of`를 적용한 결과다
  (`requireMemberNickname`이 반환한 값을 그대로 검증) — 아래 [미결](#미결) 참고.

### POST /api/parfait-groups/join

- **인증**: 필요
- **성공**: HTTP 200 · envelope `code` = `"OK"`
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `inviteCode` | String | 필수(non-null 타입) | |

- **응답 필드**

| 필드 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `groupId` | Long | 아니오 | |
| `groupName` | String | 아니오 | |

- **에러 코드**: join-preview와 동일 6종(`INVALID_INVITE_CODE`·`GROUP_ALREADY_JOINED`·
  `GROUP_MEMBER_LIMIT_REACHED`·`MEMBER_NOT_FOUND`·`GROUP_NICKNAME_ALREADY_USED`·`INVALID_GROUP_NICKNAME`) —
  `ParfaitGroupService.join`이 같은 `findGroup`·`validateJoin`을 호출한 뒤 멤버십을 저장한다. 코드 표는 위
  join-preview 절 참고(중복 서술 생략). `GROUP_NICKNAME_ALREADY_USED`는 `ParfaitGroupServiceTest`가 join 경로로
  직접 검증한다("같은 그룹에서 이미 사용 중인 전역 닉네임이면 참여를 거부한다").

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
| 409 | `GROUP_NICKNAME_ALREADY_USED` | 그룹에서 이미 사용 중인 닉네임입니다 |

  근거: `ParfaitGroupService.change`가 `findGroupByIdForUpdate`(→ `GROUP_NOT_FOUND`) → `findMembership`(→
  `GROUP_NOT_JOINED`) → `membership.changeNickname`(내부 `GroupNickname.of`, → `INVALID_GROUP_NICKNAME`) →
  중복 검사(→ `GROUP_NICKNAME_ALREADY_USED`, 값이 바뀔 때만) 순서로 실행한다. `GROUP_NICKNAME_ALREADY_USED`는
  `ParfaitGroupServiceTest`("이미 사용 중인 그룹 닉네임으로 변경할 수 없다")로 직접 검증.

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

## 도메인 에러 코드 전수 — `ParfaitGroupApiErrorCode`(11종)

`ParfaitGroupApiErrorCode`는 core `ParfaitGroupError`와 이름이 1:1이다(`from(error) = valueOf(error.name)`,
[conventions.md](conventions.md)). 8개 엔드포인트 서비스 코드(`ParfaitGroupService`)와 도메인 값 객체
(`ParfaitGroup`·`ParfaitGroupMember`·`ParfaitGroupReport`·`GroupName`·`GroupNickname`·`GroupMemberLimit`)를 직독해
11종 전부의 귀속처를 확인했다 — "귀속 미대조"로 남길 항목은 없다.

| code | HTTP | 의미 | 귀속 |
|---|---|---|---|
| `INVALID_INVITE_CODE` | 404 | 유효하지 않은 초대코드입니다 | join-preview · join |
| `GROUP_ALREADY_JOINED` | 409 | 이미 참여한 그룹입니다 | join-preview · join |
| `GROUP_MEMBER_LIMIT_REACHED` | 409 | 그룹의 최대 인원이 모두 참여했습니다 | join-preview · join |
| `GROUP_NICKNAME_ALREADY_USED` | 409 | 그룹에서 이미 사용 중인 닉네임입니다 | join-preview · join · 닉네임 변경 |
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
- 두 값 객체가 공유하는 문자 규칙: 정규식 `^[가-힣A-Za-z0-9]+(?: [가-힣A-Za-z0-9]+)*$` — 한글·영문·숫자만
  허용하고 단어 사이 단일 스페이스만 허용한다(선행·후행 공백, 연속 공백, 그 외 특수문자 불가). 이 문자 규칙
  자체는 위키에 대응 항목이 없어 대조 대상이 아니다.
- `INVALID_GROUP_MEMBER_LIMIT`의 메시지("1명 이상 12명 이하")가 곧 규칙 본문이라 http 계층 어디에도 별도
  문서화가 없어도 서버 코드만으로 확정된다 — 브리프가 우려한 "규칙 본문이 http 계층에 없다"는 core 값
  객체(`GroupName`·`GroupNickname`·`GroupMemberLimit`)에서 전부 찾았다.

## Android 매핑

없음 — `:data`에 그룹 관련 Service·Response·DataSource가 없다.

## 미결

- **회원 전역 닉네임과 그룹 닉네임 규칙(1~15자·문자 패턴)이 같은지 미대조.** join-preview·join의
  `INVALID_GROUP_NICKNAME`은 요청 필드가 아니라 `requireMemberNickname`이 반환한 **회원의 전역 닉네임**에
  `GroupNickname.of`를 적용한 결과다(`ParfaitGroupService.validateJoin`). 전역 닉네임을 검증하는
  `core/member` 쪽 값 객체를 이번 조사 범위(브리프 Step 1 파일 목록)에서 확인하지 못했다 — 두 규칙이 다르면
  회원이 그룹 참여를 시도할 때 본인이 입력한 값과 무관하게 `INVALID_GROUP_NICKNAME`을 받을 수 있다.
  → [open-questions](../synthesis/open-questions.md)
