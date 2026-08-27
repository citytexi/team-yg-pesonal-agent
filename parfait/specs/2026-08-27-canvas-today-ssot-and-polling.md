---
id: canvas-today-ssot-polling
title: 오늘 캔버스 인메모리 SSoT · 배경 탭 토핑 렌더링 · 주기 폴링 (Canvas Today SSoT & Polling)
status: draft
category: behavior-spec
platforms: android
verified: 2026-08-27
related_code: CanvasBGEditScreen, CanvasBGEditViewModel, CanvasBGEditUiState, CanvasBGEditIntent, CanvasToppingItem, CanvasMainViewModel, CanvasMainUiState, CanvasMainIntent, CanvasToppingPlaceViewModel, CanvasToppingPlaceUiState, ParfaitRepository, ParfaitRepositoryImpl, ParfaitRemoteDataSource, CanvasLocalDataSource, CanvasLocalDataSourceImpl, GetTodayParfaitUseCase, GetTodayParfaitFlowUseCase, RefreshTodayParfaitUseCase, GetParfaitDetailUseCase, CanvasVO, CanvasToppingVO, ToppingTransform, ToppingDraftRepository, AddToppingUseCase, UpdateToppingUseCase, DeleteToppingUseCase, LogoutUseCase, TokenAuthenticator, CanvasToppingLayer, parfaitToday
related_adr: ADR-0029, ADR-0023, ADR-0022, ADR-0026, ADR-0025, ADR-0009, ADR-0020
related_spec: group-ssot, c001-canvas-today-detail, c001-canvas-main, c106-topping-place, c301-canvas-background-edit, c301-topping-edit-tab, screen-resume-refetch
related_architecture: data-layer, state-management
supersedes:
superseded_by:
tags: [spec, parfait, canvas, state, cache, polling]
---

# Spec: 오늘 캔버스 인메모리 SSoT · 배경 탭 토핑 렌더링 · 주기 폴링

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처. 본문은 설계 내용에 집중.

## 목표

같은 오늘 캔버스를 쓰는 세 화면이 지금은 각자 서버를 부르고, 받은 값을 각자의 `UiState`에만
둔다. 이 스펙은 그 값을 `:data`의 인메모리 저장소 한 벌로 옮겨 세 화면이 구독하게 하고, 그
저장소 위에 주기 폴링을 얹어 다른 멤버가 올린 토핑이 화면을 나갔다 오지 않아도 나타나게 한다.
함께, 배경 편집 화면의 배경 탭에서 토핑이 아예 그려지지 않던 것을 고친다.

지금 어긋나 있는 것은 셋이다.

- **같은 사실을 세 번 부른다.** `CanvasMainViewModel`·`CanvasBGEditViewModel`·
  `CanvasToppingPlaceViewModel`이 각자 `GetTodayParfaitUseCase(groupId)`를 부르고, 결과를 각자의
  모양(`CanvasVO` / `CanvasToppingItem` / `CanvasToppingVO`)으로 따로 매핑한다. 세 화면이 공유하는
  지점은 없다.
- **배경 탭에서 토핑이 사라진다.** `CanvasBGEditScreen`이 토핑 레이어 전체를 `selectedTab ==
  CanvasEditTab.TOPPING` 조건으로 감싸고 있어, 배경을 고르는 동안에는 그 캔버스에 무엇이 올라가
  있는지 보이지 않는다. 배경은 토핑과 함께 보고 골라야 하는 값이다.
- **남이 올린 토핑이 늦게 온다.** 갱신 시점이 화면 재진입(`Enter`)뿐이라, 캔버스를 열어 둔 채로는
  다른 멤버의 토핑이 영영 나타나지 않는다.

그룹 정보는 이미 같은 문제를 인메모리 SSoT로 풀었다([ADR-0023](../adr/0023-group-in-memory-ssot.md),
[group-ssot](archive/2026-08-17-group-ssot.md)). 그 ADR은 "폴링을 붙일 자리가 저장소 한 곳으로
정해진다"고 적어 두었고, 이 스펙이 그 자리를 캔버스에서 실제로 채운다.

## 범위

**포함**

