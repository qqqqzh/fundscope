import { FundBasic, FundDetail, FundNAV, FundPerformance, FundHolding, FundRiskMetrics } from '@/types/fund';

const FUND_MANAGERS = [
  '张坤', '葛兰', '朱少醒', '刘彦春', '谢治宇', '周蔚文', '萧楠', '杨浩',
  '冯明远', '李晓星', '陈皓', '傅鹏博', '王宗合', '归凯', '胡昕炜',
];

const COMPANIES = [
  '易方达', '中欧', '富国', '景顺长城', '兴证全球', '中欧', '易方达',
  '交银施罗德', '信达澳银', '银华', '易方达', '睿远', '鹏华', '嘉实', '汇添富',
];

const INDUSTRIES = [
  '消费', '医药', '科技', '金融', '新能源', '半导体', '军工', '地产',
  '白酒', '互联网', '汽车', '家电', '建材', '化工', '电力',
];

const STOCK_NAMES = [
  '贵州茅台', '宁德时代', '中国平安', '招商银行', '隆基绿能', '比亚迪',
  '五粮液', '海康威视', '恒瑞医药', '迈瑞医疗', '药明康德', '东方财富',
  '中信证券', '立讯精密', '紫光国微', '北方华创', '阳光电源', '通威股份',
  '山西汾酒', '泸州老窖', '美的集团', '格力电器', '万华化学', '海螺水泥',
  '中国中免', '片仔癀', '三一重工', '汇川技术', '韦尔股份', '中芯国际',
];

function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const FUND_TEMPLATES: Omit<FundBasic, 'code'>[] = [
  { name: '易方达蓝筹精选混合', type: '混合型', category: '偏股混合', manager: '张坤', company: '易方达', establishDate: '2018-09-05', size: 676.23, nav: 1.8534, dailyChange: -0.42, expenseRatio: 1.5, riskLevel: 4 },
  { name: '中欧医疗健康混合', type: '混合型', category: '偏股混合', manager: '葛兰', company: '中欧', establishDate: '2016-09-29', size: 305.12, nav: 0.7856, dailyChange: 1.23, expenseRatio: 1.5, riskLevel: 4 },
  { name: '富国天惠成长混合', type: '混合型', category: '偏股混合', manager: '朱少醒', company: '富国', establishDate: '2005-11-16', size: 289.45, nav: 2.3421, dailyChange: -0.15, expenseRatio: 1.5, riskLevel: 4 },
  { name: '景顺长城新兴成长混合', type: '混合型', category: '偏股混合', manager: '刘彦春', company: '景顺长城', establishDate: '2008-03-25', size: 198.34, nav: 3.1256, dailyChange: 0.67, expenseRatio: 1.5, riskLevel: 4 },
  { name: '兴全合润混合', type: '混合型', category: '偏股混合', manager: '谢治宇', company: '兴证全球', establishDate: '2010-04-22', size: 234.56, nav: 1.5678, dailyChange: -0.31, expenseRatio: 1.5, riskLevel: 4 },
  { name: '易方达消费行业股票', type: '股票型', category: '标准股票', manager: '萧楠', company: '易方达', establishDate: '2010-08-20', size: 178.90, nav: 4.2345, dailyChange: 0.89, expenseRatio: 1.5, riskLevel: 5 },
  { name: '华夏沪深300ETF联接', type: '指数型', category: '宽基指数', manager: '张弘弢', company: '华夏', establishDate: '2009-07-10', size: 456.78, nav: 1.4567, dailyChange: -0.23, expenseRatio: 0.5, riskLevel: 3 },
  { name: '天弘余额宝货币', type: '货币型', category: '货币市场', manager: '王登峰', company: '天弘', establishDate: '2013-05-29', size: 7123.45, nav: 1.0000, dailyChange: 0.01, expenseRatio: 0.3, riskLevel: 1 },
  { name: '招商中证白酒指数', type: '指数型', category: '行业指数', manager: '侯昊', company: '招商', establishDate: '2015-05-27', size: 567.89, nav: 1.2345, dailyChange: 1.56, expenseRatio: 1.0, riskLevel: 4 },
  { name: '易方达中短债债券', type: '债券型', category: '中短债', manager: '张清华', company: '易方达', establishDate: '2017-06-15', size: 234.56, nav: 1.1234, dailyChange: 0.03, expenseRatio: 0.3, riskLevel: 2 },
  { name: '广发纳斯达克100ETF联接', type: 'QDII', category: '海外指数', manager: '李耀柱', company: '广发', establishDate: '2012-08-15', size: 123.45, nav: 3.4567, dailyChange: -0.78, expenseRatio: 0.8, riskLevel: 4 },
  { name: '华泰柏瑞沪深300ETF', type: 'ETF', category: '宽基ETF', manager: '柳军', company: '华泰柏瑞', establishDate: '2012-05-04', size: 890.12, nav: 3.9876, dailyChange: -0.23, expenseRatio: 0.15, riskLevel: 3 },
  { name: '信达澳银新能源产业股票', type: '股票型', category: '标准股票', manager: '冯明远', company: '信达澳银', establishDate: '2015-07-31', size: 145.67, nav: 2.8765, dailyChange: 2.13, expenseRatio: 1.5, riskLevel: 5 },
  { name: '银华富裕主题混合', type: '混合型', category: '偏股混合', manager: '焦巍', company: '银华', establishDate: '2006-11-16', size: 167.89, nav: 2.1098, dailyChange: 0.45, expenseRatio: 1.5, riskLevel: 4 },
  { name: '睿远成长价值混合', type: '混合型', category: '偏股混合', manager: '傅鹏博', company: '睿远', establishDate: '2019-03-26', size: 298.76, nav: 1.3456, dailyChange: -0.56, expenseRatio: 1.5, riskLevel: 4 },
  { name: '嘉实价值优势混合', type: '混合型', category: '偏股混合', manager: '谭丽', company: '嘉实', establishDate: '2014-04-08', size: 112.34, nav: 2.5678, dailyChange: 0.34, expenseRatio: 1.5, riskLevel: 4 },
  { name: '汇添富中证新能源汽车ETF', type: 'ETF', category: '行业ETF', manager: '过蓓蓓', company: '汇添富', establishDate: '2020-12-10', size: 234.56, nav: 0.8765, dailyChange: 1.89, expenseRatio: 0.15, riskLevel: 5 },
  { name: '南方中证500ETF', type: 'ETF', category: '宽基ETF', manager: '罗文杰', company: '南方', establishDate: '2013-02-06', size: 345.67, nav: 6.7890, dailyChange: -0.45, expenseRatio: 0.15, riskLevel: 3 },
  { name: '博时信用债券', type: '债券型', category: '信用债', manager: '过钧', company: '博时', establishDate: '2009-06-10', size: 89.12, nav: 1.8901, dailyChange: 0.02, expenseRatio: 0.6, riskLevel: 2 },
  { name: '中欧时代先锋股票', type: '股票型', category: '标准股票', manager: '周应波', company: '中欧', establishDate: '2017-01-19', size: 156.78, nav: 2.3456, dailyChange: 0.78, expenseRatio: 1.5, riskLevel: 5 },
];

