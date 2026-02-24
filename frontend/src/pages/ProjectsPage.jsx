import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import ProgressBar from '../components/ProgressBar';
import { Plus, Search, FolderKanban, Loader2, Trash2, Calendar, Users, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

const fmt = n => Number(n || 0).toLocaleString();

export default function ProjectsPage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(false);

    const load = async () => {
        try { const r = await api.get('/projects'); setProjects(r.data); }
        catch (e) { toast.error('Failed to load projects.'); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const filtered = projects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="page-body animate-fade-in">
            <div className="page-header flex items-center justify-between">
                <div>
                    <h1>Projects</h1>
                    <p>Manage all your collaborative workspaces</p>
                </div>
                <button className="btn btn-primary" onClick={() => setModal(true)}>
                    <Plus size={16} /> New Project
                </button>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 'var(--sp-xl)', maxWidth: 400 }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                    className="form-input" placeholder="Search projects…"
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{ paddingLeft: 40 }}
                />
            </div>

            {loading ? (
                <div className="grid-auto">
                    {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 'var(--r-lg)' }} />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><FolderKanban size={28} /></div>
                    <h3>{search ? 'No projects found' : 'No projects yet'}</h3>
                    <p>{search ? 'Try a different search term.' : 'Create your first project to start collaborating.'}</p>
                    {!search && <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={16} /> Create Project</button>}
                </div>
            ) : (
                <div className="grid-auto">
                    {filtered.map(p => (
                        <ProjectCard
                            key={p.id} project={p}
                            onClick={() => navigate(`/projects/${p.id}`)}
                            onDelete={() => { setProjects(ps => ps.filter(x => x.id !== p.id)); }}
                        />
                    ))}
                </div>
            )}

            {modal && <NewProjectModal onClose={() => setModal(false)} onCreated={p => { setProjects(ps => [p, ...ps]); setModal(false); navigate(`/projects/${p.id}`); }} />}
        </div>
    );
}

function ProjectCard({ project, onClick, onDelete }) {
    const total = parseFloat(project.total_budget || 0);
    const used = parseFloat(project.used_budget || 0);
    const tasks = parseInt(project.task_count || 0);
    const done = parseInt(project.completed_tasks || 0);
    const progress = tasks > 0 ? Math.round((done / tasks) * 100) : 0;
    const budget = total > 0 ? Math.round((used / total) * 100) : 0;

    const handleDelete = async e => {
        e.stopPropagation();
        if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/projects/${project.id}`);
            toast.success('Project deleted.');
            onDelete();
        } catch (err) { toast.error(err.response?.data?.message || 'Delete failed.'); }
    };

    return (
        <div className="card" onClick={onClick} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
            {/* Header */}
            <div className="flex items-start justify-between gap-sm">
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <h3 className="truncate" style={{ fontSize: '1rem', marginBottom: 4 }}>{project.name}</h3>
                    {project.description && (
                        <p className="truncate" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{project.description}</p>
                    )}
                </div>
                {project.user_role === 'owner' && (
                    <button className="btn-icon" onClick={handleDelete} title="Delete project">
                        <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                    </button>
                )}
            </div>

            {/* Role badge */}
            <span className={`badge badge-${project.user_role}`} style={{ alignSelf: 'flex-start' }}>
                {project.user_role}
            </span>

            {/* Progress */}
            <div>
                <div className="flex justify-between text-xs text-muted" style={{ marginBottom: 4 }}>
                    <span>Task Progress</span><span>{progress}% ({done}/{tasks})</span>
                </div>
                <ProgressBar value={progress} />
            </div>

            {/* Budget */}
            <div>
                <div className="flex justify-between text-xs text-muted" style={{ marginBottom: 4 }}>
                    <span>Budget Used</span>
                    <span style={{ color: budget >= 80 ? 'var(--danger)' : budget >= 60 ? 'var(--warning)' : undefined }}>
                        {budget}% of {fmt(total)} RWF
                    </span>
                </div>
                <ProgressBar value={budget} />
            </div>

            {/* Meta */}
            <div className="flex items-center gap-md text-xs text-muted" style={{ marginTop: 'auto' }}>
                <span><Users size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />{project.member_count}</span>
                {project.due_date && <span><Calendar size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />{new Date(project.due_date).toLocaleDateString()}</span>}
            </div>
        </div>
    );
}

function NewProjectModal({ onClose, onCreated }) {
    const [form, setForm] = useState({ name: '', description: '', total_budget: '', currency: 'RWF', due_date: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async e => {
        e.preventDefault();
        if (!form.name) return toast.error('Project name is required.');
        setLoading(true);
        try {
            const r = await api.post('/projects', form);
            toast.success('Project created! 🎉');
            onCreated(r.data);
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to create project.'); }
        finally { setLoading(false); }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Create New Project</h2>
                    <button className="btn-icon" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
                    <div className="form-group">
                        <label className="form-label">Project Name *</label>
                        <input className="form-input" placeholder="e.g. Community Event 2024" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea className="form-textarea" placeholder="What is this project about?" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)' }}>
                        <div className="form-group">
                            <label className="form-label">Total Budget</label>
                            <input className="form-input" type="number" min="0" placeholder="e.g. 300000" value={form.total_budget} onChange={e => setForm(p => ({ ...p, total_budget: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Currency</label>
                            <select className="form-select" value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
                                <option value="RWF">RWF</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="KES">KES</option>
                                <option value="UGX">UGX</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Due Date</label>
                        <input className="form-input" type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            {loading ? 'Creating…' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