- `:data`에 `CanvasLocalDataSource`(인메모리) 신설, `ParfaitRepositoryImpl`이 원격·로컬을 조율
- 오늘 캔버스 조회 UseCase를 구독용(`Flow`)과 갱신용(`suspend`)으로 분리
- 세 ViewModel을 구독 방식으로 이관
- 배경 편집 화면의 배경 탭에서 토핑을 반투명·비상호작용으로 렌더링
- 저장소 층 주기 폴링과, 폴링이 편집 중인 배치를 덮지 않게 하는 병합 규칙
- 토핑 배치 확정 시점의 `positionZ` 재계산
- 세션 종료 시 캔버스 캐시 정리

**제외**

- **지난 날 캔버스의 캐시화.** 저장소가 소유하는 것은 **그룹별 오늘 캔버스 한 벌**뿐이다. 달력으로
  고른 지난 날 상세는 지금처럼 `CanvasMainViewModel`이 조회해 자기 상태에 들고 있는다. 마감된
  날은 바뀌지 않아 공유해 얻을 것이 없고, `Map<ParfaitId, CanvasVO>`로 넓히면 무효화 규칙이
  날짜 축까지 따라온다.
- **영속.** 앱을 껐다 켜면 캐시는 비어 있고 첫 조회를 기다린다(ADR-0023과 같은 판단).
- **쓰기 후 즉시 캐시 갱신.** 배경 저장·토핑 추가가 끝나면 캔버스 메인으로 되감기고 그 `Enter`가
  재조회하는 지금 흐름을 그대로 둔다. 달라지는 것은 그 한 번의 조회 결과가 세 화면 모두에
  전파된다는 점뿐이다.
- **푸시 기반 갱신.** 폴링만 다룬다.
- **`CanvasEditRoute`·`CanvasImageSelectRoute`·`CanvasMoveRoute`.** `NavKeyCanvasEdit` 계열로만
  이어진 유휴 화면이라 이 작업의 대상이 아니다.
- **Compose UI 테스트 하니스.** `feature/groups/canvas/impl`은 `test` 소스셋만 두고
  `parfait.test.unit` 하나만 쓴다. 화면 변경의 검증은 `@YGPreview`와 수동 확인으로 하고,
  `androidTest`·Robolectric 설정은 이 작업에서 세우지 않는다.

## 스택 PR 구성

세 단계를 스택 PR로 쌓는다. 아래 순서는 의존 방향이 아니라 **머지 순서**다 — PR1은 화면
단독 변경이라 PR2·PR3과 겹치는 파일이 사실상 없고, 가장 작아 먼저 나간다.

| 단계 | 내용 | 주로 건드리는 곳 |
|------|------|------------------|
| PR1 | 배경 탭 토핑 렌더링 | `CanvasBGEditScreen` |
| PR2 | 오늘 캔버스 인메모리 SSoT | `:data` 저장소·`ParfaitRepository`·UseCase·세 ViewModel |
| PR3 | 주기 폴링 + 병합 규칙 + `positionZ` 재계산 | 저장소 폴링 트리거·`CanvasBGEditViewModel`·`CanvasToppingPlaceViewModel` |

> **계획 단계에서 더 쪼개도 된다.** `writing-plans`로 구현 계획을 세울 때 한 단계가 너무 커진다고
> 판단되면 `PR1-1`·`PR1-2`처럼 하위 번호로 나눠 스택을 늘려도 된다. 위 표는 최소 경계이지 상한이
> 아니다. 나눌 때 지켜야 할 것은 두 가지다 — **각 PR이 혼자서 빌드·테스트를 통과할 것**, 그리고
> **아래 각 절이 정한 결정을 하위 PR들이 나눠 갖되 바꾸지는 말 것**.

---

## PR1 — 배경 탭 토핑 렌더링

### 목표 동작

배경 탭에서도 그 캔버스에 올라간 토핑이 전부 보인다. 내 것과 남의 것을 가리지 않고 **불투명도
0.5**로 그리며, **어떤 터치 이벤트도 받지 않는다**. 배경을 고르는 화면이지 토핑을 고르는 화면이
아니므로, 토핑은 배경 선택의 참고로만 존재한다.

### 무엇을 바꾸는가

`CanvasBGEditScreen`에서 토핑 레이어를 감싸고 있는 `selectedTab == CanvasEditTab.TOPPING` 조건을
걷어내고, **그리기와 상호작용을 분리**한다. 두 탭이 공유하는 것은 저장된 배치대로 토핑 이미지를
겹쳐 그리는 부분뿐이고, 그 위에 얹히는 것은 전부 토핑 탭 전용이다.

