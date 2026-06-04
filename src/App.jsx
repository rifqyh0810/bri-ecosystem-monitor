import { useState, useMemo, useEffect } from "react";
import { supabase } from "./supabaseClient";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  Home, Building2, Users, BarChart2, Bell, ChevronDown,
  Plus, Edit2, Trash2, X, Check, AlertTriangle, Clock,
  CheckCircle, Circle, ChevronRight, ChevronLeft, Info
} from "lucide-react";

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const KC_LIST = [
  "Semua KC",
  "KC Samarinda Gajah Mada",
  "KC Samarinda II",
  "KC Balikpapan Sudirman",
  "KC Balikpapan A.Yani",
  "KC Bontang",
  "KC Sangata",
  "KC Tenggarong",
  "KC Tarakan",
];

const SEKTOR_LIST = ["Pertambangan", "BBM/Energi", "Kesehatan", "Pendidikan", "Angkutan/Logistik", "Industri", "Lainnya"];
const RELASI_TYPES = ["Anchor", "Anak Perusahaan", "Supplier", "Buyer"];
const DIVISI_LIST = ["RM FT", "RM Briguna", "RM SME", "RM BRILife", "RM BRINS"];

const PRODUK_MAP = {
  "RM FT": ["Giro", "Deposito", "BRIVA", "Qlola/CMS", "EDC/QRIS", "BRImo Onboarding", "Bank Garansi", "Pengendapan CASA", "BRI Prioritas BOD/BOC", "PKS Payroll"],
  "RM Briguna": ["PKS Payroll", "BRIguna", "Kartu Kredit", "KPR", "KKB", "DPLK"],
  "RM SME": ["KMK", "KI", "KUR", "SCF Accounts Payable", "SCF Accounts Receivable"],
  "RM BRILife": ["Asuransi Aurora", "Asuransi Jiwa Pijar"],
  "RM BRINS": ["Asuransi Alat Berat", "Asuransi Kendaraan", "Asuransi Kapal/Tugboat", "Asuransi Tongkang", "Asuransi Kargo", "Asuransi Properti"],
};

const COVENANT_TYPES = ["Minimum CASA Mengendap", "Target % Transaksi via BRI", "Mandatory Qlola", "Target % Payroll BRI", "Custom"];
const EVAL_PERIODS = ["Bulanan", "Triwulan", "Semesteran"];
const STATUS_COLORS = { "On Track": "#22c55e", "Grace Period": "#f59e0b", "Overdue": "#ef4444", "Belum Mulai": "#94a3b8", "Completed": "#3b82f6", "PIC Belum Assign": "#a855f7" };

// ─── DATE HELPERS ────────────────────────────────────────────────────────────

const today = new Date();
const daysOffset = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0]; };
const calcStatus = (mulai, deadline, sla, grace) => {
  if (!mulai || !deadline) return "Belum Mulai";
  const now = new Date(); const s = new Date(mulai); const d = new Date(deadline);
  if (now < s) return "Belum Mulai";
  if (now > new Date(d.getTime() + (grace || 0) * 86400000)) return "Overdue";
  if (now > d) return "Grace Period";
  return "On Track";
};
const fmt = (iso) => { if (!iso) return "-"; const d = new Date(iso); return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }); };
const fmtRp = (n) => { if (!n && n !== 0) return "-"; if (n >= 1e9) return `Rp${(n / 1e9).toFixed(1)}M`; if (n >= 1e6) return `Rp${(n / 1e6).toFixed(0)}jt`; return `Rp${n.toLocaleString("id-ID")}`; };
const daysDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// ─── INITIAL DATA ────────────────────────────────────────────────────────────

let _id = 1000;
const uid = () => String(++_id);

const makeRM = (nama, divisi, kc) => ({ id: uid(), nama, divisi, kc });
const makePT = (nama, sektor, kc, kickoffOffset, relasi) => ({ id: uid(), nama, sektor, kc, kickoff: daysOffset(kickoffOffset), relasi });
const makeRelasi = (nama, jenis, produk = []) => ({ id: uid(), nama, jenis, produk });
const makeProduk = (nama, divisi, pic, target, realisasi, mulaiOff, deadlineOff, sla, grace, catatan = "") => {
  const mulai = daysOffset(mulaiOff); const deadline = daysOffset(deadlineOff);
  const status = realisasi >= target && target > 0 ? "Completed" : calcStatus(mulai, deadline, sla, grace);
  return { id: uid(), nama, divisi, pic, target, realisasi, mulai, deadline, sla, grace, status, catatan };
};
const makeCovenant = (jenis, customNama, target, satuan, periode, realisasi) => {
  const pct = target > 0 ? realisasi / target : 1;
  const status = pct >= 1 ? "Terpenuhi" : pct >= 0.75 ? "Sebagian" : "Tidak Terpenuhi";
  return { id: uid(), jenis, customNama, target, satuan, periode, realisasi, status };
};

