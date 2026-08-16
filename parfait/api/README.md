# API 계약 문서

서버(`mash-up-kr/TEAMYG-SERVER`)가 제공하는 API 계약의 **스냅샷**과 TJYG-Android의 **적용 상태**를 함께 둡니다.

> **정본은 서버 코드**입니다. 이 디렉토리는 미러이고, 어긋나면 서버가 옳습니다
> (파르페 SoT 우선순위 "코드 > wiki > CLAUDE.md"와 동형).
>
> 추적 브랜치는 서버 **`main`** — 기준 커밋과 갱신 절차는 [server-baseline.md](server-baseline.md).

## 전역 계약
- [conventions.md](conventions.md) — 응답 envelope(**204 예외 2건**)·성공/에러 코드 체계·인증·URL 규약·직렬화 규약·**Android 불일치**(2026-08-15 기준 1건 — 그룹 목록 업로드 시각 파싱)

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
| [parfait-group.md](parfait-group.md) | `http/parfaitgroup` | 8 (목록 · 상세 · 참여 미리보기 · 참여 · 생성 · 닉네임 변경 · 탈퇴 · 신고) | 구현됨(목록 1건 ⚠️불일치) |
| [parfait.md](parfait.md) | `http/parfait` | 5 + 테스트 전용 1 (연도 리스트 · 오늘의 캔버스 · 과거 목록 · **상세 조회** · **배경 변경** / 테스트 회전) | 구현됨(회전 해당 없음) |
| [image.md](image.md) | `http/image` | 2 (업로드 URL 발급 · 업로드 확인) | 구현됨 |
| [member.md](member.md) | `http/member` | 3 (내 계정 조회 · 전역 닉네임 변경 · **탈퇴**) | 구현됨(조회·닉네임 변경은 **결선됨**, 탈퇴 미소비) |
| [parfait-image.md](parfait-image.md) | `http/parfaitimage` | 4 (토핑 배치 확정 · 위치/크기/각도 수정 · **테두리 수정** · **삭제**) | 구현됨 |

**총 28 엔드포인트 + 테스트 전용 1**(2026-08-16, 서버 `22717fe`). **Android 표면은 27/27, 공백 0이다** —
분모에서 애플 로그인 1(`해당 없음`)을 뺀 값이 27이고, 테스트 전용 회전 1은 총계에서 이미 분리했다.
서버 delta가 벌린 공백 2(파르페 상세 조회·배경 변경)를 **같은 날 PR #266이 닫았다**
([spec](../specs/archive/2026-08-16-canvas-detail-background-api-service-layer.md)).

> **`구현됨`은 `:data`에 Service·DataSource 표면이 있고 계약과 일치한다는 뜻**이다(2026-08-06, PR #197
> develop 머지).
>
> ✅ **2026-08-15 — 소비처가 생겼다.** 다섯 라운드(PR #241·#242·#243·#244·#248)가 **8 엔드포인트를
> 화면까지** 이었다 — 카카오 로그인·회원가입(auth), 약관 목록(policy), 그룹 목록·생성·참여 미리보기·참여·
> 닉네임 변경(parfait-group). `policy.md`는 유일한 엔드포인트가 전부 소비돼 **`android_status: done`**이고,
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
> `/api/parfait-groups` 행이 **`⚠️불일치`**다([conventions.md](conventions.md) "Android 불일치").
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
