'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GitBranch, Settings, Plus, Check, Loader2, Link2, ExternalLink, Trash2 } from 'lucide-react';
import styles from '../../../styles/dashboard.module.css';

interface ConnectedRepo {
  id: string;
  github_repo_id: number;
  name: string;
  owner: string;
  full_name: string;
  is_active: boolean;
  webhook_id: number | null;
  slack_webhook_url: string | null;
}

interface GitHubRepoOption {
  github_repo_id: number;
  name: string;
  owner: string;
  full_name: string;
  description: string | null;
  private: boolean;
}

export default function ReposPage() {
  const [connectedRepos, setConnectedRepos] = useState<ConnectedRepo[]>([]);
  const [availableRepos, setAvailableRepos] = useState<GitHubRepoOption[]>([]);
  const [activeTab, setActiveTab] = useState<'connected' | 'add'>('connected');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form states to connect a repo
  const [selectedRepoIndex, setSelectedRepoIndex] = useState<number>(-1);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');

  const fetchRepos = async () => {
    try {
      const connRes = await fetch('/api/v1/repos');
      if (connRes.ok) {
        const data = await connRes.json();
        setConnectedRepos(data);
      }
    } catch (e) {
      console.error('Failed to load connected repositories:', e);
    }
  };

  const fetchAvailableGitHubRepos = async () => {
    try {
      const gitRes = await fetch('/api/v1/repos/github');
      if (gitRes.ok) {
        const data = await gitRes.json();
        setAvailableRepos(data);
      }
    } catch (e) {
      console.error('Failed to load GitHub repositories:', e);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchRepos();
      setLoading(false);
    };
    init();
  }, []);

  const handleTabChange = async (tab: 'connected' | 'add') => {
    setActiveTab(tab);
    if (tab === 'add' && availableRepos.length === 0) {
      setLoading(true);
      await fetchAvailableGitHubRepos();
      setLoading(false);
    }
  };

  const handleConnectRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRepoIndex < 0) {
      setErrorMsg('Please select a repository to connect.');
      return;
    }
    
    setErrorMsg('');
    setSubmitting(true);
    const targetRepo = availableRepos[selectedRepoIndex];

    try {
      const res = await fetch('/api/v1/repos/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github_repo_id: targetRepo.github_repo_id,
          name: targetRepo.name,
          owner: targetRepo.owner,
          full_name: targetRepo.full_name,
          slack_webhook_url: slackWebhookUrl || null,
        }),
      });

      if (res.ok) {
        setSlackWebhookUrl('');
        setSelectedRepoIndex(-1);
        await fetchRepos();
        setActiveTab('connected');
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || 'Failed to connect repository.');
      }
    } catch (e) {
      setErrorMsg('Network error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleWebhook = async (id: string, currentlyActive: boolean) => {
    const endpoint = `/api/v1/repos/${id}/${currentlyActive ? 'disable' : 'enable'}`;
    
    // Optimistic UI toggle state updates
    setConnectedRepos((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_active: !currentlyActive } : r))
    );

    try {
      const res = await opPost(endpoint);
      if (!res.ok) {
        // Rollback state on failure
        setConnectedRepos((prev) =>
          prev.map((r) => (r.id === id ? { ...r, is_active: currentlyActive } : r))
        );
        const data = await res.json();
        alert(data.detail || 'Action failed');
      } else {
        await fetchRepos();
      }
    } catch (e) {
      // Rollback
      setConnectedRepos((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_active: currentlyActive } : r))
      );
    }
  };

  const opPost = (url: string) => {
    return fetch(url, { method: 'POST' });
  };

  const handleDisconnectRepo = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this repository and stop all webhook automations?')) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/repos/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        await fetchRepos();
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to disconnect repository.');
      }
    } catch (e) {
      alert('Network error occurred.');
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading repository connections...</div>;
  }

  return (
    <div>
      {/* Panel Tab Toggle */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
        <button 
          style={{ background: 'transparent', border: 'none', color: activeTab === 'connected' ? '#fff' : 'var(--text-secondary)', fontSize: '1rem', fontWeight: 600, paddingBottom: '10px', borderBottom: activeTab === 'connected' ? '2px solid var(--primary-color)' : 'none', cursor: 'pointer' }}
          onClick={() => handleTabChange('connected')}
        >
          Connected Repositories ({connectedRepos.length})
        </button>
        <button 
          style={{ background: 'transparent', border: 'none', color: activeTab === 'add' ? '#fff' : 'var(--text-secondary)', fontSize: '1rem', fontWeight: 600, paddingBottom: '10px', borderBottom: activeTab === 'add' ? '2px solid var(--primary-color)' : 'none', cursor: 'pointer' }}
          onClick={() => handleTabChange('add')}
        >
          Add GitHub Repository
        </button>
      </div>

      {activeTab === 'connected' ? (
        connectedRepos.length === 0 ? (
          <div className={styles.sectionCard} style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <GitBranch size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>No repositories connected yet.</p>
            <button className={styles.submitBtn} onClick={() => handleTabChange('add')}>
              Connect your first repository
            </button>
          </div>
        ) : (
          <div className={styles.repoGrid}>
            {connectedRepos.map((repo) => (
              <div key={repo.id} className={styles.repoCard}>
                <div>
                  <h4 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '6px', wordBreak: 'break-all' }}>
                    {repo.name}
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '15px' }}>
                    Owner: {repo.owner}
                  </p>
                  
                  {repo.slack_webhook_url && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--secondary-color)', background: 'rgba(16, 185, 129, 0.08)', padding: '4px 8px', borderRadius: '4px', width: 'fit-content', marginBottom: '15px' }}>
                      <Link2 size={12} /> Slack Connected
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px', marginTop: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: repo.is_active ? 'var(--secondary-color)' : 'var(--text-muted)' }}>
                      {repo.is_active ? 'MONITORING ACTIVE' : 'INACTIVE'}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      GitHub Webhook status
                    </span>
                  </div>
                  <label className={styles.toggleSwitch}>
                    <input
                      type="checkbox"
                      checked={repo.is_active}
                      onChange={() => handleToggleWebhook(repo.id, repo.is_active)}
                    />
                    <span className={styles.slider}></span>
                  </label>
                </div>

                <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                  <Link href={`/dashboard/repos/${repo.id}/rules`} className={styles.submitBtn} style={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'rgba(99, 102, 241, 0.1)', color: '#fff', border: '1px solid var(--card-border)', fontSize: '0.85rem', padding: '8px 12px' }}>
                    <Settings size={14} /> Rules
                  </Link>
                  <button 
                    onClick={() => handleDisconnectRepo(repo.id)}
                    className={styles.submitBtn} 
                    style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem', padding: '8px 12px' }}
                  >
                    <Trash2 size={14} /> Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Connect Repository Form tab */
        <div className={styles.sectionCard} style={{ maxWidth: '600px' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Connect a Repository</h3>
          {errorMsg && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem 1rem', borderRadius: '6px', color: 'var(--danger-color)', fontSize: '0.9rem', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleConnectRepo}>
            <div className={styles.formGroup}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Select Repository</label>
              <select 
                className={styles.inputField} 
                value={selectedRepoIndex} 
                onChange={(e) => setSelectedRepoIndex(Number(e.target.value))}
                style={{ background: '#0b0e1a' }}
              >
                <option value={-1}>-- Choose an available repository --</option>
                {availableRepos.map((repo, idx) => (
                  <option key={repo.github_repo_id} value={idx}>
                    {repo.full_name} {repo.private ? '(Private)' : '(Public)'}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Slack Incoming Webhook URL (Optional)</label>
              <input
                type="url"
                placeholder="https://hooks.slack.com/services/..."
                className={styles.inputField}
                value={slackWebhookUrl}
                onChange={(e) => setSlackWebhookUrl(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Target channel endpoint to dispatch notifications to.
              </span>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={submitting} style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '1rem' }}>
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> Connecting Repository...
                </>
              ) : (
                <>
                  <Plus size={16} /> Save & Enable Repository
                </>
              )}
            </button>
          </form>

          <style jsx>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
