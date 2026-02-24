import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Bell, Check, CheckCheck, Trash2, BellOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const TYPE_ICON = {
    invite: '🎉',
    task_assigned: '📋',
    overdue: '🔴',
    due_soon: '⚠️',
    budget_warning: '💰',
};

export default function NotificationsPage() {
    const [data, setData] = useState({ notifications: [], unread_count: 0 });
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try { const r = await api.get('/notifications'); setData(r.data); }
        catch { toast.error('Failed to load notifications.'); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const markAllRead = async () => {
        await api.put('/notifications/read-all');
        setData(d => ({ ...d, notifications: d.notifications.map(n => ({ ...n, is_read: true })), unread_count: 0 }));
        toast.success('All marked as read.');
    };

    const markRead = async (id) => {
        await api.put(`/notifications/${id}/read`);
        setData(d => ({
            ...d,
            notifications: d.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
            unread_count: Math.max(0, d.unread_count - 1),
        }));
    };

    const deleteNotif = async (id) => {
        await api.delete(`/notifications/${id}`);
        setData(d => ({
            ...d,
            notifications: d.notifications.filter(n => n.id !== id),
            unread_count: d.unread_count - (!d.notifications.find(n => n.id === id)?.is_read ? 1 : 0),
        }));
    };

    if (loading) return (
        <div className="page-body">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 'var(--r-md)', marginBottom: 12 }} />)}
        </div>
    );

    return (
        <div className="page-body animate-fade-in">
            <div className="page-header flex items-center justify-between">
                <div>
                    <h1>Notifications</h1>
                    <p>{data.unread_count} unread notifications</p>
                </div>
                {data.unread_count > 0 && (
                    <button className="btn btn-secondary btn-sm" onClick={markAllRead}>
                        <CheckCheck size={14} /> Mark all read
                    </button>
                )}
            </div>

            {data.notifications.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><BellOff size={28} /></div>
                    <h3>All caught up!</h3>
                    <p>You have no notifications at this time.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
                    {data.notifications.map(n => (
                        <div key={n.id} className="card flex items-center gap-md"
                            style={{
                                opacity: n.is_read ? 0.65 : 1,
                                borderColor: !n.is_read ? 'var(--border-brand)' : 'var(--border)',
                                transition: 'all 0.2s',
                            }}
                        >
                            <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>{TYPE_ICON[n.type] || '🔔'}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: n.is_read ? 400 : 600, fontSize: '0.9rem' }}>{n.message}</div>
                                <div className="flex gap-md text-xs text-muted" style={{ marginTop: 2 }}>
                                    {n.project_name && <span>📁 {n.project_name}</span>}
                                    <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                                </div>
                            </div>
                            <div className="flex gap-xs">
                                {!n.is_read && (
                                    <button className="btn-icon" title="Mark as read" onClick={() => markRead(n.id)}>
                                        <Check size={14} style={{ color: 'var(--success)' }} />
                                    </button>
                                )}
                                <button className="btn-icon" title="Delete" onClick={() => deleteNotif(n.id)}>
                                    <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
