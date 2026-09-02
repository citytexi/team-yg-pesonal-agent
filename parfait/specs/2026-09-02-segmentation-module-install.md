---
id: segmentation-module-install
title: 세그멘테이션 optional module 설치 대기·실패 처리
status: draft
category: behavior-spec
platforms: android
verified: 2026-09-02
related_code:
  - ImageSegmentationRepositoryImpl.kt#ensureModuleInstalled
  - ImageSegmentationRepositoryImpl.kt#runSegmenter
  - ImageSegmentationRepositoryImpl.kt#toSegmentationException
  - SegmentationException.kt#ModuleNotReady
  - SegmentationViewModel.kt#SegmentationState
  - SegmentationRoute.kt#SegmentationRoute
  - SegmentationErrorScreen.kt#SegmentationErrorScreen
  - AndroidManifest.xml
related_adr:
  - 0012-mlkit-subject-segmentation.md
related_spec:
  - archive/2026-08-23-c103-multi-subject-selection.md
related_architecture:
  - data-layer.md
  - state-management.md
supersedes:
superseded_by:
tags: [spec, parfait, segmentation, mlkit, module-install]
---

# Spec: 세그멘테이션 optional module 설치 대기·실패 처리

## 목표

세그멘테이션 모델이 아직 없는 기기에서 사진 편집이 조용히 실패하는 것을 없앤다. 설치가
끝났는지를 실제로 알아내고, 못 받았으면 사용자에게 맞는 안내를 준다.

## 왜 지금인가

2026-09-02, Galaxy Z Flip 3(SM-F711N, Android 15)에서 사진 편집이 매번 실패한다는 제보를 받고
실기기 logcat으로 원인을 둘로 갈랐다. 같은 앱이 Galaxy A35에서는 정상 동작한다.

### 원인 ① — `installModules`의 반환을 설치 완료로 오해한다

`ensureModuleInstalled`는 `Tasks.await(installModules(...))`가 돌아온 직후에
`areModulesAvailable`을 다시 물어 그 답을 결과로 삼는다. 실측은 이렇다.

```
[MLKIT-MODULE] 설치 요청 전 가용 여부 false
[MLKIT-MODULE] installModules 반환 37ms, 이미 설치됨 false      ← Task 는 성공으로 완료
[MLKIT-MODULE] 설치 상태 5, 오류 코드 8, 세션 16                ← 진짜 결과는 25ms 뒤 리스너로 도착
```

Play 서비스 모듈 설치 가이드가 이 계약을 문장으로 못 박아 두었다.

> The install request has been sent successfully. This does not mean the installation is completed.

설치의 진행과 종료는 `InstallStatusListener`로만 통지되고, 종료 상태는 `STATE_COMPLETED`·
`STATE_FAILED`·`STATE_CANCELED` 셋이다. 지금 코드에는 리스너가 없어서 **실패했다는 사실 자체를
알 수 없다.** 모듈이 없는 기기의 첫 사용자는 예외 없이 이 경로로 실패한다. A35에서 문제가 안 난
것은 그 기기에 모듈이 이미 있어 첫 확인에서 곧장 통과했기 때문이다.

### 원인 ② — 이 기기의 GMS가 설치를 못 잇는다

`설치 상태 5`는 `STATE_FAILED`, `오류 코드 8`은 `CommonStatusCodes.INTERNAL_ERROR`다.
`ModuleInstallStatusCodes`가 따로 정의한 `MODULE_NOT_FOUND`·`NOT_ALLOWED_MODULE`·
`INSUFFICIENT_STORAGE`가 아니므로 **기기에 모듈이 제공되지 않는 것도, 저장공간·네트워크 문제도
아니다.** Play 서버는 정상 응답한다.

```
I/Finsky  Module info request for [{MlkitSubjectSegmentation.optional:...}] ... hasAccount:true
D/Volley  https://play-fe.googleapis.com/fdfe/moduleDelivery [rc=200], [size=1202]
```

