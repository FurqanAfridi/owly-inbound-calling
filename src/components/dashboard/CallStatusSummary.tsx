import React, { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PieChart } from 'lucide-react';

interface CallStatusSummaryProps {
  totalCalls: number;
  completed: number;
  failed: number;
  inProgress: number;
}

const CallStatusSummary: React.FC<CallStatusSummaryProps> = ({
  totalCalls,
  completed,
  failed,
  inProgress,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const prevDataRef = useRef({ totalCalls, completed, failed, inProgress });

  // Animate chart when data changes
  useEffect(() => {
    const prev = prevDataRef.current;
    const hasChanged = 
      prev.totalCalls !== totalCalls ||
      prev.completed !== completed ||
      prev.failed !== failed ||
      prev.inProgress !== inProgress;

    if (hasChanged && svgRef.current) {
      // Add a subtle animation class
      svgRef.current.style.transition = 'transform 0.3s ease';
      svgRef.current.style.transform = 'scale(1.05)';
      setTimeout(() => {
        if (svgRef.current) {
          svgRef.current.style.transform = 'scale(1)';
        }
      }, 300);
    }

    prevDataRef.current = { totalCalls, completed, failed, inProgress };
  }, [totalCalls, completed, failed, inProgress]);

  // SVG donut chart configuration
  const size = 143.623;
  const center = size / 2;
  const outerRadius = size / 2 - 5;
  const innerRadius = size / 2 - 25; // Donut hole radius

  // Calculate angles for donut chart
  const total = totalCalls || 1;
  const completedPercent = total > 0 ? (completed / total) * 100 : 0;
  const failedPercent = total > 0 ? (failed / total) * 100 : 0;
  const inProgressPercent = total > 0 ? (inProgress / total) * 100 : 0;

  const completedAngle = (completedPercent / 100) * 360;
  const failedAngle = (failedPercent / 100) * 360;
  const inProgressAngle = (inProgressPercent / 100) * 360;

  // Helper function to create path for donut slice
  const createDonutSlice = (startAngle: number, endAngle: number, color: string) => {
    if (endAngle <= startAngle || endAngle - startAngle < 0.1) return null;
    
    const startRad = ((startAngle - 90) * Math.PI) / 180; // Start from top
    const endRad = ((endAngle - 90) * Math.PI) / 180;
    
    // Outer arc points
    const outerX1 = center + outerRadius * Math.cos(startRad);
    const outerY1 = center + outerRadius * Math.sin(startRad);
    const outerX2 = center + outerRadius * Math.cos(endRad);
    const outerY2 = center + outerRadius * Math.sin(endRad);
    
    // Inner arc points
    const innerX1 = center + innerRadius * Math.cos(endRad);
    const innerY1 = center + innerRadius * Math.sin(endRad);
    const innerX2 = center + innerRadius * Math.cos(startRad);
    const innerY2 = center + innerRadius * Math.sin(startRad);
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    
    return (
      <path
        key={`${startAngle}-${endAngle}-${color}`}
        d={`M ${outerX1} ${outerY1} 
            A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerX2} ${outerY2}
            L ${innerX1} ${innerY1}
            A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerX2} ${innerY2}
            Z`}
        fill={color}
        stroke={color}
        strokeWidth="0.5"
        style={{
          transition: 'opacity 0.3s ease, transform 0.3s ease',
        }}
      />
    );
  };

  let currentAngle = 0;
  const slices: React.ReactNode[] = [];

  // If no calls, show empty state with gray background
  if (totalCalls === 0) {
    slices.push(
      <circle
        key="empty"
        cx={center}
        cy={center}
        r={outerRadius}
        fill="#e5e5e5"
        stroke="none"
      />
    );
  } else {
    // Calculate actual slice angles based on percentages
    const totalAngle = 360;
    const completedSliceAngle = (completed / totalCalls) * totalAngle;
    const failedSliceAngle = (failed / totalCalls) * totalAngle;
    const inProgressSliceAngle = (inProgress / totalCalls) * totalAngle;
    
    // Start from top (0 degrees, which is -90 in our coordinate system)
    // Add completed slice (blue #0b99ff) - main blue color
    if (completed > 0 && completedSliceAngle > 0.1) {
      const slice = createDonutSlice(currentAngle, currentAngle + completedSliceAngle, '#0b99ff');
      if (slice) slices.push(slice);
      currentAngle += completedSliceAngle;
    }

    // Add completed faded slice (light blue) - represents portion of completed
    if (completed > 0 && currentAngle < 360) {
      const fadeAngle = Math.min(completedSliceAngle * 0.3, 360 - currentAngle);
      if (fadeAngle > 0.1) {
        const slice = createDonutSlice(currentAngle, currentAngle + fadeAngle, 'rgba(11,153,255,0.6)');
        if (slice) slices.push(slice);
        currentAngle += fadeAngle;
      }
    }

    // Add failed slice (red)
    if (failed > 0 && currentAngle < 360) {
      const sliceAngle = Math.min(failedSliceAngle, 360 - currentAngle);
      if (sliceAngle > 0.1) {
        const slice = createDonutSlice(currentAngle, currentAngle + sliceAngle, '#fe9191');
        if (slice) slices.push(slice);
        currentAngle += sliceAngle;
      }
    }

    // Add in progress slice (purple)
    if (inProgress > 0 && currentAngle < 360) {
      const sliceAngle = Math.min(inProgressSliceAngle, 360 - currentAngle);
      if (sliceAngle > 0.1) {
        const slice = createDonutSlice(currentAngle, currentAngle + sliceAngle, '#ccc2ff');
        if (slice) slices.push(slice);
        currentAngle += sliceAngle;
      }
    }

    // Fill remaining space with gray if needed
    if (currentAngle < 360) {
      const remainingAngle = 360 - currentAngle;
      if (remainingAngle > 0.1) {
        const slice = createDonutSlice(currentAngle, 360, '#e5e5e5');
        if (slice) slices.push(slice);
      }
    }
  }

  return (
    <Card className="bg-[#f8f8f8] border border-[#f0f0f0] rounded-[14px]">
      <CardContent className="p-5 flex flex-col gap-5">
        {/* Header */}
        <div className="flex gap-[6px] items-center">
          <PieChart className="w-4 h-4 text-[#141414]" />
          <p 
            className="text-[14px] font-medium text-[#141414] leading-[1.5]"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Call Status Summary
          </p>
        </div>
        
        {/* Chart and Legend */}
        <div className="flex flex-row gap-8 md:gap-[50px] items-center flex-wrap md:flex-nowrap justify-center md:justify-start">
          {/* Donut Chart */}
          <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            <svg 
              ref={svgRef}
              width={size} 
              height={size} 
              viewBox={`0 0 ${size} ${size}`} 
              style={{ overflow: 'visible', display: 'block' }}
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Background circle - gray outline */}
              <circle
                cx={center}
                cy={center}
                r={outerRadius}
                fill="none"
                stroke="#e5e5e5"
                strokeWidth="2"
              />
              {/* Inner circle for donut hole */}
              <circle
                cx={center}
                cy={center}
                r={innerRadius}
                fill="#f8f8f8"
                stroke="none"
              />
              {/* Chart slices - render on top */}
              {slices}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex gap-4 md:gap-2 items-start flex-shrink-0">
            <div className="flex flex-col gap-[10px] w-[102px]">
              <div className="flex gap-[10px] items-center">
                <div className="w-[9px] h-[9px] bg-[#0b99ff] shrink-0 rounded-full" />
                <p 
                  className="text-[14px] font-normal text-[#141414] leading-[1.5]"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  Total Calls
                </p>
              </div>
              <div className="flex gap-[10px] items-center">
                <div className="w-[9px] h-[9px] bg-[rgba(11,153,255,0.6)] shrink-0 rounded-full" />
                <p 
                  className="text-[14px] font-normal text-[#141414] leading-[1.5]"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  Completed
                </p>
              </div>
              <div className="flex gap-[10px] items-center">
                <div className="w-[9px] h-[9px] bg-[#fe9191] shrink-0 rounded-full" />
                <p 
                  className="text-[14px] font-normal text-[#141414] leading-[1.5]"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  Failed
                </p>
              </div>
              <div className="flex gap-[10px] items-center">
                <div className="w-[9px] h-[9px] bg-[#ccc2ff] shrink-0 rounded-full" />
                <p 
                  className="text-[14px] font-normal text-[#141414] leading-[1.5]"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  In Progress
                </p>
              </div>
            </div>
            <div 
              className="flex flex-col gap-[10px] text-[14px] font-semibold text-[#141414] leading-[1.5]"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              <p>{totalCalls}</p>
              <p>{completed}</p>
              <p>{failed}</p>
              <p>{inProgress}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CallStatusSummary;
