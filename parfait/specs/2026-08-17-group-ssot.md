---
id: group-ssot
title: 그룹 목록·상세 인메모리 SSoT — Flow 구독 + 명시적 갱신 (Group SSoT)
status: planned
category: behavior-spec
platforms: android
verified:
related_code: ParfaitGroupRepository, ParfaitGroupRepositoryImpl, GroupLocalDataSource, GroupLocalDataSourceImpl, ParfaitGroupRemoteDataSource, MyParfaitGroupVO, ParfaitGroupDetailVO, GroupDetailVO, GetMyGroupsUseCase, GetMyGroupsFlowUseCase, RefreshMyGroupsUseCase, GetGroupDetailUseCase, RefreshGroupDetailUseCase, ChangeGroupNicknameUseCase, JoinGroupUseCase, CreateGroupUseCase, LeaveGroupUseCase, ReportGroupUseCase, GroupListViewModel, CanvasMainViewModel, GroupSettingViewModel, LogoutUseCase, TokenAuthenticator
related_adr: ADR-0023, ADR-0022, ADR-0001, ADR-0009, ADR-0020
related_spec: user-info-ssot, s101-group-setting-api, c001-canvas-today-detail
related_architecture: data-layer, state-management
supersedes:
superseded_by:
tags: [spec, parfait, group, state, cache]
---

# Spec: 그룹 목록·상세 인메모리 SSoT

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처. 본문은 설계 내용에 집중.

## 목표

그룹 목록과 그룹 상세를 `:data`의 인메모리 저장소 한 벌에 두고, 화면은 그것을 `Flow`로
구독한다. 그룹을 만들거나 참여하거나 나가면 그 사실이 저장소에 반영되고, 목록·캔버스·설정
어느 화면이 열려 있든 같은 값을 본다.

지금은 그룹 정보를 화면마다 따로 조회하고, 조회 결과는 그 화면의 `UiState`에만 산다.
그래서 세 가지가 실제로 어긋나 있다.

- **생성·참여 직후 목록이 갱신되지 않는다.** 두 흐름 모두 `goToSingleClearTop(NavKeyGroupList)`로
  목록에 돌아오는데, `Navigator`의 그 함수는 이미 백스택에 있는 목적지를 **재사용**한다.
  `GroupListViewModel`은 살아 있고 조회는 `init`에서만 하므로 방금 만든 그룹이 목록에 없다.
  사용자가 pull-to-refresh를 해야 나타난다.
- **같은 사실을 두 번 부른다.** `GetGroupDetailUseCase`는 그룹명을 얻으려고 상세 조회 뒤
  `getMyGroups()`를 한 번 더 부른다. 서버 상세 응답에 `groupName`이 없기 때문이다.
- **캔버스는 그룹명을 모른다.** `CanvasMainViewModel`이 하드코딩 문자열을 쓴다.

계정 정보는 이미 같은 문제를 로컬 SSoT로 풀었다([ADR-0022](../adr/0022-user-info-local-ssot.md)).
이 스펙은 그 형태를 그룹에 적용하되, **영속하지 않는다**는 점만 다르다(근거는
[ADR-0023](../adr/0023-group-in-memory-ssot.md)).

## 범위

**포함**

- `:data`에 `GroupLocalDataSource`(인메모리) 신설, `ParfaitGroupRepositoryImpl`이 원격·로컬을 조율
- 조회 UseCase를 구독용(`Flow`)과 갱신용(`suspend`)으로 분리
- `GroupListViewModel`·`CanvasMainViewModel`·`GroupSettingViewModel`을 구독 방식으로 이관
- 세션 종료 시 캐시 정리(`LogoutUseCase`·`TokenAuthenticator`)

**제외**

- **폴링**. 이 스펙은 폴링이 붙을 자리(주기적으로 `refreshMyGroups()`를 부르는 트리거)를 남길 뿐
  구현하지 않는다.
- **영속**. 앱을 껐다 켜면 캐시는 비어 있고 첫 조회를 기다린다.
- **멤버 VO 통합**. `ParfaitGroupMemberVO`(계정 id 축)와 `CanvasMemberVO`(멤버십 행 id 축)는
  서버가 같은 쿼리 결과를 서로 다른 id로 투영해서 생긴 둘이다. 합치려면 서버가 두 id를 함께
  실어야 하므로 이번 범위 밖이고, 그 전까지 캔버스 멤버 칩은 캔버스 응답을 계속 쓴다.
- **`remainingCount`·컬러칩 배정** 등 S-101이 남긴 mock. 서버 계약 공백이라 이 작업으로 닫히지 않는다.

## 저장소 구조

`GroupLocalDataSource`는 IO가 없으므로 모든 함수가 non-suspend다.

- `myGroups: StateFlow<List<MyParfaitGroupVO>?>` — **`null`은 "아직 한 번도 못 받음"**,
  `emptyList()`는 "받아 봤는데 그룹이 없음"이다. 이 둘이 같아지면 목록 화면이 빈 상태·0건 온보딩
  툴팁을 조회 전에 띄우고, 첫 조회 실패와 그룹 0건도 구분하지 못한다.
