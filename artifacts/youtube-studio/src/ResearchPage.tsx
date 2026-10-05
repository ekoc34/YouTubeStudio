import { useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetResearchStatus, useListResearchSessions, useGetResearchSession,
  useSearchResearch, useGetTrendingResearch, useResearchChannel,
  useAnalyzeResearchSession, useGenerateResearchOpportunities, useAnalyzeResearchChannel,
  useCreateIdeaFromResearch, getGetResearchStatusQueryKey, getListResearchSessionsQueryKey,
  getGetResearchSessionQueryKey, getListIdeasQueryKey,
} from '@workspace/api-client-react';
import type {
  ResearchSessionDetail, ResearchSession, ResearchVideo, ResearchSource,
  EvidenceFinding, ContentOpportunity, ResearchSearchInput,
} from '@workspace/api-client-react';
import {
  Search, TrendingUp, UserRoundSearch, History, CircleAlert, ExternalLink,
  Sparkles, ArrowRight, Youtube, CalendarDays, Database, Clapperboard,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';

type Tab = 'search' | 'popular' | 'channel' | 'history';
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Unavailable';
const metric = (value: number | null) => value === null ? 'Unavailable' : new Intl.NumberFormat().format(value);

export default function ResearchPage() {
  const [tab, setTab] = useState<Tab>('search');
  const status = useGetResearchStatus();
  const sessions = useListResearchSessions();
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const session = useGetResearchSession(activeSession || '', { query: { enabled: !!activeSession, queryKey: getGetResearchSessionQueryKey(activeSession || '') } });
  const [latestResult, setLatestResult] = useState<ResearchSessionDetail | null>(null);
  const client = useQueryClient();
  const [, navigate] = useLocation();
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: getGetResearchStatusQueryKey() }),
    client.invalidateQueries({ queryKey: getListResearchSessionsQueryKey() }),
    client.invalidateQueries({ queryKey: getListIdeasQueryKey() }),
  ]);
  const youtubeReady = status.data?.youtubeConfigured === true;
  const aiReady = status.data?.aiConfigured === true;
  const details = latestResult || session.data || null;
  return <div className="page-enter research-page">
    <div className="research-hero">
      <div className="research-hero-copy"><div className="eyebrow">EVIDENCE DESK / PHASE 02</div><h1>Research what’s <em>actually</em> working.</h1><p>Inspect public YouTube results, trace every finding to its source, then shape a distinct idea of your own.</p></div>
      <div className="research-proof"><span><Database size={15} /> Public-source evidence</span><span><CircleAlert size={15} /> No estimated metrics</span></div>
    </div>
    {status.isLoading ? <div className="research-status-skeleton" data-testid="state-research-status-loading"><i /><i /></div> : status.isError ?
      <div className="research-alert is-error" data-testid="state-research-status-error"><CircleAlert size={17} /><span>Provider status could not be checked.</span><button onClick={() => status.refetch()} data-testid="button-retry-research-status">Retry</button></div> :
      !youtubeReady && <div className="research-alert is-warning" data-testid="state-youtube-unavailable"><CircleAlert size={17} /><div><b>YouTube research unavailable</b><p>Real research requires connecting/configuring the YouTube Data API.</p></div></div>}
    {!status.isLoading && !status.isError && !aiReady && <div className="research-ai-note" data-testid="state-ai-unavailable"><Sparkles size={15} /><span>AI findings and opportunities are unavailable until an AI provider is configured. Real-data research remains separate.</span></div>}
    <div className="research-tabs" role="tablist" aria-label="Research tools">
      {([
        ['search', Search, 'Topic search'], ['popular', TrendingUp, 'Most popular'], ['channel', UserRoundSearch, 'Channel research'], ['history', History, 'Saved research'],
      ] as const).map(([key, Icon, label]) => <button type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'selected' : ''} key={key} onClick={() => setTab(key)} data-testid={`tab-research-${key}`}><Icon size={15} />{label}</button>)}
    </div>
    <div className="research-workspace">
      <div className="research-primary">
        {tab === 'search' && <SearchForm available={youtubeReady && !status.isLoading} onResult={result => { setLatestResult(result); setActiveSession(result.session.id); refresh(); }} />}
        {tab === 'popular' && <PopularPanel available={youtubeReady && !status.isLoading} onResult={result => { setLatestResult(result); setActiveSession(result.session.id); refresh(); }} />}
        {tab === 'channel' && <ChannelPanel available={youtubeReady && !status.isLoading} aiAvailable={aiReady} onResult={result => { setLatestResult(result); setActiveSession(result.session.id); refresh(); }} />}
        {tab === 'history' && <HistoryPanel sessions={sessions.data || []} loading={sessions.isLoading} error={sessions.isError} retry={() => sessions.refetch()} selected={activeSession} onSelect={id => { setActiveSession(id); setLatestResult(null); }} />}
        {tab !== 'history' && details && <SessionResults detail={details} aiAvailable={aiReady} onCreated={idea => { refresh(); navigate(`/ideas/${idea.id}`); }} />}
      </div>
      <aside className="research-rail">
        <div className="research-rail-heading"><div className="eyebrow">RECENT SESSIONS</div><span className="research-count">{sessions.data?.length ?? '—'}</span></div>
        {sessions.isLoading ? <div className="research-history-skeleton"><i /><i /><i /></div> : sessions.isError ? <div className="research-inline-error" data-testid="state-history-error">Couldn’t load saved research. <button onClick={() => sessions.refetch()} data-testid="button-retry-history">Retry</button></div> : sessions.data?.length ? <div className="research-rail-list">{sessions.data.slice(0, 8).map(item => <button key={item.id} className={`research-rail-item ${activeSession === item.id ? 'active' : ''}`} onClick={() => { setActiveSession(item.id); setLatestResult(null); }} data-testid={`button-open-session-${item.id}`}><span className="rail-item-type">{item.kind === 'POPULAR' ? 'CHART' : item.kind}</span><b>{item.query || 'Channel lookup'}</b><small>{item.resultCount} results · {dateLabel(item.retrievedAt || item.createdAt)}</small></button>)}</div> : <div className="research-rail-empty" data-testid="state-history-empty">Completed searches will be saved here.</div>}
        <div className="research-rail-foot"><span className="live-dot" />{youtubeReady ? 'Source connection ready' : 'Source connection needed'}</div>
      </aside>
    </div>
  </div>;
}

