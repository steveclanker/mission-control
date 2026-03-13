import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { requireRole } from '@/lib/auth';

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(value: string | number | null | undefined): string {
  if (!value) return '';
  // Handle both Unix timestamps (numbers) and date strings
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer');
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'tasks';
  const format = searchParams.get('format') || 'csv';
  const db = getDatabase();
  const workspaceId = auth.user.workspace_id;

  if (type === 'tasks') {
    const tasks = db.prepare(`
      SELECT t.*, p.name as project_name, p.ticket_prefix as project_prefix,
        COALESCE((SELECT SUM(ce.cost_usd) FROM cost_entries ce WHERE ce.task_id = t.id), 0) as total_cost
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id AND p.workspace_id = t.workspace_id
      WHERE t.workspace_id = ?
      ORDER BY t.created_at DESC
    `).all(workspaceId) as any[];

    if (format === 'json') {
      const parsed = tasks.map(t => ({
        ...t,
        tags: t.tags ? JSON.parse(t.tags) : [],
        metadata: t.metadata ? JSON.parse(t.metadata) : {},
      }));
      return NextResponse.json({ tasks: parsed }, {
        headers: {
          'Content-Disposition': 'attachment; filename="tasks.json"',
        },
      });
    }

    // CSV format
    const headers = 'ID,Title,Status,Priority,Assigned To,Created,Due Date,Estimated Hours,Actual Hours,Cost (USD)';
    const rows = tasks.map(t =>
      [
        t.id,
        escapeCSV(t.title),
        t.status,
        t.priority,
        escapeCSV(t.assigned_to || ''),
        formatDate(t.created_at),
        formatDate(t.due_date),
        t.estimated_hours || '',
        t.actual_hours || '',
        t.total_cost > 0 ? t.total_cost.toFixed(4) : '',
      ].join(',')
    );
    const csv = [headers, ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="tasks.csv"',
      },
    });
  }

  if (type === 'weekly-report') {
    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - 7 * 24 * 60 * 60;

    const completedThisWeek = db.prepare(`
      SELECT t.*, p.name as project_name FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id AND p.workspace_id = t.workspace_id
      WHERE t.workspace_id = ? AND t.status = 'done' AND t.updated_at >= ?
      ORDER BY t.updated_at DESC
    `).all(workspaceId, weekAgo) as any[];

    const createdThisWeek = db.prepare(`
      SELECT t.*, p.name as project_name FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id AND p.workspace_id = t.workspace_id
      WHERE t.workspace_id = ? AND t.created_at >= ?
      ORDER BY t.created_at DESC
    `).all(workspaceId, weekAgo) as any[];

    const inProgress = db.prepare(`
      SELECT t.*, p.name as project_name FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id AND p.workspace_id = t.workspace_id
      WHERE t.workspace_id = ? AND t.status IN ('in_progress', 'review', 'quality_review', 'assigned')
      ORDER BY t.priority DESC, t.created_at DESC
    `).all(workspaceId) as any[];

    const agents = db.prepare(`
      SELECT name, role, status FROM agents WHERE workspace_id = ?
    `).all(workspaceId) as any[];

    const weekStart = new Date(weekAgo * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const weekEnd = new Date(now * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const priorityBadge = (p: string) => {
      const colors: Record<string, string> = {
        critical: '#ef4444', urgent: '#ef4444', high: '#f97316', medium: '#3b82f6', low: '#6b7280'
      };
      return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${colors[p] || '#6b7280'}20;color:${colors[p] || '#6b7280'}">${p}</span>`;
    };

    const statusBadge = (s: string) => {
      const colors: Record<string, string> = {
        done: '#22c55e', in_progress: '#eab308', review: '#a855f7', quality_review: '#6366f1', assigned: '#3b82f6', inbox: '#6b7280'
      };
      return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${colors[s] || '#6b7280'}20;color:${colors[s] || '#6b7280'}">${s.replace(/_/g, ' ')}</span>`;
    };

    const taskRow = (t: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${t.title}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${priorityBadge(t.priority)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${statusBadge(t.status)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${t.assigned_to || '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${t.project_name || '—'}</td>
      </tr>`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Weekly Report — ${weekStart} to ${weekEnd}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; color: #111827; padding: 40px 20px; }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #7c3aed, #ec4899); color: white; padding: 32px 40px; }
    .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .content { padding: 32px 40px; }
    .section { margin-bottom: 32px; }
    .section h2 { font-size: 16px; font-weight: 700; color: #374151; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .section h2 .count { background: #f3f4f6; color: #6b7280; font-size: 12px; padding: 2px 8px; border-radius: 9999px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; background: #f9fafb; font-weight: 600; color: #6b7280; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .stat-card { background: #f9fafb; border-radius: 12px; padding: 16px; text-align: center; }
    .stat-card .value { font-size: 28px; font-weight: 700; color: #111827; }
    .stat-card .label { font-size: 12px; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
    .agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .agent-card { background: #f9fafb; border-radius: 8px; padding: 12px; }
    .agent-card .name { font-weight: 600; font-size: 14px; }
    .agent-card .role { font-size: 12px; color: #6b7280; }
    .empty { color: #9ca3af; font-size: 13px; font-style: italic; }
    @media print { body { padding: 0; background: white; } .container { box-shadow: none; border-radius: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Weekly Report</h1>
      <p>${weekStart} — ${weekEnd}</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="stat-grid">
          <div class="stat-card">
            <div class="value">${completedThisWeek.length}</div>
            <div class="label">Tasks Completed</div>
          </div>
          <div class="stat-card">
            <div class="value">${createdThisWeek.length}</div>
            <div class="label">Tasks Created</div>
          </div>
          <div class="stat-card">
            <div class="value">${inProgress.length}</div>
            <div class="label">In Progress</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>✅ Completed This Week <span class="count">${completedThisWeek.length}</span></h2>
        ${completedThisWeek.length === 0 ? '<p class="empty">No tasks completed this week.</p>' : `
        <table><thead><tr><th>Task</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Project</th></tr></thead>
        <tbody>${completedThisWeek.map(taskRow).join('')}</tbody></table>`}
      </div>

      <div class="section">
        <h2>🆕 Created This Week <span class="count">${createdThisWeek.length}</span></h2>
        ${createdThisWeek.length === 0 ? '<p class="empty">No tasks created this week.</p>' : `
        <table><thead><tr><th>Task</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Project</th></tr></thead>
        <tbody>${createdThisWeek.map(taskRow).join('')}</tbody></table>`}
      </div>

      <div class="section">
        <h2>🔄 Still In Progress <span class="count">${inProgress.length}</span></h2>
        ${inProgress.length === 0 ? '<p class="empty">No tasks in progress.</p>' : `
        <table><thead><tr><th>Task</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Project</th></tr></thead>
        <tbody>${inProgress.map(taskRow).join('')}</tbody></table>`}
      </div>

      <div class="section">
        <h2>🤖 Agent Activity</h2>
        ${agents.length === 0 ? '<p class="empty">No agents registered.</p>' : `
        <div class="agent-grid">
          ${agents.map((a: any) => `
            <div class="agent-card">
              <div class="name">${a.name}</div>
              <div class="role">${a.role} · ${statusBadge(a.status)}</div>
            </div>
          `).join('')}
        </div>`}
      </div>

      <div style="text-align:center;color:#9ca3af;font-size:12px;margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb">
        Generated by Mission Control · ${new Date().toLocaleString()}
      </div>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="weekly-report-${new Date().toISOString().split('T')[0]}.html"`,
      },
    });
  }

  return NextResponse.json({ error: 'Invalid export type. Use: tasks, weekly-report' }, { status: 400 });
}
