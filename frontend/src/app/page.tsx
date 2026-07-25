'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Github, Bot, Webhook, Zap, ArrowRight } from 'lucide-react';
import styles from '../styles/landing.module.css';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user is logged in
    fetch('/api/v1/auth/me')
      .then((res) => {
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => setIsAuthenticated(false));
  }, []);

  return (
    <main className={styles.container}>
      <section className={styles.hero}>
        <div style={{ display: 'inline-flex', padding: '8px 16px', borderRadius: '999px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-color)', fontSize: '0.9rem', fontWeight: 600, gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
          <Bot size={16} /> GitHub Webhook Automation MVP
        </div>
        <h1 className={styles.glowText}>Automate Your Repository Operations Instantly</h1>
        <p className={styles.description}>
          Connect your GitHub repositories, set custom trigger rules, auto-label issues, and dispatch instant Slack team alerts. Fully event-driven.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {isAuthenticated === null ? (
            <div className={styles.card} style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : isAuthenticated ? (
            <div className={styles.card}>
              <h3 style={{ marginBottom: '15px' }}>Session Connected</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                You are currently logged in with your GitHub account.
              </p>
              <Link href="/dashboard" className={styles.btn}>
                Enter Console Dashboard <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <div className={styles.card}>
              <h3 style={{ marginBottom: '15px' }}>Start Automating</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '25px' }}>
                Sign in with GitHub to connect repositories and enable webhook triggers.
              </p>
              <a href="/api/v1/auth/github/login" className={styles.btn}>
                <Github size={20} /> Sign In with GitHub
              </a>
            </div>
          )}
        </div>
      </section>

      <section className={styles.features}>
        <div className={styles.featureCard}>
          <Webhook className={styles.featureIcon} size={28} />
          <h4 className={styles.featureTitle}>Webhook Ingestion</h4>
          <p className={styles.featureDesc}>Ingest, verify, and store GitHub events asynchronously with HMAC signatures and duplicate protection.</p>
        </div>
        <div className={styles.featureCard}>
          <Zap className={styles.featureIcon} size={28} />
          <h4 className={styles.featureTitle}>Action Processor</h4>
          <p className={styles.featureDesc}>Auto-label issues, submit issue comments, and alert your team on Slack dynamically based on issue details.</p>
        </div>
        <div className={styles.featureCard}>
          <Bot className={styles.featureIcon} size={28} />
          <h4 className={styles.featureTitle}>Rule Engine</h4>
          <p className={styles.featureDesc}>Configure trigger policies for issue titles matching tags (e.g. title contains 'bug' → add label 'bug').</p>
        </div>
      </section>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