const INIT_DATA = (() => {
  const rms = [
    makeRM("Khairunisa", "RM FT", "KC Samarinda Gajah Mada"),
    makeRM("Selvi", "RM Briguna", "KC Samarinda Gajah Mada"),
    makeRM("Agma", "RM BRILife", "KC Samarinda Gajah Mada"),
    makeRM("Yishak", "RM BRINS", "KC Samarinda Gajah Mada"),
    makeRM("Andri", "RM SME", "KC Samarinda Gajah Mada"),
    makeRM("Dian Pratiwi", "RM FT", "KC Balikpapan Sudirman"),
    makeRM("Rizky Fauzan", "RM Briguna", "KC Balikpapan Sudirman"),
    makeRM("Sari Dewi", "RM SME", "KC Balikpapan Sudirman"),
    makeRM("Hendra Wijaya", "RM BRILife", "KC Balikpapan Sudirman"),
    makeRM("Nadia Rahmawati", "RM BRINS", "KC Balikpapan Sudirman"),
    makeRM("Budi Santoso", "RM FT", "KC Bontang"),
    makeRM("Eka Putra", "RM Briguna", "KC Bontang"),
    makeRM("Lina Marlina", "RM SME", "KC Bontang"),
    makeRM("Wahyu Hidayat", "RM BRILife", "KC Bontang"),
    makeRM("Taufik Rahman", "RM BRINS", "KC Bontang"),
  ];

  const mamAnchor = makeRelasi("PT Mitra Abadi Mahakam", "Anchor", [
    makeProduk("PKS Payroll (282 karyawan)", "RM FT", "Khairunisa", 2000000000, 483000000, -90, 30, 60, 14),
    makeProduk("BRI Prioritas BOD/BOC", "RM FT", "Khairunisa", 4000000000, 0, -90, 30, 30, 7),
    makeProduk("Pengendapan CASA (target Rp30M)", "RM FT", "Khairunisa", 30000000000, 10000000000, -90, 60, 90, 14),
    makeProduk("EDC/QRIS Operasional", "RM FT", "Khairunisa", 50000000, 50000000, -90, -60, 14, 5),
    makeProduk("Qlola/CMS Aktif MAM+LBA+AJA", "RM FT", "Khairunisa", 1, 1, -90, -30, 30, 7),
    makeProduk("PKS Payroll (282 karyawan buka rekening)", "RM Briguna", "Selvi", 500000000, 150000000, -60, 45, 45, 10),
    makeProduk("Asuransi Aurora (BOD/BOC)", "RM BRILife", "Agma", 120000000, 0, -30, 30, 30, 7),
    makeProduk("Asuransi Jiwa Pijar (karyawan)", "RM BRILife", "Agma", 90000000, 0, -30, -5, 21, 7),
  ]);

  const mamAJA = makeRelasi("PT Anggana Jaya Abadi", "Anak Perusahaan", [
    makeProduk("KMK Operasional Galangan", "RM SME", "Andri", 5000000000, 0, -30, 60, 60, 14),
    makeProduk("Payroll 34 karyawan AJA", "RM FT", "Khairunisa", 180000000, 180000000, -60, -30, 30, 7),
  ]);

  const mamLBA = makeRelasi("PT Lintas Bahtera Abadi", "Anak Perusahaan", [
    makeProduk("Asuransi Kapal Tugboat", "RM BRINS", "Yishak", 85000000, 85000000, -75, -45, 21, 7),
    makeProduk("Asuransi Tongkang", "RM BRINS", "Yishak", 110000000, 0, -45, -10, 21, 7),
    makeProduk("Payroll 39 karyawan LBA", "RM FT", "Khairunisa", 332000000, 332000000, -75, -45, 30, 7),
  ]);

  const mamAKR = makeRelasi("PT AKR Corporindo", "Supplier", [
    makeProduk("SCF Accounts Payable", "RM SME", "Andri", 2300000000, 0, -30, 60, 45, 14),
  ]);

  const mamBBE = makeRelasi("PT Bukit Baiduri Energi", "Buyer", [
    makeProduk("SCF Accounts Receivable", "RM SME", "Andri", 5000000000, 0, -20, 70, 60, 14),
    makeProduk("Bank Garansi", "RM SME", "Andri", 17500000000, 0, -20, 90, 60, 14),
  ]);

  const mamCovs = [
    makeCovenant("Minimum CASA Mengendap", "", 20000000000, "Rp", "Bulanan", 10000000000),
    makeCovenant("Target % Transaksi via BRI", "", 70, "%", "Bulanan", 45),
    makeCovenant("Mandatory Qlola", "", 1, "Ya/Tidak", "Bulanan", 1),
    makeCovenant("Target % Payroll BRI", "", 80, "%", "Bulanan", 24),
  ];

  const ptMAM = { ...makePT("PT Mitra Abadi Mahakam", "Pertambangan", "KC Samarinda Gajah Mada", -90, []), relasi: [mamAnchor, mamAJA, mamLBA, mamAKR, mamBBE], covenants: mamCovs };

  // PT Sumber Anugrah Energi
  const saeAnchor = makeRelasi("PT Sumber Anugrah Energi", "Anchor", [
    makeProduk("Giro Operasional", "RM FT", "Khairunisa", 30000000000, 15000000000, -60, 30, 30, 7),
    makeProduk("Qlola/CMS", "RM FT", "Khairunisa", 1, 1, -60, -30, 14, 5),
    makeProduk("EDC/QRIS", "RM FT", "Khairunisa", 50000000, 50000000, -55, -25, 14, 5),
    makeProduk("KMK DF Suplesi", "RM SME", "Andri", 15000000000, 15000000000, -60, -10, 45, 14),
    makeProduk("BRI Prioritas BOD/BOC", "RM FT", "Khairunisa", 4000000000, 4000000000, -60, -15, 30, 7),
  ]);
  const ptSAE = { ...makePT("PT Sumber Anugrah Energi", "BBM/Energi", "KC Samarinda Gajah Mada", -60, []), relasi: [saeAnchor], covenants: [makeCovenant("Target % Transaksi via BRI", "", 70, "%", "Bulanan", 62)] };

  // RS Dirgahayu
  const rsAnchor = makeRelasi("RS Dirgahayu Samarinda", "Anchor", [
    makeProduk("Payroll 200 Karyawan", "RM FT", "Khairunisa", 1000000000, 500000000, -30, 60, 45, 14),
    makeProduk("Asuransi Jiwa Pijar", "RM BRILife", "Agma", 6000000, 6000000, -30, -5, 21, 7),
    makeProduk("QRIS Kantin & Farmasi", "RM FT", "Khairunisa", 112500000, 80000000, -25, 30, 21, 7),
    makeProduk("BRI Prioritas BOD (5 Orang)", "RM FT", "Khairunisa", 5000000000, 3000000000, -20, 60, 30, 7),
    makeProduk("Asuransi Aurora BOD", "RM BRILife", "Agma", 16000000, 0, -10, 50, 30, 7),
  ]);
  const ptRS = { ...makePT("RS Dirgahayu Samarinda", "Kesehatan", "KC Samarinda Gajah Mada", -30, []), relasi: [rsAnchor], covenants: [makeCovenant("Minimum CASA Mengendap", "", 2200000000, "Rp", "Bulanan", 1470000000)] };

  // PT Justin Bintang Samudera Mandiri
  const jbsmAnchor = makeRelasi("PT Justin Bintang Samudera Mandiri", "Anchor", [
    makeProduk("Giro Operasional", "RM FT", "Dian Pratiwi", 11500000000, 11500000000, -120, -60, 30, 7),
    makeProduk("KMK DF Elnusa", "RM SME", "Sari Dewi", 55000000000, 20000000000, -90, 30, 60, 14),
    makeProduk("BRI Prioritas BOD/BOC", "RM FT", "Dian Pratiwi", 2000000000, 2000000000, -120, -60, 30, 7),
    makeProduk("PKS Payroll 110 Karyawan", "RM FT", "Dian Pratiwi", 550000000, 550000000, -100, -50, 30, 7),
    makeProduk("BRIguna Karyawan", "RM Briguna", "Rizky Fauzan", 1500000000, 800000000, -80, 20, 45, 14),
  ]);
  const ptJBSM = { ...makePT("PT Justin Bintang Samudera Mandiri", "BBM/Energi", "KC Balikpapan Sudirman", -120, []), relasi: [jbsmAnchor], covenants: [makeCovenant("Target % Transaksi via BRI", "", 50, "%", "Bulanan", 48)] };

  // PT Pupuk Kaltim
  const pkAnchor = makeRelasi("PT Pupuk Kaltim", "Anchor", [
    makeProduk("Giro Korporat", "RM FT", "Budi Santoso", 100000000000, 80000000000, -150, -30, 60, 14),
    makeProduk("Qlola/CMS Enterprise", "RM FT", "Budi Santoso", 1, 1, -150, -90, 30, 7),
    makeProduk("KI Ekspansi Pabrik", "RM SME", "Lina Marlina", 50000000000, 30000000000, -120, 60, 90, 14),
    makeProduk("PKS Payroll Massal", "RM FT", "Budi Santoso", 5000000000, 5000000000, -150, -60, 45, 14),
    makeProduk("BRI Prioritas BOD/BOC", "RM FT", "Budi Santoso", 10000000000, 10000000000, -150, -60, 30, 7),
  ]);
  const ptPK = { ...makePT("PT Pupuk Kaltim", "Industri", "KC Bontang", -150, []), relasi: [pkAnchor], covenants: [makeCovenant("Minimum CASA Mengendap", "", 50000000000, "Rp", "Bulanan", 80000000000)] };

  return { rms, pts: [ptMAM, ptSAE, ptRS, ptJBSM, ptPK] };
})();

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const getAllProduk = (pt) => pt.relasi.flatMap(r => r.produk);
const pctRealisasi = (pt) => {
  const prods = getAllProduk(pt);
  const total = prods.reduce((a, p) => a + (p.target || 0), 0);
  const real = prods.reduce((a, p) => a + (p.realisasi || 0), 0);
  return total > 0 ? Math.round((real / total) * 100) : 0;
};
const scorePT = (pt) => {
  const covs = pt.covenants || [];
  const covScore = covs.length > 0 ? covs.filter(c => c.status === "Terpenuhi").length / covs.length : 0;
  const prods = getAllProduk(pt);
  const total = prods.reduce((a, p) => a + (p.target || 0), 0);
  const real = prods.reduce((a, p) => a + (p.realisasi || 0), 0);
  const realScore = total > 0 ? real / total : 0;
  const compScore = prods.length > 0 ? prods.filter(p => p.status === "Completed").length / prods.length : 0;
  return Math.round((covScore * 50 + realScore * 30 + compScore * 20) * 100);
};
const scoreRM = (rmNama, pts) => {
  const allProds = pts.flatMap(pt => getAllProduk(pt)).filter(p => p.pic === rmNama);
  if (!allProds.length) return 0;
  const completed = allProds.filter(p => p.status === "Completed").length / allProds.length;
  const total = allProds.reduce((a, p) => a + (p.target || 0), 0);
  const real = allProds.reduce((a, p) => a + (p.realisasi || 0), 0);
  const realScore = total > 0 ? real / total : 0;
  const ontrack = allProds.filter(p => p.status === "On Track" || p.status === "Completed").length / allProds.length;
  return Math.round((completed * 40 + realScore * 40 + ontrack * 20) * 100);
};
const gradeRM = (s) => s >= 85 ? "A" : s >= 70 ? "B" : s >= 55 ? "C" : "D";
const healthPT = (s) => s >= 70 ? { label: "Sehat", color: "#22c55e" } : s >= 50 ? { label: "Perlu Perhatian", color: "#f59e0b" } : { label: "Kritis", color: "#ef4444" };

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const color = STATUS_COLORS[status] || "#94a3b8";
  return <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{status}</span>;
};

