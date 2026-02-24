import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import {
    LayoutDashboard, FolderKanban, Bell, LogOut, Settings,
    TrendingUp, Users, Plus, ChevronRight
} from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [unread, setUnread] = useState(0);

    useEffect(() => {
        api.get('/notifications').then(r => setUnread(r.data.unread_count)).catch(() => { });
        const interval = setInterval(() => {
            api.get('/notifications').then(r => setUnread(r.data.unread_count)).catch(() => { });
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = () => { logout(); navigate('/login'); };

    const navItems = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/projects', icon: FolderKanban, label: 'Projects' },
        { to: '/notifications', icon: Bell, label: 'Notifications', badge: unread },
    ];

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar-logo">
                <div className="sidebar-logo-text"> Mukarushema</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Financial Platform</div>
            </div>

            {/* Nav */}
            <div className="sidebar-section">
                <div className="sidebar-section-label">Navigation</div>
                {navItems.map(({ to, icon: Icon, label, badge }) => (
                    <NavLink
                        key={to} to={to}
                        className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
                    >
                        <div style={{ position: 'relative' }}>
                            <Icon size={18} />
                            {badge > 0 && (
                                <span style={{
                                    position: 'absolute', top: -6, right: -6,
                                    background: 'var(--danger)', color: '#fff',
                                    fontSize: '0.6rem', fontWeight: 700,
                                    width: 16, height: 16, borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>{badge > 9 ? '9+' : badge}</span>
                            )}
                        </div>
                        <span style={{ flex: 1 }}>{label}</span>
                        {badge > 0 && <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                    </NavLink>
                ))}
            </div>

            {/* Quick Action */}
            <div className="sidebar-section">
                <div className="sidebar-section-label">Quick Actions</div>
                <button className="sidebar-item" onClick={() => navigate('/projects/new')}>
                    <Plus size={18} />
                    <span>New Project</span>
                </button>
            </div>

            {/* Bottom: User profile */}
            <div className="sidebar-bottom">
                <div className="flex items-center gap-sm" style={{ padding: '12px', borderRadius: 'var(--r-md)', marginBottom: 4 }}>
                    <Avatar name={user?.name || 'U'} size="md" />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div className="truncate" style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user?.name}</div>
                        <div className="truncate text-xs text-muted">{user?.email}</div>
                    </div>
                </div>
                <button className="sidebar-item" style={{ color: 'var(--danger)' }} onClick={handleLogout}>
                    <LogOut size={16} />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