- `groupDetail(groupId): Flow<ParfaitGroupDetailVO?>` — 내부 `Map<GroupId, ParfaitGroupDetailVO>`를
  `map` + `distinctUntilChanged`로 좁힌다. 다른 그룹 상세가 갱신됐다고 이 구독자가 재방출되지 않는다.
- 쓰기 4종: `saveMyGroups`·`saveGroupDetail`·`removeGroup`·`clear`.
  상태 변경은 전부 `MutableStateFlow.update {}`로 한다(읽고 쓰는 사이에 다른 갱신이 끼면
  덮어써지므로).

`ParfaitGroupRepository`는 읽기 둘(`myGroups`·`groupDetail`)과 갱신 둘(`refreshMyGroups`·
`refreshGroupDetail`)을 노출하고, 기존 명령형 함수(생성·참여·닉네임 변경·나가기·신고)는
시그니처를 유지한 채 성공 직후 캐시를 갱신한다.

**갱신 함수는 데이터를 돌려주지 않는다**(`Result<Unit>`). 값을 얻는 길이 `Flow` 하나여야 화면이
반환값을 쓰기 시작하지 않는다 — 둘 다 주면 캐시는 곧 두 번째 출처가 된다.

**그룹명 합성은 `:data`가 아니라 `GetGroupDetailUseCase`가 한다.** 저장소는 "서버가 준 사실 하나 =
캐시 하나"만 지키고, 목록 캐시의 이름과 상세 캐시를 `combine`해 `GroupDetailVO`를 만드는 것은
domain 몫이다. 서버가 상세에 `groupName`을 실어 주면 `combine`만 걷어내면 된다.

## 갱신·무효화 규칙

캐시가 바뀌는 시점은 아래 일곱뿐이다.

| 시점 | 캐시 동작 | 실패 시 |
|---|---|---|
| `refreshMyGroups()` | 목록 통째 교체 | 캐시 불변, `Result.failure` |
| `refreshGroupDetail(groupId)` | 그 그룹 엔트리만 교체 | 캐시 불변, `Result.failure` |
| 그룹 생성 성공 | 이어서 `refreshMyGroups()` | 재조회 실패해도 생성은 `success` |
| 그룹 참여 성공 | 이어서 `refreshMyGroups()` | 재조회 실패해도 참여는 `success` |
| 내 닉네임 변경 성공 | 이어서 `refreshGroupDetail(groupId)` | 재조회 실패해도 변경은 `success` |
| 나가기·신고 성공 | `removeGroup(groupId)` — 목록에서 제거 + 상세 엔트리 폐기 | — |
| 로그아웃·강제 로그아웃 | `clear()` | — |

**생성·참여 후 재조회하는 이유**: 응답(`CreatedGroupVO`·`JoinedGroupVO`)에는 `recentImageUrl`과
`recentImageUploadedAt`이 없어 `MyParfaitGroupVO`를 세울 수 없다. 빈 값으로 껍데기를 끼워 넣으면
목록의 활동순 정렬이 어긋난다. 재조회 실패가 이미 성공한 조작을 실패로 되돌리지 않는 것은
ADR-0022의 닉네임 폴백과 같은 판단이다.

**닉네임 변경도 재조회하는 이유**: 응답은 `groupId`와 바뀐 닉네임뿐이라, 캐시의 `members`에서
"내" 항목을 짚으려면 계정 `memberId`가 필요하다. 저장소가 그것을 알려면 `MemberRepository`를
끌어와 저장소끼리 엮인다. 대신 서버를 한 번 더 부른다 — 닉네임 변경은 드물고, 왕복 동안 화면은
이미 로딩으로 덮여 있다.

**나가기·신고 후 재조회하지 않는 이유**: 그 그룹은 이후 모든 호출이 403 `GROUP_NOT_JOINED`다.
목록에서 지우는 것이 서버 상태와 일치하고 재조회는 낭비다.

**세션 종료 정리**: `LogoutUseCase`가 "무엇을 지우는가"의 단일 자리이므로(ADR-0022) 그룹 캐시
정리를 여기에 더한다. 강제 로그아웃도 `TokenAuthenticator`가 토큰을 지우는 그 자리에서 함께
지운다. 인메모리라 **프로세스가 살아 있는 채 계정이 바뀌면 이전 계정의 그룹이 남는 것**이 실제
위험이다.

## 화면

**UseCase** — 조회가 구독과 갱신으로 갈라진다.

- `GetMyGroupsUseCase`(suspend) → `GetMyGroupsFlowUseCase`(Flow) + `RefreshMyGroupsUseCase`
- `GetGroupDetailUseCase`는 `Flow<GroupDetailVO?>`를 돌려주고 이름 합성을 담당,
  `RefreshGroupDetailUseCase` 신설

