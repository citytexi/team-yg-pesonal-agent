---
id: server-delta-nametag-chip-keys
title: 서버 delta 57529ec 반영 — 칩 JSON 키 정정·C-001 상단 칩 결선·업로드 시각 파싱 복구
status: draft
category: behavior-spec
platforms: android
verified:
related_code: MyParfaitGroupResponse, ParfaitGroupMemberResponse, CreateParfaitGroupResponse, GetTodayParfaitResponse, GroupMemberResponse, PlacedByResponse, PlaceParfaitImageResponse, NametagChipType, CanvasMemberVO, MyParfaitGroupVO, CanvasMainViewModel, ColorChipType, GrouptagChipType, PARFAIT_TIME_ZONE
related_adr: ADR-0017, ADR-0023
related_spec: server-delta-nametag-chip-day-boundary, group-ssot, s101-group-setting-api, c001-canvas-today-detail
related_architecture: data-layer, design-system, module-structure
supersedes:
superseded_by:
tags: [spec, parfait, group, canvas, server-contract, design-system]
---

# Spec: 서버 delta 57529ec 반영

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처. 본문은 설계 내용에 집중.

[2026-08-18-server-delta-nametag-chip-day-boundary](2026-08-18-server-delta-nametag-chip-day-boundary.md)의
**직접 후속**이다. 그 라운드가 "서버 요청 대상"·"범위 밖"으로 미뤄 둔 둘을 이번 서버 delta가 닫아 주었고,
동시에 **그 라운드가 짠 코드를 조용히 무력화하는 변경**을 함께 들여왔다. 작업 대상 브랜치는
`feature/#300-sync-backend-api-250819`(선행 라운드 30커밋을 develop 위로 rebase한 것)다.

## 서버가 바꾼 것

기준선 `08df1bf` → `57529ec`, 2커밋. **엔드포인트 증감 0**(28 + 테스트 전용 1). 계약 문서 갱신은
[api/server-baseline.md](../api/server-baseline.md) 10회차 행에 있고, 여기서는 앱이 반응해야 하는 것만 본다.

| # | 서버 변경 | 앱에 미치는 영향 |
|---|---|---|
| ① | 응답 JSON 키 `nametagChip` → `nameTagChip`, `lastPlacedByNametagChip` → `lastPlacedByNameTagChip` | **선행 라운드가 읽던 값이 전부 `null`이 된다.** 예외는 안 난다 |
| ② | 캔버스 `groupMembers[]`에 `nameTagChip` 신설 | C-001 상단 멤버 칩이 계약 안으로 들어온다 |
| ③ | 토핑 배치 응답 `placedBy`에 `nameTagChip` 신설 + 중첩 타입을 `PlaceParfaitImagePlacedByResponse`로 개명 | 선행 라운드가 "VO에 안 올린다"고 적은 **사유가 사라진다** |
| ④ | 목록·생성의 `recentImageUploadedAt`·`lastPlacedByNameTagChip`이 `COALESCE`로 비널 | **G-001 목록 조회가 상시 실패**한다 |
| ⑤ | 반납 값 `RELEASED` → `DEFAULT`(V15) | 도메인 enum 값·KDoc·두 util 분기가 없는 값을 가리킨다 |
| ⑥ | 그룹 생성 응답에 `recentImageUrl`·`recentImageUploadedAt`·`lastPlacedByNameTagChip` 신설 | 읽는 코드 없음 |
| ⑦ | 과거 목록 `to` 기본값도 `ParfaitDay.current()` | 앱은 항상 범위를 명시해 부르므로 안 물린다 |

**①과 ④가 이 스펙의 이유다.** 나머지는 그 김에 정리하는 것이다.

### ①이 왜 위험한가

세 DTO의 필드가 전부 `String? = null`이라 키가 어긋나도 `MissingFieldException`이 나지 않는다.
**칩이 전량 폴백 색으로 그려지고 아무 신호도 남지 않는다.** 선행 라운드가 S-101·G-001의 인덱스 순환을
걷어내고 서버 값으로 바꾼 작업이 통째로 무효가 되는데, 화면은 그럴듯하게 뜬다.

