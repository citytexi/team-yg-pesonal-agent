---
id: notification
title: 알림(기기 FCM 토큰 등록)
server_module: http/notification
server_commit: 0c59af9
verified: 2026-09-02
android_status: none
related_spec:
related_adr: ADR-0013, ADR-0017
tags: [api, parfait, server-contract, notification]
---

# 알림(기기 FCM 토큰 등록) API 계약

> 정본은 서버 코드(`mash-up-kr/TEAMYG-SERVER` `main`). 이 문서는 미러다 — 어긋나면 서버가 옳다.
> 전역 계약(envelope·에러 체계·인증)은 [conventions.md](conventions.md).

`[Feat/#125] 기기(FCM) 토큰 저장/삭제 API + device_token 스키마 (#126)`로 신설된 **여덟 번째 도메인**이다.
서버가 클라이언트의 FCM 등록 토큰을 받아 보관하는 자리만 만들었고, **발송 인프라와 알림 트리거는
이 delta의 범위 밖이라고 커밋 메시지가 명시한다.** 즉 지금 이 도메인은 "언제 무엇을 보내는가"를
아직 하나도 정하지 않은 채 **저장소만 먼저 연 상태**다.

## 엔드포인트

| 메서드 | 경로 | 인증 | 요청 | 응답 | Android |
|---|---|---|---|---|---|
| POST | `/api/v1/notifications/devices` | **필요**(화이트리스트 밖) | `RegisterDeviceTokenRequest` | 없음(204, envelope 없음) | 미구현 |

