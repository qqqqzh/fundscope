export interface KLineData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export interface KLinePattern {
  name: string;
  nameEn: string;
  description: string;
  signal: 'bullish' | 'bearish' | 'neutral';
  points: { date: string; value: number }[];
  explanation: string;
}

export interface TechnicalIndicator {
  name: string;
  fullName: string;
  description: string;
  formula: string;
  usage: string;
  data: { date: string; value: number }[];
}

export interface LearningCard {
  id: string;
  title: string;
  category: '基础' | 'K线' | '指标' | '策略' | '风险';
  difficulty: 1 | 2 | 3;
  content: string;
  quiz?: {
    question: string;
    options: string[];
    answer: number;
    explanation: string;
  };
}

export interface GlossaryTerm {
  term: string;
  pinyin: string;
  category: string;
  definition: string;
  example: string;
  relatedTerms: string[];
}

// === Course System Types ===

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  chartHint?: string;
}

export interface LessonContent {
  intro: string;
  keyPoints: string[];
  tip?: string;
}

export interface ChartAnnotation {
  type: 'markPoint' | 'markLine' | 'markArea';
  dataIndex?: number;
  startIndex?: number;
  endIndex?: number;
  value?: number;
  label: string;
  color?: string;
  position?: 'top' | 'bottom';
}

export interface ChartConfig {
  mode: 'candlestick' | 'line' | 'indicator';
  dataPoints: number;
  highlightRange?: [number, number];
  annotations?: ChartAnnotation[];
  overlays?: ('ma5' | 'ma20' | 'ma60' | 'volume' | 'macd' | 'rsi')[];
  zoomStart?: number;
  zoomEnd?: number;
}

export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  moduleIndex: number;
  lessonIndex: number;
  content: LessonContent;
  quiz: QuizQuestion[];
  chartConfig: ChartConfig;
  curatedData?: KLineData[];
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  modules: CourseModule[];
}

export interface UserProgress {
  completedLessons: string[];
  quizScores: Record<string, number[]>;
  currentLesson: string | null;
  lastAccessed: string;
}
