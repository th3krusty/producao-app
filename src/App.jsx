import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  Target, TrendingUp, TrendingDown, PackageCheck, CalendarDays, Gauge,
  Settings2, ClipboardList, CalendarRange, FlaskConical, History, FileBarChart2,
  LayoutDashboard, Sun, Moon, Plus, Trash2, Download, RotateCcw, AlertTriangle,
  CheckCircle2, Info, ChevronRight, Snowflake, Wrench
} from "lucide-react";
import * as XLSX from "xlsx";
import { cloudGetItem, cloudSetItem, migrarDoLocalStorageSeNecessario } from "./supabaseClient";

/* ============================== HELPERS ============================== */

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho",
  "Agosto","Setembro","Outubro","Novembro","Dezembro"];

const fmt = (n, d = 0) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtDate = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const daysInMonth = (month, year) => new Date(year, month, 0).getDate();

const pad2 = (n) => String(n).padStart(2, "0");
const mesKey = (ano, mes) => `${ano}-${pad2(mes)}`;

const uid = () => Math.random().toString(36).slice(2, 10);

/* ============================== DEMO DATA ============================== */

const DEMO_META = {
  mes: 8, ano: 2026,
  metaTotal: 10000,
  diasProdutivosPlanejados: 22,
  diasProdutivosRestantes: 8,
};

const DEMO_QTDS = [450,470,430,460,480,410,455,470,490,440,460,475,465,485];
const DEMO_TURNOS = ["1º","1º","2º","1º","2º","1º","1º","2º","1º","2º","1º","1º","2º","1º"];
const DEMO_OBS = [
  "Produção normal","Produção normal","Parada de máquina (30min)","Produção normal",
  "Acima do planejado","Falta de matéria-prima","Produção normal","Produção normal",
  "Recorde do mês","Produção normal","Manutenção preventiva","Produção normal",
  "Produção normal","Acima do planejado"
];

const DEMO_PLANEJADO_DIA = 455;

const DEMO_PRODUCOES = DEMO_QTDS.map((q, i) => ({
  id: uid(),
  data: `2026-08-${String(i + 1).padStart(2, "0")}`,
  quantidade: q,
  planejado: DEMO_PLANEJADO_DIA,
  turno: DEMO_TURNOS[i],
  observacao: DEMO_OBS[i],
}));

const DEMO_HISTORICO = [
  { mes: "Maio", mesNum: 5, ano: 2026, meta: 9500, produzido: 9120, diasProdutivos: 21, status: "Não atingida" },
  { mes: "Junho", mesNum: 6, ano: 2026, meta: 10000, produzido: 10350, diasProdutivos: 22, status: "Atingida" },
  { mes: "Julho", mesNum: 7, ano: 2026, meta: 11000, produzido: 10720, diasProdutivos: 23, status: "Não atingida" },
];

/* ============================== THEME ============================== */

const theme = (dark) => ({
  bg: dark ? "bg-slate-950" : "bg-stone-100",
  bgSoft: dark ? "bg-slate-900" : "bg-white",
  panel: dark ? "bg-slate-900 border-slate-800" : "bg-white border-stone-300",
  panelHead: dark ? "border-slate-800" : "border-stone-200",
  text: dark ? "text-slate-100" : "text-slate-900",
  textMuted: dark ? "text-slate-400" : "text-slate-500",
  border: dark ? "border-slate-800" : "border-stone-300",
  well: "bg-slate-950",
  wellText: "text-amber-400",
  input: dark
    ? "bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-600"
    : "bg-white border-stone-300 text-slate-900 placeholder-stone-400",
  sidebar: dark ? "bg-slate-900 border-slate-800" : "bg-slate-900 border-slate-900",
});

const STATUS = {
  verde: { label: "Dentro do planejado", ring: "ring-emerald-500", bg: "bg-emerald-500", text: "text-emerald-500", soft: "bg-emerald-500/10", icon: CheckCircle2 },
  amarelo: { label: "Atenção", ring: "ring-amber-500", bg: "bg-amber-500", text: "text-amber-500", soft: "bg-amber-500/10", icon: AlertTriangle },
  vermelho: { label: "Risco", ring: "ring-rose-500", bg: "bg-rose-500", text: "text-rose-500", soft: "bg-rose-500/10", icon: AlertTriangle },
};

/* ============================== SMALL UI PIECES ============================== */

function SegmentedBar({ pct, colorClass }) {
  const total = 24;
  const filled = Math.round((Math.min(Math.max(pct, 0), 100) / 100) * total);
  return (
    <div className="flex gap-[3px] w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2.5 flex-1 rounded-[1px] ${i < filled ? colorClass : "bg-slate-700/30"}`}
        />
      ))}
    </div>
  );
}

function Kpi({ t, label, value, unit, sub, accent = "text-amber-400", icon: Icon }) {
  return (
    <div className={`rounded border ${t.panel} p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-semibold uppercase tracking-widest ${t.textMuted}`}>{label}</span>
        {Icon && <Icon size={15} className={t.textMuted} />}
      </div>
      <div className={`${t.well} rounded px-3 py-2.5`}>
        <div className="flex items-baseline gap-1.5">
          <span className={`font-mono text-2xl md:text-[26px] font-bold tabular-nums ${accent} tracking-tight`}>
            {value}
          </span>
          {unit && <span className="font-mono text-[11px] text-slate-500 uppercase">{unit}</span>}
        </div>
      </div>
      {sub && <div className={`text-xs ${t.textMuted}`}>{sub}</div>}
    </div>
  );
}

