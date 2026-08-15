# 서버 API 문서 검증 기준선 (Server Baseline)

> `parfait/api/` 계약 문서를 **어느 서버 커밋 기준으로 마지막 검증했는지** 기록하는 단일 출처(SoT).
> "서버 API 문서 점검"을 요청받으면 아래 기준선부터 현재 `origin/main`까지의 **delta만** 감사하고,
> 끝나면 기준선을 갱신한다.

## 현재 기준선
- **repo**: `TEAMYG-SERVER` (`mash-up-kr/TEAMYG-SERVER`) **`main`**
- **커밋**: `e4ff23f`
- **요약**: `[Fix] 닉네임 자모 허용 및 그룹 내 중복 검사 제거 (#101)`
- **검증일**: 2026-08-15 (7회차)

### 왜 `main`인가
서버 저장소의 기본 브랜치가 `main`이고(`origin/HEAD -> origin/main`) 기능 PR이 main으로 머지된다.
`develop`은 main을 주기적으로 끌어오는 쪽이라 **뒤처진다** — 체계 신설 시점에 develop은
signup·파르페 연도 조회 두 API를 갖고 있지 않았다. 앱이 바라볼 서버는 main에서 나온다.

⚠️ TJYG-Android는 `develop`을 추적한다([doc-baseline.md](../doc-baseline.md)).
**두 저장소의 통합 브랜치 이름이 다르다** — 혼동하지 말 것.

## 점검 절차 (다음 요청 시)
로컬 경로는 개인정보라 `wiki/personal-private/project-paths.md` 참고(아래 `<S>`).

1. **최신화**: `git -C <S> fetch origin main`
2. **신규 커밋 나열**: `git -C <S> log --oneline <기준선>..origin/main`
   - 기능 PR이 squash로 들어와 merge 커밋이 아닐 수 있다 → **`--merges` 필터를 쓰지 않는다.**
   - 변경 파일: `git -C <S> show --stat <hash>`
3. **계약 대조**: 컨트롤러·`*Request`/`*Response` DTO·`*ErrorCode` enum·`SecurityConfig`·
   `ApiResponse`·`GlobalExceptionHandler` 변경이 `parfait/api/*.md`와 어긋나는지 검사.
   - 파일 조회는 항상 `git -C <S> show origin/main:<path>` — **워킹트리를 믿지 않는다**(로컬은 `develop`).
   - 신규 도메인이면 [template.md](template.md)로 문서 신설 + [README.md](README.md) 인덱스 등록.
4. **기준선 갱신**: 위 "현재 기준선"을 새 `origin/main` HEAD로 교체하고 아래 이력에 한 줄 추가.

