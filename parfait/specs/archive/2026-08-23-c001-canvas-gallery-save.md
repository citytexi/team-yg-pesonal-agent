---
id: c001-canvas-gallery-save
title: C-001 지난 캔버스 갤러리 저장 — 캔버스 캡처·MediaStore 쓰기·결과 토스트
status: implemented
category: ui-spec
platforms: android
verified: 2026-08-23
related_code:
  - YGCanvas.kt#YGCanvas
  - YGCanvas.kt#CanvasArea
  - GalleryWritePermissionManager.kt#GalleryWritePermissionManager
  - GalleryMediaProvider.kt#insertPendingImage
  - GalleryMediaProvider.kt#openOutputStream
  - GalleryMediaProvider.kt#finalizePendingImage
  - GalleryMediaProvider.kt#deleteImage
  - GalleryRepository.kt#saveImageToGallery
  - GalleryRepositoryImpl.kt#saveImageToGallery
  - SaveCanvasToGalleryUseCase.kt#SaveCanvasToGalleryUseCase
  - CanvasMainViewModel.kt#CanvasMainEffect.RequestCanvasCapture
  - CanvasMainViewModel.kt#CanvasMainEffect.ShowGallerySaveResult
  - CanvasMainViewModel.kt#CanvasMainIntent.SaveCapturedCanvas
  - CanvasMainViewModel.kt#handleClickSaveToGallery
  - CanvasMainViewModel.kt#handleSaveCapturedCanvas
  - CanvasMainRoute.kt#CanvasMainRoute
  - CanvasMainScreen.kt#CanvasMainScreen
  - data/src/main/AndroidManifest.xml
  - feature/groups/canvas/impl/res/values/strings.xml
related_adr: ADR-0005, ADR-0009, ADR-0011, ADR-0014
related_spec: c201-canvas-calendar-server, c001-canvas-today-detail, c202-canvas-spotlight, c102-custom-gallery-picker, designsystem-canvas-components
related_architecture: data-layer, design-system, state-management, module-structure
supersedes:
superseded_by:
tags: [spec, parfait, canvas, gallery, c-001, ui]
---

# Spec: C-001 지난 캔버스 갤러리 저장

> 상태·날짜·대상·관련은 위 frontmatter가 단일 출처. 본문은 설계 내용에 집중.

> **사후 기록(post-hoc)** — 선작성 스펙 없이 develop 머지(PR #324, 브랜치 `feature/gallery-store`,
> 2026-08-23 `ec646241`). 머지 커밋 트리가 브랜치 팁 `20295ba8`과 같아 충돌 해소 편집이 0건이다.
> as-built 역기록이고 **코드가 SoT**다.

## 목표

지난 캔버스를 보고 있을 때 메뉴의 "갤러리에 저장"이 실제로 기기 갤러리에 이미지를 남긴다.
[c201-canvas-calendar-server 스펙](2026-08-17-c201-canvas-calendar-server.md)이 드리프트 1로 적어 둔
**"버튼과 인텐트만 있고 핸들러는 로그 한 줄"**을 닫는 라운드다(OQ-P-211).

이 액션이 지난 캔버스에서만 나오는 이유는 앞선 라운드가 정했다 — 지난 캔버스는 서버가 편집을 409로
거부하므로 편집 진입점 자체를 치웠고, 그 빈 자리를 이 액션이 차지했다. 그래서 **지금 지난 캔버스에서
할 수 있는 일이 "오늘로 돌아가기" 하나에서 둘이 됐다.**

## 범위

- **포함**: `YGCanvas` 캡처 레이어 슬롯 · 캡처 요청 왕복(이펙트 → 인텐트) · 저장 권한 판정과 요청 ·
  `MediaStore` 쓰기 경로(`IS_PENDING` 왕복) · `GalleryRepository.saveImageToGallery` ·
  `SaveCanvasToGalleryUseCase` · 성공/실패 토스트 · `YGCanvas.overlayContent`에 얼럿 호스트 병치.
