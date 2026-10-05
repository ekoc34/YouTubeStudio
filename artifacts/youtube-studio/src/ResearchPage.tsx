import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListIdeasQueryKey,
  getGetResearchSessionQueryKey,
  getListResearchSessionsQueryKey,
  useAnalyzeResearchSession,
  useCreateIdeaFromResearch,
  useGetResearchSession,
  useGetResearchStatus,
  useListResearchSessions,
  useSearchResearch,
} from "@workspace/api-client-react";
import type {
  ContentOpportunity,
  EvidenceFinding,
  Idea,
  ResearchSearchInput,
  ResearchSession,
  ResearchSessionDetail,
  ResearchVideo,
} from "@workspace/api-client-react";
import {
  Check,
  CheckCircle2,
  CircleAlert,
  Database,
  ExternalLink,
  Search,
  Sparkles,
  Youtube,
} from "lucide-react";
import { Link } from "wouter";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import "./ResearchPage.css";

const researchFormSchema = z
  .object({
    query: z.string().trim().min(1, "Enter a topic or search phrase.").max(200),
    language: z.string().min(2).max(10),
    region: z.string().regex(/^[A-Za-z]{2}$/, "Choose a two-letter region."),
    contentType: z.enum(["SHORTS", "LONG_FORM", "BOTH"]),
    timeRange: z.enum(["TODAY", "WEEK", "MONTH", "CUSTOM"]),
    startDate: z.date().nullable(),
    endDate: z.date().nullable(),
  })
  .superRefine((values, context) => {
    if (values.timeRange !== "CUSTOM") return;
    if (!values.startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Choose a start date.",
      });
    }
    if (!values.endDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Choose an end date.",
      });
    }
    if (
      values.startDate &&
      values.endDate &&
      values.endDate < values.startDate
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after the start date.",
      });
    }
  });

type ResearchFormValues = z.infer<typeof researchFormSchema>;

const languageOptions = [
  ["en", "English"],
  ["nl", "Dutch"],
  ["de", "German"],
  ["fr", "French"],
  ["es", "Spanish"],
  ["it", "Italian"],
  ["pt", "Portuguese"],
  ["ja", "Japanese"],
  ["hi", "Hindi"],
  ["ko", "Korean"],
] as const;

