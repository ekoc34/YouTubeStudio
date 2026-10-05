import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  useGetDashboard, useListIdeas, useGetIdea, useCreateIdea, useUpdateIdea, useDeleteIdea,
  useGenerateIdeas, useAnalyzeIdea, useListProjects, useGetProject, useCreateProject,
  useUpdateProject, useDeleteProject, useUpdateProjectStatus, useListScripts,
  useGenerateScript, useGetScript, useUpdateScript, useApproveScript,
  getGetDashboardQueryKey, getListIdeasQueryKey,
  getListProjectsQueryKey, getGetProjectQueryKey, getListScriptsQueryKey,
} from '@workspace/api-client-react';
import type { Idea, IdeaInput, IdeaStatus, ProjectStatus, ScriptScene } from '@workspace/api-client-react';
import {
  Activity, ArrowLeft, ArrowRight, BarChart3, Check, CheckCircle2, ChevronDown,
  CircleAlert, Clapperboard, Clock3, Film, FolderKanban, Gauge, Lightbulb, LoaderCircle,
  Menu, MoreHorizontal, Pencil, Plus, Search, Sparkles, Trash2, Youtube, X,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import ResearchPage from './ResearchPage';

const queryClient = new QueryClient();
const ideaStatuses: IdeaStatus[] = ['NEW', 'RESEARCHING', 'APPROVED', 'REJECTED', 'SCRIPTING', 'READY'];
const supportedProjects: ProjectStatus[] = ['IDEA', 'RESEARCH', 'SCRIPT', 'SCENES', 'READY', 'FAILED'];
const projectStatusLabel: Record<string, string> = {
  IDEA: 'Idea', RESEARCH: 'Research', SCRIPT: 'Script', SCENES: 'Scenes', MEDIA: 'Media',
  VOICE: 'Voice', EDIT: 'Edit', QUALITY_CHECK: 'Quality check', READY: 'Ready',
  UPLOADED: 'Uploaded', PUBLISHED: 'Published', FAILED: 'Failed',
};
const ideaStatusLabel: Record<string, string> = {
  NEW: 'New', RESEARCHING: 'Researching', APPROVED: 'Approved', REJECTED: 'Rejected', SCRIPTING: 'Scripting', READY: 'Ready',
};

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><div className="dark min-h-[100dvh]"><ErrorBoundary><Shell /></ErrorBoundary></div><Toaster /></TooltipProvider></QueryClientProvider>;
}

function Shell() {
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const title = location.startsWith('/research') ? 'Research' : location.startsWith('/ideas') ? 'Ideas' : location.startsWith('/strategist') ? 'Strategist' :
    location.startsWith('/scripts') ? 'Scripts' : location.startsWith('/projects') ? 'Projects' : 'Overview';
  return <div className="studio-layout min-h-[100dvh]">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark"><Youtube size={20} fill="currentColor" /></span><span>FRAME<span className="brand-dot">.</span><small>CONTENT STUDIO</small></span></Link>
       <div className="workspace-chip"><span className="workspace-avatar">CS</span><span><b>Your studio</b><small>Creator workspace</small></span><ChevronDown size={14} /></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="main-nav">
        <NavItem href="/" active={location === '/' || location === '/dashboard'} icon={<Gauge size={17} />} label="Overview" />
        <NavItem href="/ideas" active={location.startsWith('/ideas')} icon={<Lightbulb size={17} />} label="Ideas" />
        <NavItem href="/research" active={location.startsWith('/research')} icon={<Search size={17} />} label="Research" />
        <NavItem href="/strategist" active={location.startsWith('/strategist')} icon={<Sparkles size={17} />} label="Strategist" />
        <NavItem href="/scripts" active={location.startsWith('/scripts')} icon={<Clapperboard size={17} />} label="Scripts" />
        <NavItem href="/projects" active={location.startsWith('/projects')} icon={<FolderKanban size={17} />} label="Projects" />
      </nav>
      <div className="sidebar-bottom">
        <div className="publish-note"><span className="live-dot" />Publishing connection <b>Not connected</b><p>Video publishing and analytics aren’t connected yet.</p></div>
         <div className="user-row"><span className="user-avatar">CS</span><span><b>Studio creator</b><small>Workspace member</small></span><MoreHorizontal size={18} /></div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation" data-testid="button-menu"><Menu size={19} /></button><div className="crumb">Studio <span>/</span> <b>{title}</b></div><div className="topbar-actions"><span className="system-state"><i /> Workspace ready</span><Link href="/strategist" className="button button-primary button-small" data-testid="link-new-idea"><Plus size={15} /> New idea</Link></div></header>
      <div className="page-wrap" onClick={() => mobileNav && setMobileNav(false)}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/ideas" component={IdeasPage} />
          <Route path="/ideas/new" component={NewIdeaPage} />
          <Route path="/ideas/:id" component={IdeaPage} />
          <Route path="/research" component={ResearchPage} />
          <Route path="/strategist" component={StrategistPage} />
          <Route path="/scripts" component={ScriptsPage} />
          <Route path="/scripts/:id" component={ScriptPage} />
          <Route path="/projects" component={ProjectsPage} />
          <Route path="/projects/:id" component={ProjectPage} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </main>
  </div>;
}

