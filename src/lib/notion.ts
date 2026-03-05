import { Client } from "@notionhq/client";
import type {
  BookMetadata,
  BookSearchParams,
  BookStandard,
} from "./schemas.js";

/**
 * Notion API client wrappers for rare books operations.
 *
 * Four distinct data paths:
 * 1. SEARCH PATH – General Notion DB (NOTION_BOOKS_DATABASE_ID) for search_books
 * 2. AUDIT PATH – Master Bibliography (NOTION_MASTER_BIBLIOGRAPHY_DATABASE_ID) for audit_artifact_consistency
 * 3. MARKET PATH – Market Results (NOTION_MARKET_RESULTS_DATABASE_ID) for get_market_signals
 * 4. AUDIT LOG PATH – Audit Logs (NOTION_AUDIT_LOG_DATABASE_ID) for create_audit_log
 */

const NOTION_TOKEN = process.env.NOTION_API_KEY ?? process.env.NOTION_TOKEN;

if (!NOTION_TOKEN) {
  console.error(
    "Warning: NOTION_API_KEY or NOTION_TOKEN environment variable is not set. Notion operations will fail."
  );
}

export const notionClient = new Client({
  auth: NOTION_TOKEN,
});

// -----------------------------------------------------------------------------
// SEARCH PATH – General books database
// -----------------------------------------------------------------------------

/**
 * Get the database ID for the general books catalog.
 * Set NOTION_BOOKS_DATABASE_ID for production.
 */
export function getBooksDatabaseId(): string {
  const dbId = process.env.NOTION_BOOKS_DATABASE_ID;
  if (!dbId) {
    throw new Error(
      "NOTION_BOOKS_DATABASE_ID environment variable is required. Create a Notion database and set this to its ID."
    );
  }
  return dbId;
}

/**
 * Map book metadata to Notion page properties
 */
export function bookToNotionProperties(book: BookMetadata) {
  const props: Record<string, unknown> = {};

  props["Title"] = {
    title: [{ text: { content: book.title } }],
  };

  if (book.author) {
    props["Author"] = { rich_text: [{ text: { content: book.author } }] };
  }
  if (book.publicationYear !== undefined) {
    props["Publication Year"] = { number: book.publicationYear };
  }
  if (book.publisher) {
    props["Publisher"] = { rich_text: [{ text: { content: book.publisher } }] };
  }
  if (book.isbn) {
    props["ISBN"] = { rich_text: [{ text: { content: book.isbn } }] };
  }
  if (book.condition) {
    props["Condition"] = { select: { name: book.condition } };
  }
  if (book.edition) {
    props["Edition"] = { rich_text: [{ text: { content: book.edition } }] };
  }
  if (book.language) {
    props["Language"] = { rich_text: [{ text: { content: book.language } }] };
  }
  if (book.notes) {
    props["Notes"] = { rich_text: [{ text: { content: book.notes } }] };
  }
  if (book.estimatedValue !== undefined) {
    props["Estimated Value"] = { number: book.estimatedValue };
  }

  return props;
}

/**
 * Search books in the Notion database
 */
export async function searchBooks(params: BookSearchParams) {
  const databaseId = getBooksDatabaseId();

  type PropertyFilter =
    | { property: string; rich_text: { contains: string } }
    | { property: string; select: { equals: string } }
    | { property: string; number: { greater_than_or_equal_to: number } }
    | { property: string; number: { less_than_or_equal_to: number } };

  const filter: PropertyFilter[] = [];

  if (params.author) {
    filter.push({
      property: "Author",
      rich_text: { contains: params.author },
    });
  }
  if (params.condition) {
    filter.push({
      property: "Condition",
      select: { equals: params.condition },
    });
  }
  if (params.minYear !== undefined) {
    filter.push({
      property: "Publication Year",
      number: { greater_than_or_equal_to: params.minYear },
    });
  }
  if (params.maxYear !== undefined) {
    filter.push({
      property: "Publication Year",
      number: { less_than_or_equal_to: params.maxYear },
    });
  }

  const response = await notionClient.databases.query({
    database_id: databaseId,
    filter:
      filter.length > 0 ? ({ and: filter } as { and: PropertyFilter[] }) : undefined,
    sorts: params.query
      ? undefined
      : [{ property: "Publication Year", direction: "descending" }],
    page_size: params.limit,
    start_cursor: params.startCursor,
  });

  return response;
}

// -----------------------------------------------------------------------------
// AUDIT PATH – Master Bibliography (Ground Truth for forensic audit)
// -----------------------------------------------------------------------------

/**
 * Get the database ID for the Master Bibliography.
 * Set NOTION_MASTER_BIBLIOGRAPHY_DATABASE_ID for production.
 * Used by audit_artifact_consistency to fetch the BookStandard.
 */
