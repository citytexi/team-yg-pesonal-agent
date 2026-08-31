# API 계약 문서

서버(`mash-up-kr/TEAMYG-SERVER`)가 제공하는 API 계약의 **스냅샷**과 TJYG-Android의 **적용 상태**를 함께 둡니다.

> **정본은 서버 코드**입니다. 이 디렉토리는 미러이고, 어긋나면 서버가 옳습니다
> (파르페 SoT 우선순위 "코드 > wiki > CLAUDE.md"와 동형).
>
> 추적 브랜치는 서버 **`main`** — 기준 커밋과 갱신 절차는 [server-baseline.md](server-baseline.md).

## 전역 계약
- [conventions.md](conventions.md) — 응답 envelope(**204 예외 2건**)·성공/에러 코드 체계(전역 405 포함)·인증·URL 규약·직렬화 규약·**전송**(2026-08-25 — 서버가 HTTPS 도메인으로 옮겨 가고 평문 포트는 닫힌다)·**Android 불일치**(2026-08-20 기준 **0건** — 그룹 목록 업로드 시각 파싱과 "오늘"의 경계 둘 다 닫혔다)

## 팀 명세 원문
- [spec/](spec/README.md) — 서버팀이 작성한 **API 명세**를 텍스트로 옮긴 것. 이 디렉토리의 도메인 문서가
  **코드의 미러**라면 `spec/`은 **팀이 합의한 의도**입니다. 코드에서 읽을 수 없는 계약(클라이언트 측 책임,
  값의 생성 주체), 명세에만 있는 미구현 항목, 값의 의미가 여기 있습니다. 각 명세 문서는 `## 코드 대조`
  절에서 **일치 / 코드에만 / 명세에만**을 갈라 적습니다.
  - [spec/auth-kakao-login.md](spec/auth-kakao-login.md) — 카카오 로그인/회원가입
  - [spec/auth-signup.md](spec/auth-signup.md) — 회원가입 완료(약관동의)
  - [spec/auth-reissue.md](spec/auth-reissue.md) — 토큰 재발급
  - [spec/auth-logout.md](spec/auth-logout.md) — 로그아웃

## 도메인 계약
| 문서 | 서버 위치 | 엔드포인트 | Android |
|---|---|---|---|
| [auth.md](auth.md) | `http/auth` | 5 (카카오 로그인 · **애플 로그인** · 회원가입 완료 · 토큰 재발급 · 로그아웃) | **결선됨**(애플 해당 없음, 나머지 4 전부 호출부 있음) |
| [policy.md](policy.md) | `http/auth` | 1 (현재 유효 약관 목록) | 구현됨 |
| [parfait-group.md](parfait-group.md) | `http/parfaitgroup` | 8 (목록 · 상세 · 참여 미리보기 · 참여 · 생성 · 닉네임 변경 · 탈퇴 · 신고) | **결선됨**(8 전부 호출부 있음, 불일치 0건) |
| [parfait.md](parfait.md) | `http/parfait` | 5 + 테스트 전용 1 (연도 리스트 · 오늘의 캔버스 · 과거 목록 · **상세 조회** · **배경 변경** / 테스트 회전) | **결선됨**(회전 해당 없음, 5 전부 호출부 있음, 불일치 0건 — 다만 2026-08-31 과거 목록에 붙은 `status`를 앱 DTO가 안 받는다) |
| [image.md](image.md) | `http/image` | 2 (업로드 URL 발급 · 업로드 확인) | **결선됨**(2 전부 호출부 있음) |
| [member.md](member.md) | `http/member` | 3 (내 계정 조회 · 전역 닉네임 변경 · **탈퇴**) | **결선됨**(3 전부 호출부 있음) |
| [parfait-image.md](parfait-image.md) | `http/parfaitimage` | 5 (토핑 배치 확정 · 위치/크기/각도 수정 · **일괄 수정** · **테두리 수정** · **삭제**) | 구현됨(**네 갈래 결선됨** — 배치 확정·삭제·위치/크기/각도 수정·테두리 수정 / **일괄 수정은 표면 없음**) |

**총 29 엔드포인트 + 테스트 전용 1**(2026-08-31, 서버 `de3a99a` — **일곱 라운드 만에 하나 늘었다**).
**Android 표면은 27/28, 공백 1이다** —
분모에서 애플 로그인 1(`해당 없음`)을 뺀 값이 28이고, 테스트 전용 회전 1은 총계에서 이미 분리했다.
공백 1은 2026-08-31 신설된 **토핑 일괄 수정 PATCH**다.
서버 delta가 벌린 공백 2(파르페 상세 조회·배경 변경)를 **같은 날 PR #266이 닫았다**
([spec](../specs/archive/2026-08-16-canvas-detail-background-api-service-layer.md)).

