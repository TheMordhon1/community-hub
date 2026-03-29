export type BorrowStatus = "pending" | "approved" | "borrowed" | "returned" | "rejected";

export interface InventoryItemRef {
  id: string;
  name: string;
  category: string;
  image_url: string;
  available_quantity: number;
  quantity: number;
  condition: string;
}

export interface BorrowItem {
  id: string;
  borrow_id: string;
  item_id: string;
  quantity: number;
  item?: InventoryItemRef;
}

export interface BorrowRequest {
  id: string;
  user_id: string;
  house_id: string | null;
  status: string;
  notes: string | null;
  borrow_date: string;
  return_date: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}
