# 단면 형상 편집 가이드

케이스 형상은 `js/01-core.js`의 `CASES` 배열에서 수정합니다. `L`과 `shape.sections`만으로 공통 단면을 만들고, 계산·2D·3D는 그 단면에서 폭·면적·외피·치수선을 파생합니다.

## 지원 범위

현재 모델은 **직교 계단형 단면을 길이 `L`만큼 동일하게 압출한 구조물**을 지원합니다.

- 구간 1개, 기존 ㄴ자형 2개, 3개 이상 모두 가능
- 인접 구간 높이가 내려가거나 다시 올라가는 형태 가능
- 모든 지붕은 수평, 모든 단차·외벽은 수직
- 단면은 시작 외벽에서 반대편 외벽까지 끊김 없이 이어지는 x-단조 외곽선
- 단위는 모두 mm
- 바닥은 덮기 및 외피 수량에서 제외

## 데이터 구조

```js
{
  id: "caseId",                 // CASES 안에서 유일
  name: "표시 이름",
  L: 26000,                      // 길이 방향 압출 길이
  shape: {
    schemaVersion: 1,
    type: "stepped-profile",
    startSide: "left",          // "left" 또는 "right"
    startRunLabel: "시작 외벽 직하강",
    profileRunLabel: "지붕→반대편 외벽",
    sections: [ /* 아래 설명 */ ]
  },
  reviewedEnd: { /* 선택 사항 */ }
}
```

`sections`는 **시작 외벽에서 반대편 외벽으로 진행하는 순서**입니다.

| 필드 | 필수 | 규칙 |
|---|---:|---|
| `id` | 권장 | 영문·숫자·`_`·`-` 사용, 구간 안에서 유일 |
| `label` | 권장 | 치수표와 단차 이름에 표시 |
| `roofLabel` | 선택 | 해당 구간 수평면 이름 |
| `wallLabel` | 선택 | 첫 구간이면 시작 외벽, 마지막 구간이면 반대편 외벽 이름 |
| `width` | 필수 | 0보다 큰 유한 숫자 |
| `height` | 필수 | 0보다 큰 유한 숫자 |

중간 구간의 `wallLabel`은 외벽 이름으로 사용되지 않습니다. 중간의 수직면은 인접한 두 `label`을 조합해 단차로 자동 생성됩니다.

`startSide: "left"`이면 첫 구간이 정면 왼쪽에, `"right"`이면 정면 오른쪽에 보입니다. 이것은 시각화의 좌우 미러링만 바꾸며 수량에는 영향이 없습니다. `startSide`를 바꿔도 `sections` 배열 순서를 뒤집지 않습니다.

## 예제

### 한 단: 직사각형 단면

```js
{
  id: "caseFlat", name: "평지붕", L: 24000,
  shape: {
    schemaVersion: 1, type: "stepped-profile", startSide: "left",
    startRunLabel: "왼쪽 외벽 직하강",
    profileRunLabel: "지붕→오른쪽 외벽",
    sections: [
      { id: "main", label: "주 구간", roofLabel: "평지붕",
        wallLabel: "외벽", width: 6000, height: 3200 }
    ]
  }
}
```

### 두 단: 기존 ㄴ자형

```js
{
  id: "caseStep2", name: "2단", L: 26327.3,
  shape: {
    schemaVersion: 1, type: "stepped-profile", startSide: "left",
    startRunLabel: "높은 벽 직하강",
    profileRunLabel: "지붕→낮은 벽",
    sections: [
      { id: "high", label: "높은 구간", roofLabel: "높은 지붕",
        wallLabel: "높은 벽", width: 5078.6, height: 4170 },
      { id: "low", label: "낮은 구간", roofLabel: "낮은 지붕",
        wallLabel: "낮은 벽", width: 1974.4, height: 2766 }
    ]
  }
}
```

### 세 단 이상: 내려갔다 다시 올라가는 단면

```js
{
  id: "caseStep3", name: "3단 테스트", L: 25000,
  shape: {
    schemaVersion: 1, type: "stepped-profile", startSide: "right",
    startRunLabel: "A 외벽 직하강",
    profileRunLabel: "A 지붕→C 외벽",
    sections: [
      { id: "a", label: "A 구간", roofLabel: "A 지붕",
        wallLabel: "A 외벽", width: 2400, height: 4800 },
      { id: "b", label: "B 구간", roofLabel: "B 지붕",
        width: 1800, height: 3000 },
      { id: "c", label: "C 구간", roofLabel: "C 지붕",
        wallLabel: "C 외벽", width: 1200, height: 3900 }
    ]
  }
}
```

이 예제의 전체 폭은 `2400 + 1800 + 1200 = 5400`, 지붕·단차 경로는 `2400 + 1800 + 1800 + 900 + 1200 = 8100mm`입니다. 첫 외벽 run은 `4800mm`, 반대 방향 profile run은 `8100 + 3900 = 12000mm`로 파생됩니다.