export function getMasterBibliographyDatabaseId(): string {
  const dbId = process.env.NOTION_MASTER_BIBLIOGRAPHY_DATABASE_ID;
  if (!dbId) {
    throw new Error(
      "NOTION_MASTER_BIBLIOGRAPHY_DATABASE_ID environment variable is required for forensic audit. Create a Master Bibliography database in Notion."
    );
  }
  return dbId;
}

function extractRichText(prop: { rich_text?: { plain_text: string }[] }): string {
  const texts = prop?.rich_text ?? [];
  return texts.map((t) => t.plain_text).join("");
}

function extractMultiLineText(
  prop: { rich_text?: { plain_text: string }[] }
): string[] {
  const text = extractRichText(prop);
  if (!text.trim()) return [];
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

/**
 * Fetch a BookStandard (Ground Truth) from the Master Bibliography by page ID.
 * Maps Notion properties to BookStandardSchema. Expects properties:
 * Title, Author, Publisher, Expected First Edition Year, Binding Type,
 * First Edition Indicators (multi-line), Points of Issue (multi-line), Paper Watermark
 */
export async function fetchBookStandard(pageId: string): Promise<BookStandard> {
  const response = await notionClient.pages.retrieve({ page_id: pageId });
  if (response.object !== "page") {
    throw new Error(`Not a page: ${pageId}`);
  }

  const props = "properties" in response ? response.properties : {};
  const raw = props as Record<
    string,
    { rich_text?: { plain_text: string }[]; number?: number; select?: { name: string } }
  >;

  const title = extractRichText(raw["Title"] ?? {});
  const author = extractRichText(raw["Author"] ?? {});
  const publisher = extractRichText(raw["Publisher"] ?? {});
  const expectedYear = raw["Expected First Edition Year"]?.number ?? 0;
  const bindingType = (raw["Binding Type"]?.select?.name ?? "Cloth") as
    | "Leather"
    | "Cloth"
    | "Paper Wrap"
    | "Vellum";
  const firstEditionIndicators = extractMultiLineText(
    raw["First Edition Indicators"] ?? {}
  );
  const pointsOfIssue = extractMultiLineText(raw["Points of Issue"] ?? {});
  const paperWatermark = extractRichText(raw["Paper Watermark"] ?? {});

  return {
    title: title || "Unknown",
    author: author || "Unknown",
    publisher: publisher || "Unknown",
    expected_first_edition_year: expectedYear,
    binding_type: bindingType,
    first_edition_indicators: firstEditionIndicators,
    points_of_issue: pointsOfIssue,
    paper_watermark: paperWatermark || undefined,
  };
}

/**
 * Query the Master Bibliography to find a book by title/author.
 * Uses databases.query (not notion.search) so the lookup is scoped to this database
 * only, rather than scanning the whole workspace.
 * Returns page IDs for use with fetchBookStandard.
 */
export async function findBookStandardInMasterBibliography(
  title: string,
  author?: string
) {
  const databaseId = getMasterBibliographyDatabaseId();

  type PropertyFilter =
    | { property: string; title: { contains: string } }
    | { property: string; rich_text: { contains: string } };

  const filter: PropertyFilter[] = [
    { property: "Title", title: { contains: title } },
  ];
  if (author) {
    filter.push({ property: "Author", rich_text: { contains: author } });
  }

  const response = await notionClient.databases.query({
    database_id: databaseId,
    filter: { and: filter } as { and: PropertyFilter[] },
    page_size: 10,
  });

  return response.results.map((p) => ("id" in p ? p.id : "")).filter(Boolean);
}

// -----------------------------------------------------------------------------
// MARKET PATH – Market Results (hammer prices, sales data)
// -----------------------------------------------------------------------------

/**
 * Get the database ID for Market Results.
 * Set NOTION_MARKET_RESULTS_DATABASE_ID for production.
 */
export function getMarketResultsDatabaseId(): string {
  const dbId = process.env.NOTION_MARKET_RESULTS_DATABASE_ID;
  if (!dbId) {
    throw new Error(
      "NOTION_MARKET_RESULTS_DATABASE_ID environment variable is required for market signals. Create a Market Results database in Notion."
    );
  }
  return dbId;
}

export interface MarketSignalResult {
  title: string;
  author?: string;
  average_hammer_price: number;
  sales_count: number;
  sales: Array<{ hammer_price: number; sale_date?: string }>;
}

/**
 * Query Market Results for the last 3 sales of a book, return average Hammer Price.
 * Uses databases.query (not notion.search) so the lookup is scoped to this database
 * only, rather than scanning the whole workspace.
 * Expects properties: Title, Author (optional), Hammer Price (number), Sale Date (date)
 */
export async function getMarketSignals(
  title: string,
  author?: string
): Promise<MarketSignalResult> {
  const databaseId = getMarketResultsDatabaseId();

  type PropertyFilter =
    | { property: string; title: { contains: string } }
    | { property: string; rich_text: { contains: string } };

  const filter: PropertyFilter[] = [
    { property: "Title", title: { contains: title } },
  ];
  if (author) {
    filter.push({ property: "Author", rich_text: { contains: author } });
  }

  const response = await notionClient.databases.query({
    database_id: databaseId,
    filter: { and: filter } as { and: PropertyFilter[] },
    sorts: [
      {
        property: "Sale Date",
        direction: "descending",
      },
    ],
    page_size: 3,
  });

  const sales: Array<{ hammer_price: number; sale_date?: string }> = [];
  type PageWithProps = { properties: Record<string, { number?: number; date?: { start: string } }> };
  const raw = response.results as PageWithProps[];

  for (const page of raw) {
    const props = page.properties ?? {};
    const hammerPrice = (props["Hammer Price"] as { number?: number })?.number;
    if (hammerPrice != null && hammerPrice > 0) {
      const saleDate = (props["Sale Date"] as { date?: { start: string } })
        ?.date?.start;
      sales.push({ hammer_price: hammerPrice, sale_date: saleDate });
    }
  }

  const total = sales.reduce((sum, s) => sum + s.hammer_price, 0);
  const averageHammerPrice =
    sales.length > 0 ? Math.round((total / sales.length) * 100) / 100 : 0;

  return {
    title,
    author,
    average_hammer_price: averageHammerPrice,
    sales_count: sales.length,
    sales,
  };
}

// -----------------------------------------------------------------------------
// STATUS UPDATE – Update page Status property
// -----------------------------------------------------------------------------

/**
 * Update the Status property of a Notion page.
 * Expects a "Status" property of type "status" in the page's parent database.
 */
export async function updateBookStatus(
  pageId: string,
  status: string
): Promise<{ success: boolean; page_id: string }> {
  await notionClient.pages.update({
    page_id: pageId,
    properties: {
      Status: {
        status: { name: status },
      },
    },
  });
  return { success: true, page_id: pageId };
}

// -----------------------------------------------------------------------------
// AUDIT LOG PATH – Audit Logs (permanent audit records)
// -----------------------------------------------------------------------------

/**
 * Get the database ID for Audit Logs.
 * Set NOTION_AUDIT_LOG_DATABASE_ID for production.
 */
export function getAuditLogDatabaseId(): string {
  const dbId = process.env.NOTION_AUDIT_LOG_DATABASE_ID;
  if (!dbId) {
    throw new Error(
      "NOTION_AUDIT_LOG_DATABASE_ID environment variable is required for audit logging. Create an Audit Logs database in Notion."
    );
  }
  return dbId;
}

function richTextFromString(text: string): { type: "text"; text: { content: string } }[] {
  const chunks: { type: "text"; text: { content: string } }[] = [];
  const maxLen = 2000;
  for (let i = 0; i < text.length; i += maxLen) {
    chunks.push({
      type: "text",
      text: { content: text.slice(i, i + maxLen) },
    });
  }
  return chunks.length > 0 ? chunks : [{ type: "text" as const, text: { content: "" } }];
}

export type AuditResult = "Pass" | "Flagged" | "Fail";

/**
 * Get the primary title property name for the Audit Logs database.
 * Default is "title" (lowercase), the default primary column for Notion databases.
 * If you renamed it, set NOTION_AUDIT_LOG_TITLE_PROPERTY to match.
 */
function getAuditLogTitlePropertyName(): string {
  return process.env.NOTION_AUDIT_LOG_TITLE_PROPERTY ?? "title";
}

/**
 * Create a new page in the Audit Logs database.
 * Maps book_title to the primary title property using the title-type structure
 * { title: [{ text: { content } }] }, so it targets the database's title column
 * regardless of its display name in Notion.
 * Expects properties: primary title (title type), Result (select/status), Summary (rich_text), Full Report (rich_text)
 */
export async function createAuditLog(params: {
  book_title: string;
  result: AuditResult;
  summary: string;
  full_report: string;
}): Promise<{ success: boolean; page_id: string }> {
  const databaseId = getAuditLogDatabaseId();
  const titlePropName = getAuditLogTitlePropertyName();

  const properties: Record<string, unknown> = {
    [titlePropName]: {
      title: [{ text: { content: params.book_title } }],
    },
    Result: {
      select: { name: params.result },
    },
    Summary: {
      rich_text: richTextFromString(params.summary),
    },
    "Full Report": {
      rich_text: richTextFromString(params.full_report),
    },
  };

  const response = await notionClient.pages.create({
    parent: { database_id: databaseId },
    properties: properties as Parameters<typeof notionClient.pages.create>[0]["properties"],
  });

  const pageId = "id" in response ? response.id : "";
  return { success: true, page_id: pageId };
}