> **`구현됨`은 `:data`에 Service·DataSource 표면이 있고 계약과 일치한다는 뜻**이다(2026-08-06, PR #197
> develop 머지).
>
> ✅ **2026-08-15 — 소비처가 생겼다.** 다섯 라운드(PR #241·#242·#243·#244·#248)가 **8 엔드포인트를
> 화면까지** 이었다 — 카카오 로그인·회원가입(auth), 약관 목록(policy), 그룹 목록·생성·참여 미리보기·참여·
> 닉네임 변경(parfait-group). `policy.md`는 유일한 엔드포인트가 전부 소비돼 **`android_status: done`**이고
(2026-08-18 PR #296으로 소비 화면이 온보딩·설정 둘이 됐다 — 응답의 `title`·`url`이 웹뷰 목적지 인자로 나간다),
> `parfait-group.md`(상세·탈퇴·신고 미소비)는 `partial`이다. 나머지 넷
> (parfait·image·member·parfait-image)은 여전히 표면만 있고 소비처가 0이다(**member는 2026-08-16에 닫혔다** — 아래).
>
> ✅ **2026-08-15 — `auth.md`가 `done`이 됐다**(PR #260). `reissue`는 `TokenAuthenticator`가, `logout`은
> `AuthRepository.logout()` → `LogoutUseCase` → S-001 앱 설정이 소비한다. 애플을 뺀 4 엔드포인트 전부가
> 호출부를 가지므로 **소비처를 얻은 엔드포인트는 10건**이 됐다
> ([스펙](../specs/archive/2026-08-15-session-token-refresh-infra.md)).
>
> ✅ **2026-08-16 — `member.md`에 첫 소비처가 생겼다**(PR #263). `GET /api/v1/users/me`와
> `PATCH /api/v1/users/me/nickname`이 `MemberRepository` → UseCase 3종 → S-001·S-002·스플래시
> 부트스트랩까지 이어졌다. **소비처를 얻은 엔드포인트는 12건**이고, 표면만 있고 소비처가 0인 도메인은
> **셋**(parfait·image·parfait-image)으로 줄었다. `member.md`는 **탈퇴만 미소비**라 `partial` 그대로다
> ([스펙](../specs/archive/2026-08-15-user-info-ssot.md)).
>
> ⚠️ **2026-08-16 — `parfait.md`에 표면을 우회하는 소비자가 생겼다**(PR #259). C-201 캘린더의 UseCase
> 둘이 파르페 조회 두 엔드포인트를 KDoc으로 가리키면서 remote DataSource를 안 쓰고 mock을 만든다.
> `android_status`는 `partial` 그대로다(소비처가 계약을 타지 않는다) → [parfait.md](parfait.md) Android 매핑.
> **실서버 요청 검증은 아직 0건**(실기기 미수행) → [open-questions](../synthesis/open-questions.md).
>
> `image.md`(2026-08-10 신설) · `member.md`·`parfait-image.md`(2026-08-11 신설)도 **2026-08-12 PR #230
> 머지로 표면을 얻어** `android_status: partial`이 됐다 — 앞의 넷과 같은 뜻이다(표면은 있고 소비처는 없다).
>
> ✅ **카카오 로그인 판별자 키 불일치는 해소됐다**(2026-08-15, PR #241) — `@SerialName("isNewUser")` 정정 +
> 와이어 계약 테스트([auth.md](auth.md) "판별자 키"). 같은 라운드가 이 엔드포인트를 **소비처까지** 이었다.
>
> ✅ **2026-08-15(PR #250) — 표면 공백이 다시 0이 됐다.** 서버 delta가 벌린 신규 5건(파르페 오늘·과거,
> 토핑 테두리·삭제, 회원 탈퇴)이 Service·remote DataSource·domain VO까지 한 라운드에 들어왔다
> ([spec](../specs/archive/2026-08-15-parfait-canvas-topping-member-api-service-layer.md)).
> `parfait`·`member`·`parfait-image` 세 도메인의 Android 열이 전부 `구현됨`이 됐고, `android_status`는
> 셋 다 `partial` 그대로다 — **소비처가 0건**이기 때문이다(`done`은 화면까지 이어졌을 때 쓴다).
>
> ⚠️ **새 불일치 1건**(2026-08-15) — 그룹 목록의 `recentImageUploadedAt`을 앱이 오프셋 필수 파서로 읽는데
> 서버는 오프셋 없이 내려준다. 대응 심볼이 있는데 계약과 어긋나므로 `parfait-group.md`의 GET
> `/api/parfait-groups` 행이 **`⚠️불일치`**였다([conventions.md](conventions.md) "Android 불일치").
> ✅ **2026-08-20에 닫혔다**(PR #310) — 매퍼가 `LocalDateTime::parse` + `toInstant(PARFAIT_TIME_ZONE)`로
> 바뀌어 그 행은 `구현됨·결선됨`이 됐다.
>
> 🔁 **2026-08-15 2차 서버 delta(`e4ff23f`) — 엔드포인트 증감 0, 규칙 변경 3건.** 초대코드 자릿수 8 → 6
> (앱은 처음부터 6이라 **드러나지 않던 불일치가 서버 쪽에서 닫혔다**), 닉네임 정규식에 자모 허용 추가,
> 그룹 내 닉네임 중복 검사 제거로 `GROUP_NICKNAME_ALREADY_USED` 삭제. 셋 다 요청/응답 형태는 그대로라
> Android 열 값은 바뀌지 않는다.
> ✅ **뒤의 둘은 같은 날 PR #250이 앱에 반영했다** — `CheckNameValidUseCase`가 자모 범위를 얻어 집합이
> 다시 같아졌고, `ALREADY_USED` 계열(상수·enum·문구·분기)은 걷혔다. **남은 것은 정책 문서 공백**이다
> → [open-questions](../synthesis/open-questions.md).
>
> 🔁 **2026-08-16 서버 delta(`22717fe`) — 파르페 상세 조회·배경 변경 2건이 들어와 공백이 다시 벌어졌다**
> (26 → 28, 표면 25/27). **가장 큰 의미는 배경 쓰기 경로다** — C-301 배경 편집이 고른 값을 버리던 이유의
> 서버 절반(`background_type`·`background_value`에 쓰는 API 부재)이 닫혔다. 상세 조회는 응답이
> `GetTodayParfaitResponse` **재사용**이라 앱 DTO·VO·매퍼가 이미 있고 Service·DataSource 함수만 붙이면
> 된다 → [parfait.md](parfait.md).
>
> ✅ **2026-08-16 — 그 공백이 같은 날 닫혔다**(PR #266). 서버 delta와 앱 대응이 하루 안에 붙은 첫 사례라
> **표면 왕복이 가장 짧게 끝났다**(직전 라운드는 서버 `36ecd1c` → PR #250까지 벌어져 있었다). 배경 변경은
> 이 도메인 첫 쓰기 경로여서 **첫 요청 DTO**와 쓰기 전용 도메인 모델 `CanvasBackgroundEdit`이 함께 들어왔다 —
> 이미지 배경이 **쓸 때 `imageId`·읽을 때 URL**이라 읽기 모델을 되돌려 보낼 수 없기 때문이다.
> `android_status`는 `partial` 그대로다(**소비처가 여전히 0건**) → [parfait.md](parfait.md) Android 매핑.
>
> ✅ **2026-08-17 — `parfait.md`에 첫 소비처가 생겼다**(PR #268). `ParfaitRepository` → UseCase 둘 →
> C-001 캔버스 메인이 **오늘 조회·과거 목록·상세** 셋을 소비한다(연도 조회·배경 변경은 미소비).
> **소비처를 얻은 엔드포인트는 15건**이고, 표면만 있고 소비처가 0인 도메인은 **둘**(image·parfait-image)로
> 줄었다. `android_status`는 **`partial` 그대로**다. 같은 도메인의 **표면 우회 소비자(캘린더 mock
> UseCase 둘)는 그대로**라, 이제 한 화면 안에서 캔버스 조회는 계약을 타고 달력 조회는 안 탄다
> → [parfait.md](parfait.md) Android 매핑 ·
> [스펙](../specs/archive/2026-08-17-c001-canvas-today-detail.md).
>
> ✅ **2026-08-17 — 표면 우회 소비자가 사라졌다**(PR #279). C-201 캘린더의 UseCase 둘이 mock을 버리고
> `ParfaitRepository`를 타면서 **연도 조회까지 소비처를 얻었다** — 이 도메인에서 미소비로 남은 것은
> **배경 변경 하나**다. **소비처를 얻은 엔드포인트는 16건**이고 `android_status`는 `partial` 그대로다.
> 2026-08-16에 열렸던 "소비자가 표면을 우회한다"는 상태가 **하루 만에 닫혔다**
> → [parfait.md](parfait.md) Android 매핑 ·
> [스펙](../specs/archive/2026-08-17-c201-canvas-calendar-server.md).
>
> ✅ **2026-08-17 — `parfait-group.md`가 `done`이 됐다**(PR #285·#287). S-101 그룹 설정이 상세 조회·
> 나가기·신고를 소비해 **8 엔드포인트 전부 호출부를 얻었다**(닉네임 변경은 S-102와 공용). Repository에
> 남겨 뒀던 세 갈래가 "화면이 요구할 때 올린다"는 방침대로 이때 올라왔다. **소비처를 얻은 엔드포인트는
> 19건**이다. `done`은 소비 여부만 뜻한다 — 목록의 `recentImageUploadedAt` 파싱 불일치는 **그대로**다
> ([conventions.md](conventions.md) "Android 불일치") → [parfait-group.md](parfait-group.md) Android 매핑 ·
> [스펙](../specs/archive/2026-08-17-s101-group-setting-api.md).
>
> 🔁 **2026-08-18 서버 delta(`08df1bf`) — 엔드포인트 증감 0인데 응답이 넓어지고 "오늘"이 바뀌었다.**
> ① **Nametag-Chip 부여 주체가 서버가 됐다** — 그룹 참여·생성 시 그룹 안에서 겹치지 않는 타입을 뽑고
> 탈퇴 시 `RELEASED`로 반납한다. 응답 필드 셋이 늘었다(그룹 상세 `members[].nametagChip`, 그룹 목록
> `lastPlacedByNametagChip`, 캔버스 `placedBy.nametagChip`).
> 🔁 **이 문단의 필드 키와 반납 값 이름은 2026-08-19에 바뀌었다 — 아래 항목이 정본이다.**
> **앱은 세 화면이 각자 인덱스로 색을
> 돌리고 있어** 그 규칙을 버릴 수 있게 됐다 → [parfait-group.md](parfait-group.md) "Nametag-Chip 배정 규칙".
> ② **그룹 상세가 `groupName`·`memberLimit`을 싣는다** — 앱이 목록을 한 번 더 읽어 이름을 붙이던 조합과
> "N명 남음" mock 1이 **둘 다 서버에서 닫혔다**(OQ-P-139·OQ-P-216).
> ③ ⚠️ **"오늘"이 자정이 아니라 03시 경계가 됐다**(`ParfaitDay`). 앱은 자정 기준이라 00:00~03:00 KST에
> 오늘 조회가 두 번 돌고 화면이 D−1 캔버스를 D 아래 그린다 — **불일치 2건째**
> → [parfait.md](parfait.md) "하루 경계".
> 새로 읽어야 할 필드가 넷이지만 **`http/` 요청 모음의 커버는 그대로 25/27**이다(엔드포인트가 안 늘었다).
>
> 🔁 **2026-08-19 서버 delta(`57529ec`) — 직전 라운드의 뒷정리 둘이 들어왔고, 그 과정에서 JSON 키가 바뀌었다.**
> ① **Nametag-Chip 정합성** — `groupMembers[].nameTagChip`(C-001 상단 멤버 칩이 계약 안으로)·토핑 배치 응답
> `placedBy.nameTagChip`이 더해지고, 목록의 `recentImageUploadedAt`·`lastPlacedByNameTagChip`이
> `COALESCE`로 **비널**이 됐다(토핑 0건 그룹은 생성 시각·생성자 칩). 반납 값 이름이 `RELEASED` → `DEFAULT`.
> 그룹 **생성** 응답도 목록의 세 필드를 얻었다.
> ⚠️ **응답 JSON 키가 `nametagChip` → `nameTagChip`, `lastPlacedByNametagChip` → `lastPlacedByNameTagChip`으로
> 바뀌었다**(서버 코어 프로퍼티명은 그대로, HTTP DTO 경계에서만) — develop은 이 필드를 안 읽어 무해하지만
> 그 필드를 옛 키로 읽던 코드는 값이 조용히 `null`이 됐다(✅ 2026-08-20 PR #310 머지로 정정).
> ② **하루 경계가 서버 안에서 통일됐다** — 과거 목록의 `to` 기본값도 `ParfaitDay.current()`가 됐다.
> ✅ 앱과의 불일치도 2026-08-20에 닫혔다(PR #308이 `parfaitToday()`를 03시로 옮겼다).
> ③ **전역 405가 생겼다**(`CommonErrorCode.METHOD_NOT_ALLOWED`) — 그전에는 메서드 불일치가 500이었다.
> ④ **탈퇴 후 재가입 500 수정**(`provider_user_id` tombstone rename이 flush를 못 타던 버그,
> [member.md](member.md)). 엔드포인트·화이트리스트·`ApiResponse`는 불변이고 **표면 셈도 27/27·25/27 그대로**다.
>
> ✅ **2026-08-19 — `member.md`가 `done`이 됐다**(PR #306). S-001 앱 설정의 탈퇴 확인이
> `WithdrawUseCase`를 불러 **3 엔드포인트 전부 호출부를 얻었다**. **소비처를 얻은 엔드포인트는 20건**
> 이고, 표면만 있고 소비처가 0인 도메인은 여전히 **둘**(image·parfait-image)이다. 이 도메인에 남는
> 물음은 소비 여부가 아니라 **성공 뒤 정리 경로**다 — 탈퇴 직후의 로그아웃 요청이 죽은 토큰으로 나가
> 재발급·강제 로그아웃까지 깨운다 → [member.md](member.md) Android 매핑 ·
> [open-questions](../synthesis/open-questions.md) OQ-P-242.

> 🔁 **2026-08-20 서버 delta(`efbf98f`) — 엔드포인트도 필드도 안 늘고 실패 경로만 늘었다.**
> 쓰기 다섯 경로(배경 변경 + 토핑 배치·수정·테두리·삭제)가 대상 캔버스의 `status`를 읽어 `ACTIVE`가
> 아니면 **409 `PARFAIT_ALREADY_CLOSED`**로 거부한다. 그전에는 03시 회전 직후 마감된 캔버스에 쓰기가
> **200으로 성공하고도** 뒤이은 `today` 조회가 새 캔버스를 줘서 편집이 사라진 것처럼 보였다.
> **"마감 후 편집을 서버가 막을지 앱 책임으로 둘지"라는 두 라운드 묵은 물음에 서버가 답한 것**이고,
> 그 김에 토핑 수정·테두리·삭제 셋이 파르페 존재·그룹 소속 검사(404 `PARFAIT_NOT_FOUND`)를 처음 얻었다
> → [parfait.md](parfait.md) · [parfait-image.md](parfait-image.md).
> ⚠️ **앱은 이 코드를 모른다** — `ServerErrorCode`에 상수가 없고, 다섯 경로 전부 소비처가 0건이라
> 지금은 도달하지 않는다. 대신 **"서버가 마감 캔버스를 막지 않는다"고 단정한 앱 주석 일곱 곳이
> 거짓이 됐다**(요청·응답 형태는 그대로여서 `⚠️불일치`는 아니다)
> → [open-questions](../synthesis/open-questions.md).
>
> ✅ **2026-08-20 — 계약 delta 없이 Android 쪽만 크게 움직였다**(PR #307·#308·#310 develop 머지).
> 서버 기준선은 `57529ec` 그대로이고 **엔드포인트·화이트리스트·envelope 모두 불변**이다. 바뀐 것은
> 앱이 그 계약을 얼마나 읽는가다 — ① **"Android 불일치"가 2건에서 0건이 됐다**(`recentImageUploadedAt`
> 파싱 · 하루 경계 03시), ② 2026-08-18~19 delta가 더한 필드 대부분이 화면까지 닿았다
> (`groupName`·`memberLimit`·칩 세 자리 중 둘), ③ 그룹 목록·상세 **읽기가 `Flow` 구독으로 바뀌었다**
> (엔드포인트는 그대로, 응답을 두는 자리만 `:data` 캐시로 이동 — [ADR-0023](../adr/0023-group-in-memory-ssot.md)).
> **`android_status`는 어느 도메인도 바뀌지 않았다** — 소비처 셈이 그대로이기 때문이다
> (`parfait-group` `done` · `parfait`·`parfait-image` `partial`). 남은 미소비 필드는 둘이고 성격이 다르다:
> `placedBy.nameTagChip`은 **읽는 화면이 없어 DTO에서 멈춰 세운 것**, 그룹 생성 응답 3필드는
> **DTO 거울만 두고 VO를 안 늘린 것**이다.
>
> ✅ **2026-08-20 — 두 도메인이 처음으로 DataSource 위층을 얻었다**(PR #322 develop 머지, 계약 delta
> 없음). `image`는 `ImageUploadRepository`(발급 → **S3 PUT** → 확인 3단계를 하나로), `parfait-image`는
> `ToppingRepository.place` + `AddToppingUseCase`다. **`android_status`는 둘 다 `partial` 그대로다** —
> 이 저장소의 셈은 "화면이 부르는가"이고 그 위가 아직 없다(결선은 C-106 PR5).
> S3 PUT은 우리 서버 계약이 아니라 발급 응답이 준 URL로 나가므로 엔드포인트 셈(27/27)에 안 들어간다.
> ⚠️ 그 경로가 **Retrofit 밖 raw OkHttp라 `@NoAuth` 판정을 못 받는다** — 전용 `@UploadClient`가
> 성능이 아니라 **기능 전제**인 이유이고, 같은 클라이언트가 로깅 인터셉터를 아예 달지 않는다
> (presigned URL은 쿼리 스트링이 곧 자격증명이다) → [image.md](image.md).
> `placedBy.nameTagChip`은 **읽는 화면이 생긴 뒤에도 여전히 DTO에서 멈춰 있다** — C-202 Spotlight
> (PR #298)가 그 필드 대신 `groupMembers` 조인으로 색을 정해서다
> → [open-questions](../synthesis/open-questions.md) OQ-P-251.
>
> ✅ **2026-08-26 — 캔버스 응답이 소유 판정을 싣는다**(서버 PR #115, 엔드포인트 증감 0). 오늘·상세
> 두 조회의 `images[].placedBy`에 `ownerType`(`ME`·`OTHER`)이 붙어 **"이 토핑이 내 것인가"가 계약
> 안으로 들어왔다**. 그전까지 앱에는 견줄 상대가 없어 C-202의 본인 갈래가 비어 있었다
> (OQ-P-250 ① 해소). ⚠️ **요청자마다 값이 달라지는 첫 필드**라 이 응답은 사용자 사이에 공유·캐시할
> 수 없다. ✅ **develop이 같은 날 읽기 시작했다**(PR #376) — 매퍼가 `"ME"`만 참으로 접어
> `CanvasToppingVO.isMine`을 만들고, C-202의 상수 `false`와 C-301 편집 탭의 축이 다른 비교가 함께
> 사라졌다. **계약 delta와 앱 반영이 같은 날 붙은 첫 사례**다(그전까지는 며칠씩 벌어졌다)
> → [parfait.md](parfait.md).
>
> ✅ **2026-08-22 — 앱이 처음으로 서버에 무언가를 만든다**(PR #334 develop 머지, 계약 delta 없음).
> C-106 결선 스택 넷이 한 머지로 들어오면서 발급 → **S3 PUT** → confirm → 배치 네 단계가 확인 버튼
> 하나에 걸렸다. **`image.md`가 `done`이 됐다**(2/2 소비) — 표면만 있고 소비처가 0인 도메인은 이로써
> **0개**가 됐고, `parfait-image.md`는 배치 하나만 소비돼 `partial` 그대로다(나머지 셋은 C-301 라운드).
> **소비처를 얻은 엔드포인트는 23건**이다. 그전까지 소비되던 것이 전부 읽기였으므로 **쓰기 경로가
> 사용자 조작에 걸린 것도 이번이 처음**이다 — S3 PUT은 발급 응답이 준 URL로 나가므로 엔드포인트
> 셈(27/27)에는 들어가지 않는다.
> ⚠️ **실서버 요청 검증은 여전히 0건**(실기기 미수행)이고, 실패하면 서버에 흔적이 남는다(고아
> `PENDING` 이미지·S3 객체) → [open-questions](../synthesis/open-questions.md) OQ-P-146.
> 발급 응답 본문에 실려 오던 presigned URL은 `@NoBodyLog` + `SelectiveLoggingInterceptor`로 로그에서
> 뺐다(그 URL은 쿼리 스트링이 곧 자격증명이다) → [image.md](image.md).
>
> ✅ **2026-08-22 — `parfait.md`가 `done`이 됐다**(PR #329 develop 머지, 계약 delta 없음).
> C-301 배경 편집의 확인 버튼이 **배경 변경 PATCH**를 부르면서 이 도메인의 마지막 미소비 갈래가
> 닫혔다(회전 제외 5/5). **소비처를 얻은 엔드포인트는 24건**이고, `partial`로 남은 도메인은
> **둘**(`parfait-group.md`·`parfait-image.md`)이다. 같은 라운드가 `image.md`의 `imageType`에
> **두 번째 값**을 실었다 — 배경 이미지가 `BACKGROUND`로 올라간다(그전까지는 `NUKKI` 하나뿐).
> ⚠️ 앱이 서버에 쓰는 두 번째 경로인데 **실기기·실서버 확인은 여전히 0회**이고, 마감된 캔버스가
> 돌려주는 409는 화면에서 일반 오류로 접힌다
> → [open-questions](../synthesis/open-questions.md) OQ-P-146·OQ-P-261.
>
> ✅ **2026-08-23 — 앱이 서버 데이터를 지우는 첫 경로가 생겼다**(PR #335 develop 머지, 계약 delta
> 없음). C-301 편집 탭의 삭제 확인 모달이 **토핑 삭제 DELETE**를 부르면서 `parfait-image.md`의
> 미소비 셋이 **둘**(위치·테두리 수정)로 줄었다. **소비처를 얻은 엔드포인트는 25건**이고 `partial`
> 도메인은 여전히 **둘**이다(`parfait-group.md`·`parfait-image.md`). ⚠️ **실패가 화면에 닿지
> 않는다** — 403·409·404가 전부 로그 한 줄로 접혀, 같은 화면의 배경 저장과 처분이 갈렸다
> → [parfait-image.md](parfait-image.md) Android 매핑 ·
> [open-questions](../synthesis/open-questions.md) OQ-P-270.
>
> ✅ **2026-08-23 — 편집 결과가 서버에 남기 시작했다**(PR #336 develop 머지, 계약 delta 없음).
> C-301 편집 탭의 **확인 버튼**이 바뀐 토핑만 골라 **위치 PATCH**를 부르면서 `parfait-image.md`의
> 미소비가 **하나**(테두리 수정)로 줄었다. **소비처를 얻은 엔드포인트는 26건**이고 `partial`
> 도메인은 여전히 **둘**이다(`parfait-group.md`·`parfait-image.md`). 부분 병합 계약을 앱이 실제로
> 활용한 첫 사례다 — `positionZ`를 널로 두어 겹침 순서를 서버 값으로 남긴다.
> ⚠️ **실패 처분이 같은 버튼 안에서 갈렸다** — 배경 실패는 토스트 + 화면 잔류, 토핑 실패는 로그
> 한 줄 + 화면 이동이라 **사용자가 성공했다고 믿는다**
> → [parfait-image.md](parfait-image.md) Android 매핑 ·
> [open-questions](../synthesis/open-questions.md) OQ-P-275.

> ⚠️ **2026-08-25 — 계약은 그대로인데 붙는 주소가 바뀐다**(서버 #112·#113 `main` 머지, 계약 파일
> 변경 0건). 앞단 리버스 프록시가 TLS를 종단해 서버가 **HTTPS 도메인**을 얻었고, 검증 뒤 **평문
> 포트를 닫는 단계**가 런북 절차에 있다. 엔드포인트·필드·에러 코드는 한 글자도 안 바뀌었지만
> **모든 도메인이 같은 전제 위에 있다** — 차단되는 순간 기존 `YG_BASE_URL`로 빌드된 앱은 전부
> 연결에 실패한다. 그 시점은 1회성 인프라 조작이라 서버 커밋에서 읽을 수 없다
> → [conventions.md](conventions.md) "전송" ·
> [open-questions](../synthesis/open-questions.md) OQ-P-302·OQ-P-076.

> ✅ **2026-08-27 — 마지막 미소비 엔드포인트가 닫혔다**(PR #369 develop 머지, 계약 delta 없음).
> C-301 편집 탭의 확인 버튼이 **테두리 PATCH**까지 부르면서 `parfait-image.md`가 **`done`**이 됐다
> (4/4 소비). **소비처를 얻은 엔드포인트는 27건**이고, `partial`로 남은 도메인은
> **하나**(`parfait-group.md`)다. 앱이 테두리를 **겹 목록**으로 들고 서버가 **한 겹**을 받는
> 모양 차이는 `CanvasBGEditViewModel.toToppingBorder`가 접는데, **마지막 겹**을 보내는 그 규칙이
> 같은 화면의 **첫 겹**을 그리는 렌더링과 어긋난다
> → [parfait-image.md](parfait-image.md) Android 매핑 ·
> [open-questions](../synthesis/open-questions.md) OQ-P-324.
> ⚠️ **실서버 확인은 여전히 0회**이고, 테두리 저장 실패도 앞선 두 갈래와 같이 로그 한 줄로 접힌다
> (OQ-P-146·OQ-P-275).

테스트 전용 회전 엔드포인트(`POST /api/v1/test/parfait-canvas/rotate`)는 인증 없이 전 그룹 캔버스를
마감·재생성하며 서버가 프로덕션 오픈 전 제거를 예고했다 — 문서상 위치는 [parfait.md](parfait.md)지만
**총계에서 분리해 센다**(앱이 붙을 대상이 아니다).

`auth.md`와 `policy.md`는 서버 모듈이 같고(`http/auth`, OpenAPI 태그도 둘 다 `Auth`) URL 세그먼트가
다르다(`/api/v1/auth/*` vs `/api/v1/policies`). 파일명 규약이 서버 패키지가 아니라 경로 기준이라
문서를 나눴다 — 아래 [규약](#규약) 참고. 반대로 `member.md`·`parfait-image.md`는 경로(`users`,
그룹 하위 `images`)가 아니라 **서버 도메인 이름**을 따랐다(사유는 [conventions.md](conventions.md) "URL 규약").

## 규약
- **파일명에 날짜 접두사를 붙이지 않습니다.** `specs/`·`plans/`와 달리 API 계약은 `architecture/`와 같은
  **살아있는 문서**입니다 — 서버가 바뀌면 같은 파일을 갱신하고, 판본은 frontmatter `server_commit`·`verified`가 기록합니다.
- 도메인 파일명은 **서버 URL 세그먼트** 기준입니다(`/api/parfait-groups` → `parfait-group.md`).
  소비자는 서버 패키지가 아니라 경로로 API를 찾기 때문입니다.
- 형식 권위 출처는 [template.md](template.md). 새 도메인 문서는 위 인덱스 표에 한 줄 등록합니다.
- 엔드포인트 표의 **Android 열**은 네 값입니다.
  - `미구현` — 대응 심볼이 없다(**아직** 없는 것 — 붙일 예정이다)
  - `구현됨` — 대응 심볼이 있고 계약과 일치한다
  - `⚠️불일치` — 대응 심볼이 **있는데** 계약과 어긋난다(사유 각주 필수)
  - `해당 없음` — 서버에 있으나 **Android가 쓰지 않기로 결정**한 엔드포인트(결정 근거 필수).
    `미구현`과 구분합니다 — 전자는 공백이고 이쪽은 닫힌 결정이라, 표면 개수를 셀 때 분모에서 뺍니다.
- 파르페 공통 규율: **라인번호·변동 수치·색 hex 금지**. 근거는 파일명 + 심볼명.
- **팀 명세를 도메인 문서에 직접 섞지 않습니다.** 명세 원문은 [spec/](spec/README.md)에 두고, 도메인
  문서에는 코드로 확인되는 사실 + **명세 델타** 한 줄만 둡니다. 섞으면 어느 근거로 적힌 문장인지
  구분이 사라집니다. 명세 원문에는 **개인 식별 정보(작성자·코멘트)를 옮기지 않습니다** — public repo입니다.

## 갱신
- **서버가 바뀌었을 때** → 스킬 `sync-teamyg-server-api`(계약 절 갱신 + 기준선 갱신)
- **Android가 바뀌었을 때** → 스킬 `sync-tjyg-develop-baseline`(`android_status`·Android 매핑 절 갱신)

## 계약을 실제로 확인하는 법

TJYG-Android 저장소의 **`http/` 디렉토리**에 IntelliJ HTTP Client 요청 모음이 있다 — develop 기준
`auth.http`·`policy.http`·`parfait-group.http`·`parfait.http`·`images.http`·`users.http`·
`parfait-image.http`·`health.http`·`_reset.http` + `http-client.env.json` + 사용법 `README.md`다. 여기
문서에 적힌 계약을 서버에 직접 쏴서 확인할 수 있다.

> ✅ **커버가 다시 전량이다(2026-08-15, PR #250).** 서버 delta로 20/25가 됐던 것이 같은 라운드의 `http/`
> 보강으로 **25/25**가 됐다 — `parfait.http`에 오늘·과거 조회, `parfait-image.http`에 테두리 수정·삭제,
> `users.http`에 탈퇴가 붙었고 `http-client.env.json`·`_reset.http`에 `parfait_id`가 등재됐다.
> **손으로 메우는 방식이 서버 delta마다 무너졌다 복구되는 것이 네 번째**다 — 갱신 경로가 둘이라는 구조는
> 그대로다 → [open-questions](../synthesis/open-questions.md).
>
> 📌 **2026-08-16 서버 delta로 다시 25/27이 됐다** — `parfait.http`에 상세 조회·배경 변경 요청이 없다.
> **다섯 번째 왕복**이다.
>
> 📌 **2026-08-31 서버 delta로 25/28이 됐다** — `parfait-image.http`에 **토핑 일괄 수정 PATCH** 요청이
> 없다. **여섯 번째 왕복**이고, 이번에는 `:data` 표면도 함께 비어 있다(요청 모음만 뒤처진 2026-08-16과
> 다르다).
>
> ⚠️ **이번엔 왕복이 반만 닫혔다(2026-08-16, PR #266)** — 같은 두 엔드포인트에 **`:data` 표면은 붙었는데
> `http/`는 그대로 25/27이다. 앞선 네 번은 표면과 요청 모음이 한 라운드에서 함께 메워졌다** — 두 표면이
> 갈린 첫 사례다. 배경 변경은 손으로 쏴 볼 값이 특히 많다(HEX 형식·조건부 필수·업로드 확인 상태)
> → [open-questions](../synthesis/open-questions.md).
>
> ⚠️ **파괴적 요청이 두 파일의 마지막에 있다** — `users.http`의 탈퇴, `parfait-image.http`의 토핑 삭제.
> 파일을 위에서부터 통째로 돌리면 계정·데이터가 지워진다(`http/README.md`가 이 경고를 담는다).
>
> ⚠️ **`http/auth.http`가 아직 `newUser`로 분기한다.** 앱 DTO와 `http/README.md`는 `isNewUser`로
> 정정됐는데(PR #241·#230) 이 파일만 남았다 → [open-questions](../synthesis/open-questions.md).

- 로그인 응답에서 토큰을 자동 추출해 다음 요청이 그대로 쓴다 — 스웨거에서 복붙할 필요가 없다
- 각 요청 주석에 이 문서들의 함정을 옮겨 뒀다(`reissue`에 `Authorization`을 붙이면 재발급이 막히는 건은
  주석 처리된 헤더 줄을 풀어 **직접 재현**할 수 있다)
- 서버 주소·토큰은 gitignore된 `http-client.private.env.json`에만 둔다(커밋되는 `http-client.env.json`은 빈 값 골격)
- 런타임 global 변수가 env 파일보다 **우선**한다 — 토큰을 손으로 넣을 때는 `_reset.http`로 먼저 비운다

> 이 모음과 `api/`의 도메인 문서는 **같은 서버 코드를 근거로 하는 두 표면**이다. 서버가 바뀌면 양쪽이
> 같이 갱신돼야 하고, 한쪽만 고치면 조용히 갈린다 → [open-questions](../synthesis/open-questions.md).

문서와 서버가 어긋나는 것 같으면 여기서 먼저 쏴 보는 게 빠르다.
