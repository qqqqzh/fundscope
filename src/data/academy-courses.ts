import type { Course, KLineData } from '@/types/learn';

// Helper to generate realistic OHLC from a trend
function makeKLine(
  basePrice: number,
  days: number,
  trend: number, // daily drift
  volatility: number,
  startDate: string,
): KLineData[] {
  const data: KLineData[] = [];
  let price = basePrice;
  const start = new Date(startDate);
  let dayOffset = 0;

  while (data.length < days) {
    const d = new Date(start);
    d.setDate(d.getDate() + dayOffset);
    dayOffset += 1;
    if (d.getDay() === 0 || d.getDay() === 6) {
      continue;
    }

    const change = trend + (Math.random() - 0.5) * volatility;
    const open = price;
    const close = parseFloat((price * (1 + change)).toFixed(2));
    const extra = Math.random() * volatility * 0.5;
    const high = parseFloat((Math.max(open, close) * (1 + extra)).toFixed(2));
    const low = parseFloat((Math.min(open, close) * (1 - extra)).toFixed(2));
    const volume = Math.floor(50000 + Math.random() * 200000);

    data.push({
      date: d.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(2)),
      close,
      high,
      low,
      volume,
    });
    price = close;
  }
  return data;
}

// Curated K-line data for each lesson
const CURATED: Record<string, KLineData[]> = {
  // 1.1 认识K线 - clear single candle to annotate
  '1.1': (() => {
    const data = makeKLine(10, 25, 0.002, 0.02, '2025-09-01');
    // Make candle 15 very clear: bullish with visible shadows
    if (data[15]) {
      data[15] = { date: data[15].date, open: 10.2, close: 10.8, high: 11.0, low: 10.0, volume: 180000 };
    }
    return data;
  })(),

  // 1.2 阳线与阴线 - mix of red and green candles
  '1.2': (() => {
    const data = makeKLine(20, 25, 0.001, 0.025, '2025-09-01');
    // Force clear bullish and bearish candles
    if (data[8]) data[8] = { ...data[8], open: 20.0, close: 20.8, high: 21.0, low: 19.8 };
    if (data[9]) data[9] = { ...data[9], open: 20.3, close: 21.0, high: 21.2, low: 20.1 };
    if (data[10]) data[10] = { ...data[10], open: 20.6, close: 21.4, high: 21.6, low: 20.4 };
    if (data[14]) data[14] = { ...data[14], open: 21.5, close: 20.8, high: 21.7, low: 20.5 };
    if (data[15]) data[15] = { ...data[15], open: 21.3, close: 20.6, high: 21.5, low: 20.4 };
    if (data[16]) data[16] = { ...data[16], open: 21.6, close: 20.9, high: 21.8, low: 20.7 };
    return data;
  })(),

  // 1.3 影线的秘密 - candles with long upper/lower shadows
  '1.3': (() => {
    const data = makeKLine(15, 25, 0.001, 0.02, '2025-09-01');
    // Long upper shadow
    if (data[8]) data[8] = { date: data[8].date, open: 15.0, close: 15.1, high: 16.2, low: 14.9, volume: 200000 };
    // Long lower shadow
    if (data[14]) data[14] = { date: data[14].date, open: 15.5, close: 15.6, high: 15.7, low: 14.3, volume: 190000 };
    // Both long shadows
    if (data[18]) data[18] = { date: data[18].date, open: 15.8, close: 15.9, high: 16.8, low: 14.9, volume: 210000 };
    return data;
  })(),

  // 2.1 十字星 - doji candle
  '2.1': (() => {
    const data = makeKLine(12, 25, 0.003, 0.02, '2025-09-01');
    // Uptrend then doji
    if (data[15]) data[15] = { date: data[15].date, open: 12.8, close: 12.81, high: 13.2, low: 12.4, volume: 150000 };
    return data;
  })(),

  // 2.2 锤子线 - hammer at bottom of downtrend
  '2.2': (() => {
    const data = makeKLine(18, 30, -0.005, 0.02, '2025-09-01');
    // Downtrend then hammer
    if (data[20]) data[20] = { date: data[20].date, open: 15.5, close: 15.7, high: 15.8, low: 14.2, volume: 250000 };
    // Small green candle after hammer (confirmation)
    if (data[22]) data[22] = { ...data[22], open: 15.8, close: 16.2, high: 16.4, low: 15.6 };
    return data;
  })(),

  // 2.3 吞没形态 - engulfing pattern
  '2.3': (() => {
    const data = makeKLine(15, 25, -0.005, 0.015, '2025-09-01');
    // Downtrend buildup
    if (data[10]) data[10] = { date: data[10].date, open: 15.8, close: 15.5, high: 15.9, low: 15.4, volume: 130000 };
    if (data[11]) data[11] = { date: data[11].date, open: 15.4, close: 15.1, high: 15.5, low: 15.0, volume: 140000 };
    if (data[12]) data[12] = { date: data[12].date, open: 15.0, close: 14.8, high: 15.1, low: 14.7, volume: 120000 };
    // Day 1: small bearish candle (the one being engulfed)
    if (data[14]) data[14] = { date: data[14].date, open: 14.9, close: 14.6, high: 15.0, low: 14.5, volume: 110000 };
    // Day 2: large bullish candle that engulfs day 1
    if (data[15]) data[15] = { date: data[15].date, open: 14.5, close: 15.3, high: 15.5, low: 14.3, volume: 250000 };
    // Confirmation
    if (data[17]) data[17] = { date: data[17].date, open: 15.4, close: 15.8, high: 16.0, low: 15.2, volume: 200000 };
    return data;
  })(),

  // 2.4 早晨之星 - morning star (3 consecutive candles)
  '2.4': (() => {
    const data = makeKLine(18, 30, -0.003, 0.02, '2025-09-01');
    // Day 1: big bearish
    if (data[18]) data[18] = { date: data[18].date, open: 17.5, close: 16.8, high: 17.6, low: 16.6, volume: 200000 };
    // Day 2: small body (star)
    if (data[19]) data[19] = { date: data[19].date, open: 16.7, close: 16.75, high: 16.9, low: 16.5, volume: 100000 };
    // Day 3: big bullish
    if (data[20]) data[20] = { date: data[20].date, open: 16.8, close: 17.5, high: 17.7, low: 16.7, volume: 210000 };
    return data;
  })(),
};