function SearchForm({ available, onResult }: { available: boolean; onResult: (detail: ResearchSessionDetail) => void }) {
  const search = useSearchResearch();
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('en');
  const [region, setRegion] = useState('US');
  const [contentType, setContentType] = useState<ResearchSearchInput['contentType']>('BOTH');
  const [timeRange, setTimeRange] = useState<ResearchSearchInput['timeRange']>('MONTH');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!available || (timeRange === 'CUSTOM' && (!startDate || !endDate))) return;
    search.mutate({ data: { query: query.trim(), language, region: region.toUpperCase(), contentType, timeRange, startDate: timeRange === 'CUSTOM' ? startDate : null, endDate: timeRange === 'CUSTOM' ? endDate : null } }, { onSuccess: onResult });
  }
  return <section className="research-form-panel panel" data-testid="panel-topic-search"><div className="panel-heading"><div><div className="eyebrow">SEARCH REAL VIDEOS</div><h2>Find evidence by topic</h2></div><span className="research-step">01 / SEARCH</span></div>
    <form className="research-form" onSubmit={submit}>
      <label className="field research-query-field"><span>Topic or phrase</span><div className="research-input-wrap"><Search size={17} /><input required maxLength={200} value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. one-pan meals for busy nights" data-testid="input-research-query" /></div></label>
      <div className="research-filter-grid">
        <label className="field"><span>Language</span><input required minLength={2} maxLength={10} value={language} onChange={e => setLanguage(e.target.value)} data-testid="input-research-language" /></label>
        <label className="field"><span>Region · 2 letters</span><input required minLength={2} maxLength={2} value={region} onChange={e => setRegion(e.target.value.toUpperCase())} data-testid="input-research-region" /></label>
        <label className="field"><span>Content length</span><select value={contentType} onChange={e => setContentType(e.target.value as ResearchSearchInput['contentType'])} data-testid="select-research-content-type"><option value="BOTH">All lengths</option><option value="SHORTS">Shorts-length</option><option value="LONG_FORM">Long-form</option></select></label>
        <label className="field"><span>Published within</span><select value={timeRange} onChange={e => setTimeRange(e.target.value as ResearchSearchInput['timeRange'])} data-testid="select-research-time-range"><option value="TODAY">Today</option><option value="WEEK">Past week</option><option value="MONTH">Past month</option><option value="CUSTOM">Custom dates</option></select></label>
      </div>
      {timeRange === 'CUSTOM' && <div className="research-filter-grid custom-dates"><label className="field"><span>Start date</span><input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} data-testid="input-research-start-date" /></label><label className="field"><span>End date</span><input type="date" required min={startDate || undefined} value={endDate} onChange={e => setEndDate(e.target.value)} data-testid="input-research-end-date" /></label></div>}
      <div className="research-form-footer"><span>Search only runs when you submit. Every result links to its public source.</span><button className="button button-primary" type="submit" disabled={!available || search.isPending} data-testid="button-submit-research">{search.isPending ? 'Searching YouTube…' : <><Search size={14} /> Search YouTube</>}</button></div>
    </form>
    {search.isError && <div className="research-inline-error" data-testid="state-search-error">The search didn’t complete. Check provider access and try again. <button type="button" onClick={() => search.reset()} data-testid="button-dismiss-search-error">Dismiss</button></div>}
    {!available && <p className="research-disabled-caption">Connect/configure the YouTube Data API before searching public results.</p>}
  </section>;
}

