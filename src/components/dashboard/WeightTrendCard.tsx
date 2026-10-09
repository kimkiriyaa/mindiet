import React from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface WeightLogPoint {
  date: string;
  weight?: number;
}

interface WeightTrendCardProps {
  logs: WeightLogPoint[];
  currentWeight?: number;
}

export const WeightTrendCard: React.FC<WeightTrendCardProps> = ({ logs, currentWeight }) => {
  const recordedLogs = logs.filter((l) => typeof l.weight === 'number' && l.weight > 0) as {
    date: string;
    weight: number;
  }[];

  if (recordedLogs.length < 2) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <h3 className="text-sm font-bold text-slate-800 mb-2">최근 체중 변화 추이 (14일)</h3>
        <p className="text-xs text-slate-400 py-6 text-center">
          2일 이상의 체중 기록이 쌓이면 꺾은선 추이 그래프가 나타납니다.
        </p>
      </div>
    );
  }

  const weights = recordedLogs.map((l) => l.weight);
  const minW = Math.min(...weights) - 0.5;
  const maxW = Math.max(...weights) + 0.5;
  const range = maxW - minW || 1;

  const firstWeight = recordedLogs[0].weight;
  const lastWeight = recordedLogs[recordedLogs.length - 1].weight;
  const diff = Math.round((lastWeight - firstWeight) * 10) / 10;

  // SVG 좌표 계산 (너비 300, 높이 100 기준)
  const svgWidth = 300;
  const svgHeight = 100;
  const paddingX = 20;
  const paddingY = 15;
  const innerWidth = svgWidth - paddingX * 2;
  const innerHeight = svgHeight - paddingY * 2;

  const points = recordedLogs.map((item, idx) => {
    const x = paddingX + (idx / (recordedLogs.length - 1)) * innerWidth;
    const y = paddingY + innerHeight - ((item.weight - minW) / range) * innerHeight;
    return { x, y, ...item };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">최근 체중 변화 추이</h3>
          <p className="text-[11px] text-slate-400">최근 14일간의 기록된 체중</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-extrabold text-slate-800">
            {lastWeight ?? currentWeight ?? '-'} kg
          </div>
          <div className="flex items-center justify-end gap-0.5 text-[11px] font-semibold">
            {diff < 0 ? (
              <span className="text-emerald-500 flex items-center">
                <TrendingDown className="w-3 h-3 mr-0.5" />
                {diff} kg
              </span>
            ) : diff > 0 ? (
              <span className="text-rose-500 flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" />+{diff} kg
              </span>
            ) : (
              <span className="text-slate-400 flex items-center">
                <Minus className="w-3 h-3 mr-0.5" />
                변화 없음
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="w-full h-28 bg-slate-50/70 rounded-xl p-2 flex items-center justify-center">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible">
          {/* 가이드 수평선 */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={svgWidth - paddingX}
            y2={paddingY}
            stroke="#e2e8f0"
            strokeDasharray="3 3"
          />
          <line
            x1={paddingX}
            y1={svgHeight - paddingY}
            x2={svgWidth - paddingX}
            y2={svgHeight - paddingY}
            stroke="#e2e8f0"
            strokeDasharray="3 3"
          />

          {/* 꺾은선 라인 */}
          <polyline
            fill="none"
            stroke="#6366f1"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
          />

          {/* 데이터 포인트 원 */}
          {points.map((p, idx) => (
            <g key={idx}>
              <circle
                cx={p.x}
                cy={p.y}
                r={idx === points.length - 1 ? '4' : '3'}
                className={idx === points.length - 1 ? 'fill-indigo-600' : 'fill-indigo-400'}
              />
              <text
                x={p.x}
                y={p.y - 7}
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                className="fill-slate-600"
              >
                {p.weight}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex justify-between text-[10px] text-slate-400 px-2">
        <span>{recordedLogs[0].date.slice(5)}</span>
        <span>{recordedLogs[recordedLogs.length - 1].date.slice(5)}</span>
      </div>
    </div>
  );
};