배경 탭에서 붙이지 않는 것을 열거한다.

- 선택 UI의 `YGAtomicColors.Transparency.Black25` 딤 오버레이. 이것은 "남의 토핑과 내 토핑을
  가르는 층"이지 반투명 표현이 아니다.
- 탭·드래그 입력 레이어(`toppingTapInput`·`toppingDragInput`).
- 선택된 토핑의 `ToppingSelectionStroke`와 `ToppingCornerButtons`.
- `CanvasToppingImage`의 `semantics { role = Role.Button; onClick { … } }`. 접근성 서비스에도
  버튼으로 보이면 안 된다 — 실제로 누를 수 없기 때문이다.

`rememberBGEditHitEntries`가 요청하는 알파 마스크(`rememberToppingAlphaMasks`)도 배경 탭에서는
필요 없다. 마스크는 탭 판정에만 쓰이고 그리기에는 `painter`만 있으면 된다.

### 불투명도

`CanvasToppingImage`에 `alpha: Float = 1f` 파라미터를 더해, 이미 있는
`graphicsLayer(rotationZ = …)` 호출에 함께 넘긴다. 배경 탭이면 `0.5f`, 토핑 탭이면 `1f`다.
값은 이 화면 파일의 이름 있는 상수로 둔다.

레이어 하나에 `alpha`를 주므로 토핑 이미지와 그 테두리(`YGToppingCutoutImage`의 `borderColor`)가
함께 반투명해진다. 이미지와 테두리가 각각 반투명해져 겹치는 자리만 진해지는 일은 생기지 않는다.

### 배치·크기

토핑의 위치·크기는 전부 Canvas-Area 대비 비율이다(`CanvasToppingItem` 문서 참고). 두 탭에서
캔버스 박스를 감싸는 상하 패딩이 다르지만(배경 탭은 위아래 `padding4`, 토핑 탭은 위 60dp·아래
14dp) 그 때문에 박스 크기가 달라져도 토핑 자리는 비율로 따라오므로 별도 보정이 없다.

### 검증

`@YGPreview`를 배경 탭·토핑 탭 각각으로 늘려 눈으로 확인한다. ViewModel은 건드리지 않으므로
기존 `CanvasBGEditViewModelTest`는 그대로다.

---

## PR2 — 오늘 캔버스 인메모리 SSoT

### 저장소 구조

`CanvasLocalDataSource`는 IO가 없으므로 모든 함수가 non-suspend다.

```kotlin
interface CanvasLocalDataSource {
    /** 미조회면 null. 오늘 캔버스는 서버가 없으면 만들어 주므로 "0건"이라는 상태가 없다 */
    fun todayCanvas(groupId: GroupId): Flow<CanvasVO?>

    fun saveTodayCanvas(groupId: GroupId, canvas: CanvasVO)

    fun clear()
}
```

구현은 `@Singleton` + `MutableStateFlow<Map<GroupId, CanvasVO>>` 하나이고, 읽기는 그 맵을 한
그룹으로 좁혀 `distinctUntilChanged`를 건다. `GroupLocalDataSourceImpl.groupDetail`과 같은
이유다 — 좁히지 않으면 남의 그룹 캔버스가 저장될 때마다 이 구독자까지 재방출된다.

`CanvasVO`에 `groupId`가 없어 저장 함수가 그것을 따로 받는다.

### Repository

`ParfaitRepository`에서 기존 `suspend fun getTodayCanvas(groupId): Result<CanvasVO>`를 **없애고**
둘로 가른다.

```kotlin
fun todayCanvas(groupId: GroupId): Flow<CanvasVO?>

suspend fun refreshTodayCanvas(groupId: GroupId): Result<Unit>
```

갱신 함수가 `Result<Unit>`만 돌려주는 것은 ADR-0023이 세운 규칙을 그대로 따르는 것이다 — 값을
얻는 길이 둘이면 캐시는 곧 두 번째 출처가 된다.

`getYears`·`getPastCanvases`·`getCanvasDetail`·`changeCanvasBackground`는 그대로 둔다.
지난 날 상세는 이 캐시가 소유하지 않는다.

### UseCase

`GetTodayParfaitUseCase`는 **하루 경계에서 어제 캔버스를 받으면 한 번만 다시 부르는** 판단을
들고 있다. 그 판단은 갱신 쪽에 남는다.

