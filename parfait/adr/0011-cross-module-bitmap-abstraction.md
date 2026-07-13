# ADR-0011: 크로스모듈 비트맵 추상화 (BitmapWrapper / AndroidBitmap)

- 상태: accepted
- 날짜: 2026-07-12
- 결정자: Parfait 팀

## 맥락
`domain`은 순수 Kotlin(kotlin-jvm) 모듈로 Android 의존을 금지한다([[0001-layered-multi-module]]·[[module-structure]]). 그런데 이미지 세그멘테이션 기능은 도메인 인터페이스(`ImageSegmentationRepository`)와 모델(`SegmentationResult`)이 **비트맵**을 다뤄야 한다. `android.graphics.Bitmap`은 Android 타입이라 domain에서 직접 참조할 수 없다.

## 결정
비트맵을 플랫폼 무관 추상 타입으로 감싸 도메인은 추상만 참조하고, 실제 `Bitmap`은 data 레이어에서만 다룬다.

- `core:util:jvm`에 순수 Kotlin `interface BitmapWrapper`(현재 멤버 없음 — TODO).
- `core:util:android`에 `@JvmInline value class AndroidBitmap(delegate: Bitmap) : BitmapWrapper` + 확장 `Bitmap.toAndroidBitmap()`. 실제 비트맵은 `getRawData()`로 노출.
- `domain`(`ImageSegmentationRepository`, `SegmentationResult.bitmap`)은 `BitmapWrapper`만 참조.
- `data` 구현(`ImageSegmentationRepositoryImpl`)이 `as? AndroidBitmap` 다운캐스트로 실제 `Bitmap` 복원. 실패 시 `SegmentationException.ImageNotFound`로 방어.
- 의존: `core:util:android` → `core:util:jvm`.

## 대안
- **domain을 android-library로 전환해 `Bitmap` 직접 사용** — 추상화 불필요, 코드 단순.
  **→ 기각:** domain 순수성([[0001-layered-multi-module]]) 파괴. 도메인 단위 테스트에 Robolectric/기기 필요해짐.
- **비트맵을 `ByteArray`·파일경로 등 원시 타입으로만 도메인에 전달** — 별도 타입 없이 통과.
  **→ 기각:** 타입 안전성·의미 상실, 매번 인코딩/디코딩 비용. (단, subject 결과 이미지는 `SegmentationResult.subjectImagePath` 파일경로로 별도 전달 — 메모리 비트맵과 역할 분리.)

## 영향

**긍정**
- domain이 순수 Kotlin 유지. 비트맵 표현을 플랫폼별로 교체 가능(테스트·향후 멀티플랫폼 여지).
- Android 타입 노출이 `core:util:android`·`data`로 국한.

**트레이드오프**
- data에서 `as? AndroidBitmap` 다운캐스트가 필요 — 인터페이스가 계약을 강제하지 못해 런타임 방어(`ImageNotFound`)에 의존.
- `BitmapWrapper`가 현재 **stub**(멤버 없음, `AndroidBitmap`도 `// TODO delegate 사용하도록 수정`). 실질 안전성이 다운캐스트에 달려 있는 과도기.

**위험·방어**
- 다운캐스트 실패는 `Result.failure(SegmentationException.ImageNotFound)`로 처리.
- 필요한 비트맵 연산이 정해지면 `BitmapWrapper`에 메서드를 정의해 다운캐스트 의존을 줄인다 → [open-questions 2026-07-12 BitmapWrapper stub](../../synthesis/open-questions.md).
