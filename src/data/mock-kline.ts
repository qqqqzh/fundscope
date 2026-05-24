import { KLineData, KLinePattern, TechnicalIndicator } from '@/types/learn';

export function generateKLineData(days: number = 250): KLineData[] {
  const data: KLineData[] = [];
  let price = 100 + Math.random() * 50;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const volatility = 0.03;
    const trend = (Math.random() - 0.48) * volatility;
    const open = price;
    const close = parseFloat((price * (1 + trend)).toFixed(2));
    const high = parseFloat((Math.max(open, close) * (1 + Math.random() * 0.015)).toFixed(2));
    const low = parseFloat((Math.min(open, close) * (1 - Math.random() * 0.015)).toFixed(2));
    const volume = Math.floor(50000 + Math.random() * 200000);

    data.push({ date: date.toISOString().split('T')[0], open, close, high, low, volume });
    price = close;
  }
  return data;
}

export function calculateMA(data: KLineData[], period: number): { date: string; value: number }[] {
  return data.map((item, index) => {
    if (index < period - 1) return { date: item.date, value: 0 };
    const slice = data.slice(index - period + 1, index + 1);
    const avg = slice.reduce((sum, d) => sum + d.close, 0) / period;
    return { date: item.date, value: parseFloat(avg.toFixed(2)) };
  });
}

export function calculateMACD(data: KLineData[]): { date: string; dif: number; dea: number; macd: number }[] {
  const ema12: number[] = [];
  const ema26: number[] = [];
  const dif: number[] = [];
  const dea: number[] = [];

  data.forEach((item, i) => {
    const close = item.close;
    if (i === 0) {
      ema12.push(close);
      ema26.push(close);
    } else {
      ema12.push(ema12[i - 1] * 11 / 13 + close * 2 / 13);
      ema26.push(ema26[i - 1] * 25 / 27 + close * 2 / 27);
    }
    dif.push(ema12[i] - ema26[i]);
    if (i === 0) dea.push(dif[i]);
    else dea.push(dea[i - 1] * 8 / 10 + dif[i] * 2 / 10);
  });

  return data.map((item, i) => ({
    date: item.date,
    dif: parseFloat(dif[i].toFixed(4)),
    dea: parseFloat(dea[i].toFixed(4)),
    macd: parseFloat(((dif[i] - dea[i]) * 2).toFixed(4)),
  }));
}

export function calculateRSI(data: KLineData[], period: number = 14): { date: string; value: number }[] {
  const result: { date: string; value: number }[] = [];
  const changes: number[] = [];

  data.forEach((item, i) => {
    if (i === 0) {
      changes.push(0);
      result.push({ date: item.date, value: 50 });
      return;
    }
    const change = item.close - data[i - 1].close;
    changes.push(change);

    if (i < period) {
      result.push({ date: item.date, value: 50 });
      return;
    }

    const recentChanges = changes.slice(i - period + 1, i + 1);
    const gains = recentChanges.filter(c => c > 0);
    const losses = recentChanges.filter(c => c < 0).map(c => Math.abs(c));
    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0.001;
    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    result.push({ date: item.date, value: parseFloat(rsi.toFixed(2)) });
  });

  return result;
}

export const KLINE_PATTERNS: KLinePattern[] = [
  {
    name: '十字星',
    nameEn: 'Doji',
    description: '开盘价和收盘价几乎相等，上下影线长度相近',
    signal: 'neutral',
    points: [],
    explanation: '十字星表示多空双方力量均衡，市场犹豫不决。出现在上升趋势末端可能预示反转下跌，出现在下降趋势末端可能预示反转上涨。需要结合前后K线确认。',
  },
  {
    name: '锤子线',
    nameEn: 'Hammer',
    description: '下影线很长（实体2倍以上），上影线很短，实体在上方',
    signal: 'bullish',
    points: [],
    explanation: '锤子线出现在下跌趋势末端，表示空方虽然一度大幅打压价格，但多方最终将价格拉回。这是一个看涨反转信号，下影线越长，信号越强。',
  },
  {
    name: '吞没形态',
    nameEn: 'Engulfing',
    description: '后一根K线的实体完全包含前一根K线的实体',
    signal: 'bullish',
    points: [],
    explanation: '看涨吞没形态出现在下跌趋势中，阳线实体完全包裹前一根阴线。这表示多方力量突然增强，可能预示趋势反转。是较强的反转信号。',
  },
  {
    name: '乌云盖顶',
    nameEn: 'Dark Cloud Cover',
    description: '上升趋势中，阳线后出现高开低走的阴线，收盘价低于前一根阳线实体的一半',
    signal: 'bearish',
    points: [],
    explanation: '乌云盖顶是看跌反转信号。在上升趋势中，价格高开但被空方打压至前一根阳线实体中部以下，说明卖压开始增强，上涨可能结束。',
  },
  {
    name: '早晨之星',
    nameEn: 'Morning Star',
    description: '三根K线组合：阴线 + 小实体（星线）+ 阳线',
    signal: 'bullish',
    points: [],
    explanation: '早晨之星是强烈的底部反转信号。第一根大阴线延续下跌，第二根小实体表示空方力量衰竭，第三根大阳线确认多方接管。第三根收盘价越高，信号越强。',
  },
  {
    name: '黄昏之星',
    nameEn: 'Evening Star',
    description: '三根K线组合：阳线 + 小实体（星线）+ 阴线',
    signal: 'bearish',
    points: [],
    explanation: '黄昏之星是强烈的顶部反转信号。第一根大阳线延续上涨，第二根小实体表示多方力量衰竭，第三根大阴线确认空方接管。是卖出的重要信号。',
  },
];

