---
id: c301-canvas-background-edit
title: C-301 캔버스 배경 편집 화면 (배경/토핑 탭 + 색 팔레트 + 카메라·갤러리 배경 선택)
status: implemented
category: ui-spec
platforms: android
verified: 2026-08-15
related_code: CanvasBGEditRoute, CanvasBGEditScreen, CanvasBGEditViewModel, CanvasBGEditUiState, CanvasEditTab, CanvasBackgroundPaletteColors, NavKeyCanvasBGEdit, PictureConfirmResult, NavKeyCameraCustom, NavKeyCustomGalleryPicker, NavKeyPictureConfirm, CANVAS_ASPECT_RATIO, YGFloatingBarEditTab, YGModalPopup, YGCanvasBackground
related_adr: ADR-0002, ADR-0005, ADR-0006, ADR-0007
related_spec: c001-canvas-main, c101-camera-picture-confirm, c102-custom-gallery-picker, c301-topping-edit-tab, designsystem-canvas-components, designsystem-bar-listdate-components
related_architecture: navigation-flow, design-system, state-management, module-structure
supersedes:
superseded_by:
tags: [spec, parfait, canvas, c301]
---

# Spec: C-301 캔버스 배경 편집 화면

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처. 본문은 설계 내용에 집중.
>
> 📌 **심볼 리네임(2026-08-17, #278)** — 아래 본문의 `CanvasImageAdd*`는 **당시 이름**이다. 현재 코드는 **`CanvasMain*`**(`NavKeyCanvasMain`·`CanvasMainRoute`/`Screen`/`ViewModel`/`UiState`/`Intent`/`Effect`, `strings.xml` 키 `canvas_main_*`). 이름만 바뀌고 시그니처·동작은 불변이라 본문은 기록대로 둔다.

> ⚠️ **사후 스펙(as-built)** — 선작성 스펙 없이 PR #231(`feature/background-edit-screen`)이
> develop에 머지됐다(2026-08-15). 아래는 머지 코드를 역기록한 것이며, 설계 대조가 아니라
> **규약(parfait)·정책(위키) 대조**로 드리프트를 표기한다.

> **화면 ID 판정** — 위키 [[기능정의서-v3]]이 C-301을 "캔버스 배경 변경"에서
> **"파르페 편집 모드 진입"(배경 변경 + 토핑 편집 통합 진입점)**으로 개편했고, 이 화면은
> 배경/토핑 두 탭을 가진 편집 모드 진입 화면이라 C-301에 해당한다. 코드 심볼은
> `CanvasBGEdit*`(배경만 가리키는 이름)이다. 위키에는 [[기능정의서-v6]]의 "에딧 모드 삭제"
> 비고와 C-301~C-306 표 잔존이 **미결로 남아 있다** — 코드가 C-301을 실물로 만든 것은
> 그 미결의 판단 재료다(위키 [[open-questions]] 소관).

## 목표
C-001 캔버스 메인에서 캔버스 편집 버튼으로 들어와, 캔버스 배경을 **팔레트 색 8종** 또는
**카메라·갤러리 이미지**로 고르고 확인/그만두기로 빠져나온다.

## 범위
- **포함**
  - `NavKeyCanvasBGEdit`(`data object`) 신설 + `featureCanvasEntryBuilder`에 entry 추가(규약 기본형
    `YGScaffold { innerPadding -> … }`).
  - `CanvasBGEditRoute`·`CanvasBGEditScreen`·`CanvasBGEditViewModel` 신설(MVI 3분할).
  - 배경 미리보기(9:16) + 팔레트 행(갤러리·카메라 원 2종 + 색 원 8종, 가로 스크롤) +
    `YGFloatingBarEditTab`(배경/토핑 탭 + 닫기 + 확인).
  - 그만두기 확인 모달(`YGModalPopup`) — 닫기 버튼이 곧바로 나가지 않고 모달을 거친다.
  - **재사용 진입 플래그** — `NavKeyCameraCustom`·`NavKeyCustomGalleryPicker`가 `data object`에서
    `data class(showGuideToast, returnResultOnly)`로 바뀌고, `NavKeyPictureConfirm`에
    `returnResultOnly`가 붙었다. C-101-confirm이 이 값에 따라 **세그멘테이션으로 전진**하는 대신
    `PictureConfirmResult`(신설, `feature/camera/api`)를 `ResultEventBus`로 돌려준다.
  - `feature/groups/canvas/impl` `strings.xml`에 탭 라벨 2 + 모달 문구 4 추가.
  - C-001의 캔버스 편집 콜백 결선(`OnClickCanvasEdit` → `NavigateToCanvasBGEdit` → `goTo`).
  - `domain`에 `CANVAS_ASPECT_RATIO` 상수 신설(`model/CanvasConst.kt`).
- **제외**(이번 라운드에서 안 함)
  - **선택한 배경의 저장·반영** — 확인 이펙트가 `// TODO` 주석과 함께 `onBack()`만 한다.
    브랜치 중간에 "메인 캔버스에 반영"이 들어왔다가 되돌려졌다(커밋 `10e70809`).
  - **토핑 탭의 내용** — 탭 전환은 상태만 바뀌고 본문은 배경 편집 그대로다
    (→ 다음 라운드 PR #264에서 채워졌다, [c301-topping-edit-tab](2026-08-16-c301-topping-edit-tab.md)).
  - 저장된 기존 배경 불러오기(코드 TODO), 서버 연동, 유닛 테스트.

## 동작 / 구조

### 화면 구성
- 세로 `Column(fillMaxSize)`: 배경 미리보기 → 팔레트 행 → `YGFloatingBarEditTab`. 모달은
  `Column` 밖에서 `showQuitDialog`로 띄운다.
- 미리보기는 `aspectRatio(CANVAS_ASPECT_RATIO)` `Box`에 상하 `padding4`·**좌우 21dp 리터럴**
  (코드 주석 "21.dp 공통에 없음")·`Gray500` 테두리 1dp다. 이미지가 선택돼 있으면 `ContentScale.Crop`
  으로 채우고, 없으면 선택 색으로 배경을 칠한다.
- 팔레트 행은 `horizontalScroll` + `spacedBy(gap3)`. 원은 전부 36dp이고 안쪽 아이콘 24dp,
  테두리는 `Transparency.Black5`다.
  - 갤러리·카메라 원: 선택된 이미지의 **출처가 자기 쪽일 때만** 썸네일을 원 안에 깔고 아이콘 색을
    `White`로 바꾼다(아니면 `Gray100` 배경 + `Gray500` 아이콘).
  - 색 원: 선택 상태면 `Transparency.Black25` 오버레이 + `ic_check`. 선택 판정은
    `color == selectedColor && selectedImageUri == null`이라 **이미지를 고르면 색 선택 표시가 꺼진다.**

### 상태(MVI)
`CanvasBGEditUiState`: `selectedTab`(`CanvasEditTab` BACKGROUND/TOPPING) · `selectedColor`(Compose
`Color`, 기본값 = 팔레트 첫 색) · `selectedImageUri` · `selectedImageSource`(`PictureConfirmSource`) ·
`showQuitDialog`.

- 색 선택은 이미지 선택을 **비운다**(`selectedImageUri`·`selectedImageSource` → null). 반대로 이미지
  결과가 오면 색은 남겨 두고 이미지가 우선한다.
- 확인(`OnClickConfirm`)은 `selectedImageUri`가 있으면 `YGCanvasBackground.Image(url)`, 없으면
  `YGCanvasBackground.Solid(color)`를 만들어 `ConfirmBackground` 이펙트에 싣는다. **Route가 그 값을
  쓰지 않는다**(TODO).
- 닫기(`OnClickCloseButton`)는 `showQuitDialog = true`만 세우고, 모달 확인이 `NavigateBack`,
  취소·바깥 탭이 `OnQuitDialogCancel`이다.
- ViewModel은 UseCase·Repository를 갖지 않는다(`@Inject constructor()`).

### 배경 이미지 선택 왕복 (재사용 진입)
```
NavKeyCanvasBGEdit ─┬─▶ NavKeyCameraCustom(showGuideToast=false, returnResultOnly=true) ─┐
                    └─▶ NavKeyCustomGalleryPicker(동일 인자) ───────────────────────────┤
                                                                                         ▼
                                       NavKeyPictureConfirm(uri, source, returnResultOnly=true)
                                                    │ sendResult(PictureConfirmResult) + onBack ×2
                                                    ▼
                                             NavKeyCanvasBGEdit (ResultEffect<PictureConfirmResult>)
```
- `returnResultOnly = false`(기본)면 확인 화면은 종전대로 `goToAndPopCurrent(NavKeySegmentation)`으로
  **토핑 생성 플로우**로 간다. 같은 세 화면이 인자 하나로 두 플로우를 겸한다.
- `showGuideToast = false`는 카메라·갤러리 진입 시 가이드 토스트를 끈다 — 토핑 생성 경로에서만 띄운다.
- 복귀는 `sendResult` 직후 **`navigator.onBack()`을 두 번** 부른다(확인 화면 → 카메라/갤러리).
  각 호출에 주석으로 어느 화면을 걷는지 적혀 있다.

### 진입
- C-001 `YGCanvas`의 `editAction` → `CanvasImageAddIntent.OnClickCanvasEdit` →
  `CanvasImageAddEffect.NavigateToCanvasBGEdit` → `goTo(NavKeyCanvasBGEdit)`. C-001 스펙이 지적하던
  "캔버스 편집 콜백 빈 람다"가 닫혔다.
- 다만 **C-001 자체의 진입 경로가 여전히 0건**이라(`NavKeyCanvasImageAdd`를 `goTo`하는 호출자 없음)
  이 화면도 실행 중 도달할 수 없다 → [open-questions](../../synthesis/open-questions.md) [2026-08-12].

## 드리프트 / 잔존

1. **편집 결과가 아무 데도 남지 않는다** — `ConfirmBackground(background)`를 Route가 버리고
   `onBack()`만 한다. C-001은 `YGCanvas`에 `background`를 넘기지 않아 기본값
   `Solid(Gray100)` 그대로다. 저장(서버·로컬)도 없고, 재진입 시 기본값을 다시 고르므로 **왕복 전체가
   화면 안에서 끝난다** → [open-questions](../../synthesis/open-questions.md) [2026-08-15].
2. **미리보기가 `YGCanvas`를 재사용하지 않는다** — 화면이 `Box` + `aspectRatio` + `border`로 직접
   그린다. 그래서 좌상단 컷 도형·Dot Grid·메뉴가 없고, 좌우 여백이 C-001의 `padding7`(20)이 아니라
   **21dp 리터럴**이다(코드 주석이 토큰 부재를 자인). 편집 중 보는 캔버스와 실제 캔버스가 다르다
   → [open-questions](../../synthesis/open-questions.md) [2026-08-15].
3. ~~**"토핑" 탭이 아무 일도 안 한다**~~ — ✅ **해소(PR #264, 2026-08-16)**. 탭이 선택·이동·크기·
   회전·삭제와 테두리 재편집 왕복으로 채워졌다. 그 라운드의 설계·드리프트는
   [c301-topping-edit-tab 스펙](2026-08-16-c301-topping-edit-tab.md)이 갖는다. 심볼 이름이
   여전히 `CanvasBGEdit*`인 것과 탭 라벨·enum 소유는 그대로다
   → [open-questions](../../synthesis/open-questions.md) [2026-08-15].
4. **State·Effect가 UI 타입을 든다** — `selectedColor`가 Compose `Color`이고 `ConfirmBackground`가
   디자인시스템 타입 `YGCanvasBackground`를 싣는다. 팔레트 `CanvasBackgroundPaletteColors`도
   ViewModel 파일의 public 상수이고 8종 중 5종이 **hex 리터럴**(토큰·`YGAtomicColors` 밖)이다
   → [state-management](../../architecture/state-management.md) ·
   [open-questions](../../synthesis/open-questions.md) [2026-08-15].
5. **캔버스 비율 상수가 둘로 갈렸다** — `domain`에 `CANVAS_ASPECT_RATIO`가 신설됐는데
   `core:designsystem` `YGCanvas`에는 같은 값의 private `CANVAS_AREA_ASPECT_RATIO`가 이미 있다.
   화면 비율은 도메인 규칙이 아니라 표시 규격이다
   → [open-questions](../../synthesis/open-questions.md) [2026-08-15].
6. **NavKey 인자가 데이터가 아니라 동작 플래그다** — `showGuideToast`·`returnResultOnly`는 화면이
   그릴 값이 아니라 **호출자가 고르는 분기**이고, `@Serializable` 백스택 키에 실린다. 복귀도
   `onBack()` 2회로 스택 깊이를 가정한다(중간에 화면이 하나 끼면 깨진다). 카메라 실패 경로는
   여전히 `sendResult(uri: String?)`라 `ResultEffect<PictureConfirmResult>`인 이 화면은 **실패를
   받지 못한다** → [open-questions](../../synthesis/open-questions.md) [2026-08-15].
7. **클릭 규약 이탈** — 팔레트 원 2종·색 원이 `Modifier.clickable`을 직접 쓴다(`clickableYG`
   미사용, 갤러리 그리드 셀과 같은 부류) → [open-questions](../../synthesis/open-questions.md) [2026-08-04].
8. **치수 리터럴** — 원 36dp·아이콘 24dp·테두리 1dp·미리보기 좌우 21dp가 토큰 밖이다.
   `SizeTokens`에 있는 값(`Size24`·`Size1`)도 리터럴로 적었고, 36·21은 스케일 자체에 없다
   (A-002가 남긴 "스케일 공백" 지적과 같은 부류).

## 정책 대조 (위키)

| 정책 항목 | 코드 | 판정 |
|---|---|---|
| C-301 = 파르페 편집 모드 진입(배경 변경 + 토핑 편집 통합, [[기능정의서-v3]]) | 배경/토핑 탭 화면 | 방향 일치, 토핑 탭은 #264로 채워짐 |
| 캔버스 Area 비율 9:16([[캔버스-반응형-레이아웃]]) | `aspectRatio(CANVAS_ASPECT_RATIO)` | 일치 |
| 캔버스 좌우 여백 20([[캔버스-반응형-레이아웃]]) | 미리보기 좌우 21dp 리터럴 | **불일치**(드리프트 2) |
| 캔버스 좌상단 컷 도형 + 날짜 라벨 | 미리보기에 없음 | **불일치**(미리보기가 캔버스 재현 아님) |
| 배경 팔레트 색 목록·개수 | 위키에 대응 소스 없음 | **대조 대상 부재** — 8종·색값이 코드로 확정 |
| 편집 그만두기 확인 문구 | 위키에 대응 소스 없음 | **대조 대상 부재** |
| 배경 이미지의 크롭·비율 규칙([[이미지-렌더링-정책]]은 단독 노출용) | 미리보기 `ContentScale.Crop` | 대조 대상 부재(정책은 확인 화면 대상) |

## 규약 대조 (parfait)
- **화면 컨테이너**: entry가 규약 기본형(`YGScaffold { innerPadding -> …padding(innerPadding) }`)이다.
  화면 최외곽 `YGScreen`은 쓰지 않는다(C-001·G-001·A-002와 같은 이탈).
- **문자열**: 탭 라벨·모달 문구가 전부 `feature/groups/canvas/impl` `strings.xml`이다
  ([2026-07-26 항목](../../synthesis/open-questions.md) 규약 준수).
- **디자인시스템 재사용**: `YGFloatingBarEditTab`(C-104/C-105 편집 화면에 이은 **두 번째 실화면
  소비처**)·`YGModalPopup`(**7번째 소비처**, 파괴적 액션=좌 Secondary 배치 진영)·`YGAtomicColors`.
  팔레트 원은 화면 로컬 private 컴포저블이고 대응 컴포넌트가 없다.
- **MVI**: 3분할 계약을 지키고 이펙트 수집은 Route 한 곳이다. Intent 6종이 `class`(무인자)라
  기존 화면들과 같은 형태다.

## 파일 구성

```
feature/groups/canvas/api/
  NavKeyCanvasBGEdit.kt                신설(data object)
feature/groups/canvas/impl/
  route/CanvasBGEditRoute.kt           신설 — ResultEffect + 이펙트 수집
  screen/CanvasBGEditScreen.kt         신설 — 미리보기·팔레트·플로팅바·모달 + 프리뷰
  viewmodel/CanvasBGEditViewModel.kt   신설 — UiState/Intent/Effect + 팔레트 상수 + CanvasEditTab
  navigation/EntryBuilder.kt           entry 추가
  route/CanvasImageAddRoute.kt         편집 버튼 결선 + NavKey 생성자 호출로 변경
  viewmodel/CanvasImageAddViewModel.kt Intent/Effect 1종씩 추가
  res/values/strings.xml               6줄 추가
feature/camera/api/
  NavKeyCameraCustom.kt                data object → data class(showGuideToast, returnResultOnly)
  NavKeyPictureConfirm.kt              returnResultOnly 추가
  PictureConfirmResult.kt              신설(uri, source)
feature/camera/impl/
  navigation/EntryBuilder.kt           navKey 인자 전달
  route/CustomCameraRoute.kt           토스트 게이팅 + returnResultOnly 전달
  route/PictureConfirmRoute.kt         확인 분기(결과 반환 vs 세그멘테이션 전진)
feature/gallery/api/
  NavKeyCustomGalleryPicker.kt         data object → data class(동일 인자)
feature/gallery/impl/
  navigation/EntryBuilder.kt           navKey 인자 전달
  route/CustomGalleryPickerRoute.kt    토스트 게이팅 + returnResultOnly 전달
domain/
  model/CanvasConst.kt                 신설(CANVAS_ASPECT_RATIO)
```