## 양끝면 검토값과 형상 서명

`reviewedEnd`는 실측 또는 재단 검토를 마친 혼합 배치 수량만 등록합니다.

```js
reviewedEnd: {
  geometrySignature: "5078.6x4170|1974.4x2766",
  minPerFace: 26,
  practicalPerFace: 26,
  note: "검토 근거"
}
```

형상 서명은 정규화된 각 구간의 `width + "x" + height`를 배열 순서대로 `|`로 연결한 값입니다. 개발자 콘솔에서 다음처럼 현재 값을 확인할 수 있습니다.

```js
normalizeCaseShape(CASES.find(c => c.id === "caseStep2")).geometrySignature
```

안전 규칙은 다음과 같습니다.

- `reviewedEnd`가 없으면 양끝면은 가로 고정 격자와 세로 고정 격자 중 작은 수량을 사용합니다.
- 구간 폭·높이·순서를 바꿔 현재 서명이 `reviewedEnd.geometrySignature`와 달라져도 같은 격자 fallback을 사용하고, 기존 혼합 수량은 비활성화합니다.
- `practicalPerFace`는 `minPerFace` 이상이어야 하며, `minPerFace`는 끝면 면적 하한보다 작을 수 없습니다.
- 새 치수의 재단 검토가 끝나기 전에는 경고를 없애기 위해 서명만 바꾸지 않습니다.

## 케이스 추가·수정 순서

1. `js/01-core.js`의 `CASES`에서 가장 가까운 케이스 객체를 복사합니다.
2. 고유한 `id`, 화면용 `name`, 0보다 큰 `L`을 지정합니다.
3. 시작 외벽부터 순서대로 `shape.sections`를 작성하고 각 `width`, `height`, 라벨을 바꿉니다.
4. 정면에서 첫 구간이 보일 쪽을 `shape.startSide`로 정합니다.
5. 새 형상은 우선 `reviewedEnd`를 생략합니다. 가로·세로 고정 격자 fallback으로 계산·도면을 검증합니다.
6. 실제 혼합 재단안을 검토했다면 현재 `geometrySignature`, `minPerFace`, `practicalPerFace`, 근거 `note`를 함께 등록합니다.
7. 아래 체크리스트와 A/B/C 회귀값을 확인합니다.

기존 케이스 치수를 바꿀 때는 `reviewedEnd.geometrySignature`를 먼저 수정하지 마십시오. 서명 불일치 경고와 fallback 전환을 확인한 뒤, 새 재단 검토가 끝났을 때 검토값 전체를 갱신합니다.

## 검증 체크리스트

먼저 저장소 루트에서 자동 회귀 검증을 실행합니다.

```powershell
node tests/run-all.js
```

이 테스트는 기존 A/B/C 결과, 1단 직사각형, 상승·하강이 섞인 4단 단면, 오래된 `reviewedEnd`의 자동 fallback, 2D/3D 공통 모델의 `NaN`/`undefined` 여부를 확인합니다.

- 브라우저 콘솔에 형상 검증 오류나 `undefined`/`NaN`이 없는가
- `id`가 중복되지 않고 `L`, 모든 `width`·`height`가 0보다 큰가
- 전체 폭이 `sum(width)`, 끝면 면적이 `sum(width×height)`와 일치하는가
- 지붕 수가 구간 수와 같고, 높이가 다른 인접 구간마다 단차가 하나씩 생기는가
- 시작 외벽 높이와 profile 경로 마지막 외벽 높이가 설계도와 일치하는가
- `startSide`를 바꾸면 정면·3D가 좌우 반전되고 수량은 그대로인가
- 1단 및 3단 이상 테스트 형상이 계산·2D·3D에서 모두 표시되는가
- 치수를 일부러 바꾸면 오래된 `reviewedEnd`가 비활성화되고 격자 fallback 안내가 나오는가
- 가로·세로·혼합 및 잔여 밴드 시나리오에 최종 부족량과 절단 잔여가 숫자로 표시되는가
- 기존 최소 기준 회귀값이 A 430장, B 445장, C 386장이고 5% 발주가 452장, 468장, 406장인가

## 지원하지 않는 형상

- 길이 `L`을 따라 단면·높이·폭이 변하는 구조
- 경사 지붕, 사선 벽, 원호·곡면
- 구멍, 중정, 터널 또는 서로 분리된 여러 단면
- 외곽선이 폭 방향으로 되돌아가는 돌출·오버행·언더컷
- 바닥 아래 영역, 0 또는 음수 치수
- 바닥 보온재, 개구부 공제, 겹침·고정구·현장 이음 여유의 상세 시뮬레이션

이 범위를 벗어나는 형상은 `sections`를 억지로 근사하지 말고, 지오메트리 스키마와 면 분할·재단 계산을 함께 확장해야 합니다.