export const LEARNING_CARDS = [
  {
    id: 'lc-001',
    title: '什么是基金净值？',
    category: '基础' as const,
    difficulty: 1 as const,
    content: '基金净值（NAV）= 基金总资产 / 基金总份额。它代表你持有的每份基金值多少钱。净值上涨 = 赚钱，净值下跌 = 亏钱。注意：净值高低不代表基金好坏！1元的基金不一定比3元的便宜。',
    quiz: {
      question: '基金净值3元和1元，哪个更值得买？',
      options: ['1元的更便宜更值得买', '3元的更贵不值得买', '净值高低不能判断好坏，要看收益率'],
      answer: 2,
      explanation: '基金净值反映的是历史累计表现，不是"贵贱"。关键是未来的增长潜力，不是当前价格高低。',
    },
  },
  {
    id: 'lc-002',
    title: '什么是夏普比率？',
    category: '风险' as const,
    difficulty: 2 as const,
    content: '夏普比率 = (基金收益率 - 无风险利率) / 波动率。它衡量每承担一单位风险能获得多少超额回报。一般来说：>1 是好的，>2 是优秀的，<0 说明还不如存银行。',
    quiz: {
      question: '基金A年化15%波动率20%，基金B年化10%波动率5%，哪个夏普比率更高？',
      options: ['基金A', '基金B', '差不多'],
      answer: 1,
      explanation: '假设无风险利率3%，A的夏普=(15%-3%)/20%=0.6，B的夏普=(10%-3%)/5%=1.4。B的风险调整后收益更好。',
    },
  },
  {
    id: 'lc-003',
    title: '定投是什么？为什么适合新手？',
    category: '策略' as const,
    difficulty: 1 as const,
    content: '定投 = 定期定额投资，比如每月固定投1000元。好处：1) 不用择时，降低买入成本；2) 强制储蓄；3) 利用"微笑曲线"——下跌时买更多份额，上涨时获利。适合没有时间研究市场的新手。',
    quiz: {
      question: '基金从1元跌到0.5元再涨回1元，定投和一次性投入哪个赚得多？',
      options: ['一次性投入', '定投', '一样多'],
      answer: 1,
      explanation: '定投在下跌时以低价买入更多份额，拉低了平均成本。回到1元时，定投的收益率更高。这就是"微笑曲线"的威力。',
    },
  },
  {
    id: 'lc-004',
    title: 'K线怎么看？',
    category: 'K线' as const,
    difficulty: 1 as const,
    content: '一根K线包含4个价格：开盘价、收盘价、最高价、最低价。红色（或空心）= 收盘 > 开盘 = 上涨；绿色（或实心）= 收盘 < 开盘 = 下跌。实体部分是开盘到收盘的范围，上下影线是最高最低的延伸。',
    quiz: {
      question: '一根K线，上影线很长，实体很小在下方，说明什么？',
      options: ['买方很强', '上方卖压很重，价格被打下来了', '没有意义'],
      answer: 1,
      explanation: '长上影线说明价格曾经冲高但被卖方打压回来，上方抛压较重，可能是见顶信号。',
    },
  },
  {
    id: 'lc-005',
    title: '什么是最大回撤？',
    category: '风险' as const,
    difficulty: 2 as const,
    content: '最大回撤 = 从最高点到最低点的最大跌幅。它衡量你可能面临的最大亏损。比如基金从2元涨到3元，又跌到1.5元，最大回撤就是50%。回撤越大，你的心理压力越大。',
  },
  {
    id: 'lc-006',
    title: '基金类型怎么选？',
    category: '基础' as const,
    difficulty: 1 as const,
    content: '货基（余额宝）：随时用的钱，风险最低。债基：稳健增值，比货基收益高一点。混合型：攻守兼备。股票型/指数型：追求高收益，波动大。新手建议：先买债基/宽基指数练手，了解市场后再配股票型。',
  },
  {
    id: 'lc-007',
    title: '什么是MACD指标？',
    category: '指标' as const,
    difficulty: 2 as const,
    content: 'MACD由三部分组成：DIF线（快线）、DEA线（慢线）、柱状图。DIF上穿DEA = 金叉（买入信号），DIF下穿DEA = 死叉（卖出信号）。柱状图由绿变红 = 多方力量增强，由红变绿 = 空方力量增强。',
  },
  {
    id: 'lc-008',
    title: '什么是RSI指标？',
    category: '指标' as const,
    difficulty: 2 as const,
    content: 'RSI（相对强弱指标）范围0-100。>70 = 超买（可能要跌），<30 = 超卖（可能要涨）。RSI不单独使用，最好配合其他指标和趋势判断。注意：强势行情中RSI可能长期>70。',
  },
];
