---
id: ADR-0012
title: 이미지 세그멘테이션 — ML Kit Subject Segmentation 온디바이스 채택
status: accepted
date: 2026-07-12
deciders: Parfait 팀
supersedes:
superseded_by:
related_adr:
related_spec: c103-segmentation-topping-edit
related_architecture: data-layer
platforms: android
tags: [adr, parfait]
---
# ADR-0012: 이미지 세그멘테이션 — ML Kit Subject Segmentation 온디바이스 채택

## 맥락
이미지에서 주요 피사체(전경)를 분리하는 [[누끼-따기]] 기능이 필요하다. MVP 미결 항목이던 "누끼 온디바이스 vs 서버"(→ [open-questions 2026-07-06 MVP 미결 정책](../../wiki/synthesis/open-questions.md)) 중 처리 위치와 라이브러리를 정해야 했다.

## 결정
Google **ML Kit Subject Segmentation**(`play-services-mlkit-subject-segmentation`, GMS/Play services 기반)을 **온디바이스**로 채택한다.

- 버전은 `gradle/libs.versions.toml`의 `mlkitSubjectSegmentation`(현재 **beta**), 별칭 `google-mlkit-subject-segmentation`.
- `feature:segmentation:impl`의 `AndroidManifest`에 `com.google.mlkit.vision.DEPENDENCIES = subject_segment` meta-data를 두어 install-time에 모델을 다운로드.
- 실행은 `data`의 `ImageSegmentationRepositoryImpl`: `InputImage.fromBitmap` → `SubjectSegmenter`(`enableForegroundConfidenceMask`) → `foregroundConfidenceMask`(임계 0.5f)로 overlay/subject 비트맵 생성. subject 이미지는 `cacheDir`에 PNG로 저장하고 경로(`SegmentationResult.subjectImagePath`)를 반환.
- 블로킹 `Tasks.await(segmenter.process(...))`를 `Dispatchers.IO`로 감싸 suspend화, 마스크→픽셀 루프는 `Dispatchers.Default`.
- 비트맵은 [[0011-cross-module-bitmap-abstraction|BitmapWrapper]]로 도메인에 전달.

## 대안
- **서버 세그멘테이션** — 단말 성능 무관, 모델 교체 용이. 그러나 네트워크 왕복·서버 비용, 오프라인 불가.
  **→ 기각:** 원격 연동 자체가 후속 과제([[data-layer]]). 온디바이스가 오프라인·프라이버시 유리.
- **TFLite 커스텀 모델 직접 통합** — 모델·임계 완전 제어.
  **→ 기각:** 모델·전후처리 직접 관리 부담. ML Kit이 즉시 사용 가능.
- **ML Kit Selfie/일반 Segmentation** — 유사 온디바이스.
  **→ 기각:** 임의 피사체 대상엔 Subject Segmentation이 적합.

## 영향

**긍정**
- 온디바이스라 오프라인 동작·이미지 외부 미전송(프라이버시).
- ML Kit 통합이 단순, 별도 모델 관리 불필요.

**트레이드오프**
- **beta 라이브러리 의존** — API·동작 변동 가능.
- **GMS(Play services) 의존** — GMS 없는 기기 미지원. install-time 모델 다운로드라 첫 사용 지연·실패 가능.
- 결과 전달이 메모리 비트맵(overlay) + 파일경로(subject PNG)로 이원 — 캐시 파일 정리 정책 필요.

**위험·방어**
- 실패는 `Result<SegmentationResult>` + sealed `SegmentationException`(`ClientInit`·`ImageNotFound`)로 표현, ViewModel이 effect로 받아 Toast + back 처리.
- beta 승급·API 변동 추적 필요 → [open-questions 2026-07-12 ML Kit beta](../../wiki/synthesis/open-questions.md).

## As-built 갱신 (2026-08-14, PR #221)

결정 자체는 유지되고 실행 세부가 바뀌었다. 위 "결정" 절과 갈리는 지점만 적는다.

| 원안 서술 | develop 현재 |
|---|---|
| 매니페스트 meta-data로 install-time 모델 다운로드 | meta-data는 **힌트일 뿐 보장이 없어서**, 사용 직전에 `ModuleInstall.areModulesAvailable` → 없으면 `installModules` → 재확인한다 |
| `foregroundConfidenceMask`(임계 0.5f)로 **overlay/subject 비트맵** 생성 | overlay 비트맵이 없다. 같은 루프에서 subject 픽셀과 **바운딩 박스**를 함께 모은다 |
| `SegmentationResult.bitmap`(`BitmapWrapper`) + `subjectImagePath` | `bitmap` 제거 — `subjectImagePath` + `subjectBounds: SegmentationBounds?` 2필드([[0011-cross-module-bitmap-abstraction]] 영향 절 참고) |
| sealed `SegmentationException`(`ClientInit`·`ImageNotFound`) | `ModuleNotReady`·`Process` 2종 추가. `Tasks.await`의 `ExecutionException`을 한 겹 벗겨 `MlKitException.UNAVAILABLE`이면 `ModuleNotReady` |
| (없음) | `saveEditedImage(BitmapWrapper): Result<String>` 신설 — 손편집 결과를 `cacheDir` PNG로 떨구고 경로 반환 |

- "결과 전달이 메모리 비트맵 + 파일경로로 **이원**"이라던 트레이드오프는 **경로 단일로 정리됐다**.
  대신 화면이 경로를 다시 디코드하므로 디코드 비용이 화면 쪽으로 옮겨졌다.
