import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { UserPlus, Loader2, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleSubmit = async e => {
        e.preventDefault();
        if (!form.name || !form.email || !form.password) return toast.error('All fields are required.');
        if (form.password.length < 6) return toast.error('Password must be at least 6 characters.');
        if (form.password !== form.confirm) return toast.error('Passwords do not match.');
        setLoading(true);
        try {
            await register(form.name, form.email, form.password);
            toast.success('Account created! Welcome 🎉');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Registration failed.');
        } finally { setLoading(false); }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div style={{ marginBottom: 'var(--sp-xl)', textAlign: 'center' }}>
                    <div className="auth-logo">⬡ SomaBox Financial</div>
                    <p style={{ marginTop: 8 }}>Create your free workspace</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-md)' }}>
                    <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input className="form-input" name="name" placeholder="Alice Uwimana" value={form.name} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input className="form-input" type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="form-input" type={show ? 'text' : 'password'} name="password"
                                placeholder="Min. 6 characters" value={form.password} onChange={handleChange}
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
                    <div className="form-group">
                        <label className="form-label">Confirm Password</label>
                        <input
                            className="form-input" type="password" name="confirm"
                            placeholder="Repeat password" value={form.confirm} onChange={handleChange}
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading} style={{ marginTop: 8 }}>
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                        {loading ? 'Creating account…' : 'Create Account'}
                    </button>
                </form>

                <div className="divider" />
                <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Already have an account?{' '}
                    <Link to="/login" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Sign in</Link>
                </p>
            </div>
        </div>
    );
}
