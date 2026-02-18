'use client';

import { useAuth } from './AuthProvider';
import { Users } from 'lucide-react';
import ScheduleCalendar from './ScheduleCalendar';

export default function UserDashboard() {
    const { user } = useAuth();

    if (!user) return <div className="flex h-screen items-center justify-center text-red-500">Eroare: Utilizator neidentificat. Asigura-te ca accesezi din GHL.</div>;

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-zinc-100 dark:border-zinc-800 gap-6">
                <div className="text-center md:text-left">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Salut, {user?.userName}
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-lg mt-2">
                        Gestionează programul tău de lucru
                    </p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="text-center md:text-right hidden md:block">
                        <div className="text-4xl font-mono font-medium text-zinc-800 dark:text-zinc-200">
                            {new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-zinc-400 text-sm uppercase tracking-wide mt-1">
                            {new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                    </div>

                    <a
                        href="/team"
                        className="group flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transform hover:-translate-y-1"
                    >
                        <div className="bg-white/20 p-2 rounded-lg group-hover:scale-110 transition-transform">
                            <Users className="w-6 h-6" />
                        </div>
                        <span className="text-lg font-bold">Vezi Echipa</span>
                    </a>
                </div>
            </header>

            {/* Main Content - Schedule Only */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-zinc-100 dark:border-zinc-800">
                <ScheduleCalendar
                    userId={user.userId}
                    userName={user.userName || ''}
                    isAdmin={user.role === 'admin'}
                    locationId={user.locationId} // Passing locationId correctly now
                />
            </div>
        </div>
    );
}
