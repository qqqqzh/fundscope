export interface FundBasic {
  code: string;
  name: string;
  type: '股票型' | '混合型' | '债券型' | '指数型' | '货币型' | 'ETF' | 'QDII';
  category: string;
  manager: string;
  company: string;
  establishDate: string;
  size: number; // 亿元
  nav: number; // 最新净值
  dailyChange: number; // 日涨跌幅 %
  expenseRatio: number; // 管理费率 %
  riskLevel: 1 | 2 | 3 | 4 | 5;
}

export interface FundPerformance {
  code: string;
  week1: number;
  month1: number;
  month3: number;
  month6: number;
  year1: number;
  year3: number;
  year5: number;
  sinceEstablish: number;
}

export interface FundHolding {
  code: string;
  topStocks: { name: string; weight: number; industry: string }[];
  assetAllocation: { stocks: number; bonds: number; cash: number; other: number };
  industryDistribution: { name: string; weight: number }[];
}

export interface FundNAV {
  date: string;
  nav: number;
  accNav: number; // 累计净值
}

export interface FundRiskMetrics {
  code: string;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  trackingError: number;
}

export interface FundDetail extends FundBasic {
  performance: FundPerformance;
  holding: FundHolding;
  riskMetrics: FundRiskMetrics;
  navHistory: FundNAV[];
  description: string;
}

export interface FundManager {
  name: string;
  photo: string;
  tenure: number; // 任职年限
  totalReturn: number;
  funds: string[];
  bio: string;
}
