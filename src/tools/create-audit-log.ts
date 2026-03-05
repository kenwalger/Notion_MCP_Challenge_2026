import { createAuditLog as createAuditLogInNotion } from "../lib/notion.js";

export interface CreateAuditLogInput {
  book_title: string;
  result: "Pass" | "Flagged" | "Fail";
  summary: string;
  full_report: string;
}

export async function executeCreateAuditLog(
  args: CreateAuditLogInput
): Promise<{ success: boolean; page_id: string }> {
  return createAuditLogInNotion(args);
}
