import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetResearchSessionQueryKey,
  getListResearchSessionsQueryKey,
  useGetResearchSession,
  useGetResearchStatus,
  useListResearchSessions,
  useSearchResearch,
} from "@workspace/api-client-react";
import type {
  ResearchSearchInput,
  ResearchSession,
  ResearchSessionDetail,
  ResearchVideo,
} from "@workspace/api-client-react";
import {
  CalendarDays,
  CircleAlert,
  Database,
  ExternalLink,
  Search,
  Youtube,
} from "lucide-react";
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
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [latestResult, setLatestResult] =
    useState<ResearchSessionDetail | null>(null);
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
  const available = youtubeReady && !status.isLoading && !status.isError;
  const detail = latestResult ?? savedSession.data ?? null;
  const history =
    sessions.data?.filter((session) => session.kind === "SEARCH") ?? [];

  function selectSession(session: ResearchSession) {
    search.reset();
    setLatestResult(null);
    setActiveSessionId(session.id);
  }

  function submitSearch(values: ResearchFormValues) {
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

          {detail && <SessionResults detail={detail} />}
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

function SessionResults({ detail }: { detail: ResearchSessionDetail }) {
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
    </section>
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