function NavItem({ href, active, icon, label }: { href: string; active: boolean; icon: ReactNode; label: string }) {
  return <Link href={href} data-testid={`link-nav-${label.toLowerCase()}`} className={`nav-item ${active ? 'active' : ''}`}>{icon}<span>{label}</span>{active && <span className="nav-active-mark" />}</Link>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow || 'CREATOR WORKSPACE'}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>;
}
function Button({ children, variant = 'secondary', ...props }: { children: ReactNode; variant?: string; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean; testId?: string }) {
  return <button type={props.type || 'button'} onClick={props.onClick} disabled={props.disabled} data-testid={props.testId} className={`button button-${variant} ${props.disabled ? 'is-disabled' : ''}`}>{children}</button>;
}
function Status({ children, kind = 'neutral' }: { children: ReactNode; kind?: string }) { return <span className={`status status-${kind.toLowerCase().replaceAll('_', '-')}`}>{children}</span>; }
function statusKind(status: string) { return ['READY', 'APPROVED', 'PUBLISHED'].includes(status) ? 'good' : ['FAILED', 'REJECTED'].includes(status) ? 'bad' : ['SCRIPT', 'SCENES', 'SCRIPTING', 'RESEARCHING'].includes(status) ? 'amber' : 'neutral'; }
function Panel({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`panel ${className}`}>{children}</section>; }
function Loading({ label = 'Loading workspace' }: { label?: string }) { return <div className="loading-state"><div className="skeleton-line wide" /><div className="skeleton-line" /><span>{label}</span></div>; }
function ErrorState({ onRetry }: { onRetry: () => void }) { return <div className="empty-state"><CircleAlert size={22} /><h3>Couldn’t load this view</h3><p>Check your connection and try again.</p><Button onClick={onRetry}>Retry</Button></div>; }
function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) { return <div className="empty-state"><span className="empty-icon"><Film size={22} /></span><h3>{title}</h3><p>{text}</p>{action}</div>; }
function MiniStat({ label, value, icon, note }: { label: string; value: string | number; icon: ReactNode; note: string }) {
  return <div className="stat-card"><span className="stat-icon">{icon}</span><div className="stat-label">{label}</div><strong>{value}</strong><small>{note}</small></div>;
}
function formatDate(date?: string) { return date ? new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'; }
function useRefresh() {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
    client.invalidateQueries({ queryKey: getListIdeasQueryKey() }),
    client.invalidateQueries({ queryKey: getListProjectsQueryKey() }),
    client.invalidateQueries({ queryKey: getListScriptsQueryKey() }),
    client.invalidateQueries(),
  ]);
}

function Dashboard() {
  const { data, isLoading, isError, refetch } = useGetDashboard();
  if (isLoading) return <Loading label="Gathering your studio activity" />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;
  const ideaTotal = data.ideasByStatus.reduce((n, x) => n + x.count, 0);
  const projectTotal = data.productionByStatus.reduce((n, x) => n + x.count, 0);
  const maxProject = Math.max(1, ...data.productionByStatus.map(x => x.count));
  return <div className="page-enter">
    <PageHeading eyebrow="STUDIO OVERVIEW" title="Good work starts here." description="Your Shorts pipeline, from first spark to a production-ready script." action={<Link href="/strategist" className="button button-primary" data-testid="link-strategist-cta"><Sparkles size={16} /> Find your next idea</Link>} />
    <div className="stats-grid">
      <MiniStat label="AI IDEAS GENERATED" value={data.ideasGenerated} icon={<Lightbulb size={18} />} note="Saved from Strategist" />
      <MiniStat label="CURRENT JOBS" value={data.projectsInProduction} icon={<Clapperboard size={18} />} note={`${data.scriptsCreated} scripts saved`} />
      <MiniStat label="VIDEOS CREATED" value={data.videosCreated} icon={<Film size={18} />} note="Video generation not connected" />
      <MiniStat label="VIDEOS PUBLISHED" value={data.videosPublished} icon={<Youtube size={18} />} note="Publishing not connected" />
      <MiniStat label="PERFORMANCE" value="—" icon={<BarChart3 size={18} />} note="Analytics not connected" />
    </div>
    <div className="dashboard-grid">
      <Panel className="production-panel"><div className="panel-heading"><div><div className="eyebrow">PIPELINE</div><h2>Production flow</h2></div><Link href="/projects" className="text-link">View projects <ArrowRight size={14} /></Link></div>
         <div className="pipeline-summary"><strong>{projectTotal}</strong><span>projects tracked</span><span className="pipeline-status"><i /> Stage counts</span></div>
        <div className="bar-list">{data.productionByStatus.length ? data.productionByStatus.map((item, i) => <div className="bar-row" key={item.status}><span>{projectStatusLabel[item.status] || item.status}</span><div className="bar-track"><i style={{ width: `${Math.max(4, item.count / maxProject * 100)}%`, animationDelay: `${i * 50}ms` }} /></div><b>{item.count}</b></div>) : <p className="muted">Projects will appear here once you start a workflow.</p>}</div>
        <div className="pipeline-footer"><span><span className="dot-red" /> Shorts projects</span><span>Update statuses from a project detail page</span></div>
      </Panel>
      <Panel className="performance-panel"><div className="panel-heading"><div><div className="eyebrow">CHANNEL SIGNAL</div><h2>Performance</h2></div><span className="integration-pill">Not connected</span></div>
        <div className="performance-blank"><div className="chart-placeholder"><BarChart3 size={24} /><div className="chart-lines"><i /><i /><i /><i /></div></div><h3>No channel data yet</h3><p>Connect a publishing and analytics source to see real views, likes, and comments here.</p><span className="note-tag"><CircleAlert size={13} /> No estimated metrics shown</span></div>
      </Panel>
    </div>
    <div className="dashboard-grid lower-grid">
      <Panel><div className="panel-heading"><div><div className="eyebrow">RECENTLY CAPTURED</div><h2>Latest ideas <span className="count">{ideaTotal}</span></h2></div><Link href="/ideas" className="text-link">All ideas <ArrowRight size={14} /></Link></div>
        {data.recentIdeas.length ? <div className="compact-list">{data.recentIdeas.slice(0, 5).map(idea => <IdeaRow key={idea.id} idea={idea} />)}</div> : <EmptyState title="Your idea board is clear" text="Capture a rough thought or ask the strategist for a batch of starting points." action={<Link href="/ideas/new" className="button button-secondary" data-testid="link-create-first-idea"><Plus size={14} /> Add an idea</Link>} />}
      </Panel>
      <Panel><div className="panel-heading"><div><div className="eyebrow">IN MOTION</div><h2>Recent projects</h2></div><Link href="/projects" className="text-link">All projects <ArrowRight size={14} /></Link></div>
        {data.recentProjects.length ? <div className="compact-list">{data.recentProjects.slice(0, 5).map(project => <ProjectRow key={project.id} project={project} />)}</div> : <EmptyState title="Nothing in production" text="Turn a promising idea into a project when you're ready to write." action={<Link href="/ideas" className="text-link">Browse ideas <ArrowRight size={14} /></Link>} />}
      </Panel>
    </div>
    {data.performanceAvailable && <p className="performance-caution">Real channel performance source connected.</p>}
  </div>;
}

