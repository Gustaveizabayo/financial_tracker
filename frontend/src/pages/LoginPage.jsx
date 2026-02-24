import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleSubmit = async e => {
        e.preventDefault();
        if (!form.email || !form.password) return toast.error('Please fill in all fields.');
        setLoading(true);
        try {
            await login(form.email, form.password);
            toast.success('Welcome back! 👋');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed. Please try again.');
        } finally { setLoading(false); }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                {/* Header */}
                <div style={{ marginBottom: 'var(--sp-xl)', textAlign: 'center' }}>
                    <div className="auth-logo"> Valantine Financial App </div>
                    <p style={{ marginTop: 8 }}>Sign in to your workspace</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            className="form-input" type="email" name="email"
                            placeholder="you@example.com" autoComplete="email"
                            value={form.email} onChange={handleChange}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="form-input" type={show ? 'text' : 'password'} name="password"
                                placeholder="Enter your password" autoComplete="current-password"
                                value={form.password} onChange={handleChange}
                                style={{ paddingRight: 44 }}
                            />
                            <button type="button" onClick={() => setShow(s => !s)} style={{
                                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex',
                            }}>
                                {show ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading} style={{ marginTop: 8 }}>
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                        {loading ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>

                <div className="divider" />



                <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Don't have an account?{' '}
                    <Link to="/register" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Create one</Link>
                </p>
            </div>
        </div>
    );
}
