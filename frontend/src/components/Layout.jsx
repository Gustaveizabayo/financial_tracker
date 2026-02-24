import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
    return (
        <div className="app-layout">
            <Sidebar />
            <div className="page-content">
                <Outlet />
            </div>
        </div>
    );
}