function Panel({ t, title, icon: Icon, right, children, className = "" }) {
  return (
    <div className={`rounded border ${t.panel} ${className}`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b ${t.panelHead}`}>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={15} className="text-amber-500" />}
          <h3 className={`text-xs font-bold uppercase tracking-widest ${t.textMuted}`}>{title}</h3>
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ t, label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={`text-[11px] font-semibold uppercase tracking-wide ${t.textMuted}`}>{label}</span>
      {children}
    </label>
  );
}

const inputCls = (t) =>
  `${t.input} border rounded px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-amber-500/60`;

/* ============================== CALC ENGINE ============================== */

function useCalc(meta, producoes) {
  return useMemo(() => {
    const producaoAcumulada = producoes.reduce((s, p) => s + Number(p.quantidade || 0), 0);
    const diasRealizados = producoes.length;
    const restante = Math.max(meta.metaTotal - producaoAcumulada, 0);
    const percentual = meta.metaTotal > 0 ? (producaoAcumulada / meta.metaTotal) * 100 : 0;
    const diasRestantes = Math.max(meta.diasProdutivosRestantes, 0);
    const necessarioPorDia = diasRestantes > 0 ? restante / diasRestantes : (restante > 0 ? restante : 0);
    const mediaAtual = diasRealizados > 0 ? producaoAcumulada / diasRealizados : 0;
    const diferenca = mediaAtual - necessarioPorDia;
    const projecao = producaoAcumulada + mediaAtual * diasRestantes;
    const faltaProjecao = meta.metaTotal - projecao;
    const percentualDiasUsados = meta.diasProdutivosPlanejados > 0
      ? (diasRealizados / meta.diasProdutivosPlanejados) * 100 : 0;

    // esperado até agora, distribuído linearmente ao longo dos dias produtivos já realizados
    const esperadoAteAgora = meta.diasProdutivosPlanejados > 0
      ? (meta.metaTotal / meta.diasProdutivosPlanejados) * diasRealizados : 0;

    let status = "verde";
    if (producaoAcumulada >= esperadoAteAgora * 0.98 && restante <= 0.0001 * meta.metaTotal + Infinity) {
      status = "verde";
    }
    if (producaoAcumulada < esperadoAteAgora * 0.98) status = "amarelo";
    if (producaoAcumulada < esperadoAteAgora * 0.85 || (necessarioPorDia > mediaAtual * 1.25 && restante > 0)) status = "vermelho";
    if (restante <= 0) status = "verde";

    const planejadoPorDia = meta.diasProdutivosPlanejados > 0 ? meta.metaTotal / meta.diasProdutivosPlanejados : 0;

    return {
      producaoAcumulada, diasRealizados, restante, percentual, diasRestantes,
      necessarioPorDia, mediaAtual, diferenca, projecao, faltaProjecao,
      percentualDiasUsados, esperadoAteAgora, status, planejadoPorDia,
    };
  }, [meta, producoes]);
}

function buildAlerts(calc, meta) {
  const alerts = [];
  if (calc.restante <= 0) {
    alerts.push({ level: "verde", text: `Meta mensal atingida! Produção acumulada de ${fmt(calc.producaoAcumulada)} unidades.` });
  } else if (calc.diferenca >= 0) {
    alerts.push({ level: "verde", text: `Você está ${fmt(calc.diferenca)} unidades/dia acima do ritmo necessário para atingir a meta.` });
  } else {
    alerts.push({ level: calc.status === "vermelho" ? "vermelho" : "amarelo",
      text: `A produção está abaixo do planejado. Será necessário aumentar a média diária em ${fmt(Math.abs(calc.diferenca))} unidades/dia.` });
  }
  if (calc.status === "vermelho" && calc.restante > 0) {
    alerts.push({ level: "vermelho", text: `A produção atual indica risco de não atingir a meta de ${fmt(meta.metaTotal)} unidades.` });
  }
  if (calc.necessarioPorDia > calc.planejadoPorDia * 1.15 && calc.restante > 0) {
    alerts.push({ level: "amarelo", text: `A produção necessária por dia (${fmt(calc.necessarioPorDia)}) subiu significativamente acima do ritmo planejado original (${fmt(calc.planejadoPorDia)}).` });
  }
  return alerts;
}

/* ============================== APP ============================== */

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "meta", label: "Configuração da Meta", icon: Target },
  { id: "lancamento", label: "Lançamento de Produção", icon: ClipboardList },
  { id: "calendario", label: "Calendário", icon: CalendarRange },
  { id: "simulador", label: 'Simulador "E Se?"', icon: FlaskConical },
  { id: "historico", label: "Histórico", icon: History },
  { id: "perdas", label: "Perdas & Recuperação", icon: Snowflake },
  { id: "relatorios", label: "Relatórios", icon: FileBarChart2 },
  { id: "config", label: "Configurações", icon: Settings2 },
];

export default function App() {
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [meta, setMeta] = useState(DEMO_META);
  const [producoes, setProducoes] = useState(DEMO_PRODUCOES);
  const [historico, setHistorico] = useState(DEMO_HISTORICO);
  const [arquivo, setArquivo] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const t = theme(dark);
  const calc = useCalc(meta, producoes);
  const alerts = buildAlerts(calc, meta);

  /* persistence (Supabase — os mesmos dados aparecem em qualquer dispositivo) */
  useEffect(() => {
    (async () => {
      await migrarDoLocalStorageSeNecessario([
        "meta-atual",
        "producoes-atual",
        "historico-mensal",
        "producoes-arquivo",
        "preferencia-tema",
      ]);

      const m = await cloudGetItem("meta-atual");
      if (m) setMeta(m);

      const p = await cloudGetItem("producoes-atual");
      if (p) setProducoes(p);

      const h = await cloudGetItem("historico-mensal");
      if (h) setHistorico(h);

      const a = await cloudGetItem("producoes-arquivo");
      if (a) setArquivo(a);

      const d = await cloudGetItem("preferencia-tema");
      if (d !== null) setDark(d);

      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    cloudSetItem("meta-atual", meta);
  }, [meta, loaded]);

  useEffect(() => {
    if (!loaded) return;
    cloudSetItem("producoes-atual", producoes);
  }, [producoes, loaded]);

  useEffect(() => {
    if (!loaded) return;
    cloudSetItem("historico-mensal", historico);
  }, [historico, loaded]);

  useEffect(() => {
    if (!loaded) return;
    cloudSetItem("producoes-arquivo", arquivo);
  }, [arquivo, loaded]);

  useEffect(() => {
    if (!loaded) return;
    cloudSetItem("preferencia-tema", dark);
  }, [dark, loaded]);

  /* Ao trocar o mês/ano da meta, arquiva os lançamentos do mês anterior
     (em vez de descartar) e limpa a lista ativa para o novo mês. */
  const handleSetMeta = (newMeta) => {
    const mesMudou = Number(newMeta.mes) !== Number(meta.mes) || Number(newMeta.ano) !== Number(meta.ano);

    if (mesMudou) {
      const chaveAntiga = mesKey(meta.ano, meta.mes);
      const lancamentosAntigos = producoes.filter(
        (p) => typeof p.data === "string" && p.data.startsWith(chaveAntiga)
      );

      if (lancamentosAntigos.length > 0) {
        const produzido = lancamentosAntigos.reduce((s, p) => s + Number(p.quantidade || 0), 0);
        const diasProdutivos = lancamentosAntigos.length;
        const resumo = {
          mes: MESES[meta.mes - 1],
          mesNum: meta.mes,
          ano: meta.ano,
          meta: meta.metaTotal,
          produzido,
          diasProdutivos,
          status: produzido >= meta.metaTotal ? "Atingida" : "Não atingida",
        };

        setArquivo((a) => ({ ...a, [chaveAntiga]: lancamentosAntigos }));
        setHistorico((h) => {
          const semEsseMes = h.filter((x) => !(x.mesNum === meta.mes && x.ano === meta.ano));
          return [resumo, ...semEsseMes].sort((a, b) => (b.ano - a.ano) || (b.mesNum - a.mesNum));
        });
      }

      setProducoes((ps) => ps.filter((p) => !(typeof p.data === "string" && p.data.startsWith(chaveAntiga))));
    }

    setMeta(newMeta);
  };

  const resetDemo = () => {
    setMeta(DEMO_META);
    setProducoes(DEMO_PRODUCOES);
    setHistorico(DEMO_HISTORICO);
    setArquivo({});
  };

  return (
    <div className={`min-h-screen w-full ${t.bg} ${t.text} flex font-sans`}>
      {/* SIDEBAR */}
      <aside className={`hidden md:flex flex-col w-60 shrink-0 border-r ${t.sidebar} text-slate-100`}>
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Gauge size={20} className="text-amber-400" />
            <div>
              <div className="text-sm font-bold tracking-wide uppercase leading-none">Painel de Produção</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Controle de Meta Mensal</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = page === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left border-l-2 transition-colors ${
                  active
                    ? "border-amber-400 bg-slate-800/70 text-amber-300 font-semibold"
                    : "border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/40"
                }`}
              >
                <Icon size={16} />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-slate-800 text-[11px] text-slate-500">
          {MESES[meta.mes - 1]}/{meta.ano} · dados de demonstração
        </div>
      </aside>

      {/* MOBILE TOP BAR */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30">
        <div className={`flex items-center justify-between px-4 py-3 bg-slate-900 text-slate-100 border-b border-slate-800`}>
          <div className="flex items-center gap-2">
            <Gauge size={18} className="text-amber-400" />
            <span className="text-sm font-bold uppercase tracking-wide">Painel de Produção</span>
          </div>
          <button onClick={() => setNavOpen((v) => !v)} className="text-slate-300 text-xs uppercase tracking-wide border border-slate-700 rounded px-2 py-1">
            Menu
          </button>
        </div>
        {navOpen && (
          <div className="bg-slate-900 border-b border-slate-800">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = page === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => { setPage(n.id); setNavOpen(false); }}
                  className={`w-full flex items-center gap-3 px-5 py-3 text-sm text-left border-l-2 ${
                    active ? "border-amber-400 text-amber-300 bg-slate-800/70" : "border-transparent text-slate-400"
                  }`}
                >
                  <Icon size={16} />
                  {n.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* MAIN */}
      <main className="flex-1 min-w-0 pt-16 md:pt-0">
        <header className={`hidden md:flex items-center justify-between px-6 py-4 border-b ${t.border}`}>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{NAV.find((n) => n.id === page)?.label}</h1>
            <p className={`text-xs ${t.textMuted} mt-0.5`}>{MESES[meta.mes - 1]} de {meta.ano} · meta de produção mensal</p>
          </div>
          <button
            onClick={() => setDark((d) => !d)}
            className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide border ${t.border} rounded px-3 py-2`}
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
            {dark ? "Modo claro" : "Modo escuro"}
          </button>
        </header>

        <div className="p-4 md:p-6">
          {page === "dashboard" && <Dashboard t={t} meta={meta} calc={calc} alerts={alerts} producoes={producoes} />}
          {page === "meta" && <MetaConfig t={t} meta={meta} setMeta={handleSetMeta} calc={calc} />}
          {page === "lancamento" && <Lancamento t={t} producoes={producoes} setProducoes={setProducoes} meta={meta} calc={calc} />}
          {page === "calendario" && <Calendario t={t} meta={meta} producoes={producoes} calc={calc} />}
          {page === "simulador" && <Simulador t={t} meta={meta} calc={calc} />}
          {page === "historico" && <Historico t={t} historico={historico} arquivo={arquivo} />}
          {page === "perdas" && <PerdasRecuperacao t={t} producoes={producoes} meta={meta} />}
          {page === "relatorios" && <Relatorios t={t} meta={meta} producoes={producoes} calc={calc} />}
          {page === "config" && <ConfigPage t={t} dark={dark} setDark={setDark} resetDemo={resetDemo} />}
        </div>
      </main>
    </div>
  );
}

/* ============================== DASHBOARD ============================== */

function Dashboard({ t, meta, calc, alerts, producoes }) {
  const St = STATUS[calc.status];
  const StIcon = St.icon;

  const chartData = useMemo(() => {
    const sorted = [...producoes].sort((a, b) => a.data.localeCompare(b.data));
    let acumReal = 0, acumPlan = 0;
    return sorted.map((p, i) => {
      acumReal += Number(p.quantidade || 0);
      acumPlan += calc.planejadoPorDia;
      return {
        dia: fmtDate(p.data).slice(0, 5),
        Realizado: Math.round(acumReal),
        Planejado: Math.round(acumPlan),
        producaoDia: p.quantidade,
        percentual: meta.metaTotal > 0 ? +(acumReal / meta.metaTotal * 100).toFixed(1) : 0,
      };
    });
  }, [producoes, calc.planejadoPorDia, meta.metaTotal]);

  return (
    <div className="flex flex-col gap-5">
      {/* status banner */}
      <div className={`rounded border ${t.border} ${St.soft} px-4 py-3 flex items-center gap-3`}>
        <StIcon size={20} className={St.text} />
        <div>
          <div className={`text-sm font-bold ${St.text}`}>{St.label.toUpperCase()}</div>
          <div className={`text-xs ${t.textMuted}`}>
            {calc.restante <= 0
              ? "Meta mensal já atingida."
              : `Necessário produzir ${fmt(calc.necessarioPorDia)} un./dia · média atual de ${fmt(calc.mediaAtual)} un./dia`}
          </div>
        </div>
      </div>

      {/* the two key questions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`rounded border ${t.panel} p-4`}>
          <div className={`text-[11px] font-semibold uppercase tracking-widest ${t.textMuted} mb-2`}>
            Quanto preciso produzir por dia daqui pra frente?
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-amber-400">{fmt(calc.necessarioPorDia)}</span>
            <span className="text-xs text-slate-500 font-mono uppercase">un/dia · {calc.diasRestantes} dias restantes</span>
          </div>
        </div>
        <div className={`rounded border ${t.panel} p-4`}>
          <div className={`text-[11px] font-semibold uppercase tracking-widest ${t.textMuted} mb-2`}>
            No ritmo atual, vou atingir a meta?
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`font-mono text-3xl font-bold ${calc.faltaProjecao <= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {fmt(calc.projecao)}
            </span>
            <span className="text-xs text-slate-500 font-mono uppercase">projetado de {fmt(meta.metaTotal)}</span>
          </div>
        </div>
      </div>

      {/* cards 1-6 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className={`rounded border ${t.panel} p-4 col-span-2 lg:col-span-1 flex flex-col gap-3`}>
          <span className={`text-[11px] font-semibold uppercase tracking-widest ${t.textMuted}`}>Meta do mês</span>
          <div className={`${t.well} rounded px-3 py-2.5`}>
            <span className="font-mono text-2xl font-bold text-amber-400 tabular-nums">{fmt(meta.metaTotal)}</span>
          </div>
          <SegmentedBar pct={calc.percentual} colorClass={St.bg} />
          <span className={`text-xs ${t.textMuted}`}>{fmt(calc.producaoAcumulada)} / {fmt(meta.metaTotal)}</span>
        </div>

        <Kpi t={t} label="Produzido até agora" value={fmt(calc.producaoAcumulada)} unit="un" icon={PackageCheck}
          sub={`${fmt(calc.percentual, 1)}% da meta`} />

        <Kpi t={t} label="Falta produzir" value={calc.restante <= 0 ? "0" : fmt(calc.restante)} unit={calc.restante <= 0 ? "" : "un"}
          icon={Target} accent={calc.restante <= 0 ? "text-emerald-400" : "text-amber-400"}
          sub={calc.restante <= 0 ? "META ATINGIDA" : `de ${fmt(meta.metaTotal)} un.`} />

        <Kpi t={t} label="Dias produtivos restantes" value={fmt(calc.diasRestantes)} unit="dias" icon={CalendarDays}
          sub={`${fmt(calc.diasRealizados)} dias já realizados`} />

        <Kpi t={t} label="Necessário por dia" value={fmt(calc.necessarioPorDia)} unit="un/dia" icon={TrendingUp}
          sub="para bater a meta no prazo" />

        <Kpi t={t} label="Média atual" value={fmt(calc.mediaAtual)} unit="un/dia"
          icon={calc.diferenca >= 0 ? TrendingUp : TrendingDown}
          accent={calc.diferenca >= 0 ? "text-emerald-400" : "text-rose-400"}
          sub={`${calc.diferenca >= 0 ? "+" : ""}${fmt(calc.diferenca)} un/dia vs. necessário`} />
      </div>

      {/* projection */}
      <Panel t={t} title="Projeção de produção" icon={FlaskConical}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-3">
          {[
            ["Produção atual", fmt(calc.producaoAcumulada)],
            ["Média diária atual", fmt(calc.mediaAtual)],
            ["Dias restantes", fmt(calc.diasRestantes)],
            ["Projeção final", fmt(calc.projecao)],
            [calc.faltaProjecao <= 0 ? "Excedente projetado" : "Falta projetada", fmt(Math.abs(calc.faltaProjecao))],
          ].map(([l, v]) => (
            <div key={l}>
              <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>{l}</div>
              <div className="font-mono text-lg font-bold">{v}</div>
            </div>
          ))}
        </div>
        <div className={`text-sm font-semibold flex items-center gap-2 ${calc.faltaProjecao <= 0 ? "text-emerald-500" : "text-rose-500"}`}>
          {calc.faltaProjecao <= 0 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {calc.faltaProjecao <= 0
            ? `Meta provavelmente será atingida (excedente de ${fmt(Math.abs(calc.faltaProjecao))} un.)`
            : `Meta provavelmente não será atingida no ritmo atual (faltam ${fmt(calc.faltaProjecao)} un.)`}
        </div>
      </Panel>

      {/* alerts */}
      <Panel t={t} title="Alertas" icon={AlertTriangle}>
        <div className="flex flex-col gap-2">
          {alerts.map((a, i) => {
            const s = STATUS[a.level];
            const Icon = s.icon;
            return (
              <div key={i} className={`flex items-start gap-2 text-sm rounded px-3 py-2 ${s.soft}`}>
                <Icon size={15} className={`${s.text} mt-0.5 shrink-0`} />
                <span>{a.text}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* programado x realizado por dia */}
      <Panel t={t} title="Programado x realizado por dia" icon={ClipboardList}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-left border-b ${t.border} ${t.textMuted} text-[11px] uppercase tracking-wide`}>
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Programado</th>
                <th className="py-2 pr-3">Realizado</th>
                <th className="py-2 pr-3">Diferença</th>
                <th className="py-2 pr-3">%</th>
              </tr>
            </thead>
            <tbody>
              {[...producoes].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8).map((p) => {
                const planejado = Number(p.planejado || 0) || calc.planejadoPorDia;
                const diff = p.quantidade - planejado;
                const pct = planejado > 0 ? (p.quantidade / planejado) * 100 : 0;
                return (
                  <tr key={p.id} className={`border-b ${t.panelHead}`}>
                    <td className="py-2 pr-3 font-mono">{fmtDate(p.data)}</td>
                    <td className="py-2 pr-3 font-mono">{fmt(planejado)}</td>
                    <td className="py-2 pr-3 font-mono font-semibold text-amber-500">{fmt(p.quantidade)}</td>
                    <td className={`py-2 pr-3 font-mono font-semibold ${diff >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {diff >= 0 ? "+" : ""}{fmt(diff)}
                    </td>
                    <td className="py-2 pr-3 font-mono">{fmt(pct, 1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel t={t} title="Meta x produção acumulada" icon={FileBarChart2}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.textMuted.includes("slate-400") ? "#334155" : "#e7e5e4"} />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Planejado" stroke="#64748b" strokeDasharray="4 3" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="Realizado" stroke="#f59e0b" dot={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel t={t} title="Produção diária" icon={FileBarChart2}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.textMuted.includes("slate-400") ? "#334155" : "#e7e5e4"} />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <ReferenceLine y={calc.planejadoPorDia} stroke="#64748b" strokeDasharray="4 3" />
                <Bar dataKey="producaoDia" name="Produção" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel t={t} title="Evolução do percentual da meta" icon={FileBarChart2} className="xl:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.textMuted.includes("slate-400") ? "#334155" : "#e7e5e4"} />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="%" />
                <Tooltip />
                <ReferenceLine y={100} stroke="#10b981" strokeDasharray="4 3" />
                <Area type="monotone" dataKey="percentual" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.18} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============================== META CONFIG ============================== */

function MetaConfig({ t, meta, setMeta, calc }) {
  const [form, setForm] = useState(meta);
  const [saved, setSaved] = useState(false);

  useEffect(() => setForm(meta), [meta]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    setMeta({
      ...form,
      metaTotal: Number(form.metaTotal) || 0,
      diasProdutivosPlanejados: Number(form.diasProdutivosPlanejados) || 0,
      diasProdutivosRestantes: Number(form.diasProdutivosRestantes) || 0,
      mes: Number(form.mes), ano: Number(form.ano),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <Panel t={t} title="Configuração da meta mensal" icon={Target}>
        <div className="grid grid-cols-2 gap-4">
          <Field t={t} label="Mês">
            <select className={inputCls(t)} value={form.mes} onChange={(e) => upd("mes", e.target.value)}>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Field>
          <Field t={t} label="Ano">
            <input type="number" className={inputCls(t)} value={form.ano} onChange={(e) => upd("ano", e.target.value)} />
          </Field>
          <Field t={t} label="Meta total de produção">
            <input type="number" className={inputCls(t)} value={form.metaTotal} onChange={(e) => upd("metaTotal", e.target.value)} />
          </Field>
          <Field t={t} label="Dias produtivos planejados">
            <input type="number" className={inputCls(t)} value={form.diasProdutivosPlanejados} onChange={(e) => upd("diasProdutivosPlanejados", e.target.value)} />
          </Field>
          <Field t={t} label="Dias produtivos já realizados">
            <input type="number" className={inputCls(t)} value={calc.diasRealizados} disabled />
          </Field>
          <Field t={t} label="Dias produtivos restantes">
            <input type="number" className={inputCls(t)} value={form.diasProdutivosRestantes} onChange={(e) => upd("diasProdutivosRestantes", e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center gap-3 mt-5">
          <button onClick={save} className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold uppercase tracking-wide rounded px-4 py-2 transition-colors">
            Salvar meta
          </button>
          {saved && <span className="text-emerald-500 text-xs font-semibold flex items-center gap-1"><CheckCircle2 size={14} /> Meta salva</span>}
        </div>
        <p className={`text-xs ${t.textMuted} mt-3`}>
          "Dias produtivos já realizados" é calculado automaticamente com base nos lançamentos diários de produção.
        </p>
        <p className={`text-xs ${t.textMuted} mt-1`}>
          Ao trocar o mês ou o ano e salvar, os lançamentos do mês anterior são arquivados automaticamente (não são apagados) e ficam disponíveis para consulta na tela Histórico.
        </p>
      </Panel>
    </div>
  );
}

/* ============================== LANÇAMENTO DIÁRIO ============================== */

function Lancamento({ t, producoes, setProducoes, meta, calc }) {
  const [form, setForm] = useState({
    data: `${meta.ano}-${String(meta.mes).padStart(2, "0")}-01`,
    planejado: Math.round(calc.planejadoPorDia) || "",
    quantidade: "", turno: "1º", observacao: "",
  });

  const add = () => {
    if (!form.data || !form.quantidade) return;
    setProducoes((p) => [...p, { id: uid(), ...form, quantidade: Number(form.quantidade), planejado: Number(form.planejado) || 0 }]);
    setForm((f) => ({ ...f, quantidade: "", observacao: "" }));
  };

  const remove = (id) => setProducoes((p) => p.filter((x) => x.id !== id));

  const sorted = [...producoes].sort((a, b) => a.data.localeCompare(b.data));
  const total = sorted.reduce((s, p) => s + Number(p.quantidade || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <Panel t={t} title="Registrar produção do dia" icon={Plus}>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <Field t={t} label="Data">
            <input type="date" className={inputCls(t)} value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
          </Field>
          <Field t={t} label="Programado do dia">
            <input type="number" className={inputCls(t)} placeholder="0" value={form.planejado} onChange={(e) => setForm((f) => ({ ...f, planejado: e.target.value }))} />
          </Field>
          <Field t={t} label="Quantidade produzida">
            <input type="number" className={inputCls(t)} placeholder="0" value={form.quantidade} onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))} />
          </Field>
          <Field t={t} label="Turno">
            <select className={inputCls(t)} value={form.turno} onChange={(e) => setForm((f) => ({ ...f, turno: e.target.value }))}>
              <option>1º</option><option>2º</option><option>3º</option>
            </select>
          </Field>
          <Field t={t} label="Observação">
            <input className={inputCls(t)} placeholder="Opcional" value={form.observacao} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} />
          </Field>
          <button onClick={add} className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold uppercase tracking-wide rounded px-4 py-2.5 flex items-center justify-center gap-1.5">
            <Plus size={15} /> Lançar
          </button>
        </div>
      </Panel>

      <Panel t={t} title={`Produção lançada (${sorted.length} dias · total ${fmt(total)} un.)`} icon={ClipboardList}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-left border-b ${t.border} ${t.textMuted} text-[11px] uppercase tracking-wide`}>
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Programado</th>
                <th className="py-2 pr-3">Realizado</th>
                <th className="py-2 pr-3">%</th>
                <th className="py-2 pr-3">Turno</th>
                <th className="py-2 pr-3">Observação</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const planejado = Number(p.planejado || 0);
                const pct = planejado > 0 ? (p.quantidade / planejado) * 100 : null;
                return (
                  <tr key={p.id} className={`border-b ${t.panelHead}`}>
                    <td className="py-2 pr-3 font-mono">{fmtDate(p.data)}</td>
                    <td className="py-2 pr-3 font-mono">{planejado > 0 ? fmt(planejado) : "—"}</td>
                    <td className="py-2 pr-3 font-mono font-semibold text-amber-500">{fmt(p.quantidade)}</td>
                    <td className={`py-2 pr-3 font-mono font-semibold ${pct === null ? t.textMuted : pct >= 100 ? "text-emerald-500" : "text-rose-500"}`}>
                      {pct === null ? "—" : `${fmt(pct, 1)}%`}
                    </td>
                    <td className="py-2 pr-3">{p.turno}</td>
                    <td className={`py-2 pr-3 ${t.textMuted}`}>{p.observacao || "—"}</td>
                    <td className="py-2 pr-3 text-right">
                      <button onClick={() => remove(p.id)} className="text-rose-500 hover:text-rose-400">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr><td colSpan={7} className={`py-6 text-center ${t.textMuted}`}>Nenhum lançamento ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ============================== CALENDÁRIO ============================== */

function Calendario({ t, meta, producoes, calc }) {
  const total = daysInMonth(meta.mes, meta.ano);
  const byDate = useMemo(() => {
    const m = {};
    producoes.forEach((p) => {
      if (!m[p.data]) m[p.data] = { real: 0, planejado: 0 };
      m[p.data].real += Number(p.quantidade || 0);
      m[p.data].planejado += Number(p.planejado || 0);
    });
    return m;
  }, [producoes]);

  const firstWeekday = new Date(meta.ano, meta.mes - 1, 1).getDay();
  const cells = Array.from({ length: firstWeekday }).map(() => null)
    .concat(Array.from({ length: total }, (_, i) => i + 1));

  return (
    <Panel t={t} title={`Calendário de produção — ${MESES[meta.mes - 1]} ${meta.ano}`} icon={CalendarRange}>
      <div className="grid grid-cols-7 gap-1.5 text-center mb-1.5">
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
          <div key={d} className={`text-[10px] font-bold uppercase tracking-wide ${t.textMuted}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const iso = `${meta.ano}-${String(meta.mes).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayData = byDate[iso];
          const real = dayData ? dayData.real : undefined;
          const planejado = dayData && dayData.planejado > 0 ? dayData.planejado : calc.planejadoPorDia;
          const diff = real !== undefined ? real - planejado : null;
          const status = real === undefined ? null : diff >= 0 ? "verde" : diff >= -planejado * 0.15 ? "amarelo" : "vermelho";
          const s = status ? STATUS[status] : null;
          return (
            <div key={i} className={`rounded border ${t.border} p-1.5 min-h-[72px] flex flex-col justify-between ${real !== undefined ? "" : "opacity-50"}`}>
              <div className="text-[11px] font-mono font-semibold">{day}</div>
              {real !== undefined ? (
                <div className="flex flex-col gap-0.5">
                  <div className="text-[10px] font-mono">{fmt(real)}</div>
                  <div className={`text-[10px] font-mono font-semibold ${s.text}`}>{diff >= 0 ? "+" : ""}{fmt(diff)}</div>
                </div>
              ) : (
                <div className={`text-[10px] font-mono ${t.textMuted}`}>plan. {fmt(planejado)}</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 mt-4 text-xs">
        {Object.entries(STATUS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${v.bg}`} />
            <span className={t.textMuted}>{v.label}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ============================== SIMULADOR ============================== */

function Simulador({ t, meta, calc }) {
  const [qtdDia, setQtdDia] = useState(Math.round(calc.necessarioPorDia));
  const [dias, setDias] = useState(calc.diasRestantes);

  const adicional = qtdDia * dias;
  const totalProjetado = calc.producaoAcumulada + adicional;
  const diff = totalProjetado - meta.metaTotal;
  const atingida = diff >= 0;

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <Panel t={t} title='Simulador "E se?"' icon={FlaskConical}
        right={<span className={`text-[10px] ${t.textMuted} uppercase tracking-wide`}>Não altera dados reais</span>}>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <Field t={t} label="Se eu produzir (un/dia)">
            <input type="number" className={inputCls(t)} value={qtdDia} onChange={(e) => setQtdDia(Number(e.target.value) || 0)} />
          </Field>
          <Field t={t} label="Nos próximos (dias)">
            <input type="number" className={inputCls(t)} value={dias} onChange={(e) => setDias(Number(e.target.value) || 0)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            ["Produção atual", fmt(calc.producaoAcumulada)],
            ["Produção adicional", fmt(adicional)],
            ["Total projetado", fmt(totalProjetado)],
            ["Meta", fmt(meta.metaTotal)],
          ].map(([l, v]) => (
            <div key={l}>
              <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>{l}</div>
              <div className="font-mono text-lg font-bold">{v}</div>
            </div>
          ))}
        </div>

        <div className={`rounded px-4 py-3 flex items-center gap-2 text-sm font-semibold ${atingida ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
          {atingida ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {atingida
            ? `Meta ultrapassada em ${fmt(Math.abs(diff))} unidades`
            : `Meta não atingida — faltariam ${fmt(Math.abs(diff))} unidades`}
        </div>
      </Panel>
    </div>
  );
}

/* ============================== HISTÓRICO ============================== */

function Historico({ t, historico, arquivo = {} }) {
  const [expandido, setExpandido] = useState(null); // "AAAA-MM" ou null

  const toggle = (h) => {
    const key = mesKey(h.ano, h.mesNum || 1);
    setExpandido((cur) => (cur === key ? null : key));
  };

  const lancamentosExpandido = expandido && arquivo[expandido]
    ? [...arquivo[expandido]].sort((a, b) => a.data.localeCompare(b.data))
    : [];

  return (
    <div className="flex flex-col gap-4">
      <Panel t={t} title="Histórico mensal" icon={History}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-left border-b ${t.border} ${t.textMuted} text-[11px] uppercase tracking-wide`}>
                <th className="py-2 pr-3">Mês</th>
                <th className="py-2 pr-3">Meta</th>
                <th className="py-2 pr-3">Produzido</th>
                <th className="py-2 pr-3">Atingimento</th>
                <th className="py-2 pr-3">Média diária</th>
                <th className="py-2 pr-3">Dias produtivos</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {historico.map((h) => {
                const pct = h.meta > 0 ? (h.produzido / h.meta) * 100 : 0;
                const ok = h.status === "Atingida";
                const key = mesKey(h.ano, h.mesNum || 1);
                const temArquivo = !!arquivo[key] && arquivo[key].length > 0;
                return (
                  <tr
                    key={key}
                    onClick={() => temArquivo && toggle(h)}
                    className={`border-b ${t.panelHead} ${temArquivo ? "cursor-pointer hover:bg-amber-500/5" : ""}`}
                  >
                    <td className="py-2 pr-3 font-semibold">{h.mes}/{h.ano}</td>
                    <td className="py-2 pr-3 font-mono">{fmt(h.meta)}</td>
                    <td className="py-2 pr-3 font-mono">{fmt(h.produzido)}</td>
                    <td className="py-2 pr-3 font-mono">{fmt(pct, 1)}%</td>
                    <td className="py-2 pr-3 font-mono">{fmt(h.diasProdutivos > 0 ? h.produzido / h.diasProdutivos : 0, 0)}</td>
                    <td className="py-2 pr-3 font-mono">{h.diasProdutivos}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${ok ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {temArquivo ? (
                        <ChevronRight
                          size={14}
                          className={`${t.textMuted} transition-transform ${expandido === key ? "rotate-90" : ""}`}
                        />
                      ) : (
                        <span className={`text-[10px] ${t.textMuted}`}>sem lançamentos</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {historico.length === 0 && (
          <div className={`text-sm ${t.textMuted} text-center py-4`}>Nenhum mês arquivado ainda.</div>
        )}
        <p className={`text-xs ${t.textMuted} mt-3`}>
          Clique em um mês com lançamentos arquivados para ver o detalhe dia a dia.
        </p>
      </Panel>

      {expandido && lancamentosExpandido.length > 0 && (
        <Panel
          t={t}
          title={`Lançamentos arquivados — ${MESES[Number(expandido.split("-")[1]) - 1]}/${expandido.split("-")[0]}`}
          icon={ClipboardList}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-left border-b ${t.border} ${t.textMuted} text-[11px] uppercase tracking-wide`}>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Turno</th>
                  <th className="py-2 pr-3">Planejado</th>
                  <th className="py-2 pr-3">Produzido</th>
                  <th className="py-2 pr-3">Observação</th>
                </tr>
              </thead>
              <tbody>
                {lancamentosExpandido.map((p) => (
                  <tr key={p.id} className={`border-b ${t.panelHead}`}>
                    <td className="py-2 pr-3 font-mono">{fmtDate(p.data)}</td>
                    <td className="py-2 pr-3">{p.turno}</td>
                    <td className="py-2 pr-3 font-mono">{fmt(p.planejado)}</td>
                    <td className="py-2 pr-3 font-mono">{fmt(p.quantidade)}</td>
                    <td className="py-2 pr-3">{p.observacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ============================== RELATÓRIOS ============================== */

function Relatorios({ t, meta, producoes, calc }) {
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const resumo = [
      ["Relatório de produção", `${MESES[meta.mes - 1]}/${meta.ano}`],
      [],
      ["Meta total", meta.metaTotal],
      ["Produção acumulada", calc.producaoAcumulada],
      ["Falta produzir", calc.restante],
      ["Percentual atingido (%)", +calc.percentual.toFixed(2)],
      ["Dias produtivos restantes", calc.diasRestantes],
      ["Necessário por dia", +calc.necessarioPorDia.toFixed(2)],
      ["Média diária realizada", +calc.mediaAtual.toFixed(2)],
      ["Projeção final", +calc.projecao.toFixed(2)],
      ["Diferença para a meta (projeção)", +calc.faltaProjecao.toFixed(2)],
      ["Status", STATUS[calc.status].label],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    const lanc = [["Data", "Quantidade", "Turno", "Observação"],
      ...[...producoes].sort((a, b) => a.data.localeCompare(b.data)).map((p) => [fmtDate(p.data), p.quantidade, p.turno, p.observacao])];
    const wsLanc = XLSX.utils.aoa_to_sheet(lanc);
    XLSX.utils.book_append_sheet(wb, wsLanc, "Lançamentos");

    XLSX.writeFile(wb, `relatorio-producao-${MESES[meta.mes - 1]}-${meta.ano}.xlsx`);
  };

  const exportPdf = () => window.print();

  return (
    <div className="flex flex-col gap-4">
      <Panel t={t} title="Relatório mensal" icon={FileBarChart2}
        right={
          <div className="flex gap-2 print:hidden">
            <button onClick={exportExcel} className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide border ${t.border} rounded px-3 py-1.5`}>
              <Download size={13} /> Excel
            </button>
            <button onClick={exportPdf} className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide border ${t.border} rounded px-3 py-1.5`}>
              <Download size={13} /> PDF (imprimir)
            </button>
          </div>
        }>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["Meta", fmt(meta.metaTotal)],
            ["Produção acumulada", fmt(calc.producaoAcumulada)],
            ["Média diária", fmt(calc.mediaAtual)],
            ["Dias produtivos", fmt(calc.diasRealizados)],
            ["Produção necessária/dia", fmt(calc.necessarioPorDia)],
            ["Projeção final", fmt(calc.projecao)],
            ["Resultado projetado", calc.faltaProjecao <= 0 ? "Meta atingida" : `Falta ${fmt(calc.faltaProjecao)}`],
            ["Status", STATUS[calc.status].label],
          ].map(([l, v]) => (
            <div key={l}>
              <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>{l}</div>
              <div className="font-mono text-base font-bold">{v}</div>
            </div>
          ))}
        </div>
      </Panel>
      <p className={`text-xs ${t.textMuted}`}>
        A exportação em PDF usa a impressão do navegador — escolha "Salvar como PDF" na caixa de diálogo de impressão.
      </p>
    </div>
  );
}

/* ============================== PERDAS & RECUPERAÇÃO (DEGELO) ============================== */

const DEFAULT_PERDAS = {
  pacotesPorHora: 660,
  massasPorHora: 11,
  metaT1: 77,
  metaT2: 77,
  metaT3: 65,
  horasPorDegelo: 4,
  degelosPorSemana: 3,
  degelosExatos: "",
  outrasPerdasHorasDia: 0,
  outrasPerdasTotalMassas: "",
  incluirPerdaReal: true,
  diasPeriodo: 26,
  massasPorRefeicao: 12,
  refeicoesPorDia: 1,
  refeicoesPorTurnoDia: 1,
};

function turnoLabel(turnos) {
  const nums = [...turnos].sort((a, b) => a - b).map((n) => `${n}º`);
  if (nums.length === 0) return "nenhum turno";
  if (nums.length === 1) return `${nums[0]} turno`;
  return `${nums.slice(0, -1).join(", ")} e ${nums[nums.length - 1]} turno`;
}

const TURNO_COMBOS = [
  { turnos: [1], label: "1º turno" },
  { turnos: [2], label: "2º turno" },
  { turnos: [3], label: "3º turno" },
  { turnos: [1, 2], label: "1º + 2º turno" },
  { turnos: [1, 3], label: "1º + 3º turno" },
  { turnos: [2, 3], label: "2º + 3º turno" },
  { turnos: [1, 2, 3], label: "1º + 2º + 3º turno" },
];

function PerdasRecuperacao({ t, producoes = [], meta }) {
  const [cfg, setCfg] = useState(DEFAULT_PERDAS);
  const [blocos, setBlocos] = useState([{ id: uid(), turnos: [3], dias: 10 }]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      await migrarDoLocalStorageSeNecessario(["perdas-config", "perdas-blocos"]);

      const s = await cloudGetItem("perdas-config");
      if (s) setCfg((c) => ({ ...c, ...s }));

      const b = await cloudGetItem("perdas-blocos");
      if (b) setBlocos(b);

      setLoaded(true);
    })();
  }, []);
  useEffect(() => {
    if (!loaded) return;
    cloudSetItem("perdas-config", cfg);
  }, [cfg, loaded]);
  useEffect(() => {
    if (!loaded) return;
    cloudSetItem("perdas-blocos", blocos);
  }, [blocos, loaded]);

  const toggleTurno = (blockId, turno) => {
    setBlocos((bs) => bs.map((b) => b.id === blockId
      ? { ...b, turnos: b.turnos.includes(turno) ? b.turnos.filter((x) => x !== turno) : [...b.turnos, turno].sort((a, b2) => a - b2) }
      : b));
  };
  const updateDias = (blockId, dias) => setBlocos((bs) => bs.map((b) => (b.id === blockId ? { ...b, dias: dias === "" ? "" : Number(dias) } : b)));
  const addBloco = () => setBlocos((bs) => [...bs, { id: uid(), turnos: [1], dias: 5 }]);
  const removeBloco = (id) => setBlocos((bs) => bs.filter((b) => b.id !== id));

  const upd = (k, v) => setCfg((c) => ({ ...c, [k]: v === "" ? "" : Number(v) }));
  const toggleIncluirPerdaReal = () => setCfg((c) => ({ ...c, incluirPerdaReal: !c.incluirPerdaReal }));

  const producaoStats = useMemo(() => {
    const prefixoMes = meta ? `${meta.ano}-${String(meta.mes).padStart(2, "0")}` : null;
    const producoesDoMes = prefixoMes
      ? producoes.filter((p) => typeof p.data === "string" && p.data.startsWith(prefixoMes))
      : producoes;

    const diasComDeficit = producoesDoMes.filter(
      (p) => Number(p.quantidade || 0) < Number(p.planejado || 0)
    );
    const diasComSuperavit = producoesDoMes.filter(
      (p) => Number(p.quantidade || 0) > Number(p.planejado || 0)
    );

    const deficitBrutoPacotes = diasComDeficit.reduce(
      (s, p) => s + (Number(p.planejado || 0) - Number(p.quantidade || 0)),
      0
    );
    const superavitPacotes = diasComSuperavit.reduce(
      (s, p) => s + (Number(p.quantidade || 0) - Number(p.planejado || 0)),
      0
    );

    // Saldo líquido: dias que produziram a mais abatem o déficit dos dias que produziram a menos.
    const perdaProducaoRealPacotes = Math.max(0, deficitBrutoPacotes - superavitPacotes);

    return {
      diasComDeficit,
      diasComSuperavit,
      deficitBrutoPacotes,
      superavitPacotes,
      perdaProducaoRealPacotes,
      numDiasComDeficit: diasComDeficit.length,
      numDiasComSuperavit: diasComSuperavit.length,
      totalLancamentosMes: producoesDoMes.length,
    };
  }, [producoes, meta]);

  const c = useMemo(() => {
    const pacotesPorMassa = cfg.massasPorHora > 0 ? cfg.pacotesPorHora / cfg.massasPorHora : 0;

    const metaMassasDia = Number(cfg.metaT1 || 0) + Number(cfg.metaT2 || 0) + Number(cfg.metaT3 || 0);
    const metaPacotesDia = metaMassasDia * pacotesPorMassa;

    const perdaMassasPorDegelo = Number(cfg.horasPorDegelo || 0) * Number(cfg.massasPorHora || 0);
    const perdaPacotesPorDegelo = perdaMassasPorDegelo * pacotesPorMassa;

    const semanasPeriodo = Number(cfg.diasPeriodo || 0) / 7;
    const numDegelosMedia = Number(cfg.degelosPorSemana || 0) * semanasPeriodo;
    const usarDegelosExato = cfg.degelosExatos !== "" && cfg.degelosExatos !== null && cfg.degelosExatos !== undefined;
    const numDegelosPeriodo = usarDegelosExato ? Number(cfg.degelosExatos || 0) : numDegelosMedia;
    const perdaMassasDegelosPeriodo = perdaMassasPorDegelo * numDegelosPeriodo;

    const perdaMassasOutrasDia = Number(cfg.outrasPerdasHorasDia || 0) * Number(cfg.massasPorHora || 0);
    const usarOutrasExato = cfg.outrasPerdasTotalMassas !== "" && cfg.outrasPerdasTotalMassas !== null && cfg.outrasPerdasTotalMassas !== undefined;
    const perdaMassasOutrasPeriodo = usarOutrasExato
      ? Number(cfg.outrasPerdasTotalMassas || 0)
      : perdaMassasOutrasDia * Number(cfg.diasPeriodo || 0);

    // Déficit dos lançamentos diários é registrado em PACOTES; converte para massas
    // usando a mesma proporção pacotesPorMassa antes de somar às demais perdas.
    const perdaProducaoRealPacotes = cfg.incluirPerdaReal ? producaoStats.perdaProducaoRealPacotes : 0;
    const perdaProducaoRealMassas = pacotesPorMassa > 0 ? perdaProducaoRealPacotes / pacotesPorMassa : 0;

    const perdaTotalMassasPeriodo = perdaMassasDegelosPeriodo + perdaMassasOutrasPeriodo + perdaProducaoRealMassas;
    const perdaTotalPacotesPeriodo = perdaTotalMassasPeriodo * pacotesPorMassa;

    const refeicoesNecessarias = cfg.massasPorRefeicao > 0 ? perdaTotalMassasPeriodo / cfg.massasPorRefeicao : 0;
    const diasNecessarios = cfg.refeicoesPorDia > 0 ? refeicoesNecessarias / cfg.refeicoesPorDia : Infinity;

    return {
      pacotesPorMassa, metaMassasDia, metaPacotesDia,
      perdaMassasPorDegelo, perdaPacotesPorDegelo, semanasPeriodo, numDegelosMedia, usarDegelosExato, numDegelosPeriodo, perdaMassasDegelosPeriodo,
      perdaMassasOutrasDia, perdaMassasOutrasPeriodo, usarOutrasExato,
      perdaProducaoRealPacotes, perdaProducaoRealMassas,
      perdaTotalMassasPeriodo, perdaTotalPacotesPeriodo,
      refeicoesNecessarias, diasNecessarios,
    };
  }, [cfg, producaoStats]);

  const cabe = Number.isFinite(c.diasNecessarios) && c.diasNecessarios <= Number(cfg.diasPeriodo || 0);

  const ganhoPorTurnoDia = (turnos) => turnos.length * Number(cfg.refeicoesPorTurnoDia || 0) * Number(cfg.massasPorRefeicao || 0);

  const blocosComputados = blocos.map((b) => {
    const ganhoDia = ganhoPorTurnoDia(b.turnos);
    return { ...b, ganhoDia, recuperado: ganhoDia * Number(b.dias || 0) };
  });
  const totalRecuperadoPlano = blocosComputados.reduce((s, b) => s + b.recuperado, 0);
  const totalDiasPlano = blocosComputados.reduce((s, b) => s + Number(b.dias || 0), 0);
  const diferencaPlano = totalRecuperadoPlano - c.perdaTotalMassasPeriodo;
  const planoCobreTudo = diferencaPlano >= 0;
  const resumoPlano = blocosComputados
    .filter((b) => Number(b.dias) > 0 && b.turnos.length > 0)
    .map((b) => `${fmt(b.dias)} dias com ${turnoLabel(b.turnos)}`)
    .join(" + ");

  return (
    <div className="flex flex-col gap-4">
      <Panel t={t} title="Conversão e metas por turno" icon={Snowflake}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field t={t} label="Pacotes / hora (média)">
            <input type="number" className={inputCls(t)} value={cfg.pacotesPorHora} onChange={(e) => upd("pacotesPorHora", e.target.value)} />
          </Field>
          <Field t={t} label="Massas equivalentes / hora">
            <input type="number" className={inputCls(t)} value={cfg.massasPorHora} onChange={(e) => upd("massasPorHora", e.target.value)} />
          </Field>
          <Field t={t} label="Meta 1º turno (massas)">
            <input type="number" className={inputCls(t)} value={cfg.metaT1} onChange={(e) => upd("metaT1", e.target.value)} />
          </Field>
          <Field t={t} label="Meta 2º turno (massas)">
            <input type="number" className={inputCls(t)} value={cfg.metaT2} onChange={(e) => upd("metaT2", e.target.value)} />
          </Field>
          <Field t={t} label="Meta 3º turno (massas)">
            <input type="number" className={inputCls(t)} value={cfg.metaT3} onChange={(e) => upd("metaT3", e.target.value)} />
          </Field>
          <Field t={t} label="Dias no período analisado">
            <input type="number" className={inputCls(t)} value={cfg.diasPeriodo} onChange={(e) => upd("diasPeriodo", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-5 pt-4 border-t border-dashed border-slate-700/40">
          <div>
            <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>1 massa equivale a</div>
            <div className="font-mono text-lg font-bold text-amber-400">{fmt(c.pacotesPorMassa)} pacotes</div>
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>Meta diária (3 turnos)</div>
            <div className="font-mono text-lg font-bold">{fmt(c.metaMassasDia)} massas</div>
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>Meta diária em pacotes</div>
            <div className="font-mono text-lg font-bold">{fmt(c.metaPacotesDia)} pacotes</div>
          </div>
        </div>
      </Panel>

      <Panel t={t} title="Perdas de produção" icon={Wrench}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field t={t} label="Perda por degelo (horas)">
            <input type="number" step="0.5" className={inputCls(t)} value={cfg.horasPorDegelo} onChange={(e) => upd("horasPorDegelo", e.target.value)} />
          </Field>
          <Field t={t} label="Degelos por semana (média)">
            <input type="number" step="1" className={inputCls(t)} value={cfg.degelosPorSemana} onChange={(e) => upd("degelosPorSemana", e.target.value)} />
          </Field>
          <Field t={t} label="Nº exato de degelos restantes (opcional)">
            <input
              type="number"
              step="1"
              placeholder="usa a média se vazio"
              className={inputCls(t)}
              value={cfg.degelosExatos}
              onChange={(e) => upd("degelosExatos", e.target.value)}
            />
          </Field>
          <Field t={t} label="Outras perdas (horas/dia)">
            <input type="number" step="0.5" className={inputCls(t)} value={cfg.outrasPerdasHorasDia} onChange={(e) => upd("outrasPerdasHorasDia", e.target.value)} />
          </Field>
          <Field t={t} label="Outras perdas — total no período (massas, opcional)">
            <input
              type="number"
              step="1"
              placeholder="usa horas/dia × dias se vazio"
              className={inputCls(t)}
              value={cfg.outrasPerdasTotalMassas}
              onChange={(e) => upd("outrasPerdasTotalMassas", e.target.value)}
            />
          </Field>
        </div>
        <p className={`text-xs ${t.textMuted} mt-2`}>
          Degelo é contado por semana (não por dias corridos), já que a linha fica parada de sábado 22h a domingo 22h e nesse intervalo não há degelo. Por padrão, o período é convertido em semanas (dias ÷ 7) para projetar o total de degelos. Se o PCP já sabe o número exato de degelos que restam no período, informe no campo "Nº exato de degelos restantes" — ele substitui a projeção pela média.
        </p>
        <p className={`text-xs ${t.textMuted} mt-1`}>
          "Outras perdas (horas/dia)" cobre quebras de máquina, falta de matéria-prima ou qualquer parada recorrente — é uma taxa diária, multiplicada pelos dias do período. Se você já tem o total de massas perdidas por outras paradas (ex.: apurado pelo PCP), digite direto em "Outras perdas — total no período", que substitui o cálculo pela taxa diária.
        </p>

        <div className={`mt-5 pt-4 border-t ${t.border} flex items-start justify-between gap-4`}>
          <div>
            <div className="text-sm font-semibold">Incluir perda real da produção diária</div>
            <div className={`text-xs ${t.textMuted} max-w-md`}>
              Calcula o saldo líquido dos dias lançados{meta ? ` em ${MESES[meta.mes - 1]} de ${meta.ano}` : ""}: soma o déficit dos dias abaixo do planejado e abate o superávit dos dias que produziram a mais (em pacotes), converte pra massas e adiciona ao total a recuperar junto com o degelo. Lançamentos de outros meses não entram nessa conta.
            </div>
          </div>
          <button
            onClick={toggleIncluirPerdaReal}
            className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide rounded px-3 py-1.5 border ${
              cfg.incluirPerdaReal ? "bg-amber-500 border-amber-500 text-slate-950" : `${t.border} ${t.textMuted}`
            }`}
          >
            {cfg.incluirPerdaReal ? <CheckCircle2 size={13} /> : null} {cfg.incluirPerdaReal ? "Incluída" : "Excluída"}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-dashed border-slate-700/40">
          <div>
            <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>Perda por degelo</div>
            <div className="font-mono text-lg font-bold text-rose-400">{fmt(c.perdaMassasPorDegelo)} massas</div>
            <div className={`text-xs ${t.textMuted}`}>{fmt(c.perdaPacotesPorDegelo)} pacotes</div>
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>Nº de degelos no período</div>
            <div className="font-mono text-lg font-bold">{fmt(c.numDegelosPeriodo, c.usarDegelosExato ? 0 : 1)}</div>
            <div className={`text-xs ${t.textMuted}`}>
              {c.usarDegelosExato
                ? "valor exato informado manualmente"
                : `${fmt(c.semanasPeriodo, 2)} semanas × ${fmt(cfg.degelosPorSemana)} degelos/semana (média)`}
            </div>
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>Perda total (degelos) no período</div>
            <div className="font-mono text-lg font-bold text-rose-400">{fmt(c.perdaMassasDegelosPeriodo)} massas</div>
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>Perda total (outras) no período</div>
            <div className="font-mono text-lg font-bold text-rose-400">{fmt(c.perdaMassasOutrasPeriodo)} massas</div>
            <div className={`text-xs ${t.textMuted}`}>
              {c.usarOutrasExato
                ? "valor exato informado manualmente"
                : `${fmt(cfg.outrasPerdasHorasDia)} h/dia × ${fmt(cfg.diasPeriodo)} dias`}
            </div>
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>Perda real de produção (líquida)</div>
            <div className={`font-mono text-lg font-bold ${cfg.incluirPerdaReal ? "text-rose-400" : t.textMuted}`}>
              {fmt(c.perdaProducaoRealMassas)} massas
            </div>
            <div className={`text-xs ${t.textMuted}`}>
              {fmt(producaoStats.perdaProducaoRealPacotes)} pacotes líquidos{meta ? ` em ${MESES[meta.mes - 1]}/${meta.ano}` : ""}{!cfg.incluirPerdaReal ? " · não incluída no total" : ""}
            </div>
            <div className={`text-xs ${t.textMuted} mt-0.5`}>
              déficit bruto {fmt(producaoStats.deficitBrutoPacotes)} pac. ({producaoStats.numDiasComDeficit} dia{producaoStats.numDiasComDeficit === 1 ? "" : "s"}) − superávit {fmt(producaoStats.superavitPacotes)} pac. ({producaoStats.numDiasComSuperavit} dia{producaoStats.numDiasComSuperavit === 1 ? "" : "s"})
            </div>
          </div>
        </div>

        <div className="mt-4 rounded bg-rose-500/10 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-rose-500">Perda total projetada no período</span>
          <span className="font-mono font-bold text-rose-500">
            {fmt(c.perdaTotalMassasPeriodo)} massas · {fmt(c.perdaTotalPacotesPeriodo)} pacotes
          </span>
        </div>
      </Panel>

      <Panel t={t} title="Simulador de recuperação (refeições extras)" icon={FlaskConical}
        right={<span className={`text-[10px] ${t.textMuted} uppercase tracking-wide`}>1 refeição = massas ganhas</span>}>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <Field t={t} label="Massas ganhas por refeição extra">
            <input type="number" className={inputCls(t)} value={cfg.massasPorRefeicao} onChange={(e) => upd("massasPorRefeicao", e.target.value)} />
          </Field>
          <Field t={t} label="Refeições extras possíveis por dia">
            <input type="number" step="0.5" className={inputCls(t)} value={cfg.refeicoesPorDia} onChange={(e) => upd("refeicoesPorDia", e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div>
            <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>Perda a recuperar</div>
            <div className="font-mono text-lg font-bold">{fmt(c.perdaTotalMassasPeriodo)} massas</div>
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>Refeições extras necessárias</div>
            <div className="font-mono text-lg font-bold text-amber-400">{fmt(Math.ceil(c.refeicoesNecessarias))}</div>
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>Dias rodando refeições extras</div>
            <div className="font-mono text-lg font-bold text-amber-400">
              {Number.isFinite(c.diasNecessarios) ? fmt(c.diasNecessarios, 1) : "—"}
            </div>
          </div>
        </div>

        <div className={`rounded px-4 py-3 flex items-center gap-2 text-sm font-semibold ${cabe ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
          {cabe ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {cfg.refeicoesPorDia > 0
            ? cabe
              ? `Rodando ${fmt(cfg.refeicoesPorDia)} refeição(ões) extra por dia, a perda é recuperada em ${fmt(c.diasNecessarios, 1)} dias — cabe dentro do período de ${fmt(cfg.diasPeriodo)} dias.`
              : `Rodando ${fmt(cfg.refeicoesPorDia)} refeição(ões) extra por dia, seriam necessários ${fmt(c.diasNecessarios, 1)} dias — não cabe dentro do período de ${fmt(cfg.diasPeriodo)} dias. Aumente as refeições/dia ou reduza as perdas.`
            : "Informe quantas refeições extras por dia são possíveis para calcular o prazo de recuperação."}
        </div>
      </Panel>

      <Panel t={t} title="Cenários rápidos por combinação de turno" icon={CalendarRange}>
        <Field t={t} label="Refeições extras possíveis por turno / dia">
          <input type="number" step="0.5" className={`${inputCls(t)} max-w-[160px]`} value={cfg.refeicoesPorTurnoDia} onChange={(e) => upd("refeicoesPorTurnoDia", e.target.value)} />
        </Field>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-left border-b ${t.border} ${t.textMuted} text-[11px] uppercase tracking-wide`}>
                <th className="py-2 pr-3">Combinação de turno</th>
                <th className="py-2 pr-3">Ganho/dia</th>
                <th className="py-2 pr-3">Dias necessários</th>
              </tr>
            </thead>
            <tbody>
              {TURNO_COMBOS.map((combo) => {
                const ganhoDia = ganhoPorTurnoDia(combo.turnos);
                const dias = ganhoDia > 0 ? c.perdaTotalMassasPeriodo / ganhoDia : Infinity;
                return (
                  <tr key={combo.label} className={`border-b ${t.panelHead}`}>
                    <td className="py-2 pr-3 font-semibold">{combo.label}</td>
                    <td className="py-2 pr-3 font-mono">{fmt(ganhoDia)} massas</td>
                    <td className="py-2 pr-3 font-mono font-semibold text-amber-400">
                      {Number.isFinite(dias) ? `${fmt(dias, 1)} dias` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel t={t} title="Plano de recuperação (misturando turnos)" icon={ClipboardList}
        right={
          <button onClick={addBloco} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide bg-amber-500 hover:bg-amber-400 text-slate-950 rounded px-3 py-1.5">
            <Plus size={13} /> Adicionar bloco
          </button>
        }>
        <div className="flex flex-col gap-3">
          {blocosComputados.map((b) => (
            <div key={b.id} className={`rounded border ${t.border} p-3 flex flex-wrap items-center gap-3`}>
              <div className="flex gap-1.5">
                {[1, 2, 3].map((turno) => {
                  const active = b.turnos.includes(turno);
                  return (
                    <button
                      key={turno}
                      onClick={() => toggleTurno(b.id, turno)}
                      className={`text-xs font-bold uppercase tracking-wide rounded px-2.5 py-1.5 border ${
                        active ? "bg-amber-500 border-amber-500 text-slate-950" : `${t.border} ${t.textMuted}`
                      }`}
                    >
                      {turno}º turno
                    </button>
                  );
                })}
              </div>
              <Field t={t} label="Dias">
                <input type="number" className={`${inputCls(t)} w-24`} value={b.dias} onChange={(e) => updateDias(b.id, e.target.value)} />
              </Field>
              <div className="ml-auto text-right">
                <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>Recupera</div>
                <div className="font-mono font-bold text-emerald-500">{fmt(b.recuperado)} massas</div>
              </div>
              <button onClick={() => removeBloco(b.id)} className="text-rose-500 hover:text-rose-400">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {blocosComputados.length === 0 && (
            <div className={`text-sm ${t.textMuted} text-center py-4`}>Nenhum bloco no plano. Clique em "Adicionar bloco".</div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-5 pt-4 border-t border-dashed border-slate-700/40">
          <div>
            <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>Total de dias no plano</div>
            <div className="font-mono text-lg font-bold">{fmt(totalDiasPlano)} dias</div>
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>Total recuperado</div>
            <div className="font-mono text-lg font-bold text-emerald-500">{fmt(totalRecuperadoPlano)} massas</div>
          </div>
          <div>
            <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>Perda a recuperar</div>
            <div className="font-mono text-lg font-bold">{fmt(c.perdaTotalMassasPeriodo)} massas</div>
          </div>
        </div>

        <div className={`mt-4 rounded px-4 py-3 flex items-start gap-2 text-sm font-semibold ${planoCobreTudo ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
          {planoCobreTudo ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          <span>
            {resumoPlano ? `Plano: ${resumoPlano}. ` : ""}
            {planoCobreTudo
              ? `Cobre a perda projetada, com excedente de ${fmt(Math.abs(diferencaPlano))} massas.`
              : `Ainda falta recuperar ${fmt(Math.abs(diferencaPlano))} massas — adicione mais dias ou turnos ao plano.`}
          </span>
        </div>
      </Panel>
    </div>
  );
}

/* ============================== CONFIG ============================== */

function ConfigPage({ t, dark, setDark, resetDemo }) {
  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <Panel t={t} title="Aparência" icon={Settings2}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Tema</div>
            <div className={`text-xs ${t.textMuted}`}>Alterne entre modo claro e escuro para monitores de produção.</div>
          </div>
          <button onClick={() => setDark((d) => !d)} className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold uppercase tracking-wide rounded px-4 py-2 flex items-center gap-2">
            {dark ? <Sun size={15} /> : <Moon size={15} />} {dark ? "Modo claro" : "Modo escuro"}
          </button>
        </div>
      </Panel>
      <Panel t={t} title="Dados de demonstração" icon={RotateCcw}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Restaurar dados de exemplo</div>
            <div className={`text-xs ${t.textMuted}`}>Reseta a meta e os lançamentos para os valores de demonstração.</div>
          </div>
          <button onClick={resetDemo} className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide border ${t.border} rounded px-4 py-2`}>
            <RotateCcw size={14} /> Restaurar
          </button>
        </div>
      </Panel>
      <Panel t={t} title="Sobre" icon={Info}>
        <p className={`text-sm ${t.textMuted}`}>
          Sistema de controle e acompanhamento de meta de produção mensal. Dados salvos localmente na sua sessão do artefato.
        </p>
      </Panel>
    </div>
  );
}