function PopularPanel({ available, onResult }: { available: boolean; onResult: (detail: ResearchSessionDetail) => void }) {
  const trending = useGetTrendingResearch();
  const [region, setRegion] = useState('US');
  const [contentType, setContentType] = useState<'BOTH' | 'SHORTS' | 'LONG_FORM'>('BOTH');
  return <section className="research-form-panel panel"><div className="panel-heading"><div><div className="eyebrow">YOUTUBE CHART</div><h2>Most popular, by region</h2></div><span className="chart-stamp"><TrendingUp size={14} /> CHART RESULT</span></div><p className="research-description">A snapshot of YouTube’s most-popular chart, not a measured growth trend.</p>
    <form className="research-popular-form" onSubmit={e => { e.preventDefault(); if (available) trending.mutate({ data: { region: region.toUpperCase(), contentType } }, { onSuccess: onResult }); }}>
      <label className="field"><span>Region · 2 letters</span><input required minLength={2} maxLength={2} value={region} onChange={e => setRegion(e.target.value.toUpperCase())} data-testid="input-popular-region" /></label>
      <label className="field"><span>Content length</span><select value={contentType} onChange={e => setContentType(e.target.value as typeof contentType)} data-testid="select-popular-content-type"><option value="BOTH">All lengths</option><option value="SHORTS">Shorts-length</option><option value="LONG_FORM">Long-form</option></select></label>
      <button className="button button-primary" type="submit" disabled={!available || trending.isPending} data-testid="button-load-popular">{trending.isPending ? 'Loading chart…' : <><TrendingUp size={14} /> Load chart</>}</button>
    </form>{trending.isError && <div className="research-inline-error" data-testid="state-popular-error">Chart unavailable. Try again. <button onClick={() => trending.reset()} data-testid="button-dismiss-popular-error">Dismiss</button></div>}
  </section>;
}

