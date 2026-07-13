# ADR-0012: 이미지 세그멘테이션 — ML Kit Subject Segmentation 온디바이스 채택

- 상태: accepted
- 날짜: 2026-07-12
- 결정자: Parfait 팀

## 맥락
이미지에서 주요 피사체(전경)를 분리하는 [[누끼-따기]] 기능이 필요하다. MVP 미결 항목이던 "누끼 온디바이스 vs 서버"(→ [open-questions 2026-07-06 MVP 미결 정책](../../synthesis/open-questions.md)) 중 처리 위치와 라이브러리를 정해야 했다.

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
- beta 승급·API 변동 추적 필요 → [open-questions 2026-07-12 ML Kit beta](../../synthesis/open-questions.md).