- `RefreshTodayParfaitUseCase` — 기존 `GetTodayParfaitUseCase`의 내용을 그대로 옮기고 반환만
  `Result<Unit>`으로 바꾼다. 성공하면 저장소에 실린다.
- `GetTodayParfaitFlowUseCase` — `repository.todayCanvas(groupId)`를 그대로 흘리되,
  **`canvas.date != parfaitToday()`인 값을 null로 거른다.**

이 필터가 지금 `CanvasMainViewModel.syncToday()`가 손으로 `todayCanvas = null`을 대입하던 자리를
대체한다. 저장소는 시계를 모르고 알 필요도 없다 — 낡음 판정은 읽는 쪽이 한다. 그래야 화면을
열어 둔 채 파르페 하루 경계(새벽 3시)를 넘겨도 어제 캔버스가 오늘 자리에 남지 않는다.

### 화면 이관

**`CanvasMainViewModel`**

`loadTodayCanvas()`의 조회가 구독으로 바뀐다. 진입 재조회(`CanvasMainIntent.Enter`)는 그대로
남되 `RefreshTodayParfaitUseCase`를 부르고, 결과는 저장소를 거쳐 상태에 온다.

지금 `todayCanvas`와 `viewedCanvas` 두 필드가 오늘을 볼 때는 같은 값을 들고 있다. 이관하면서
이 중복을 없앤다 — `todayCanvas`는 구독 값이고, 지난 날 캔버스를 담는 필드는
`pastCanvas`(가칭)로 좁히며, 화면이 그리는 것은 파생값이다.

```kotlin
val displayedCanvas: CanvasVO?
    get() = if (isViewingToday) todayCanvas else pastCanvas
```

`canvasBackground`·`toppings`·`isCanvasEmpty`·`spotlightedTopping`이 전부 이 파생값을 본다.
`syncToday()`는 날짜·달력 위치만 옮기고 캔버스를 비우는 일은 하지 않는다.

`memberChips`는 지금 오늘 캔버스 응답에서 나온다. 구독 값이 바뀔 때마다 다시 세우면 되고,
색은 서버가 배정한 값을 그대로 쓰는 기존 규칙을 유지한다.

**`CanvasBGEditViewModel`**

`loadCanvas()`가 구독으로 바뀐다. **편집을 연 캔버스와 구독 값의 `parfaitId`가 다르면 구독
쪽으로 옮기는** 기존 판단은 그대로 살린다(편집 중 하루 경계를 넘긴 경우). 서버에서 막 받아온
스냅샷 `confirmedToppings`는 구독 값이 바뀔 때 갱신한다.

**`CanvasToppingPlaceViewModel`**

`loadCanvasIfNeeded(groupId)`와 `canvasLoadedForGroupId` 가드가 사라지고, 초안이 알려 준
`groupId`로 구독한다. 캔버스를 못 받아도 토핑 배치 자체는 막지 않는 기존 규칙(기본 배경·빈 토핑
목록으로 그대로 둔다)을 유지한다.

### 세션 종료 정리

인메모리라 프로세스가 살아 있는 계정 전환에서 이전 계정의 캔버스가 남는 것이 실제 위험이다.
`LogoutUseCase`가 그룹 캐시를 지우는 자리에 캔버스 캐시 정리를 함께 넣고, 강제 로그아웃
경로(`TokenAuthenticator`)도 같다. 정리 순서는 group-ssot가 정한 as-built를 따른다 — 계정 정보
정리는 DataStore IO라 던질 수 있으므로 **인메모리 캐시 정리를 그 앞에 둔다.**

### 검증

`CanvasLocalDataSourceImpl`은 미조회(`null`)와 저장 후 값을 구분해 단언하고, 한 그룹의 저장이
다른 그룹 구독자를 재방출시키지 않는 것을 고정한다. `GetTodayParfaitFlowUseCase`는 날짜가 어긋난
캔버스를 null로 거르는 것을 고정한다. 세 ViewModel 테스트는 조회 목킹을 구독 목킹으로 바꾼다.

---

## PR3 — 주기 폴링 · 병합 규칙 · `positionZ` 재계산

### 폴링을 어디에 두는가

**폴링은 화면이 아니라 저장소 층이 소유하고, 구독자가 있는 동안에만 돈다.** 주기는 5초이고
이름 있는 상수 하나로 둔다. 여러 화면이 겹쳐 구독해도 요청이 배로 늘지 않도록 그룹별 참조
계수로 하나에 묶는다.