**삭제 엔드포인트는 없다.** 커밋 제목이 "저장/삭제 API"라고 적지만 HTTP 표면은 등록 하나뿐이고,
삭제는 다른 도메인의 부수 효과로만 일어난다(아래 [기기 토큰이 지워지는 두 경로](#기기-토큰이-지워지는-두-경로)).

## 엔드포인트 상세

### POST /api/v1/notifications/devices

- **인증**: **필요**. `SecurityConfig` 화이트리스트가 이 delta에서 바뀌지 않았으므로 전 요청 인증
  대상이다([conventions.md](conventions.md) "인증").
- **성공**: HTTP **204** · **envelope 없음**. `DeviceTokenController.register`는 반환 타입이 없는(Unit)
  함수이고 `@ResponseStatus(HttpStatus.NO_CONTENT)`만 붙는다 — `ApiResponse.ok`/`created` 호출이 없으므로
  **응답 본문 자체가 비어 있다**. 로그아웃·탈퇴에 이어 **envelope를 쓰지 않는 세 번째 성공 응답**이다.
- **요청 필드**

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `token` | String | 필수(`@NotBlank`) | FCM SDK가 발급한 기기 등록 토큰 |
| `platform` | String(enum) | 필수 | `DevicePlatform` — `IOS` · `ANDROID` 두 값 |

  `platform`에는 `@NotNull`이 붙어 있지 않지만 Kotlin 비널 프로퍼티라 **필드를 빼면 역직렬화 단계에서
  거절된다**(400). 열거형에 없는 값(예: `WINDOWS`)도 같은 400이다 — 근거는 `DeviceTokenControllerTest`의
  두 케이스다.

- **응답 필드**: 없음(204, 본문 없음 — 위 참고)

  **회원과 세션은 요청이 아니라 토큰에서 정한다.** `memberId`는 `Authentication.name`, `sessionId`는
  `Authentication.credentials`에서 꺼낸다 — 요청 바디로 남의 기기를 지목할 경로가 없다.
  `credentials`에 세션이 실리는 것은 이 delta가 access token에 `sessionId` 클레임을 더했기 때문이다
  ([conventions.md](conventions.md) "인증" · [auth.md](auth.md)).

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_REQUEST` | `token`이 공백이거나 `platform`이 허용 값 밖 |
| 401 | `UNAUTHORIZED` | 인증이 필요합니다 |
| 401 | `INVALID_TOKEN` | 유효하지 않은 토큰입니다 |
| 401 | `EXPIRED_TOKEN` | 만료된 토큰입니다 |
| 401 | `MEMBER_NOT_FOUND` | 존재하지 않는 회원입니다 |

  **도메인 전용 에러 코드가 없다.** 이 delta는 `*ErrorCode` enum을 하나도 만들지 않았다 — 400은 전역
  `CommonErrorCode.INVALID_REQUEST`(`GlobalExceptionHandler`의 bad-request 핸들러), 401 4종은 전역 인증
  (`AuthErrorCode`)이다. 즉 **실패 표현이 전부 전역 계약이다.**

## 등록은 upsert다 — `token`이 유일 키

`RegisterDeviceTokenService.register`는 `findByToken`으로 같은 토큰의 행을 먼저 찾고, 있으면
`DeviceToken.reassign`으로 **소유자(`memberId`)·세션(`sessionId`)·플랫폼·갱신 시각을 덮어쓴다.**
없으면 `DeviceToken.register`로 새로 만든다.

**이 설계가 계약에서 뜻하는 바**는 기기 하나가 항상 회원 하나에만 매달린다는 것이다 — 기기를 양도하거나
같은 기기에서 계정을 바꿔 로그인하면 **이전 매핑이 별도 정리 호출 없이 자동으로 끊긴다.** 클라이언트는
"이전 계정의 토큰을 지워 달라"고 따로 부를 필요가 없고, 그런 엔드포인트도 없다.

⚠️ **같은 신규 토큰으로 두 요청이 동시에 들어오면 두 번째가 유니크 제약 위반으로 500이 날 수 있다.**
`DeviceTokenAdapter.save`의 주석이 이 경합을 인정하고, **재시도가 update 경로로 수렴한다**는 것을 근거로
둔다(앱 시작·`onNewToken`·권한 허용마다 재호출되는 엔드포인트라는 전제다). 즉 **이 엔드포인트는 반복
호출을 전제로 설계됐고, 클라이언트가 실패를 삼켜도 다음 호출이 메운다.**

## 기기 토큰이 지워지는 두 경로

| 경로 | 지우는 범위 | 근거 |
|---|---|---|
| `POST /api/v1/auth/logout` | 그 **로그인 세션**이 등록한 행(`memberId` + `sessionId`) | `LogoutService`가 `TokenDeletePort.delete` 바로 뒤에서 `DeviceTokenDeletePort.delete` 호출 |
| `DELETE /api/v1/users/me` | 그 **회원의 전 행**(`memberId`) | `MemberService.withdraw`의 `afterCommit`에서 `deleteAllByMemberId` 호출 |

둘의 범위가 다른 것은 의도다 — 로그아웃은 한 세션만 끝내지만 탈퇴는 그 회원의 모든 세션을 정리한다.

⚠️ **세션이 없는 행은 로그아웃이 지우지 못한다.** `sessionId`는 널을 허용하고
(`session_id` 컬럼이 nullable, 클레임 과도기 때문이다), 삭제 조건은 `memberId` **와** `sessionId`를
함께 본다. 이 변경 전에 발급된 access token으로 등록하면 `sessionId`가 널인 행이 생기고, **그 행은
로그아웃으로 지워지지 않는다** — 탈퇴이거나 같은 토큰의 재등록(upsert)만 그것을 걷는다
→ [미결](#미결).

⚠️ **탈퇴 시 정리는 실패해도 탈퇴를 막지 않는다.** `afterCommit` 블록에서 refresh token 정리와 **별개의**
`runCatching`으로 감싸므로, 한쪽이 실패해도 나머지 정리와 탈퇴 자체는 진행되고 로그 경고만 남는다
([member.md](member.md)).

## 저장 스키마 — `device_token`(Flyway `V17`)

계약 서술에 걸리는 것만 옮긴다(스키마 전체 미러가 아니다).

- `token`이 **유니크**(`uk_device_token_token`) — 위 upsert의 근거다.
- `member_id`가 `member(id)` **외래 키** — 회원이 사라지면 남을 수 없다.
- `session_id`는 **널 허용** — 위 경고의 근거다.
- `(member_id, session_id)` 인덱스 — 로그아웃 삭제 조건과 같은 축이다.

## Android 매핑

**없음.** develop(`0173e454`) 전체에 `FirebaseMessaging`·FCM 토큰 취득·이 경로를 부르는 심볼이 **0건**이다.

🔁 **다만 이 공백은 "아직 안 만든 것"이 아니라 "만들었다가 걷어낸 것"이다.** 앱은 FCM 수신 서비스와
토큰 조회·알림 권한 요청을 갖고 있었고, **2026-08-22 PR #325가 그것을 걷어냈다**
([ADR-0013](../adr/0013-firebase-fcm-crashlytics.md)의 철회 정정 — `firebase-messaging` 의존까지 빠졌고
Crashlytics·Analytics만 남았다). **철회 근거가 정확히 이 엔드포인트의 부재였다** — `onNewToken`이
`TODO("서버에 FCM 토큰 전송")`인 채여서 토큰이 로그로만 갔고, 결선된 적 없는 기능 때문에 첫 실행마다
알림 권한을 묻는 상태였다.

**이번 delta가 그 전제를 뒤집는다.** 보낼 자리가 생겼으므로 "쓰이지 않아서 걷었다"는 근거는 더 이상
성립하지 않는다. ADR-0013이 되살릴 때 다시 정하라고 남긴 두 물음(**토큰 라이프사이클**과 **알림 권한을
언제 묻는가**) 중 앞의 것은 서버가 절반을 답했다 — 등록은 upsert, 폐기는 로그아웃·탈퇴다
→ [미결](#미결).

## 미결

- 2026-08-22에 걷어낸 FCM 축을 되살릴지 — 철회 근거(보낼 서버가 없다)가 이 delta로 사라졌다
  → [open-questions](../synthesis/open-questions.md) OQ-P-341
- 세션 없는(`session_id` 널) 행을 로그아웃이 못 지우는 구간을 서버가 닫을지, 앱이 재등록으로 덮을지
  → [open-questions](../synthesis/open-questions.md) OQ-P-342
- 발송 인프라·알림 트리거가 서버 범위 밖이라 **무엇을 언제 보내는지**가 계약에 없다
  → [open-questions](../synthesis/open-questions.md) OQ-P-343
