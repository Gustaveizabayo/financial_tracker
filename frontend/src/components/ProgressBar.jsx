export default function ProgressBar({ value = 0, className = '' }) {
    const pct = Math.min(100, Math.max(0, value));
    const cls = pct >= 85 ? 'danger' : pct >= 60 ? 'warning' : pct === 100 ? 'success' : '';
    return (
        <div className={`progress-bar ${className}`}>
            <div className={`progress-fill ${cls}`} style={{ width: `${pct}%` }} />
        </div>
    );
}