화면마다 폴링 코루틴을 띄우지 않는 이유는 두 가지다. 첫째, 같은 로직이 세 곳에 생긴다. 둘째,
카메라·갤러리·누끼 흐름은 캔버스 화면들을 통째로 벗어나므로 화면 소유 폴링이면 흐름마다 멎고
켜지는 자리를 각각 손으로 관리해야 한다.

구독자가 사라지면 폴링이 멎는 것은 결함이 아니라 의도다. 카메라·갤러리가 떠 있는 동안에는
캔버스가 보이지 않아 신선하게 유지할 대상 자체가 없고, 돌아오는 순간 저장소가 한 번 즉시
조회하므로 사용자가 보는 첫 프레임은 최신이다.

캔버스 메인이 **지난 날을 보고 있는 동안에는 구독을 끊어** 폴링을 멈춘다. 마감된 날은 바뀌지
않으므로 오늘 캔버스를 계속 부를 이유가 없다.

> ADR-0023은 "구독이 생기면 저장소가 알아서 조회하는" stale-while-revalidate를 기각하면서
> "폴링은 이 구조 위에 트리거 하나를 더하는 형태"라고 적었다. 이 결정은 그 문장을 따르되,
> **그 트리거의 수명을 구독에 매단다**는 점을 ADR-0029가 명시적으로 새로 정한다. 캔버스가
> 세 화면에 걸쳐 있어 "누가 켜고 끄는가"를 화면에 두면 흐름마다 답이 갈리기 때문이다.

### 서버 부하

그룹 정원이 12명이므로 12명이 동시에 캔버스를 열고 있으면 한 그룹에 분당 144회의 오늘 조회가
몰린다. 오늘 조회는 서버에 캔버스가 없으면 만들어 저장하는 부작용이 있지만, 이 흐름에서는 이미
만들어진 것을 다시 받을 뿐이라 캔버스가 늘어나지는 않는다. 주기를 상수로 빼 두는 것은 실측 뒤
조정하기 위해서다.

### 배경 편집 화면의 병합

배경 편집 화면은 사용자가 옮긴 배치를 **확인을 누르기 전까지 로컬에만** 들고 있다. 폴링 응답이
그대로 덮으면 편집 중이던 배치가 되돌아간다.

사용자가 만질 수 있는 것은 자기 토핑뿐이므로, `CanvasBGEditUiState`에 손댄 토핑을 추적하는
집합을 둔다.

```kotlin
val dirtyToppingIds: Set<Long> = emptySet()
```

이동(`OnToppingMoveDrag`)·크기조절(`OnToppingResizeDrag`)·회전(`OnToppingRotateDrag`)·테두리 편집
결과(`OnToppingEditResult`)·삭제가 대상 토핑의 id를 이 집합에 넣는다.

폴링 응답이 오면 이렇게 병합한다.

- 집합에 **없는** 토핑은 서버 값으로 갈아 끼운다. 남이 올린 새 토핑도 이 경로로 화면에 나타난다.
- 집합에 **있는** 토핑은 로컬 값을 지킨다.
- 서버 목록에서 사라진 토핑은 화면에서도 뺀다. 집합에 있어도 마찬가지다 — 이미 없는 토핑에
  PATCH를 보낼 수 없다.

확인을 눌렀을 때 PATCH를 보내는 대상도 이 집합과 같다. 지금은 `confirmedToppings` 스냅샷과
대조해 바뀐 것을 골라내는데, 그 대조가 이 집합으로 대체된다.

> 이 규칙은 [open-questions](../synthesis/open-questions.md) OQ-P-219(통째 대입 갱신이 폴링과
> 사용자 조작이 겹칠 때 낡은 값으로 되돌린다)가 캔버스에서 나타난 형태를 닫는다. 그룹 목록 쪽
> 미결은 이 스펙이 다루지 않는다.

### 토핑 배치 화면의 `positionZ`

지금은 흐름에 들어서는 순간 `CanvasMainViewModel.startToppingFlow()`가
`max(positionZ) + 1`을 계산해 초안에 못 박는다. 카메라·누끼·편집을 거치는 사이 다른 멤버가
토핑을 올리면 그 값이 낡는다.

