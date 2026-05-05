export type GlossaryEntry = {
  term: string;
  short: string;
  formula?: string;
  good?: string;
  bad?: string;
  zimcarry?: string;
  category?: "growth" | "profit" | "stability" | "activity" | "cash" | "investment" | "concept";
};

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ── 개념 / 약어 ──────────────────────────────────────────────
  PMF: {
    term: "PMF (Product-Market Fit)",
    short: "제품·서비스가 시장 수요와 맞아떨어진 단계 — 즉 '고객이 진짜 필요로 한다'가 검증된 상태",
    formula: "정량 신호: 매출이 광고를 안 켜도 자라는가, 동일 고객이 반복 사용하는가, 고객 직접 추천이 일어나는가",
    good: "5년간 매출 5배 이상 성장 + 동일 고객 반복 사용",
    bad: "광고 끄면 매출 즉시 감소 / 초기 호기심 후 정체",
    zimcarry:
      "5년간 매출 11.5배 (6.6억 → 76.2억). 광고비는 매출의 0.16%만 쓰는데도 매년 큰 폭으로 성장 = 사용자가 자발적으로 찾는 서비스. 다만 성장률이 178% → 29%로 둔화 중 (S-curve 진입).",
    category: "concept",
  },
  BEP: {
    term: "BEP (손익분기점)",
    short: "매출이 비용을 정확히 메워 영업이익이 0이 되는 지점. 그 이상 팔면 흑자.",
    formula: "BEP = 고정비 ÷ (1 - 변동비율) — 단순화하면 영업이익률이 0%가 되는 매출",
    good: "성장 단계에서 BEP를 빨리 통과할수록 외부 자금 의존이 줄어듦",
    bad: "BEP 도달 전에 현금이 바닥나면 추가 증자 또는 폐업",
    zimcarry:
      "영업이익률이 -33%(2023) → -8%(2025)로 빠르게 좁혀짐. EBITDA 마진 -5%로 BEP 가시권. 2026~2027년 흑자 전환 시나리오 진입.",
    category: "concept",
  },
  EBITDA: {
    term: "EBITDA (이자·세금·감가상각 차감 전 이익)",
    short:
      "영업이익에 감가상각비와 무형자산상각비를 다시 더한 값. 회계상 이익 말고 '실제 영업으로 번 현금성 이익'을 보는 지표.",
    formula: "EBITDA = 영업이익 + 감가상각비 + 무형자산상각비",
    good: "(+)면 영업이 현금을 만들어내는 단계. EBITDA 마진 10%↑면 우수",
    bad: "(-)면 영업으로 현금을 못 벌고 있다는 뜻. 외부 자금 필요",
    zimcarry:
      "2025년 -3.77억 (마진 -4.9%). 2023년 -12.45억 → 빠른 회복. 영업이익(-6.15억)에 감가 2.26억 + 무형 0.12억 가산.",
    category: "cash",
  },
  OCF: {
    term: "OCF (영업활동 현금흐름, Operating Cash Flow)",
    short:
      "본업으로 실제 통장에 들어오는 현금. 회계 이익이 아니라 진짜 현금 흐름.",
    formula: "OCF ≈ 당기순이익 + 비현금비용(감가 등) - 운전자본 증가분",
    good: "(+)이고 매년 늘면 본업이 자체 자금을 만들어내는 단계 = 자립",
    bad: "(-)면 본업이 현금을 까먹고 있어 외부 자금에 의존해야 함",
    zimcarry:
      "2023~2025 3년 연속 (-). 2025년 -3.33억. 외부 자금(증자)에 100% 의존하는 사이클.",
    category: "cash",
  },
  FCF: {
    term: "FCF (잉여현금흐름, Free Cash Flow)",
    short:
      "OCF에서 시설·장비 투자(CAPEX)를 빼고 진짜로 회사가 자유롭게 쓸 수 있는 현금. 주주 배당이나 부채 상환의 원천.",
    formula: "FCF = OCF − CAPEX",
    good: "(+)면 자기 자금으로 성장과 주주환원이 가능. 5%↑ 마진이면 우수",
    bad: "(-)면 매년 외부에서 돈을 끌어와야 굴러감",
    zimcarry:
      "2025년 -7.48억, 누적(5년) -34.96억. 매년 외부 자금 유입 없이는 사업 유지 불가능한 상태.",
    category: "cash",
  },
  CAPEX: {
    term: "CAPEX (Capital Expenditure, 자본적 지출)",
    short: "유형·무형 자산을 사서 장기적으로 쓰는 투자 지출. 시설·장비·소프트웨어 개발비 등.",
    formula: "CAPEX = 유형자산 증가분 + 무형자산 증가분 + 투자자산 증가분",
    good: "성장기 매출 대비 5~15%면 정상. 매출 대비 너무 낮으면 미래 경쟁력 부족",
    bad: "회수 안 되는 자산에 묶이면 부채만 늘어남",
    zimcarry:
      "2025년 4.14억 — 개발비(무형) 9.7억 누적. 자산화하지 않고 비용처리하면 영업이익이 더 깊은 적자였을 것.",
    category: "investment",
  },
  Runway: {
    term: "Runway (현금 소진 기간)",
    short:
      "현금 잔고가 매월 적자(-FCF)를 메우며 몇 개월 버틸 수 있는지. 스타트업 생존 시계.",
    formula: "Runway = 현재 현금 ÷ (월간 -FCF)",
    good: "12~18개월↑이면 추가 펀딩 협상 시간 확보. 24개월↑면 안전",
    bad: "6개월 이하면 즉시 펀딩 또는 비용 절감 필요",
    zimcarry:
      "2024년 2.3개월까지 떨어졌다가 2025년 Bridge 증자(20억)로 16.2개월 재확보. 다음 펀딩 협상 윈도우 확보됨.",
    category: "cash",
  },
  SGA: {
    term: "SG&A (판매비와관리비, 판관비)",
    short: "본업을 돌리는 데 드는 모든 비용 — 인건비·임차료·광고비·수수료 등.",
    formula: "SG&A = 인건비 + 임차료 + 수수료 + 운반비 + 감가상각 + 기타",
    good: "매출 대비 비율이 매년 낮아지는 게 정상. 100% 미만이면 영업이익 흑자",
    bad: "매출보다 빨리 늘면 적자 폭 확대",
    zimcarry:
      "매출 대비 108% (2025). 2023년 133% → 점진 개선. 100% 아래로 내려가야 영업이익 흑자.",
    category: "profit",
  },
  YoY: {
    term: "YoY (Year-over-Year, 전년 대비)",
    short: "직전 연도 대비 증감률. 같은 분기/연도끼리 비교해 계절성 영향을 제거.",
    formula: "YoY% = (올해값 ÷ 작년값) − 1",
    category: "concept",
  },
  CAGR: {
    term: "CAGR (Compound Annual Growth Rate, 연평균성장률)",
    short:
      "여러 해에 걸친 성장을 '매년 평균 몇 %씩 자랐는가'로 환산한 값. 단순 연도별 성장률보다 추세 비교에 유용.",
    formula: "CAGR = (말기값 ÷ 초기값)^(1 ÷ 기간) − 1",
    good: "스타트업 30%↑ 양호 / 50%↑ 고성장",
    zimcarry:
      "매출 6.6 → 76.2억 (5년) → CAGR 60.6%. 일반 제조업 대비 매우 높은 성장률.",
    category: "growth",
  },
  NWC: {
    term: "NWC (Net Working Capital, 순운전자본)",
    short:
      "영업에 묶여 있는 단기 자금. 매출채권·재고가 늘면 NWC 증가(현금 유출), 미지급비용이 늘면 감소(현금 보존).",
    formula: "NWC = 영업용 유동자산 − 영업용 유동부채",
    zimcarry:
      "2025년 미지급비용 +144M(NWC 감소 → OCF +로 작용) — 단 직원·공급사 미지급 풀리면 OCF 즉시 (-)로 전환 위험.",
    category: "cash",
  },
  KPI: {
    term: "KPI (Key Performance Indicator, 핵심 성과 지표)",
    short: "사업 성과를 한눈에 판단할 수 있는 핵심 수치. 보통 5~10개로 압축.",
    category: "concept",
  },
  IR: {
    term: "IR (Investor Relations, 기업 홍보 자료)",
    short:
      "회사가 투자 유치 또는 기존 주주와 소통을 위해 만드는 발표 자료. 낙관 편향이 있으므로 실적과 교차검증 필수.",
    category: "concept",
  },
  ROE: {
    term: "ROE (Return on Equity, 자기자본이익률)",
    short: "주주가 넣은 자본 대비 회사가 1년에 얼마나 벌었는지. 주주 입장 수익률.",
    formula: "ROE = 당기순이익 ÷ 평균 자본",
    good: "10%↑ 양호, 15%↑ 우수",
    bad: "(-)면 자본을 까먹는 중",
    zimcarry: "2025년 -80% — 자본을 매년 갉아먹는 적자 상태.",
    category: "profit",
  },
  ROA: {
    term: "ROA (Return on Assets, 총자산이익률)",
    short: "회사가 보유한 모든 자산(부채+자본 포함)으로 얼마나 벌었는지. 자산 활용 효율.",
    formula: "ROA = 당기순이익 ÷ 평균 자산",
    good: "5%↑ 양호 (서비스업)",
    zimcarry: "2025년 -23%. ROE보다 덜 음수 = 자산 일부는 부채로 조달.",
    category: "profit",
  },
  "K-IFRS": {
    term: "K-IFRS (한국채택 국제회계기준)",
    short:
      "한국 상장기업·외부감사 대상 비상장 법인이 따르는 회계 표준. 재무제표 작성·공시 룰을 정함.",
    zimcarry:
      "짐캐리 외부감사 시 K-IFRS 적용. 개발비 자본화 4요건(기술 실현 가능성/미래 효익/완성 의도와 능력/원가 측정) 충족 입증 필요.",
    category: "concept",
  },
  "M&A": {
    term: "M&A (Mergers & Acquisitions, 인수·합병)",
    short:
      "회사를 사거나(인수) 합치거나(합병) 하는 거래. 가치 평가, 거래 구조, 우선주·차입 처리 등 복잡한 조건 협상이 핵심.",
    category: "concept",
  },
  "EV/Sales": {
    term: "EV/Sales (Enterprise Value to Sales)",
    short:
      "기업가치(EV) ÷ 연매출. 적자 기업이라 EV/EBITDA 못 쓸 때 쓰는 매출 기반 가치 멀티플.",
    formula: "EV = 시가총액(또는 거래가) + 순차입금. EV/Sales = EV ÷ 연매출",
    good: "동종업계 Comp 비교 — 특송·라스트마일은 5~8x 범위",
    zimcarry:
      "EBITDA 음수 단계라 EV/EBITDA 불가 → EV/Sales 5~8x × 76억 = 380~610억. IR 디스카운트 35~45% 적용 시 250~350억이 협상 출발선.",
    category: "investment",
  },
  "EV/EBITDA": {
    term: "EV/EBITDA",
    short:
      "기업가치(EV) ÷ EBITDA. 본업 현금 창출력 대비 가치 평가. EBITDA가 (+)일 때만 사용.",
    formula: "EV ÷ EBITDA",
    good: "동종업계 Comp 비교 — 특송·물류는 8~12x 범위",
    zimcarry:
      "2025 EBITDA +59M(거의 0). 2026~2027 EBITDA 안정화 후 EV/EBITDA 멀티플 적용 가능 → 가치 점프 분기점.",
    category: "investment",
  },
  Bridge: {
    term: "Bridge 라운드 (Bridge Round)",
    short:
      "정식 다음 라운드(예: Series B) 전에 자금이 부족할 때 받는 임시 보강 투자. 보통 기존 투자자가 참여.",
    zimcarry:
      "2025년 12월 Series A Bridge +1,997M (중기부+케이브릿지파트너스). 2024년 자본 19M 위기 → Bridge 증자로 회복 + Runway 16.2개월 재확보.",
    category: "investment",
  },
  "Series A": {
    term: "Series A 투자 라운드",
    short:
      "Seed 다음 단계의 정식 첫 대규모 투자 라운드. 보통 매출 검증 단계의 스타트업이 받음.",
    zimcarry:
      "2023년 Series A +1,900M (케이브릿지·신보·코로프라·ESI). 자본금 22 → 518M(22배), 기존 주주 95% 희석 추정.",
    category: "investment",
  },
  "Pre-A": {
    term: "Pre-A 투자 라운드",
    short:
      "Seed와 Series A 사이 단계. 매출 초기 검증 단계에서 받는 중간 규모 투자.",
    zimcarry: "2022년 Pre-A +651M (케이브릿지인베스트먼트·신보).",
    category: "investment",
  },
  Seed: {
    term: "Seed 투자 라운드",
    short:
      "스타트업 초기에 제품·시장 검증을 위해 받는 첫 외부 투자. 보통 엔젤·액셀러레이터.",
    zimcarry: "2020년 Seed +50M (엔젤).",
    category: "investment",
  },
  DSO: {
    term: "DSO (Days Sales Outstanding, 매출채권 회수기간)",
    short: "매출이 일어난 뒤 평균 며칠 만에 현금이 들어오는지.",
    formula: "DSO = 365 ÷ 매출채권 회전율",
    good: "30일 이하 우수, 60일↑ 회수 부담",
    zimcarry: "2025년 약 10일 — 절대값은 양호하나 추세상 매출(4.2x)보다 매출채권(6.7x)이 빨리 늠.",
    category: "activity",
  },

  // ── 매출/이익 항목 ───────────────────────────────────────────
  매출액: {
    term: "매출액 (Revenue)",
    short: "본업으로 1년간 받은 총 금액. 짐캐리는 짐 배송·보관·특송 서비스로 받은 돈.",
    good: "스타트업 단계에선 연 30%↑ 성장이 PMF 신호. 둔화는 시장 포화 또는 채널 한계",
    zimcarry:
      "2021년 6.6억 → 2025년 76.2억 (11.5배). 2025 YoY +28.6%로 성장률 둔화 중 (S-curve 진입).",
    category: "growth",
  },
  영업이익: {
    term: "영업이익 (Operating Income)",
    short: "매출에서 매출원가와 판관비를 모두 뺀 본업 이익. 회사가 본업으로 진짜 벌었는지 보여줌.",
    formula: "영업이익 = 매출 − 매출원가 − 판매비와관리비",
    good: "영업이익률 10%↑ 우수. 5%↑ 양호",
    bad: "영업이익률 (-)이면 본업이 매년 손해보고 있다는 뜻",
    zimcarry:
      "2025년 -6.15억 (-8.1%). 2023년 -12.45억 → 빠른 회복. BEP 도달까지 2년 내 가시권.",
    category: "profit",
  },
  당기순이익: {
    term: "당기순이익 (Net Income)",
    short: "영업이익에 영업외 손익, 이자비용, 세금까지 모두 차감한 최종 이익.",
    formula: "순이익 = 영업이익 + 영업외수익 − 이자비용 − 영업외비용 − 세금",
    zimcarry:
      "2025년 -6.39억. 8년 누적 적자 -28억으로 자본 잠식 사이클 반복.",
    category: "profit",
  },
  자본총계: {
    term: "자본총계 (Total Equity)",
    short: "총자산에서 부채를 뺀 주주 몫. 회사가 실제로 갖고 있는 순자산.",
    formula: "자본 = 자산 − 부채",
    good: "지속적 (+) 흐름이 정상. 매출 대비 적정 비율 30%↑",
    bad: "(-) = 자본잠식 — 부채가 자산보다 많아 청산 시 빚이 남음",
    zimcarry:
      "2021년 -36, 2024년 19백만으로 자본잠식 2회. 2025년 7.95억으로 회복(증자 효과).",
    category: "stability",
  },
  현금성자산: {
    term: "현금 및 현금성자산",
    short: "통장 잔고 + 즉시 인출 가능한 단기 금융상품. 회사가 당장 쓸 수 있는 현금.",
    good: "최소 3~6개월 운영비, 성장단계는 12개월↑",
    zimcarry: "2025년 10.12억 (2024년 1.86억에서 Bridge 증자로 회복). Runway 16.2개월.",
    category: "cash",
  },

  // ── 비율/지표 ────────────────────────────────────────────────
  매출성장률: {
    term: "매출 성장률 (YoY)",
    short: "직전 연도 대비 매출 증가율. 사업이 자라는 속도.",
    formula: "(올해 매출 ÷ 작년 매출) − 1",
    good: "20%↑ 양호 / 50%↑ 고성장 단계",
    zimcarry: "2025년 +28.6% (전년 +59% 대비 둔화). S-curve 후반 진입 신호.",
    category: "growth",
  },
  영업이익률: {
    term: "영업이익률 (Operating Margin)",
    short: "매출 100원 중 본업으로 몇 원을 남겼는지.",
    formula: "영업이익 ÷ 매출",
    good: "10%↑ 우수, 5%↑ 양호",
    bad: "(-)면 매출 늘수록 적자도 같이 커지는 구조",
    zimcarry: "2025년 -8.1% (2023년 -33% → 빠른 개선).",
    category: "profit",
  },
  EBITDA마진: {
    term: "EBITDA 마진",
    short: "매출 100원 중 EBITDA로 남은 비율. 감가상각 등 회계 항목 빼고 본 영업 현금성 이익률.",
    formula: "EBITDA ÷ 매출",
    good: "10%↑ 우수, 5%↑ 양호",
    zimcarry: "2025년 -4.9%. BEP 임박 신호.",
    category: "profit",
  },
  매출총이익률: {
    term: "매출총이익률 (Gross Margin)",
    short: "매출에서 매출원가만 뺀 1차 이익률. 서비스업은 보통 90~100%로 매우 높음.",
    formula: "(매출 − 매출원가) ÷ 매출",
    zimcarry: "약 100% — 서비스업 특성. 진짜 수익성은 판관비 빼고 봐야 함.",
    category: "profit",
  },
  부채비율: {
    term: "부채비율 (Debt Ratio)",
    short: "주주 자본 대비 부채. 200% 이하가 안전권.",
    formula: "부채 ÷ 자본 × 100",
    good: "100% 이하 안전, 200% 이하 양호",
    bad: "300%↑ 부채 부담 큼 / 500%↑ 위험",
    zimcarry: "2025년 322%. 2024년 11,040%(자본잠식)에서 증자로 정상화 진입.",
    category: "stability",
  },
  유동비율: {
    term: "유동비율 (Current Ratio)",
    short: "1년 안에 갚을 빚 대비 1년 안에 현금화할 자산. 단기 지급능력.",
    formula: "유동자산 ÷ 유동부채",
    good: "150%↑ 안전, 100%↑ 양호",
    bad: "100% 이하 = 1년 내 빚 갚을 자산 부족",
    zimcarry: "2025년 57% — 단기 지급능력 부족. 매년 차입 롤오버 필수.",
    category: "stability",
  },
  자기자본비율: {
    term: "자기자본비율 (Equity Ratio)",
    short: "총자산 중 주주 몫(자본)의 비중. 부채 의존도의 반대 지표.",
    formula: "자본 ÷ 자산",
    good: "30%↑ 안전, 50%↑ 매우 안정",
    bad: "10% 이하 = 거의 부채로만 굴러감",
    zimcarry: "2025년 24%. 자본잠식 회복 단계.",
    category: "stability",
  },
  자본잠식: {
    term: "자본잠식 (Capital Erosion)",
    short:
      "누적 적자가 너무 커서 자본총계가 (-)가 된 상태. 청산 시 주주 몫이 0보다 작음.",
    bad: "자본잠식 = 부채가 자산보다 많은 위험 상태. 증자 또는 흑자전환만이 해결책",
    zimcarry: "2021년·2024년 두 차례 경험 → 매번 증자로 회복. 만성적 적자 누적의 결과.",
    category: "stability",
  },
  단기차입금: {
    term: "단기차입금 (Short-term Debt)",
    short: "1년 안에 갚아야 할 은행·금융기관 대출. 매년 만기 도래해 롤오버(연장) 또는 상환 필요.",
    good: "총 부채에서 30~50% 수준이 일반적",
    bad: "70%↑면 매년 차환 압박 큼",
    zimcarry: "2025년 14.2억 (총 부채의 56%). 매년 만기 연장 협상 필요.",
    category: "stability",
  },
  총자산회전율: {
    term: "총자산회전율 (Asset Turnover)",
    short: "보유 자산이 1년에 매출을 몇 번 만들었는지. 자산 활용 효율.",
    formula: "매출 ÷ 평균 자산",
    good: "1.0회↑ 양호, 2.0회↑ 우수 (서비스업)",
    zimcarry: "2025년 2.27회 — 자산 활용 효율 우수.",
    category: "activity",
  },
  매출채권회전율: {
    term: "매출채권 회전율 (AR Turnover)",
    short: "매출채권이 1년에 몇 번 회수됐는지. 클수록 회수 빠름.",
    formula: "매출 ÷ 평균 매출채권",
    zimcarry: "2025년 36.5회 — 회수 매우 빠른 편 (B2C 비중 높은 영향).",
    category: "activity",
  },
  매출채권회수기간: {
    term: "매출채권 회수기간 (DSO, Days Sales Outstanding)",
    short: "매출이 일어난 뒤 평균 며칠 만에 현금이 들어오는지.",
    formula: "365 ÷ 매출채권 회전율",
    good: "30일 이하 우수",
    zimcarry: "2025년 약 10일 — 매우 짧음.",
    category: "activity",
  },
  이자보상배율: {
    term: "이자보상배율 (Interest Coverage)",
    short: "영업이익으로 이자비용을 몇 배 갚을 수 있는지.",
    formula: "영업이익 ÷ 이자비용",
    good: "5배↑ 안전, 1배↑ 양호 (이자는 낼 수 있음)",
    bad: "1배 이하 = 영업이익으로 이자도 못 냄. (-)는 영업적자라 이자도 외부 자금으로 메워야 함",
    zimcarry: "2025년 -10.24배 — 영업이익이 (-)라 이자비용을 외부 자금으로 메우고 있음.",
    category: "cash",
  },
};