function ChannelPanel({ available, aiAvailable, onResult }: { available: boolean; aiAvailable: boolean; onResult: (detail: ResearchSessionDetail) => void }) {
  const lookup = useResearchChannel();
  const [channelUrlOrId, setChannelUrlOrId] = useState('');
  const [result, setResult] = useState<ResearchSessionDetail | null>(null);
  const analyze = useAnalyzeResearchChannel();
  const [analysis, setAnalysis] = useState<ResearchSessionDetail['channelAnalysis']>(null);
  return <section className="research-form-panel panel"><div className="panel-heading"><div><div className="eyebrow">CHANNEL FIELD NOTES</div><h2>Inspect a public channel</h2></div><span className="research-step">CHANNEL / LOOKUP</span></div><p className="research-description">Lookup returns real channel counts and a recent-video sample. Analysis is an explicit second step.</p>
    <form className="research-channel-form" onSubmit={e => { e.preventDefault(); if (available) lookup.mutate({ data: { channelUrlOrId: channelUrlOrId.trim() } }, { onSuccess: data => { setResult(data); setAnalysis(data.channelAnalysis); onResult(data); } }); }}>
      <label className="field"><span>Channel URL or ID</span><input required minLength={3} maxLength={300} value={channelUrlOrId} onChange={e => setChannelUrlOrId(e.target.value)} placeholder="youtube.com/@channel or UC…" data-testid="input-channel-url" /></label>
      <button className="button button-primary" type="submit" disabled={!available || lookup.isPending} data-testid="button-lookup-channel">{lookup.isPending ? 'Looking up…' : <><UserRoundSearch size={14} /> Look up channel</>}</button>
    </form>{lookup.isError && <div className="research-inline-error" data-testid="state-channel-error">Channel lookup failed. Check the URL or provider access. <button onClick={() => lookup.reset()} data-testid="button-dismiss-channel-error">Dismiss</button></div>}
    {result?.channel && <div className="channel-result" data-testid="result-channel"><div className="channel-result-title"><div><div className="eyebrow">REAL CHANNEL DATA</div><h3>{result.channel.title}</h3><small>{result.channel.customUrl || result.channel.channelId}</small></div><span className="source-stamp">{result.session.dataSource}</span></div><div className="channel-metrics"><Metric label="Subscribers" value={metric(result.channel.subscriberCount)} /><Metric label="Channel views" value={metric(result.channel.viewCount)} /><Metric label="Videos" value={metric(result.channel.videoCount)} /><Metric label="Avg. recent views" value={metric(result.channel.averageRecentViews)} /></div><p className="sample-note">Average from {result.channel.averageViewsSampleSize} recent videos · Retrieved {dateLabel(result.channel.retrievedAt)}</p>
      <button className="button button-secondary" type="button" disabled={!aiAvailable || analyze.isPending} onClick={() => analyze.mutate({ id: result.session.id }, { onSuccess: data => { setAnalysis(data); } })} data-testid="button-analyze-channel"><Sparkles size={14} />{analyze.isPending ? 'Analyzing…' : 'Analyze channel'}</button>{!aiAvailable && <p className="research-disabled-caption">AI analysis is unavailable until an AI provider is configured.</p>}{analyze.isError && <div className="research-inline-error" data-testid="state-channel-analysis-error">Analysis failed. Try again.</div>}
      {analysis && <AnalysisBlock title="AI CHANNEL ANALYSIS" summary={analysis.summary} groups={[['Strengths', analysis.strengths], ['Repeated patterns', analysis.repeatedPatterns], ['Strong hooks', analysis.strongHooks], ['Weaknesses', analysis.weaknesses], ['Content gaps', analysis.contentGaps], ['Originality opportunities', analysis.originalityOpportunities]]} videos={result.videos} reminder={analysis.originalityReminder} />}
      <div className="research-subheading"><span>Recent public videos</span><b>{result.videos.length} sampled</b></div><VideoList videos={result.videos} />
    </div>}
  </section>;
}

function HistoryPanel({ sessions, loading, error, retry, selected, onSelect }: { sessions: ResearchSession[]; loading: boolean; error: boolean; retry: () => void; selected: string | null; onSelect: (id: string) => void }) {
  return <section className="research-form-panel panel"><div className="panel-heading"><div><div className="eyebrow">SAVED EVIDENCE</div><h2>Research history</h2></div><History size={17} className="panel-icon" /></div>
    {loading ? <div className="research-history-skeleton"><i /><i /><i /></div> : error ? <div className="empty-state" data-testid="state-history-panel-error"><CircleAlert size={20} /><h3>History couldn’t load</h3><p>Your saved sessions are still safe. Try loading them again.</p><button className="button button-secondary" onClick={retry} data-testid="button-history-panel-retry">Retry</button></div> : !sessions.length ? <div className="research-empty" data-testid="state-history-panel-empty"><History size={22} /><h3>No saved research yet</h3><p>Submit a topic search, load a chart, or look up a channel. Completed sessions are saved here automatically.</p></div> :
      <div className="research-history-list">{sessions.map(item => <button className={`research-history-row ${selected === item.id ? 'active' : ''}`} onClick={() => onSelect(item.id)} key={item.id} data-testid={`button-history-${item.id}`}><span className="history-kind">{item.kind}</span><span className="history-main"><b>{item.query || 'Channel lookup'}</b><small>{item.resultCount} results · {item.filters.region || 'No region'} · {item.dataSource}</small></span><span className="history-date">{dateLabel(item.retrievedAt || item.createdAt)}</span><ArrowRight size={15} /></button>)}</div>}
  </section>;
}