- **캐시 파일 정리 정책은 더 급해졌다** — 추출 1장에 더해 편집을 마칠 때마다 최대 2장이 늘고
  삭제 경로가 없다 → [open-questions](../synthesis/open-questions.md) [2026-07-12].
- 실패 표현은 여전히 완전하지 않다 — `foregroundConfidenceMask == null`은 `Result`를 타지 않고
  raw `error()`로 던진다(같은 항목).
- 소비 화면은 [c103 스펙](../specs/archive/2026-08-15-c103-segmentation-topping-edit.md).

## As-built 갱신 (2026-08-20, PR #309 develop 머지)

> 📌 **정정(2026-08-19)** — 이 브랜치는 develop에 미머지인 PR #290(`feature/topping-add-screen`)을
> 로컬 머지해 얹은 것이라 그 자체로 리뷰·머지될 수 없었다. 같은 작업이 plain develop 위
> **`refactor/segmentation-develop`**로 다시 만들어졌다(브랜치명만 달라졌을 뿐, 아래 서술하는
> `segmentImage` 재작성·캐시 정리·예외 처리 내용은 새 브랜치에서도 동일하게 확인됨). 상세는
> [segmentation-pipeline-hardening 스펙의 "as-built 정정" 절](../specs/archive/2026-08-18-segmentation-pipeline-hardening.md#as-built-정정-2026-08-19-리베이스).
>
> ✅ **머지됨(2026-08-20, PR #309 — develop `cf357937`)** — 아래 서술은 이제 브랜치가 아니라
> develop 코드다. 브랜치 팁이 충돌 해소 편집 없이 그대로 들어갔다.
>
> 📌 **재정정(2026-08-20)** — 그 브랜치를 develop `750cc2dd` 위로 한 번 더 리베이스했다.
> **아래 세 항목의 결론은 그대로 유효하다.** 다만 `segmentImage`는 리베이스에서 develop과 충돌해
> 이 ADR이 다루는 저장 구간의 모양이 조금 달라졌다 — 이 라운드가 넣은 `try`/`finally` 안으로
> develop의 trimmed 비트맵 생성이 들어와, `finally`의 `recycle()`이 두 비트맵의 수명을 함께 닫는다.
> 상세는 [스펙의 "as-built 재정정" 절](../specs/archive/2026-08-18-segmentation-pipeline-hardening.md#as-built-재정정-2026-08-20-두-번째-리베이스).

[segmentation-pipeline-hardening 스펙](../specs/archive/2026-08-18-segmentation-pipeline-hardening.md) 구현.
위 두 절이 남긴 것 셋을 여기서 닫는다.

- **캐시 정리 정책이 정해졌다** — `cacheDir` 전용 하위 디렉토리(`SegmentationCacheDir.kt`)를 두고
  `SegmentationViewModel`이 세그멘테이션 진입 시(디코드보다 먼저) 통째로 비운다.
  `ClearSegmentationCacheUseCase`가 도메인 쪽 진입점이다. 누적 상한은 직전 흐름 1회분으로
  줄었다. **"캐시 파일 정리 정책 필요"라던 트레이드오프와 "정리 정책은 더 급해졌다"는 경고를
  여기서 닫는다.**
- **`foregroundConfidenceMask == null`이 `Result.failure`를 타게 됐다** — 더는 raw `error()`가
  아니다. **"실패 표현은 여전히 완전하지 않다"는 문장을 지운다.**
- **마스크 루프가 `getPixels` 1회 + 배열 내 마스킹으로 바뀌었다** — 픽셀당 `Bitmap.getPixel` JNI
  왕복이 사라지고, 같은 배열을 훑으며 객체가 아닌 자리를 지우고 bounding box를 넓힌다
  (`SegmentationMask.kt#maskSubjectPixels`, `Bitmap` 비의존 순수 함수). 마스크 버퍼 용량이
  `width * height`와 다르면 실패로 방어하는 것도 이때 붙었다 — 지금까지는 어긋나도 조용히
  잘못 읽었다. 그 가드는 라운드 안에서 한 번 더 손을 탔다(아래).
- **`segmentImage`의 저장 구간까지 방어가 마저 닫혔다** — 위 null 마스크·크기 불일치 두 경로를
  닫은 뒤에도 같은 `withContext(Dispatchers.Default)` 블록 안, `saveToCacheAsPng`가 던지는
  `IOException`은 여전히 `Result` 밖으로 새어나가 호출부(`SegmentationViewModel`의 `init`
  코루틴)를 죽였고 `subjectBitmap.recycle()`도 건너뛰었다. 저장 구간을 `try`로 마저 감싸고
  `recycle()`을 `finally`로 옮겨 실패해도 항상 돌게 했다 — **이 블록이 완전히 방어되는 것은 이
  시점부터다.** 같은 김에 마스크 크기 가드를 `capacity()`(버퍼 전체 용량)에서 `remaining()`
  (`get(index)`가 실제로 경계로 삼는 `limit` 기준 값)으로 정정했다. 그 방어가 `Exception`을
  통째로 잡던 탓에 `CancellationException`까지 삼켜 취소된 흐름을 실패로 보고하던 것도, 재던지는
  분기를 앞세워 갈랐다(`BaseViewModel.launch`와 같은 관용구).
