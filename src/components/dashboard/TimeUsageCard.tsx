import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';

interface TimeUsageCardProps {
  totalTime: string;
  used: string;
  remaining: string;
  usedPercentage: number;
}

const TimeUsageCard: React.FC<TimeUsageCardProps> = ({
  totalTime,
  used,
  remaining,
  usedPercentage,
}) => {
  return (
    <Card className="bg-[#f8f8f8] border border-[#f0f0f0] rounded-[14px]">
      <CardContent className="p-5 flex flex-col gap-[30px]">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-5 text-[#27272b]" />
            <h3 className="text-[14px] font-bold text-[#27272b] tracking-[-0.6px]">Time Usage</h3>
          </div>
          <div className="flex gap-[5px] items-center w-full">
            <div 
              className="bg-[#0b99ff] h-11 rounded-[4px]"
              style={{ width: `${usedPercentage}%` }}
            />
            <div 
              className="bg-[rgba(11,153,255,0.6)] flex-1 h-11 rounded-[4px]"
              style={{ width: `${100 - usedPercentage}%` }}
            />
          </div>
        </div>
        
        <div className="flex flex-col gap-[10px]">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-[10px]">
              <p className="text-[14px] font-medium text-[rgba(39,39,43,0.7)]">Time Summary</p>
              <p className="text-[16px] font-medium text-[#27272b] tracking-[-0.6px]">Total Time</p>
              <p className="text-[16px] font-medium text-[#27272b] tracking-[-0.6px]">Used</p>
              <p className="text-[16px] font-medium text-[#27272b] tracking-[-0.6px]">Remaining</p>
            </div>
            <div className="flex flex-col gap-[10px] items-end">
              <p className="text-[14px] font-medium text-[rgba(39,39,43,0.7)]">Duration</p>
              <p className="text-[16px] font-medium text-[#27272b] tracking-[-0.6px]">{totalTime}</p>
              <p className="text-[16px] font-medium text-[#27272b] tracking-[-0.6px]">{used}</p>
              <p className="text-[16px] font-medium text-[#27272b] tracking-[-0.6px]">{remaining}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TimeUsageCard;