**확인을 누르는 시점에 구독 중인 캔버스에서 다시 센다.** 캔버스를 아직 못 받았으면 초안에 실린
값으로 물러선다. 깊이가 겹쳐도 서버가 막지는 않지만, 겹치면 정렬 동률이 되어 그리는 순서가
흔들린다.

초안이 `nextPositionZ`를 계속 싣는 것은 그대로 둔다 — 캔버스 조회가 실패했을 때의 폴백이고,
초안이 흐름의 대상 캔버스를 못 박는다는 ADR-0026의 결정은 바뀌지 않는다.

### 검증

폴링은 가상 시간(`runTest` + 테스트 디스패처)으로 고정한다 — 구독이 생기면 주기마다 갱신이
호출되고, 구독이 끊기면 더 호출되지 않으며, 두 구독자가 붙어도 주기당 한 번만 나가는 것을
단언한다. 병합은 `CanvasBGEditViewModelTest`에서 dirty 토핑이 폴링 응답에 덮이지 않는 것,
dirty 아닌 토핑이 갱신되는 것, 서버에서 사라진 토핑이 빠지는 것 셋을 각각 고정한다.
`positionZ` 재계산은 구독 값이 있을 때와 없을 때의 두 경로를 단언한다.

---

## 파일 구성

**신설**

| 파일 | 역할 |
|------|------|
| `data/source/parfait/local/CanvasLocalDataSource.kt` | 인터페이스 |
| `data/source/parfait/local/CanvasLocalDataSourceImpl.kt` | `@Singleton` 인메모리 구현 |
| `domain/usecase/parfait/GetTodayParfaitFlowUseCase.kt` | 구독 + 날짜 낡음 필터 |
| `domain/usecase/parfait/RefreshTodayParfaitUseCase.kt` | 기존 `GetTodayParfaitUseCase` 이관 |
| `parfait/adr/0029-canvas-today-ssot-polling.md` | 대응 ADR |

**변경**

| 파일 | 변경 |
|------|------|
| `CanvasBGEditScreen.kt` | 탭 게이트 분리, `alpha` 파라미터, 배경 탭 비상호작용 |
| `ParfaitRepository.kt` / `ParfaitRepositoryImpl.kt` | `getTodayCanvas` → `todayCanvas` + `refreshTodayCanvas` |
| `CanvasMainViewModel.kt` | 구독 이관, `viewedCanvas` → `pastCanvas` + `displayedCanvas` 파생 |
| `CanvasBGEditViewModel.kt` | 구독 이관, `dirtyToppingIds` 병합, PATCH 대상 판정 교체 |
| `CanvasToppingPlaceViewModel.kt` | 구독 이관, 확인 시 `positionZ` 재계산 |
| `LogoutUseCase.kt` / `TokenAuthenticator` | 캔버스 캐시 정리 추가 |
| DI 모듈 | `CanvasLocalDataSource` 바인딩 |

**삭제**

`GetTodayParfaitUseCase.kt`는 `RefreshTodayParfaitUseCase.kt`로 옮겨 가며 사라진다.

## 주의 / 열린 질문

- **폴링 주기 5초는 실측 전 값이다.** 그룹 정원 12명 기준 분당 144회가 한 그룹에 몰린다.
  상수 하나로 두므로 서버 부하를 보고 조정한다.
- **폴링 응답과 사용자 조작의 경합은 배경 편집 화면만 다룬다.** 캔버스 메인은 스포트라이트
  대상 토핑이 폴링 중 사라지면 `spotlightedTopping`이 null이 되어 저절로 Default로 돌아간다.
  토핑 배치 화면은 자기 토핑을 아직 서버에 올리지 않은 상태라 겹칠 값이 없다.
- **낡은 응답 순서는 다루지 않는다.** 폴링 요청이 겹쳐 늦게 출발한 응답이 먼저 도착하면 캐시가
  과거로 돌아갈 수 있다. 참조 계수로 그룹당 요청을 하나로 묶으므로 정상 경로에서는 겹치지
  않지만, 요청이 주기보다 오래 걸리면 열린다. 구현 계획에서 "이전 요청이 끝나지 않았으면
  이번 주기를 건너뛴다"로 닫는다.
- **`CanvasEditRoute`·`CanvasImageSelectRoute`·`CanvasMoveRoute`가 유휴 상태로 남는다.** 정리는
  이 작업의 범위가 아니지만, 배경 편집과 이름이 비슷해 다음 사람이 헷갈릴 자리다.
