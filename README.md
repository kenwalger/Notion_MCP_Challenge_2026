# Rare Books Intelligence MCP

An MCP (Model Context Protocol) server for managing and searching a rare books database in Notion. Built with TypeScript, the Notion SDK, and Zod for validation.

## Stack

- **TypeScript** – Type-safe development
- **@modelcontextprotocol/sdk** – MCP server with Streamable HTTP transport
- **@notionhq/client** – Notion API integration
- **Zod** – Schema validation for book metadata

## Project Structure

```
src/
├── index.ts          # Entry point & MCP server setup (Streamable HTTP on port 3000)
├── tools/            # Individual tool definitions
│   ├── index.ts
│   └── search-books.ts
└── lib/
    ├── notion.ts     # Notion API client wrappers
    └── schemas.ts    # Zod schemas for book metadata
```

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Create a `.env` file or set:

   - `NOTION_API_KEY` or `NOTION_TOKEN` – Your Notion integration token
   - `NOTION_BOOKS_DATABASE_ID` – The ID of your Notion database for rare books

3. **Create Notion databases**

   **General catalog** (`NOTION_BOOKS_DATABASE_ID`) – for search_books:

   - Title, Author, Publication Year, Publisher, ISBN, Condition, Edition, Language, Notes, Estimated Value

   **Master Bibliography** (`NOTION_MASTER_BIBLIOGRAPHY_DATABASE_ID`) – for audit_artifact_consistency:

   - **Title** (title)
   - **Author** (rich text)
   - **Publisher** (rich text)
   - **Expected First Edition Year** (number)
   - **Binding Type** (select: Leather, Cloth, Paper Wrap, Vellum)
   - **First Edition Indicators** (rich text, multi-line) – high-level markers, e.g. "1925 on title page"
   - **Points of Issue** (rich text, multi-line) – forensic states, e.g. "lowercase j on page 10"
   - **Paper Watermark** (rich text, optional)

   **Market Results** (`NOTION_MARKET_RESULTS_DATABASE_ID`) – for get_market_signals:

   - **Title** (title)
   - **Author** (rich text)
   - **Hammer Price** (number)
   - **Sale Date** (date)

## Usage

**Build**

```bash
npm run build
```

**Run (Streamable HTTP – for Notion Custom Agent via ngrok)**

```bash
npm start
```

The server listens on `http://0.0.0.0:3000/mcp`. Expose it via ngrok:

```bash
ngrok http 3000
```

Use the ngrok URL + `/mcp` (e.g. `https://abc123.ngrok-free.app/mcp`) when adding the Custom MCP server in Notion Agent Settings → Tools & Access → Add connection → Custom MCP server.

Set `PORT` in `.env` to use a different port (default: 3000).

**Note:** The server uses Streamable HTTP only (no stdio). Use ngrok for remote clients like Notion Custom Agents.

## Tools

- **search_books** – Search the general rare books catalog with filters (author, year, condition).

- **find_book_in_master_bibliography** – Look up a book in the Master Bibliography. If not found, suggests adding it to Notion first.

- **audit_artifact_consistency** – Forensic audit: compare observed physical artifact against Ground Truth. Severity: High (first_edition_indicators), Medium (points_of_issue), Low (other).

- **get_market_signals** – Query Market Results for the last 3 sales; returns average Hammer Price.

- **generate_exhibit_label** – Generate a Markdown Exhibit Placard with Curator's Note and Caveat Emptor (if Medium/High discrepancies).

### Forensic Workflow

For authenticity questions, the AI follows: 1) find_book_in_master_bibliography → 2) audit_artifact_consistency → 3) get_market_signals → 4) offer generate_exhibit_label.

## License

MIT