function SessionResults({ detail, aiAvailable, onCreated }: { detail: ResearchSessionDetail; aiAvailable: boolean; onCreated: (idea: { id: string }) => void }) {
  const client = useQueryClient();
  const createIdea = useCreateIdeaFromResearch();
  const analyze = useAnalyzeResearchSession();
  const generate = useGenerateResearchOpportunities();
  const [trend, setTrend] = useState(detail.trendAnalysis);
  const [opportunities, setOpportunities] = useState(detail.opportunities);
  const isChannel = detail.session.kind === 'CHANNEL';
  const invalidateAll = () => Promise.all([
    client.invalidateQueries({ queryKey: getGetResearchStatusQueryKey() }),
    client.invalidateQueries({ queryKey: getListResearchSessionsQueryKey() }),
    client.invalidateQueries({ queryKey: getGetResearchSessionQueryKey(detail.session.id) }),
    client.invalidateQueries({ queryKey: getListIdeasQueryKey() }),
  ]);
  function create(sourceType: 'VIDEO' | 'OPPORTUNITY', sourceId: string) {
    createIdea.mutate({ data: { sessionId: detail.session.id, sourceType, sourceId } }, { onSuccess: idea => { invalidateAll(); onCreated(idea); } });
  }
  return <div className="research-results" data-testid={`result-session-${detail.session.id}`}>
    <section className="research-result-head panel"><div><div className="eyebrow">REAL DATA / {detail.session.kind}</div><h2>{detail.session.query || detail.channel?.title || 'Saved research session'}</h2><p>{detail.session.resultCount} public results · {detail.session.dataSource}</p></div><div className="result-stamps"><span><Database size={13} /> {detail.session.dataSource}</span><small>Retrieved {dateLabel(detail.session.retrievedAt)}</small></div></section>
    {detail.session.errorMessage && <div className="research-alert is-error" data-testid="state-session-error"><CircleAlert size={16} />{detail.session.errorMessage}</div>}
    {!detail.videos.length && !detail.channel && <div className="research-empty panel" data-testid="state-no-results"><Youtube size={22} /><h3>No public results found</h3><p>This completed session returned no videos. Adjust the filters and submit another search.</p></div>}
    {detail.channel && <section className="panel saved-channel-card"><div className="eyebrow">REAL CHANNEL DATA</div><h3>{detail.channel.title}</h3><div className="channel-metrics"><Metric label="Subscribers" value={metric(detail.channel.subscriberCount)} /><Metric label="Views" value={metric(detail.channel.viewCount)} /><Metric label="Videos" value={metric(detail.channel.videoCount)} /><Metric label="Average recent views" value={metric(detail.channel.averageRecentViews)} /></div><p className="sample-note">Recent-view sample size: {detail.channel.averageViewsSampleSize} · {detail.channel.dataSource || detail.session.dataSource} · Retrieved {dateLabel(detail.channel.retrievedAt)}</p></section>}
    {detail.videos.length > 0 && <section className="panel real-videos"><div className="panel-heading"><div><div className="eyebrow">REAL DATA</div><h2>{isChannel ? 'Recent public videos' : detail.session.kind === 'POPULAR' ? 'Most popular chart results' : 'Video results'} <span className="count">{detail.videos.length}</span></h2></div><span className="results-trust"><Database size={13} /> Source-backed</span></div><VideoList videos={detail.videos} onCreate={id => create('VIDEO', id)} busy={createIdea.isPending} /></section>}
    {createIdea.isError && <div className="research-inline-error" data-testid="state-create-idea-error">Couldn’t create the idea from this evidence. Try again.</div>}
    {!isChannel && <section className="panel ai-analysis-panel"><div className="panel-heading"><div><div className="eyebrow">AI FINDINGS / SEPARATE FROM REAL DATA</div><h2>Pattern analysis</h2></div><span className={`ai-state ${aiAvailable ? 'ready' : ''}`}>{aiAvailable ? 'AI available' : 'AI unavailable'}</span></div><p className="research-description">Analysis is an interpretation of this stored sample, not a measurement of growth or performance over time.</p>
      {aiAvailable && <button className="button button-secondary" onClick={() => analyze.mutate({ id: detail.session.id }, { onSuccess: result => setTrend(result) })} disabled={analyze.isPending} data-testid="button-analyze-session"><Sparkles size={14} />{analyze.isPending ? 'Analyzing evidence…' : 'Analyze stored results'}</button>}
      {analyze.isError && <div className="research-inline-error" data-testid="state-session-analysis-error">Analysis failed. Retry when AI is available.</div>}
      {trend ? <AnalysisBlock title={trend.analysisLabel || 'AI TREND ANALYSIS'} summary={trend.summary} groups={[['Frequent topics', trend.frequentTopics], ['Rising topics', trend.risingTopics], ['Repeated formats', trend.repeatedFormats], ['Common hooks', trend.commonHooks], ['Title structures', trend.titleStructures], ['Content gaps', trend.contentGaps], ['Audience interests', trend.audienceInterests], ['Original opportunities', trend.originalOpportunities]]} videos={detail.videos} textGroups={[['Length patterns', trend.lengthPatterns]]} /> : <p className="ai-empty" data-testid="state-analysis-empty">{aiAvailable ? 'Run an analysis to surface evidence-linked patterns.' : 'Configure an AI provider to analyze these stored results.'}</p>}
    </section>}
    {!isChannel && <section className="panel opportunities-panel"><div className="panel-heading"><div><div className="eyebrow">AI-ASSISTED / ORIGINAL ANGLES</div><h2>Content opportunities</h2></div><span className={`ai-state ${aiAvailable ? 'ready' : ''}`}>{aiAvailable ? 'AI available' : 'AI unavailable'}</span></div>
      {aiAvailable && <button className="button button-secondary" onClick={() => generate.mutate({ id: detail.session.id }, { onSuccess: setOpportunities })} disabled={generate.isPending} data-testid="button-generate-opportunities"><Sparkles size={14} />{generate.isPending ? 'Finding opportunities…' : 'Find opportunities'}</button>}
      {generate.isError && <div className="research-inline-error" data-testid="state-opportunities-error">Couldn’t generate opportunities. Try again.</div>}
      {!opportunities.length ? <p className="ai-empty" data-testid="state-opportunities-empty">{aiAvailable ? 'No opportunities have been generated for this session.' : 'Configure an AI provider to generate original opportunities.'}</p> : <div className="opportunity-list">{opportunities.map(opp => <OpportunityCard key={opp.id} opportunity={opp} onCreate={() => create('OPPORTUNITY', opp.id)} creating={createIdea.isPending} />)}</div>}
    </section>}
  </div>;
}

