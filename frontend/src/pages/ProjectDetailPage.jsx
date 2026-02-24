import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import ProgressBar from '../components/ProgressBar';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Plus, Loader2, Trash2, CheckCircle2,
    Clock, AlertTriangle, DollarSign, Users, Activity,
    Kanban, X, MessageSquare, Calendar,
    TrendingUp
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const fmt = n => Number(n || 0).toLocaleString();

const COLUMNS = [
    { id: 'todo', label: 'To Do', color: 'var(--text-muted)', bg: 'var(--bg-base)' },
    { id: 'in_progress', label: 'In Progress', color: 'var(--brand-primary)', bg: 'var(--brand-soft)' },
    { id: 'completed', label: 'Completed', color: 'var(--success)', bg: 'var(--accent-green)' },
];

export default function ProjectDetailPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [members, setMembers] = useState([]);
    const [activities, setActs] = useState([]);
    const [budget, setBudget] = useState(null);
    const [tab, setTab] = useState('board');
    const [loading, setLoading] = useState(true);
    const [isLive, setIsLive] = useState(true);

    const [taskModal, setTaskModal] = useState(null); // null | 'new' | taskObj
    const [expenseModal, setExpenseModal] = useState(false);
    const [memberModal, setMemberModal] = useState(false);

    const myRole = members.find(m => m.id === user?.id)?.role || 'viewer';
    const canEdit = ['owner', 'admin', 'editor'].includes(myRole);

    // ── Load ────────────────────────────────────────────────────────────────────
    const loadAll = async () => {
        try {
            const [pRes, tRes, eRes, mRes, aRes] = await Promise.all([
                api.get(`/projects/${id}`),
                api.get(`/projects/${id}/tasks`),
                api.get(`/projects/${id}/expenses`),
                api.get(`/projects/${id}/members`),
                api.get(`/projects/${id}/activities`),
            ]);
            setProject(pRes.data);
            setTasks(tRes.data);
            setExpenses(eRes.data.expenses);
            setBudget(eRes.data.summary);
            setMembers(mRes.data);
            setActs(aRes.data);
        } catch (e) { toast.error('Failed to load project.'); navigate('/projects'); }
        finally { setLoading(false); }
    };

    const loadSilent = async () => {
        try {
            const [pRes, tRes, eRes, aRes] = await Promise.all([
                api.get(`/projects/${id}`),
                api.get(`/projects/${id}/tasks`),
                api.get(`/projects/${id}/expenses`),
                api.get(`/projects/${id}/activities`),
            ]);
            setProject(pRes.data);
            setTasks(tRes.data);
            setExpenses(eRes.data.expenses);
            setBudget(eRes.data.summary);
            setActs(aRes.data);
        } catch (e) { console.warn('Refresh failed'); }
    };

    useEffect(() => { loadAll(); }, [id]);

    useEffect(() => {
        if (!isLive) return;
        const interval = setInterval(loadSilent, 15000); // Polling every 15s
        return () => clearInterval(interval);
    }, [isLive, id]);

    // ── Drag & Drop ─────────────────────────────────────────────────────────────
    const dragTask = useRef(null);
    const handleDragStart = (task) => { dragTask.current = task; };
    const handleDrop = async (colId) => {
        const task = dragTask.current;
        if (!task || task.status === colId) return;
        const updated = { ...task, status: colId };
        setTasks(ts => ts.map(t => t.id === task.id ? updated : t));
        try {
            await api.put(`/projects/${id}/tasks/${task.id}`, { status: colId });
            toast.success(`Moved to ${COLUMNS.find(c => c.id === colId)?.label}`);
        } catch { setTasks(ts => ts.map(t => t.id === task.id ? task : t)); toast.error('Move failed.'); }
        dragTask.current = null;
    };

    // ── Delete Task ─────────────────────────────────────────────────────────────
    const deleteTask = async (taskId, title) => {
        if (!confirm(`Delete "${title}"?`)) return;
        try {
            await api.delete(`/projects/${id}/tasks/${taskId}`);
            setTasks(ts => ts.filter(t => t.id !== taskId));
            toast.success('Task deleted.');
        } catch { toast.error('Delete failed.'); }
    };

    if (loading) return (
        <div className="page-body">
            <div style={{ display: 'flex', gap: 'var(--sp-md)', marginBottom: 'var(--sp-xl)' }}>
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ flex: 1, height: 300, borderRadius: 'var(--r-lg)' }} />)}
            </div>
        </div>
    );

    const tasksByCol = (colId) => tasks.filter(t => t.status === colId);
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(t => t.status === 'completed').length;
    const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    return (
        <div className="page-body animate-fade-in">
            {/* Top Bar */}
            <div className="flex items-center gap-md" style={{ marginBottom: 'var(--sp-lg)' }}>
                <button className="btn-icon" onClick={() => navigate('/projects')}><ArrowLeft size={18} /></button>
                <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-sm">
                        <h1 style={{ fontSize: '1.4rem' }}>{project?.name}</h1>
                        {isLive && <span className="badge badge-progress animate-pulse" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>● LIVE</span>}
                    </div>
                    {project?.description && <p style={{ margin: 0, fontSize: '0.875rem' }}>{project.description}</p>}
                </div>
                <div className="flex items-center gap-sm">
                    {members.slice(0, 4).map(m => <Avatar key={m.id} name={m.name} size="sm" />)}
                    {members.length > 4 && <span className="text-xs text-muted">+{members.length - 4}</span>}
                </div>
            </div>

            {/* Budget Summary Bar */}
            {budget && (
                <div className="budget-summary" style={{ marginBottom: 'var(--sp-xl)' }}>
                    <div className="budget-grid" style={{ marginBottom: 'var(--sp-md)' }}>
                        <BudgetItem label="Total Budget" value={`${fmt(budget.total_budget)} ${project?.currency}`} color="var(--text-primary)" />
                        <BudgetItem label="Used" value={`${fmt(budget.used_budget)} ${project?.currency}`} color="var(--warning)" />
                        <BudgetItem label="Remaining" value={`${fmt(budget.remaining)} ${project?.currency}`} color={budget.remaining < 0 ? 'var(--danger)' : 'var(--success)'} />
                        <BudgetItem label="Task Progress" value={`${progress}%`} color="var(--brand-primary)" />
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-muted" style={{ marginBottom: 4 }}>
                            <span>Budget used — {budget.percent_used}%</span>
                            {budget.percent_used >= 80 && <span style={{ color: 'var(--danger)' }}>⚠️ Near limit</span>}
                        </div>
                        <ProgressBar value={budget.percent_used} />
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: 'var(--sp-xl)' }}>
                {[
                    { id: 'board', label: '📋 Board', icon: Kanban },
                    { id: 'budget', label: '💰 Budget', icon: DollarSign },
                    { id: 'members', label: `👥 Members (${members.length})`, icon: Users },
                    { id: 'activity', label: '📡 Activity', icon: Activity },
                ].map(t => (
                    <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── BOARD TAB ── */}
            {tab === 'board' && (
                <>
                    <div className="flex justify-end" style={{ marginBottom: 'var(--sp-md)' }}>
                        {canEdit && (
                            <button className="btn btn-primary btn-sm" onClick={() => setTaskModal('new')}>
                                <Plus size={14} /> Add Task
                            </button>
                        )}
                    </div>
                    <div className="board-columns">
                        {COLUMNS.map(col => (
                            <div key={col.id} className="board-column"
                                onDragOver={e => e.preventDefault()}
                                onDrop={() => handleDrop(col.id)}
                            >
                                <div className="board-column-header" style={{ borderTop: `3px solid ${col.color}` }}>
                                    <span className="board-column-title" style={{ color: col.color }}>{col.label}</span>
                                    <span className="board-column-count">{tasksByCol(col.id).length}</span>
                                </div>
                                <div className="board-column-body">
                                    {tasksByCol(col.id).length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: 'var(--sp-lg)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            Drop tasks here
                                        </div>
                                    ) : tasksByCol(col.id).map(task => (
                                        <TaskCard
                                            key={task.id} task={task} canEdit={canEdit}
                                            onDragStart={() => handleDragStart(task)}
                                            onClick={() => setTaskModal(task)}
                                            onDelete={() => deleteTask(task.id, task.title)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ── BUDGET TAB ── */}
            {tab === 'budget' && (
                <BudgetTab
                    expenses={expenses} budget={budget} project={project} members={members}
                    canEdit={canEdit} projectId={id}
                    onNew={() => setExpenseModal(true)}
                    onDelete={expId => setExpenses(es => es.filter(e => e.id !== expId))}
                />
            )}

            {/* ── MEMBERS TAB ── */}
            {tab === 'members' && (
                <MembersTab
                    members={members} myRole={myRole} projectId={id}
                    onRefresh={loadAll}
                    onInvite={() => setMemberModal(true)}
                />
            )}

            {/* ── ACTIVITY TAB ── */}
            {tab === 'activity' && (
                <ActivityTab activities={activities} />
            )}

            {/* ── Modals ── */}
            {taskModal && (
                <TaskModal
                    task={taskModal === 'new' ? null : taskModal}
                    projectId={id} members={members}
                    onClose={() => setTaskModal(null)}
                    onSaved={t => {
                        if (taskModal === 'new') setTasks(ts => [t, ...ts]);
                        else setTasks(ts => ts.map(x => x.id === t.id ? t : x));
                        setTaskModal(null);
                    }}
                />
            )}
            {expenseModal && (
                <ExpenseModal
                    projectId={id} tasks={tasks} members={members}
                    onClose={() => setExpenseModal(false)}
                    onSaved={e => { setExpenses(es => [e, ...es]); setExpenseModal(false); loadAll(); }}
                />
            )}
            {memberModal && (
                <InviteModal
                    projectId={id}
                    onClose={() => setMemberModal(false)}
                    onSaved={m => { setMembers(ms => [...ms, m]); setMemberModal(false); }}
                />
            )}
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BudgetItem({ label, value, color }) {
    return (
        <div className="budget-item">
            <div className="budget-label">{label}</div>
            <div className="budget-value" style={{ color }}>{value}</div>
        </div>
    );
}

function TaskCard({ task, canEdit, onDragStart, onClick, onDelete }) {
    const priorityColor = task.priority === 'high' ? 'var(--danger)' : task.priority === 'medium' ? 'var(--warning)' : 'var(--success)';
    return (
        <div
            className="task-card" draggable={canEdit}
            onDragStart={onDragStart} onClick={onClick}
            style={{ position: 'relative', paddingLeft: 16 }}
        >
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: priorityColor, borderRadius: '4px 0 0 4px' }} />
            <div className="task-card-title">{task.title}</div>
            <div className="task-card-meta">
                {task.assigned_to_name && <Avatar name={task.assigned_to_name} size="sm" />}
                <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                {task.due_date && (
                    <span className="text-xs text-muted">
                        <Clock size={10} style={{ marginRight: 2, verticalAlign: 'middle' }} />
                        {format(new Date(task.due_date), 'MMM d')}
                    </span>
                )}
            </div>
            {task.progress > 0 && (
                <div>
                    <div className="flex justify-between text-xs text-muted" style={{ marginBottom: 2 }}>
                        <span>Progress</span><span>{task.progress}%</span>
                    </div>
                    <ProgressBar value={task.progress} />
                </div>
            )}
            {parseFloat(task.cost_used) > 0 && (
                <div className="task-card-cost">💰 {fmt(task.cost_used)} RWF</div>
            )}
            {canEdit && (
                <button className="btn-icon" style={{ position: 'absolute', top: 8, right: 8, padding: 4 }}
                    onClick={e => { e.stopPropagation(); onDelete(); }}>
                    <Trash2 size={12} style={{ color: 'var(--danger)' }} />
                </button>
            )}
        </div>
    );
}

function BudgetTab({ expenses, budget, project, canEdit, projectId, onNew, onDelete }) {
    const handleDelete = async (id) => {
        if (!confirm('Delete this expense?')) return;
        try {
            await api.delete(`/projects/${projectId}/expenses/${id}`);
            onDelete(id);
            toast.success('Expense deleted.');
        } catch { toast.error('Delete failed.'); }
    };

    const categories = {};
    expenses.forEach(e => {
        categories[e.category] = (categories[e.category] || 0) + parseFloat(e.amount);
    });

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--sp-xl)', alignItems: 'start' }}>
            {/* Expense list */}
            <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--sp-md)' }}>
                    <h2 style={{ fontSize: '1rem' }}>Expense History</h2>
                    {canEdit && <button className="btn btn-primary btn-sm" onClick={onNew}><Plus size={14} /> Add Expense</button>}
                </div>

                {expenses.length === 0 ? (
                    <div className="empty-state card">
                        <div className="empty-state-icon"><DollarSign size={28} /></div>
                        <h3>No expenses yet</h3>
                        <p>Record expenses to track your budget usage.</p>
                    </div>
                ) : (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-glass)' }}>
                                    {['Description', 'Category', 'Task', 'Date', 'Amount', 'By', ''].map((h, i) => (
                                        <th key={i} style={{ padding: '10px 16px', textAlign: i === 5 ? 'right' : 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map((e, i) => (
                                    <tr key={e.id} style={{ borderBottom: i < expenses.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                        <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 500 }}>{e.description}</td>
                                        <td style={{ padding: '12px 16px' }}><span className="badge badge-todo">{e.category}</span></td>
                                        <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.task_title || '—'}</td>
                                        <td style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{format(new Date(e.date), 'MMM d, yyyy')}</td>
                                        <td style={{ padding: '12px 16px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--warning)' }}>{fmt(e.amount)}</td>
                                        <td style={{ padding: '12px 16px' }}><Avatar name={e.created_by_name} size="sm" /></td>
                                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                                            {canEdit && (
                                                <button className="btn-icon" onClick={() => handleDelete(e.id)}>
                                                    <Trash2 size={13} style={{ color: 'var(--danger)' }} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Categories sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
                <div className="card">
                    <h3 style={{ fontSize: '0.95rem', marginBottom: 'var(--sp-md)' }}>Category Breakdown</h3>
                    {Object.entries(categories).length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No expenses yet.</p>
                    ) : Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
                        <div key={cat} style={{ marginBottom: 12 }}>
                            <div className="flex justify-between text-xs" style={{ marginBottom: 4 }}>
                                <span style={{ fontWeight: 600 }}>{cat}</span>
                                <span style={{ color: 'var(--warning)' }}>{fmt(total)} {project?.currency}</span>
                            </div>
                            <ProgressBar value={budget?.used_budget > 0 ? Math.round((total / budget.used_budget) * 100) : 0} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function MembersTab({ members, myRole, projectId, onRefresh, onInvite }) {
    const canManage = ['owner', 'admin'].includes(myRole);

    const handleRoleChange = async (userId, role) => {
        try {
            await api.put(`/projects/${projectId}/members/${userId}`, { role });
            toast.success('Role updated.');
            onRefresh();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to update role.'); }
    };

    const handleRemove = async (userId, name) => {
        if (!confirm(`Remove ${name} from this project?`)) return;
        try {
            await api.delete(`/projects/${projectId}/members/${userId}`);
            toast.success(`${name} removed.`);
            onRefresh();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to remove member.'); }
    };

    return (
        <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--sp-lg)' }}>
                <h2 style={{ fontSize: '1rem' }}>Team Members ({members.length})</h2>
                {canManage && <button className="btn btn-primary btn-sm" onClick={onInvite}><Plus size={14} /> Invite Member</button>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--sp-md)' }}>
                {members.map(member => (
                    <div key={member.id} className="card flex items-center gap-md">
                        <Avatar name={member.name} size="lg" />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{member.name}</div>
                            <div className="text-xs text-muted truncate">{member.email}</div>
                            <div style={{ marginTop: 4 }}>
                                {canManage && member.role !== 'owner' ? (
                                    <select
                                        className="form-select"
                                        style={{ padding: '2px 28px 2px 8px', fontSize: '0.75rem', width: 'auto', height: 'auto', borderRadius: 'var(--r-sm)' }}
                                        value={member.role}
                                        onChange={e => handleRoleChange(member.id, e.target.value)}
                                    >
                                        {['admin', 'editor', 'viewer'].map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                ) : (
                                    <span className={`badge badge-${member.role}`}>{member.role}</span>
                                )}
                            </div>
                        </div>
                        {canManage && member.role !== 'owner' && (
                            <button className="btn-icon" onClick={() => handleRemove(member.id, member.name)}>
                                <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Roles legend */}
            <div className="card" style={{ marginTop: 'var(--sp-xl)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: 'var(--sp-md)' }}>Roles & Permissions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-md)' }}>
                    {[
                        { role: 'owner', desc: 'Full control including delete project' },
                        { role: 'admin', desc: 'Manage tasks, expenses & members' },
                        { role: 'editor', desc: 'Update tasks and record expenses' },
                        { role: 'viewer', desc: 'View-only access to everything' },
                    ].map(({ role, desc }) => (
                        <div key={role} style={{ display: 'flex', gap: 'var(--sp-sm)', alignItems: 'flex-start' }}>
                            <span className={`badge badge-${role}`}>{role}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{desc}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ActivityTab({ activities }) {
    return (
        <div>
            <h2 style={{ fontSize: '1rem', marginBottom: 'var(--sp-lg)' }}>Activity Timeline</h2>
            {activities.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon"><Activity size={28} /></div><h3>No activity yet</h3></div>
            ) : (
                <div style={{ position: 'relative', paddingLeft: 32 }}>
                    <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: 'var(--border)' }} />
                    {activities.map((a, i) => (
                        <div key={a.id} style={{ position: 'relative', marginBottom: 'var(--sp-lg)' }}>
                            <div style={{
                                position: 'absolute', left: -21, top: 2,
                                width: 8, height: 8, borderRadius: '50%',
                                background: 'var(--brand-primary)', border: '2px solid var(--bg-surface)',
                            }} />
                            <div className="flex items-start gap-sm">
                                <Avatar name={a.user_name || '?'} size="sm" />
                                <div>
                                    <div style={{ fontSize: '0.875rem' }}>
                                        <strong style={{ color: 'var(--text-primary)' }}>{a.user_name}</strong>{' '}
                                        <span style={{ color: 'var(--text-secondary)' }}>{a.action}</span>
                                    </div>
                                    <div className="text-xs text-muted">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Task Modal ────────────────────────────────────────────────────────────────
function TaskModal({ task, projectId, members, onClose, onSaved }) {
    const [form, setForm] = useState({
        title: task?.title || '', description: task?.description || '',
        status: task?.status || 'todo', progress: task?.progress || 0,
        priority: task?.priority || 'medium',
        assigned_to: task?.assigned_to || '',
        due_date: task?.due_date ? task.due_date.split('T')[0] : '',
    });
    const [comments, setComments] = useState([]);
    const [taskExpenses, setTaskExpenses] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingC, setLoadingC] = useState(false);
    const [tab, setTab] = useState('details');

    useEffect(() => {
        if (task?.id) {
            api.get(`/projects/${projectId}/tasks/${task.id}/comments`)
                .then(r => setComments(r.data)).catch(() => { });
            api.get(`/projects/${projectId}/tasks/${task.id}/expenses`)
                .then(r => setTaskExpenses(r.data)).catch(() => { });
        }
    }, [task, projectId]);

    const handleSubmit = async e => {
        e.preventDefault();
        if (!form.title) return toast.error('Title required.');
        setLoading(true);
        try {
            let r;
            if (task?.id) r = await api.put(`/projects/${projectId}/tasks/${task.id}`, form);
            else r = await api.post(`/projects/${projectId}/tasks`, form);
            toast.success(task ? 'Task updated.' : 'Task created.');
            onSaved(r.data);
        } catch (err) { toast.error(err.response?.data?.message || 'Save failed.'); }
        finally { setLoading(false); }
    };

    const postComment = async () => {
        if (!newComment.trim()) return;
        setLoadingC(true);
        try {
            const r = await api.post(`/projects/${projectId}/tasks/${task.id}/comments`, { content: newComment });
            setComments(cs => [...cs, r.data]);
            setNewComment('');
        } catch { toast.error('Failed to post comment.'); }
        finally { setLoadingC(false); }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{task ? 'Edit Task' : 'New Task'}</h2>
                    <button className="btn-icon" onClick={onClose}><X size={16} /></button>
                </div>

                {task?.id && (
                    <div className="tabs" style={{ marginBottom: 'var(--sp-lg)' }}>
                        <button className={`tab ${tab === 'details' ? 'active' : ''}`} onClick={() => setTab('details')}>Details</button>
                        <button className={`tab ${tab === 'comments' ? 'active' : ''}`} onClick={() => setTab('comments')}>
                            Comments ({comments.length})
                        </button>
                        <button className={`tab ${tab === 'expenses' ? 'active' : ''}`} onClick={() => setTab('expenses')}>
                            Expenses ({taskExpenses.length})
                        </button>
                    </div>
                )}

                {tab === 'details' && (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
                        <div className="form-group">
                            <label className="form-label">Title *</label>
                            <input className="form-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Task title…" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-textarea" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the task…" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)' }}>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select className="form-select" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                                    <option value="todo">To Do</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Priority</label>
                                <select className="form-select" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)' }}>
                            <div className="form-group">
                                <label className="form-label">Assign To</label>
                                <select className="form-select" value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                                    <option value="">Unassigned</option>
                                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Due Date</label>
                                <input className="form-input" type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
                            </div>
                        </div>
                        {task && (
                            <div className="form-group">
                                <label className="form-label">Progress — {form.progress}%</label>
                                <input type="range" min={0} max={100} step={5}
                                    value={form.progress}
                                    onChange={e => setForm(p => ({ ...p, progress: parseInt(e.target.value) }))}
                                    style={{ width: '100%', accentColor: 'var(--brand-primary)' }}
                                />
                                <ProgressBar value={form.progress} />
                            </div>
                        )}
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                {loading ? 'Saving…' : task ? 'Save Changes' : 'Create Task'}
                            </button>
                        </div>
                    </form>
                )}

                {tab === 'comments' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)', maxHeight: 300, overflowY: 'auto' }}>
                            {comments.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No comments yet. Start the conversation!</p> : comments.map(c => (
                                <div key={c.id} className="flex gap-sm">
                                    <Avatar name={c.user_name} size="sm" />
                                    <div className="card" style={{ flex: 1, padding: '10px 14px' }}>
                                        <div className="flex justify-between" style={{ marginBottom: 4 }}>
                                            <strong style={{ fontSize: '0.85rem' }}>{c.user_name}</strong>
                                            <span className="text-xs text-muted">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{c.content}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-sm">
                            <input className="form-input" placeholder="Write a comment…" value={newComment} onChange={e => setNewComment(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), postComment())} />
                            <button className="btn btn-primary" onClick={postComment} disabled={loadingC}>
                                {loadingC ? <Loader2 size={14} className="animate-spin" /> : 'Post'}
                            </button>
                        </div>
                    </div>
                )}

                {tab === 'expenses' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
                        <div className="flex items-center justify-between">
                            <h3 style={{ fontSize: '0.9rem' }}>Linked Expenses</h3>
                            <div className="text-sm font-bold text-warning">{fmt(taskExpenses.reduce((s, e) => s + parseFloat(e.amount), 0))} RWF</div>
                        </div>
                        {taskExpenses.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No expenses recorded for this task yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)', maxHeight: 300, overflowY: 'auto' }}>
                                {taskExpenses.map(e => (
                                    <div key={e.id} className="card" style={{ padding: '10px 14px', background: 'var(--bg-glass)' }}>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{e.description}</div>
                                                <div className="text-xs text-muted">{format(new Date(e.date), 'MMM d, yyyy')} • by {e.created_by_name}</div>
                                            </div>
                                            <div style={{ fontWeight: 700, color: 'var(--warning)' }}>{fmt(e.amount)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>To add an expense to this task, use the Budget tab.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Expense Modal ─────────────────────────────────────────────────────────────
function ExpenseModal({ projectId, tasks, onClose, onSaved }) {
    const [form, setForm] = useState({ amount: '', description: '', category: 'General', task_id: '', date: new Date().toISOString().split('T')[0] });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async e => {
        e.preventDefault();
        if (!form.amount || !form.description) return toast.error('Amount and description are required.');
        setLoading(true);
        try {
            const r = await api.post(`/projects/${projectId}/expenses`, form);
            toast.success('Expense recorded! 💰');
            onSaved(r.data);
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to save expense.'); }
        finally { setLoading(false); }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Record Expense</h2>
                    <button className="btn-icon" onClick={onClose}><X size={16} /></button>
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
                    <div className="form-group">
                        <label className="form-label">Description *</label>
                        <input className="form-input" placeholder="e.g. Venue deposit payment" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)' }}>
                        <div className="form-group">
                            <label className="form-label">Amount *</label>
                            <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Category</label>
                            <select className="form-select" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                                {['General', 'Venue', 'Catering', 'Transport', 'Marketing', 'Equipment', 'Printing', 'Accommodation', 'Other'].map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)' }}>
                        <div className="form-group">
                            <label className="form-label">Linked Task</label>
                            <select className="form-select" value={form.task_id} onChange={e => setForm(p => ({ ...p, task_id: e.target.value }))}>
                                <option value="">No task</option>
                                {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Date</label>
                            <input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <Loader2 size={15} className="animate-spin" /> : <DollarSign size={15} />}
                            {loading ? 'Saving…' : 'Record Expense'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Invite Modal ──────────────────────────────────────────────────────────────
function InviteModal({ projectId, onClose, onSaved }) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('editor');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async e => {
        e.preventDefault();
        if (!email) return toast.error('Email is required.');
        setLoading(true);
        try {
            const r = await api.post(`/projects/${projectId}/members`, { email, role });
            toast.success(`${r.data.name} invited as ${role}! 🎉`);
            onSaved(r.data);
        } catch (err) { toast.error(err.response?.data?.message || 'Invite failed.'); }
        finally { setLoading(false); }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Invite Member</h2>
                    <button className="btn-icon" onClick={onClose}><X size={16} /></button>
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
                    <div className="form-group">
                        <label className="form-label">Email Address *</label>
                        <input className="form-input" type="email" placeholder="team@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>The user must already have an account on this platform.</p>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Role</label>
                        <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
                            <option value="admin">Admin — Manage tasks, expenses & members</option>
                            <option value="editor">Editor — Update tasks and record expenses</option>
                            <option value="viewer">Viewer — View-only access</option>
                        </select>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}
                            {loading ? 'Inviting…' : 'Send Invite'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