- **제외**: 저장 이미지의 디자인 규격(프레임·여백·해상도를 정한 정책 소스가 없다) ·
  캡처·권한·`MediaStore` 쓰기의 테스트(유닛은 ViewModel 층에서 멈춘다) · 전일 캔버스 알림 얼럿의
  **트리거**(호스트와 문자열만 들어왔다) · 실기기 확인.

## 동작 / 구조

### 캡처는 화면만 할 수 있어서 왕복한다

```
OnClickSaveToGallery ─▶ [VM] RequestCanvasCapture ─▶ [Route] graphicsLayer.toImageBitmap()
                                                              │  권한 있음 ─┐
                                                              │  권한 없음 ─┴─▶ 요청 → 승인 시
                                                              ▼
                        [VM] SaveCapturedCanvas(bitmap) ─▶ SaveCanvasToGalleryUseCase
                                                              ▼
                        [VM] ShowGallerySaveResult(isSuccess, date) ─▶ [Route] 토스트
```

ViewModel은 비트맵을 만들 수 없다(Compose `GraphicsLayer`는 컴포지션 소유다). 그래서 **이펙트로
요청만 보내고 화면이 캡처한 결과를 인텐트로 되받는다** — 한 동작이 MVI 왕복 두 번으로 갈리는
이유가 그것이고, 두 심볼의 KDoc이 서로를 가리켜 짝이라는 것을 남겨 두었다.

`handleSaveCapturedCanvas`는 `selectedDate`를 **`launch` 밖에서** 붙든다. 저장이 도는 동안 사용자가
다른 날짜를 골라도 안내 문구가 방금 저장한 캔버스의 날짜를 말하게 하려는 것이다.

### 캡처 대상은 배경 + 토핑뿐이다

`YGCanvas`에 `captureGraphicsLayer: GraphicsLayer?`가 붙었다. 넘기면 `CanvasArea`가 그 레이어를
**배경과 토핑만 담는 안쪽 `Box`**에 `drawWithContent { record(...); drawLayer(...) }`로 건다.

바깥 `Box`가 아니라 안쪽인 것이 이 배치의 전부다 — 테두리·좌상단 컷 도형·빈 캔버스 안내 문구·날짜
버튼은 화면 크롬이라 갤러리에 남는 이미지에 들어가면 안 된다. 그래서 **저장되는 그림은 프레임 없는
직사각형**이고, 캔버스에서 보던 모습과 같지 않다.

레이어는 Route가 `rememberGraphicsLayer()`로 만들어 Screen을 거쳐 넘긴다. Screen 파라미터에 기본값이
있어 프리뷰는 자기 것을 쓴다.

### 권한은 API 29 미만에서만 걸린다

`GalleryWritePermissionManager`(`core:util:android`)가 판정을 한 자리에 모은다 — API 29부터는 자기 앱이
만든 `MediaStore` 항목을 쓰는 데 권한이 필요 없어 **그 아래에서만** `WRITE_EXTERNAL_STORAGE`를 본다.
매니페스트 선언도 `maxSdkVersion="28"`로 좁혀 상위 기기에서 권한 목록에 뜨지 않게 했다.
`minSdk`가 26이라 이 갈래는 살아 있는 경로다.

권한 요청은 Activity가 있어야 가능하다. 그래서 **Route가 캡처한 비트맵을 `pendingGalleryBitmap`으로
들고 있다가** 승인이 오면 그때 인텐트로 넘긴다. 거부하면 그 자리에서 실패 토스트를 띄우고 비트맵을
버린다(ViewModel까지 가지 않으므로 이 갈래만 실패 경로가 화면 쪽에 있다).

### 쓰다 만 파일을 갤러리에 보이지 않게 한다

`GalleryMediaProvider`가 네 조각으로 갈렸다 — `insertPendingImage` · `openOutputStream` ·
`finalizePendingImage` · `deleteImage`. 순서는 **등록(`IS_PENDING = 1`) → 바이트 쓰기 → 표시로 내림**
이고, 어느 단계에서든 던지면 `deleteImage`로 등록 자체를 되돌린다. 갤러리 앱이 반쯤 쓰인 파일을
온전한 것처럼 보여 주지 않게 하려는 것이다.