이름은 계정 SSoT 선례(`GetMyAccountFlowUseCase`·`RefreshMyAccountUseCase`)를 따른다.

**G-001 그룹 목록**(`GroupListViewModel`)

- `init`에서 캐시를 구독하고 갱신을 1회 부른다. `Refresh` 인텐트는 갱신만 부른다.
- 생성·참여·나가기·신고 후 목록이 스스로 갱신된다. `goToSingleClearTop`이 기존 엔트리를 재사용해
  `init`이 다시 돌지 않아도, 캐시가 이미 새 목록을 들고 있어 `Flow`가 방출한다.
- 갱신 실패 시 에러 화면으로 넘기는 **현행 규칙을 유지한다**. 캐시가 있어도 마찬가지다 —
  실패를 알릴 다른 자리가 없다는 기존 판단이 그대로 유효하다.
- `UiState.groupList`를 nullable로 바꾼다. "미조회"와 "0건"이 갈려야 빈 상태 표현이 정확해진다.

**C-001 캔버스**(`CanvasMainViewModel`)

- 하드코딩 그룹명을 제거하고 목록 캐시에서 `groupId`로 찾아 구독한다.
- 캐시가 비어 있는 진입 경로(프로세스 재시작 후 캔버스 복귀)에서만 `RefreshMyGroupsUseCase`를
  1회 부른다. 실패해도 캔버스는 그대로 그린다 — 이름 한 줄 때문에 캔버스를 막지 않는다.
- 멤버 칩은 캔버스 응답을 계속 쓴다(범위 제외 항목 참고).

**S-101 그룹 설정**(`GroupSettingViewModel`)

- `init`에서 상세를 구독하고 갱신을 1회 부른다. 캐시가 있으면 첫 프레임부터 값이 있고
  `isLoadingDetail`은 캐시가 없을 때만 참이다.
- 닉네임 변경 성공 후의 수동 상태 갱신이 사라진다 — 재조회 결과가 `Flow`로 내려온다.
- 나가기·신고 성공 시 캐시 제거는 저장소가 한다. 화면은 지금처럼 목록으로 나간다.

**그룹 생성·참여**(`GroupCreateViewModel`·`GroupNickNameViewModel`) — 화면 코드는 바뀌지 않는다.

## 테스트

- **`GroupLocalDataSourceImpl`** — mock이 아니라 실물로 검증한다. 초기 `null`과
  `saveMyGroups(emptyList())` 이후 `emptyList()`가 구분되는지, `removeGroup`이 목록과 상세를 **둘 다**
  지우는지(한쪽만 지우면 나간 그룹의 상세가 남아 다음 진입에서 유령 화면이 뜬다), 다른 그룹 상세
  저장이 구독자를 재방출시키지 않는지, `clear()` 후 `null`로 되돌아가는지.
- **`ParfaitGroupRepositoryImpl`** — 위 갱신 표를 그대로 단언한다. 특히 갱신 실패가 캐시를
  건드리지 않는지, 생성·참여의 후속 재조회가 실패해도 결과가 `success`로 남는지.
- **`GetGroupDetailUseCase`** — 목록 캐시가 비어 있어도 상세가 나오는지(이름은 빈 값), 목록 캐시가
  늦게 채워지면 이름만 갱신돼 재방출되는지.
- **ViewModel** — 목록은 캐시 방출만으로 상태가 갱신되는지와 갱신 실패 시 에러 화면 규칙이
  유지되는지, 설정은 캐시가 있을 때 로딩이 처음부터 거짓인지와 닉네임 변경 후 값이 재조회
  방출로 바뀌는지.
- **`LogoutUseCase`** — 토큰·계정 정보·그룹 캐시 셋을 모두 지우는지. 강제 로그아웃 경로도 같다.

`Flow` 단언은 Turbine을 쓴다. 매퍼 단독 테스트는 만들지 않고 DataSource 테스트 케이스로 덮는
기존 관례를 유지한다.

## 열린 질문

- **멤버 응답 id 통일**은 서버 변경이 필요하다. 두 응답이 계정 id와 멤버십 행 id를 함께 실으면
  VO가 하나로 합쳐지고 캔버스 멤버 칩까지 상세 캐시가 흡수한다. 같은 변경이 `parfait/api/parfait.md`가
  적어 둔 미결(탈퇴 멤버 토핑의 `placedBy.groupMemberId`가 `groupMembers`에 없어 조인이 성립하지
  않는 문제)도 함께 정리한다.
- **낡은 값을 알릴 수단이 없다.** 목록은 갱신 실패를 에러 화면으로 알리지만, 캔버스가 캐시에서
  읽는 그룹명은 갱신 실패를 표현할 자리가 없다. ADR-0022가 계정 정보에서 남긴 것과 같은 공백이다.
- **폴링 주기와 트리거 위치**가 미정이다. 이 스펙은 캐시 구조만 세운다.