재부팅해도, 30초를 더 기다려도 결과가 같다. GMS 패키지의 splits 목록에도 모듈이 없다. 앱이
고칠 수 있는 범위 밖이라 이 스펙은 원인 ②를 고치지 않는다. **정확히 알아채고 정직하게 알리는
데까지가 범위다.**

## 범위

- **포함**
  - `InstallStatusListener`로 설치 종료 상태까지 기다린다.
  - 모듈 준비를 카메라 화면 진입 시점에 **미리** 건다.
  - 진행 중인 설치를 여러 호출자가 공유한다(요청 중복 제거).
  - 실패 원인을 화면 문구로 가른다 — 대상 못 찾음과 모듈 준비 실패는 다른 문구를 쓴다.
  - 설치 상태·실패 코드 로그를 최종 코드에 남긴다.
- **제외**
  - **실패 화면의 재시도 버튼** — 디자인에 없다. 기존 미결 OQ-P-153 ④를 그대로 둔다.
    재촬영 동선이 재시도를 대신한다(아래 「재시도 동선」).
  - **다운로드 진행률 표시** — 기존 로딩 오버레이를 그대로 쓴다.
  - **실패 코드별 문구 분기** — 문구는 모듈 실패 한 벌이다.
  - **앱 시작 시 `deferredInstall`** — 설치 경로를 둘로 늘리지 않는다.
  - **모듈을 끝내 못 받는 기기의 대체 경로** — open-questions로 넘긴다.

## API / 인터페이스

### data — `SegmentationModuleInstaller`

모듈 준비의 단일 소유자. `@Singleton`이지만 **코루틴 스코프도 `StateFlow`도 들지 않는다.**
스코프를 소유한 클래스는 취소·에러·재시작을 스스로 증명해야 하는데 이 클래스는 못 한다.

```kotlin
internal class SegmentationModuleInstaller(private val gateway: ModuleInstallGateway) {
    suspend fun ensureInstalled(): ModuleInstallOutcome
}

internal sealed interface ModuleInstallOutcome {
    data object Ready : ModuleInstallOutcome
    data class Failed(val errorCode: Int) : ModuleInstallOutcome
    data object TimedOut : ModuleInstallOutcome
}
```

### data — `ModuleInstallGateway`

GMS 타입이 닿는 자리를 이 이음매로 좁힌다. JVM 테스트가 설치 신호를 원하는 순서로 흘리기
위해서이고, 리포지토리에서 GMS 관심사를 덜어 내기 위해서이기도 하다.

```kotlin
internal interface ModuleInstallGateway {
    suspend fun isAvailable(): Boolean
    fun install(onSignal: (ModuleInstallSignal) -> Unit)
}

internal sealed interface ModuleInstallSignal {
    data object AlreadyInstalled : ModuleInstallSignal
    data object Completed : ModuleInstallSignal
    data class Failed(val errorCode: Int) : ModuleInstallSignal
}
```

GMS 구현이 `ModuleInstall.getClient`·`areModulesAvailable`·`installModules`·
`InstallStatusListener`·`unregisterListener`를 전부 감춘다.

### domain — `PrepareSegmentationModuleUseCase`

카메라 화면이 데이터 계층을 직접 부르지 않게 하는 통로다. 결과를 쓰지 않고 준비만 시킨다.
`ImageSegmentationRepository`에 대응 함수를 하나 추가한다.

### feature/camera

카메라 ViewModel이 `viewModelScope.launch { prepareSegmentationModule() }`로 건다.
UI 이벤트를 정지 함수로 옮기는 상태 보유자 경계라 허용되는 모양이다.

## 동작 / 상태

### 공유 대기

```kotlin
private val mutex = Mutex()
private var inFlight: CompletableDeferred<ModuleInstallOutcome>? = null

suspend fun ensureInstalled(): ModuleInstallOutcome {
    if (gateway.isAvailable()) return ModuleInstallOutcome.Ready

    val pending = mutex.withLock { inFlight ?: startInstall().also { inFlight = it } }

    return withTimeoutOrNull(INSTALL_TIMEOUT) { pending.await() }
        ?: ModuleInstallOutcome.TimedOut.also { forget(pending) }
}
```

