'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { KLineData, ChartAnnotation, ChartConfig } from '@/types/learn';
import { calculateMACD, calculateRSI } from '@/data/mock-kline';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

const UP_COLOR = '#ef4444';
const DOWN_COLOR = '#22c55e';
const AXIS_COLOR = '#94a3b8';

interface Props {
  data: KLineData[];
  config: ChartConfig;
}

function validIndex(index: number | undefined, data: KLineData[]) {
  if (index === undefined) return null;
  if (index < 0 || index >= data.length) return null;
  return index;
}

function calculateDisplayMA(data: KLineData[], period: number) {
  return data.map((item, index) => {
    const start = Math.max(0, index - period + 1);
    const slice = data.slice(start, index + 1);
    const avg = slice.reduce((sum, d) => sum + d.close, 0) / slice.length;
    return { date: item.date, value: parseFloat(avg.toFixed(2)) };
  });
}

function labelStyle(color: string, position: 'top' | 'bottom') {
  return {
    show: true,
    position,
    distance: 10,
    color: '#111827',
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 14,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: color,
    borderWidth: 1,
    borderRadius: 6,
    padding: [3, 6],
    overflow: 'break',
  };
}

function buildLabelPoint(ann: ChartAnnotation, data: KLineData[], dates: string[]) {
  const index = validIndex(ann.dataIndex, data);
  if (index === null) return null;

  const candle = data[index];
  const color = ann.color || '#3b82f6';
  const position = ann.position === 'bottom' ? 'bottom' : 'top';

  return {
    value: [dates[index], position === 'bottom' ? candle.low : candle.high],
    itemStyle: { color },
    label: {
      ...labelStyle(color, position),
      formatter: ann.label,
    },
  };
}