function IdeaRow({ idea }: { idea: Idea }) {
  return <Link href={`/ideas/${idea.id}`} className="list-row" data-testid={`link-idea-${idea.id}`}><span className="row-icon idea-icon"><Lightbulb size={16} /></span><span className="row-main"><b>{idea.title}</b><small>{idea.topic} · {idea.format}</small></span><Status kind={statusKind(idea.status)}>{ideaStatusLabel[idea.status]}</Status><ArrowRight size={15} className="row-arrow" /></Link>;
}
function ProjectRow({ project }: { project: any }) {
  return <Link href={`/projects/${project.id}`} className="list-row" data-testid={`link-project-${project.id}`}><span className="row-icon project-icon"><Clapperboard size={16} /></span><span className="row-main"><b>{project.name}</b><small>{project.ideaTitle} · {project.scriptCount} scripts</small></span><Status kind={statusKind(project.status)}>{projectStatusLabel[project.status] || project.status}</Status><ArrowRight size={15} className="row-arrow" /></Link>;
}

function IdeasPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const queryParams = { q: search || undefined, status: (status || undefined) as IdeaStatus | undefined };
  const { data, isLoading, isError, refetch } = useListIdeas(queryParams);
  const remove = useDeleteIdea();
  const refresh = useRefresh();
  const [editing, setEditing] = useState<Idea | null>(null);
  const [editForm, setEditForm] = useState<IdeaInput | null>(null);
  const update = useUpdateIdea();
  function saveEdit(e: FormEvent) {
    e.preventDefault(); if (!editing || !editForm) return;
    update.mutate({ id: editing.id, data: editForm }, { onSuccess: () => { setEditing(null); refresh(); } });
  }
  return <div className="page-enter">
    <PageHeading title="Idea library" description="A working backlog for the Shorts worth making." action={<Link href="/ideas/new" className="button button-primary" data-testid="link-idea-create"><Plus size={16} /> Add idea</Link>} />
    <Panel className="filter-panel"><div className="searchbox"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, topic, or hook…" data-testid="input-ideas-search" /></div><select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter ideas by status" data-testid="select-ideas-status"><option value="">All statuses</option>{ideaStatuses.map(s => <option value={s} key={s}>{ideaStatusLabel[s]}</option>)}</select><span className="result-count">{data?.length ?? 0} ideas</span></Panel>
    {isLoading ? <Loading label="Loading idea library" /> : isError ? <ErrorState onRetry={() => refetch()} /> : !data?.length ? <Panel><EmptyState title="No ideas match this view" text={search || status ? 'Try a different search or status filter.' : 'Add your own idea or use Strategist to generate a thoughtful batch.'} action={<Link href="/strategist" className="button button-primary" data-testid="link-ideas-empty-strategist"><Sparkles size={15} /> Open Strategist</Link>} /></Panel> :
      <Panel className="table-panel"><div className="table-head idea-table"><span>IDEA / TOPIC</span><span>FORMAT</span><span>ASSESSMENT</span><span>STATUS</span><span>UPDATED</span><span /></div>
        {data.map(idea => <div className="table-row idea-table" key={idea.id} data-testid={`row-idea-${idea.id}`}><Link href={`/ideas/${idea.id}`} className="idea-cell"><b>{idea.title}</b><small>{idea.hook}</small></Link><span className="format-cell">{idea.format}<small>{idea.estimatedDuration}s target</small></span><span className="score-pair"><span><b>{idea.viralScore ?? '—'}</b><small>viral</small></span><span><b>{idea.originalityScore ?? '—'}</b><small>original</small></span></span><Status kind={statusKind(idea.status)}>{ideaStatusLabel[idea.status]}</Status><span className="date-cell">{formatDate(idea.updatedAt)}</span><span className="row-controls"><button className="icon-button" onClick={() => { setEditing(idea); setEditForm({ title: idea.title, topic: idea.topic, hook: idea.hook, description: idea.description, targetAudience: idea.targetAudience, format: idea.format, estimatedDuration: idea.estimatedDuration }); }} aria-label={`Edit ${idea.title}`} data-testid={`button-edit-idea-${idea.id}`}><Pencil size={15} /></button><button className="icon-button danger-hover" onClick={() => { if (window.confirm(`Delete “${idea.title}”? This cannot be undone.`)) remove.mutate({ id: idea.id }, { onSuccess: refresh }); }} aria-label={`Delete ${idea.title}`} data-testid={`button-delete-idea-${idea.id}`}><Trash2 size={15} /></button></span></div>)}
      </Panel>}
    {editing && editForm && <Modal title="Edit idea" onClose={() => setEditing(null)}><form className="form-grid" onSubmit={saveEdit}>
      <Field label="Title"><input required maxLength={180} value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} data-testid="input-edit-idea-title" /></Field>
      <Field label="Topic"><input required value={editForm.topic} onChange={e => setEditForm({ ...editForm, topic: e.target.value })} /></Field>
      <Field label="Hook"><input required value={editForm.hook} onChange={e => setEditForm({ ...editForm, hook: e.target.value })} /></Field>
      <Field label="Description"><textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} /></Field>
      <Field label="Target audience"><input required value={editForm.targetAudience} onChange={e => setEditForm({ ...editForm, targetAudience: e.target.value })} /></Field>
      <Field label="Format"><input required value={editForm.format} onChange={e => setEditForm({ ...editForm, format: e.target.value })} /></Field>
      <Field label="Duration (seconds)"><input type="number" min={10} max={180} value={editForm.estimatedDuration} onChange={e => setEditForm({ ...editForm, estimatedDuration: Number(e.target.value) })} /></Field>
      <div className="form-actions"><Button onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" variant="primary" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save changes'}</Button></div>
    </form></Modal>}
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal" role="dialog" aria-modal="true"><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={17} /></button></div>{children}</div></div>;
}
function NewIdeaPage() {
  const [, navigate] = useLocation(); const create = useCreateIdea(); const refresh = useRefresh();
  const [form, setForm] = useState<IdeaInput>({ title: '', topic: '', hook: '', description: '', targetAudience: '', format: 'Storytime', estimatedDuration: 45 });
  function submit(e: FormEvent) { e.preventDefault(); create.mutate({ data: form }, { onSuccess: idea => { refresh(); navigate(`/ideas/${idea.id}`); } }); }
  return <div className="page-enter"><Link href="/ideas" className="back-link"><ArrowLeft size={15} /> Back to ideas</Link><PageHeading title="Capture an idea" description="Get the raw thought into your library. You can refine it later." /><Panel className="form-panel"><form className="form-grid" onSubmit={submit}>
    <Field label="Working title"><input required maxLength={180} placeholder="The surprising thing about…" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="input-idea-title" /></Field>
    <Field label="Topic"><input required placeholder="What is this Short about?" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} data-testid="input-idea-topic" /></Field>
    <Field label="Opening hook"><textarea required maxLength={500} placeholder="The first line that earns the next second…" value={form.hook} onChange={e => setForm({ ...form, hook: e.target.value })} data-testid="input-idea-hook" /></Field>
    <Field label="Description"><textarea maxLength={3000} placeholder="The basic premise, beats, or context." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
    <div className="form-two"><Field label="Target audience"><input required value={form.targetAudience} placeholder="e.g. First-time home cooks" onChange={e => setForm({ ...form, targetAudience: e.target.value })} /></Field><Field label="Format"><input required value={form.format} placeholder="Tutorial, storytime…" onChange={e => setForm({ ...form, format: e.target.value })} /></Field></div>
    <Field label="Estimated duration (seconds)"><input type="number" required min={10} max={180} value={form.estimatedDuration} onChange={e => setForm({ ...form, estimatedDuration: Number(e.target.value) })} /></Field>
    <div className="form-actions"><Button onClick={() => navigate('/ideas')}>Cancel</Button><Button type="submit" variant="primary" disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Save idea'} <ArrowRight size={15} /></Button></div>
  </form></Panel></div>;
}