이 부류를 앱 테스트가 못 잡는다는 점이 중요하다 — 테스트가 자기 DTO 객체를 자기가 만들어 넣으므로
`@SerialName` 문자열은 어떤 단언도 통과하지 않는다. 이번에도 잡은 것은 계약 문서 감사였다
([open-questions](../synthesis/open-questions.md) OQ-P-234).

### ④가 왜 지금 터지나

앱 매퍼는 `recentImageUploadedAt?.let(Instant::parse)`다. 서버 값은 오프셋 없는 로컬 날짜시각이라
`kotlin.time.Instant.parse`가 받지 못한다 — **원래도 틀렸다.** 다만 토핑이 0건인 그룹은 서버가 `null`을
줘서 `?.let`이 파싱을 건너뛰었고, 그래서 "토핑을 한 번도 안 올린 계정"은 우연히 살아 있었다.
서버가 `COALESCE`로 비널화하면서 **그 마지막 안전지대가 사라졌다** — 이제 그룹이 하나라도 있으면
매퍼가 던지고, `ApiCaller`의 transform 가드가 `AppError.Unexpected`로 접어 G-001이 통째로 실패한다.

## 결정

### 1. 키 셋을 서버에 맞추고, DTO는 널 허용을 유지한다

`@SerialName`과 Kotlin 프로퍼티명을 **둘 다** 서버 이름으로 바꾼다. wire DTO는 서버의 거울이라는 규약
([data-layer](../architecture/data-layer.md))이 프로퍼티명에도 걸린다 — `@SerialName`만 고치면 코드를
읽는 사람에게 서버 이름이 안 보인다.

**개명은 `:data`의 wire DTO에서 멈춘다.** `:domain`은 `NametagChipType`·`MyParfaitGroupVO.lastPlacedByNametagChip`·
`ParfaitGroupMemberVO.nametagChip`의 표기를 **그대로 둔다** — 도메인은 거울이 아니라 제품 언어이고
(서버 `parfait`가 도메인에서 `Canvas`인 것과 같은 축), 매퍼가 그 번역 지점이다. 도메인까지 따라가면
타입 이름 `NametagChipType`도 함께 바꿔야 하는데 그것을 요구하는 계약 변화는 없다. 결과적으로
**`:data` 안에서만 두 표기가 만나고, 만나는 자리는 매퍼 한 곳**이다.

**널 허용(`String? = null`)은 그대로 둔다.** 비널로 좁히면 다음 키 변경이 `MissingFieldException`으로
즉시 드러나지만, 그 대가로 구버전 서버·롤백·스테이징을 만났을 때 화면이 통째로 실패한다
(OQ-P-227이 직전 라운드에서 이미 짚은 자리이고, 그 전제 — 앱과 서버가 항상 같이 배포된다 — 는 여전히
어디에도 적혀 있지 않다).

> ⚠️ **그 대가로 이 부류의 사고를 잡는 수단이 지금 없다.** 와이어 계약 테스트(실제 응답 모양의 JSON
> 문자열을 디코딩해 필드가 채워지는지 단언)를 붙이는 선택지가 있었고 저장소에 선례도 있다
> (`KakaoLoginResponseSerializationTest` — `isNewUser` 정정 때 만든 것). **이번 라운드는 붙이지 않기로
> 했다**(범위 결정). 그래서 다음 서버 키 변경도 `sync-teamyg-server-api` 감사로만 잡힌다 →
> OQ-P-234 ③에 남긴다.

### 2. 업로드 시각은 매퍼가 KST를 부여해 `Instant`로 만든다

VO 타입(`MyParfaitGroupVO.recentImageUploadedAt: Instant?`)과 화면의 경과시간 계산을 **그대로 두고
매퍼만 고친다.**

```
recentImageUploadedAt?.let(LocalDateTime::parse)?.toInstant(PARFAIT_TIME_ZONE)
```

- **왜 KST를 붙일 수 있나** — 서버 DB 커넥션이 dev·local·prod 세 환경 전부 `serverTimezone=Asia/Seoul`이고
  `hibernate.jdbc.time_zone`도 같다. 즉 이 문자열의 벽시계는 KST 기준이라는 것이 계약 사실이다
  ([api/parfait-group.md](../api/parfait-group.md) 타임존 절).
