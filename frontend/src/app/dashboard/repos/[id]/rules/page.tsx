'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Trash2, ShieldAlert, Plus, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import styles from '../../../../../styles/dashboard.module.css';

interface Rule {
  id: string;
  name: string;
  event_type: string;
  conditions: {
    field: string;
    operator: string;
    value: string;
  };
  actions: Array<{
    type: string;
    value: string;
  }>;
  is_active: boolean;
}

export default function RulesPage() {
  const router = useRouter();
  const params = useParams();
  const repoId = params.id as string;

  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Rule Creation Form state
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState('issues');
  const [keyword, setKeyword] = useState('');
  
  // Action configurations
  const [enableLabel, setEnableLabel] = useState(false);
  const [labelText, setLabelText] = useState('bug');
  
  const [enableComment, setEnableComment] = useState(false);
  const [commentText, setCommentText] = useState('Thank you for reporting. The bot has logged this item.');
  
  const [enableSlack, setEnableSlack] = useState(false);
  const [slackText, setSlackText] = useState('Issue #{number} opened in {repo}: *{title}*');

  const fetchRules = async () => {
    try {
      const res = await fetch(`/api/v1/repos/${repoId}/rules`);
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch (e) {
      console.error('Failed to fetch rules:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [repoId]);

  const handleToggleRule = async (ruleId: string) => {
    // Optimistic toggle update
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, is_active: !r.is_active } : r))
    );

    try {
      const res = await fetch(`/api/v1/rules/${ruleId}/toggle`, { method: 'PATCH' });
      if (!res.ok) {
        // Rollback on fail
        await fetchRules();
      }
    } catch (e) {
      await fetchRules();
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const res = await fetch(`/api/v1/rules/${ruleId}`, { method: 'DELETE' });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
      }
    } catch (e) {
      console.error('Delete rule failed:', e);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !keyword) {
      setErrorMsg('Please specify a rule name and condition keyword.');
      return;
    }

    if (!enableLabel && !enableComment && !enableSlack) {
      setErrorMsg('Please configure at least one active label, comment, or Slack action.');
      return;
    }

    setErrorMsg('');
    
    // Structure dynamic condition block
    const conditions = {
      field: 'title',
      operator: 'contains',
      value: keyword,
    };

    // Structure dynamic actions list
    const actions = [];
    if (enableLabel && labelText) {
      actions.push({ type: 'add_label', value: labelText });
    }
    if (enableComment && commentText) {
      actions.push({ type: 'create_comment', value: commentText });
    }
    if (enableSlack && slackText) {
      actions.push({ type: 'send_slack', value: slackText });
    }

    try {
      const res = await fetch(`/api/v1/repos/${repoId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, event_type: eventType, conditions, actions }),
      });

      if (res.ok) {
        setName('');
        setKeyword('');
        setEnableLabel(false);
        setEnableComment(false);
        setEnableSlack(false);
        await fetchRules();
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || 'Failed to create rule.');
      }
    } catch (e) {
      setErrorMsg('Failed to save rule.');
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading repository rules...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <button onClick={() => router.push('/dashboard/repos')} className={styles.logoutBtn} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
          <ArrowLeft size={16} /> Back to Repositories
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Rules List Column */}
        <div className={styles.sectionCard}>
          <h3 style={{ marginBottom: '1.5rem' }}>Configured Automation Rules ({rules.length})</h3>
          
          {rules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <ShieldAlert size={40} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
              <p>No custom rules defined yet.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '5px' }}>Configure rule rules on the right panel to begin.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {rules.map((rule) => (
                <div key={rule.id} className={styles.eventRow} style={{ borderColor: rule.is_active ? 'var(--card-border)' : 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ fontWeight: 600, color: rule.is_active ? '#fff' : 'var(--text-muted)' }}>{rule.name}</h4>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <button 
                        onClick={() => handleToggleRule(rule.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: rule.is_active ? 'var(--secondary-color)' : 'var(--text-muted)' }}
                      >
                        {rule.is_active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      </button>
                      <button 
                        onClick={() => handleDeleteRule(rule.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Trigger: <span style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{rule.event_type}</span>
                  </p>
                  
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px' }}>
                    <strong>Condition:</strong> Title contains keyword <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>"{rule.conditions.value}"</span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {rule.actions.map((act, idx) => (
                      <span key={idx} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', color: 'var(--text-primary)' }}>
                        {act.type.replace('_', ' ').toUpperCase()}: {act.value.length > 20 ? `${act.value.slice(0, 20)}...` : act.value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Rule Form Column */}
        <div className={styles.sectionCard}>
          <h3 style={{ marginBottom: '1.5rem' }}>Create Automation Rule</h3>
          {errorMsg && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem 1rem', borderRadius: '6px', color: 'var(--danger-color)', fontSize: '0.9rem', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleCreateRule}>
            <div className={styles.formGroup}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rule Name</label>
              <input
                type="text"
                placeholder="e.g. Auto Tag Bug reports"
                className={styles.inputField}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Event Trigger Source</label>
              <select className={styles.inputField} value={eventType} onChange={(e) => setEventType(e.target.value)} style={{ background: '#0b0e1a' }}>
                <option value="issues">GitHub Issues</option>
                <option value="pull_request">GitHub Pull Requests</option>
              </select>
            </div>

            <div className={styles.formGroup} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>IF Title Contains Keyword (Case-Insensitive)</label>
              <input
                type="text"
                placeholder="e.g. bug, fix, critical"
                className={styles.inputField}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>

            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>THEN Execute Actions:</h4>

            {/* Label Action Checkbox config */}
            <div style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', padding: '10px 15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, marginBottom: enableLabel ? '10px' : '0' }}>
                <input type="checkbox" checked={enableLabel} onChange={(e) => setEnableLabel(e.target.checked)} />
                <span>Apply Label to GitHub Issue / PR</span>
              </label>
              {enableLabel && (
                <input
                  type="text"
                  className={styles.inputField}
                  style={{ width: '100%' }}
                  value={labelText}
                  onChange={(e) => setLabelText(e.target.value)}
                />
              )}
            </div>

            {/* Comment Action Checkbox config */}
            <div style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', padding: '10px 15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, marginBottom: enableComment ? '10px' : '0' }}>
                <input type="checkbox" checked={enableComment} onChange={(e) => setEnableComment(e.target.checked)} />
                <span>Submit Comment Response</span>
              </label>
              {enableComment && (
                <textarea
                  className={styles.inputField}
                  style={{ width: '100%', minHeight: '60px', resize: 'vertical' }}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
              )}
            </div>

            {/* Slack Action Checkbox config */}
            <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '10px 15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, marginBottom: enableSlack ? '10px' : '0' }}>
                <input type="checkbox" checked={enableSlack} onChange={(e) => setEnableSlack(e.target.checked)} />
                <span>Send Slack Alert Notification</span>
              </label>
              {enableSlack && (
                <>
                  <textarea
                    className={styles.inputField}
                    style={{ width: '100%', minHeight: '60px', resize: 'vertical', marginBottom: '5px' }}
                    value={slackText}
                    onChange={(e) => setSlackText(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                    <Info size={12} /> Templates support variable parameters: <code>{"{number}"}</code>, <code>{"{title}"}</code>, <code>{"{repo}"}</code>.
                  </div>
                </>
              )}
            </div>

            <button type="submit" className={styles.submitBtn} style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <Plus size={16} /> Save Automation Rule
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
