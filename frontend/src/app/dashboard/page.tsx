'use client';

import { useEffect, useState } from 'react';
import { Activity, BarChart2, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Bot } from 'lucide-react';
import styles from '../../styles/dashboard.module.css';

interface StatMetrics {
  total_events: number;
  successful_events: number;
  failed_events: number;
  total_actions: number;
  active_repositories: number;
}

interface ActionAudit {
  id: string;
  action_type: string;
  status: string;
  details: any;
  created_at: string;
}

interface WebhookEventAudit {
  id: string;
  delivery_id: string;
  event_type: string;
  action: string | null;
  status: string;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
  actions: ActionAudit[];
}

export default function OverviewPage() {
  const [stats, setStats] = useState<StatMetrics | null>(null);
  const [events, setEvents] = useState<WebhookEventAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const fetchTelemetry = async () => {
    try {
      const [statsRes, eventsRes] = await Promise.all([
        fetch('/api/v1/dashboard/stats'),
        fetch('/api/v1/dashboard/events?limit=15')
      ]);

      if (statsRes.ok && eventsRes.ok) {
        const statsData = await statsRes.json();
        const eventsData = await eventsRes.json();
        setStats(statsData);
        setEvents(eventsData.events || []);
      }
    } catch (e) {
      console.error('Failed to load dashboard telemetry:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    // Poll statistics every 10 seconds for live updates
    const interval = setInterval(fetchTelemetry, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleEventExpand = (id: string) => {
    setExpandedEventId(expandedEventId === id ? null : id);
  };

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading analytics telemetry...</div>;
  }

  return (
    <div>
      {/* Telemetry Stats Grid */}
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Activity size={24} />
          </div>
          <div>
            <div className={styles.statValue}>{stats?.total_events ?? 0}</div>
            <div className={styles.statLabel}>Total Webhooks Ingested</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconGreen}`}>
            <CheckCircle size={24} />
          </div>
          <div>
            <div className={styles.statValue}>{stats?.successful_events ?? 0}</div>
            <div className={styles.statLabel}>Completed Processing</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className={styles.statValue}>{stats?.failed_events ?? 0}</div>
            <div className={styles.statLabel}>Failed Event Tasks</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--secondary-color)' }}>
            <Bot size={24} />
          </div>
          <div>
            <div className={styles.statValue}>{stats?.total_actions ?? 0}</div>
            <div className={styles.statLabel}>Automations Triggered</div>
          </div>
        </div>
      </section>

      {/* Live Event Audit Log Section */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3>Live Webhook Observability Log</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Auto-refreshes in background</span>
        </div>

        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <BarChart2 size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <p>No webhook events received yet.</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '5px' }}>
              Connect a repository and open an issue or pull request to see the live feed.
            </p>
          </div>
        ) : (
          <div className={styles.eventList}>
            {events.map((event) => {
              const isExpanded = expandedEventId === event.id;
              
              // Map Chip Style classes
              let chipClass = styles.chipPending;
              if (event.status === 'processing') chipClass = styles.chipProcessing;
              else if (event.status === 'completed') chipClass = styles.chipCompleted;
              else if (event.status === 'failed') chipClass = styles.chipFailed;

              return (
                <div key={event.id} className={styles.eventRow}>
                  <div className={styles.eventHeader} onClick={() => toggleEventExpand(event.id)}>
                    <div className={styles.eventMeta}>
                      <span className={`${styles.chip} ${chipClass}`}>
                        {event.status.toUpperCase()}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        {event.event_type.toUpperCase()} {event.action ? `(${event.action})` : ''}
                      </span>
                      <span className={styles.time}>
                        {new Date(event.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                        id: {event.delivery_id.slice(0, 8)}...
                      </span>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className={styles.actionsDetail}>
                      {event.error_message && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem 1rem', borderRadius: '6px', color: 'var(--danger-color)', fontSize: '0.85rem', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '10px' }}>
                          <strong>Process Failure:</strong> {event.error_message}
                        </div>
                      )}
                      
                      <h5 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>Dispatched Actions Audit ({event.actions.length})</h5>
                      {event.actions.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No custom rules matched this payload event.</p>
                      ) : (
                        event.actions.map((action) => (
                          <div key={action.id} className={styles.actionRow}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: action.status === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: action.status === 'success' ? 'var(--secondary-color)' : 'var(--danger-color)', fontWeight: 600 }}>
                                {action.status.toUpperCase()}
                              </span>
                              <span style={{ fontWeight: 500 }}>{action.action_type.replace('_', ' ').toUpperCase()}</span>
                            </div>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                              {action.action_type === 'send_slack' 
                                ? `Message: "${action.details?.message || ''}"` 
                                : action.action_type === 'add_label' 
                                  ? `Label: "${action.details?.label || ''}"` 
                                  : 'Comment Posted'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
