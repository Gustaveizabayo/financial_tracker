// Avatar color palette — deterministic per user
const PALETTE = [
    ['#6366f1', '#4338ca'], ['#a855f7', '#7c3aed'], ['#ec4899', '#be185d'],
    ['#f59e0b', '#b45309'], ['#10b981', '#065f46'], ['#06b6d4', '#0e7490'],
    ['#f87171', '#b91c1c'], ['#34d399', '#047857'], ['#818cf8', '#4338ca'],
];

const colorFor = (str = '') => {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
    return PALETTE[Math.abs(h) % PALETTE.length];
};

export default function Avatar({ name = '?', size = 'md', className = '' }) {
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const [from, to] = colorFor(name);
    return (
        <span
            className={`avatar avatar-${size} ${className}`}
            style={{ background: `linear-gradient(135deg, ${from}, ${to})`, color: '#fff' }}
            title={name}
        >
            {initials}
        </span>
    );
}