function IdeaPage() {
  const { id = '' } = useParams<{ id: string }>(); const { data: idea, isLoading, isError, refetch } = useGetIdea(id);
  const analyze = useAnalyzeIdea(); const update = useUpdateIdea(); const createProject = useCreateProject(); const refresh = useRefresh();
  const [, setLocation] = useLocation();
  if (isLoading) return <Loading label="Loading idea analysis" />; if (isError || !idea) return <ErrorState onRetry={() => refetch()} />;
  const analysis = analyze.data;
  return <div className="page-enter"><Link href="/ideas" className="back-link"><ArrowLeft size={15} /> Idea library</Link>
    <PageHeading eyebrow={`IDEA / ${idea.topic.toUpperCase()}`} title={idea.title} description={idea.description || 'A promising premise, ready for a closer look.'} action={<div className="heading-actions"><Button onClick={() => analyze.mutate({ data: { ideaId: idea.id } })} disabled={analyze.isPending} testId="button-analyze-idea"><Sparkles size={15} /> {analyze.isPending ? 'Analyzing…' : 'Analyze idea'}</Button><Button variant="primary" onClick={() => createProject.mutate({ data: { ideaId: idea.id } }, { onSuccess: p => { refresh(); setLocation(`/projects/${p.id}`); } })} disabled={createProject.isPending} testId="button-create-project"><Plus size={15} /> Create project</Button></div>} />
    <div className="detail-grid"><div className="detail-main"><Panel className="hook-panel"><div className="eyebrow">OPENING HOOK</div><blockquote>{idea.hook}</blockquote><div className="hook-meta"><span>{idea.format}</span><span>{idea.estimatedDuration}s estimated</span><span>For {idea.targetAudience}</span></div></Panel>
      <Panel><div className="panel-heading"><div><div className="eyebrow">STRATEGIST REVIEW</div><h2>Make the premise sharper</h2></div><Button onClick={() => analyze.mutate({ data: { ideaId: idea.id } })} disabled={analyze.isPending} testId="button-rerun-analysis"><Activity size={14} /> Re-analyze</Button></div>
        {analysis ? <div className="analysis-content"><p className="analysis-explanation">{analysis.explanation}</p><div className="analysis-scores"><Score label="Viral potential" score={analysis.viralScore} /><Score label="Originality" score={analysis.originalityScore} /></div><InsightList title="Hook alternatives" items={analysis.hookOptions} /><InsightList title="Weak spots" items={analysis.weaknesses} /><InsightList title="Ways to improve" items={analysis.improvements} /></div> :
        <div className="analysis-content">{idea.rationale && <p className="analysis-explanation">{idea.rationale}</p>}<div className="analysis-scores"><Score label="Viral potential" score={idea.viralScore} /><Score label="Originality" score={idea.originalityScore} /></div><InsightList title="Weak spots" items={idea.weaknesses} /><InsightList title="Ways to improve" items={idea.improvements} />{!idea.rationale && !idea.weaknesses.length && <p className="muted">Run an analysis to get a concrete critique and ways to improve the angle.</p>}</div>}
      </Panel></div>
      <aside className="detail-rail"><Panel><div className="eyebrow">WORKFLOW STATUS</div><h3 className="rail-title"><Status kind={statusKind(idea.status)}>{ideaStatusLabel[idea.status]}</Status></h3><Field label="Move idea to"><select value={idea.status} onChange={e => update.mutate({ id: idea.id, data: { status: e.target.value as IdeaStatus } }, { onSuccess: refresh })} data-testid="select-idea-status">{ideaStatuses.map(s => <option value={s} key={s}>{ideaStatusLabel[s]}</option>)}</select></Field><div className="rail-separator" /><InfoLine label="Created" value={formatDate(idea.createdAt)} /><InfoLine label="Updated" value={formatDate(idea.updatedAt)} /></Panel>
        <Panel className="next-step-card"><span className="next-icon"><Clapperboard size={18} /></span><h3>Ready to write?</h3><p>Create a project to shape this premise into scenes and a shootable script.</p><Link href="/scripts" className="text-link">Go to script desk <ArrowRight size={14} /></Link></Panel>
      </aside></div>
  </div>;
}
function Score({ label, score }: { label: string; score: number | null }) { return <div className="score-box"><span>{label}</span><b>{score ?? '—'}<small>{score === null ? '' : '/100'}</small></b><div className="score-track"><i style={{ width: `${score ?? 0}%` }} /></div></div>; }
function InsightList({ title, items }: { title: string; items: string[] }) { return items.length ? <div className="insight-list"><h3>{title}</h3><ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul></div> : null; }
function InfoLine({ label, value }: { label: string; value: string }) { return <div className="info-line"><span>{label}</span><b>{value}</b></div>; }

