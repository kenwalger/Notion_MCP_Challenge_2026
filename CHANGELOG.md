# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2025-03-04

### Added

- **create_audit_log** – `audit_date` argument (optional string, ISO 8601), defaulting to current time via `new Date().toISOString()`. Maps to Notion property `'Audit Date'` (date type).

### Changed

- **find_book_in_master_bibliography** – Title filter uses `equals` (not `contains`) to avoid fuzzy search misses. `fetchBookStandard` parses Points of Issue and First Edition Indicators from `multi_select` arrays in the full page response, with fallback to rich_text.

## [0.5.0] - 2025-03-04

### Changed

- **create_audit_log** – Map book_title to the primary title property `"title"` (lowercase), the default primary column for Notion databases. Add optional `NOTION_AUDIT_LOG_TITLE_PROPERTY` env var if the column was renamed. Remove reference to "Book Title" property.

- **find_book_in_master_bibliography**, **get_market_signals** – Document that both use `databases.query` with Title filter (not `notion.search`), scoping lookups to the specific database rather than the whole workspace.

## [0.4.0] - 2025-03-04

### Added

- **Production test suite** – Vitest
  - `vitest` dev dependency, `npm run test` script
  - `src/__tests__/forensic-logic.test.ts` with mocked Notion client
  - Tests for `audit_artifact_consistency`: Point of Issue typo (wabe vs wade) → High severity, first_edition_indicators fail, missing points, year mismatch, confidence score

### Changed

- **audit_artifact_consistency** – points_of_issue failures now return High severity (was Medium). Point-of-issue typo mismatches indicate forgery/wrong state.

## [0.3.0] - 2025-03-04

### Added

- **create_audit_log** tool
  - Create permanent audit records in the Audit Logs Notion database
  - Arguments: book_title, result (enum: Pass, Flagged, Fail), summary, full_report
  - Forensic Workflow step 6: after audit is complete, automatically call to maintain permanent record
  - `createAuditLog()`, `getAuditLogDatabaseId()` in notion client
  - `NOTION_AUDIT_LOG_DATABASE_ID` environment variable

## [0.2.0] - 2025-03-04

### Added

- **update_book_status** tool
  - Update the Status property of any Notion page by page_id and status string
  - Forensic Workflow step 5: when audit reveals High or Medium severity discrepancy, update status to "Flagged for Review"
  - `updateBookStatus()` in notion client

## [0.1.0] - 2025-03-04

### Added

- **Project setup** – TypeScript MCP server for rare books intelligence
  - `@modelcontextprotocol/sdk`, `@notionhq/client`, `zod`, `express`
  - ES modules, strict TypeScript config, Node ≥18

- **General search path** – `search_books` tool
  - Query Notion books database by author, year, condition
  - `BookMetadataSchema`, `BookSearchParamsSchema` for validation
  - `searchBooks()`, `bookToNotionProperties()` in notion client

- **Forensic audit path** – `audit_artifact_consistency` tool
  - Compare observed artifact vs Master Bibliography ground truth
  - Severity: High (first_edition_indicators), Medium (points_of_issue), Low (other)
  - `BookStandardSchema`, `ObservedArtifactSchema`, `AuditReportSchema`
  - `fetchBookStandard()`, `findBookStandardInMasterBibliography()`

- **Find book in Master Bibliography** – `find_book_in_master_bibliography` tool
  - Returns page IDs and BookStandards when found
  - If not found, suggests adding the book to Notion first

- **Market signals** – `get_market_signals` tool
  - Query Market Results for last 3 sales, return average Hammer Price
  - Third Notion database for auction/sales data

- **Reporting** – `generate_exhibit_label` tool
  - Produce Markdown Exhibit Placard from audit report + book standard
  - Curator's Note and Caveat Emptor / Forensic Note (when Medium or High severity)

- **Orchestration** – Forensic Workflow instructions
  - LLM guidance: find → audit → market signals → offer exhibit label
  - Graceful handling when book is missing from Master Bibliography

- **Streamable HTTP transport** – ngrok / Notion Custom Agent support
  - Express server on port 3000, `/mcp` endpoint
  - Stateless mode for remote clients
  - Binds to `0.0.0.0` for tunnel access

- **Configuration**
  - `.env.example` for `NOTION_API_KEY`, books DB, Master Bibliography DB, Market Results DB
  - `PORT` env var (default 3000)
