import { ActivityLog } from '../types';
import { History, UserCheck, Search } from 'lucide-react';
import { useState } from 'react';

interface ActivityLogViewProps {
  logs: ActivityLog[];
}

export default function ActivityLogView({ logs }: ActivityLogViewProps) {
  const [search, setSearch] = useState('');

  const filteredLogs = logs.filter(
    (l) =>
      l.user_name.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.user_role.toLowerCase().includes(search.toLowerCase()) ||
      l.details.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="neu-flat p-6 rounded-3xl border border-white/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">
            System Activity & Audit Log
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Traceability trail for security, user actions, inventory edits, and sales confirmations.
          </p>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search activity, user, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full neu-input pl-9 pr-3.5 py-2 rounded-xl text-xs text-slate-800 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Log list */}
      <div className="neu-flat p-6 rounded-3xl border border-white/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <th className="pb-3 pl-2">User</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Action</th>
                <th className="pb-3">Details</th>
                <th className="pb-3 pr-2 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                    No activity logs recorded yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-200/30 transition-colors">
                    <td className="py-3.5 pl-2">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{log.user_name}</span>
                      </div>
                    </td>

                    <td className="py-3.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700">
                        {log.user_role}
                      </span>
                    </td>

                    <td className="py-3.5">
                      <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-mono text-[11px]">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3.5 text-slate-600 font-sans max-w-sm truncate">
                      {log.details}
                    </td>

                    <td className="py-3.5 pr-2 text-right font-mono text-slate-400 text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
