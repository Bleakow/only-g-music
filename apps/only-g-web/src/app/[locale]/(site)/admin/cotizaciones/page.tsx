import { AdminCotizaciones } from "@/features/admin/components/AdminCotizaciones";

// El guard de rol `admin` lo aplica el layout del panel (admin/layout.tsx).
export default function AdminCotizacionesPage() {
  return <AdminCotizaciones />;
}