function VideoList({ videos, onCreate, busy = false }: { videos: ResearchVideo[]; onCreate?: (id: string) => void; busy?: boolean }) {
  if (!videos.length) return <div className="research-empty" data-testid="state-videos-empty"><Youtube size={19} /><h3>No videos in this sample</h3><p>There are no stored public video results in this session.</p></div>;
  return <div className="research-video-list">{videos.map(video => <article className="research-video-row" key={video.id} data-testid={`card-research-video-${video.id}`}>
    {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" loading="lazy" /> : <div className="video-thumb-fallback"><Clapperboard size={17} /></div>}
    <div className="research-video-copy"><a href={video.url} target="_blank" rel="noreferrer" className="research-video-title" data-testid={`link-research-video-${video.id}`}>{video.title}<ExternalLink size={12} /></a><span>{video.channelTitle} · {dateLabel(video.publishedAt)}</span><div className="video-metrics"><b>{metric(video.viewCount)}<small> views</small></b><b>{metric(video.likeCount)}<small> likes</small></b><b>{metric(video.commentCount)}<small> comments</small></b></div><div className="video-provenance"><span>{durationLabel(video.durationSeconds)}</span><span>{video.dataSource}</span><span>Retrieved {dateLabel(video.retrievedAt)}</span></div></div>
    {onCreate && <button className="button button-secondary button-small video-create" onClick={() => onCreate(video.id)} disabled={busy} data-testid={`button-create-idea-video-${video.id}`}>Create idea <ArrowRight size={13} /></button>}
  </article>)}</div>;
}

function durationLabel(duration: number | null) {
  if (duration === null) return 'Unavailable';
  return duration <= 180 ? 'Shorts-length (≤180 seconds)' : 'Long-form (>180 seconds)';
}

function OpportunityCard({ opportunity, onCreate, creating }: { opportunity: ContentOpportunity; onCreate: () => void; creating: boolean }) {
  return <article className="opportunity-card" data-testid={`card-opportunity-${opportunity.id}`}><div className="opportunity-top"><div><span className="eyebrow">ORIGINAL ANGLE</span><h3>{opportunity.topic}</h3></div><div className="opportunity-score"><b>{opportunity.potentialScore}</b><small>AI estimate / 100</small></div></div><div className="opportunity-tags"><span>Competition: {opportunity.competitionLevel.toLowerCase()}</span><span>Confidence: {opportunity.confidence.toLowerCase()}</span><span>{opportunity.scoreLabel}</span></div>
    <p><b>Evidence</b>{opportunity.evidence}</p><p><b>Why it’s interesting</b>{opportunity.whyInteresting}</p><p><b>Score reasoning</b>{opportunity.scoreReason}</p><p><b>Suggested format</b>{opportunity.suggestedFormat}</p><blockquote>{opportunity.suggestedHook}</blockquote>
    <ul className="originality-list">{opportunity.originalityConsiderations.map((item, i) => <li key={i}>{item}</li>)}</ul>
    <EvidenceLinks sources={opportunity.sourceVideos} />
    <button className="button button-primary button-small" onClick={onCreate} disabled={creating} data-testid={`button-create-idea-opportunity-${opportunity.id}`}>Create idea <ArrowRight size={13} /></button>
  </article>;
}

function AnalysisBlock({ title, summary, groups, videos, textGroups = [], reminder }: { title: string; summary: string; groups: [string, EvidenceFinding[]][]; videos: ResearchVideo[]; textGroups?: [string, string[]][]; reminder?: string }) {
  const sources = videos.map(v => ({ id: v.id, videoId: v.videoId, title: v.title, channelId: v.channelId, channelTitle: v.channelTitle, publishedAt: v.publishedAt, url: v.url, viewCount: v.viewCount, likeCount: v.likeCount, commentCount: v.commentCount, dataSource: v.dataSource, retrievedAt: v.retrievedAt }));
  return <div className="analysis-findings" data-testid="panel-ai-findings"><div className="analysis-disclaimer"><Sparkles size={14} />{title} — interpretation of stored real results, not a statistically measured growth trend.</div><p className="analysis-summary">{summary}</p>{groups.filter(([, items]) => items.length).map(([label, findings]) => <div className="finding-group" key={label}><h3>{label}</h3>{findings.map((finding, index) => <div className="finding-row" key={`${label}-${index}`}><div><b>{finding.insight}</b><p>{finding.evidence}</p><div className="finding-meta">Confidence: {finding.confidence.toLowerCase()}</div></div><EvidenceLinks sources={sources.filter(source => finding.sourceVideoIds.includes(source.videoId || '') || finding.sourceVideoIds.includes(source.id))} /></div>)}</div>)}{textGroups.filter(([, items]) => items.length).map(([label, values]) => <div className="finding-group" key={label}><h3>{label}</h3><ul className="analysis-text-list">{values.map((item, i) => <li key={i}>{item}</li>)}</ul></div>)}{reminder && <p className="originality-reminder">{reminder}</p>}</div>;
}

function EvidenceLinks({ sources }: { sources: ResearchSource[] }) {
  return <div className="evidence-links" data-testid="list-evidence-links">{sources.length ? <>{sources.map(source => <a href={source.url} target="_blank" rel="noreferrer" key={source.id} data-testid={`link-evidence-${source.id}`}>{source.title}<ExternalLink size={11} /></a>)}</> : <span>No linked video sources</span>}</div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="channel-metric" data-testid={`metric-${label.toLowerCase().replaceAll(/[^a-z]+/g, '-')}`}><small>{label}</small><b>{value}</b></div>; }
