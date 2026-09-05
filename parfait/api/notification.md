---
id: notification
title: 알림(기기 FCM 토큰 등록 · 푸시 발송)
server_module: http/notification
server_commit: aa9cc9b
verified: 2026-09-04
android_status: partial
related_spec:
related_adr: ADR-0013, ADR-0017
tags: [api, parfait, server-contract, notification]
---

# 알림(기기 FCM 토큰 등록 · 푸시 발송) API 계약

> 정본은 서버 코드(`mash-up-kr/TEAMYG-SERVER` `main`). 이 문서는 미러다 — 어긋나면 서버가 옳다.
> 전역 계약(envelope·에러 체계·인증)은 [conventions.md](conventions.md).

`[Feat/#125] 기기(FCM) 토큰 저장/삭제 API + device_token 스키마 (#126)`로 신설된 **여덟 번째 도메인**이고,
`[Feat/#127] FCM 발송 인프라 + 3종 알림 트리거 연결 (#129)`로 **보내는 쪽이 붙었다.**

🔁 **이 문서가 2026-09-02에 "발송 인프라와 알림 트리거는 범위 밖"이라고 적은 서술은 폐기됐다.**
서버는 이제 **실제로 푸시를 보낸다** — 토핑이 새로 배치되면 같은 그룹의 나머지 구성원에게 FCM 단건
발송이 나간다. 이 도메인은 **HTTP 왕복 하나(기기 토큰 등록)와 서버→앱 단방향 푸시 하나**로 이루어지고,
아래 [서버가 보내는 푸시](#서버가-보내는-푸시--토핑-등록-알림)가 **HTTP 응답 스키마가 아닌 계약**이다.

⚠️ **이 delta의 HTTP 표면 변화는 0이다.** 컨트롤러·요청 DTO·에러 코드·`SecurityConfig`·`ApiResponse`·
`GlobalExceptionHandler` 어느 것도 바뀌지 않았다. **엔드포인트를 세는 방식으로는 이번 변화가 전혀 안
보인다** — 그런데도 앱이 맞춰야 할 계약은 이번 회차에 가장 크게 늘었다.

## 엔드포인트

| 메서드 | 경로 | 인증 | 요청 | 응답 | Android |
|---|---|---|---|---|---|
| POST | `/api/v1/notifications/devices` | **필요**(화이트리스트 밖) | `RegisterDeviceTokenRequest` | 없음(204, envelope 없음) | **구현됨·결선됨**(PR #450 — 세션 축 넷에서 부른다: 로그인·가입·앱 진입의 성공 분기 + `onNewToken`) |

**삭제 엔드포인트는 없다.** 커밋 제목이 "저장/삭제 API"라고 적지만 HTTP 표면은 등록 하나뿐이고,
삭제는 다른 도메인·발송 경로의 부수 효과로만 일어난다
(아래 [기기 토큰이 지워지는 세 경로](#기기-토큰이-지워지는-세-경로)).

## 엔드포인트 상세

### POST /api/v1/notifications/devices

- **인증**: **필요**. `SecurityConfig` 화이트리스트가 신설 때도 이번 delta에서도 바뀌지 않았으므로 전 요청
  인증 대상이다([conventions.md](conventions.md) "인증").
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
  `credentials`에 세션이 실리는 것은 신설 delta가 access token에 `sessionId` 클레임을 더했기 때문이다
  ([conventions.md](conventions.md) "인증" · [auth.md](auth.md)).

- **에러 코드**

| HTTP | code | 의미 |
|---|---|---|
| 400 | `INVALID_REQUEST` | `token`이 공백이거나 `platform`이 허용 값 밖 |
| 401 | `UNAUTHORIZED` | 인증이 필요합니다 |
| 401 | `INVALID_TOKEN` | 유효하지 않은 토큰입니다 |
| 401 | `EXPIRED_TOKEN` | 만료된 토큰입니다 |
| 401 | `MEMBER_NOT_FOUND` | 존재하지 않는 회원입니다 |

  **도메인 전용 에러 코드가 없다.** 두 delta 어느 쪽도 `*ErrorCode` enum을 만들지 않았다 — 400은 전역
  `CommonErrorCode.INVALID_REQUEST`(`GlobalExceptionHandler`의 bad-request 핸들러), 401 4종은 전역 인증
  (`AuthErrorCode`)이다. 즉 **실패 표현이 전부 전역 계약이다.** 발송 실패도 마찬가지로 **HTTP 에러가
  아니다** — 아무에게도 응답으로 나가지 않고 서버 로그와 `notification_outbox.last_error`에만 남는다.

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

✅ **등록이 이제 실제 효력을 갖는다.** 지금까지 이 표면은 "보관만 하는 자리"였는데, `NotificationOutboxDispatcher`가
발송 직전에 `DeviceTokenQueryPort.findByMemberId`로 **수신자의 토큰을 전부 꺼내 각각 보낸다.**
등록하지 않은 회원은 알림을 받지 못하고, 그 사실이 예외가 아니라 **정상 취소**로 처리된다(아래).

## 서버가 보내는 푸시 — 토핑 등록 알림

`NotificationMessageFactory.toppingPlaced`가 문구와 `data` 스키마를 한 곳에서 조립하고,
`FcmNotificationSender`가 Firebase Admin SDK로 **단건 발송**한다(멀티캐스트는 후속 스펙으로 미룬다고
`NotificationSenderPort` KDoc이 적는다).

⚠️ **커밋 제목은 "3종 알림 트리거 연결"이라고 적지만, 코드에 연결된 트리거는 토핑 등록 하나다.**
`NotificationMessageFactory`에 문구 조립 함수가 하나뿐이고, `ToppingPlacedNotifier`를 부르는 곳도
`PlaceParfaitImageService` 한 곳이다(`main` 전체 참조 검색 기준). 캔버스 마감·그룹 초대 등 다른 알림은
발송 코드가 없다 → [미결](#미결).

### 언제 보내는가

`PlaceParfaitImageService.place()`가 **신규 배치(`existing == null`)를 확정 저장할 때만** 호출한다.
**이미 배치된 토핑의 재배치는 알림 대상이 아니다** — 같은 알맹이를 다시 올리는 경로에서는 아무것도
나가지 않는다.

수신자는 `ToppingPlacedNotifier`가 정한다.

- 그룹 구성원 전체(`ParfaitGroupMemberQueryPort.findAllByGroupId`)에서
- **나간 사람(`leftAt != null`)을 빼고**
- **작성자 본인을 뺀다** — 자기가 올린 토핑으로는 알림을 받지 않는다.

남은 사람이 없으면 아무 행도 쌓지 않고 끝난다.

### 어떤 페이로드가 가는가

FCM `Message`에 **`notification` 블록과 `data` 블록이 함께** 실린다.

| 자리 | 값 |
|---|---|
| `notification.title` | `{그룹명} 파르페에 체리 얹을 타이밍!` |
| `notification.body` | `{작성자 그룹 닉네임}님이 새 토핑을 쌓았어요` |
| `notification.body`(작성자 탈퇴 시) | `누군가 새 토핑을 쌓았어요` |

| `data` 키 | 값 | 비고 |
|---|---|---|
| `type` | `TOPPING` | 고정 문자열 |
| `route` | `canvas` | 딥링크 목적지 |
| `groupId` | 그룹 식별자 | **문자열로 직렬화된 숫자**(FCM `data`는 String만 받는다) |
| `date` | 캔버스 날짜 | `LocalDate.toString()` — `yyyy-MM-dd` |

**그룹명과 닉네임은 발송 시점에 다시 조회해 렌더한다.** outbox에 저장되는 `payload`
(`ToppingPlacedPayload`)에는 식별자(`groupId`·`parfaitId`·`parfaitDate`·`actorMemberId`)만 들어가고
**렌더된 문구는 담기지 않는다** — 큐에 쌓인 뒤 이름이 바뀌면 바뀐 이름으로 나간다.

**봉투(플랫폼별 옵션)는 `FcmNotificationSender`가 상수로 붙인다.**

| 플랫폼 | 값 |
|---|---|
| 공통 TTL | 6시간(`NotificationMessageFactory`가 `PushMessage.ttl`로 지정) |
| Android | priority `HIGH` · **채널 id `parfait_default`** · TTL은 밀리초로 환산 |
| APNs | 헤더 `apns-priority: 10` · `apns-expiration`은 **절대 epoch 초** · sound `default` |

⚠️ **채널 id `parfait_default`는 앱이 만들어야 하는 계약이다.** 서버가 이 id를 지정해 보내므로,
Android 8 이상에서 같은 id의 알림 채널이 앱에 없으면 알림이 표시되지 않는다. **앱이 채널을 만들지
않으면 서버가 성공적으로 보내도 사용자는 아무것도 못 본다** — 발송 결과가 `SENT`로 찍혀도 그렇다
→ [미결](#미결).

⚠️ **`notification` 블록이 실려 있으므로 앱이 백그라운드일 때는 시스템이 알림을 직접 표시한다.**
앱 코드가 도는 것은 포그라운드일 때뿐이라는 뜻이고, `data`만 보내는 방식과 계약이 다르다 —
백그라운드 표시 문구를 앱이 가공할 수 없다.

### 발송 직전에 다시 검사한다

큐에 쌓는 것과 보내는 것이 분리돼 있으므로, `NotificationOutboxDispatcher`가 **보내기 직전에 조건을
다시 확인**한다. 아래 셋 중 하나면 **보내지 않고 종료 처리**한다(실패가 아니라 취소다).

| 조건 | 근거 심볼 | 결과 |
|---|---|---|
| 그룹이 사라졌다 | `ParfaitGroupQueryPort.findById`가 널 | 취소(`CANCELLED_GROUP_DELETED`) |
| 수신자가 그룹을 나갔다 | 구성원 조회가 널이거나 `leftAt != null` | 취소(`CANCELLED_RECEIVER_LEFT`) |
| 수신자에게 등록된 기기 토큰이 없다 | `findByMemberId`가 빈 목록 | 취소(`NO_DEVICE_TOKEN`) |

**작성자가 그룹을 나간 경우는 취소가 아니라 문구 치환이다** — 닉네임 자리에 이름을 넣지 않고
`누군가 새 토핑을 쌓았어요`로 바뀐다(위 표).

**즉 알림은 "토핑을 올린 순간"이 아니라 "보내는 순간"의 상태를 반영한다.** 토핑을 올린 직후 그룹이
삭제되면 그 알림은 나가지 않는다.

### 몇 번, 얼마나 늦게 오는가

- **회원의 기기 토큰 전부에 보낸다.** 하나라도 성공하면 그 행은 발송 완료로 본다.
- **최소 한 번(at-least-once) 보장이고, 중복 수신이 가능하다.** 생산 쪽은
  `dedup_key`(`topping-placed:{토핑}:{수신자}` 조합)로 멱등하지만, 발송 자체는 재시도되므로
  **앱은 같은 알림을 두 번 받아도 견뎌야 한다.**
- **지연은 폴링 주기에 걸린다.** `OutboxPollingWorker`가 기본 2초(`notification.outbox.poll-interval-ms`)
  간격으로 돌고, `ToppingPlacedNotificationListener`가 토핑 저장 커밋 직후(`AFTER_COMMIT`) 워커를 즉시
  깨우므로 정상 경로는 거의 즉시다. **깨우는 신호가 유실돼도 다음 폴링이 잡는다.**
- **재시도는 1분 → 5분 → 15분 → 1시간 → 6시간, 최대 5회**(`OutboxBackoff`). 소진하면 그 행은 실패로
  확정되고 **사용자에게도 클라이언트에게도 알리지 않는다** — 서버 로그와 `last_error` 컬럼에만 남는다.
- 재시도 대상은 FCM이 `UNAVAILABLE`·`INTERNAL`·`QUOTA_EXCEEDED`를 주거나 **에러 코드를 아예 주지
  않을 때**(타임아웃·네트워크 오류)다. `FcmNotificationSender`가 코드 미상을 재시도 쪽으로 분류한다.

⚠️ **TTL 6시간이 재시도 일정보다 짧다.** 마지막 두 단계(1시간·6시간)까지 밀린 알림은 FCM 쪽 만료와
겹칠 수 있다. 서버 코드가 이 상호작용을 조정하지 않는다 → [미결](#미결).

## 기기 토큰이 지워지는 세 경로

| 경로 | 지우는 범위 | 근거 |
|---|---|---|
| `POST /api/v1/auth/logout` | 그 **로그인 세션**이 등록한 행(`memberId` + `sessionId`) | `LogoutService`가 `TokenDeletePort.delete` 바로 뒤에서 `DeviceTokenDeletePort.delete` 호출 |
| `DELETE /api/v1/users/me` | 그 **회원의 전 행**(`memberId`) | `MemberService.withdraw`의 `afterCommit`에서 `deleteAllByMemberId` 호출 |
| **푸시 발송 실패(신설)** | **죽은 토큰 한 행**(`token`) | `NotificationOutboxDispatcher`가 `UNREGISTERED`·`INVALID_ARGUMENT`·`SENDER_ID_MISMATCH`를 받으면 `DeviceTokenDeletePort.deleteByToken` 호출 |

앞의 둘은 범위가 다른 것이 의도다 — 로그아웃은 한 세션만 끝내지만 탈퇴는 그 회원의 모든 세션을 정리한다.
**세 번째는 클라이언트 요청과 무관하게 서버가 스스로 걷는 경로**다: 앱을 지웠거나 토큰이 회전돼 무효가
된 기기를 발송 시도가 발견해 회수한다. 없는 토큰을 지워도 예외가 아니다(`deleteByToken`).

⚠️ **세션이 없는 행은 로그아웃이 지우지 못한다.** `sessionId`는 널을 허용하고
(`session_id` 컬럼이 nullable, 클레임 과도기 때문이다), 삭제 조건은 `memberId` **와** `sessionId`를
함께 본다. 클레임 도입 전에 발급된 access token으로 등록하면 `sessionId`가 널인 행이 생기고, **그 행은
로그아웃으로 지워지지 않는다** — 탈퇴이거나 같은 토큰의 재등록(upsert), 또는 위 발송 실패 회수만 그것을
걷는다 → [미결](#미결).

⚠️ **탈퇴 시 정리는 실패해도 탈퇴를 막지 않는다.** `afterCommit` 블록에서 refresh token 정리와 **별개의**
`runCatching`으로 감싸므로, 한쪽이 실패해도 나머지 정리와 탈퇴 자체는 진행되고 로그 경고만 남는다
([member.md](member.md)).

## 저장 스키마

계약 서술에 걸리는 것만 옮긴다(스키마 전체 미러가 아니다).

### `device_token`(Flyway `V17`)

- `token`이 **유니크**(`uk_device_token_token`) — 위 upsert의 근거다.
- `member_id`가 `member(id)` **외래 키** — 회원이 사라지면 남을 수 없다.
- `session_id`는 **널 허용** — 위 경고의 근거다.
- `(member_id, session_id)` 인덱스 — 로그아웃 삭제 조건과 같은 축이다.

### `notification_outbox`(Flyway `V18`, 신설)

발송 의도를 토핑 저장과 **같은 트랜잭션**에 남기는 큐 테이블이다(Transactional Outbox).

- **수신자당 한 행**이고 `dedup_key`가 **유니크**(`uk_notification_outbox_dedup`) — 생산자 멱등의 근거다.
- **외래 키가 없다.** 큐로만 쓰고 참조 무결성은 걸지 않는다 — 그룹·회원이 지워져도 행은 남고, 발송 직전
  재검증이 그것을 취소로 처리한다.
- `payload`가 `LONGTEXT`에 **JSON 문자열**로 들어간다(`NotificationOutboxAdapter`가 Jackson으로 직렬화).
- `status`는 `PENDING`·`SENT`·`FAILED` 세 값이고, 컬럼이 가변 길이 문자열이라 **값을 늘려도 마이그레이션이
  필요 없다** — `OutboxStatus` 주석이 스로틀 정책에서 값을 더할 것이라고 적는다.
- `(status, scheduled_at)` 인덱스로 발송 대상을 고른다. 선점은 `FOR UPDATE SKIP LOCKED`다.
- **종료 상태 행은 영구 보관하지 않는다** — `OutboxRetentionSweeper`가 매일 04:00(Asia/Seoul)에
  기본 7일(`notification.outbox.retention-days`) 지난 `SENT`·`FAILED` 행을 지운다.

⚠️ **운영 DB에 이 테이블이 실제로 생겼는지는 이 회차에서 확인하지 않았다** — 마이그레이션 파일의 존재만
확인했다([conventions.md](conventions.md) "스키마 소유권"이 코드와 운영 스키마가 갈렸던 전례를 적는다).

## 이 계약이 앱에 요구하는 것

서버 코드가 정한 것이라 **앱이 맞추지 않으면 알림이 동작하지 않는 항목**만 모은다.

| 항목 | 요구 | 근거 | 앱(2026-09-05, PR #446·#447) |
|---|---|---|---|
| 알림 채널 | id `parfait_default` 채널을 앱이 생성 | `FcmNotificationSender`의 `ANDROID_CHANNEL_ID` | ✅ `BaseApplication.createPushNotificationChannel` + `PUSH_NOTIFICATION_CHANNEL_ID` — **같은 문자열이다** |
| `data` 파싱 | `type`·`route`·`groupId`·`date` 네 키, 값은 전부 문자열 | `NotificationMessageFactory` | ⚠️ **셋만 읽는다** — `PushDeepLinkIntent.kt`의 extras 키가 `type`·`route`·`groupId`이고 `date`는 어디서도 안 읽힌다 |
| 딥링크 | `route=canvas` + `groupId` + `date`로 캔버스에 도달 | 같은 곳 | ⚠️ `groupId`로만 간다 — `PushDeepLink.AddTopping` KDoc이 **"알림이 가리키던 날짜가 아니라 항상 그 그룹의 최신 캔버스"**라고 못 박는다 → OQ-P-359 |
| 중복 내성 | 같은 알림을 두 번 받아도 부작용이 없어야 함 | at-least-once 보장 | ⚠️ 이동은 견딘다(`Channel(CONFLATED)`) 그러나 **표시는 안 견딘다** — 알림 id가 `message.messageId?.hashCode()`라 재시도로 온 같은 알림이 **알림 두 개**로 쌓인다 → OQ-P-359 |
| 토큰 등록 | 앱 시작·`onNewToken`·권한 허용마다 재호출(실패는 다음 호출이 메움) | `DeviceTokenAdapter.save` 주석 | ✅ **부른다**(PR #450) — 자리는 **세션 축 넷**이다(로그인·가입·앱 진입의 성공 분기 + `onNewToken`). 권한 허용 직후는 **빼고** 세션 쪽으로 옮겼다 — 토큰이 권한과 무관하게 발급되기 때문이다. 실패는 3회 재시도(3초·6초) 뒤 다음 트리거에 맡긴다 |
| (앱 쪽 전제) | Android 13+에서 `POST_NOTIFICATIONS` 런타임 허용 | Android 플랫폼 | ✅ **묻는다**(PR #450) — A-004·A-005 완료 직후 `NotificationPermissionGate`가 안내하고, 영구 거부면 앱 설정으로 보낸다. API 33 미만은 `NotificationPermissionManager`가 **허용으로 본다**(그 아래에서 `checkSelfPermission`이 항상 거부를 답하던 것이 포그라운드 알림을 통째로 버리고 있었다) |

## Android 매핑

✅ **`:data` 표면이 있다(2026-09-03, PR #437 `7019a550`)** — 서버가 표면을 먼저 연 도메인에 앱이 하루
만에 따라붙었다.

| 계약 | Android |
|---|---|
| `POST /api/v1/notifications/devices` | `NotificationService.postNotificationsDevices` — `@NoAuth`를 붙이지 않아 access token이 실린다 |
| 요청 `token`·`platform` | `RegisterDeviceTokenRequest`(`@SerialName` 둘). `platform`은 `NotificationRemoteDataSourceImpl`이 `"ANDROID"` 상수로 채운다 — 호출자가 고를 수 없다 |
| 성공 204·본문 없음 | `ApiCaller.safeApiCallNoContent` — 반환 타입에 envelope를 두지 않는다. `Result<Unit>`으로 나온다 |
| 등록 해제 엔드포인트 없음 | 서비스에도 없다. 로그아웃·탈퇴가 서버에서 대신 지운다는 사실을 KDoc이 가리킨다 |
| **푸시 수신·채널·딥링크** | ~~**대응 심볼 0건**~~ → **셋 다 생겼다**(2026-09-05, PR #446·#447) — 아래 [푸시 수신·딥링크](#푸시-수신딥링크-2026-09-05-pr-446447) |

도메인 모델은 `domain.model.notification.DeviceToken`(`@JvmInline value class`) 하나다.
`upsert`라 반복 호출해도 된다는 계약은 `NotificationRemoteDataSourceImpl`의 KDoc이 받아 적었다.

✅ **손으로 확인할 자리가 생겼다(2026-09-04, PR #451 `2b1dce3a`)** — 앱 코드는 한 줄도 안 바뀌었고
저장소 루트 `http/`에 요청 모음 둘이 들어왔다.

| 파일 | 나가는 곳 | 확인 대상 |
|---|---|---|
| `http/notifications.http` | 우리 서버 | 등록 성공 204·본문 없음, upsert 재호출, 400 4종·401 |
| `http/fcm-test.http` | **FCM v1 API**(서버를 거치지 않는다) | 위 [서버가 보내는 푸시](#서버가-보내는-푸시--토핑-등록-알림)를 재현해 앱 수신을 확인 |

**요청 모음이 앱 코드보다 앞서 나간 첫 도메인이다** — 등록 엔드포인트는 앱 표면이 있어도 부를 수단이
없는데(FCM 토큰 취득 심볼 0건), 이 파일은 토큰을 손으로 넣으므로 **앱 없이도 지금 돌릴 수 있다.**
`fcm-test.http`는 반대로 **받을 쪽이 없어 지금은 절반만 돌아간다** — 발송은 200이지만 채널이 없어
기기에 아무것도 뜨지 않는다.

⚠️ **`fcm-test.http`는 이 문서의 페이로드 표를 상수로 복제한다.** 문구·`data` 키·채널 id·TTL·APNs
헤더가 그 파일에 그대로 적혀 있고, 서버가 값을 바꿀 때 함께 고치는 절차가 없다 — 엔드포인트 커버와
달리 **이 복제는 세는 축이 없다** → [open-questions](../synthesis/open-questions.md) OQ-P-354.

⚠️ **둘 다 실행 기록은 0건이다.** `fcm_access_token`(유효기간 1시간)과 Firebase 서비스 계정 키가
있어야 돌릴 수 있고, 이 회차에 그것을 확보해 쏴 본 적이 없다.

⚠️ **표면뿐이고 결선은 0이다.** 리포지토리도 UseCase도 화면도 없고, 무엇보다 **넣을 토큰을 얻을 수단이
없다** — `FirebaseMessaging`·FCM 토큰 취득 심볼이 develop 전체에 여전히 0건이고 `firebase-messaging`
의존도 없다. 즉 `registerDeviceToken`을 부르는 코드는 하나도 없고, 지금 상태로는 **부를 수도 없다.**

> 🔁 **뒤 문장의 전제가 2026-09-05에 깨졌다** — `firebase-messaging` 의존과 `onNewToken`이 돌아와
> **토큰을 얻을 수단이 생겼다.** 그런데 `registerDeviceToken` 호출부는 **여전히 0건**이다. 즉 판정이
> "부를 수 없다"에서 **"부를 수 있는데 안 부른다"**로 바뀌었다(OQ-P-341 ②). 앞 문단의 `:data` 표면
> 서술 자체는 그대로 옳다.

🔁 **이 공백은 "아직 안 만든 것"이 아니라 "만들었다가 걷어낸 것"이다.** 앱은 FCM 수신 서비스와
토큰 조회·알림 권한 요청을 갖고 있었고, **2026-08-22 PR #325가 그것을 걷어냈다**
([ADR-0013](../adr/0013-firebase-fcm-crashlytics.md)의 철회 정정 — `firebase-messaging` 의존까지 빠졌고
Crashlytics·Analytics만 남았다). **철회 근거가 정확히 이 엔드포인트의 부재였다** — `onNewToken`이
`TODO("서버에 FCM 토큰 전송")`인 채여서 토큰이 로그로만 갔고, 결선된 적 없는 기능 때문에 첫 실행마다
알림 권한을 묻는 상태였다.

⚠️ **이번 서버 delta로 그 공백의 성격이 또 한 번 바뀌었다.** 직전 회차까지는 "앱이 안 보내면 아무 일도
안 일어난다"였는데, 이제는 **서버가 실제로 보내고 있고 받을 앱이 없다.** 등록된 토큰이 0건이라
`NO_DEVICE_TOKEN`으로 전부 취소되므로 **동작 장애는 아니지만**, 앱이 토큰을 등록하는 순간부터는 위
[이 계약이 앱에 요구하는 것](#이-계약이-앱에-요구하는-것)이 곧바로 구속력을 갖는다 — 특히 채널 id를
맞추지 못하면 **보내는 쪽은 성공인데 사용자는 못 보는 상태**가 된다 → OQ-P-341·OQ-P-352.

### 푸시 수신·딥링크 (2026-09-05, PR #446·#447)

✅ **받을 쪽이 생겼다.** `firebase-messaging` 의존과 `app` `push/ParfaitFirebaseMessagingService`가
돌아왔고, 딥링크 축이 새로 붙었다([ADR-0013](../adr/0013-firebase-fcm-crashlytics.md) 되살림 정정 ·
[navigation-flow](../architecture/navigation-flow.md) "푸시 딥링크 이동").

| 계약 | Android |
|---|---|
| 채널 id `parfait_default` | `PUSH_NOTIFICATION_CHANNEL_ID` 상수 — 채널은 `BaseApplication.createPushNotificationChannel`이 앱 시작에 만든다(`IMPORTANCE_HIGH`, 표시 이름·설명은 `strings.xml`의 `notification_channel_default_*`) |
| `notification` 블록이 늘 실린다 | `onMessageReceived`가 `message.notification`이 없으면 **곧장 return** 한다 — `data`-only 페이로드는 처리하지 않는다(KDoc이 그 전제를 적는다) |
| 백그라운드는 시스템이 표시 | 앱이 직접 만드는 알림도 `data`의 키를 그대로 `Intent` extras에 실어 **두 경로의 extras 모양을 맞춘다** |
| `data` 키 `type`·`route`·`groupId` | `PushDeepLinkIntent.kt`의 `EXTRA_TYPE`·`EXTRA_ROUTE`·`EXTRA_GROUP_ID` → `PushDeepLinkParser.parse` |
| `data` 키 `date` | **읽는 코드가 없다** → OQ-P-359 |
| `route=canvas` | `PushDeepLink.AddTopping(groupId)` → `NavKeyCanvasMain(groupId)` — **날짜 인자가 없어 최신 캔버스로 간다** |
| `route=group` | `PushDeepLink.GroupList(type)` → `NavKeyGroupList`. **서버에 이 값을 보내는 코드가 없다**(트리거 1종) → OQ-P-361 |
| 두 `route` 다 로그인 필요 | 이동 전에 `HasActiveSessionUseCase`가 세션을 확인하고 없으면 **딥링크를 버린다** — 로그인을 마쳐도 이어가지 않는다(브랜치 `feature/#454-push-deep-link-edge-case`, develop 미머지) |
| `type` 값 3종 | `PushNotificationType`(`TOPPING`·`REMIND_AM`·`REMIND_PM`). **라우팅에 쓰지 않는다** — 목적지는 `route`가 정하고 `type`은 탭 분석 용도로만 실린다. 모르는 값은 `null`이라 파싱이 실패하지 않는다 |

**전달 통로는 세션 종료 이동과 같은 모양이다** — `:domain`의 `PushDeepLinkEventBus`(발행·구독 겸용
인터페이스)와 `:data`의 `PushDeepLinkEventBusImpl`(`Channel(CONFLATED)` + `receiveAsFlow()`)이고,
**수집은 앱 루트 `MainRoute` 한 곳**이다. 발행은 `MainActivity`가 하며 `onCreate`와 `onNewIntent`
(`launchMode="singleTop"`) 양쪽을 덮고, 소비한 `Intent`는 `setIntent(Intent())`로 비운다 — 안 비우면
구성 변경으로 `onCreate`가 다시 돌 때 같은 딥링크를 또 발행한다.

🔁 **여기 있던 두 경고를 걷었다 — 둘 다 낡았다.** ① 권한을 묻는 자리는 PR #450이 붙였다
(`NotificationPermissionGate`, A-004·A-005 완료 직후 — OQ-P-358은 그때 해소됐다). ② 콜드 스타트에서
딥링크와 스플래시 백스택 리셋이 겹치는 구간은 **닫혔다** — 수집이 스플래시 이탈을 기다린 뒤 소비하고,
그 자리에서 세션도 함께 본다(OQ-P-360 ①③ 해소, ② 잔존).
⚠️ **②의 수정은 브랜치 `feature/#454-push-deep-link-edge-case`에만 있고 develop에 없다.**

### 기기 토큰 등록 결선 (2026-09-05, PR #450)

✅ **표면이 실제로 불린다.** 설계 정본은
[push-notification-permission-and-device-token 스펙](../specs/archive/2026-09-05-push-notification-permission-and-device-token.md),
계층 배치는 [data-layer](../architecture/data-layer.md) 「기기 토큰 등록」.

| 계약 | Android |
|---|---|
| 반복 호출이 안전한 upsert(`token`이 유일 키) | 부르는 자리가 **넷**이다 — `LoginWithKakaoUseCase`·`SignUpUseCase`(성공 분기) · `BootstrapSessionUseCase`(`refreshMyAccount` 성공 분기만) · `ParfaitFirebaseMessagingService.onNewToken`. **그 반복이 곧 실패 복구 수단**이라 "등록됨" 영속 플래그도 WorkManager도 두지 않았다 |
| 같은 신규 토큰의 동시 요청은 유니크 제약 위반으로 500 | `DeviceTokenRegistrarImpl`이 `Mutex`로 막는다. 진행 중이면 두 번째 호출은 **대기하지 않고 그냥 돌아간다** |
| 인증 필요(화이트리스트 밖) | 세션이 없는 경로에서는 부르지 않는다 — 신규 회원 로그인 분기, 필수 약관 미동의, 저장된 토큰이 없는 부트스트랩 |
| `platform` 은 앱이 고정 | 종전대로 `NotificationRemoteDataSourceImpl`이 `"ANDROID"` 상수로 채운다 |
| 로그아웃이 `(memberId, sessionId)` 로 매핑을 지운다 | 세션마다 재등록하므로 옛 세션 행이 남지 않는다 — 재로그인이 곧 재등록이다 |

**`onNewToken` 도 전달받은 값을 쓰지 않고 같은 진입점을 탄다** — 등록구가 지금 값을 다시 읽으므로
결과가 같고, 같은 뮤텍스를 타야 세션 축과 겹치지 않는다. 토큰 계약은 이 라운드에 **비널로 좁혀졌다**
(`DeviceTokenProvider.currentToken(): DeviceToken`) — `getToken()` 이 미발급을 값이 아니라 `Task`
실패로 주므로 `null` 분기가 도달하지 않는 경로였다.

⚠️ **실서버·실기기 확인은 여전히 0회다.** `http/notifications.http` 도 이 회차에 돌리지 않았고,
등록이 실제로 204를 받는지, 발송이 `NO_DEVICE_TOKEN` 을 벗어나는지 확인된 바 없다.

⚠️ **쓰고 있는 FCM API 셋이 deprecated 다**(`getToken()`·`deleteToken()`·`onNewToken()`). 대체는 FID
기반이고 **서버 Admin SDK 가 9.10.0 이상이어야 `setFid` 가 있다** — 앱만 옮기면 모든 발송이 실패하므로
등록 토큰 축에 남는다 → [open-questions](../synthesis/open-questions.md) OQ-P-362.

## 미결

- ~~2026-08-22에 걷어낸 FCM 축을 되살릴지~~ → **되살렸다**(2026-09-05, PR #446·#447 — [ADR-0013](../adr/0013-firebase-fcm-crashlytics.md)
  되살림 정정). ~~남은 것은 **등록 호출 시점**이다~~ → ✅ **답해졌다**(PR #450, 세션 축 넷) — OQ-P-341 해소
- ~~앱이 `POST_NOTIFICATIONS` 런타임 허용을 **묻지 않아** Android 13+에서는 표시 단계에서 막힌다~~
  → ✅ **묻는다**(PR #450, A-004·A-005 완료 직후) — OQ-P-358 해소. 다만 **노출 횟수 정책이 없어**
  허용 전까지 그룹 생성·참여 흐름마다 다시 뜬다 → [open-questions](../synthesis/open-questions.md) OQ-P-370
- 앱이 `date`를 버리고 항상 최신 캔버스로 열며, 중복 수신이 **알림 두 개**로 쌓인다 — 위
  [이 계약이 앱에 요구하는 것](#이-계약이-앱에-요구하는-것)의 ⚠️ 셋
  → [open-questions](../synthesis/open-questions.md) OQ-P-359
- 앱이 서버에 없는 알림 둘(P-02·P-03 리마인드, `route=group`)을 먼저 구현했고 그 근거인
  "FCM 페이로드 스펙 v1"이 **어느 저장소에도 없다** → [open-questions](../synthesis/open-questions.md) OQ-P-361
- 세션 없는(`session_id` 널) 행을 로그아웃이 못 지우는 구간을 서버가 닫을지, 앱이 재등록으로 덮을지
  → [open-questions](../synthesis/open-questions.md) OQ-P-342
- 알림 종류가 토핑 등록 1종뿐이고(커밋 제목의 "3종"과 어긋난다), 수신 설정·권한 요청 시점도 없다
  → [open-questions](../synthesis/open-questions.md) OQ-P-343
- 문구·`data` 스키마·채널 id·딥링크 목적지가 **서버 코드에만 있고 정책 근거가 없다** — 위키 정책 소스에
  알림 항목 자체가 없다 → [open-questions](../synthesis/open-questions.md) OQ-P-351
- 앱이 채널 `parfait_default`를 만들지 않으면 발송이 성공해도 표시되지 않는데, 그 합의를 확인할 수단이
  양쪽 어디에도 없다 → [open-questions](../synthesis/open-questions.md) OQ-P-352
  (2026-09-04 갱신 — `http/fcm-test.http`가 **불일치를 재현하는 요청**을 갖췄다. 다만 앱에 수신부가
  없어 아직 돌려서 확인할 수 없고, 상수 자체를 대조하는 자동 검사는 여전히 양쪽에 없다)
- `fcm-test.http`가 서버 발송 페이로드를 앱 저장소에 복제해 두 번째 정본처럼 보인다
  → [open-questions](../synthesis/open-questions.md) OQ-P-354
- TTL 6시간과 최대 6시간짜리 재시도 백오프가 겹쳐, 늦게 재시도된 알림이 만료와 경합한다
  → [open-questions](../synthesis/open-questions.md) OQ-P-353
