import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Task {
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  risk_level: 'low' | 'medium' | 'high';
  start_date: string | null;
  due_date: string | null;
  created_at: string;
}

const priorityLabels: Record<string, string> = {
  p0: '最高',
  p1: '高',
  p2: '中',
  p3: '低'
};

const statusLabels: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
  blocked: '已阻塞'
};

const riskLabels: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高'
};

function Reports() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'tasks' | 'charts'>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTasks = async () => {
      if (!user?.id) {
        console.error('User ID is undefined');
        setError('Failed to load tasks: User not authenticated');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('task_assignees')
          .select(`
            task_id,
            role,
            tasks (
              id,
              title,
              status,
              priority,
              risk_level,
              start_date,
              due_date,
              created_at
            )
          `)
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to load tasks: ${error.message}`);
        // Extract and transform tasks from the joined data
        const assignedTasks = data?.map(item => ({
          ...item.tasks,
          assignee_role: item.role
        })) || [];
        setTasks(assignedTasks);
      } catch (err) {
        console.error('Error loading tasks:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    // Only load tasks if we have a valid user ID
    if (user?.id) {
      loadTasks();
    }
  }, [user]);

  const renderTaskList = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              标题
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              角色
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              状态
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              优先级
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              风险
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              开始时间
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              截止时间
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tasks.map((task) => (
            <tr key={task.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {task.title}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  task.assignee_role === 'owner' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {task.assignee_role === 'owner' ? '负责人' : '协作者'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  task.status === 'completed' ? 'bg-green-100 text-green-800' :
                  task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  task.status === 'blocked' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {statusLabels[task.status]}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  task.priority === 'p0' ? 'bg-red-100 text-red-800' :
                  task.priority === 'p1' ? 'bg-orange-100 text-orange-800' :
                  task.priority === 'p2' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {priorityLabels[task.priority]}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  task.risk_level === 'high' ? 'bg-red-100 text-red-800' :
                  task.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {riskLabels[task.risk_level]}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {task.start_date ? format(new Date(task.start_date), 'MM-dd', { locale: zhCN }) : '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {task.due_date ? format(new Date(task.due_date), 'MM-dd', { locale: zhCN }) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCharts = () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">每周任务活动</h3>
        <BarChart width={340} height={240} data={[
          { name: '周一', tasks: 4 },
          { name: '周二', tasks: 3 },
          { name: '周三', tasks: 7 },
          { name: '周四', tasks: 5 },
          { name: '周五', tasks: 6 },
        ]}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="tasks" name="任务数" fill="#3B82F6" />
        </BarChart>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4">本周概览</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600">总任务数</p>
            <p className="text-2xl font-bold text-blue-700">25</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600">已完成</p>
            <p className="text-2xl font-bold text-green-700">18</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full bg-white rounded-lg shadow-md overflow-hidden">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
              activeTab === 'tasks'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            我的任务
          </button>
          <button
            onClick={() => setActiveTab('charts')}
            className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm ${
              activeTab === 'charts'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            统计图表
          </button>
        </nav>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-red-600 text-center">{error}</div>
        ) : activeTab === 'tasks' ? (
          renderTaskList()
        ) : (
          renderCharts()
        )}
      </div>
    </div>
  );
}


export default Reports