const Card = ({ children, style = {} }) => (
  <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16, ...style }}>{children}</div>
);

const Btn = ({ onClick, children, variant = "primary", small = false, danger = false }) => {
  const base = { border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, fontSize: small ? 11 : 13, padding: small ? "4px 10px" : "7px 14px" };
  const styles = {
    primary: { background: "#003f88", color: "#fff" },
    secondary: { background: "#f1f5f9", color: "#475569" },
    ghost: { background: "transparent", color: "#003f88", padding: small ? "3px 6px" : "5px 10px" },
    danger: { background: "#fee2e2", color: "#dc2626" },
  };
  return <button onClick={onClick} style={{ ...base, ...(danger ? styles.danger : styles[variant]) }}>{children}</button>;
};

const Input = ({ label, value, onChange, type = "text", options, style = {} }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 3, ...style }}>
    {label && <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>{label}</label>}
    {options ? (
      <select value={value} onChange={e => onChange(e.target.value)} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 8px", fontSize: 13, background: "#fff" }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    ) : (
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 8px", fontSize: 13 }} />
    )}
  </div>
);

const ConfirmDelete = ({ onConfirm, onCancel }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
    <span style={{ fontSize: 12, color: "#dc2626" }}>Yakin hapus?</span>
    <Btn onClick={onConfirm} small danger>Ya</Btn>
    <Btn onClick={onCancel} small variant="secondary">Batal</Btn>
  </span>
);

// ─── MODALS ───────────────────────────────────────────────────────────────────

