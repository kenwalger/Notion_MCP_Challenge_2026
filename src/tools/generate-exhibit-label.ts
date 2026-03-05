import type { AuditReport, BookStandard } from "../lib/schemas.js";
import { AuditReportSchema, BookStandardSchema } from "../lib/schemas.js";

/**
 * Generates a professionally formatted Markdown Exhibit Placard.
 * Includes Curator's Note and, when warranted, Caveat Emptor / Forensic Note.
 */

export interface GenerateExhibitLabelInput {
  audit_report: unknown;
  book_standard: unknown;
}

export function executeGenerateExhibitLabel(
  args: GenerateExhibitLabelInput
): string {
  const auditReport = AuditReportSchema.parse(args.audit_report);
  const bookStandard = BookStandardSchema.parse(args.book_standard);

  return formatExhibitPlacard(bookStandard, auditReport);
}

function formatExhibitPlacard(standard: BookStandard, report: AuditReport): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Exhibit Placard`);
  lines.push("");
  lines.push(`## ${standard.title}`);
  lines.push(`**${standard.author}**`);
  lines.push("");
  lines.push(
    `${standard.publisher} · First Edition, ${standard.expected_first_edition_year}`
  );
  lines.push(`Binding: ${standard.binding_type}`);
  lines.push("");

  // Curator's Note
  lines.push("---");
  lines.push("## Curator's Note");
  lines.push("");
  lines.push(buildCuratorsNote(report));
  lines.push("");

  // Caveat Emptor / Forensic Note (if Medium or High severity)
  const hasMediumOrHigh = report.discrepancies.some(
    (d) => d.severity === "Medium" || d.severity === "High"
  );
  if (hasMediumOrHigh) {
    lines.push("---");
    lines.push("## Caveat Emptor / Forensic Note");
    lines.push("");
    lines.push(buildForensicNote(report));
  }

  return lines.join("\n");
}

function buildCuratorsNote(report: AuditReport): string {
  if (report.is_consistent) {
    return `This copy has been forensically audited against the Master Bibliography and **passed** all checks (confidence: ${report.confidence_score}%). The first edition indicators and points of issue align with the expected first state.`;
  }

  const highCount = report.discrepancies.filter((d) => d.severity === "High").length;
  const medCount = report.discrepancies.filter((d) => d.severity === "Medium").length;
  const lowCount = report.discrepancies.filter((d) => d.severity === "Low").length;

  const parts: string[] = [];
  if (highCount > 0) {
    parts.push(
      `${highCount} high-severity discrepancy(ies) were found: first edition indicators do not match. **This may indicate a reprint or different edition.**`
    );
  }
  if (medCount > 0) {
    parts.push(
      `${medCount} medium-severity discrepancy(ies) suggest a later state within the first edition (points of issue differ).`
    );
  }
  if (lowCount > 0) {
    parts.push(
      `${lowCount} low-severity discrepancy(ies) in secondary attributes (year, binding, or paper).`
    );
  }

  return `This copy was audited against the Master Bibliography (confidence: ${report.confidence_score}%). **Discrepancies were observed:** ${parts.join(" ")}`;
}

function buildForensicNote(report: AuditReport): string {
  const mediumOrHigh = report.discrepancies.filter(
    (d) => d.severity === "Medium" || d.severity === "High"
  );

  const items = mediumOrHigh.map(
    (d) => `- **${d.field}** (${d.severity}): Expected "${d.expected}"; observed "${d.observed}"`
  );

  return [
    "Buyers are advised to review the following forensic findings before purchase:",
    "",
    ...items,
    "",
    "Prospective purchasers should conduct independent verification or seek expert opinion.",
  ].join("\n");
}
