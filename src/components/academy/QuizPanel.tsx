'use client';

import { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { QuizQuestion } from '@/types/learn';

interface Props {
  questions: QuizQuestion[];
  onComplete: (scores: number[]) => void;
}

export default function QuizPanel({ questions, onComplete }: Props) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const question = questions[currentQ];
  if (!question) return null;

  const handleSelect = (idx: number) => {
    if (showFeedback) return;
    setSelected(idx);
    setShowFeedback(true);
  };

  const handleNext = () => {
    const newScores = [...scores, selected ?? -1];
    setScores(newScores);

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
      setSelected(null);
      setShowFeedback(false);
    } else {
      setDone(true);
      onComplete(newScores);
    }
  };

  if (done) {
    const correct = scores.filter((s, i) => s === questions[i].correctIndex).length;
    return (
      <div className="flex items-center gap-3 h-full min-h-[92px]">
        <CheckCircle size={18} className="text-green-500" />
        <div>
          <p className="text-[13px] font-medium text-green-700">课程完成</p>
          <p className="text-[11px] text-gray-500">答对 {correct}/{questions.length} 题</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium flex-shrink-0">
          {currentQ + 1}/{questions.length}
        </span>
        <p className="text-[12px] font-medium text-gray-800 leading-snug flex-1">{question.question}</p>
      </div>

      {question.chartHint && !showFeedback && (
        <p className="text-[10px] text-blue-500 mb-1.5 flex items-start gap-1 leading-snug">
          <span className="inline-block w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
          提示：观察上方图表中{question.chartHint}
        </p>
      )}

      <div className="flex flex-wrap content-start gap-1.5 flex-1 min-h-0 overflow-y-auto pr-1">
        {question.options.map((opt, i) => {
          const isCorrect = i === question.correctIndex;
          const isSelected = i === selected;

          let style = 'bg-white border-black/[0.06] text-gray-600 hover:bg-gray-50';
          if (showFeedback) {
            if (isCorrect) style = 'bg-green-50 border-green-200 text-green-700';
            else if (isSelected && !isCorrect) style = 'bg-red-50 border-red-200 text-red-700';
            else style = 'bg-gray-50 border-gray-100 text-gray-400';
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={showFeedback}
              className={`px-3 py-1.5 rounded-lg text-[11px] leading-snug text-left border transition-all duration-150 ${style}`}
            >
              {String.fromCharCode(65 + i)}. {opt}
              {showFeedback && isCorrect && <CheckCircle size={11} className="inline ml-1" />}
              {showFeedback && isSelected && !isCorrect && <XCircle size={11} className="inline ml-1" />}
            </button>
          );
        })}
      </div>

      {showFeedback && (
        <div className="flex items-start gap-2 mt-2 flex-shrink-0">
          <p className="text-[11px] text-gray-500 leading-snug flex-1 max-h-16 overflow-y-auto pr-1">{question.explanation}</p>
          <button
            onClick={handleNext}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors flex-shrink-0"
          >
            {currentQ < questions.length - 1 ? '下一题' : '完成课程'}
          </button>
        </div>
      )}
    </div>
  );
}
