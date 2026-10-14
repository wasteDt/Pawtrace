import PublicApp from "./pages/PublicApp";
import AdminApp from "./pages/AdminApp";

export default function App() {
  return window.location.pathname.startsWith("/admin") ? (
    <AdminApp />
  ) : (
    <PublicApp />
  );
}
