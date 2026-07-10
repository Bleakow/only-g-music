import { AdminDashboard } from "@/features/admin/components/AdminDashboard";

// El guard de rol `admin` lo aplica el layout del panel (admin/layout.tsx).
export default function AdminPage() {
  return <AdminDashboard />;
}