`startInstall`은 정지 함수가 아니다. 리스너를 등록하고 설치를 요청하고 `Deferred`를 돌려주기만
한다. 완료는 리스너 콜백이 채운다. 그래서 이 클래스에 스코프가 필요 없다.

⚠️ **`CompletableDeferred`가 호출자 코루틴에 매달리지 않는 것이 이 구조의 핵심이다.** 카메라
화면을 벗어나 `viewModelScope`가 취소되면 카메라의 `await`만 끊기고 설치는 계속 간다. 이어서
편집 화면이 `ensureInstalled()`를 부르면 같은 `Deferred`에 붙는다. 요청이 두 번 나가지 않는다.

`inFlight`는 종료 상태에 도달했을 때 비우고, **상한 초과에서도 비운다**(`forget`). 후자는 방어다 —
리스너가 종료 신호를 끝내 주지 않으면 그 `Deferred`가 영영 안 채워지고, 이후 모든 호출자가 죽은
대기에 붙어 프로세스가 사는 동안 재시도가 불가능해진다. 재촬영 동선이 재시도를 대신한다는 아래
설계가 그 자리에서 무너진다. **중복 요청 한 번이 영구 정지보다 싸다** — 오늘 실측에서 같은 요청을
여러 번 보내도 해가 없었다.

`forget`은 동일성 검사로 지운다. 자기가 기다리던 `Deferred`가 아직 `inFlight`일 때만 비워서,
그 사이 새로 시작된 설치를 지우지 않는다.

### 종료 판정

| 관찰한 것 | 결과 |
|---|---|
| `isAvailable()` 이 true | `Ready` — 설치를 요청하지 않는다 |
| 설치 응답의 `areModulesAlreadyInstalled` 가 true | `Ready` |
| `STATE_COMPLETED` | 가용 여부를 한 번 더 확인한 뒤 `Ready` |
| `STATE_FAILED` · `STATE_CANCELED` | `Failed(errorCode)` |
| 설치 요청 Task 자체가 실패 | `Failed(statusCode)` |
| 상한 초과 | `TimedOut` |

`STATE_COMPLETED`에서 가용 여부를 다시 확인하는 것은 방어다. ML Kit 이슈 829가 "모듈은 있는데
ML Kit가 못 읽는" 상태를 보고했고, 우리는 그 상태를 겪은 적이 없으므로 단정하지 않는다.

`INSTALL_TIMEOUT`은 **20초**다. 재부팅 뒤 실측에서 Play 왕복만 5.4초 걸렸고 여기에 실제 다운로드가
얹힌다. 로딩 오버레이를 보는 사용자가 견딜 만하면서 정상 회선의 다운로드를 자르지 않는 값으로
잡았다. 실사용 데이터가 쌓이면 조정한다.

### 예외 매핑

`Failed`·`TimedOut`은 기존 `SegmentationException.ModuleNotReady`로 접되 실패 코드를 로그에
남긴다. `process` 단계의 `MlKitException.UNAVAILABLE` 매핑은 그대로 둔다 — 그 경로도 여전히
살아 있다.

### 화면 상태

`SegmentationState.isError: Boolean`을 `errorKind: SegmentationErrorKind?`로 바꾼다.

- `SubjectNotFound` — 후보도 폴백도 못 얻은 기존 실패. 문구를 유지한다.
- `ModuleNotReady` — 모듈 준비 실패. 문구를 새로 넣는다.

`SegmentationErrorScreen`은 제목·설명을 파라미터로 받고, Route가 `errorKind`로 문자열을 고른다.
레이아웃·아이콘·색은 건드리지 않으므로 디자인 변경이 아니다.

지금 문구는 모듈 실패 상황에서 **틀린 지시**다. 사진을 바꿔도 결과가 같기 때문이다.