## 기준선 이력
| 검증일 | main 커밋 | 요약 | 비고 |
|--------|-----------|------|------|
| 2026-08-01 | `6b05b8c` | `[Feat/#61] 그룹별 캘린더 연도 리스트 조회 API (#62)` | 체계 신설. 도메인 3건(auth 2·parfait-group 8·parfait 1) 전량 초기 작성. Android 대응 심볼 0건 → 전 엔드포인트 `미구현`. 불일치 3건·URL 규약 혼재 open-questions 등록. 체계 신설 도중 서버가 전진해 같은 라운드에서 `6f5bffc`로 올림 |
| 2026-08-02 | `6f5bffc` | `[Feat/#45] 토큰 재발급(refresh) / 로그아웃 API 구현 (#63)` | 패키지 전면 재편(`http/api/auth`→`http/auth`, `http/api/parfait`→`http/parfait`, `http/api/health`→`http/global/health`, `http/parfaitgroup/*.kt`→`{controller,dto,exception}/`) · auth 신규 엔드포인트 2(`reissue`·`logout`) · `AuthErrorCode` 12종(`FORBIDDEN_REFRESH_TOKEN` 신설) · 화이트리스트 `/api/v1/auth/**`→개별 3경로(`kakao`·`signup`·`reissue`) 축소, `logout` 제외 · 그룹(`parfait-group`) 계약 불변 |
| 2026-08-03 | `69654bc` | `[Feat/#64] 약관 목록 조회 API 구현 (#65)` | delta 1커밋. 신규 도메인 `policy`(`GET /api/v1/policies`, 문서 [policy.md](policy.md) 신설·인덱스 등록) — 서버 위치는 `http/auth`인데 URL 세그먼트가 최상위라 auth와 분리. 화이트리스트에 `/api/v1/policies` 추가 · 도메인 전용 에러코드 0종(빈 배열도 200) · `url`은 `Tos.content` 컬럼 재사용 · 정렬은 `PolicyQueryService`가 `TERMS_OF_SERVICE`→`PRIVACY_POLICY`로 고정. auth·parfait-group·parfait 계약 불변. **미결 1건 해소**(약관 목록 API 부재) + 신규 2건 등록(`url` 의미·앱 연동 미착수) |
| 2026-08-10 | `5bb2a3a` | `Merge pull request #73 from mash-up-kr/feat/#72` (이미지 업로드 확인 API) | delta 6커밋(기능 PR 2건 #71·#73 + 각 테스트). 신규 도메인 `image`(`http/image`, 엔드포인트 2 — `POST /api/v1/images`·`POST /api/v1/images/{imageId}/confirm`, 문서 [image.md](image.md) 신설·인덱스 등록). S3 presigned PUT 2단계 업로드로 **바이트가 서버를 지나지 않는다** · `ImageErrorCode` 4종 신설(`MEMBER_NOT_FOUND`가 세 번째 enum에 중복) · 화이트리스트 불변이라 **둘 다 인증 대상** · 리소스 생성인데 `ApiResponse.ok`라 200/`"OK"`. auth·policy·parfait-group·parfait 계약 불변, `SecurityConfig`·`ApiResponse`·`GlobalExceptionHandler` 불변. Android 대응 심볼 0건(`android_status: none`). **신규 미결 3건**(`fileName` 미사용·confirm 소유자 미검증·`PENDING` 고아 정리 부재) + **기존 2건 갱신**(업로드 타임아웃 전제 도래·`http/` 요청 모음 2건 공백). 같은 라운드에서 **OpenAPI 실물 재대조**(스키마 `required`가 Bean Validation 애노테이션만 반영 — `imageType`·`agreements`·그룹 생성 3필드가 비널인데 목록에 없음, conventions에 규칙 등재)와 **TJYG-Android 브랜치 전수 확인**(image 심볼 0건, 원격 표면 4 Service = 14 엔드포인트 그대로)을 수행해 전 도메인 문서 `server_commit`·`verified`를 이 기준선으로 올림 |
| 2026-08-11 | `2c5499a` | `[Feat/#67] 내 계정 정보 조회 API (#84)` | delta 10커밋(기능 PR 4건 #76·#77·#81·#84 + 테스트/배포 chore). **신규 도메인 2건** — `member`(`http/member`, `GET /api/v1/users/me`·`PATCH /api/v1/users/me/nickname`, 문서 [member.md](member.md) 신설) · `parfait-image`(`http/parfaitimage`, `POST`·`PATCH .../groups/{groupId}/parfaits/{parfaitId}/images`, 문서 [parfait-image.md](parfait-image.md) 신설). **기존 도메인 증가** — auth에 애플 로그인(`POST /api/v1/auth/apple`) 1건 추가로 4→5, 화이트리스트에도 개별 등재. 총 16→**21 엔드포인트**, 도메인 5→7. 신규 enum `MemberErrorCode` 2종·`ParfaitImageErrorCode` 5종, `AuthErrorCode` 12→14(`APPLE_SERVER_ERROR`·`APPLE_SERVER_UNAVAILABLE`). `MEMBER_NOT_FOUND` 문자열을 가진 enum이 넷이 됐고 `GET /users/me`는 **한 엔드포인트에서 401·404 둘 다**로 낸다. signup의 애플 분기가 TODO에서 실구현으로 바뀌어 `INVALID_TOKEN` 경로가 하나 늘었다. `ApiResponse`·`GlobalExceptionHandler`·parfait-group·parfait·policy·image 계약 불변. **⚠️ 중대 정정 1건** — 로그인 판별자 JSON 키가 `newUser`가 아니라 **`isNewUser`**다(서버가 `jackson-module-kotlin` 사용, 컨트롤러 테스트가 응답 본문을 단언, 팀 명세도 일치 / OpenAPI 스키마만 반대 — springdoc 자체 ObjectMapper 산물). 2026-08-02 판본의 기술이 틀렸고 Android가 그대로 `@SerialName("newUser")`를 구현해 **카카오 로그인이 `⚠️불일치`**가 됐다. **미결 신규 6건**(OQ-P-116~121: 판별자 정정·서버 7건 선행·POST 소유권·배치 계약 공백·닉네임 전파·GOOGLE provider 500) + **해소 1건**(OQ-P-062 전역/그룹 닉네임 규칙 동일 확인) + **기존 3건 갱신**(OQ-P-060 URL 형태 5종·OQ-P-075 전제 붕괴·OQ-P-108 `http/` 공백 7건). 전 도메인 문서와 `spec/` 4건의 `server_commit`·`verified`를 이 기준선으로 올림 |
| 2026-08-15 | `36ecd1c` | `[Feat/#85] 캔버스 상태 자동 전환 배치(새벽 3시) 구현 (#97)` | delta 17커밋(기능 PR 6건 #83·#88·#89·#90·#92·#94 + 배치 #97 + 테스트). **엔드포인트 21→26 + 테스트 전용 1** — parfait 1→3(`GET .../parfaits/today` 오늘 캔버스 전량·`GET .../parfaits` 과거 목록), parfait-image 2→4(`PATCH .../{parfaitImageId}/border` 테두리 수정·`DELETE .../{parfaitImageId}` 삭제), member 2→3(`DELETE /api/v1/users/me` 탈퇴). 신규 도메인 0건 — 기존 문서 3건만 커진다. **신설 enum `ParfaitErrorCode` 2종**(`INVALID_DATE_RANGE`·`PARFAIT_ALREADY_CLOSED` — 후자는 공개 경로 도달 불가), `parfait` 테이블에 `status`(`ACTIVE`·`CLOSED`·`EMPTY`)·`background_type`·`background_value` 신설(V11), Spring Batch 스키마(V12). **캔버스 회전 배치** 03:00 Asia/Seoul + **테스트 전용 회전 엔드포인트가 화이트리스트에 등재**(인증 없이 전 그룹 마감, 서버 TODO가 프로덕션 전 제거 예고). **⚠️ 계약 축소 1건** — 애플 로그인 요청에서 `authorizationCode`가 **제거**됐고(#89) 애플 refresh token 저장·교환·client secret 생성·`signup`의 provider 분기가 전부 사라졌다(V10이 컬럼 삭제) → `INVALID_ID_TOKEN`·`APPLE_SERVER_*`의 원인이 JWKS 한 갈래로 좁혀졌다. **envelope 예외가 2건**이 됐다(`logout`·탈퇴 — 둘 다 204 본문 없음, 반면 토핑 삭제는 200+`data: null`). `image_meta.reference_count`에 증감 경로가 생겼다(배치 +1·삭제 -1, 0이면 S3 객체 삭제). 탈퇴는 회원 행 하드 삭제 + 그룹 멤버십 `leave()`(닉네임 `(알수없음)`)이고 `GroupNickname.of`에 그 값 특례가 붙었다. **Android 표면 20/25로 공백 5 재발**(세 번째). **미결 신규 7건**(OQ-P-158~164) + **부분 해소 2건**(OQ-P-119 ①②③ — 목록 조회는 `today`가 대신 닫음 / OQ-P-107 ③ referenceCount 주체 확정) + **재개 1건**(OQ-P-108 `http/` 공백 5건). 전 도메인 문서와 `spec/` 4건의 `server_commit`·`verified`를 이 기준선으로 올림 |
| 2026-08-15 | `e4ff23f` | `[Fix] 닉네임 자모 허용 및 그룹 내 중복 검사 제거 (#101)` | delta 3커밋(#99·#100·#101, 전부 squash — `--merges` 필터였다면 0건으로 보였을 것). **엔드포인트 증감 0**(26 + 테스트 전용 1 유지), 신규 도메인 0, `SecurityConfig`·`ApiResponse` 불변. 바뀐 것은 **값 규칙 3건**이고 전부 `parfait-group` 계열이다. ① **초대코드 자릿수 8 → 6**(`InviteCode.LENGTH`·JPA 컬럼·V13) — 앱 `InviteCode.LENGTH`와 A-004 입력 칸은 처음부터 6이라 **드러나지 않던 불일치가 서버 쪽에서 닫혔다**(실서버 요청 0건이라 표면화되지 않았고, 계약 문서에 서버 자릿수를 안 적어 대조로도 못 잡았다 → OQ-P-180). ② **닉네임 정규식에 자모 추가**(`GroupNickname`·`GlobalNickname` 동시, 사유는 iOS가 통과시키는 `ㅋㅋ`류가 서버에서만 400) — 이번엔 앱이 더 좁아졌다(`CheckNameValidUseCase`는 완성형만) → OQ-P-171 전제 반전. ③ **그룹 내 닉네임 중복 검사 제거** — 참여·닉네임 변경 양쪽의 `existsByGroupIdAndNickname`과 `GROUP_NICKNAME_ALREADY_USED`가 포트·어댑터·리포지토리·에러 코드까지 삭제돼 `ParfaitGroupApiErrorCode` **11 → 10**, join·join-preview 에러 6 → 5종, 닉네임 변경 4 → 3종. 앱 `GroupNickNameViewModel`의 `ALREADY_USED` 분기·유닛 테스트·`ServerErrorCode` 상수가 死코드가 됐다 → OQ-P-179. `GlobalExceptionHandler`도 바뀌었으나 `log.info` 인자에서 예외 객체를 뺀 것뿐이라 **계약 영향 없음**(#100, 나머지는 배포 워크플로). Android 열 값 변동 0(요청·응답 형태 불변). **미결 신규 2건**(OQ-P-179·180) + **기존 1건 전제 반전**(OQ-P-171). 전 도메인 문서와 `spec/` 4건의 `server_commit`·`verified`를 이 기준선으로 올림 |