- **왜 VO를 `LocalDateTime`으로 안 바꾸나** — 화면이 하는 일이 경과시간 계산이라 절대 시점이 필요하다.
  벽시계를 그대로 들면 기준 시간대를 어딘가에서 다시 정해야 하고, 그 자리가 화면으로 내려가면 해외 기기에서
  숫자가 어긋난다. 기존 주석의 의도("벽시계가 아니라 절대 시점으로 든다")가 옳았고 **틀린 것은 변환 방법뿐**이다.
- **왜 오프셋 유무를 둘 다 받지 않나** — 서버가 오프셋을 안 싣는다는 것이 지금 확정 사실이다. 두 포맷을
  받게 하면 계약이 실제로 어느 쪽인지가 코드에서 흐려진다.
- `PARFAIT_TIME_ZONE`은 `:domain`에 이미 공개돼 있다(`ParfaitDay.kt`). **새 상수를 만들지 않는다** —
  선행 라운드가 `DAY_BOUNDARY_HOUR`에 대해 세운 규율과 같다.

주석은 "왜 KST인가"(위 계약 근거)로 갈아 끼운다. 지금 주석은 결론만 적고 근거가 없어 다음 사람이
같은 실수를 되풀이할 수 있다.

### 3. C-001 상단 멤버 칩을 서버 값으로 바꾼다

선행 라운드가 **범위 밖**으로 둔 항목이고 사유는 "서버 `groupMembers`에 필드가 없다" 하나였다.
②가 그것을 닫았다.

- `GetTodayParfaitResponse.GroupMemberResponse`에 `nameTagChip` 신설 → `CanvasMemberVO.nametagChip`으로 올린다.
  **이쪽은 VO까지 올린다** — 읽는 화면(C-001)이 같은 라운드에 있다.
- `CanvasMainViewModel.toMemberChips`가 `member.nametagChip.toColorChipType()`을 쓰고,
  `NAMETAG_CHIP_PALETTE`와 "서버가 이 목록에는 값을 안 준다"는 KDoc을 함께 걷는다.

**이것으로 닫히는 것이 둘 더 있다.**
- **같은 사람이 S-101과 C-001에서 다른 색**이던 문제(OQ-P-224 ①). 선행 라운드가 한쪽만 정본으로 만들면서
  드러난 모순이다.
- **팔레트 7종의 근거 없음**(OQ-P-210 ②). 12종 중 7종만 도는 목록이었고 근거가 어디에도 없었는데,
  서버가 타입을 주면 **팔레트라는 개념 자체가 사라진다.** 선행 라운드가 "상단 칩이 계약을 타게 될 때
  같이 정한다"고 미뤄 둔 그 시점이 지금이다.

### 4. 칩→색 변환은 canvas impl에 복제한다

C-001의 규칙은 S-101과 **같다**(12종 1:1, 없으면 `Default`). 선행 라운드는 "S-101(12→12)과 G-001(12→6)은
규칙이 달라 공용 변환을 만들지 않는다"고 적었는데, 이번에 **처음으로 규칙이 같은 두 화면**이 생긴다.

그래도 복제한다. 근거는 둘이다.

- **공용화에 모듈 간선이 필요하다.** 변환의 입력은 `:domain`의 `NametagChipType`, 출력은
  `:core:designsystem`의 `YGColorChipType`이다. 둘 다 의존하는 모듈이 지금 **없다** — `core:ui`가
  `:domain`은 보지만 `:core:designsystem`은 안 본다. 올리려면 `core:ui → core:designsystem` 간선을
  새로 여는 셈이고, 그것은 이 라운드가 아니라 자기 결정이 필요한 변경이다
  ([module-structure](../architecture/module-structure.md)).
- **컴파일러가 드리프트를 막는다.** 두 변환 모두 `NametagChipType`에 대한 exhaustive `when`이고
  `else`가 없다. 13번째 타입이 서버에 생기면 **양쪽 다 컴파일이 깨진다** — 한쪽만 고쳐지는 사고가
  구조적으로 불가능하다. 중복이 위험한 이유(한쪽만 갱신)가 여기서는 성립하지 않는다.

자리는 선행 라운드가 세운 규약대로 그 모듈의 `util` 패키지다 —
`feature/groups/canvas/impl/.../util/ColorChipType.kt`. KDoc에 "S-101과 규칙이 같은데 공용 자리가 없어
복제했다 · 타입이 늘면 양쪽이 함께 깨진다"를 박고 → OQ에 남긴다.

