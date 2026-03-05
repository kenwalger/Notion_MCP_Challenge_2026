#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { z } from "zod";
import type { Request, Response } from "express";
import {
  executeSearchBooks,
  executeAuditArtifactConsistency,
  executeGenerateExhibitLabel,
  executeGetMarketSignals,
  executeFindBookInMasterBibliography,
} from "./tools/index.js";

const FORENSIC_WORKFLOW_INSTRUCTIONS = `
## Forensic Workflow

When a user asks about a book's authenticity or requests a forensic audit:

1. **find_book_in_master_bibliography** – Look up the book by title (and author if known). If NOT found, gracefully tell the user: "This book was not found in the Master Bibliography. To enable forensic auditing, please add it to your Master Bibliography database in Notion first."

2. **audit_artifact_consistency** – Run the forensic audit using the BookStandard (from step 1) and the user's observed artifact data (first edition indicators observed, points of issue observed, etc.).

3. **get_market_signals** – Query the Market Results database for the last 3 sales and return the average Hammer Price. Use this for market_context in the audit and exhibit label.

4. **generate_exhibit_label** – Offer to generate a professional Exhibit Placard (Markdown) combining the audit report and book standard. Use this when the user wants a display label or catalog entry.

Always follow this sequence when authenticity is the question. If the book is not in the Master Bibliography, stop after step 1 and suggest adding it first.
`;

const PORT = Number(process.env.PORT ?? 3000);

/**
 * Factory to create a configured MCP server with all tools registered.
 * Used for stateless Streamable HTTP – each request gets a fresh server instance.
 */
function getServer(): McpServer {
  const server = new McpServer(
    {
      name: "rare-books-intelligence-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: FORENSIC_WORKFLOW_INSTRUCTIONS.trim(),
    }
  );

  server.registerTool(
    "search_books",
    {
      title: "Search Rare Books",
      description:
        "Search the rare books database in Notion. Filter by author, publication year range, or condition.",
      inputSchema: {
        query: z.string().optional().describe("Full-text search query"),
        author: z.string().optional().describe("Filter by author name"),
        minYear: z.number().optional().describe("Minimum publication year"),
        maxYear: z.number().optional().describe("Maximum publication year"),
        condition: z
          .enum(["mint", "fine", "very_good", "good", "fair", "poor"])
          .optional()
          .describe("Book condition filter"),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .default(10)
          .describe("Maximum number of results (default 10)"),
      },
    },
    async (args) => {
      try {
        const result = await executeSearchBooks(args);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "audit_artifact_consistency",
    {
      title: "Audit Artifact Consistency",
      description:
        "Forensic audit: compare observed physical artifact against Ground Truth from Master Bibliography. Checks first_edition_indicators (High severity if fail) then points_of_issue (Medium severity if fail).",
      inputSchema: {
        book_standard_page_id: z
          .string()
          .optional()
          .describe("Notion page ID in Master Bibliography to fetch BookStandard"),
        book_standard: z
          .record(z.unknown())
          .optional()
          .describe("Or provide BookStandard directly (overrides page_id)"),
        observed: z.object({
          first_edition_indicators_observed: z
            .array(z.string())
            .describe("What was observed for first edition markers"),
          points_of_issue_observed: z
            .array(z.string())
            .describe("What was observed for points of issue"),
          observed_year: z.number().optional(),
          binding_type_observed: z.string().optional(),
          paper_watermark_observed: z.string().optional(),
        }),
        market_context: z.string().optional(),
      },
    },
    async (args) => {
      try {
        const result = await executeAuditArtifactConsistency(args);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "find_book_in_master_bibliography",
    {
      title: "Find Book in Master Bibliography",
      description:
        "Look up a book in the Master Bibliography by title and optional author. Returns page_ids and BookStandards if found. If not found, returns a helpful message suggesting the user add it to Notion first.",
      inputSchema: {
        title: z.string().describe("Book title to search for"),
        author: z.string().optional().describe("Author name to narrow the search"),
      },
    },
    async (args) => {
      try {
        const result = await executeFindBookInMasterBibliography(args);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${message}. If the Master Bibliography database is not configured, set NOTION_MASTER_BIBLIOGRAPHY_DATABASE_ID in your environment.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_market_signals",
    {
      title: "Get Market Signals",
      description:
        "Query the Market Results database for the last 3 sales of a book. Returns the average Hammer Price.",
      inputSchema: {
        title: z.string().describe("Book title to search for in Market Results"),
        author: z.string().optional().describe("Author to narrow the search"),
      },
    },
    async (args) => {
      try {
        const result = await executeGetMarketSignals(args);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${message}. Ensure NOTION_MARKET_RESULTS_DATABASE_ID is set and the Market Results database has Title, Author, Hammer Price, and Sale Date properties.`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "generate_exhibit_label",
    {
      title: "Generate Exhibit Label",
      description:
        "Generate a professionally formatted Markdown Exhibit Placard from an AuditReport and BookStandard. Includes Curator's Note; adds Caveat Emptor/Forensic Note if Medium or High severity discrepancies exist.",
      inputSchema: {
        audit_report: z
          .record(z.unknown())
          .describe("The AuditReport from audit_artifact_consistency"),
        book_standard: z
          .record(z.unknown())
          .describe("The BookStandard (Ground Truth from Master Bibliography)"),
      },
    },
    async (args) => {
      try {
        const result = executeGenerateExhibitLabel(args);
        return {
          content: [{ type: "text" as const, text: result }],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  const server = getServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless – suitable for ngrok / Notion Custom Agent
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close().catch(console.error);
      server.close().catch(console.error);
    });
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal server error",
        },
        id: null,
      });
    }
  }
}

async function main() {
  // Bind to 0.0.0.0 for ngrok – omit allowedHosts so any Host header is accepted
  const app = createMcpExpressApp({ host: "0.0.0.0" });

  app.get("/mcp", (req, res) => handleMcpRequest(req, res));
  app.post("/mcp", (req, res) => handleMcpRequest(req, res));

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Rare Books Intelligence MCP Server listening on http://0.0.0.0:${PORT}/mcp`
    );
    console.log(
      `Expose via ngrok: ngrok http ${PORT} -- then use the ngrok URL + /mcp for Notion Custom Agent`
    );
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