const Modal = ({ title, onClose, children }) => (
  <div style={{ background: "#00000055", position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
    <div style={{ background: "#fff", borderRadius: 14, padding: 24, minWidth: 400, maxWidth: 560, width: "90%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px #0003" }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <b style={{ fontSize: 16, color: "#003f88" }}>{title}</b>
        <Btn onClick={onClose} variant="ghost" small><X size={14} /></Btn>
      </div>
      {children}
    </div>
  </div>
);

// ─── GANTT CHART ─────────────────────────────────────────────────────────────

const GanttChart = ({ produk }) => {
  const [hover, setHover] = useState(null);
  if (!produk.length) return <div style={{ color: "#94a3b8", fontSize: 13 }}>Tidak ada produk</div>;
  const dates = produk.flatMap(p => [p.mulai, p.deadline]).filter(Boolean).sort();
  if (!dates.length) return null;
  const minDate = new Date(dates[0]); const maxDate = new Date(dates[dates.length - 1]);
  const span = Math.max(daysDiff(minDate.toISOString().split("T")[0], maxDate.toISOString().split("T")[0]), 1);
  const toX = (iso) => Math.max(0, Math.min(100, (daysDiff(minDate.toISOString().split("T")[0], iso) / span) * 100));
  const todayX = toX(today.toISOString().split("T")[0]);

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 600 }}>
        <div style={{ position: "relative", marginTop: 8 }}>
          {produk.map((p, i) => {
            if (!p.mulai || !p.deadline) return null;
            const x = toX(p.mulai); const w = Math.max(toX(p.deadline) - x, 1);
            const color = STATUS_COLORS[p.status] || "#94a3b8";
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 180, fontSize: 11, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>{p.nama}</div>
                <div style={{ flex: 1, position: "relative", height: 22, background: "#f1f5f9", borderRadius: 4 }}>
                  <div
                    style={{ position: "absolute", left: `${x}%`, width: `${w}%`, height: "100%", background: color, borderRadius: 4, cursor: "pointer", minWidth: 4, transition: "opacity .15s" }}
                    onMouseEnter={() => setHover(p.id)}
                    onMouseLeave={() => setHover(null)}
                  />
                  {hover === p.id && (
                    <div style={{ position: "absolute", left: `${x}%`, top: 26, zIndex: 10, background: "#1e293b", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 11, minWidth: 200, boxShadow: "0 8px 24px #0004" }}>
                      <b>{p.nama}</b><br />PIC: {p.pic} | {p.divisi}<br />
                      Target: {fmtRp(p.target)} | Real: {fmtRp(p.realisasi)}<br />
                      {fmt(p.mulai)} → {fmt(p.deadline)}<br />
                      <StatusBadge status={p.status} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {/* Today line */}
          {todayX >= 0 && todayX <= 100 && (
            <div style={{ position: "absolute", top: 0, left: `calc(${todayX}% + 188px)`, height: "100%", width: 2, background: "#f5a623", zIndex: 5, pointerEvents: "none" }} />
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 4, paddingLeft: 188 }}>
          <span>{fmt(minDate.toISOString().split("T")[0])}</span>
          <span style={{ color: "#f5a623" }}>▲ Hari Ini</span>
          <span>{fmt(maxDate.toISOString().split("T")[0])}</span>
        </div>
      </div>
    </div>
  );
};

// ─── PRODUK FORM ──────────────────────────────────────────────────────────────

const ProdukForm = ({ init, rms, kc, onSave, onCancel }) => {
  const kcRMs = rms.filter(r => r.kc === kc);
  const [f, setF] = useState(init || { nama: "", divisi: "RM FT", pic: "", target: 0, realisasi: 0, mulai: daysOffset(0), deadline: daysOffset(30), sla: 30, grace: 7, catatan: "" });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const produkOptions = PRODUK_MAP[f.divisi] || [];
  const rmOptions = kcRMs.filter(r => r.divisi === f.divisi).map(r => r.nama);

  const save = () => {
    const status = (f.realisasi >= f.target && f.target > 0) ? "Completed" : f.pic ? calcStatus(f.mulai, f.deadline, f.sla, f.grace) : "PIC Belum Assign";
    onSave({ ...f, target: Number(f.target), realisasi: Number(f.realisasi), sla: Number(f.sla), grace: Number(f.grace), status, id: f.id || uid() });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <div style={{ gridColumn: "1/-1" }}>
        <Input label="Divisi RM" value={f.divisi} onChange={v => { set("divisi", v); set("nama", PRODUK_MAP[v]?.[0] || ""); set("pic", ""); }} options={DIVISI_LIST} />
      </div>
      <Input label="Produk" value={f.nama} onChange={v => set("nama", v)} options={produkOptions} />
      <Input label="PIC (RM)" value={f.pic} onChange={v => set("pic", v)} options={rmOptions.length ? rmOptions : ["—"]} />
      <Input label="Target (Rp)" value={f.target} onChange={v => set("target", v)} type="number" />
      <Input label="Realisasi (Rp)" value={f.realisasi} onChange={v => set("realisasi", v)} type="number" />
      <Input label="Tanggal Mulai" value={f.mulai} onChange={v => set("mulai", v)} type="date" />
      <Input label="Deadline" value={f.deadline} onChange={v => set("deadline", v)} type="date" />
      <Input label="SLA (hari)" value={f.sla} onChange={v => set("sla", v)} type="number" />
      <Input label="Grace Period (hari)" value={f.grace} onChange={v => set("grace", v)} type="number" />
      <div style={{ gridColumn: "1/-1" }}>
        <Input label="Catatan" value={f.catatan} onChange={v => set("catatan", v)} />
      </div>
      <div style={{ gridColumn: "1/-1", display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
        <Btn onClick={onCancel} variant="secondary">Batal</Btn>
        <Btn onClick={save}>Simpan</Btn>
      </div>
    </div>
  );
};

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function App() {
  const [activeKC, setActiveKC] = useState("KC Samarinda Gajah Mada");
  const [menu, setMenu] = useState("overview");
const [pts, setPts] = useState(INIT_DATA.pts);
const [rms, setRms] = useState(INIT_DATA.rms);
const [loading, setLoading] = useState(true);
const [detailPT, setDetailPT] = useState(null);
const [dismissedAlerts, setDismissedAlerts] = useState([]);

useEffect(() => {
  async function loadCloudData() {
    try {
      const { data: ptsCloud } = await supabase.from('dashboard_data').select('value').eq('key', 'pts').single();
      if (ptsCloud) setPts(ptsCloud.value);

      const { data: rmsCloud } = await supabase.from('dashboard_data').select('value').eq('key', 'rms').single();
      if (rmsCloud) setRms(rmsCloud.value);
    } catch (err) {
      console.log("Gagal memuat database cloud, menggunakan data lokal bawaan.");
    } finally {
      setLoading(false);
    }
  }
  loadCloudData();
}, []);

useEffect(() => {
  if (!loading) {
    supabase.from('dashboard_data').upsert({ key: 'pts', value: pts }).then();
  }
}, [pts, loading]);

useEffect(() => {
  if (!loading) {
    supabase.from('dashboard_data').upsert({ key: 'rms', value: rms }).then();
  }
}, [rms, loading]);

  // ─ Filtered data
  const filteredPTs = activeKC === "Semua KC" ? pts : pts.filter(p => p.kc === activeKC);
  const filteredRMs = activeKC === "Semua KC" ? rms : rms.filter(r => r.kc === activeKC);
  const allProduk = filteredPTs.flatMap(pt => getAllProduk(pt));

  // ─ Alerts
  const alertsOverdue = allProduk.filter(p => p.status === "Overdue" && !dismissedAlerts.includes(p.id));
  const alertsGrace = allProduk.filter(p => p.status === "Grace Period" && !dismissedAlerts.includes(p.id));
  const covAlerts = filteredPTs.flatMap(pt => (pt.covenants || []).filter(c => c.status === "Tidak Terpenuhi" && !dismissedAlerts.includes(c.id)));
  const totalAlerts = alertsOverdue.length + alertsGrace.length + covAlerts.length;

  // ─ PT CRUD
  const [ptForm, setPtForm] = useState(null);
  const [deletePTId, setDeletePTId] = useState(null);
  const openPtForm = (pt = null) => setPtForm(pt ? { ...pt } : { id: null, nama: "", sektor: SEKTOR_LIST[0], kc: activeKC === "Semua KC" ? KC_LIST[1] : activeKC, kickoff: daysOffset(0), relasi: [], covenants: [] });
  const savePT = () => {
    if (ptForm.id) setPts(prev => prev.map(p => p.id === ptForm.id ? ptForm : p));
    else setPts(prev => [...prev, { ...ptForm, id: uid(), relasi: [], covenants: [] }]);
    setPtForm(null);
  };
  const deletePT = (id) => { setPts(prev => prev.filter(p => p.id !== id)); setDeletePTId(null); if (detailPT?.id === id) setDetailPT(null); };

  // ─ RM CRUD
  const [rmForm, setRmForm] = useState(null);
  const [deleteRMId, setDeleteRMId] = useState(null);
  const openRmForm = (rm = null) => setRmForm(rm ? { ...rm } : { id: null, nama: "", divisi: "RM FT", kc: activeKC === "Semua KC" ? KC_LIST[1] : activeKC });
  const saveRM = () => {
    if (rmForm.id) setRms(prev => prev.map(r => r.id === rmForm.id ? rmForm : r));
    else setRms(prev => [...prev, { ...rmForm, id: uid() }]);
    setRmForm(null);
  };
  const deleteRM = (id) => {
    const rmNama = rms.find(r => r.id === id)?.nama;
    if (rmNama) setPts(prev => prev.map(pt => ({ ...pt, relasi: pt.relasi.map(rel => ({ ...rel, produk: rel.produk.map(p => p.pic === rmNama ? { ...p, pic: "", status: "PIC Belum Assign" } : p) })) })));
    setRms(prev => prev.filter(r => r.id !== id));
    setDeleteRMId(null);
  };

  // ─ Relasi CRUD (inside PT detail)
  const [relasiForm, setRelasiForm] = useState(null);
  const [deleteRelasiId, setDeleteRelasiId] = useState(null);
  const [produkModal, setProdukModal] = useState(null); // {relasiId, produk|null}
  const [deleteProdukId, setDeleteProdukId] = useState(null);
  const [deleteCovenantId, setDeleteCovenantId] = useState(null);
  const [covenantForm, setCovenantForm] = useState(null);

  const updateDetailPT = (updater) => {
    const updated = updater(detailPT);
    setDetailPT(updated);
    setPts(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const saveRelasi = (form) => {
    updateDetailPT(pt => {
      const exists = pt.relasi.find(r => r.id === form.id);
      return { ...pt, relasi: exists ? pt.relasi.map(r => r.id === form.id ? form : r) : [...pt.relasi, { ...form, id: uid(), produk: [] }] };
    });
    setRelasiForm(null);
  };
  const deleteRelasi = (id) => {
    updateDetailPT(pt => ({ ...pt, relasi: pt.relasi.filter(r => r.id !== id) }));
    setDeleteRelasiId(null);
  };
  const saveProduk = (relasiId, form) => {
    updateDetailPT(pt => ({
      ...pt, relasi: pt.relasi.map(r => r.id === relasiId ? {
        ...r, produk: r.produk.find(p => p.id === form.id) ? r.produk.map(p => p.id === form.id ? form : p) : [...r.produk, form]
      } : r)
    }));
    setProdukModal(null);
  };
  const deleteProduk = (relasiId, produkId) => {
    updateDetailPT(pt => ({ ...pt, relasi: pt.relasi.map(r => r.id === relasiId ? { ...r, produk: r.produk.filter(p => p.id !== produkId) } : r) }));
    setDeleteProdukId(null);
  };

  // Covenant
  const saveCovenant = (form) => {
    const pct = form.target > 0 ? form.realisasi / form.target : 1;
    const status = pct >= 1 ? "Terpenuhi" : pct >= 0.75 ? "Sebagian" : "Tidak Terpenuhi";
    const cov = { ...form, status, id: form.id || uid(), target: Number(form.target), realisasi: Number(form.realisasi) };
    updateDetailPT(pt => {
      const exists = pt.covenants?.find(c => c.id === cov.id);
      return { ...pt, covenants: exists ? pt.covenants.map(c => c.id === cov.id ? cov : c) : [...(pt.covenants || []), cov] };
    });
    setCovenantForm(null);
  };
  const deleteCovenant = (id) => {
    updateDetailPT(pt => ({ ...pt, covenants: (pt.covenants || []).filter(c => c.id !== id) }));
    setDeleteCovenantId(null);
  };

  // ─── OVERVIEW PAGE ──────────────────────────────────────────────────────────
  const OverviewPage = () => {
    const totalTarget = filteredPTs.flatMap(p => getAllProduk(p)).reduce((a, p) => a + (p.target || 0), 0);
    const totalReal = filteredPTs.flatMap(p => getAllProduk(p)).reduce((a, p) => a + (p.realisasi || 0), 0);
    const statusDist = allProduk.reduce((a, p) => { a[p.status] = (a[p.status] || 0) + 1; return a; }, {});
    const kcGroups = KC_LIST.slice(1).map(kc => {
      const kcPTs = pts.filter(p => p.kc === kc);
      const t = kcPTs.flatMap(getAllProduk).reduce((a, p) => a + (p.target || 0), 0);
      const r = kcPTs.flatMap(getAllProduk).reduce((a, p) => a + (p.realisasi || 0), 0);
      return { kc: kc.replace("KC ", ""), pct: t > 0 ? Math.round((r / t) * 100) : 0, t, r };
    }).filter(k => k.t > 0).sort((a, b) => b.pct - a.pct);

    const pieData = Object.entries(statusDist).map(([name, value]) => ({ name, value }));

    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ color: "#003f88", margin: "0 0 20px", fontSize: 20 }}>Overview Regional — {activeKC}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Total PT Terdaftar", value: filteredPTs.length, icon: <Building2 size={20} color="#003f88" /> },
            { label: "Total Produk Aktif", value: allProduk.filter(p => p.status !== "Completed").length, icon: <BarChart2 size={20} color="#003f88" /> },
            { label: "Total Target", value: fmtRp(totalTarget), icon: <Circle size={20} color="#003f88" /> },
            { label: "Total Realisasi", value: fmtRp(totalReal), icon: <CheckCircle size={20} color="#22c55e" /> },
          ].map(c => (
            <Card key={c.label}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div><div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>{c.label}</div><div style={{ fontSize: 22, fontWeight: 700, color: "#1e293b" }}>{c.value}</div></div>
                {c.icon}
              </div>
            </Card>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14, marginBottom: 24 }}>
          <Card>
            <b style={{ fontSize: 13, color: "#003f88" }}>% Pencapaian per KC</b>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={kcGroups} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="kc" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="pct" name="% Realisasi" fill="#003f88" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <b style={{ fontSize: 13, color: "#003f88" }}>Distribusi Status Produk</b>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => `${value}`}>
                  {pieData.map((entry) => <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#94a3b8"} />)}
                </Pie>
                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card>
          <b style={{ fontSize: 13, color: "#003f88" }}>Ranking KC — % Realisasi Nilai</b>
          <table style={{ width: "100%", marginTop: 10, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Rank", "KC", "Total Target", "Total Realisasi", "% Realisasi"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", fontSize: 11, color: "#64748b", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kcGroups.map((k, i) => (
                <tr key={k.kc} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 700, color: i === 0 ? "#f5a623" : "#64748b" }}>#{i + 1}</td>
                  <td style={{ padding: "8px 10px", fontSize: 13 }}>KC {k.kc}</td>
                  <td style={{ padding: "8px 10px", fontSize: 13, color: "#64748b" }}>{fmtRp(k.t)}</td>
                  <td style={{ padding: "8px 10px", fontSize: 13, color: "#64748b" }}>{fmtRp(k.r)}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: "#e2e8f0", borderRadius: 3 }}>
                        <div style={{ width: `${k.pct}%`, height: "100%", background: k.pct >= 70 ? "#22c55e" : k.pct >= 50 ? "#f5a623" : "#ef4444", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, minWidth: 34 }}>{k.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    );
  };

  // ─── EKOSISTEM PAGE ─────────────────────────────────────────────────────────
  const EkosistemPage = () => {
    if (detailPT) return <DetailPTPage />;
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ color: "#003f88", margin: 0, fontSize: 20 }}>Manajemen Ekosistem — {activeKC}</h2>
          <Btn onClick={() => openPtForm()}><Plus size={14} /> Tambah PT</Btn>
        </div>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#003f88" }}>
                {["Nama PT", "Sektor", "KC", "Kick-off", "Produk", "% Realisasi", "Skor PT", "Status", "Aksi"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", fontSize: 11, color: "#fff", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPTs.map((pt, i) => {
                const pct = pctRealisasi(pt);
                const score = scorePT(pt);
                const health = healthPT(score);
                const prods = getAllProduk(pt);
                const statuses = prods.map(p => p.status);
                const dom = ["Overdue", "Grace Period", "On Track", "Belum Mulai", "Completed"].find(s => statuses.includes(s)) || "—";
                return (
                  <tr key={pt.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 12px", fontSize: 13 }}>
                      <button onClick={() => setDetailPT(pt)} style={{ background: "none", border: "none", cursor: "pointer", color: "#003f88", fontWeight: 700, fontSize: 13, padding: 0, textDecoration: "underline" }}>{pt.nama}</button>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>{pt.sektor}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>{pt.kc}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12 }}>{fmt(pt.kickoff)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{prods.length}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 60, height: 6, background: "#e2e8f0", borderRadius: 3 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: pct >= 70 ? "#22c55e" : pct >= 50 ? "#f5a623" : "#ef4444", borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px" }}><span style={{ fontWeight: 700, color: health.color }}>{score}%</span></td>
                    <td style={{ padding: "10px 12px" }}>{dom !== "—" ? <StatusBadge status={dom} /> : "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Btn onClick={() => openPtForm(pt)} small variant="ghost"><Edit2 size={12} /></Btn>
                        {deletePTId === pt.id ? <ConfirmDelete onConfirm={() => deletePT(pt.id)} onCancel={() => setDeletePTId(null)} /> : <Btn onClick={() => setDeletePTId(pt.id)} small danger><Trash2 size={12} /></Btn>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredPTs.length && <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Belum ada PT terdaftar</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    );
  };

  // ─── DETAIL PT PAGE ──────────────────────────────────────────────────────────
  const DetailPTPage = () => {
    const pt = detailPT;
    const allProds = getAllProduk(pt);

    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Btn onClick={() => setDetailPT(null)} variant="secondary" small><ChevronLeft size={14} /> Kembali</Btn>
          <ChevronRight size={14} color="#94a3b8" />
          <span style={{ color: "#003f88", fontWeight: 700 }}>{pt.nama}</span>
        </div>

        {/* Info PT */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#003f88" }}>{pt.nama}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{pt.sektor} · {pt.kc} · Kick-off: {fmt(pt.kickoff)}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn onClick={() => openPtForm(pt)} small><Edit2 size={12} /> Edit</Btn>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Skor PT: <b style={{ color: healthPT(scorePT(pt)).color, fontSize: 14 }}>{scorePT(pt)}%</b></div>
            <div style={{ fontSize: 12, color: "#64748b" }}>% Realisasi: <b style={{ fontSize: 14 }}>{pctRealisasi(pt)}%</b></div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Total Produk: <b style={{ fontSize: 14 }}>{allProds.length}</b></div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Health: <b style={{ color: healthPT(scorePT(pt)).color }}>{healthPT(scorePT(pt)).label}</b></div>
          </div>
        </Card>

        {/* Gantt */}
        <Card style={{ marginBottom: 16 }}>
          <b style={{ color: "#003f88", fontSize: 13 }}>Timeline Produk (Gantt Chart)</b>
          <div style={{ marginTop: 12 }}><GanttChart produk={allProds} /></div>
        </Card>

        {/* Relasi & Produk */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <b style={{ color: "#003f88" }}>Relasi Ekosistem & Produk</b>
            <Btn onClick={() => setRelasiForm({ id: null, nama: "", jenis: "Anak Perusahaan" })} small><Plus size={12} /> Tambah Relasi</Btn>
          </div>
          {pt.relasi.map(rel => (
            <div key={rel.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
              <div style={{ background: "#f8fafc", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{rel.nama}</span>
                  <span style={{ marginLeft: 8, fontSize: 11, color: "#64748b", background: "#e2e8f0", borderRadius: 4, padding: "1px 6px" }}>{rel.jenis}</span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <Btn onClick={() => setProdukModal({ relasiId: rel.id, produk: null })} small><Plus size={12} /> Produk</Btn>
                  <Btn onClick={() => setRelasiForm({ ...rel })} small variant="ghost"><Edit2 size={12} /></Btn>
                  {deleteRelasiId === rel.id ? <ConfirmDelete onConfirm={() => deleteRelasi(rel.id)} onCancel={() => setDeleteRelasiId(null)} /> : <Btn onClick={() => setDeleteRelasiId(rel.id)} small danger><Trash2 size={12} /></Btn>}
                </div>
              </div>
              <div style={{ padding: "8px 14px" }}>
                {rel.produk.length === 0 ? <div style={{ fontSize: 12, color: "#94a3b8" }}>Belum ada produk</div> : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Produk", "Divisi", "PIC", "Target", "Realisasi", "Deadline", "Status", "Aksi"].map(h => (
                          <th key={h} style={{ fontSize: 10, color: "#94a3b8", textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rel.produk.map(p => (
                        <tr key={p.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "6px 6px", fontSize: 12 }}>{p.nama}</td>
                          <td style={{ padding: "6px 6px", fontSize: 11, color: "#64748b" }}>{p.divisi}</td>
                          <td style={{ padding: "6px 6px", fontSize: 11, color: "#64748b" }}>{p.pic || "—"}</td>
                          <td style={{ padding: "6px 6px", fontSize: 12 }}>{fmtRp(p.target)}</td>
                          <td style={{ padding: "6px 6px", fontSize: 12 }}>{fmtRp(p.realisasi)}</td>
                          <td style={{ padding: "6px 6px", fontSize: 11, color: "#64748b" }}>{fmt(p.deadline)}</td>
                          <td style={{ padding: "6px 6px" }}><StatusBadge status={p.status} /></td>
                          <td style={{ padding: "6px 6px" }}>
                            <div style={{ display: "flex", gap: 2 }}>
                              <Btn onClick={() => setProdukModal({ relasiId: rel.id, produk: p })} small variant="ghost"><Edit2 size={11} /></Btn>
                              {deleteProdukId === p.id ? <ConfirmDelete onConfirm={() => deleteProduk(rel.id, p.id)} onCancel={() => setDeleteProdukId(null)} /> : <Btn onClick={() => setDeleteProdukId(p.id)} small danger><Trash2 size={11} /></Btn>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
        </Card>

        {/* Covenant */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <b style={{ color: "#003f88" }}>Covenant Nasabah</b>
            <Btn onClick={() => setCovenantForm({ id: null, jenis: COVENANT_TYPES[0], customNama: "", target: 0, satuan: "%", periode: "Bulanan", realisasi: 0 })} small><Plus size={12} /> Tambah</Btn>
          </div>
          {(pt.covenants || []).map(cov => (
            <div key={cov.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{cov.jenis === "Custom" ? cov.customNama : cov.jenis}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Target: {cov.target}{cov.satuan === "%" ? "%" : " " + cov.satuan} | Realisasi: {cov.realisasi}{cov.satuan === "%" ? "%" : ""} | {cov.periode}</div>
              </div>
              <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: cov.status === "Terpenuhi" ? "#dcfce7" : cov.status === "Sebagian" ? "#fef9c3" : "#fee2e2", color: cov.status === "Terpenuhi" ? "#16a34a" : cov.status === "Sebagian" ? "#a16207" : "#dc2626" }}>{cov.status}</span>
              <Btn onClick={() => setCovenantForm({ ...cov })} small variant="ghost"><Edit2 size={11} /></Btn>
              {deleteCovenantId === cov.id ? <ConfirmDelete onConfirm={() => deleteCovenant(cov.id)} onCancel={() => setDeleteCovenantId(null)} /> : <Btn onClick={() => setDeleteCovenantId(cov.id)} small danger><Trash2 size={11} /></Btn>}
            </div>
          ))}
          {!(pt.covenants?.length) && <div style={{ fontSize: 12, color: "#94a3b8" }}>Belum ada covenant</div>}
        </Card>
      </div>
    );
  };

  // ─── RM PAGE ────────────────────────────────────────────────────────────────
  const RMPage = () => {
    const [filterDiv, setFilterDiv] = useState("Semua");
    const [filterGrade, setFilterGrade] = useState("Semua");
    const rmData = filteredRMs.map(rm => {
      const s = scoreRM(rm.nama, pts);
      const g = gradeRM(s);
      const prods = pts.flatMap(pt => getAllProduk(pt)).filter(p => p.pic === rm.nama);
      const ptCount = [...new Set(pts.filter(pt => getAllProduk(pt).some(p => p.pic === rm.nama)).map(p => p.id))].length;
      return { ...rm, score: s, grade: g, ptCount, produkTotal: prods.length, completed: prods.filter(p => p.status === "Completed").length };
    }).filter(r => filterDiv === "Semua" || r.divisi === filterDiv)
      .filter(r => filterGrade === "Semua" || r.grade === filterGrade);

    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ color: "#003f88", margin: 0, fontSize: 20 }}>Performa RM — {activeKC}</h2>
          <Btn onClick={() => openRmForm()}><Plus size={14} /> Tambah RM</Btn>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Input value={filterDiv} onChange={setFilterDiv} options={["Semua", ...DIVISI_LIST]} />
          <Input value={filterGrade} onChange={setFilterGrade} options={["Semua", "A", "B", "C", "D"]} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <Card>
            <b style={{ fontSize: 13, color: "#003f88" }}>Skor RM</b>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rmData.slice(0, 10)} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="nama" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Tooltip formatter={v => `${v}%`} />
                <Bar dataKey="score" name="Skor" fill="#003f88" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#003f88" }}>{["Nama RM", "Divisi", "PT", "Produk", "Completed", "Skor", "Grade", "Aksi"].map(h => <th key={h} style={{ padding: "8px 10px", fontSize: 10, color: "#fff", textAlign: "left" }}>{h}</th>)}</tr></thead>
              <tbody>
                {rmData.map((rm, i) => (
                  <tr key={rm.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600 }}>{rm.nama}</td>
                    <td style={{ padding: "8px 10px", fontSize: 11, color: "#64748b" }}>{rm.divisi}</td>
                    <td style={{ padding: "8px 10px", fontSize: 13 }}>{rm.ptCount}</td>
                    <td style={{ padding: "8px 10px", fontSize: 13 }}>{rm.produkTotal}</td>
                    <td style={{ padding: "8px 10px", fontSize: 13, color: "#22c55e", fontWeight: 600 }}>{rm.completed}</td>
                    <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 700 }}>{rm.score}%</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ background: rm.grade === "A" ? "#dcfce7" : rm.grade === "B" ? "#dbeafe" : rm.grade === "C" ? "#fef9c3" : "#fee2e2", color: rm.grade === "A" ? "#16a34a" : rm.grade === "B" ? "#1d4ed8" : rm.grade === "C" ? "#a16207" : "#dc2626", borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{rm.grade}</span>
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", gap: 2 }}>
                        <Btn onClick={() => openRmForm(rm)} small variant="ghost"><Edit2 size={11} /></Btn>
                        {deleteRMId === rm.id ? <ConfirmDelete onConfirm={() => deleteRM(rm.id)} onCancel={() => setDeleteRMId(null)} /> : <Btn onClick={() => setDeleteRMId(rm.id)} small danger><Trash2 size={11} /></Btn>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!rmData.length && <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Tidak ada RM</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    );
  };

  // ─── NASABAH PAGE ────────────────────────────────────────────────────────────
  const NasabahPage = () => {
    const ptData = filteredPTs.map(pt => {
      const s = scorePT(pt);
      const h = healthPT(s);
      const prods = getAllProduk(pt);
      const covs = pt.covenants || [];
      return { ...pt, score: s, health: h, produkCount: prods.length, covTerpenuhi: covs.filter(c => c.status === "Terpenuhi").length, covTotal: covs.length, pct: pctRealisasi(pt) };
    }).sort((a, b) => b.score - a.score);

    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ color: "#003f88", margin: "0 0 20px", fontSize: 20 }}>Performa Nasabah — {activeKC}</h2>
        <div style={{ marginBottom: 16 }}>
          <Card>
            <b style={{ fontSize: 13, color: "#003f88" }}>Skor PT per KC</b>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ptData.slice(0, 10)} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="nama" tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Tooltip formatter={v => `${v}%`} />
                <Bar dataKey="score" name="Skor PT" radius={[4, 4, 0, 0]}>
                  {ptData.map((pt) => <Cell key={pt.id} fill={pt.health.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {ptData.map(pt => (
            <Card key={pt.id} style={{ borderLeft: `4px solid ${pt.health.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{pt.nama}</div>
                <span style={{ fontSize: 20, fontWeight: 800, color: pt.health.color }}>{pt.score}%</span>
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>{pt.sektor} · {pt.kc}</div>
              <span style={{ fontSize: 11, fontWeight: 700, background: pt.health.color + "22", color: pt.health.color, padding: "2px 8px", borderRadius: 6 }}>{pt.health.label}</span>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>Realisasi<br /><b style={{ fontSize: 14, color: "#1e293b" }}>{pt.pct}%</b></div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Produk Aktif<br /><b style={{ fontSize: 14 }}>{pt.produkCount}</b></div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Covenant OK<br /><b style={{ fontSize: 14, color: "#22c55e" }}>{pt.covTerpenuhi}/{pt.covTotal}</b></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  // ─── ALERT PAGE ─────────────────────────────────────────────────────────────
  const AlertPage = () => (
    <div style={{ padding: 24 }}>
      <h2 style={{ color: "#003f88", margin: "0 0 20px", fontSize: 20 }}>Alert & Covenant</h2>
      {[
        { title: "Produk Overdue", items: alertsOverdue, color: "#ef4444" },
        { title: "Produk Grace Period", items: alertsGrace, color: "#f59e0b" },
        { title: "Covenant Tidak Terpenuhi", items: covAlerts, color: "#7c3aed" },
      ].map(sec => (
        <Card key={sec.title} style={{ marginBottom: 16, borderLeft: `4px solid ${sec.color}` }}>
          <div style={{ fontWeight: 700, color: sec.color, marginBottom: 10, fontSize: 14 }}>{sec.title} ({sec.items.length})</div>
          {sec.items.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 12 }}>Tidak ada alert</div> : sec.items.map(item => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #f1f5f9" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.nama}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{item.pic ? `PIC: ${item.pic} · Deadline: ${fmt(item.deadline)}` : `Target: ${item.target}${item.satuan === "%" ? "%" : ""} | Real: ${item.realisasi}`}</div>
              </div>
              <Btn onClick={() => setDismissedAlerts(p => [...p, item.id])} small variant="secondary">Dismiss</Btn>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );

  // ─── SIDEBAR ─────────────────────────────────────────────────────────────────
  const navItems = [
    { id: "overview", icon: <Home size={16} />, label: "Overview Regional" },
    { id: "ekosistem", icon: <Building2 size={16} />, label: "Manajemen Ekosistem" },
    { id: "rm", icon: <Users size={16} />, label: "Performa RM" },
    { id: "nasabah", icon: <BarChart2 size={16} />, label: "Performa Nasabah" },
    { id: "alert", icon: <Bell size={16} />, label: "Alert & Covenant", badge: totalAlerts },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#f8fafc", overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: "#003f88", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ padding: "18px 16px 12px" }}>
          <div style={{ color: "#f5a623", fontWeight: 800, fontSize: 13, letterSpacing: 0.5 }}>BRI ECOSYSTEM</div>
          <div style={{ color: "#93c5fd", fontSize: 10, marginTop: 2 }}>MONITOR — KANWIL BALIKPAPAN</div>
        </div>
        {/* KC Selector */}
        <div style={{ padding: "0 12px 12px" }}>
          <select value={activeKC} onChange={e => { setActiveKC(e.target.value); setDetailPT(null); }} style={{ width: "100%", background: "#1d4ed8", color: "#fff", border: "1px solid #3b82f6", borderRadius: 7, padding: "6px 8px", fontSize: 11, cursor: "pointer" }}>
            {KC_LIST.map(kc => <option key={kc} value={kc}>{kc}</option>)}
          </select>
        </div>
        {/* Nav */}
        <nav style={{ flex: 1 }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setMenu(item.id); setDetailPT(null); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: menu === item.id ? "#1d4ed8" : "transparent", border: "none", cursor: "pointer", color: menu === item.id ? "#fff" : "#93c5fd", fontSize: 12, textAlign: "left", borderLeft: menu === item.id ? "3px solid #f5a623" : "3px solid transparent", position: "relative" }}>
              {item.icon}
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: 999, fontSize: 10, fontWeight: 700, padding: "1px 6px", minWidth: 18, textAlign: "center" }}>{item.badge}</span>}
            </button>
          ))}
        </nav>
        <div style={{ padding: 12, color: "#3b82f6", fontSize: 10 }}>v1.0 — Kanwil Balikpapan</div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {menu === "overview" && <OverviewPage />}
        {menu === "ekosistem" && <EkosistemPage />}
        {menu === "rm" && <RMPage />}
        {menu === "nasabah" && <NasabahPage />}
        {menu === "alert" && <AlertPage />}
      </div>

      {/* Modals */}
      {ptForm && (
        <Modal title={ptForm.id ? "Edit PT" : "Tambah PT"} onClose={() => setPtForm(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ gridColumn: "1/-1" }}><Input label="Nama PT" value={ptForm.nama} onChange={v => setPtForm(p => ({ ...p, nama: v }))} /></div>
            <Input label="Sektor" value={ptForm.sektor} onChange={v => setPtForm(p => ({ ...p, sektor: v }))} options={SEKTOR_LIST} />
            <Input label="KC" value={ptForm.kc} onChange={v => setPtForm(p => ({ ...p, kc: v }))} options={KC_LIST.slice(1)} />
            <div style={{ gridColumn: "1/-1" }}><Input label="Tanggal Kick-off" value={ptForm.kickoff} onChange={v => setPtForm(p => ({ ...p, kickoff: v }))} type="date" /></div>
            <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Btn onClick={() => setPtForm(null)} variant="secondary">Batal</Btn>
              <Btn onClick={savePT}>Simpan</Btn>
            </div>
          </div>
        </Modal>
      )}

      {rmForm && (
        <Modal title={rmForm.id ? "Edit RM" : "Tambah RM"} onClose={() => setRmForm(null)}>
          <div style={{ display: "grid", gap: 10 }}>
            <Input label="Nama RM" value={rmForm.nama} onChange={v => setRmForm(p => ({ ...p, nama: v }))} />
            <Input label="Divisi" value={rmForm.divisi} onChange={v => setRmForm(p => ({ ...p, divisi: v }))} options={DIVISI_LIST} />
            <Input label="KC Penempatan" value={rmForm.kc} onChange={v => setRmForm(p => ({ ...p, kc: v }))} options={KC_LIST.slice(1)} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn onClick={() => setRmForm(null)} variant="secondary">Batal</Btn>
              <Btn onClick={saveRM}>Simpan</Btn>
            </div>
          </div>
        </Modal>
      )}

      {relasiForm && (
        <Modal title={relasiForm.id ? "Edit Relasi" : "Tambah Relasi"} onClose={() => setRelasiForm(null)}>
          <div style={{ display: "grid", gap: 10 }}>
            <Input label="Nama Entitas" value={relasiForm.nama} onChange={v => setRelasiForm(p => ({ ...p, nama: v }))} />
            <Input label="Jenis Relasi" value={relasiForm.jenis} onChange={v => setRelasiForm(p => ({ ...p, jenis: v }))} options={RELASI_TYPES} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn onClick={() => setRelasiForm(null)} variant="secondary">Batal</Btn>
              <Btn onClick={() => saveRelasi(relasiForm)}>Simpan</Btn>
            </div>
          </div>
        </Modal>
      )}

      {produkModal && (
        <Modal title={produkModal.produk ? "Edit Produk" : "Tambah Produk"} onClose={() => setProdukModal(null)}>
          <ProdukForm
            init={produkModal.produk}
            rms={rms}
            kc={detailPT?.kc || activeKC}
            onSave={(form) => saveProduk(produkModal.relasiId, form)}
            onCancel={() => setProdukModal(null)}
          />
        </Modal>
      )}

      {covenantForm && (
        <Modal title={covenantForm.id ? "Edit Covenant" : "Tambah Covenant"} onClose={() => setCovenantForm(null)}>
          <div style={{ display: "grid", gap: 10 }}>
            <Input label="Jenis Covenant" value={covenantForm.jenis} onChange={v => setCovenantForm(p => ({ ...p, jenis: v }))} options={COVENANT_TYPES} />
            {covenantForm.jenis === "Custom" && <Input label="Nama Custom" value={covenantForm.customNama} onChange={v => setCovenantForm(p => ({ ...p, customNama: v }))} />}
            <Input label="Target" value={covenantForm.target} onChange={v => setCovenantForm(p => ({ ...p, target: v }))} type="number" />
            <Input label="Satuan (%, Rp, Ya/Tidak)" value={covenantForm.satuan} onChange={v => setCovenantForm(p => ({ ...p, satuan: v }))} />
            <Input label="Periode Evaluasi" value={covenantForm.periode} onChange={v => setCovenantForm(p => ({ ...p, periode: v }))} options={EVAL_PERIODS} />
            <Input label="Realisasi" value={covenantForm.realisasi} onChange={v => setCovenantForm(p => ({ ...p, realisasi: v }))} type="number" />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn onClick={() => setCovenantForm(null)} variant="secondary">Batal</Btn>
              <Btn onClick={() => saveCovenant(covenantForm)}>Simpan</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}