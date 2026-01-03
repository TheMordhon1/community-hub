export interface Menu {
  id: string;
  name: string;
  title: string;
  url: string;
  icon: string;
  is_active: boolean;
  show_in_sidebar_main: boolean;
  show_in_sidebar_pengurus: boolean;
  show_in_sidebar_admin: boolean;
  show_in_quick_menu: boolean;
  show_in_pengurus_menu: boolean;
  show_in_admin_menu: boolean;
  order_index: number;
  color: string | null;
  created_at: string;
  updated_at: string;
}