const regionOptions = [
  ["US", "United States"],
  ["CA", "Canada"],
  ["GB", "United Kingdom"],
  ["AU", "Australia"],
  ["NZ", "New Zealand"],
  ["IE", "Ireland"],
  ["NL", "Netherlands"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["ES", "Spain"],
  ["IT", "Italy"],
  ["IN", "India"],
  ["JP", "Japan"],
  ["KR", "South Korea"],
  ["BR", "Brazil"],
] as const;

function dateLabel(value?: string | Date | null): string {
  if (!value) return "Unavailable";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function metric(value: number | null): string {
  return value == null ? "Unavailable" : new Intl.NumberFormat().format(value);
}

function durationLabel(seconds: number | null): string {
  if (seconds == null) return "Unavailable";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const twoDigits = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${twoDigits(minutes)}:${twoDigits(remainder)}`
    : `${minutes}:${twoDigits(remainder)}`;
}

export default function ResearchPage() {
  const client = useQueryClient();
  const status = useGetResearchStatus();
  const sessions = useListResearchSessions();
  const search = useSearchResearch();
  const analyze = useAnalyzeResearchSession();
  const createIdea = useCreateIdeaFromResearch();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [latestResult, setLatestResult] =
    useState<ResearchSessionDetail | null>(null);
  const [createdIdeas, setCreatedIdeas] = useState<Record<string, Idea>>({});
  const activeSessionRef = useRef(activeSessionId);
  activeSessionRef.current = activeSessionId;
  const savedSession = useGetResearchSession(activeSessionId ?? "", {
    query: {
      enabled: Boolean(activeSessionId),
      queryKey: getGetResearchSessionQueryKey(activeSessionId ?? ""),
    },
  });

  const form = useForm<ResearchFormValues>({
    resolver: zodResolver(researchFormSchema),
    defaultValues: {
      query: "",
      language: "en",
      region: "US",
      contentType: "BOTH",
      timeRange: "MONTH",
      startDate: null,
      endDate: null,
    },
  });

  const youtubeReady = status.data?.youtubeConfigured === true;
  const aiReady = status.data?.aiConfigured === true;
  const available = youtubeReady && !status.isLoading && !status.isError;
  const detail = latestResult ?? savedSession.data ?? null;
  const history =
    sessions.data?.filter((session) => session.kind === "SEARCH") ?? [];

  function selectSession(session: ResearchSession) {
    search.reset();
    analyze.reset();
    createIdea.reset();
    setLatestResult(null);
    setActiveSessionId(session.id);
  }

  function analyzeSession(sessionId: string, force: boolean) {
    analyze.mutate(
      { id: sessionId, data: { force } },
      {
        onSuccess: (result) => {
          if (activeSessionRef.current === sessionId) {
            setLatestResult(result);
          }
          void client.invalidateQueries({
            queryKey: getGetResearchSessionQueryKey(sessionId),
          });
          void client.invalidateQueries({
            queryKey: getListResearchSessionsQueryKey(),
          });
        },
      },
    );
  }

  function createIdeaFromOpportunity(sessionId: string, opportunityId: string) {
    createIdea.mutate(
      {
        data: {
          sessionId,
          sourceType: "OPPORTUNITY",
          sourceId: opportunityId,
        },
      },
      {
        onSuccess: (idea) => {
          setCreatedIdeas((previous) => ({
            ...previous,
            [opportunityId]: idea,
          }));
          void client.invalidateQueries({
            queryKey: getListIdeasQueryKey(),
          });
        },
      },
    );
  }

  function submitSearch(values: ResearchFormValues) {
    analyze.reset();
    createIdea.reset();
    setLatestResult(null);
    setActiveSessionId(null);
    const data: ResearchSearchInput = {
      ...values,
      query: values.query.trim(),
      language: values.language.trim(),
      region: values.region.toUpperCase(),
      startDate: values.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: values.endDate?.toISOString().slice(0, 10) ?? null,
    };

    search.mutate(
      { data },
      {
        onSuccess: (result) => {
          setLatestResult(result);
          setActiveSessionId(result.session.id);
          void client.invalidateQueries({
            queryKey: getListResearchSessionsQueryKey(),
          });
        },
      },
    );
  }

  return (
    <div className="page-enter research-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUTUBE RESEARCH</div>
          <h1>Search real videos.</h1>
          <p>
            Filter public YouTube results and keep the source details with each
            saved search.
          </p>
        </div>
      </div>

      {status.isLoading && (
        <div
          className="research-status"
          aria-live="polite"
          data-testid="state-research-status-loading"
        >
          Checking YouTube configuration…
        </div>
      )}
      {status.isError && (
        <div
          className="research-status is-error"
          role="alert"
          data-testid="state-research-status-error"
        >
          <CircleAlert size={16} />
          <span>Research provider status could not be checked.</span>
          <button
            className="research-text-button"
            type="button"
            onClick={() => void status.refetch()}
            data-testid="button-retry-research-status"
          >
            Retry
          </button>
        </div>
      )}
      {!status.isLoading && !status.isError && !youtubeReady && (
        <div
          className="research-status is-warning"
          role="status"
          data-testid="state-youtube-unavailable"
        >
          <CircleAlert size={17} />
          <div>
            <b>YouTube Data API is not configured.</b>
            <p>
              Add <code>YOUTUBE_API_KEY</code> through Replit Secrets to run
              real searches. No sample videos or estimated metrics are shown.
            </p>
          </div>
        </div>
      )}
      {!status.isLoading && !status.isError && !aiReady && (
        <div
          className="research-status is-warning"
          role="status"
          data-testid="state-ai-unavailable"
        >
          <CircleAlert size={17} />
          <div>
            <b>AI analysis is not configured.</b>
            <p>
              Saved analyses remain available. Add{" "}
              <code>OPENAI_API_KEY</code> through Replit Secrets to request
              model-generated trend insights and opportunities.
            </p>
          </div>
        </div>
      )}

      <div className="research-layout">
        <main className="research-main">
          <section
            className="panel research-search-panel"
            data-testid="panel-topic-search"
          >
            <div className="panel-heading">
              <div>
                <div className="eyebrow">SEARCH PUBLIC RESULTS</div>
                <h2>Choose a topic and filters</h2>
              </div>
              <span className="research-source-label">
                <Database size={14} /> YouTube Data API
              </span>
            </div>

            <Form {...form}>
              <form
                className="research-form"
                onSubmit={form.handleSubmit(submitSearch)}
              >
                <FormField
                  control={form.control}
                  name="query"
                  render={({ field }) => (
                    <FormItem className="research-form-field">
                      <FormLabel className="research-field-label">
                        Topic or phrase
                      </FormLabel>
                      <FormControl>
                        <div className="research-query-control">
                          <Search size={17} aria-hidden="true" />
                          <Input
                            {...field}
                            maxLength={200}
                            placeholder="e.g. one-pan meals for busy nights"
                            data-testid="input-research-query"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="research-filter-grid">
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem className="research-form-field">
                        <FormLabel className="research-field-label">
                          Language
                        </FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="research-select"
                            data-testid="select-research-language"
                          >
                            {languageOptions.map(([code, label]) => (
                              <option key={code} value={code}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem className="research-form-field">
                        <FormLabel className="research-field-label">
                          Region
                        </FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="research-select"
                            data-testid="select-research-region"
                          >
                            {regionOptions.map(([code, label]) => (
                              <option key={code} value={code}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contentType"
                    render={({ field }) => (
                      <FormItem className="research-form-field">
                        <FormLabel className="research-field-label">
                          Content type
                        </FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="research-select"
                            data-testid="select-research-content-type"
                          >
                            <option value="BOTH">All lengths</option>
                            <option value="SHORTS">Shorts-length</option>
                            <option value="LONG_FORM">Long-form</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timeRange"
                    render={({ field }) => (
                      <FormItem className="research-form-field">
                        <FormLabel className="research-field-label">
                          Published within
                        </FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="research-select"
                            data-testid="select-research-time-range"
                          >
                            <option value="TODAY">Today</option>
                            <option value="WEEK">Past week</option>
                            <option value="MONTH">Past month</option>
                            <option value="CUSTOM">Custom dates</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {form.watch("timeRange") === "CUSTOM" && (
                  <div className="research-filter-grid research-date-grid">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem className="research-form-field">
                          <FormLabel className="research-field-label">
                            Start date
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              value={
                                field.value?.toISOString().slice(0, 10) ?? ""
                              }
                              onChange={(event) =>
                                field.onChange(
                                  event.target.value
                                    ? new Date(
                                        `${event.target.value}T00:00:00.000Z`,
                                      )
                                    : null,
                                )
                              }
                              data-testid="input-research-start-date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem className="research-form-field">
                          <FormLabel className="research-field-label">
                            End date
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              value={
                                field.value?.toISOString().slice(0, 10) ?? ""
                              }
                              onChange={(event) =>
                                field.onChange(
                                  event.target.value
                                    ? new Date(
                                        `${event.target.value}T00:00:00.000Z`,
                                      )
                                    : null,
                                )
                              }
                              data-testid="input-research-end-date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="research-form-footer">
                  <span>
                    Search runs only when submitted. Every result links to its
                    public YouTube source.
                  </span>
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={!available || search.isPending}
                    data-testid="button-submit-research"
                  >
                    <Search size={14} />
                    {search.isPending ? "Searching YouTube…" : "Search YouTube"}
                  </button>
                </div>
              </form>
            </Form>

            {search.isError && (
              <div
                className="research-status is-error"
                role="alert"
                data-testid="state-search-error"
              >
                <CircleAlert size={16} />
                <span>{search.error.message}</span>
                <button
                  className="research-text-button"
                  type="button"
                  onClick={() => search.reset()}
                  data-testid="button-dismiss-search-error"
                >
                  Dismiss
                </button>
              </div>
            )}
          </section>

          {detail && (
            <SessionResults
              detail={detail}
              analyze={analyze}
              onAnalyze={(force) => analyzeSession(detail.session.id, force)}
              createIdea={createIdea}
              createdIdeas={createdIdeas}
              onCreateIdea={(opportunityId) =>
                createIdeaFromOpportunity(detail.session.id, opportunityId)
              }
            />
          )}
          {!detail && activeSessionId && savedSession.isLoading && (
            <div className="loading-state" data-testid="state-session-loading">
              <div className="skeleton-line wide" />
              <div className="skeleton-line" />
              <span>Loading saved research</span>
            </div>
          )}
          {!detail && activeSessionId && savedSession.isError && (
            <div
              className="research-status is-error"
              role="alert"
              data-testid="state-session-error"
            >
              Couldn’t load that saved research.{" "}
              <button
                className="research-text-button"
                type="button"
                onClick={() => void savedSession.refetch()}
              >
                Retry
              </button>
            </div>
          )}
          {!detail && !activeSessionId && !search.isPending && (
            <div className="panel research-start-state">
              <Search size={22} />
              <h3>Search to see real YouTube videos</h3>
              <p>
                Results and available metrics will be saved with the research
                session. Missing metrics will be labeled “Unavailable.”
              </p>
            </div>
          )}
        </main>

        <aside className="panel research-history" aria-label="Saved searches">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">RESEARCH HISTORY</div>
              <h2>Saved searches</h2>
            </div>
            <span className="research-history-count">{history.length}</span>
          </div>
          {sessions.isLoading ? (
            <div
              className="research-history-loading"
              data-testid="state-history-loading"
            >
              Loading saved searches…
            </div>
          ) : sessions.isError ? (
            <div className="research-history-error" role="alert">
              Couldn’t load search history.
              <button
                className="research-text-button"
                type="button"
                onClick={() => void sessions.refetch()}
                data-testid="button-retry-history"
              >
                Retry
              </button>
            </div>
          ) : history.length === 0 ? (
            <div
              className="research-history-empty"
              data-testid="state-history-empty"
            >
              Searches you run will appear here.
            </div>
          ) : (
            <div className="research-history-list">
              {history.map((session) => (
                <button
                  key={session.id}
                  className={`research-history-item ${
                    activeSessionId === session.id ? "is-active" : ""
                  }`}
                  type="button"
                  onClick={() => selectSession(session)}
                  data-testid={`button-open-session-${session.id}`}
                >
                  <span className="research-history-query">{session.query}</span>
                  <span className="research-history-meta">
                    {session.resultCount} results ·{" "}
                    {dateLabel(session.retrievedAt ?? session.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SessionResults({
  detail,
  analyze,
  onAnalyze,
  createIdea,
  createdIdeas,
  onCreateIdea,
}: {
  detail: ResearchSessionDetail;
  analyze: ReturnType<typeof useAnalyzeResearchSession>;
  onAnalyze: (force: boolean) => void;
  createIdea: ReturnType<typeof useCreateIdeaFromResearch>;
  createdIdeas: Record<string, Idea>;
  onCreateIdea: (opportunityId: string) => void;
}) {
  const { session, videos } = detail;
  return (
    <section
      className="panel research-results"
      data-testid={`result-session-${session.id}`}
    >
      <div className="panel-heading research-results-heading">
        <div>
          <div className="eyebrow">SAVED YOUTUBE RESEARCH</div>
          <h2>{session.query}</h2>
          <p>
            {session.resultCount} results · {session.dataSource} ·{" "}
            {dateLabel(session.retrievedAt)}
          </p>
        </div>
        <span className="research-results-status">
          {session.status === "COMPLETED" ? "Saved" : session.status}
        </span>
      </div>

      {session.errorMessage && (
        <div
          className="research-status is-error"
          role="alert"
          data-testid="state-session-failure"
        >
          <CircleAlert size={16} />
          {session.errorMessage}
        </div>
      )}
      {videos.length === 0 ? (
        <div className="research-no-results" data-testid="state-no-results">
          <Youtube size={22} />
          <h3>No public videos found</h3>
          <p>
            This search returned no accessible videos. Try a broader phrase or
            a different time range.
          </p>
        </div>
      ) : (
        <div className="research-video-list">
          {videos.map((video) => (
            <VideoResult key={video.id} video={video} />
          ))}
        </div>
      )}
      <ResearchAnalysis
        detail={detail}
        analysisPending={analyze.isPending}
        analysisError={
          analyze.isError
            ? analyze.error instanceof Error
              ? analyze.error.message
              : "Analysis could not be completed."
            : null
        }
        onAnalyze={onAnalyze}
        onDismissAnalysisError={() => analyze.reset()}
        createPending={createIdea.isPending}
        creatingOpportunityId={createIdea.variables?.data.sourceId}
        createErrorOpportunityId={
          createIdea.isError ? createIdea.variables?.data.sourceId : undefined
        }
        createError={
          createIdea.isError
            ? createIdea.error instanceof Error
              ? createIdea.error.message
              : "The idea could not be added."
            : null
        }
        onDismissCreateError={() => createIdea.reset()}
        createdIdeas={createdIdeas}
        onCreateIdea={onCreateIdea}
      />
    </section>
  );
}

const findingGroups: {
  key: keyof NonNullable<ResearchSessionDetail["trendAnalysis"]>;
  label: string;
}[] = [
  { key: "frequentTopics", label: "Frequent topics" },
  { key: "recurringTopics", label: "Recurring topics" },
  { key: "recurringFormats", label: "Recurring formats" },
  { key: "commonTitlePatterns", label: "Title patterns" },
  { key: "commonHookPatterns", label: "Hook patterns" },
  { key: "commonKeywords", label: "Common keywords" },
  { key: "durationPatterns", label: "Duration patterns" },
  { key: "audienceSignals", label: "Audience signals" },
  { key: "saturationSignals", label: "Saturation signals" },
  { key: "contentGaps", label: "Content gaps" },
];

function ResearchAnalysis({
  detail,
  analysisPending,
  analysisError,
  onAnalyze,
  onDismissAnalysisError,
  createPending,
  creatingOpportunityId,
  createErrorOpportunityId,
  createError,
  onDismissCreateError,
  createdIdeas,
  onCreateIdea,
}: {
  detail: ResearchSessionDetail;
  analysisPending: boolean;
  analysisError: string | null;
  onAnalyze: (force: boolean) => void;
  onDismissAnalysisError: () => void;
  createPending: boolean;
  creatingOpportunityId?: string;
  createErrorOpportunityId?: string;
  createError: string | null;
  onDismissCreateError: () => void;
  createdIdeas: Record<string, Idea>;
  onCreateIdea: (opportunityId: string) => void;
}) {
  const analysis = detail.trendAnalysis;
  const opportunities = detail.opportunities ?? [];
  const hasSavedResult = Boolean(analysis) || opportunities.length > 0;
  const sourcesByVideoId = new Map(
    detail.videos.map((video) => [video.videoId, video]),
  );

  return (
    <section
      className="research-analysis"
      aria-label="Saved-search analysis and opportunities"
      data-testid={`panel-research-analysis-${detail.session.id}`}
    >
      <div className="research-analysis-head">
        <div>
          <div className="eyebrow">EVIDENCE → ORIGINAL ANGLES</div>
          <h3>What the results suggest</h3>
          <p>
            Patterns and opportunities are AI analysis of this saved search,
            not measured channel performance.
          </p>
        </div>
        <button
          className="button button-secondary research-analyze-button"
          type="button"
          onClick={() => onAnalyze(hasSavedResult)}
          disabled={analysisPending || detail.videos.length === 0}
          data-testid={`button-analyze-research-${detail.session.id}`}
        >
          <Sparkles size={14} />
          {analysisPending
            ? "Analyzing saved results…"
            : hasSavedResult
              ? "Re-analyze"
              : "Analyze saved results"}
        </button>
      </div>

      {analysisError && (
        <div
          className="research-status is-error"
          role="alert"
          data-testid="state-analysis-error"
        >
          <CircleAlert size={16} />
          <span>{analysisError}</span>
          <button
            type="button"
            className="research-text-button"
            onClick={onDismissAnalysisError}
            data-testid="button-dismiss-analysis-error"
          >
            Dismiss
          </button>
        </div>
      )}

      {detail.videos.length === 0 && !hasSavedResult && (
        <div
          className="research-analysis-empty"
          data-testid="state-analysis-no-source-videos"
        >
          <CircleAlert size={17} />
          <span>
            There are no saved source videos to analyze. Broaden the search and
            save real results first.
          </span>
        </div>
      )}

      {!hasSavedResult && detail.videos.length > 0 && !analysisPending && (
        <div
          className="research-analysis-empty"
          data-testid="state-analysis-missing"
        >
          <span className="analysis-empty-mark"><Sparkles size={16} /></span>
          <span>
            No saved analysis yet. Nothing runs in the background; analyze this
            result set when you are ready.
          </span>
        </div>
      )}

      {analysisPending && !hasSavedResult && (
        <div className="research-analysis-loading" data-testid="state-analysis-loading">
          <div className="skeleton-line wide" />
          <div className="skeleton-line" />
          <span>Reading the saved evidence</span>
        </div>
      )}

      {analysis && (
        <div className="research-analysis-content">
          <div
            className={`sufficiency-note sufficiency-${analysis.dataSufficiency.toLowerCase()}`}
            data-testid="state-data-sufficiency"
          >
            <div className="sufficiency-topline">
              <span className="sufficiency-label">
                {analysis.dataSufficiency === "INSUFFICIENT"
                  ? "Insufficient evidence"
                  : analysis.dataSufficiency === "LIMITED"
                    ? "Limited evidence"
                    : "Evidence coverage"}
              </span>
              <span className="analysis-qualification">
                {analysis.analysisLabel} · AI analysis
              </span>
            </div>
            <p>{analysis.sufficiencyNote}</p>
          </div>

          <div className="analysis-summary">
            <span className="analysis-summary-index">READOUT</span>
            <p>{analysis.summary}</p>
          </div>

          <div className="finding-groups">
            {findingGroups.map(({ key, label }) => {
              const findings = analysis[key] as EvidenceFinding[];
              if (!findings?.length) return null;
              return (
                <section className="finding-group" key={key}>
                  <div className="finding-group-heading">
                    <h4>{label}</h4>
                    <span>{String(findings.length).padStart(2, "0")}</span>
                  </div>
                  <div className="finding-list">
                    {findings.map((finding, index) => (
                      <article
                        className="finding-row"
                        key={`${key}-${index}`}
                        data-testid={`row-analysis-finding-${key}-${index}`}
                      >
                        <div className="finding-main">
                          <p>{finding.insight}</p>
                          <span>{finding.evidence}</span>
                        </div>
                        <span className="ai-confidence">
                          AI estimate · {finding.confidence.toLowerCase()} confidence
                        </span>
                        <FindingSources
                          ids={finding.sourceVideoIds}
                          sourcesByVideoId={sourcesByVideoId}
                          testPrefix={`${key}-${index}`}
                        />
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {hasSavedResult && opportunities.length === 0 && (
        <div
          className="research-opportunity-empty"
          data-testid="state-opportunities-empty"
        >
          <span className="eyebrow">OPPORTUNITY DESK</span>
          <p>
            No original opportunities were saved for this analysis. Re-analyze
            the evidence to refresh the readout.
          </p>
        </div>
      )}

      {opportunities.length > 0 && (
        <div className="opportunity-section">
          <div className="opportunity-heading">
            <div>
              <div className="eyebrow">BUILT FROM THE EVIDENCE</div>
              <h3>Originality opportunities</h3>
            </div>
            <span className="opportunity-count">
              {String(opportunities.length).padStart(2, "0")} saved
            </span>
          </div>
          <div className="opportunity-list">
            {opportunities.map((opportunity, index) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                index={index}
                createPending={createPending}
                creating={creatingOpportunityId === opportunity.id}
                createdIdea={createdIdeas[opportunity.id]}
                createError={
                  createErrorOpportunityId === opportunity.id ? createError : null
                }
                onDismissCreateError={onDismissCreateError}
                onCreate={() => onCreateIdea(opportunity.id)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function FindingSources({
  ids,
  sourcesByVideoId,
  testPrefix,
}: {
  ids: string[];
  sourcesByVideoId: Map<string, ResearchVideo>;
  testPrefix: string;
}) {
  const sources = ids
    .map((id) => sourcesByVideoId.get(id))
    .filter((source): source is ResearchVideo => Boolean(source));
  if (!sources.length) {
    return <span className="source-unavailable">No returned source links</span>;
  }
  return (
    <div className="analysis-source-links" aria-label="Evidence video sources">
      {sources.map((source) => (
        <a
          key={source.videoId}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          data-testid={`link-analysis-source-${testPrefix}-${source.videoId}`}
        >
          <Youtube size={12} />
          <span>{source.title}</span>
          <ExternalLink size={11} />
        </a>
      ))}
    </div>
  );
}

function OpportunityCard({
  opportunity,
  index,
  createPending,
  creating,
  createdIdea,
  createError,
  onDismissCreateError,
  onCreate,
}: {
  opportunity: ContentOpportunity;
  index: number;
  createPending: boolean;
  creating: boolean;
  createdIdea?: Idea;
  createError: string | null;
  onDismissCreateError: () => void;
  onCreate: () => void;
}) {
  const sourcesById = new Set(opportunity.sourceVideoIds);
  const citedSources = opportunity.sourceVideos.filter(
    (source) => source.videoId && sourcesById.has(source.videoId),
  );
  const minutes = Math.floor(opportunity.suggestedDurationSeconds / 60);
  const seconds = opportunity.suggestedDurationSeconds % 60;

  return (
    <article
      className="opportunity-card"
      data-testid={`row-research-opportunity-${opportunity.id}`}
    >
      <div className="opportunity-card-top">
        <span className="opportunity-index">{String(index + 1).padStart(2, "0")}</span>
        <div className="opportunity-title-block">
          <span className="opportunity-topic">{opportunity.topic}</span>
          <h4>{opportunity.suggestedTitle}</h4>
        </div>
        <div className="opportunity-score">
          <span>{opportunity.scoreLabel}</span>
          <b>{opportunity.potentialScore}<small>/100</small></b>
          <small>AI estimate</small>
        </div>
      </div>

      <p className="opportunity-hook">{opportunity.suggestedHook}</p>
      <div className="opportunity-specs">
        <span>{opportunity.suggestedFormat}</span>
        <span>{minutes ? `${minutes}m ` : ""}{String(seconds).padStart(2, "0")}s suggested</span>
        <span>For {opportunity.targetAudience}</span>
        <span>{opportunity.competitionLevel.toLowerCase()} competition · AI estimate</span>
        <span>{opportunity.confidence.toLowerCase()} confidence · AI estimate</span>
      </div>

      <div className="opportunity-rationale">
        <div><b>Why it may work</b><p>{opportunity.whyInteresting}</p></div>
        <div><b>Observed pattern</b><p>{opportunity.observedPatterns}</p></div>
        <div><b>Originality angle</b><p>{opportunity.originalityAngle}</p></div>
        <div><b>What the score reflects</b><p>{opportunity.scoreReason}</p></div>
        <div><b>Evidence</b><p>{opportunity.evidence}</p></div>
        <div><b>Saturation observed</b><p>{opportunity.saturationEvidence}</p></div>
      </div>

      {opportunity.originalityConsiderations.length > 0 && (
        <div className="originality-notes">
          <b>Keep the execution distinct</b>
          <ul>
            {opportunity.originalityConsiderations.map((note, noteIndex) => (
              <li key={noteIndex}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="opportunity-sources">
        <span className="opportunity-sources-label">
          <Database size={12} /> Returned source videos
        </span>
        {citedSources.length ? (
          <div className="analysis-source-links">
            {citedSources.map((source) => (
              <a
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                data-testid={`link-opportunity-source-${opportunity.id}-${source.videoId}`}
              >
                <Youtube size={12} />
                <span>{source.title} · {source.channelTitle}</span>
                <ExternalLink size={11} />
              </a>
            ))}
          </div>
        ) : (
          <span className="source-unavailable">No returned source links for this angle.</span>
        )}
      </div>

      <div className="opportunity-action-row">
        {createdIdea ? (
          <div className="idea-created-confirmation" data-testid={`state-opportunity-created-${opportunity.id}`}>
            <CheckCircle2 size={15} />
            <span>Added to your Ideas library</span>
            <Link
              href={`/ideas/${createdIdea.id}`}
              className="created-idea-link"
              data-testid={`link-created-idea-${opportunity.id}`}
            >
              Open idea <ExternalLink size={12} />
            </Link>
          </div>
        ) : (
          <button
            type="button"
            className="button button-primary"
            onClick={onCreate}
            disabled={createPending}
            data-testid={`button-create-idea-${opportunity.id}`}
          >
            {creating ? <Check size={14} /> : <Sparkles size={14} />}
            {creating ? "Saving idea…" : "Create idea"}
          </button>
        )}
        {createError && !createdIdea && (
          <div className="opportunity-create-error" role="alert">
            <span>{createError}</span>
            <button
              className="research-text-button"
              type="button"
              onClick={onDismissCreateError}
              data-testid={`button-dismiss-create-idea-error-${opportunity.id}`}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function VideoResult({ video }: { video: ResearchVideo }) {
  return (
    <article
      className="research-video-card"
      data-testid={`card-research-video-${video.id}`}
    >
      <a
        className="research-thumbnail"
        href={video.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open YouTube video: ${video.title}`}
      >
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <span>Thumbnail unavailable</span>
        )}
      </a>
      <div className="research-video-copy">
        <a
          href={video.url}
          target="_blank"
          rel="noreferrer"
          className="research-video-title"
          data-testid={`link-research-video-${video.id}`}
        >
          {video.title}
          <ExternalLink size={13} aria-hidden="true" />
        </a>
        <div className="research-video-subtitle">
          <span>{video.channelTitle}</span>
          <span aria-hidden="true">·</span>
          <span>{dateLabel(video.publishedAt)}</span>
        </div>
        <div className="research-metrics">
          <Metric label="Views" value={metric(video.viewCount)} />
          <Metric label="Likes" value={metric(video.likeCount)} />
          <Metric label="Comments" value={metric(video.commentCount)} />
          <Metric label="Duration" value={durationLabel(video.durationSeconds)} />
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="research-metric">
      <b>{value}</b>
      <small>{label}</small>
    </span>
  );
}
