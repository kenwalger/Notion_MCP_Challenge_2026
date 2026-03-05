# 🔍 Rare Book Intelligence MCP Server

**A Forensic Audit & Valuation Engine for High-Value Bibliographic Assets**

Built for the **2026 Notion MCP Hackathon**, this server transforms a standard Notion workspace into a professional rare book "Forensic Lab." It bridges structured archival data with LLM reasoning to identify forgeries, state-variants, and $10,000+ market discrepancies.

---

## 🏛️ The Problem
High-value rare book trade relies on "Points of Issue"—tiny typographic or physical variations (like a single letter typo in a 19th-century poem) that determine if a book is worth $50,000 or $500. Non-experts often miss these "Ground Truth" markers, leading to massive financial loss and authenticity risks.

## 🚀 The Solution
This Model Context Protocol (MCP) server enables AI Agents (like Claude Desktop) to:
1. **Sync with Ground Truth:** Query a private "Master Bibliography" for definitive state-markers.
2. **Perform Forensic Audits:** Compare physical observations against archival standards.
3. **Capture Market Signals:** Pull recent "Hammer Prices" to contextualize risk.
4. **Automate Governance:** Automatically update item statuses and maintain a permanent **Audit Log** in Notion for insurance and provenance.



---

## 🛠️ Features & Tools

| Tool | Function | Enterprise Impact |
| :--- | :--- | :--- |
| `find_book_in_master_bibliography` | Cross-references archival standards. | Eliminates human memory errors. |
| `audit_artifact_consistency` | Identifies "Point of Issue" mismatches. | Prevents high-value forgeries. |
| `update_book_status` | Direct write-back to Notion Inventory. | Real-time inventory governance. |
| `create_audit_log` | Records timestamped audit results. | Chain of Custody & Provenance. |

---

## 📦 Installation & Setup

1. **Clone & Install:**
   ```bash
   git clone [https://github.com/kenwalger/Notion_MCP_Challenge_2026](https://github.com/kenwalger/Notion_MCP_Challenge_2026)
   npm install
   npm run build
   ```

2. **Notion Setup:** Duplicate the [Rare Book Template] (link your template here) and configure `.env`:
   - `NOTION_API_KEY` – Integration token
   - `NOTION_BOOKS_DATABASE_ID`, `NOTION_MASTER_BIBLIOGRAPHY_DATABASE_ID`, `NOTION_MARKET_RESULTS_DATABASE_ID`, `NOTION_AUDIT_LOG_DATABASE_ID`

3. **Claude Desktop Integration:** Add the absolute path to `dist/index.js` in your `claude_desktop_config.json`.

---

⚖️ License
Distributed under the MIT License. See [LICENSE](LICENSE) for more information.