function StrategistPage() {
  const generate = useGenerateIdeas(); const refresh = useRefresh();
  const [topic, setTopic] = useState(''); const [audience, setAudience] = useState(''); const [format, setFormat] = useState(''); const [count, setCount] = useState(4);
  return <div className="page-enter"><PageHeading eyebrow="IDEA DEVELOPMENT" title="Strategist" description="Give it a topic and a viewer. Get back angles worth testing, not a finished video." />
    <div className="strategist-layout"><Panel className="strategist-form"><div className="form-intro"><span className="strategist-mark"><Sparkles size={20} /></span><div><h2>Set the brief</h2><p>Specific inputs make stronger starting points.</p></div></div>
      <form onSubmit={e => { e.preventDefault(); generate.mutate({ data: { topic: topic || undefined, targetAudience: audience || undefined, format: format || undefined, count } }, { onSuccess: refresh }); }}>
        <Field label="Topic or territory"><textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Small apartment cooking, beginner camera gear, obscure local history" maxLength={200} data-testid="input-strategist-topic" /></Field>
        <Field label="Who should stop scrolling?"><input value={audience} onChange={e => setAudience(e.target.value)} placeholder="e.g. People learning to cook after work" maxLength={240} data-testid="input-strategist-audience" /></Field>
        <Field label="Format direction"><input value={format} onChange={e => setFormat(e.target.value)} placeholder="e.g. myth-busting, mini-doc, quick tutorial" maxLength={100} data-testid="input-strategist-format" /></Field>
        <Field label="Number of ideas"><select value={count} onChange={e => setCount(Number(e.target.value))} data-testid="select-strategist-count">{[2, 3, 4, 5, 6, 8].map(n => <option value={n} key={n}>{n} ideas</option>)}</select></Field>
        <Button type="submit" variant="primary" disabled={generate.isPending} testId="button-generate-ideas">{generate.isPending ? <><LoaderCircle size={15} className="spin" /> Thinking through angles…</> : <><Sparkles size={15} /> Generate ideas <ArrowRight size={15} /></>}</Button>
        {generate.isError && <p className="inline-error"><CircleAlert size={14} /> Generation failed. Check the AI provider and try again.</p>}
      </form>
    </Panel>
    <div className="strategist-results">{generate.data?.length ? <><div className="results-top"><div><div className="eyebrow">SAVED TO YOUR LIBRARY</div><h2>{generate.data.length} starting points</h2></div><Link href="/ideas" className="text-link">Open idea library <ArrowRight size={14} /></Link></div><div className="generated-list">{generate.data.map((idea, i) => <div className="generated-card" key={idea.id}><span className="generated-index">{String(i + 1).padStart(2, '0')}</span><div><Link href={`/ideas/${idea.id}`} className="generated-title">{idea.title}</Link><p>{idea.hook}</p><div className="generated-meta"><span>{idea.format}</span><span>{idea.estimatedDuration}s</span>{idea.viralScore !== null && <span>Potential {idea.viralScore}</span>}</div></div><Link href={`/ideas/${idea.id}`} className="icon-link" aria-label={`Open ${idea.title}`}><ArrowRight size={16} /></Link></div>)}</div></> :
      <div className="strategist-empty"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><Sparkles size={26} /><h2>Find a sharp angle.</h2><p>Each result is saved directly into your idea library. Review it, revise the hook, then move it into production.</p><div className="brief-example"><span>BRIEF EXAMPLE</span><p>“Low-cost studio lighting for solo creators”</p></div></div>}
    </div></div>
  </div>;
}