**이 보호는 API 29부터다.** `IS_PENDING`도 `RELATIVE_PATH`(`Pictures/Parfait`)도 그 아래에서는 아예 안
넣는다 — 그래서 API 26~28에서는 저장 위치가 `Pictures/Parfait`가 아니고 중간 상태도 그대로 보인다
→ [open-questions](../../synthesis/open-questions.md) OQ-P-274.

압축은 PNG 100이고 파일명은 `parfait_<epochMillis>.png`다.

### 결과 표현과 토스트 자리

성공은 `YGToastType.InviteCode`에 "M월 D일의 캔버스가 갤러리에 저장됐어요"를, 실패는 `showError`에
공통 실패 문구를 싣는다. 성공에 초대코드용 타입을 재사용한 것은 **표현이 같아서**이고 그 이름이
자리를 설명하지는 않는다.

토스트 호스트는 [c202-canvas-spotlight 스펙](2026-08-20-c202-canvas-spotlight.md)이 만든
`YGCanvas.overlayContent` 슬롯에 그대로 있고, 이번에 **`YGAlertHost`가 그 아래 세로로 병치**됐다.
얼럿을 띄우는 코드는 아직 없다(프리뷰만 정책 객체를 직접 만들어 보여 준다) — 겹침 처리도 코드
주석의 TODO로 남았다 → [open-questions](../../synthesis/open-questions.md) OQ-P-273.

같은 라운드에서 "갤러리에 저장" 메뉴 액션의 아이콘이 빠졌다(`iconResource = null`). `ic_gallery`는
C-301 배경 편집이 계속 쓴다.

## 계층 배치

| 계층 | 심볼 | 하는 일 |
|---|---|---|
| `core:designsystem` | `YGCanvas(captureGraphicsLayer)` | 배경+토핑만 레이어에 함께 기록 |
| `core:util:android` | `GalleryWritePermissionManager` | 저장 권한이 필요한 API 범위 판정 |
| `feature` | `CanvasMainRoute` | 캡처 실행 · 권한 요청 · 결과 토스트 |
| `feature` | `CanvasMainViewModel` | 요청 이펙트 · 저장 조율 · 날짜 붙들기 |
| `domain` | `SaveCanvasToGalleryUseCase` · `GalleryRepository.saveImageToGallery` | 저장 계약 |
| `data` | `GalleryRepositoryImpl` · `GalleryMediaProvider` | `MediaStore` 왕복 |

UseCase는 **이미 만들어진 비트맵만 받는다** — 캡처가 화면 책임이라는 것을 계약으로 못박은 자리이고,
KDoc이 그 이유를 적고 있다. 비트맵은 [ADR-0011](../../adr/0011-cross-module-bitmap-abstraction.md)의
`BitmapWrapper`로 넘어가고 `data`가 `as? AndroidBitmap`으로 되받는다(그 다운캐스트 의존은 OQ-P-002
그대로다).

## 정책 대조 (위키)

| 정책 항목 | 코드 | 판정 |
|---|---|---|
| 갤러리 저장 동작·문구·저장 규격 | 위키에 대응 소스 없음 | **대조 대상 부재** — 코드가 확정 |
| 저장 이미지에 캔버스 프레임을 넣는가 | 배경+토핑만, 테두리·컷 도형·날짜 라벨 제외 | **대조 대상 부재** — 코드가 확정 |
| 토스트 위→아래 노출·스택([[Toast-공통-정책]]) | `YGCanvas.overlayContent`의 공통 호스트 | 일치 |

## 규약 대조 (parfait)

- **MVI**: 캡처 왕복이 이펙트↔인텐트 한 쌍으로 성립한다. 화면이 프레임워크 자원을 쥐고 ViewModel이
  요청만 보내는 형태는 [state-management](../../architecture/state-management.md)의 "부수 효과는
  Route"와 같은 갈래다. 다만 **권한 거부 갈래만 ViewModel을 거치지 않아** 실패 경로가 둘로 갈린다.