export default function LessonChart({ data, config }: Props) {
  const option = useMemo(() => {
    const dates = data.map(d => d.date);
    const ohlc = data.map(d => [d.open, d.close, d.low, d.high]);
    const overlays = config.overlays || [];
    const subCharts = [
      overlays.includes('macd') ? 'macd' : null,
      overlays.includes('rsi') ? 'rsi' : null,
    ].filter(Boolean) as ('macd' | 'rsi')[];

    const annotations = config.annotations || [];
    const markPoints = annotations.filter(a => a.type === 'markPoint');
    const markLines = annotations.filter(a => a.type === 'markLine');
    const markAreas = annotations.filter(a => a.type === 'markArea');
    const hasLabels = markPoints.length > 0 || markAreas.length > 0 || markLines.length > 0;
    const mainTop = hasLabels ? 48 : overlays.some(o => o.startsWith('ma')) ? 34 : 22;
    const mainBottom = subCharts.length === 0 ? 28 : subCharts.length === 1 ? '30%' : '44%';

    const grids: Record<string, unknown>[] = [{
      left: 58,
      right: 24,
      top: mainTop,
      bottom: mainBottom,
      containLabel: true,
    }];

    if (subCharts.length === 1) {
      grids.push({ left: 58, right: 24, top: '76%', bottom: 22, containLabel: true });
    } else if (subCharts.length === 2) {
      grids.push({ left: 58, right: 24, top: '60%', bottom: '24%', containLabel: true });
      grids.push({ left: 58, right: 24, top: '80%', bottom: 22, containLabel: true });
    }

    const xAxes: Record<string, unknown>[] = grids.map((_, gridIndex) => ({
      type: 'category' as const,
      data: dates,
      gridIndex,
      boundaryGap: true,
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.28)' } },
      axisLabel: { show: false },
      axisTick: { show: false },
    }));

    const yAxes: Record<string, unknown>[] = grids.map((_, gridIndex) => ({
      scale: true,
      gridIndex,
      axisLine: { show: false },
      axisLabel: { color: AXIS_COLOR, fontSize: 10 },
      splitLine: {
        show: gridIndex === 0,
        lineStyle: { type: 'dashed' as const, color: 'rgba(148,163,184,0.16)' },
      },
    }));

    const series: Record<string, unknown>[] = [];
    const legends: string[] = [];
    const candleStyle = {
      color: UP_COLOR,
      color0: DOWN_COLOR,
      borderColor: UP_COLOR,
      borderColor0: DOWN_COLOR,
    };

    if (config.highlightRange) {
      const [start, end] = config.highlightRange;
      series.push({
        name: 'K线',
        type: 'candlestick',
        data: ohlc.map((d, i) => (i >= start && i <= end) ? [null, null, null, null] : d),
        itemStyle: { ...candleStyle, opacity: 0.18 },
        silent: true,
        tooltip: { show: false },
      });
      series.push({
        name: 'K线',
        type: 'candlestick',
        data: ohlc.map((d, i) => (i >= start && i <= end) ? d : [null, null, null, null]),
        itemStyle: candleStyle,
      });
    } else {
      series.push({
        name: 'K线',
        type: 'candlestick',
        data: ohlc,
        itemStyle: candleStyle,
      });
    }

    const annotationHost = series[0];

    if (overlays.includes('ma5')) {
      const ma5 = calculateDisplayMA(data, 5);
      series.push({ name: 'MA5', type: 'line', data: ma5.map(d => d.value), smooth: true, symbol: 'none', lineStyle: { width: 1.3, color: '#f59e0b' } });
      legends.push('MA5');
    }
    if (overlays.includes('ma20')) {
      const ma20 = calculateDisplayMA(data, 20);
      series.push({ name: 'MA20', type: 'line', data: ma20.map(d => d.value), smooth: true, symbol: 'none', lineStyle: { width: 1.3, color: '#3b82f6' } });
      legends.push('MA20');
    }
    if (overlays.includes('ma60')) {
      const ma60 = calculateDisplayMA(data, 60);
      series.push({ name: 'MA60', type: 'line', data: ma60.map(d => d.value), smooth: true, symbol: 'none', lineStyle: { width: 1.3, color: '#a855f7' } });
      legends.push('MA60');
    }

    if (markAreas.length > 0) {
      annotationHost.markArea = {
        silent: true,
        label: {
          show: markPoints.length === 0,
          position: 'insideTopLeft',
          color: '#334155',
          fontSize: 11,
          fontWeight: 600,
          backgroundColor: 'rgba(255,255,255,0.86)',
          borderRadius: 5,
          padding: [2, 6],
          formatter: (params: { name?: string }) => params.name || '',
        },
        data: markAreas.map(ann => {
          const start = validIndex(ann.startIndex, data);
          const end = validIndex(ann.endIndex, data);
          if (start === null || end === null) return null;

          return [
            {
              name: ann.label,
              xAxis: dates[start],
              itemStyle: { color: ann.color || 'rgba(59,130,246,0.1)' },
            },
            { xAxis: dates[end] },
          ];
        }).filter(Boolean),
      };
    }

    if (markLines.length > 0) {
      annotationHost.markLine = {
        silent: true,
        animation: false,
        symbol: 'none',
        data: markLines
          .filter(ann => ann.value !== undefined)
          .map(ann => {
            const color = ann.color || AXIS_COLOR;
            return {
              yAxis: ann.value,
              lineStyle: { color, type: 'dashed', width: 1 },
              label: {
                show: true,
                formatter: ann.label,
                position: 'end',
                color,
                fontSize: 11,
                backgroundColor: 'rgba(255,255,255,0.92)',
                padding: [2, 5],
                borderRadius: 5,
              },
            };
          }),
      };
    }

    const labelPoints = markPoints
      .map(ann => buildLabelPoint(ann, data, dates))
      .filter(Boolean);

    if (labelPoints.length > 0) {
      series.push({
        name: '图表标注',
        type: 'scatter',
        data: labelPoints,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        z: 20,
        tooltip: { show: false },
        labelLayout: { hideOverlap: true },
      });
    }

    subCharts.forEach((type, index) => {
      const gridIndex = index + 1;

      if (type === 'macd') {
        const macdData = calculateMACD(data);
        series.push({
          name: 'MACD',
          type: 'bar',
          xAxisIndex: gridIndex,
          yAxisIndex: gridIndex,
          barWidth: '55%',
          data: macdData.map(d => ({
            value: d.macd,
            itemStyle: { color: d.macd >= 0 ? UP_COLOR : DOWN_COLOR },
          })),
        });
        series.push({
          name: 'DIF',
          type: 'line',
          xAxisIndex: gridIndex,
          yAxisIndex: gridIndex,
          data: macdData.map(d => d.dif),
          symbol: 'none',
          lineStyle: { width: 1.2, color: '#3b82f6' },
        });
        series.push({
          name: 'DEA',
          type: 'line',
          xAxisIndex: gridIndex,
          yAxisIndex: gridIndex,
          data: macdData.map(d => d.dea),
          symbol: 'none',
          lineStyle: { width: 1.2, color: '#f59e0b' },
        });
        legends.push('DIF', 'DEA');
      }

      if (type === 'rsi') {
        const rsiData = calculateRSI(data);
        yAxes[gridIndex] = {
          ...yAxes[gridIndex],
          min: 0,
          max: 100,
        };

        const rsiSeries: Record<string, unknown> = {
          name: 'RSI',
          type: 'line',
          xAxisIndex: gridIndex,
          yAxisIndex: gridIndex,
          data: rsiData.map(d => d.value),
          symbol: 'none',
          lineStyle: { width: 1.4, color: '#a855f7' },
          markLine: {
            silent: true,
            animation: false,
            symbol: 'none',
            data: [
              { yAxis: 70, lineStyle: { color: UP_COLOR, type: 'dashed', width: 1 }, label: { show: false } },
              { yAxis: 30, lineStyle: { color: DOWN_COLOR, type: 'dashed', width: 1 }, label: { show: false } },
            ],
          },
        };
        series.push(rsiSeries);
        legends.push('RSI');
      }
    });

    return {
      animation: false,
      legend: legends.length > 0 ? {
        data: legends,
        top: 4,
        right: 16,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { fontSize: 10, color: '#64748b' },
      } : undefined,
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'cross' as const },
        confine: true,
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      dataZoom: [{
        type: 'inside' as const,
        xAxisIndex: xAxes.map((_, index) => index),
        start: config.zoomStart ?? 0,
        end: config.zoomEnd ?? 100,
        zoomOnMouseWheel: true,
        moveOnMouseWheel: true,
      }],
      series,
    };
  }, [data, config]);

  return (
    <ReactECharts
      option={option}
      notMerge
      style={{ width: '100%', height: '100%' }}
    />
  );
}
