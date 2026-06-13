import { useState, useEffect } from "react";

// ─── localStorage helpers (Safari-safe) ──────────────────────────────────────
function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveLS(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Safari private mode or storage quota exceeded — silently ignore
  }
}

// ─── Fonts ───────────────────────────────────────────────────────────────────
const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Lato:wght@300;400;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f5f2ee; }

  .row-hover:hover { background: #faf8f5 !important; }
  .btn-ghost:hover { background: #f0ece6 !important; }
  .tab-btn:hover { color: #1a1a1a !important; }

  input[type=number]::-webkit-inner-spin-button { opacity: 1; }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-in { animation: fadeIn 0.22s ease both; }

  /* ----- MOBILE OPTIMIZATIONS ----- */
  @media (max-width: 640px) {
    /* Larger touch targets */
    .week-selector button {
      width: 44px !important;
      height: 44px !important;
      font-size: 14px !important;
    }
    
    .day-tabs button {
      padding: 12px 16px !important;
      font-size: 14px !important;
      min-width: 70px;
    }
    
    .action-buttons button {
      padding: 10px 18px !important;
      font-size: 13px !important;
    }
    
    /* Improve spacing and readability */
    .main-container {
      padding: 24px 12px 48px !important;
    }
    
    .day-card {
      border-radius: 16px !important;
    }
    
    .day-label {
      padding: 14px 16px !important;
      font-size: 11px !important;
    }
    
    /* Make tables scrollable horizontally */
    .exercise-table-wrapper {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      margin: 0 -4px;
      padding: 0 4px;
    }
    
    .exercise-table-wrapper .exercise-grid-header,
    .exercise-table-wrapper .exercise-grid-row {
      min-width: 520px;
    }
    
    /* Better edit inputs on mobile */
    .edit-input {
      width: 70px !important;
      padding: 8px 4px !important;
      font-size: 14px !important;
    }
    
    /* Modal adjustments */
    .import-modal {
      padding: 20px !important;
      max-width: 94% !important;
      max-height: 85vh !important;
      overflow-y: auto !important;
    }
    
    .import-modal textarea {
      font-size: 14px !important;
    }
    
    /* Progression table improvements */
    .progression-wrapper {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    
    .progression-table th,
    .progression-table td {
      padding: 10px 8px !important;
      font-size: 11px !important;
      min-width: 48px;
    }
    
    .progression-table th:first-child,
    .progression-table td:first-child {
      position: sticky;
      left: 0;
      background: inherit;
      z-index: 2;
      min-width: 110px;
    }
    
    /* Header adjustments */
    .main-header h1 {
      font-size: clamp(28px, 7vw, 40px) !important;
    }
    
    .week-selector {
      gap: 8px !important;
    }
    
    /* Improve footer readability */
    .footer-text {
      font-size: 10px !important;
      padding: 0 16px !important;
    }
  }
  
  @media (max-width: 480px) {
    .day-tabs {
      gap: 4px !important;
    }
    
    .day-tabs button {
      padding: 10px 12px !important;
      font-size: 13px !important;
      min-width: 60px;
    }
    
    .action-buttons {
      width: 100%;
      justify-content: flex-end;
    }
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcKg(baseKg: number, exId: string, week: number, stepOverride: number) {
  if (baseKg === 0) return 0;
  const step = stepOverride ?? 2.5;
  return Math.round((baseKg + step * (week - 1)) * 4) / 4;
}

// Parse freeform text into program structure
// Expected format (flexible):
// [Day Name] — [Label]
// ExerciseName | sets x reps | baseKg
function parseTextImport(raw: string) {
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const program: Record<string, any> = {};
  let currentDay: string | null = null;
  let exCounter = 0;

  const DAY_RE = /^(lun|mar|mer|gio|ven|sab|dom|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\w+)\b/i;
  const EX_RE = /^(.+?)\s*[|,;\t]\s*(\d+)\s*[xX×]\s*([\w–\-\/]+)\s*(?:[|,;\t]\s*(\d+(?:[.,]\d+)?))?/i;

  for (const line of lines) {
    // Day header detection: line without | separator and reasonably short
    if (!line.includes("|") && !line.includes(",") && line.length < 60) {
      const parts = line.split(/[-–—]+/);
      const dayName = parts[0].trim();
      if (dayName) {
        currentDay = dayName;
        program[currentDay] = {
          label: parts.slice(1).join(" — ").trim() || "",
          exercises: [],
        };
      }
      continue;
    }

    const m = EX_RE.exec(line);
    if (m && currentDay) {
      exCounter++;
      program[currentDay].exercises.push({
        id: `ex${exCounter}`,
        name: m[1].trim(),
        sets: parseInt(m[2]),
        reps: m[3].trim(),
        baseKg: m[4] ? parseFloat(m[4].replace(",", ".")) : 0,
        step: 2.5,
      });
    }
  }

  return Object.keys(program).length > 0 ? program : null;
}

// ─── Default placeholder program ─────────────────────────────────────────────
const PLACEHOLDER_PROGRAM = {
  "Lunedì": {
    label: "PUSH — Petto / Spalle / Tricipiti",
    exercises: [
      { id: "l1", name: "Panca Piana", sets: 4, reps: "6–8", baseKg: 80, step: 2.5 },
      { id: "l2", name: "Panca Inclinata Manubri", sets: 3, reps: "8–10", baseKg: 24, step: 1.25 },
      { id: "l3", name: "Lento Avanti", sets: 4, reps: "8–10", baseKg: 50, step: 2.5 },
      { id: "l4", name: "Alzate Laterali", sets: 3, reps: "12–15", baseKg: 10, step: 1.25 },
      { id: "l5", name: "French Press", sets: 3, reps: "10–12", baseKg: 30, step: 1.25 },
    ],
  },
  "Martedì": {
    label: "PULL — Schiena / Bicipiti",
    exercises: [
      { id: "m1", name: "Stacco da Terra", sets: 4, reps: "5", baseKg: 100, step: 2.5 },
      { id: "m2", name: "Lat Machine", sets: 4, reps: "8–10", baseKg: 65, step: 2.5 },
      { id: "m3", name: "Rematore Bilanciere", sets: 3, reps: "8–10", baseKg: 60, step: 2.5 },
      { id: "m4", name: "Curl Bilanciere", sets: 3, reps: "10–12", baseKg: 30, step: 1.25 },
      { id: "m5", name: "Curl Concentrato", sets: 2, reps: "12–15", baseKg: 12, step: 1.25 },
    ],
  },
  "Giovedì": {
    label: "LEGS — Quadricipiti / Femorali / Glutei",
    exercises: [
      { id: "g1", name: "Squat Bilanciere", sets: 4, reps: "6–8", baseKg: 80, step: 2.5 },
      { id: "g2", name: "Leg Press", sets: 3, reps: "10–12", baseKg: 120, step: 2.5 },
      { id: "g3", name: "Affondi Manubri", sets: 3, reps: "10/lato", baseKg: 18, step: 1.25 },
      { id: "g4", name: "Leg Curl", sets: 3, reps: "12–15", baseKg: 40, step: 1.25 },
      { id: "g5", name: "Calf Raise", sets: 4, reps: "15–20", baseKg: 60, step: 1.25 },
    ],
  },
  "Venerdì": {
    label: "FULL — Corpo Totale / Accessori",
    exercises: [
      { id: "v1", name: "Stacco Rumeno", sets: 3, reps: "10–12", baseKg: 70, step: 2.5 },
      { id: "v2", name: "Pull-Up", sets: 3, reps: "max", baseKg: 0, step: 0 },
      { id: "v3", name: "Dip Parallele", sets: 3, reps: "max", baseKg: 0, step: 0 },
      { id: "v4", name: "Plank", sets: 3, reps: "60s", baseKg: 0, step: 0 },
      { id: "v5", name: "Face Pull", sets: 3, reps: "15–20", baseKg: 15, step: 1.25 },
    ],
  },
};

const WEEKS = [1,2,3,4,5,6,7,8];

// ─── Sub-components ───────────────────────────────────────────────────────────

function WeekSelector({ week, setWeek }: { week: number; setWeek: (w: number) => void }) {
  return (
    <div className="week-selector" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {WEEKS.map(w => (
        <button
          key={w}
          onClick={() => setWeek(w)}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            border: w === week ? "2px solid #1a1a1a" : "1.5px solid #d0ccc5",
            background: w === week ? "#1a1a1a" : "transparent",
            color: w === week ? "#f5f2ee" : "#999",
            fontFamily: "'Lato', sans-serif",
            fontWeight: w === week ? 700 : 400,
            fontSize: 12, cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {w}
        </button>
      ))}
    </div>
  );
}

function ExerciseTable({ day, exercises, week, onUpdate, editMode }: { 
  day: string; 
  exercises: any[]; 
  week: number; 
  onUpdate: (id: string, field: string, value: number) => void; 
  editMode: boolean;
}) {
  return (
    <div className="exercise-table-wrapper" style={{ width: "100%" }}>
      {/* Table header */}
      <div className="exercise-grid-header" style={{
        display: "grid",
        gridTemplateColumns: "1fr 72px 90px 80px 70px",
        padding: "6px 12px",
        borderBottom: "2px solid #1a1a1a",
        marginBottom: 2,
      }}>
        {["Esercizio", "Serie×Rip.", "Base kg", "W"+week+" kg", "Δ/sett."].map((h, i) => (
          <span key={h} style={{
            fontFamily: "'Lato', sans-serif",
            fontSize: 10,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "#aaa",
            textAlign: i > 0 ? "center" : "left",
          }}>{h}</span>
        ))}
      </div>

      {exercises.map((ex, idx) => {
        const kg = calcKg(ex.baseKg, ex.id, week, ex.step);
        const delta = ex.step ?? 2.5;
        const isBodyweight = ex.baseKg === 0;

        return (
          <div
            key={ex.id}
            className="exercise-grid-row row-hover"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 72px 90px 80px 70px",
              padding: "11px 12px",
              borderBottom: "1px solid #e8e3db",
              alignItems: "center",
              background: idx % 2 === 0 ? "#fff" : "#fdfcfa",
              transition: "background 0.12s",
            }}
          >
            {/* Name */}
            <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 14, color: "#1a1a1a", fontWeight: 400 }}>
              {ex.name}
            </span>

            {/* Sets × reps */}
            <span style={{ textAlign: "center", fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#777" }}>
              {ex.sets}×{ex.reps}
            </span>

            {/* Base kg — editable */}
            {editMode ? (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <input
                  type="number"
                  step="1.25"
                  value={ex.baseKg}
                  onChange={e => onUpdate(ex.id, "baseKg", parseFloat(e.target.value) || 0)}
                  className="edit-input"
                  style={{
                    width: 60, textAlign: "center",
                    border: "1.5px solid #c8b89a",
                    borderRadius: 6,
                    background: "#fffdf9",
                    fontFamily: "'Lato', sans-serif",
                    fontSize: 13, color: "#1a1a1a",
                    padding: "3px 6px",
                    outline: "none",
                  }}
                />
              </div>
            ) : (
              <span style={{ textAlign: "center", fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#999" }}>
                {isBodyweight ? "BW" : `${ex.baseKg}`}
              </span>
            )}

            {/* Current week kg */}
            <span style={{
              textAlign: "center",
              fontFamily: "'Lato', sans-serif",
              fontSize: 15, fontWeight: 700,
              color: isBodyweight ? "#bbb" : "#1a1a1a",
            }}>
              {isBodyweight ? "BW" : `${kg}`}
            </span>

            {/* Delta */}
            <span style={{
              textAlign: "center",
              fontFamily: "'Lato', sans-serif",
              fontSize: 12,
              color: isBodyweight ? "#ddd" : "#8aab6e",
            }}>
              {isBodyweight ? "—" : `+${delta}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ImportPanel({ onImport, onClose }: { onImport: (prog: any) => void; onClose: () => void }) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");

  const EXAMPLE = `Lunedì — PUSH Petto/Spalle
Panca Piana | 4x6-8 | 80
Lento Avanti | 4x8-10 | 50
Alzate Laterali | 3x12-15 | 10

Martedì — PULL Schiena/Bicipiti
Stacco | 4x5 | 100
Lat Machine | 4x8-10 | 65`;

  function handleImport() {
    const result = parseTextImport(raw);
    if (!result) {
      setError("Formato non riconosciuto. Guarda l'esempio qui sotto.");
      return;
    }
    onImport(result);
  }

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(30,25,20,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, padding: 20,
    }}>
      <div className="import-modal fade-in" style={{
        background: "#fff",
        borderRadius: 16,
        padding: 32,
        maxWidth: 560, width: "100%",
        boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#1a1a1a" }}>
            Importa la tua scheda
          </h2>
          <button onClick={onClose} className="btn-ghost" style={{
            border: "none", background: "transparent", fontSize: 20,
            cursor: "pointer", color: "#aaa", borderRadius: 8, padding: "2px 8px",
          }}>×</button>
        </div>

        <p style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#777", marginBottom: 14, lineHeight: 1.6 }}>
          Incolla la tua scheda nel formato libero qui sotto. Ogni giorno inizia con il nome del giorno,
          poi un esercizio per riga nel formato <strong>Nome | Serie×Rip | Kg base</strong>.
        </p>

        <textarea
          value={raw}
          onChange={e => { setRaw(e.target.value); setError(""); }}
          placeholder={EXAMPLE}
          rows={10}
          style={{
            width: "100%", resize: "vertical",
            border: "1.5px solid #ddd", borderRadius: 10,
            padding: 14, fontFamily: "'Lato', sans-serif",
            fontSize: 13, color: "#1a1a1a", lineHeight: 1.7,
            background: "#fdfcfa", outline: "none",
          }}
        />

        {error && (
          <p style={{ color: "#c0392b", fontFamily: "'Lato', sans-serif", fontSize: 12, marginTop: 8 }}>
            ⚠ {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn-ghost" style={{
            padding: "9px 20px", borderRadius: 8,
            border: "1.5px solid #ddd", background: "transparent",
            fontFamily: "'Lato', sans-serif", fontSize: 13, cursor: "pointer", color: "#777",
          }}>
            Annulla
          </button>
          <button onClick={handleImport} style={{
            padding: "9px 24px", borderRadius: 8,
            border: "none", background: "#1a1a1a",
            fontFamily: "'Lato', sans-serif", fontSize: 13,
            fontWeight: 700, cursor: "pointer", color: "#f5f2ee",
          }}>
            Importa →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function GymTracker() {
  // ── Initialise from localStorage ─────────────────────────────────────────
  const [program, setProgram] = useState(() =>
    loadLS("gym_program", PLACEHOLDER_PROGRAM)
  );

  const [week, setWeek] = useState(() =>
    loadLS("gym_week", 1)
  );

  const [activeDay, setActiveDay] = useState(() => {
    const savedProgram = loadLS("gym_program", PLACEHOLDER_PROGRAM);
    const savedDay    = loadLS("gym_activeDay", Object.keys(savedProgram)[0]);
    return Object.keys(savedProgram).includes(savedDay)
      ? savedDay
      : Object.keys(savedProgram)[0];
  });

  const [editMode, setEditMode]   = useState(false);
  const [showImport, setShowImport] = useState(false);

  // ── Persist to localStorage whenever state changes ────────────────────────
  useEffect(() => { saveLS("gym_program",   program);   }, [program]);
  useEffect(() => { saveLS("gym_week",      week);      }, [week]);
  useEffect(() => { saveLS("gym_activeDay", activeDay); }, [activeDay]);

  const days = Object.keys(program);
  const exercises = program[activeDay]?.exercises ?? [];

  function handleUpdate(exId: string, field: string, value: number) {
    setProgram((prev: any) => ({
      ...prev,
      [activeDay]: {
        ...prev[activeDay],
        exercises: prev[activeDay].exercises.map((ex: any) =>
          ex.id === exId ? { ...ex, [field]: value } : ex
        ),
      },
    }));
  }

  function handleImport(newProgram: any) {
    // Assign step defaults
    const enriched: any = {};
    for (const [day, data] of Object.entries(newProgram)) {
      enriched[day] = {
        ...(data as any),
        exercises: (data as any).exercises.map((ex: any, i: number) => ({
          ...ex,
          step: ex.step ?? 2.5,
          id: ex.id ?? `${day.slice(0,2)}${i}`,
        })),
      };
    }
    setProgram(enriched);
    setActiveDay(Object.keys(enriched)[0]);
    setShowImport(false);
    setEditMode(false);
  }

  return (
    <>
      <style>{FONTS}</style>

      <div className="main-container" style={{
        minHeight: "100vh",
        background: "#f5f2ee",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 16px 60px",
      }}>

        {/* ── Header ── */}
        <div className="main-header" style={{ width: "100%", maxWidth: 680, marginBottom: 36 }}>
          <p style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#bbb", marginBottom: 6 }}>
            Allenamento settimanale
          </p>
          <div className="action-buttons" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(32px, 6vw, 48px)",
              fontWeight: 900,
              color: "#1a1a1a",
              letterSpacing: -1,
              lineHeight: 1.05,
            }}>
              Training<br />Schedule
            </h1>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                onClick={() => setShowImport(true)}
                className="btn-ghost"
                style={{
                  padding: "8px 16px", borderRadius: 8,
                  border: "1.5px solid #d0ccc5", background: "transparent",
                  fontFamily: "'Lato', sans-serif", fontSize: 12,
                  cursor: "pointer", color: "#666", transition: "background 0.15s",
                }}
              >
                ↑ Importa scheda
              </button>
              <button
                onClick={() => setEditMode(e => !e)}
                style={{
                  padding: "8px 16px", borderRadius: 8,
                  border: "none",
                  background: editMode ? "#1a1a1a" : "#e8e3db",
                  fontFamily: "'Lato', sans-serif", fontSize: 12,
                  fontWeight: 700, cursor: "pointer",
                  color: editMode ? "#f5f2ee" : "#555",
                  transition: "all 0.15s",
                }}
              >
                {editMode ? "✓ Salva" : "✏ Modifica"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Week selector ── */}
        <div style={{ width: "100%", maxWidth: 680, marginBottom: 28 }}>
          <p style={{ fontFamily: "'Lato', sans-serif", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#bbb", marginBottom: 10 }}>
            Settimana
          </p>
          <WeekSelector week={week} setWeek={setWeek} />
        </div>

        {/* ── Day tabs ── */}
        <div className="day-tabs" style={{
          width: "100%", maxWidth: 680,
          display: "flex", gap: 0,
          borderBottom: "2px solid #1a1a1a",
          marginBottom: 0,
          overflowX: "auto",
        }}>
          {days.map(d => (
            <button
              key={d}
              onClick={() => setActiveDay(d)}
              className="tab-btn"
              style={{
                padding: "10px 20px",
                border: "none",
                borderBottom: activeDay === d ? "3px solid #1a1a1a" : "3px solid transparent",
                background: "transparent",
                fontFamily: "'Lato', sans-serif",
                fontSize: 13,
                fontWeight: activeDay === d ? 700 : 400,
                color: activeDay === d ? "#1a1a1a" : "#aaa",
                cursor: "pointer",
                whiteSpace: "nowrap",
                marginBottom: -2,
                transition: "color 0.15s",
              }}
            >
              {d}
            </button>
          ))}
        </div>

        {/* ── Day card ── */}
        <div className="day-card fade-in" style={{
          width: "100%", maxWidth: 680,
          background: "#fff",
          borderRadius: "0 0 14px 14px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
          overflow: "hidden",
          marginBottom: 32,
        }}>
          {/* Day label */}
          <div className="day-label" style={{
            padding: "16px 20px 14px",
            borderBottom: "1px solid #f0ece6",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#aaa", letterSpacing: 0.5 }}>
              {program[activeDay]?.label || ""}
            </span>
            <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#c8b89a" }}>
              Settimana {week} di 8
            </span>
          </div>

          {/* Table */}
          <div style={{ padding: "8px 8px 12px" }}>
            <ExerciseTable
              day={activeDay}
              exercises={exercises}
              week={week}
              onUpdate={handleUpdate}
              editMode={editMode}
            />
          </div>
        </div>

        {/* ── Progression overview ── */}
        <div style={{ width: "100%", maxWidth: 680 }}>
          <p style={{ fontFamily: "'Lato', sans-serif", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#bbb", marginBottom: 14 }}>
            Panoramica progressione — {activeDay}
          </p>
          <div className="progression-wrapper" style={{
            background: "#fff",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          }}>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table className="progression-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f0ece6" }}>
                    <th style={thS}>Esercizio</th>
                    {WEEKS.map(w => (
                      <th key={w} style={{ ...thS, color: w === week ? "#1a1a1a" : "#ccc", fontWeight: w === week ? 700 : 400 }}>
                        W{w}
                      </th>
                    ))}
                  </td>
                </thead>
                <tbody>
                  {exercises.map((ex: any, i: number) => (
                    <tr key={ex.id} style={{ background: i % 2 === 0 ? "#fff" : "#fdfcfa", borderBottom: "1px solid #f5f2ee" }}>
                      <td style={{ ...tdS, textAlign: "left", color: "#444", fontWeight: 400, minWidth: 130 }}>
                        {ex.name}
                      </td>
                      {WEEKS.map(w => {
                        const kg = calcKg(ex.baseKg, ex.id, w, ex.step);
                        const active = w === week;
                        return (
                          <td key={w} style={{
                            ...tdS,
                            color: ex.baseKg === 0 ? "#ddd" : active ? "#1a1a1a" : "#bbb",
                            fontWeight: active ? 700 : 400,
                            background: active ? "#fffcf4" : "transparent",
                          }}>
                            {ex.baseKg === 0 ? "BW" : kg}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <p className="footer-text" style={{ marginTop: 40, fontFamily: "'Lato', sans-serif", fontSize: 11, color: "#ccc", textAlign: "center", lineHeight: 1.8 }}>
          Progressione lineare · Compound +2.5 kg/sett · Isolamento +1.25 kg/sett<br />
          Importa la tua scheda per personalizzare tutto
        </p>
      </div>

      {showImport && <ImportPanel onImport={handleImport} onClose={() => setShowImport(false)} />}
    </>
  );
}

const thS = {
  fontFamily: "'Lato', sans-serif",
  fontSize: 10, letterSpacing: 1,
  textTransform: "uppercase",
  color: "#ccc", fontWeight: 400,
  padding: "10px 12px",
  textAlign: "center",
};

const tdS = {
  fontFamily: "'Lato', sans-serif",
  fontSize: 12, color: "#bbb",
  padding: "9px 12px",
  textAlign: "center",
  transition: "background 0.12s",
};