import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Avatar from '../components/Avatar';
import ProgressBar from '../components/ProgressBar';
import {
    FolderKanban, TrendingUp, DollarSign, Users,
    AlertTriangle, Clock, ArrowRight, Plus, Activity
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const fmt = n => Number(n || 0).toLocaleString();

export default function DashboardPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [activities, setActivities] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [pRes, nRes] = await Promise.all([
                    api.get('/projects'),
                    api.get('/notifications/dashboard'),
                ]);
                setProjects(pRes.data);
                setSummary(nRes.data);

                // Collect recent activities from first project
                if (pRes.data.length > 0) {
                    const actRes = await api.get(`/projects/${pRes.data[0].id}/activities`);
                    setActivities(actRes.data.slice(0, 8));
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, []);

    const totalBudget = projects.reduce((s, p) => s + parseFloat(p.total_budget || 0), 0);
    const totalUsed = projects.reduce((s, p) => s + parseFloat(p.used_budget || 0), 0);
    const totalTasks = projects.reduce((s, p) => s + parseInt(p.task_count || 0), 0);
    const completedTasks = projects.reduce((s, p) => s + parseInt(p.completed_tasks || 0), 0);

    if (loading) return (
        <div className="page-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-lg)', marginBottom: 'var(--sp-xl)' }}>
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--r-lg)' }} />
                ))}
            </div>
        </div>
    );

    return (
        <div className="page-body animate-fade-in">
            {/* Header */}
            <div className="page-header flex items-center justify-between">
                <div>
                    <h1>Good morning, {user?.name?.split(' ')[0]} 👋</h1>
                    <p>Here's what's happening with your projects today.</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/projects/new')}>
                    <Plus size={16} /> New Project
                </button>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-lg)', marginBottom: 'var(--sp-xl)' }}>
                <StatCard icon={<FolderKanban size={20} />} label="Active Projects" value={projects.length} color="var(--brand-primary)" />
                <StatCard icon={<TrendingUp size={20} />} label="Tasks Completed" value={`${completedTasks}/${totalTasks}`} color="var(--success)" />
                <StatCard icon={<DollarSign size={20} />} label="Total Budget" value={`${fmt(totalBudget)} RWF`} color="var(--warning)" small />
                <StatCard icon={<DollarSign size={20} />} label="Budget Used" value={`${fmt(totalUsed)} RWF`} color="#8B5CF6" small />
            </div>

            {/* Two-column layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 'var(--sp-xl)', alignItems: 'start' }}>
                {/* Projects list */}
                <div>
                    <div className="flex items-center justify-between" style={{ marginBottom: 'var(--sp-md)' }}>
                        <h2 style={{ fontSize: '1.1rem' }}>Your Projects</h2>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/projects')}>
                            View all <ArrowRight size={14} />
                        </button>
                    </div>

                    {projects.length === 0 ? (
                        <div className="empty-state card">
                            <div className="empty-state-icon"><FolderKanban size={28} /></div>
                            <h3>No projects yet</h3>
                            <p>Create your first project to get started tracking tasks and budgets.</p>
                            <button className="btn btn-primary" onClick={() => navigate('/projects/new')}>
                                <Plus size={16} /> Create Project
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
                            {projects.slice(0, 5).map(p => <ProjectRow key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />)}
                        </div>
                    )}
                </div>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
                    {/* Due Soon */}
                    {summary?.tasks_due_soon?.length > 0 && (
                        <div className="card">
                            <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--sp-md)' }}>
                                <Clock size={16} style={{ color: 'var(--warning)' }} />
                                <h3 style={{ fontSize: '0.95rem' }}>Due Soon</h3>
                            </div>
                            {summary.tasks_due_soon.map((t, i) => (
                                <div key={i} className="flex items-center gap-sm" style={{
                                    padding: '8px 0', borderBottom: i < summary.tasks_due_soon.length - 1 ? '1px solid var(--border)' : 'none',
                                }}>
                                    <AlertTriangle size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div className="truncate" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.title}</div>
                                        <div className="text-xs text-muted">{t.project_name}</div>
                                    </div>
                                    <div className="text-xs text-warning">{new Date(t.due_date).toLocaleDateString()}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Activity Feed */}
                    <div className="card">
                        <div className="flex items-center gap-sm" style={{ marginBottom: 'var(--sp-md)' }}>
                            <Activity size={16} style={{ color: 'var(--brand-primary)' }} />
                            <h3 style={{ fontSize: '0.95rem' }}>Recent Activity</h3>
                        </div>
                        {activities.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No activity yet.</p>
                        ) : activities.map((a, i) => (
                            <div key={a.id} className="flex gap-sm" style={{
                                padding: '8px 0', borderBottom: i < activities.length - 1 ? '1px solid var(--border)' : 'none',
                            }}>
                                <Avatar name={a.user_name || '?'} size="sm" />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.82rem' }}>
                                        <strong style={{ color: 'var(--text-primary)' }}>{a.user_name}</strong>{' '}
                                        <span style={{ color: 'var(--text-secondary)' }}>{a.action}</span>
                                    </div>
                                    <div className="text-xs text-muted">
                                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, color, small }) {
    return (
        <div className="stat-card">
            <div className="stat-icon" style={{ color }}>{icon}</div>
            <div className="stat-label">{label}</div>
            <div className={`stat-value ${small ? 'text-lg' : ''}`}
                style={{ fontSize: small ? '1.2rem' : undefined, color }}>
                {value}
            </div>
        </div>
    );
}

function ProjectRow({ project, onClick }) {
    const total = parseFloat(project.total_budget || 0);
    const used = parseFloat(project.used_budget || 0);
    const tasks = parseInt(project.task_count || 0);
    const done = parseInt(project.completed_tasks || 0);
    const progress = tasks > 0 ? Math.round((done / tasks) * 100) : 0;
    const budget = total > 0 ? Math.round((used / total) * 100) : 0;

    return (
        <div className="card" onClick={onClick}
            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-brand)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--sp-sm)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{project.name}</h3>
                <span className={`badge badge-${project.status === 'active' ? 'progress' : 'todo'}`}>
                    {project.status}
                </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)', marginBottom: 'var(--sp-sm)' }}>
                <div>
                    <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Progress — {progress}%</div>
                    <ProgressBar value={progress} />
                </div>
                <div>
                    <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Budget — {budget}%</div>
                    <ProgressBar value={budget} />
                </div>
            </div>
            <div className="flex items-center gap-md text-xs text-muted">
                <span>📋 {done}/{tasks} tasks</span>
                <span>💰 {Number(project.total_budget || 0).toLocaleString()} RWF</span>
                <span>👥 {project.member_count} members</span>
            </div>
        </div>
    );
}