- **인텐트가 플랫폼 타입을 든다**: `SaveCapturedCanvas(bitmap: Android Bitmap)`이라 `feature`
  ViewModel이 `android.graphics.Bitmap`을 직접 받는다. `domain` 경계에서만 `BitmapWrapper`로 바뀐다.
- **중복 실행 가드**: 저장은 `launch(key = SAVE_CANVAS_TO_GALLERY_KEY)`로 묶었다.
- **死분기**: `GalleryMediaProvider.collectionUri`가 `Uri?`로 선언돼 있지만 대입값이
  `MediaStore.Images.Media.EXTERNAL_CONTENT_URI`라 항상 비널이고, `insertPendingImage`의
  `?: return null`은 도달하지 않는다(이 라운드가 만든 것이 아니라 기존 선언을 그대로 탄다).

## 드리프트 / 잔존

1. **캡처는 지금 화면에 그려진 것을 다시 그린다** — 배경이 `AsyncImage`(Coil)라 아직 안 왔으면 그
   상태가 그대로 담기고, 결과 이미지의 크기도 기기 화면 폭에 종속된다. 어느 쪽도 코드가 다루지
   않는다 → [open-questions](../../synthesis/open-questions.md) OQ-P-272.
2. **API 29 미만은 저장 위치와 중간 상태 보호가 갈린다** → 같은 문서 OQ-P-274.
3. **얼럿 호스트와 문자열 셋이 트리거 없이 들어왔다** → 같은 문서 OQ-P-273.
4. **저장 경로에 테스트가 없다** — 유닛 셋은 전부 ViewModel 층이다(저장 클릭이 캡처 요청만 보내는지,
   성공·실패가 보고 있던 날짜와 함께 알려지는지). `MediaStore` 쓰기·`IS_PENDING` 되돌리기·권한
   판정·캡처 자체는 한 줄도 잠기지 않았다.
5. **실기기 확인 0회** — 이 라운드는 유닛으로 덮을 수 없는 것이 대부분이다(권한 다이얼로그·갤러리
   앱에 뜨는 결과물·캡처 결과의 모양).

## 테스트

`CanvasMainViewModelTest`에 셋이 붙었다. 저장소 전체 유닛은 737 → **745건**(같은 라운드의 토핑 삭제
다섯을 포함), 테스트 클래스는 **87개**로 그대로다.

## 파일 구성

| 파일 | 변경 |
|---|---|
| `core/designsystem/.../ygcanvas/YGCanvas.kt` | `captureGraphicsLayer` 파라미터, 안쪽 `Box`로 캡처 범위 분리 |
| `core/util/android/.../permission/GalleryWritePermissionManager.kt` | 신규 |
| `data/src/main/AndroidManifest.xml` | `WRITE_EXTERNAL_STORAGE` + `maxSdkVersion="28"` |
| `data/.../utils/GalleryMediaProvider.kt` | 등록·스트림·확정·삭제 4함수 |
| `data/.../repository/gallery/GalleryRepositoryImpl.kt` | `saveImageToGallery` |
| `domain/.../repository/gallery/GalleryRepository.kt` | 계약 추가 |
| `domain/.../usecase/gallery/SaveCanvasToGalleryUseCase.kt` | 신규 |
| `feature/.../route/CanvasMainRoute.kt` | 캡처·권한 런처·결과 토스트 |
| `feature/.../screen/CanvasMainScreen.kt` | 캡처 레이어 전달, 얼럿 호스트 병치, 프리뷰 2종 |
| `feature/.../viewmodel/CanvasMainViewModel.kt` | 이펙트 2·인텐트 1·저장 조율 |
| `feature/.../res/values/strings.xml` | 문구 5(2건 소비, 3건 프리뷰 전용) |
| `feature/.../viewmodel/CanvasMainViewModelTest.kt` | 유닛 3 |
