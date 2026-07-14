---
tags: [concept, product]
sources: [C-202-토핑-편집자-확인-규칙-v0.1.md, 기능정의서-v4.md, 기능정의서-v5.md]
updated: 2026-07-14
---

# 토핑 Spotlight (C-202)

[[협업-캔버스-앱]]의 **C-202 "작업한 그룹원 닉네임 노출"** 화면 상호작용. 캔버스에 배치된 **타인의 [[토핑]]을 탭**하면 해당 토핑이 Spotlight 상태로 전환되어 강조되고, 작성자 정보가 [[toast|Toast]]로 노출된다. C-202가 기능정의서 표 1행에서 v0.1 정책서로 확장되며 정의됨([[C-202-토핑-편집자-확인-규칙-v0.1]]).

## 진입 분기
- **타인 토핑 탭** → Spotlight 상태 진입.
- **본인 토핑 탭** → 본 정책 미적용, **C-305 토핑 편집** 진입([[토핑]] 편집은 자기 것만).

## 상태
- **Default**: 캔버스 기본. 모든 토핑 동일 레벨 노출.
- **Spotlighted**: 선택 토핑 1개만 강조, 나머지 캔버스 영역 Dim. 진입과 동시에 작성자 Toast 1회.

## 상태 전이
| 전이 | 트리거 |
|---|---|
| Default → Spotlighted | 타인 토핑 탭 |
| Spotlighted → Default | Spotlight 토핑 **제외** 영역(Dim 포함) 탭 |
| Spotlighted → Spotlighted | **미지원**. 다른 토핑 선택하려면 반드시 Default 경유 |

> 원본에 "안 거쳐도 되게 개발 가능하면 환영" 취지의 디자인 주석 있음(직접 전환 허용은 열린 여지).

## Spotlight 렌더링
- **Dim 레이어**: 선택 토핑 제외 캔버스 전체에 **Transparency/Black-50** 적용. 배경·다른 토핑 모두 Dim, Spotlight 토핑만 영향 없음.
- **z-index 우선순위**: **Spotlight 토핑 > Dim 레이어 > 나머지 토핑 > 배경**. Spotlight 토핑만 최상위로 이동, 나머지는 기존 z 유지.

## Toast
- Spotlight 진입 시 **1회** 노출. 문구 `{닉네임} 님이 {상대시간} 전에 쌓았어요`.
- 노출/소멸 방식은 [[toast|Toast 공통 규칙]] 준수. 닉네임 텍스트 컬러는 [[nametag-chip]] 매핑.

## 엣지 케이스
- **탈퇴/그룹 탈퇴 유저**: Spotlight 정상 동작, Toast만 **'알 수 없음'** 표기(예: `알 수 없는 사용자가 59분 전에 쌓았어요`). ← [[그룹]] "알 수 없음" 정책과 일치.
- **앱 백그라운드→복귀**: Spotlight 해제 후 Default 복귀.
- **Pull-to-Refresh**: 먼저 Default 복귀 후 새로고침.