function ScriptsPage() {
  const { data: ideas, isLoading: ideasLoading } = useListIdeas();
  const { data: scripts, isLoading, isError, refetch } = useListScripts();
  const generate = useGenerateScript();
  const [ideaId, setIdeaId] = useState(''); const [tone, setTone] = useState('Direct, conversational'); const [duration, setDuration] = useState(45);
  return <div className="page-enter"><PageHeading title="Script desk" description="Turn an approved premise into a shootable vertical video." />
    <div className="scripts-grid"><Panel className="generate-script-panel"><div className="eyebrow">NEW DRAFT</div><h2>Start from an idea</h2><p>Generate a first pass with a hook, narration, CTA, and scene-by-scene visual direction.</p>
      {ideasLoading ? <Loading label="Loading ideas" /> : <form onSubmit={e => { e.preventDefault(); if (ideaId) generate.mutate({ data: { ideaId, targetDurationSeconds: duration, tone } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListScriptsQueryKey() }) }); }}>
        <Field label="Source idea"><select required value={ideaId} onChange={e => setIdeaId(e.target.value)} data-testid="select-script-idea"><option value="">Choose an idea</option>{ideas?.map(idea => <option value={idea.id} key={idea.id}>{idea.title} · {ideaStatusLabel[idea.status]}</option>)}</select></Field>
        <Field label="Target duration"><select value={duration} onChange={e => setDuration(Number(e.target.value))} data-testid="select-script-duration">{[20, 30, 45, 60, 90].map(n => <option value={n} key={n}>{n} seconds</option>)}</select></Field>
        <Field label="Voice and tone"><input value={tone} onChange={e => setTone(e.target.value)} maxLength={120} data-testid="input-script-tone" /></Field>
        <Button type="submit" variant="primary" disabled={!ideaId || generate.isPending} testId="button-generate-script">{generate.isPending ? 'Writing first pass…' : <><Sparkles size={15} /> Generate script</>}</Button>
        {generate.isError && <p className="inline-error">Couldn’t generate a script. Please try again.</p>}
      </form>}
    </Panel>
    <Panel className="saved-scripts"><div className="panel-heading"><div><div className="eyebrow">LIBRARY</div><h2>Saved scripts</h2></div><span className="count">{scripts?.length || 0}</span></div>
      {isLoading ? <Loading label="Loading scripts" /> : isError ? <ErrorState onRetry={() => refetch()} /> : !scripts?.length ? <EmptyState title="No scripts yet" text="Generated drafts land here. Pick an idea to build the first one." /> :
      <div className="compact-list">{scripts.map(script => <Link key={script.id} href={`/scripts/${script.id}`} className="list-row" data-testid={`link-script-${script.id}`}><span className="row-icon script-icon"><Clapperboard size={16} /></span><span className="row-main"><b>{script.hook || 'Untitled script'}</b><small>{script.scenes.length} scenes · Updated {formatDate(script.updatedAt)}</small></span><Status kind={script.status === 'APPROVED' ? 'good' : 'amber'}>{script.status === 'APPROVED' ? 'Approved' : 'Draft'}</Status><ArrowRight size={15} className="row-arrow" /></Link>)}</div>}
    </Panel></div>
  </div>;
}

function ScriptPage() {
  const { id = '' } = useParams<{ id: string }>(); const { data: script, isLoading, isError, refetch } = useGetScript(id);
  const update = useUpdateScript(); const approve = useApproveScript(); const refresh = useRefresh();
  const [hook, setHook] = useState(''); const [narration, setNarration] = useState(''); const [sound, setSound] = useState(''); const [cta, setCta] = useState(''); const [scenes, setScenes] = useState<ScriptScene[]>([]); const [initialized, setInitialized] = useState('');
  useEffect(() => {
    if (script && initialized !== script.id) {
      setHook(script.hook); setNarration(script.narration); setSound(script.soundMusic); setCta(script.cta); setScenes(script.scenes); setInitialized(script.id);
    }
  }, [script, initialized]);
  if (isLoading) return <Loading label="Loading script draft" />; if (isError || !script) return <ErrorState onRetry={() => refetch()} />;
  const save = () => update.mutate({ id: script.id, data: { hook, narration, soundMusic: sound, cta, scenes: scenes.map(({ narration: n, visualInstructions, onScreenText, soundSuggestion }, i) => ({ sequence: i + 1, narration: n, visualInstructions, onScreenText, soundSuggestion })) } }, { onSuccess: refresh });
  function patchScene(index: number, patch: Partial<ScriptScene>) { setScenes(current => current.map((scene, i) => i === index ? { ...scene, ...patch } : scene)); }
  return <div className="page-enter"><Link href="/scripts" className="back-link"><ArrowLeft size={15} /> Script desk</Link><PageHeading eyebrow={`SHORTS SCRIPT / ${script.status}`} title="Edit your draft" description="Sharpen the words and make the visuals practical to shoot." action={<div className="heading-actions"><Status kind={script.status === 'APPROVED' ? 'good' : 'amber'}>{script.status}</Status><Button onClick={save} disabled={update.isPending} testId="button-save-script">{update.isPending ? 'Saving…' : <><Check size={15} /> Save draft</>}</Button><Button variant="primary" onClick={() => approve.mutate({ id: script.id }, { onSuccess: refresh })} disabled={approve.isPending || script.status === 'APPROVED'} testId="button-approve-script"><CheckCircle2 size={15} /> {script.status === 'APPROVED' ? 'Approved' : 'Approve script'}</Button></div>} />
    <div className="script-editor-layout"><div className="script-editor">
      <Panel className="script-copy-panel"><div className="section-title"><span className="section-number">01</span><div><h2>Opening hook</h2><small>Win the first second.</small></div></div><textarea className="editor-hook" value={hook} onChange={e => setHook(e.target.value)} data-testid="input-script-hook" />
        <div className="section-title"><span className="section-number">02</span><div><h2>Narration</h2><small>Read aloud. Short lines land better.</small></div></div><textarea className="editor-narration" value={narration} onChange={e => setNarration(e.target.value)} data-testid="input-script-narration" />
        <div className="form-two"><Field label="Sound and music"><textarea value={sound} onChange={e => setSound(e.target.value)} /></Field><Field label="Call to action"><textarea value={cta} onChange={e => setCta(e.target.value)} /></Field></div>
      </Panel>
      <Panel className="scene-panel"><div className="panel-heading"><div><div className="eyebrow">SHOT-BY-SHOT</div><h2>Scenes <span className="count">{scenes.length}</span></h2></div><div className="heading-actions"><span className="muted small">Visual direction for production</span><Button onClick={() => setScenes(current => [...current, { id: `new-${Date.now()}`, scriptId: script.id, sequence: current.length + 1, narration: '', visualInstructions: '', onScreenText: '', soundSuggestion: '' }])} disabled={scenes.length >= 24} testId="button-add-scene"><Plus size={14} /> Add scene</Button></div></div>
        {scenes.map((scene, i) => <div className="scene-card" key={scene.id || i}><div className="scene-head"><span className="scene-number">SCENE {String(i + 1).padStart(2, '0')}</span><button className="icon-button danger-hover" aria-label={`Remove scene ${i + 1}`} onClick={() => setScenes(current => current.filter((_, index) => index !== i))} data-testid={`button-remove-scene-${i + 1}`}><Trash2 size={14} /></button></div><Field label="Scene narration"><textarea value={scene.narration} onChange={e => patchScene(i, { narration: e.target.value })} /></Field><Field label="Visual instructions"><textarea value={scene.visualInstructions} onChange={e => patchScene(i, { visualInstructions: e.target.value })} /></Field><div className="form-two"><Field label="On-screen text"><input value={scene.onScreenText} onChange={e => patchScene(i, { onScreenText: e.target.value })} /></Field><Field label="Sound suggestion"><input value={scene.soundSuggestion} onChange={e => patchScene(i, { soundSuggestion: e.target.value })} /></Field></div></div>)}
        {!scenes.length && <EmptyState title="No scenes in this draft" text="Regenerate from the script desk to create scene direction." />}
      </Panel>
      {update.isError && <p className="inline-error">Draft did not save. Retry when your connection is back.</p>}
    </div><aside className="script-rail"><Panel><div className="eyebrow">SCRIPT CHECK</div><h3>Before approval</h3><div className="check-row"><CheckCircle2 size={16} /><span>Opening hook is editable</span></div><div className="check-row"><CheckCircle2 size={16} /><span>{scenes.length} production {scenes.length === 1 ? 'scene' : 'scenes'} included</span></div><div className="check-row muted-check"><CircleAlert size={16} /><span>Video generation is not connected</span></div><div className="rail-separator" /><Link href={`/projects/${script.projectId}`} className="text-link">Open linked project <ArrowRight size={14} /></Link></Panel><Panel className="draft-tip"><Clock3 size={17} /><h3>Keep it speakable</h3><p>Read the narration out loud once. Any line that trips your tongue needs another pass.</p></Panel></aside></div>
  </div>;
}

