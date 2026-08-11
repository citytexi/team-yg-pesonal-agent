---
id: parfait
title: 파르페(캔버스) 조회
server_module: http/parfait
server_commit: 2c5499a
verified: 2026-08-11
android_status: partial
related_spec:
related_adr: ADR-0017
tags: [api, parfait, server-contract, canvas]
---

# 파르페(캔버스) 조회 API 계약

> 정본은 서버 코드(`mash-up-kr/TEAMYG-SERVER` `main`). 이 문서는 미러다 — 어긋나면 서버가 옳다.
> 전역 계약(envelope·에러 체계·인증)은 [conventions.md](conventions.md).

## 엔드포인트

| 메서드 | 경로 | 인증 | 요청 | 응답 | Android |
|---|---|---|---|---|---|
| GET | `/api/v1/groups/{groupId}/parfaits/year` | 필요 | path `groupId` Long | `ParfaitYearsResponse` | 구현됨 |

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
  `ParfaitServiceTest`의 성공 케이스는 `[2026, 2027]` 오름차순 스텁 값을 검증할 뿐, 정렬이 서비스 계층의
  보장 사항인지 confirm하지 않는다.

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

  **전용 `ErrorCode` enum 없음.** 위 `GROUP_NOT_JOINED` 하나가 이 도메인이 던지는 유일한 도메인
  에러이고, 그마저 parfait-group 소유 enum을 재사용한다. 인증 실패는 전역 `AuthErrorCode.UNAUTHORIZED`
  (401), 그 외 처리되지 않은 예외는 `CommonErrorCode.INTERNAL_SERVER_ERROR`(500)로 나간다 — 둘 다 전역
  공통이라 위 표에 반복하지 않는다([conventions.md](conventions.md) 참고).

## Android 매핑

`:data`·`:domain`에 API 표면이 구현됐다([spec](../specs/archive/2026-08-03-data-api-service-layer.md)) —
**2026-08-06 PR #197로 develop 머지 완료**다. 이 표면이 딛고 선 공용 인프라(`ApiCaller` 4진입점·
`ApiResponse` envelope·`@NoAuth`·`TokenStoreTokenProvider`)는 PR #190으로 먼저 들어왔고, 아래
Service·DataSource·DTO·VO가 이번에 그 위에 올라갔다.
**⚠️ Repository·UseCase·화면 어느 것도 아직 이 표면을 소비하지 않는다** — C-201 캘린더 결선은
이후 라운드다.

| 엔드포인트 | Service 함수 | DataSource 함수 |
|---|---|---|
| GET `/api/v1/groups/{groupId}/parfaits/year` | `ParfaitService#getGroupsByGroupIdParfaitsYear` | `ParfaitRemoteDataSource#getYears` |

- **응답 DTO**: `ParfaitYearsResponse`(`years: List<Int>`) —
  `data/service/model/response/parfait/ParfaitYearsResponse.kt`. 요청 DTO 없음(path 변수만 받는 GET).
  이 저장소는 DTO·도메인 모델을 선언당 파일 하나로 두는 규약이라 파일명이 선언명과 그대로 같다 —
  다른 이름이 붙을 이유가 없는 평범한 경우다.
- **VO 없음** — 응답이 `years` 한 필드뿐이라 mapper가 `List<Int>`를 그대로 반환한다
  (`ParfaitRemoteDataSourceImpl#getYears`의 `transform = { it.years }`). `GroupId` value class는
  `domain/model/id/GroupId.kt`에 있다.
- **Mapper 파일 없음** — 변환이 필드 하나짜리라 별도 mapper 함수를 두지 않는다.

## 미결

- **경로 세그먼트 `year`(단수) vs 응답 필드 `years`(복수) 불일치.** 서버 코드로는 의도된 설계인지 실수인지
  확인할 수 없다 — 근거 자료(PR 설명·이슈) 조사는 이번 범위 밖. → [open-questions](../synthesis/open-questions.md)
