#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { 
    executeSearchBooks, 
    executeAuditArtifactConsistency, 
    executeGenerateExhibitLabel, 
    executeGetMarketSignals, 
    executeFindBookInMasterBibliography,
    executeUpdateBookStatus,
    executeCreateAuditLog,
} from "./tools/index.js";

const FORENSIC_WORKFLOW_INSTRUCTIONS = `
## Forensic Workflow
1. find_book_in_master_bibliography
2. audit_artifact_consistency
3. get_market_signals
4. generate_exhibit_label
5. update_book_status – If an audit reveals a High or Medium severity discrepancy, immediately update the Notion status to "Flagged for Review".
6. create_audit_log – After an audit is complete, automatically call create_audit_log to maintain a permanent record. Capture the page ID (id) from the initial catalog search (search_books or find_book_in_master_bibliography) and pass it as catalog_page_id to link the audit log to the book.
`;

const server = new McpServer({
    name: "rare-books-intelligence-mcp",
    version: "0.1.0",
}, {
    capabilities: { tools: {} },
    instructions: FORENSIC_WORKFLOW_INSTRUCTIONS.trim(),
});

// --- TOOL REGISTRATION START ---
// Note: registerTool(name, { description, inputSchema }, handler)

server.registerTool(
    "search_books",
    {
        description: "Search the rare books database in Notion.",
        inputSchema: {
            query: z.string().optional(),
            author: z.string().optional(),
            minYear: z.number().optional(),
            maxYear: z.number().optional(),
            condition: z.enum(["mint", "fine", "very_good", "good", "fair", "poor"]).optional(),
        }
    },
    async (args: any) => {
        const result = await executeSearchBooks(args);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
);

server.registerTool(
    "audit_artifact_consistency",
    {
        description: "Compare physical observations against Ground Truth.",
        inputSchema: {
            book_standard_page_id: z.string().optional(),
            observed: z.object({
                first_edition_indicators_observed: z.array(z.string()),
                points_of_issue_observed: z.array(z.string()),
                observed_year: z.number().optional(),
            }),
        }
    },
    async (args: any) => {
        const result = await executeAuditArtifactConsistency(args);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
);

server.registerTool(
    "find_book_in_master_bibliography",
    {
        description: "Look up a book in the Master Bibliography.",
        inputSchema: {
            title: z.string(),
            author: z.string().optional(),
        }
    },
    async (args: any) => {
        const result = await executeFindBookInMasterBibliography(args);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
);

server.registerTool(
    "get_market_signals",
    {
        description: "Query market results for valuation.",
        inputSchema: {
            title: z.string(),
            author: z.string().optional(),
        }
    },
    async (args: any) => {
        const result = await executeGetMarketSignals(args);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
);

server.registerTool(
    "generate_exhibit_label",
    {
        description: "Generate a professional Markdown placard.",
        inputSchema: {
            audit_report: z.record(z.unknown()),
            book_standard: z.record(z.unknown()),
        }
    },
    async (args: any) => {
        const result = executeGenerateExhibitLabel(args);
        return { content: [{ type: "text", text: result }] };
    }
);

server.registerTool(
    "update_book_status",
    {
        description: "Update the Status property of a Notion page. Use to flag items for review after audit discrepancies.",
        inputSchema: {
            page_id: z.string().describe("Notion page ID to update"),
            status: z.string().describe("New status value (e.g. 'Flagged for Review')"),
        }
    },
    async (args: any) => {
        try {
            const result = await executeUpdateBookStatus(args);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error occurred";
            return {
                content: [{ type: "text", text: `Error: ${message}. Ensure the page has a Status property and the integration has update access.` }],
                isError: true,
            };
        }
    }
);

server.registerTool(
    "create_audit_log",
    {
        description: "Create a permanent audit log entry in the Audit Logs database. Call after every audit to maintain a record.",
        inputSchema: {
            book_title: z.string().describe("Title of the book audited"),
            catalog_page_id: z.string().describe("Notion page ID of the book from search_books or find_book_in_master_bibliography; links audit to the catalog entry"),
            result: z.enum(["Pass", "Flagged", "Fail"]).describe("Audit result"),
            summary: z.string().describe("Brief summary of the audit findings"),
            full_report: z.string().describe("Full audit report (JSON or detailed text)"),
            audit_date: z.string().optional().default(() => new Date().toISOString()).describe("ISO 8601 date string; defaults to current time if not provided"),
        }
    },
    async (args: any) => {
        try {
            const result = await executeCreateAuditLog(args);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error occurred";
            return {
                content: [{ type: "text", text: `Error: ${message}. Ensure NOTION_AUDIT_LOG_DATABASE_ID is set and the database has title (primary), Linked Book (relation), Audit Date, Result, Summary, and Full Report properties.` }],
                isError: true,
            };
        }
    }
);

// --- TOOL REGISTRATION END ---

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Rare Books Intelligence MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});