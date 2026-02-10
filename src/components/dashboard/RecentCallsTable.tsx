import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpDown } from 'lucide-react';

interface ContactCallData {
  id: string;
  name: string;
  phone: string;
  email: string;
  list: string;
  status: string;
  totalCalls: number;
  lastCall: string;
  lastCallDuration: string;
  endReason: string;
}

interface RecentCallsTableProps {
  calls: ContactCallData[];
}

const RecentCallsTable: React.FC<RecentCallsTableProps> = ({ calls }) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => (
    <button
      onClick={() => handleSort(column)}
      className="flex items-center gap-1 hover:opacity-70 transition-opacity"
    >
      <ArrowUpDown className="w-4 h-4 text-black" />
    </button>
  );

  return (
    <Card className="bg-[#f8f8f8] border border-[#f0f0f0] rounded-[14px] overflow-hidden">
      <CardContent className="p-0">
        {/* Header Row */}
        <div className="bg-[#f8f8f8] flex gap-4 items-center py-[10px] px-4 border-b border-[#e5e5e5]">
          <div className="flex gap-1 items-center px-[15px] w-[156px] shrink-0">
            <p className="text-[14px] font-bold text-black leading-normal">Name</p>
            <SortIcon column="name" />
          </div>
          <div className="flex items-start w-[140px] shrink-0">
            <p className="text-[14px] font-bold text-black leading-normal">Phone</p>
          </div>
          <div className="flex gap-2 items-center w-[159px] shrink-0">
            <p className="text-[14px] font-bold text-black leading-normal">Email</p>
            <SortIcon column="email" />
          </div>
          <p className="text-[14px] font-bold text-black leading-normal w-[96px] shrink-0">List</p>
          <div className="flex gap-2 items-start w-[86px] shrink-0">
            <p className="text-[14px] font-bold text-black leading-normal">Status</p>
            <SortIcon column="status" />
          </div>
          <p className="text-[14px] font-bold text-black leading-normal w-[87px] shrink-0">Total Calls</p>
          <p className="text-[14px] font-bold text-black leading-normal w-[75px] shrink-0">Last Call</p>
          <p className="text-[14px] font-bold text-black leading-normal w-[81px] shrink-0">Last Call Duration</p>
          <p className="text-[14px] font-bold text-black leading-normal w-[63px] shrink-0">End Reason</p>
        </div>

        {/* Data Rows */}
        <div className="bg-white">
          {calls.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p className="text-[14px] font-medium text-[#737373]">No contacts found</p>
            </div>
          ) : (
            calls.map((contact, index) => (
              <div
                key={contact.id}
                className={`flex gap-4 items-center justify-center p-4 ${
                  index !== calls.length - 1 ? 'border-b border-[#e5e5e5]' : ''
                } ${index % 2 === 0 ? 'bg-white' : 'bg-[#f8f8f8]'}`}
              >
                <div className="flex items-start w-[140px] shrink-0">
                  <p className="text-[14px] font-medium text-black leading-normal text-center">
                    {contact.name}
                  </p>
                </div>
                <div className="flex items-start w-[140px] shrink-0">
                  <p className="text-[14px] font-medium text-black leading-normal">
                    {contact.phone}
                  </p>
                </div>
                <div className="flex items-center w-[159px] shrink-0">
                  <p className="text-[14px] font-medium text-black leading-normal">
                    {contact.email}
                  </p>
                </div>
                <div className="flex items-center w-[96px] shrink-0">
                  <p className="text-[14px] font-medium text-black leading-normal">
                    {contact.list}
                  </p>
                </div>
                <div className="flex items-start w-[93px] shrink-0">
                  <div className="bg-[#ebf9f1] flex items-center justify-center px-3 py-2 rounded-[22px]">
                    <p className="text-[12px] font-medium text-[#1f9254] leading-normal">
                      {contact.status}
                    </p>
                  </div>
                </div>
                <div className="flex flex-1 items-center min-w-0 shrink-0">
                  <p className="text-[14px] font-medium text-black leading-normal">
                    {contact.totalCalls}
                  </p>
                </div>
                <div className="flex flex-1 items-center min-w-0 shrink-0">
                  <p className="text-[14px] font-medium text-black leading-normal">
                    {contact.lastCall || '-'}
                  </p>
                </div>
                <div className="flex flex-1 items-center min-w-0 shrink-0">
                  <p className="text-[14px] font-medium text-black leading-normal">
                    {contact.lastCallDuration || '-'}
                  </p>
                </div>
                <div className="flex flex-1 items-center min-w-0 shrink-0">
                  <p className="text-[14px] font-medium text-black leading-normal">
                    {contact.endReason || '-'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentCallsTable;