> `core:ui`의 `text/LoginProviderUiText.kt`·`text/NameValidResultUiText.kt`가 "도메인 enum → UI 표현"의
> 선례이므로, 공용화를 결정한다면 자리는 그쪽이다. 다만 그 둘은 문자열로 가고 이것은 디자인시스템
> 타입으로 간다 — 같은 자리로 묶이는지가 그 결정의 실제 질문이다.

### 5. 토핑 배치 응답 칩은 DTO까지만 받는다

선행 라운드가 **"서버가 배치 확정 응답엔 칩을 안 준다"**를 사유로 VO 승격을 보류했다.
③이 그 사유를 없앴다 — 이제 두 응답이 모두 칩을 주므로 공유 VO `ToppingPlacerVO`를 채울 때
"없다/모른다"를 뭉갤 일이 없다.

**그럼에도 이번 라운드는 DTO까지만 받는다.** 남은 사유는 하나이고 그것은 여전히 유효하다 —
`placedBy`를 읽는 화면이 0건이다. 소비자 없이 도메인 모양을 굳히면 그 화면이 붙을 때 되돌려야 한다.

- 앱 중첩 DTO도 서버를 따라 `PlaceParfaitImagePlacedByResponse`로 개명한다. 앱이 두 패키지에 같은 이름
  `PlacedByResponse`를 둔 근거가 **"서버가 그렇다"**였는데(그 KDoc이 그렇게 적혀 있다) 서버가 한쪽을
  개명해 그 근거가 사라졌다. 거울을 유지한다.
- 캔버스 쪽 `PlacedByResponse`는 이름을 그대로 둔다(서버가 안 바꿨다).

