---
id: ADR-0016
title: 유효성 결과 — domain 의미 sealed 반환 + 표시 문자열 프레젠테이션 매핑
status: accepted
date: 2026-07-23
deciders: Parfait 팀
supersedes:
superseded_by:
related_adr: ADR-0001, ADR-0005, ADR-0009
related_spec: s002-account-info, s102-group-nickname
related_architecture: state-management
platforms: android
tags: [adr, parfait, i18n, domain, presentation]
---

# ADR-0016: 유효성 결과 — domain 의미 sealed 반환 + 표시 문자열 프레젠테이션 매핑

> 상태·날짜·결정자·대체 관계는 위 frontmatter가 단일 출처. 본문은 결정 내용에 집중.

## 맥락

`CheckNameValidUseCase`(domain)가 반환하던 `NicknameResult`는 실패 사유를 **한국어 문자열**로
담고 있었다(`data class NicknameResult(isSuccess, errorMessage: String?)`). 이 구조는 두 문제가 있다.

- **다국어 불가**: 표시 문자열이 domain에 하드코딩되어 Android 리소스(`strings.xml`) 다국어 체계로 통합할 수 없다.
- **레이어 역전**: "무엇이 틀렸나"(도메인 규칙)와 "사용자에게 어떻게 보이나"(표시)가 domain에 섞였다.

닉네임 유효성은 S-102(그룹 내 닉네임)·S-002(앱 닉네임)가 **공유**하므로, 매핑을 특정 feature에 두면 중복된다.

## 결정

**domain은 의미(성공/실패 종류)만 반환하고, 표시 문자열 매핑은 프레젠테이션 공유 레이어(`core:ui`)가 소유한다.**

- `NicknameResult`를 **sealed interface**로 전환: `Success` + `Error.{Empty, SpaceAtEdge, DuplicatedSpace, InvalidCharacter}`. 문자열 필드 제거.
- `CheckNameValidUseCase`는 규칙 위반 시 대응 `NicknameResult.Error` 변형을 반환(순차 검사·첫 실패).
- `core:ui`에 `NicknameResult.Error.toStringResource()`(@Composable, `stringResource` 위임) + 에러 문자열 `strings.xml`. 두 feature가 공용.
- UI State는 표시 문자열이 아닌 `NicknameResult.Error?`(도메인 의미)를 보유. Screen이 렌더 시점에 문자열로 매핑.
- `core:ui`는 이 매핑을 위해 `:domain`에 의존(ui→domain, ADR-0001 단방향과 정합 — 상위 UI가 하위 domain 참조).

## 대안

- **feature마다 매핑 보유** — "feature에서 extension"이라는 직관에 맞고 core 무변경. 그러나 setting·groups가 동일
  에러 문자열 4종·매핑을 각각 복제(DRY 위반). 닉네임 규칙이 이미 공유 domain인데 표시만 분산됨.
  **→ 기각:** 공유 규칙엔 공유 매핑. `core:ui` 단일 소유가 정합.
- **domain이 @StringRes Int 반환** — domain이 Android 리소스 ID를 들고 있어 다국어는 되나 domain이 Android/R에 오염.
  **→ 기각:** domain 순수성 위반(ADR-0001·0011의 domain 비-Android 원칙).
- **매핑을 `messageRes(): @StringRes Int`(비-Composable)로** — 테스트·재사용 유연. 그러나 호출부마다 `stringResource` 필요.
  as-built는 `toStringResource(): @Composable String`으로 호출부(`error?.toStringResource()`) 간결화 선택.
  **→ 보류(대안):** 컴포지션 밖 사용처가 생기면 @StringRes 반환형으로 재검토.

## 영향

**긍정**

- 에러 문자열이 `strings.xml`로 통합 → 다국어 대응 가능.
- domain은 표시 무관·순수 유지. 규칙과 표현 분리.
- 매핑 단일 소유(`core:ui`) → S-102·S-002 및 향후 닉네임 화면 공용, 중복 0.

**트레이드오프**

- `core:ui`가 `:domain`에 의존 추가(허용 방향이나 결합 1건 증가).
- `toStringResource()`가 @Composable이라 컴포지션 밖(예: ViewModel 로그) 사용 불가.

**위험·방어**

- 새 `Error` 변형 추가 시 `when` 매핑이 exhaustive라 컴파일 단계에서 누락 감지(sealed 이점).
- 기존 S-102 소비처 동반 리팩터 완료(GroupNickName VM/Screen), 컴파일·ktlint·assemble 검증.