```xml
<!-- 기존: SubjectNotFound 에만 쓴다 -->
<string name="segmentation_error_title">사진 편집에 실패했어요</string>
<string name="segmentation_error_description">다른 사진을 선택하거나 다시 시도해 주세요</string>

<!-- 신설: ModuleNotReady -->
<string name="segmentation_module_error_title">사진 편집 기능을 준비하지 못했어요</string>
<string name="segmentation_module_error_description">네트워크 상태를 확인하고 잠시 후 다시 시도해 주세요</string>
```

`SegmentationViewModel`이 실패 원인을 로그 없이 삼키던 것도 함께 고친다.

### 재시도 동선

버튼을 만들지 않는다. 닫기로 캔버스에 돌아가 카메라로 다시 들어가면 **카메라 진입에서 설치를
다시 건다.** 사전 설치를 카메라 진입에 걸었기 때문에 재촬영 동선이 그대로 재시도 경로가 된다.

이건 정공법이 아니라 디자인이 없는 동안의 차선이다. 실패 화면의 재시도 버튼은
[c103-multi-subject-selection](archive/2026-08-23-c103-multi-subject-selection.md)이 "디자인에
없다"는 이유로 제외했고 OQ-P-153 ④가 추적 중이다.

## 파일 구성

| 파일 | 변경 |
|---|---|
| `SegmentationModuleInstaller.kt` | 신설 — 공유 대기·종료 판정 |
| `ModuleInstallGateway.kt` | 신설 — GMS 이음매와 그 구현 |
| `ImageSegmentationRepositoryImpl.kt` | `ensureModuleInstalled` 제거, 설치기 주입, 준비 함수 추가 |
| `ImageSegmentationRepository.kt` | 준비 함수 선언 추가 |
| `PrepareSegmentationModuleUseCase.kt` | 신설 |
| 카메라 ViewModel | 진입 시 준비 호출 |
| `SegmentationViewModel.kt` | `isError` → `errorKind`, 실패 원인 로깅 |
| `SegmentationRoute.kt` · `SegmentationErrorScreen.kt` | 문구를 파라미터로 받는다 |
| `strings.xml` | 모듈 실패 문구 2개 추가 |

## 테스트

JVM 단위 테스트를 `runTest` 가상 시간으로 돌린다. 가짜 `ModuleInstallGateway`가 신호를 흘린다.

1. 이미 가용하면 설치를 요청하지 않는다 — `install` 호출 0회.
2. 동시 호출 둘이 요청을 한 번만 낸다. 사전 설치를 카메라에 건 대가로 생긴 위험이라 가장 중요하다.
3. 먼저 들어온 호출자를 취소해도 설치가 살아 있고, 두 번째 호출자가 같은 대기에 붙어 `Ready`를 받는다.
4. `STATE_FAILED`가 실패 코드를 실어 나온다.
5. 상한을 넘기면 `TimedOut`이고, 그 뒤 호출자는 여전히 같은 대기에 붙는다.

ViewModel은 `errorKind` 매핑만 본다.

**테스트하지 않는 것**: 실제 GMS 설치는 단위 테스트로 재현할 수 없다. 실기기와 logcat이
유일한 확인 수단이라, **진단 로그를 최종 코드에 남긴다**(진단용 30초 폴링만 걷어낸다).

## 주의 / 열린 질문

- ⚠️ **원인 ②는 이 스펙이 못 고친다.** Z Flip 3처럼 GMS가 `INTERNAL_ERROR`로 설치를 못 잇는
  기기에서는 재촬영을 몇 번 돌아도 결과가 같다. 문구가 정직해지고 로그로 원인을 잡을 수 있게 될
  뿐이다. 그런 기기의 대체 경로는 open-questions로 올린다.
- 매니페스트 `com.google.mlkit.vision.DEPENDENCIES=subject_segment`는 그대로 둔다. ML Kit 문서가
  "Play 스토어 설치 후 자동 다운로드"로 설명하는 힌트이고, 카메라 진입 설치와 겹쳐도 해가 없다.
- `INSTALL_TIMEOUT` 20초는 실측 하나에 기댄 값이다.
