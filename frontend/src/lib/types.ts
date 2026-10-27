export type Role = "owner" | "editor" | "viewer";
export interface User { id: string; email: string; name: string; avatar_url?: string | null }
export interface Member { id: string; name: string; email: string; role: Role }
export interface Trip {
  id: string; name: string; destination: string; currency: string; start_date: string | null; end_date: string | null;
  budget: string | null; my_role: Role; owner_id: string; total_spent: string; checklist_total: number;
  checklist_done: number; document_count: number; members: Member[];
}
export interface ItineraryItem {
  id: string; kind: "flight" | "stay" | "dinner" | "transit" | "activity"; title: string; location: string | null;
  starts_at: string; ends_at: string | null; confirmation_ref: string | null; notes: string | null;
}
export type Folder = "Flights" | "Trains" | "Buses" | "Hotels" | "Tickets" | "Passport" | "Other";
export interface Doc { id: string; name: string; folder: Folder; size: number; content_type: string; created_at: string; uploader_id: string }
export type Category = "Food" | "Transport" | "Accommodation" | "Activities" | "Shopping" | "Other";
export interface Expense {
  id: string; merchant: string; description: string | null; amount: string; currency: string; category: Category;
  spent_on: string; is_settlement: boolean; payer: { id: string; name: string }; split_count: number;
  per_person: string; has_receipt: boolean; status: "settled" | "pending"; pending_count: number; shares: Record<string, string>;
}
export interface Balances {
  net: { user_id: string; name: string; amount: string }[];
  transactions: { from_user: string; from_name: string; to_user: string; to_name: string; amount: string }[];
}
export interface Dashboard {
  currency: string; budget: string | null;
  kpis: { total_spent: string; per_person: string; my_share: string; you_owe: string; owed_to_you: string;
          expense_count: number; members: number; budget_used_percent: number | null };
  categories: { category: Category; amount: string; percent: number }[];
  daily: { date: string; amount: string }[];
  recommendations: { suggested_daily_budget: string | null; days_left: number | null; days_total: number | null; tips: string[] };
  counts: { itinerary: number; documents: number; expenses: number; checklist_done: number; checklist_total: number; places: number; photos: number };
  next_milestone: { id: string; kind: string; title: string; location: string | null; starts_at: string; confirmation_ref: string | null; notes: string | null } | null;
  lodging: { name: string; address: string | null } | null;
  checklist_preview: { id: string; label: string; done: boolean }[];
  recent_documents: { id: string; name: string; folder: string; size: number }[];
}
export interface ChecklistItem { id: string; group_name: string; label: string; done: boolean }
export interface Place { id: string; name: string; kind: "hotel" | "attraction" | "food"; lat: number; lng: number; address: string | null; notes: string | null }
export interface Photo { id: string; caption: string | null; url: string; created_at: string; uploader_id: string }
export interface ScanResult {
  merchant: string | null; amount: string | null; spent_on: string | null; currency: string; category: Category;
  category_confidence: number; category_method: string; image_hash: string; ocr_raw_text: string; fields_found: number;
  duplicates: { expense_id: string; merchant: string; amount: string; spent_on: string; reason: string }[];
  confidence: number; s3_key: string;
}
