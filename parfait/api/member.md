---
id: member
title: 회원(내 계정 조회·전역 닉네임 변경)
server_module: http/member
server_commit: 2c5499a
verified: 2026-08-11
android_status: none
related_spec:
related_adr: ADR-0017
tags: [api, parfait, server-contract, member]
---

# 회원(내 계정 조회·전역 닉네임 변경) API 계약

> 정본은 서버 코드(`mash-up-kr/TEAMYG-SERVER` `main`). 이 문서는 미러다 — 어긋나면 서버가 옳다.
> 전역 계약(envelope·에러 체계·인증)은 [conventions.md](conventions.md).

`[Feat/#66] 전역 닉네임 변경 API (#77)`와 `[Feat/#67] 내 계정 정보 조회 API (#84)`로 신설됐다.
두 엔드포인트가 `MemberController` 하나에 있고 클래스 레벨 매핑이 `/api/v1/users/me`다 —
**URL 세그먼트는 `users`인데 서버 패키지·도메인 이름은 `member`다.**

**"전역 닉네임"은 계정 1개당 1개**이고, 그룹 안에서 쓰는 닉네임([parfait-group.md](parfait-group.md)의
`groupNickname`)과 다른 값이다. 계정 생성 시 서버가 `RandomNicknameGenerator.generate()`로 자동
부여하고([auth.md](auth.md) `signup`), 이 API가 그 값을 바꾼다.

## 엔드포인트

| 메서드 | 경로 | 인증 | 요청 | 응답 | Android |
|---|---|---|---|---|---|
| GET | `/api/v1/users/me` | 필요 | 없음 | `MyAccountResponse` | 미구현 |
| PATCH | `/api/v1/users/me/nickname` | 필요 | `ChangeGlobalNicknameRequest` | `ChangeGlobalNicknameResponse` | 미구현 |

둘 다 `SecurityConfig.WHITELIST_PATHS`에 없어 **access token이 필요하다**. memberId는 요청이 아니라
토큰에서 나온다(`Authentication.memberId(): Long = name.toLong()`) — 남의 계정을 지정할 경로가 없다.

## 엔드포인트 상세

### GET /api/v1/users/me

- **인증**: 필요.
- **성공**: HTTP 200 · envelope `code` = `"OK"`(`ApiResponse.ok`, `@ResponseStatus` 없음)
- **요청 필드**: 없음(경로 변수·쿼리·바디 전부 없음)
- **응답 필드**

