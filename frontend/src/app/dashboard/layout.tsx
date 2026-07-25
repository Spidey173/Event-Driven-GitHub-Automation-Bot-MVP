'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Bot, Home, GitFork, LogOut, Loader2 } from 'lucide-react';
import styles from '../../styles/dashboard.module.css';

interface UserProfile {
  github_username: string;
  email: string | null;
  avatar_url: string | null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/auth/me')
      .then((res) => {
        if (!res.ok) {
          router.replace('/');
        } else {
          return res.json();
        }
      })
      .then((data) => {
        if (data) {
          setUser(data);
        }
        setLoading(false);
      })
      .catch(() => {
        router.replace('/');
      });
  }, [router]);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/v1/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.replace('/');
      }
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#070913', color: '#fff' }}>
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary-color)', animation: 'spin 1s linear infinite' }} />
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Bot className={styles.brandIcon} size={28} />
          <span>BotConsole</span>
        </div>
        <nav className={styles.nav}>
          <Link href="/dashboard" className={`${styles.navLink} ${pathname === '/dashboard' ? styles.navLinkActive : ''}`}>
            <Home size={18} /> Overview
          </Link>
          <Link href="/dashboard/repos" className={`${styles.navLink} ${pathname.startsWith('/dashboard/repos') ? styles.navLinkActive : ''}`}>
            <GitFork size={18} /> Repositories
          </Link>
        </nav>
      </aside>
      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.pageTitle}>
            {pathname === '/dashboard' ? 'Analytics Console' : pathname.includes('/rules') ? 'Automation Rules' : 'Repository Connections'}
          </div>
          <div className={styles.userInfo}>
            {user?.avatar_url && (
              <img src={user.avatar_url} alt="GitHub avatar" className={styles.avatar} />
            )}
            <span style={{ fontWeight: 500, fontSize: '0.95rem' }}>{user?.github_username}</span>
            <button className={styles.logoutBtn} onClick={handleLogout}>
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}
