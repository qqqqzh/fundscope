'use client';

import { Lightbulb } from 'lucide-react';
import type { LessonContent as LCType } from '@/types/learn';

interface Props {
  content: LCType;
}

export default function LessonContent({ content }: Props) {
  return (
    <div className="h-full min-h-0 overflow-y-auto pr-1 md:grid md:grid-cols-[1.05fr_1fr] md:gap-4">
      <div className="min-w-0">
        <p className="text-[12px] md:text-[11px] xl:text-[12px] text-gray-600 leading-relaxed mb-2">{content.intro}</p>

        {content.tip && (
          <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
            <Lightbulb size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-700 leading-relaxed">{content.tip}</p>
          </div>
        )}
      </div>

      <ul className="space-y-1 md:space-y-0.5 mb-3 md:mb-0 min-w-0">
        {content.keyPoints.map((point, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px] md:text-[11px] xl:text-[12px] text-gray-700 leading-relaxed">
            <span className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