| JSON 키 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `memberId` | Long | 아니오 | 토큰에서 꺼낸 값을 그대로 되돌려준다 |
| `provider` | String | 아니오 | `LoginProvider` 이름 문자열. **core enum은 `KAKAO`·`APPLE` 2종** — 아래 참고 |
| `nickname` | String | 아니오 | 전역 닉네임(`Member.globalNickname`) |

  ⚠️ **영속 계층 `LoginProvider`에는 `GOOGLE`이 있는데 core enum에는 없다.** `MemberAdapter.toCoreProvider`가
  `GOOGLE`에서 `error(...)`로 `IllegalStateException`을 던지고, `GlobalExceptionHandler`의 `Exception`
  핸들러가 이를 **500 `INTERNAL_SERVER_ERROR`**로 바꾼다. 구글 로그인 회원 행이 생기는 순간 이 조회가
  깨진다는 뜻이다 — 현재 구글 로그인 경로 자체가 없어 도달하지 않는다 → [미결](#미결).

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 401 | `UNAUTHORIZED` | 인증 헤더 없음·`Bearer` 아님(`AuthErrorCode`, 전역) |
| 401 | `INVALID_TOKEN` · `EXPIRED_TOKEN` | access token 검증 실패(`AuthErrorCode`, 전역 `JwtAuthFilter`) |
| 401 | `MEMBER_NOT_FOUND` | 토큰의 `memberId` 회원 부재(`AuthErrorCode`, 전역 `JwtAuthFilter`) |
| 404 | `MEMBER_NOT_FOUND` | 조회 대상 회원 부재(`MemberErrorCode`, `MemberService.getMyAccount`) |

  ⚠️ **같은 엔드포인트에서 `MEMBER_NOT_FOUND`가 401과 404 둘 다로 나갈 수 있다.** 앞의 것은
  `JwtAuthFilter.authenticate`가 `MemberQueryPort.existsById`로 컨트롤러 도달 **전에** 던지고, 뒤의 것은
  `MemberService`가 `findAccountById`가 `null`일 때 던진다. **실무상 401이 항상 먼저 걸리므로 404 분기는
  두 검사 사이에 회원이 사라진 경우에만 도달한다**(회원 삭제 API는 현재 없다). 소비 측이 `code` 문자열로만
  분기하면 두 상황이 한 브랜치로 뭉개진다 → [conventions.md](conventions.md) "코드 문자열은 enum 간
  유일하지 않다". 근거: `MemberControllerTest`가 404 케이스를 직접 검증하고, 401 케이스는
  `SecurityConfigIntegrationTest`가 전역으로 검증한다.

### PATCH /api/v1/users/me/nickname

- **인증**: 필요.
- **성공**: HTTP 200 · envelope `code` = `"OK"`(`ApiResponse.ok`)
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `nickname` | String | 필수(`@NotBlank`) | 바꿀 전역 닉네임. 규칙은 아래 |

  **유효성은 `GlobalNickname.of`가 판정한다** — 1~15자, 패턴 `^[가-힣A-Za-z0-9]+(?: [가-힣A-Za-z0-9]+)*$`
  (한글·영문·숫자, 단어 사이 한 칸 공백 허용, 앞뒤·연속 공백 불가). 위반은 400 `INVALID_NICKNAME`이다.

  📌 **그룹 닉네임 규칙과 문자 그대로 같다.** `core/parfaitgroup/domain/GroupNickname`도 `MAX_LENGTH = 15`에
  같은 정규식을 쓴다 — 다른 것은 던지는 에러 코드(`INVALID_GROUP_NICKNAME`)와 `GroupNickname.unknown()`
  센티널 값의 존재뿐이다. 이 대조가 [parfait-group.md](parfait-group.md)에 오래 걸려 있던 미결을 닫는다.

- **응답 필드**

| JSON 키 | 타입 | 널 허용 | 비고 |
|---|---|---|---|
| `nickname` | String | 아니오 | 저장된 값. 요청 값을 `GlobalNickname.of`에 통과시킨 결과이므로 요청과 같다 |

  **저장 범위**: `MemberService.change`가 `@Transactional`로 `Member.globalNickname` 한 컬럼을 갱신한다.
  ⚠️ **이미 참여한 그룹의 `groupNickname`은 바뀌지 않는다** — 그룹 닉네임은 별도 컬럼이고 이 API가
  건드리지 않는다(그룹 닉네임 변경은 [parfait-group.md](parfait-group.md)의 전용 엔드포인트다).

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_REQUEST` | `nickname` 필드 부재·빈 문자열(`@NotBlank` 위반 → `CommonErrorCode`) |
| 400 | `INVALID_NICKNAME` | 길이·문자 패턴 위반(`MemberErrorCode`, `GlobalNickname.of`) |
| 404 | `MEMBER_NOT_FOUND` | 갱신 대상 회원 부재(`MemberErrorCode`, `MemberAdapter.updateGlobalNickname`) |
| 401 | `UNAUTHORIZED` · `INVALID_TOKEN` · `EXPIRED_TOKEN` · `MEMBER_NOT_FOUND` | 전역 인증(`AuthErrorCode`) |

  **빈 문자열과 형식 위반이 다른 코드로 갈린다.** `""`는 `@NotBlank`에 걸려 `INVALID_REQUEST`,
  `"연속  공백"`은 애노테이션을 통과한 뒤 `GlobalNickname.of`에서 `INVALID_NICKNAME`이 된다.
  근거: `MemberControllerTest`가 네 케이스(정상·빈 문자열·필드 부재·형식 위반)를 직접 검증한다.

## 도메인 에러 코드 전수

`MemberErrorCode`(`core/member/exception`) 2종 전부.

| HTTP | code | message |
|---|---|---|
| 400 | `INVALID_NICKNAME` | 닉네임 형식이 올바르지 않습니다 |
| 404 | `MEMBER_NOT_FOUND` | 존재하지 않는 회원입니다 |

⚠️ **`MEMBER_NOT_FOUND`를 가진 네 번째 enum이다.** `AuthErrorCode`(401) · `ParfaitGroupApiErrorCode`(404) ·
`ImageErrorCode`(404) · `MemberErrorCode`(404) → [conventions.md](conventions.md).

## Android 매핑

**없음.** develop과 origin의 진행 중 브랜치 전수(2026-08-11 기준)에 `MemberService`·`MyAccount`·
`ChangeGlobalNickname`류 심볼이 0건이다. TJYG-Android 루트의 `http/` 요청 모음에도 `users` 요청 파일이 없다.

앱에는 이미 전역 닉네임을 다루는 화면(S-002)이 있으나 **저장 경로 없이 화면 로컬 상태에만 산다**
→ [open-questions](../synthesis/open-questions.md). 이 API가 그 저장 경로다.

## 미결

- 영속 `LoginProvider.GOOGLE`이 core enum에 없어 해당 회원 조회가 500이 된다 — 구글 로그인을 뺄지
  core enum에 넣을지 → [open-questions](../synthesis/open-questions.md)
- 전역 닉네임을 바꿔도 기존 그룹의 `groupNickname`이 그대로인 것이 의도인지(앱은 두 값을 다른 화면에
  보여줘야 한다) → [open-questions](../synthesis/open-questions.md)