function ProjectsPage() {
  const { data, isLoading, isError, refetch } = useListProjects(); const { data: ideas } = useListIdeas();
  const create = useCreateProject(); const updateName = useUpdateProject(); const updateStatus = useUpdateProjectStatus(); const remove = useDeleteProject(); const refresh = useRefresh();
  const [selectedIdea, setSelectedIdea] = useState(''); const [renaming, setRenaming] = useState<any>(null); const [name, setName] = useState('');
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState('');
  const shown = (data || []).filter(p => !filter || p.status === filter);
  return <div className="page-enter"><PageHeading title="Projects" description="Production lives here. Move a project through the supported workflow as it takes shape." />
    <Panel className="project-create"><div className="project-create-copy"><span className="row-icon project-icon"><Plus size={17} /></span><div><b>Start a production project</b><small>Choose an idea to connect the work.</small></div></div><select value={selectedIdea} onChange={e => setSelectedIdea(e.target.value)} aria-label="Choose source idea" data-testid="select-project-idea"><option value="">Choose source idea…</option>{ideas?.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}</select><Button variant="primary" disabled={!selectedIdea || create.isPending} onClick={() => create.mutate({ data: { ideaId: selectedIdea } }, { onSuccess: p => { refresh(); setLocation(`/projects/${p.id}`); } })} testId="button-create-project">{create.isPending ? 'Creating…' : <><Plus size={15} /> Create project</>}</Button></Panel>
    <div className="toolbar-row"><div className="eyebrow">PRODUCTION BOARD</div><select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter projects" data-testid="select-project-filter"><option value="">All statuses</option>{Object.keys(projectStatusLabel).map(s => <option value={s} key={s}>{projectStatusLabel[s]}</option>)}</select></div>
    {isLoading ? <Loading label="Loading projects" /> : isError ? <ErrorState onRetry={() => refetch()} /> : !shown.length ? <Panel><EmptyState title="No projects in this view" text="Start one from a saved idea. Your idea and production history stay connected." action={<Link href="/ideas" className="button button-secondary">Browse ideas <ArrowRight size={14} /></Link>} /></Panel> :
      <Panel className="table-panel"><div className="table-head project-table"><span>PROJECT</span><span>LINKED IDEA</span><span>STATUS</span><span>SCRIPTS</span><span>UPDATED</span><span /></div>{shown.map(project => <div className="table-row project-table" key={project.id} data-testid={`row-project-${project.id}`}><Link className="project-name-cell" href={`/projects/${project.id}`}><b>{project.name}</b><small>Created {formatDate(project.createdAt)}</small></Link><Link className="linked-idea" href={`/ideas/${project.ideaId}`}>{project.ideaTitle}<ArrowRight size={13} /></Link><select className="inline-status" value={project.status} onChange={e => updateStatus.mutate({ id: project.id, data: { status: e.target.value as ProjectStatus } }, { onSuccess: refresh })} data-testid={`select-project-status-${project.id}`}>{supportedProjects.map(s => <option key={s} value={s}>{projectStatusLabel[s]}</option>)}{!supportedProjects.includes(project.status) && <option value={project.status}>{projectStatusLabel[project.status] || project.status} (read-only)</option>}</select><span className="script-count">{project.scriptCount}</span><span className="date-cell">{formatDate(project.updatedAt)}</span><span className="row-controls"><button className="icon-button" aria-label="Rename project" onClick={() => { setRenaming(project); setName(project.name); }} data-testid={`button-rename-project-${project.id}`}><Pencil size={15} /></button><button className="icon-button danger-hover" aria-label="Delete project" onClick={() => { if (window.confirm(`Delete “${project.name}”?`)) remove.mutate({ id: project.id }, { onSuccess: refresh }); }} data-testid={`button-delete-project-${project.id}`}><Trash2 size={15} /></button></span></div>)}</Panel>}
    <div className="capability-note"><CircleAlert size={15} /><span>Only Idea, Research, Script, Scenes, Ready, and Failed status actions are available. Video generation, publishing, and analytics are not connected.</span></div>
    {renaming && <Modal title="Rename project" onClose={() => setRenaming(null)}><form onSubmit={e => { e.preventDefault(); updateName.mutate({ id: renaming.id, data: { name } }, { onSuccess: () => { setRenaming(null); refresh(); } }); }}><Field label="Project name"><input required maxLength={180} value={name} onChange={e => setName(e.target.value)} data-testid="input-project-name" /></Field><div className="form-actions"><Button onClick={() => setRenaming(null)}>Cancel</Button><Button type="submit" variant="primary" disabled={updateName.isPending}>Save name</Button></div></form></Modal>}
  </div>;
}