> **C-202 Spotlight(PR #298)가 이 결정에 물리지 않는다.** 선행 라운드가 확인한 대로 그쪽은 칩을
> `placedBy`가 아니라 `groupMembers`에서 `GroupMemberId`로 조인해 찾는데, **결정 3이 그 경로를
> 채워 준다.** 즉 이 보류가 C-202를 막지 않는다.

### 6. `RELEASED` → `DEFAULT`

도메인 enum 값·KDoc·두 util의 분기·테스트를 함께 바꾼다. 지금은 서버가 보내는 `"DEFAULT"`가
매퍼의 "모르는 문자열" 갈래로 빠져 `null`이 되고, `null`과 반납 값의 화면 표현이 같아서 **결과가 우연히
맞는다.** 우연이 근거가 되면 안 되고, enum·KDoc이 존재하지 않는 계약 값을 가리키는 상태를 남길 수 없다.

KDoc에 서버가 이번에 명시한 성질을 싣는다 — **`DEFAULT`는 `TYPE1`~`TYPE12`와 달리 유일성 제약이 없어
한 그룹 안에서 여럿이 동시에 가질 수 있다.** "값이 없다(`null`)와 뜻이 다르다"는 기존 문장은 그대로 살린다.

### 7. 그룹 생성 응답 3필드는 DTO에만 받는다

`CreateParfaitGroupResponse`에 필드를 더하되 `CreatedGroupVO`는 건드리지 않는다 — 결정 5와 같은 이유다
(A-005는 생성 직후 목록으로 돌아가며 목록을 다시 읽으므로 소비할 값이 없다).

⚠️ 계약 문서에 적어 둔 함정 하나가 여기 걸린다 — **같은 필드의 출처가 엔드포인트마다 다르다**
(목록은 `parfait_group.created_at`, 생성은 `updatedAt`). 지금은 읽지 않으니 무해하지만, 읽게 되는 날
두 값이 같다고 가정하면 안 된다 → OQ-P-235 ③.

## 화면 반영

| 자리 | 지금(선행 라운드 결과) | 바꿈 |
|---|---|---|
| S-101 멤버 칩 | `member.nametagChip` → 12종 1:1 | **동작은 같고 키만 살아난다**(지금은 `null`이라 전부 `Default`) |
| G-001 그룹 칩 | `lastPlacedByNametagChip` → 짝 묶음 | 동상 |
| G-001 경과시간 | 매퍼가 던져 **목록 전체 실패** | KST 부여로 복구 |
| C-001 상단 멤버 칩 | `NAMETAG_CHIP_PALETTE[index % 7]` | `member.nametagChip` → 12종 1:1, 없으면 `Default` |

앞의 둘이 "바꿈"에 코드 변경이 없는 것이 이 라운드의 성격을 보여 준다 — **선행 라운드의 코드는 옳았고
키만 어긋나 있었다.**

## 범위 밖

- **DTO 비널화** — 결정 1 참고. 서버가 좁혔지만 앱은 따라가지 않는다.
- **와이어 계약 테스트** — 결정 1의 경고 참고. 붙이지 않기로 한 범위 결정이다.
- **칩→색 변환 공용화 / 새 모듈 간선** — 결정 4 참고.
- **`ToppingPlacerVO` 칩 승격** — 결정 5 참고. 소비 화면이 생길 때.
- **`YGColorChipType.Default`의 색 구분·글자 대비** — OQ-P-226. 디자인 소관이고 PR #298과 같이 정한다.
- **`http/` 요청 모음** — 엔드포인트가 안 늘어 커버 25/27 그대로. 신규 필드는 전부 응답이다.
- **실기기·실서버 확인** — 이 저장소의 모든 계약 라운드와 같이 코드 대조까지다. ④는 실서버를 한 번만
  쏴 보면 즉시 드러났을 종류라는 점은 기록해 둔다.

## 테스트

TDD로 간다. 매퍼 단독 테스트는 만들지 않는다(규약) — 판단이 든 변환은 DataSource 테스트 케이스로.

커버 대상은 **메모리 상태(ViewModel)와 매핑·에러 경계**다. 프레임워크·라이브러리 동작
(`kotlinx.serialization`이 `@SerialName`을 존중하는지 따위)은 대상이 아니다.

| 대상 | 잠글 것 |
|---|---|
| `ParfaitGroupRemoteDataSourceImplTest` | 오프셋 없는 `"2026-08-01T12:00:00"`이 **KST 기준 `Instant`**가 된다 · `"DEFAULT"` · `null` · 미지 문자열 → `null` |
| 파르페 DataSource 테스트 | `groupMembers[].nameTagChip`이 `CanvasMemberVO`로 온다 · 없으면 `null` |
| `ColorChipType`(canvas, 신설) | 12갈래 전부 · `DEFAULT` → `Default` · `null` → `Default` |
| 기존 두 util 테스트 | `RELEASED` 케이스를 `DEFAULT`로 |
| `CanvasMainViewModelTest` | 상단 칩이 **인덱스가 아니라 서버 값**에서 온다 · 칩이 없는 멤버는 `Default` · **멤버 하나가 빠져도 남은 사람 색이 안 밀린다**(선행 인덱스 규칙의 실패 모드를 직접 잠근다) |

시각 파싱은 이 라운드가 고치는 **버그의 본체**라 경계를 함께 잠근다 — 자정 직전·직후 값이 KST 기준
같은 날로 읽히는지. 시간대·자정 넘김은 표준 edge-case 목록에 있는 항목이고, 이번 사고가 정확히 그 부류다.

**널 허용 유지의 대가로 못 잡는 것을 여기 명시한다** — 위 어떤 테스트도 `@SerialName` 문자열이 서버와
같은지는 검증하지 않는다. 전부 DTO 객체를 직접 만들어 넣기 때문이다.

## 열린 질문

- **키 리네임을 계약 문서 감사 말고 잡을 수단이 없다** → OQ-P-234.
- **`recentImageUploadedAt`이 두 뜻을 겸한다** — 토핑이 없으면 그룹 생성 시각이라, G-001이 활동 0건 그룹에도
  경과시간을 그린다. 가르려면 `recentImageUrl`이 `null`인지를 함께 봐야 한다 → OQ-P-235.
- **같은 규칙의 칩 변환이 두 벌** → 결정 4. 공용화 자리와 모듈 간선 결정이 남는다.
- **`ToppingPlacerVO` 칩 승격 시점** → 결정 5. 서버 쪽 선행 조건은 이번에 사라졌다.
- **칩 배정 규칙이 정책 문서에 없다** — `DEFAULT`도 정책 밖이다 → OQ-P-223.