function generateNavHistory(baseNav: number, days: number = 750): FundNAV[] {
  const history: FundNAV[] = [];
  let nav = baseNav * (0.6 + Math.random() * 0.3);
  const accNav = nav;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = (Math.random() - 0.48) * 0.04;
    nav = parseFloat((nav * (1 + change)).toFixed(4));

    history.push({
      date: date.toISOString().split('T')[0],
      nav,
      accNav: parseFloat((nav * (1 + Math.random() * 0.3)).toFixed(4)),
    });
  }
  return history;
}

function generatePerformance(): FundPerformance {
  return {
    code: '',
    week1: randomFloat(-5, 5),
    month1: randomFloat(-8, 8),
    month3: randomFloat(-15, 15),
    month6: randomFloat(-20, 25),
    year1: randomFloat(-25, 40),
    year3: randomFloat(-10, 80),
    year5: randomFloat(0, 150),
    sinceEstablish: randomFloat(-5, 300),
  };
}

function generateHolding(): FundHolding {
  const stocks = Array.from({ length: 10 }, () => ({
    name: randomPick(STOCK_NAMES),
    weight: randomFloat(2, 12),
    industry: randomPick(INDUSTRIES),
  })).reduce<typeof STOCK_NAMES extends (infer U)[] ? { name: string; weight: number; industry: string }[] : never>((acc, s) => {
    if (!acc.find(x => x.name === s.name)) acc.push(s);
    return acc;
  }, [] as { name: string; weight: number; industry: string }[]);

  const stocksWeight = randomFloat(50, 90);
  const bondsWeight = randomFloat(5, 30);
  const cashWeight = 100 - stocksWeight - bondsWeight;

  const industries = INDUSTRIES.slice(0, 8).map(name => ({
    name,
    weight: randomFloat(3, 25),
  }));

  return {
    code: '',
    topStocks: stocks.slice(0, 8),
    assetAllocation: {
      stocks: parseFloat(stocksWeight.toFixed(1)),
      bonds: parseFloat(bondsWeight.toFixed(1)),
      cash: parseFloat(Math.max(cashWeight, 2).toFixed(1)),
      other: parseFloat(Math.max(100 - stocksWeight - bondsWeight - Math.max(cashWeight, 2), 0).toFixed(1)),
    },
    industryDistribution: industries,
  };
}

function generateRiskMetrics(): FundRiskMetrics {
  return {
    code: '',
    sharpeRatio: randomFloat(-0.5, 2.5),
    maxDrawdown: randomFloat(-35, -5),
    volatility: randomFloat(10, 35),
    beta: randomFloat(0.5, 1.5),
    alpha: randomFloat(-5, 15),
    informationRatio: randomFloat(-1, 2),
    trackingError: randomFloat(2, 15),
  };
}

export const MOCK_FUNDS: FundBasic[] = FUND_TEMPLATES.map((t, i) => ({
  ...t,
  code: String(100000 + i + 1).slice(1),
}));

export function getMockFundDetail(code: string): FundDetail | undefined {
  const basic = MOCK_FUNDS.find(f => f.code === code);
  if (!basic) return undefined;

  const navHistory = generateNavHistory(basic.nav);
  const performance = generatePerformance();
  performance.code = code;
  const holding = generateHolding();
  holding.code = code;
  const riskMetrics = generateRiskMetrics();
  riskMetrics.code = code;

  return {
    ...basic,
    performance,
    holding,
    riskMetrics,
    navHistory,
    description: `${basic.name}由${basic.manager}管理，成立于${basic.establishDate}，基金规模${basic.size}亿元。该基金属于${basic.category}类别，风险等级为${basic.riskLevel}级。`,
  };
}

export function getMockNavHistory(code: string, days?: number): FundNAV[] {
  const basic = MOCK_FUNDS.find(f => f.code === code);
  if (!basic) return [];
  return generateNavHistory(basic.nav, days);
}