function ProjectPage() {
  const { id = '' } = useParams<{ id: string }>(); const { data, isLoading, isError, refetch } = useGetProject(id);
  const statusUpdate = useUpdateProjectStatus(); const update = useUpdateProject(); const [renaming, setRenaming] = useState(false); const [name, setName] = useState('');
  if (isLoading) return <Loading label="Loading production project" />; if (isError || !data) return <ErrorState onRetry={() => refetch()} />;
  const { project, idea, scripts } = data;
  return <div className="page-enter"><Link href="/projects" className="back-link"><ArrowLeft size={15} /> Projects</Link>
    <PageHeading eyebrow={`PROJECT / ${project.id.slice(0, 8).toUpperCase()}`} title={project.name} description={`A production workspace for “${idea.title}”.`} action={<Button onClick={() => { setName(project.name); setRenaming(true); }} testId="button-rename-current-project"><Pencil size={15} /> Rename</Button>} />
    <div className="project-detail-grid"><div className="project-detail-main"><Panel className="workflow-panel"><div className="panel-heading"><div><div className="eyebrow">SUPPORTED WORKFLOW</div><h2>Production status</h2></div><Status kind={statusKind(project.status)}>{projectStatusLabel[project.status] || project.status}</Status></div><div className="workflow-steps">{supportedProjects.filter(s => s !== 'FAILED').map((s, i) => <button key={s} className={`workflow-step ${project.status === s ? 'current' : ''} ${supportedProjects.indexOf(project.status) > i ? 'complete' : ''}`} onClick={() => statusUpdate.mutate({ id: project.id, data: { status: s } })} data-testid={`button-status-${s.toLowerCase()}`}><span>{supportedProjects.indexOf(project.status) > i ? <Check size={14} /> : String(i + 1).padStart(2, '0')}</span><b>{projectStatusLabel[s]}</b></button>)}</div><div className="workflow-fail"><button onClick={() => statusUpdate.mutate({ id: project.id, data: { status: 'FAILED' } })} data-testid="button-status-failed"><CircleAlert size={14} /> Mark failed</button><small>Status changes are saved immediately.</small></div></Panel>
      <Panel><div className="panel-heading"><div><div className="eyebrow">LINKED SOURCE</div><h2>Idea behind this project</h2></div><Link href={`/ideas/${idea.id}`} className="text-link">Open idea <ArrowRight size={14} /></Link></div><div className="source-card"><span className="row-icon idea-icon"><Lightbulb size={16} /></span><div><b>{idea.title}</b><p>{idea.hook}</p><div className="generated-meta"><span>{idea.format}</span><span>{idea.estimatedDuration}s</span><Status kind={statusKind(idea.status)}>{ideaStatusLabel[idea.status]}</Status></div></div></div></Panel>
      <Panel><div className="panel-heading"><div><div className="eyebrow">WRITING</div><h2>Scripts <span className="count">{scripts.length}</span></h2></div><Link href="/scripts" className="button button-secondary button-small"><Plus size={14} /> New script</Link></div>{scripts.length ? <div className="compact-list">{scripts.map(script => <Link href={`/scripts/${script.id}`} key={script.id} className="list-row" data-testid={`link-project-script-${script.id}`}><span className="row-icon script-icon"><Clapperboard size={16} /></span><span className="row-main"><b>{script.hook || 'Untitled script'}</b><small>{script.scenes.length} scenes · {formatDate(script.updatedAt)}</small></span><Status kind={script.status === 'APPROVED' ? 'good' : 'amber'}>{script.status}</Status><ArrowRight size={15} /></Link>)}</div> : <EmptyState title="No script attached" text="Use Script desk to generate a draft from the linked idea." action={<Link href="/scripts" className="text-link">Open Script desk <ArrowRight size={14} /></Link>} />}</Panel>
    </div><aside className="project-detail-rail"><Panel><div className="eyebrow">PROJECT SNAPSHOT</div><div className="snapshot-number">{project.scriptCount}</div><div className="snapshot-label">scripts in this project</div><div className="rail-separator" /><InfoLine label="Created" value={formatDate(project.createdAt)} /><InfoLine label="Last updated" value={formatDate(project.updatedAt)} /></Panel><Panel className="integration-warning"><CircleAlert size={17} /><h3>Production boundaries</h3><p>This workspace tracks ideas, scripts, and scenes. Video generation, publishing, and analytics aren’t connected yet.</p></Panel></aside></div>
    {renaming && <Modal title="Rename project" onClose={() => setRenaming(false)}><form onSubmit={e => { e.preventDefault(); update.mutate({ id: project.id, data: { name } }, { onSuccess: () => { setRenaming(false); queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(id) }); } }); }}><Field label="Project name"><input required value={name} onChange={e => setName(e.target.value)} /></Field><div className="form-actions"><Button onClick={() => setRenaming(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={update.isPending}>Save name</Button></div></form></Modal>}
  </div>;
}

function NotFound() { return <div className="page-enter"><div className="not-found"><span className="eyebrow">404 / NOT IN THE CUT</span><h1>This page isn’t in the project.</h1><p>The address may have changed, or this page is still a rough cut.</p><Link href="/" className="button button-primary">Back to overview <ArrowRight size={15} /></Link></div></div>; }

export default App;
