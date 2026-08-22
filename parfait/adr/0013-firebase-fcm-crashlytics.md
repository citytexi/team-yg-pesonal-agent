---
id: ADR-0013
title: Firebase 도입 — FCM 푸시 + Crashlytics + Analytics
status: accepted
date: 2026-07-18
deciders: Parfait 팀
supersedes:
superseded_by:
related_adr: ADR-0014
related_spec:
related_architecture:
platforms: android
tags: [adr, parfait]
---
# ADR-0013: Firebase 도입 — FCM 푸시 + Crashlytics + Analytics

> 상태·날짜·결정자·대체 관계는 위 frontmatter가 단일 출처. 본문은 결정 내용에 집중.

## 맥락
캔버스 마감·초대 등 이벤트를 사용자에게 푸시로 알릴 필요가 있고([[캔버스-마감-스케줄]] 등 기획 유스케이스), 출시 후 크래시·사용 지표를 수집할 수단이 없었다. 푸시·크래시 리포팅·기초 애널리틱스의 제공자를 정해야 했다.

## 결정
**Firebase**를 도입해 **Cloud Messaging(FCM) 푸시 + Crashlytics 크래시 리포팅 + Analytics**를 앱에 통합한다(PR #139 `feature/firebase-setup`).

- 의존은 **`app` 모듈에 집중**. `app/build.gradle.kts`에서 `firebase-bom`(BoM) + `firebase-analytics`·`firebase-messaging`·`firebase-crashlytics`를 붙이고, Gradle 플러그인 `com.google.gms.google-services`·`com.google.firebase.crashlytics`를 적용(루트 `build.gradle.kts`는 `apply false`로 선언만). 버전은 `gradle/libs.versions.toml`(`firebase-bom`·`firebase`·`firebase-crashlytics` + 별칭 `google-firebase`·`google-firebase-crashlytics`).
- **FCM 수신**: `app`의 `fcm/YGFirebaseMessagingService`(`FirebaseMessagingService` 상속). `onMessageReceived`에서 알림 권한 확인 후 `NotificationCompat`로 `CHANNEL_ID = "fcm_default_channel"` 채널에 표시. 토큰 로그는 [[0014-logging-abstraction-kermit|Logger]] 사용(`fcmLogger`).
- **토큰 서버 전송은 후속**: `onNewToken`은 현재 `TODO("서버에 FCM 토큰 전송")` — 원격 연동이 준비되면 구현(원격 네트워킹 자체가 후속 과제, [[data-layer]]).

> 🔁 **FCM 축이 철회됐다 (2026-08-22, PR #325 `refactor/#316-remove-fcm-and-notification-permission` develop 머지).**
> 위 결정 셋 중 **Cloud Messaging만 걷혔고 Crashlytics·Analytics는 그대로**다. 사라진 것은
> `app`의 `fcm/YGFirebaseMessagingService`·`Logger.kt`(`fcmLogger`·`tokenLogger`)·`MainActivity`의
> 토큰 조회와 알림 채널 생성·권한 요청, 매니페스트의 서비스 등록과 `POST_NOTIFICATIONS`,
> 그리고 `firebase-messaging` 의존(`app/build.gradle.kts`·`gradle/libs.versions.toml`)이다.
> `firebase-bom`·`firebase-analytics`·`firebase-crashlytics`와 두 Gradle 플러그인은 남는다.
>
> **철회 근거는 "쓰이지 않았다"** 하나다 — `onNewToken`이 서버에 닿은 적이 없어 토큰은 로그로만
> 갔고(위 "토큰 서버 전송은 후속"이 그대로 남아 있었다), 권한과 채널은 오직 그 서비스가 알림을
> 띄우려고 존재했다. 그 상태로 두면 **결선된 적 없는 기능 때문에 첫 실행마다 알림 권한을 묻는다**는
> 것이 걷어낸 이유다. 즉 "푸시는 그룹 협업 앱에서 사실상 필수"라는 위 [대안](#대안) 절의 판단이
> 뒤집힌 것이 아니라, **결선 없는 껍데기를 출시 경로에서 뺀 것**이다. 푸시를 실제로 붙일 때
> 되살릴 결정이므로 이 ADR을 폐기하지 않고 여기 정정으로 남긴다.
>
> 되살릴 때 다시 정해야 하는 것: 토큰 라이프사이클(등록·갱신·로그아웃 시 폐기)과 알림 권한을
> **언제 묻는가**다. 지금 걷어낸 형태는 `MainActivity.onCreate`에서 무조건 묻는 것이었고,
> 그 시점은 사용자가 알림이 무엇에 쓰이는지 알기 전이다.

## 대안
- **푸시 미도입(로컬 알림만)** — 외부 SDK·GMS 의존 회피. 그러나 서버발 이벤트(마감·초대) 푸시 불가로 핵심 UX 결손.
  **→ 기각:** 그룹 협업 앱에서 푸시는 사실상 필수.
- **크래시/애널리틱스 별도 제공자(Sentry 등) 조합** — 도구별 최적. 그러나 SDK·대시보드 이원화, FCM은 어차피 Firebase 필요.
  **→ 기각:** 이미 세그멘테이션에서 GMS 의존([[0012-mlkit-subject-segmentation]]) → Firebase 단일 스택이 운영 단순.

## 영향

**긍정**
- 푸시·크래시·기초 지표를 단일 콘솔에서 운영. BoM으로 버전 정합 자동.
- Firebase 의존이 `app` 모듈에만 있어 `core/data/domain`은 SDK에 비노출(경계 유지).

**트레이드오프**
- **GMS(Play services) 의존** — GMS 없는 기기에서 푸시·일부 기능 제약(세그멘테이션과 동일 제약).
- `google-services.json`(Firebase 프로젝트 설정 파일) 필요 — 빌드·CI에 비밀 관리 부담. **public repo 커밋 금지** 대상.
- FCM 토큰 라이프사이클(서버 전송·갱신) 미완 → 실제 타겟 푸시는 원격 연동 이후.

**위험·방어**
- 알림 표시 전 `NotificationManagerCompat.areNotificationsEnabled()` 확인, `onMessageReceived`에 `@RequiresPermission(POST_NOTIFICATIONS)` 명시.
- 토큰 서버 전송 미구현은 코드 `TODO` + 본 ADR에 명시 → [open-questions](../synthesis/open-questions.md)에서 추적.

> 🔁 **위 트레이드오프·방어 중 FCM에 걸린 것은 2026-08-22 부로 대상이 사라졌다**(PR #325, 위
> [결정](#결정) 절의 철회 정정). 알림 표시 방어 둘은 코드째 없어졌고 토큰 라이프사이클 미완도
> 추적할 대상이 없다(OQ-P-012 해소). **남는 것은 GMS 의존과 `google-services.json`**이다 —
> 전자는 세그멘테이션([[0012-mlkit-subject-segmentation]])이 같은 의존을 이미 지고 있어 FCM이
> 빠져도 그대로이고, 후자는 Analytics·Crashlytics가 계속 요구한다.
