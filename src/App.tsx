import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Patron from "./pages/Patron";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Reports from "./pages/Reports";
import Subscription from "./pages/Subscription";
import UstaView from "./pages/UstaView";
import Ekip from "./pages/Ekip";
import Santiye from "./pages/Santiye";
import Restorasyon from "./pages/Restorasyon";
import RestoPanel from "./pages/RestoPanel";
import Danismanlik from "./pages/Danismanlik";
import DanismanlikPaket from "./pages/DanismanlikPaket";
import Leads from "./pages/Leads";
import Asistan from "./pages/Asistan";
import Sirketim from "./pages/Sirketim";
import Takip from "./pages/Takip";
import Sistem from "./pages/Sistem";
import Kurucu from "./pages/Kurucu";
import Isler from "./pages/Isler";
import Analitik from "./pages/Analitik";
import Foy from "./pages/Foy";
import PlanTakip from "./pages/PlanTakip";
import Katil from "./pages/Katil";
import GirisLink from "./pages/GirisLink";
import SifreSifirla from "./pages/SifreSifirla";
import { PremiumProvider } from "./components/premium";
import { DeviceGate } from "./components/DeviceGate";
import { Toaster } from "./components/ui/sonner";
import { useAuth } from "./hooks/useAuth";
import { trackView } from "./lib/track";

/** Sayfa değişince başa; #çapa varsa o bölüme kaydır (sayfa arası bağlantılar için) */
function ScrollManager() {
  const { pathname, hash, search } = useLocation();
  useEffect(() => {
    if (hash) {
      const t = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      return () => window.clearTimeout(t);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash, search]);
  return null;
}

/** Halka açık sayfa görüntülemelerini kaydeder (çerezsiz; Kurucu Paneli · Trafik) */
function PageTracker() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    trackView(pathname, search);
  }, [pathname, search]);
  return null;
}

export default function App() {
  const { isAuthenticated } = useAuth();
  return (
    <DeviceGate>
    <PremiumProvider enabled={isAuthenticated}>
    <Toaster position="top-center" richColors closeButton />
    <ScrollManager />
    <PageTracker />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/katil" element={<Katil />} />
      <Route path="/katil/:kod" element={<Katil />} />
      <Route path="/giris/:token" element={<GirisLink />} />
      <Route path="/sifre/:token" element={<SifreSifirla />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/panel" element={<Dashboard />} />
      <Route path="/patron" element={<Patron />} />
      <Route path="/santiyeler" element={<Projects />} />
      <Route path="/santiye/:id" element={<ProjectDetail />} />
      <Route path="/rapor" element={<Reports />} />
      <Route path="/abonelik" element={<Subscription />} />
      <Route path="/usta" element={<UstaView />} />
      <Route path="/ekip" element={<Ekip />} />
      <Route path="/santiye" element={<Santiye />} />
      <Route path="/restorasyon" element={<Restorasyon />} />
      <Route path="/resto" element={<RestoPanel />} />
      <Route path="/danismanlik" element={<Danismanlik />} />
      <Route path="/danismanlik/:id" element={<DanismanlikPaket />} />
      <Route path="/talepler" element={<Leads />} />
      <Route path="/asistan" element={<Asistan />} />
      <Route path="/sirketim" element={<Sirketim />} />
      <Route path="/takip" element={<Takip />} />
      <Route path="/takip/:kod" element={<Takip />} />
      <Route path="/sistem" element={<Sistem />} />
      <Route path="/kurucu" element={<Kurucu />} />
      <Route path="/kurucu/:bolum" element={<Kurucu />} />
      <Route path="/kurucu/:bolum/:id" element={<Kurucu />} />
      <Route path="/isler" element={<Isler />} />
      <Route path="/analitik" element={<Analitik />} />
      <Route path="/santiye/:id/foy" element={<Foy />} />
      <Route path="/santiye/:id/plan-takip" element={<PlanTakip />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </PremiumProvider>
    </DeviceGate>
  );
}