const KEY_ALIASES: Record<string, string> = {
  // 카테고리 KPI 라벨 → 사전 키
  "매출 성장률 (YoY)": "매출성장률",
  "매출 5년 성장 배수": "매출액",
  "매출 5년 성장": "매출액",
  "매출 YoY": "매출성장률",
  "ebitda 마진": "EBITDA마진",
  "EBITDA 마진": "EBITDA마진",
  "EBITDA (2025)": "EBITDA",
  "OCF (영업현금)": "OCF",
  "OCF — 영업현금흐름": "OCF",
  "FCF (잉여현금)": "FCF",
  "FCF — 잉여현금흐름": "FCF",
  "CAPEX — 투자지출": "CAPEX",
  "총 차입금": "단기차입금",
  "누적 FCF (5년)": "FCF",
  "총자산회전율": "총자산회전율",
  "매출채권 회전율": "매출채권회전율",
  "매출채권 회전기간": "매출채권회수기간",
  "매출채권 회수기간": "매출채권회수기간",
  "재무 안정성": "자본잠식",
  "단기차입금": "단기차입금",
  "유동비율": "유동비율",
  "부채비율": "부채비율",
  "자기자본비율": "자기자본비율",
  "자본잠식 이력": "자본잠식",
  "당기순이익": "당기순이익",
  "이익률": "영업이익률",
  "순이익률": "영업이익률",
  "이자보상배율": "이자보상배율",
  "Runway": "Runway",
  "현금성자산": "현금성자산",
  "자본총계": "자본총계",
  "영업이익": "영업이익",
  "매출액": "매출액",
  "매출": "매출액",
  "인건비 / 매출": "SGA",
  "임차료 / 매출": "SGA",
};

export function lookup(label: string): GlossaryEntry | null {
  if (!label) return null;
  const direct = GLOSSARY[label];
  if (direct) return direct;
  const aliasKey = KEY_ALIASES[label] ?? KEY_ALIASES[label.trim()];
  if (aliasKey && GLOSSARY[aliasKey]) return GLOSSARY[aliasKey];
  // case-insensitive token match
  const lower = label.toLowerCase();
  for (const k of Object.keys(GLOSSARY)) {
    if (lower.includes(k.toLowerCase())) return GLOSSARY[k];
  }
  return null;
}
