# API 계약 문서

서버(`mash-up-kr/TEAMYG-SERVER`)가 제공하는 API 계약의 **스냅샷**과 TJYG-Android의 **적용 상태**를 함께 둡니다.

> **정본은 서버 코드**입니다. 이 디렉토리는 미러이고, 어긋나면 서버가 옳습니다
> (파르페 SoT 우선순위 "코드 > wiki > CLAUDE.md"와 동형).
>
> 추적 브랜치는 서버 **`main`** — 기준 커밋과 갱신 절차는 [server-baseline.md](server-baseline.md).

## 전역 계약
- [conventions.md](conventions.md) — 응답 envelope·성공/에러 코드 체계·인증·URL 규약·직렬화 규약·**Android 불일치**(2026-08-11 기준 1건 — 로그인 판별자 키)

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
| [auth.md](auth.md) | `http/auth` | 5 (카카오 로그인 · **애플 로그인** · 회원가입 완료 · 토큰 재발급 · 로그아웃) | 부분(애플 해당 없음 · 카카오 ⚠️불일치) |
| [policy.md](policy.md) | `http/auth` | 1 (현재 유효 약관 목록) | 구현됨 |
| [parfait-group.md](parfait-group.md) | `http/parfaitgroup` | 8 (목록 · 상세 · 참여 미리보기 · 참여 · 생성 · 닉네임 변경 · 탈퇴 · 신고) | 구현됨 |
| [parfait.md](parfait.md) | `http/parfait` | 1 (그룹 캘린더 연도 리스트) | 구현됨 |
| [image.md](image.md) | `http/image` | 2 (업로드 URL 발급 · 업로드 확인) | 구현됨 |
| [member.md](member.md) | `http/member` | 2 (내 계정 조회 · 전역 닉네임 변경) | 구현됨 |
| [parfait-image.md](parfait-image.md) | `http/parfaitimage` | 2 (토핑 배치 확정 · 위치/크기/각도 수정) | 구현됨 |

**총 21 엔드포인트**(2026-08-11, 서버 `2c5499a`). **Android 표면은 20/20이다**(2026-08-12, PR #230 develop
머지 — 분모에서 애플 로그인 1을 뺀 값이 20이고 그 전량을 덮는다). 서버가 앞서던 7칸 공백이 이 라운드로 0이 됐다.

> **`구현됨`은 `:data`에 Service·DataSource 표면이 있고 계약과 일치한다는 뜻**이다(2026-08-06, PR #197
> develop 머지). 이 표면을 소비하는 Repository·UseCase·화면은 아직 0건이고 실서버 요청도 0건이라
> 각 문서 `android_status`는 `partial`이다 → [open-questions](../synthesis/open-questions.md).
>
> `image.md`(2026-08-10 신설) · `member.md`·`parfait-image.md`(2026-08-11 신설)도 **2026-08-12 PR #230
> 머지로 표면을 얻어** `android_status: partial`이 됐다 — 앞의 넷과 같은 뜻이다(표면은 있고 소비처는 없다).
>
> ⚠️ **카카오 로그인은 심볼이 있는데 계약과 어긋난다** — 응답 판별자 키가 `isNewUser`인데 Android가
> `@SerialName("newUser")`를 붙였다([auth.md](auth.md) "판별자 키",
> [conventions.md](conventions.md) "Android 불일치").

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

TJYG-Android 저장소의 **`http/` 디렉토리**에 IntelliJ HTTP Client 요청 모음이 있다 — develop 머지본
(PR #230) 기준 `auth.http`·`policy.http`·`parfait-group.http`·`parfait.http`·`images.http`·`users.http`·
`parfait-image.http`·`health.http`·`_reset.http` + `http-client.env.json` + 사용법 `README.md`다. 여기
문서에 적힌 계약을 서버에 직접 쏴서 확인할 수 있다.

> **전량 커버가 회복됐다(2026-08-12, PR #230).** 2026-08-10·08-11 서버 delta로 벌어졌던 7칸 중
> 애플 로그인 1건은 **Android 미사용 결정**이라 대상이 아니고, 나머지 6건(image 2·member 2·
> parfait-image 2)이 요청 파일을 얻었다 — **20/20**. 다만 메운 방식은 여전히 **사람 손**이라
> [2026-08-04] "갱신 경로가 둘" 구조 문제는 그대로다 → [open-questions](../synthesis/open-questions.md).
>
> ⚠️ **`http/README.md`와 `http/auth.http`가 서로 어긋난다(2026-08-12).** 같은 PR이 README의 판별자 키를
> `newUser`→`isNewUser`로 정정했는데 `auth.http` 주석·응답 핸들러는 `newUser`를 그대로 쓴다. 앱 DTO도
> 안 고쳐졌다 → [open-questions](../synthesis/open-questions.md), 아래 [conventions.md](conventions.md) "Android 불일치".

- 로그인 응답에서 토큰을 자동 추출해 다음 요청이 그대로 쓴다 — 스웨거에서 복붙할 필요가 없다
- 각 요청 주석에 이 문서들의 함정을 옮겨 뒀다(`reissue`에 `Authorization`을 붙이면 재발급이 막히는 건은
  주석 처리된 헤더 줄을 풀어 **직접 재현**할 수 있다)
- 서버 주소·토큰은 gitignore된 `http-client.private.env.json`에만 둔다(커밋되는 `http-client.env.json`은 빈 값 골격)
- 런타임 global 변수가 env 파일보다 **우선**한다 — 토큰을 손으로 넣을 때는 `_reset.http`로 먼저 비운다

> 이 모음과 `api/`의 도메인 문서는 **같은 서버 코드를 근거로 하는 두 표면**이다. 서버가 바뀌면 양쪽이
> 같이 갱신돼야 하고, 한쪽만 고치면 조용히 갈린다 → [open-questions](../synthesis/open-questions.md).

문서와 서버가 어긋나는 것 같으면 여기서 먼저 쏴 보는 게 빠르다.