export const COURSE: Course = {
  id: 'kline-academy',
  title: 'K线学院',
  description: '从零开始学习K线、技术指标和常见形态',
  modules: [
    // === Module 1: K线基础 ===
    {
      id: 'module-1',
      title: 'K线基础',
      description: '认识K线图的基本构成',
      lessons: [
        {
          id: '1.1',
          title: '认识K线',
          subtitle: '一根K线包含四个价格信息',
          moduleIndex: 0,
          lessonIndex: 0,
          content: {
            intro: 'K线，又称蜡烛图，起源于日本米市交易。每根K线代表一个时间段（如一天）内价格的变动情况，是技术分析最基础的工具。',
            keyPoints: [
              '开盘价（Open）：该时间段的第一笔成交价',
              '收盘价（Close）：该时间段的最后一笔成交价',
              '最高价（High）：该时间段内的最高成交价',
              '最低价（Low）：该时间段内的最低成交价',
              '实体（Body）：开盘价和收盘价之间的部分',
              '影线（Shadow）：实体之外的细线，上下各一条',
            ],
            tip: '收盘价是四个价格中最重要的，它反映了市场在该时间段最终达成的共识。',
          },
          quiz: [
            {
              id: 'q1.1.1',
              question: '一根K线中，开盘价10元，收盘价12元，最高价13元，最低价9元。实体高度是多少？',
              options: ['1元', '2元', '3元', '4元'],
              correctIndex: 1,
              explanation: '实体 = |收盘价 - 开盘价| = |12 - 10| = 2元。最高价和最低价决定影线长度，不是实体。',
              chartHint: '被蓝色标记的那根K线，观察它的实体和影线',
            },
            {
              id: 'q1.1.2',
              question: '上影线是从哪个价格到哪个价格？',
              options: ['开盘价到收盘价', '实体上方到最高价', '最低价到开盘价', '收盘价到最高价'],
              correctIndex: 1,
              explanation: '上影线是从实体上沿（开盘价和收盘价中较高的那个）到最高价之间的细线。',
            },
          ],
          chartConfig: {
            mode: 'candlestick',
            dataPoints: 25,
            highlightRange: [15, 15],
            annotations: [
              { type: 'markPoint', dataIndex: 15, label: '观察这根K线', color: '#3b82f6', position: 'top' },
            ],
          },
          curatedData: CURATED['1.1'],
        },
        {
          id: '1.2',
          title: '阳线与阴线',
          subtitle: '涨跌一目了然',
          moduleIndex: 0,
          lessonIndex: 1,
          content: {
            intro: 'K线通过颜色区分涨跌。中国市场惯例：红色代表上涨（阳线），绿色代表下跌（阴线）。阳线的收盘价高于开盘价，阴线反之。',
            keyPoints: [
              '阳线（红色）：收盘价 > 开盘价，表示该时段上涨',
              '阴线（绿色）：收盘价 < 开盘价，表示该时段下跌',
              '实体越长，说明涨/跌力度越大',
              '连续阳线可能表示上升趋势，连续阴线可能表示下降趋势',
              '不能只看单根K线就下结论，需要结合前后走势',
            ],
            tip: '国际市场上颜色可能相反（绿涨红跌），看盘时注意分辨。',
          },
          quiz: [
            {
              id: 'q1.2.1',
              question: '开盘价15元，收盘价14元，这根K线是？',
              options: ['阳线', '阴线', '十字星', '无法判断'],
              correctIndex: 1,
              explanation: '收盘价(14) < 开盘价(15)，所以是阴线，表示该时段价格下跌。',
              chartHint: '图表中红色和绿色的K线分别代表阳线和阴线',
            },
            {
              id: 'q1.2.2',
              question: '连续出现3根大阳线，通常说明什么？',
              options: ['市场没有方向', '多方力量强劲，趋势向上', '即将反转下跌', '成交量一定在缩小'],
              correctIndex: 1,
              explanation: '连续大阳线说明买方持续占优，推动价格不断上涨，是上升趋势的典型特征。',
            },
          ],
          chartConfig: {
            mode: 'candlestick',
            dataPoints: 25,
            highlightRange: [8, 10],
            annotations: [
              { type: 'markArea', startIndex: 8, endIndex: 10, label: '阳线区间', color: 'rgba(239,68,68,0.08)' },
              { type: 'markArea', startIndex: 14, endIndex: 16, label: '阴线区间', color: 'rgba(34,197,94,0.08)' },
            ],
          },
          curatedData: CURATED['1.2'],
        },
        {
          id: '1.3',
          title: '影线的秘密',
          subtitle: '上下影线透露多空博弈',
          moduleIndex: 0,
          lessonIndex: 2,
          content: {
            intro: '影线是实体之外的细线。上影线代表价格曾冲高后回落，下影线代表价格曾探底后反弹。影线的长度反映了多空双方的力量对比。',
            keyPoints: [
              '长上影线：价格冲高后被打压回落，上方卖压较重',
              '长下影线：价格下探后被买盘托起，下方支撑较强',
              '上影线越长，说明空方在高位的打压力量越强',
              '下影线越长，说明多方在低位的承接力量越强',
              '在关键位置出现的长影线，往往是趋势反转的信号',
            ],
            tip: '长下影线出现在下跌趋势末端，常被称为"锤子线"，是潜在的反转信号。',
          },
          quiz: [
            {
              id: 'q1.3.1',
              question: '一根阳线（红色），几乎没有上影线，但有很长的下影线，说明什么？',
              options: ['空方力量很强', '多方在低位强力承接', '价格会继续下跌', '成交量一定很大'],
              correctIndex: 1,
              explanation: '阳线+长下影线说明价格虽然一度大幅下探，但被买盘强力拉回并收涨，表明下方有很强的支撑。如果是阴线+长下影线，支撑力度会弱一些。',
              chartHint: '观察蓝色标记的K线，注意它长长的下影线',
            },
            {
              id: 'q1.3.2',
              question: '在上涨趋势的高位出现长上影线，可能意味着什么？',
              options: ['上涨动力充足', '上方遇到卖压，可能回调', '应该立即买入', '成交量萎缩'],
              correctIndex: 1,
              explanation: '高位长上影线说明价格冲高后遭遇大量抛售，可能是上涨乏力的信号，需要警惕回调。',
              chartHint: '观察橙色标记的K线，注意它长长的上影线',
            },
          ],
          chartConfig: {
            mode: 'candlestick',
            dataPoints: 25,
            highlightRange: [8, 18],
            annotations: [
              { type: 'markPoint', dataIndex: 8, label: '长上影线', color: '#f59e0b', position: 'top' },
              { type: 'markPoint', dataIndex: 14, label: '长下影线', color: '#3b82f6', position: 'bottom' },
              { type: 'markPoint', dataIndex: 18, label: '上下影线都长', color: '#a855f7', position: 'top' },
            ],
          },
          curatedData: CURATED['1.3'],
        },
      ],
    },
    // === Module 2: K线形态 ===
    {
      id: 'module-2',
      title: 'K线形态',
      description: '识别常见的K线组合形态',
      lessons: [
        {
          id: '2.1',
          title: '十字星',
          subtitle: '多空力量均衡的信号',
          moduleIndex: 1,
          lessonIndex: 0,
          content: {
            intro: '十字星是一种特殊的K线形态，开盘价和收盘价几乎相等，实体极小，看起来像"十"字。它表示多空双方在该时段内势均力敌。',
            keyPoints: [
              '十字星的实体非常小，开盘价 ≈ 收盘价',
              '出现在上涨趋势末端：可能预示反转下跌',
              '出现在下跌趋势末端：可能预示反转上涨',
              '出现在趋势中段：可能只是短暂休整，趋势继续',
              '需要结合前后K线和成交量来判断信号强度',
            ],
            tip: '单个十字星信号不够可靠，最好等待下一根K线确认方向。',
          },
          quiz: [
            {
              id: 'q2.1.1',
              question: '在连续上涨后出现十字星，最合理的操作是？',
              options: ['立即卖出', '立即加仓', '保持警惕，等待确认', '忽略它'],
              correctIndex: 2,
              explanation: '高位十字星是警示信号，但不应仅凭一根K线做决定。应观察后续走势确认是否真的反转。',
              chartHint: '观察橙色标记的十字星K线，注意它的小实体',
            },
            {
              id: 'q2.1.2',
              question: '十字星出现在下跌趋势末端，通常暗示什么？',
              options: ['下跌会加速', '空方力量减弱，可能止跌', '成交量会放大', '没有参考价值'],
              correctIndex: 1,
              explanation: '低位十字星说明卖压减轻，多空力量趋于平衡，是潜在的止跌信号。',
            },
          ],
          chartConfig: {
            mode: 'candlestick',
            dataPoints: 25,
            highlightRange: [15, 15],
            annotations: [
              { type: 'markPoint', dataIndex: 15, label: '十字星', color: '#f59e0b', position: 'top' },
            ],
          },
          curatedData: CURATED['2.1'],
        },
        {
          id: '2.2',
          title: '锤子线',
          subtitle: '下跌末端的反转信号',
          moduleIndex: 1,
          lessonIndex: 1,
          content: {
            intro: '锤子线出现在下跌趋势末端，形态像一把锤子：小实体在上方，长长的下影线（至少是实体的2倍）。它表明价格虽然大幅下探，但被买盘强力拉回。',
            keyPoints: [
              '特征：小实体 + 长下影线（≥2倍实体）+ 几乎没有上影线',
              '出现在下跌趋势中才有效',
              '下影线越长，反转信号越强',
              '下一根阳线可以作为确认信号',
              '如果出现在上涨趋势顶部，叫"上吊线"，含义相反',
            ],
            tip: '锤子线本身是潜在信号，等下一根K线收阳再行动更稳妥。',
          },
          quiz: [
            {
              id: 'q2.2.1',
              question: '锤子线的下影线长度应该是实体的多少倍以上？',
              options: ['0.5倍', '1倍', '2倍', '5倍'],
              correctIndex: 2,
              explanation: '标准锤子线的下影线至少是实体的2倍，这样才能说明下方有强力支撑。',
              chartHint: '观察红色标记的锤子线，测量下影线与实体的比例',
            },
            {
              id: 'q2.2.2',
              question: '在上涨趋势的高位出现锤子线形态，应该叫什么？',
              options: ['锤子线', '十字星', '上吊线', '吞没形态'],
              correctIndex: 2,
              explanation: '同样的形态出现在上涨高位叫"上吊线"，是看跌信号。位置决定含义。',
            },
          ],
          chartConfig: {
            mode: 'candlestick',
            dataPoints: 30,
            highlightRange: [20, 22],
            annotations: [
              { type: 'markPoint', dataIndex: 20, label: '锤子线', color: '#ef4444', position: 'bottom' },
              { type: 'markPoint', dataIndex: 22, label: '确认阳线', color: '#22c55e', position: 'top' },
            ],
          },
          curatedData: CURATED['2.2'],
        },
        {
          id: '2.3',
          title: '吞没形态',
          subtitle: '一根K线完全包裹前一根',
          moduleIndex: 1,
          lessonIndex: 2,
          content: {
            intro: '吞没形态由两根K线组成：后一根K线的实体完全"吞没"（包裹）前一根K线的实体。看涨吞没出现在下跌末端，看跌吞没出现在上涨末端。',
            keyPoints: [
              '看涨吞没：先阴线后阳线，阳线实体完全包裹阴线实体',
              '看跌吞没：先阳线后阴线，阴线实体完全包裹阳线实体',
              '吞没形态比单根K线信号更可靠',
              '成交量放大可以增强信号的可信度',
              '出现在关键支撑/阻力位时效果更强',
            ],
            tip: '第二根K线的实体必须完全包含第一根的实体，仅仅是影线包裹不算。',
          },
          quiz: [
            {
              id: 'q2.3.1',
              question: '看涨吞没形态由几根K线组成？',
              options: ['1根', '2根', '3根', '4根'],
              correctIndex: 1,
              explanation: '吞没形态由2根K线组成：第一根小阴线，第二根大阳线完全包裹第一根。',
              chartHint: '观察蓝色高亮区域的两根K线，后一根完全包裹前一根',
            },
            {
              id: 'q2.3.2',
              question: '看涨吞没出现在什么位置最有效？',
              options: ['上涨趋势中', '下跌趋势末端', '横盘整理中', '任何位置都一样'],
              correctIndex: 1,
              explanation: '看涨吞没出现在下跌末端最有效，表示多方力量突然增强，可能反转。',
            },
          ],
          chartConfig: {
            mode: 'candlestick',
            dataPoints: 25,
            highlightRange: [14, 15],
            annotations: [
              { type: 'markArea', startIndex: 14, endIndex: 15, label: '看涨吞没', color: 'rgba(59,130,246,0.1)' },
              { type: 'markPoint', dataIndex: 14, label: '小阴线', color: '#22c55e', position: 'bottom' },
              { type: 'markPoint', dataIndex: 15, label: '大阳线吞没', color: '#ef4444', position: 'top' },
            ],
          },
          curatedData: CURATED['2.3'],
        },
        {
          id: '2.4',
          title: '星线组合',
          subtitle: '早晨之星与黄昏之星',
          moduleIndex: 1,
          lessonIndex: 3,
          content: {
            intro: '星线组合是由三根K线构成的反转形态。"早晨之星"出现在下跌末端，预示上涨；"黄昏之星"出现在上涨末端，预示下跌。中间那根小实体K线就是"星"。',
            keyPoints: [
              '早晨之星：大阴线 → 小实体（星）→ 大阳线，看涨信号',
              '黄昏之星：大阳线 → 小实体（星）→ 大阴线，看跌信号',
              '"星"的实体越小越好，最好接近十字星',
              '第三根K线深入第一根实体越多，信号越强',
              '这是最可靠的三根K线反转形态之一',
            ],
            tip: '早晨之星和黄昏之星是非常经典的反转形态，在实战中出现频率较高。',
          },
          quiz: [
            {
              id: 'q2.4.1',
              question: '早晨之星由哪三根K线组成？',
              options: ['阳-阴-阳', '阴-小实体-阳', '阳-小实体-阴', '阴-阴-阳'],
              correctIndex: 1,
              explanation: '早晨之星：第一根大阴线（下跌），第二根小实体（犹豫），第三根大阳线（反转上涨）。',
              chartHint: '观察红色高亮区域的三根K线组合',
            },
            {
              id: 'q2.4.2',
              question: '黄昏之星的第三根K线应该是？',
              options: ['大阳线', '十字星', '大阴线', '小阳线'],
              correctIndex: 2,
              explanation: '黄昏之星的第三根是大阴线，深入第一根阳线实体内部，确认反转下跌。',
            },
          ],
          chartConfig: {
            mode: 'candlestick',
            dataPoints: 30,
            highlightRange: [18, 20],
            annotations: [
              { type: 'markArea', startIndex: 18, endIndex: 20, label: '早晨之星', color: 'rgba(239,68,68,0.1)' },
            ],
          },
          curatedData: CURATED['2.4'],
        },
      ],
    },
    // === Module 3: 技术指标 ===
    {
      id: 'module-3',
      title: '技术指标',
      description: '用数学公式量化市场趋势',
      lessons: [
        {
          id: '3.1',
          title: '均线MA',
          subtitle: '平滑价格波动，看清趋势',
          moduleIndex: 2,
          lessonIndex: 0,
          content: {
            intro: '移动平均线（MA）是最常用的技术指标。它将过去N天的收盘价取平均值，连成一条平滑的曲线，帮助过滤掉日常波动，看清趋势方向。',
            keyPoints: [
              'MA5（5日均线）：短期趋势，反应灵敏',
              'MA20（20日均线）：中期趋势，最常用',
              'MA60（60日均线）：长期趋势，方向稳定',
              '金叉：短期均线从下向上穿过长期均线，看涨信号',
              '死叉：短期均线从上向下穿过长期均线，看跌信号',
              '价格在均线上方运行 = 趋势向好',
            ],
            tip: '均线是滞后指标，它确认趋势而非预测趋势。结合其他指标使用效果更好。',
          },
          quiz: [
            {
              id: 'q3.1.1',
              question: 'MA5从下方穿过MA20，这叫什么？',
              options: ['死叉', '金叉', '突破', '回调'],
              correctIndex: 1,
              explanation: '短期均线从下向上穿越长期均线叫"金叉"，是看涨信号。',
            },
            {
              id: 'q3.1.2',
              question: '以下哪个均线最能反映长期趋势？',
              options: ['MA5', 'MA10', 'MA20', 'MA60'],
              correctIndex: 3,
              explanation: 'MA60计算过去60天的平均值，平滑效果最强，最能反映长期趋势方向。',
            },
          ],
          chartConfig: {
            mode: 'candlestick',
            dataPoints: 80,
            overlays: ['ma5', 'ma20'],
            zoomStart: 0,
            zoomEnd: 100,
            annotations: [],
          },
        },
        {
          id: '3.2',
          title: 'MACD',
          subtitle: '趋势强弱与动量变化',
          moduleIndex: 2,
          lessonIndex: 1,
          content: {
            intro: 'MACD（指数平滑异同移动平均线）由DIF线、DEA线和柱状图组成。它通过两条不同周期均线的差值来判断趋势的强弱和转折。',
            keyPoints: [
              'DIF = MA12 - MA26：快线，反应灵敏',
              'DEA = DIF的9日均线：慢线，更平滑',
              'MACD柱 = (DIF - DEA) × 2：红绿柱状图',
              'DIF上穿DEA = 金叉，看涨信号',
              'DIF下穿DEA = 死叉，看跌信号',
              '柱状图由绿变红 = 下跌动能减弱',
              '柱状图由红变绿 = 上涨动能减弱',
            ],
            tip: 'MACD在零轴上方的金叉比零轴下方的金叉更可靠。',
          },
          quiz: [
            {
              id: 'q3.2.1',
              question: 'MACD的DIF线是用哪两个周期的均线计算的？',
              options: ['MA5和MA10', 'MA12和MA26', 'MA20和MA60', 'MA10和MA30'],
              correctIndex: 1,
              explanation: 'DIF = MA12 - MA26，即12日均线减去26日均线的差值。',
            },
            {
              id: 'q3.2.2',
              question: 'MACD柱状图由负变正，通常表示什么？',
              options: ['下跌加速', '下跌动能减弱，可能反转', '没有意义', '成交量放大'],
              correctIndex: 1,
              explanation: '柱状图由负变正说明DIF开始超过DEA，下跌动能减弱，是潜在的看涨信号。',
            },
          ],
          chartConfig: {
            mode: 'candlestick',
            dataPoints: 80,
            overlays: ['macd'],
            zoomStart: 0,
            zoomEnd: 100,
            annotations: [],
          },
        },
        {
          id: '3.3',
          title: 'RSI',
          subtitle: '判断超买超卖',
          moduleIndex: 2,
          lessonIndex: 2,
          content: {
            intro: 'RSI（相对强弱指标）衡量价格上涨和下跌的相对强度，数值在0-100之间。它可以帮助判断市场是否"超买"（涨过头）或"超卖"（跌过头）。',
            keyPoints: [
              'RSI > 70：超买区，价格可能涨过头，注意回调风险',
              'RSI < 30：超卖区，价格可能跌过头，关注反弹机会',
              'RSI = 50：多空平衡线',
              'RSI从超卖区向上突破30：潜在买入信号',
              'RSI从超买区向下跌破70：潜在卖出信号',
              'RSI也会出现背离：价格创新高但RSI没创新高 = 看跌背离',
            ],
            tip: '在强势上涨中，RSI可能长期维持在70以上，不能简单地认为超买就要卖出。',
          },
          quiz: [
            {
              id: 'q3.3.1',
              question: 'RSI数值为80，市场处于什么状态？',
              options: ['超卖', '超买', '正常', '无法判断'],
              correctIndex: 1,
              explanation: 'RSI > 70 为超买区，80说明近期涨幅较大，市场可能过热。',
            },
            {
              id: 'q3.3.2',
              question: '价格创新高，但RSI没有创新高，这叫什么？',
              options: ['金叉', '死叉', '顶背离', '突破'],
              correctIndex: 2,
              explanation: '这叫"顶背离"，说明上涨动能在减弱，虽然价格还在涨，但力度不如之前，是潜在的反转信号。',
            },
          ],
          chartConfig: {
            mode: 'candlestick',
            dataPoints: 80,
            overlays: ['rsi'],
            zoomStart: 0,
            zoomEnd: 100,
            annotations: [],
          },
        },
      ],
    },
    // === Module 4: 实战应用 ===
    {
      id: 'module-4',
      title: '实战应用',
      description: '综合运用所学知识分析市场',
      lessons: [
        {
          id: '4.1',
          title: '趋势判断',
          subtitle: '顺势而为是投资第一原则',
          moduleIndex: 3,
          lessonIndex: 0,
          content: {
            intro: '判断趋势是所有投资决策的基础。上升趋势中以持有为主，下降趋势中以观望为主。学会识别趋势，才能做到"顺势而为"。',
            keyPoints: [
              '上升趋势：价格高点和低点不断抬高',
              '下降趋势：价格高点和低点不断降低',
              '横盘整理：价格在一定范围内波动，方向不明',
              '均线排列：多头排列（短>中>长）= 上升趋势',
              '均线排列：空头排列（短<中<长）= 下降趋势',
              '趋势线：连接两个以上低点画上升趋势线',
            ],
            tip: '不要试图抄底逃顶，跟随趋势比预测转折点更容易成功。',
          },
          quiz: [
            {
              id: 'q4.1.1',
              question: 'MA5 > MA20 > MA60，这种排列叫什么？',
              options: ['空头排列', '多头排列', '交叉排列', '无序排列'],
              correctIndex: 1,
              explanation: '短期均线在上，长期均线在下，形成多头排列，表明上升趋势。',
            },
            {
              id: 'q4.1.2',
              question: '上升趋势中，价格回调到MA20附近获得支撑，应该怎么做？',
              options: ['立即卖出', '观察是否企稳，考虑加仓', '等待跌破MA60', '忽略'],
              correctIndex: 1,
              explanation: '在上升趋势中，回调到重要均线获得支撑是常见的加仓时机，但需要观察是否真的企稳。',
            },
          ],
          chartConfig: {
            mode: 'candlestick',
            dataPoints: 80,
            overlays: ['ma5', 'ma20', 'ma60'],
            zoomStart: 0,
            zoomEnd: 100,
            annotations: [],
          },
        },
        {
          id: '4.2',
          title: '综合分析',
          subtitle: '多维度验证，提高判断准确率',
          moduleIndex: 3,
          lessonIndex: 1,
          content: {
            intro: '单一指标容易产生误判，综合运用K线形态、均线、MACD、RSI等多个维度进行验证，可以大大提高分析的准确率。这就是"多维验证"的思想。',
            keyPoints: [
              '第一步：看趋势 — 均线排列判断大方向',
              '第二步：看形态 — K线形态寻找买卖点',
              '第三步：看指标 — MACD/RSI验证信号强度',
              '第四步：看量能 — 成交量确认突破有效性',
              '多个信号一致时，决策信心更高',
              '任何单一信号都不能100%准确，做好风控',
            ],
            tip: '投资没有确定性，技术分析只是提高概率的工具。永远做好止损计划。',
          },
          quiz: [
            {
              id: 'q4.2.1',
              question: '均线多头排列 + MACD金叉 + RSI从超卖回升，三个信号一致，应该如何操作？',
              options: ['全部卖出', '信号一致，可以考虑买入', '等待更多信号', '不看这些，凭感觉'],
              correctIndex: 1,
              explanation: '三个不同维度的指标同时发出看涨信号，可信度较高，是可以考虑买入的时机。',
            },
            {
              id: 'q4.2.2',
              question: '技术分析最大的局限性是什么？',
              options: ['计算太复杂', '不能预测黑天鹅事件', '只适合股票', '需要付费软件'],
              correctIndex: 1,
              explanation: '技术分析基于历史数据，无法预测突发事件（如政策变化、自然灾害等）。所以风控永远是第一位的。',
            },
          ],
          chartConfig: {
            mode: 'candlestick',
            dataPoints: 80,
            overlays: ['ma20', 'ma60', 'macd', 'rsi'],
            zoomStart: 0,
            zoomEnd: 100,
            annotations: [],
          },
        },
      ],
    },
  ],
};

// Flatten all lessons for easy lookup
export const ALL_LESSONS = COURSE.modules.flatMap(m => m.lessons);

export function getLessonById(id: string) {
  return ALL_LESSONS.find(l => l.id === id);
}

export function getNextLessonId(currentId: string): string | null {
  const idx = ALL_LESSONS.findIndex(l => l.id === currentId);
  if (idx < 0 || idx >= ALL_LESSONS.length - 1) return null;
  return ALL_LESSONS[idx + 1].id;
}

export function getPrevLessonId(currentId: string): string | null {
  const idx = ALL_LESSONS.findIndex(l => l.id === currentId);
  if (idx <= 0) return null;
  return ALL_LESSONS[idx - 1].id;
}
