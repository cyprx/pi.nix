import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  const gh = async (args: string[], signal?: AbortSignal): Promise<string> => {
    const result = await pi.exec("gh", args, { signal });
    if (result.code !== 0) {
      const err = result.stderr.trim() || `gh exited with code ${result.code}`;
      throw new Error(err);
    }
    return result.stdout.trim();
  };

  const repoArgs = (repo?: string) => (repo ? ["-R", repo] : []);

  // ───────────────────────────────────────────────────────────────
  // Pull Request tools
  // ───────────────────────────────────────────────────────────────

  pi.registerTool({
    name: "gh_pr_view",
    label: "GitHub: View PR",
    description: "View details of a GitHub pull request (title, body, state, author, branches, URL).",
    parameters: Type.Object({
      pr: Type.Number({ description: "Pull request number" }),
      repo: Type.Optional(Type.String({ description: "Owner/repo (defaults to current repo)" })),
    }),
    async execute(_id, params, signal) {
      const args = [...repoArgs(params.repo), "pr", "view", String(params.pr)];
      const out = await gh(args, signal);
      return { content: [{ type: "text", text: out }] };
    },
  });

  pi.registerTool({
    name: "gh_pr_comments",
    label: "GitHub: Read PR Comments",
    description:
      "Read all comments on a pull request: timeline comments, review comments, and line-level review threads. Uses the local gh CLI.",
    parameters: Type.Object({
      pr: Type.Number({ description: "Pull request number" }),
      repo: Type.Optional(Type.String({ description: "Owner/repo (defaults to current repo)" })),
    }),
    async execute(_id, params, signal, onUpdate) {
      onUpdate?.({ content: [{ type: "text", text: "Fetching PR comments via gh..." }] });

      const r = repoArgs(params.repo);
      const prNum = String(params.pr);

      // Timeline comments (issue-level)
      let timeline = "";
      try {
        timeline = await gh([...r, "pr", "view", prNum, "--comments"], signal);
      } catch (e: any) {
        timeline = `(Could not fetch timeline comments: ${e.message})`;
      }

      // Review summaries (approved/changes-requested comments)
      let reviews = "";
      try {
        const raw = await gh(
          [...r, "pr", "view", prNum, "--json", "reviews", "-q", ".reviews[] | \"---\\nAuthor: \\(.author.login)\\nState: \\(.state)\\nBody: \\(.body)\\n\""],
          signal
        );
        reviews = raw || "(no review summaries)";
      } catch (e: any) {
        reviews = `(Could not fetch reviews: ${e.message})`;
      }

      // Line-level review threads via API
      let lineComments = "";
      try {
        const raw = await gh(
          [...r, "api", `repos/{owner}/{repo}/pulls/${prNum}/comments`, "--paginate", "-q", ".[] | \"---\\nFile: \\(.path):\\(.line)\\nAuthor: \\(.user.login)\\nBody: \\(.body)\\n\""],
          signal
        );
        lineComments = raw || "(no line-level review comments)";
      } catch (e: any) {
        lineComments = `(Could not fetch line-level comments: ${e.message})`;
      }

      const text = [
        `# PR #${params.pr} Comments`,
        "",
        "## Timeline / Issue Comments",
        timeline,
        "",
        "## Review Summaries",
        reviews,
        "",
        "## Line-Level Review Comments",
        lineComments,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    },
  });

  pi.registerTool({
    name: "gh_pr_diff",
    label: "GitHub: PR Diff",
    description: "Get the diff (patch) of a GitHub pull request.",
    parameters: Type.Object({
      pr: Type.Number({ description: "Pull request number" }),
      repo: Type.Optional(Type.String({ description: "Owner/repo (defaults to current repo)" })),
    }),
    async execute(_id, params, signal) {
      const args = [...repoArgs(params.repo), "pr", "diff", String(params.pr)];
      const out = await gh(args, signal);
      return { content: [{ type: "text", text: out }] };
    },
  });

  pi.registerTool({
    name: "gh_pr_checks",
    label: "GitHub: PR Checks",
    description: "View CI check / status rollup for a pull request.",
    parameters: Type.Object({
      pr: Type.Number({ description: "Pull request number" }),
      repo: Type.Optional(Type.String({ description: "Owner/repo (defaults to current repo)" })),
    }),
    async execute(_id, params, signal) {
      const args = [...repoArgs(params.repo), "pr", "checks", String(params.pr)];
      const out = await gh(args, signal);
      return { content: [{ type: "text", text: out }] };
    },
  });

  pi.registerTool({
    name: "gh_pr_list",
    label: "GitHub: List PRs",
    description: "List pull requests for a repository.",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Owner/repo (defaults to current repo)" })),
      state: Type.Optional(
        Type.Union(
          [Type.Literal("open"), Type.Literal("closed"), Type.Literal("merged"), Type.Literal("all")],
          { description: "Filter by state" }
        )
      ),
      limit: Type.Optional(Type.Number({ description: "Maximum results", default: 30 })),
      author: Type.Optional(Type.String({ description: "Filter by author login" })),
      label: Type.Optional(Type.String({ description: "Filter by label name" })),
    }),
    async execute(_id, params, signal) {
      const args = [
        ...repoArgs(params.repo),
        "pr",
        "list",
        "-L",
        String(params.limit ?? 30),
        ...(params.state ? ["-s", params.state] : []),
        ...(params.author ? ["-A", params.author] : []),
        ...(params.label ? ["-l", params.label] : []),
        "--json",
        "number,title,author,headRefName,baseRefName,state,url,createdAt",
      ];
      const out = await gh(args, signal);
      return { content: [{ type: "text", text: out }] };
    },
  });

  pi.registerTool({
    name: "gh_pr_comment",
    label: "GitHub: Comment on PR",
    description: "Add a comment to a pull request.",
    parameters: Type.Object({
      pr: Type.Number({ description: "Pull request number" }),
      body: Type.String({ description: "Comment body (supports Markdown)" }),
      repo: Type.Optional(Type.String({ description: "Owner/repo (defaults to current repo)" })),
    }),
    async execute(_id, params, signal) {
      const args = [
        ...repoArgs(params.repo),
        "pr",
        "comment",
        String(params.pr),
        "--body",
        params.body,
      ];
      const out = await gh(args, signal);
      return { content: [{ type: "text", text: out }] };
    },
  });

  // ───────────────────────────────────────────────────────────────
  // Issue tools
  // ───────────────────────────────────────────────────────────────

  pi.registerTool({
    name: "gh_issue_view",
    label: "GitHub: View Issue",
    description: "View a GitHub issue and its comments.",
    parameters: Type.Object({
      issue: Type.Number({ description: "Issue number" }),
      repo: Type.Optional(Type.String({ description: "Owner/repo (defaults to current repo)" })),
    }),
    async execute(_id, params, signal) {
      const r = repoArgs(params.repo);
      const num = String(params.issue);

      let body = "";
      try {
        body = await gh([...r, "issue", "view", num], signal);
      } catch (e: any) {
        body = `(Could not fetch issue: ${e.message})`;
      }

      let comments = "";
      try {
        comments = await gh([...r, "issue", "view", num, "--comments"], signal);
      } catch (e: any) {
        comments = `(Could not fetch comments: ${e.message})`;
      }

      const text = [`# Issue #${params.issue}`, "", body, "", "## Comments", comments].join("\n");
      return { content: [{ type: "text", text }] };
    },
  });

  pi.registerTool({
    name: "gh_issue_list",
    label: "GitHub: List Issues",
    description: "List issues for a repository.",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Owner/repo (defaults to current repo)" })),
      state: Type.Optional(
        Type.Union([Type.Literal("open"), Type.Literal("closed"), Type.Literal("all")], {
          description: "Filter by state",
        })
      ),
      limit: Type.Optional(Type.Number({ description: "Maximum results", default: 30 })),
      label: Type.Optional(Type.String({ description: "Filter by label" })),
      assignee: Type.Optional(Type.String({ description: "Filter by assignee login" })),
    }),
    async execute(_id, params, signal) {
      const args = [
        ...repoArgs(params.repo),
        "issue",
        "list",
        "-L",
        String(params.limit ?? 30),
        ...(params.state ? ["-s", params.state] : []),
        ...(params.label ? ["-l", params.label] : []),
        ...(params.assignee ? ["-a", params.assignee] : []),
        "--json",
        "number,title,author,state,url,createdAt,labels",
      ];
      const out = await gh(args, signal);
      return { content: [{ type: "text", text: out }] };
    },
  });

  // ───────────────────────────────────────────────────────────────
  // Workflow / Actions tools
  // ───────────────────────────────────────────────────────────────

  pi.registerTool({
    name: "gh_run_list",
    label: "GitHub: List Workflow Runs",
    description: "List recent GitHub Actions workflow runs.",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Owner/repo (defaults to current repo)" })),
      workflow: Type.Optional(Type.String({ description: "Workflow filename or ID" })),
      branch: Type.Optional(Type.String({ description: "Filter by branch" })),
      limit: Type.Optional(Type.Number({ description: "Maximum results", default: 20 })),
    }),
    async execute(_id, params, signal) {
      const args = [
        ...repoArgs(params.repo),
        "run",
        "list",
        "-L",
        String(params.limit ?? 20),
        ...(params.workflow ? ["-w", params.workflow] : []),
        ...(params.branch ? ["-b", params.branch] : []),
        "--json",
        "databaseId,name,headBranch,status,conclusion,url,createdAt",
      ];
      const out = await gh(args, signal);
      return { content: [{ type: "text", text: out }] };
    },
  });

  pi.registerTool({
    name: "gh_run_view",
    label: "GitHub: View Workflow Run",
    description: "View details and logs of a GitHub Actions workflow run.",
    parameters: Type.Object({
      run_id: Type.String({ description: "Workflow run ID (databaseId)" }),
      repo: Type.Optional(Type.String({ description: "Owner/repo (defaults to current repo)" })),
      logs: Type.Optional(Type.Boolean({ description: "Include job logs", default: false })),
    }),
    async execute(_id, params, signal, onUpdate) {
      const r = repoArgs(params.repo);
      const rid = params.run_id;

      let details = "";
      try {
        details = await gh([...r, "run", "view", rid], signal);
      } catch (e: any) {
        details = `(Could not fetch run details: ${e.message})`;
      }

      let logs = "";
      if (params.logs) {
        onUpdate?.({ content: [{ type: "text", text: "Fetching logs..." }] });
        try {
          logs = await gh([...r, "run", "view", rid, "--log"], signal);
        } catch (e: any) {
          logs = `(Could not fetch logs: ${e.message})`;
        }
      }

      const text = [`# Workflow Run ${rid}`, "", details, ...(params.logs ? ["", "## Logs", logs] : [])].join("\n");
      return { content: [{ type: "text", text }] };
    },
  });

  // ───────────────────────────────────────────────────────────────
  // Release & Repo tools
  // ───────────────────────────────────────────────────────────────

  pi.registerTool({
    name: "gh_release_list",
    label: "GitHub: List Releases",
    description: "List releases for a repository.",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Owner/repo (defaults to current repo)" })),
      limit: Type.Optional(Type.Number({ description: "Maximum results", default: 10 })),
    }),
    async execute(_id, params, signal) {
      const args = [
        ...repoArgs(params.repo),
        "release",
        "list",
        "-L",
        String(params.limit ?? 10),
        "--json",
        "tagName,name,isDraft,isPrerelease,createdAt,url",
      ];
      const out = await gh(args, signal);
      return { content: [{ type: "text", text: out }] };
    },
  });

  pi.registerTool({
    name: "gh_repo_view",
    label: "GitHub: View Repository",
    description: "View repository information (description, stars, forks, default branch, etc.).",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Owner/repo (defaults to current repo)" })),
    }),
    async execute(_id, params, signal) {
      const args = [...repoArgs(params.repo), "repo", "view"];
      const out = await gh(args, signal);
      return { content: [{ type: "text", text: out }] };
    },
  });

  // ───────────────────────────────────────────────────────────────
  // Generic API escape hatch
  // ───────────────────────────────────────────────────────────────

  pi.registerTool({
    name: "gh_api",
    label: "GitHub: Raw API",
    description:
      "Make an authenticated raw GitHub API call via 'gh api'. Use this for endpoints not covered by other tools.",
    parameters: Type.Object({
      endpoint: Type.String({ description: "API endpoint path (e.g. repos/owner/repo/pulls/123)" }),
      method: Type.Optional(
        Type.Union([Type.Literal("GET"), Type.Literal("POST"), Type.Literal("PATCH"), Type.Literal("DELETE")], {
          description: "HTTP method",
        })
      ),
      raw_fields: Type.Optional(Type.String({ description: "Raw fields for POST/PATCH as JSON string" })),
      paginate: Type.Optional(Type.Boolean({ description: "Auto-paginate", default: false })),
      jq: Type.Optional(Type.String({ description: "jq filter for response" })),
    }),
    async execute(_id, params, signal) {
      const args = ["api"];
      if (params.method) args.push("-X", params.method);
      if (params.paginate) args.push("--paginate");
      if (params.raw_fields) args.push("-f", params.raw_fields);
      args.push(params.endpoint);
      if (params.jq) args.push("-q", params.jq);

      const out = await gh(args, signal);
      return { content: [{ type: "text", text: out }] };
    },
  });

  // ───────────────────────────────────────────────────────────────
  // Startup notification
  // ───────────────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("GitHub CLI extension loaded (gh).", "info");
  });
}
