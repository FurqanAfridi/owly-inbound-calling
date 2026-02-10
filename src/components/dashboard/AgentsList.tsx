import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { GraduationCap, MoreVertical, Eye, Pencil, Trash2 } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  label: string;
}

interface AgentsListProps {
  agents?: Agent[];
  onViewAll?: () => void;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const AgentsList: React.FC<AgentsListProps> = ({
  agents = [
    { id: '1', name: 'Multiple Greeting agent', label: 'Duhanashrah' },
    { id: '2', name: 'Multiple Greeting agent', label: 'Duhanashrah' },
    { id: '3', name: 'Multiple Greeting agent', label: 'Duhanashrah' },
  ],
  onViewAll,
  onView,
  onEdit,
  onDelete,
}) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <Card className="bg-[#f8f8f8] border border-[#f0f0f0] rounded-[14px]">
      <CardContent className="p-5 flex flex-col gap-[10px]">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <div className="flex gap-[6px] items-center">
              <GraduationCap className="w-4 h-4 text-[#141414]" />
              <p className="text-[14px] font-medium text-[#141414] leading-[1.5]">Agents</p>
            </div>
          </div>
          <button
            onClick={onViewAll}
            className="text-[14px] font-medium text-[#141414] underline leading-[1.6]"
          >
            View All
          </button>
        </div>

        <div className="flex flex-col gap-[10px]">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-white flex items-center justify-between p-[10px] rounded-[8px]"
            >
              <div className="flex flex-col leading-[1.5] pb-px">
                <p className="text-[14px] font-medium text-[#141414]">{agent.name}</p>
                <p className="text-[12px] font-normal text-[#0b99ff]">{agent.label}</p>
              </div>
              <div className="flex items-center justify-end">
                <DropdownMenu open={openMenuId === agent.id} onOpenChange={(open) => setOpenMenuId(open ? agent.id : null)}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[91px] p-1">
                    <DropdownMenuItem onClick={() => onView?.(agent.id)} className="gap-2 text-[14px]">
                      <Eye className="w-4 h-4" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit?.(agent.id)} className="gap-2 text-[14px]">
                      <Pencil className="w-4 h-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete?.(agent.id)} className="gap-2 text-[14px] text-[#e7000b]">
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentsList;
