/**
 * Script para generar datos de prueba y preview HTML
 * Ejecutar con: node src/scripts/preview.js  (Node puro, no pasa por Metro)
 */
/* eslint-env node */
/* eslint-disable no-undef */

const fs = require('fs');
const path = require('path');

const CLIENT = {
  nombre: "Carlos Martínez",
  edad: 28,
  pesoActual: 80, // kg
  altura: 175,    // cm
  morfologia: "Mesomorfo",
  experiencia: "Intermedio (2 años entrenando)",
  objetivo: "Hipertrofia muscular",
  frecuencia: "4 días/semana",
  nivelGrasa: 15, // %
  observaciones: "Buena genética para pecho y brazos. Espalda necesita más volumen.",
};

const WEEK_PLAN = {
  nombre: "Push/Pull/Legs - Semana 1",
  mesociclo: 1,
  semanaInicio: 1,
  semanaFin: 4,
  dias: [
    {
      nombre: "Lunes - Pecho y Tríceps",
      tipo: "Push",
      ejercicios: [
        { nombre: "Press de banca con barra", series: 4, reps: "8-10", rpe: 8, descanso: "90s", progresion: "+2.5kg/sem" },
        { nombre: "Press inclinado con mancuernas", series: 3, reps: "10-12", rpe: 8, descanso: "90s", progresion: "+2.5kg/sem" },
        { nombre: "Aperturas con mancuernas", series: 3, reps: "12-15", rpe: 7, descanso: "60s", progresion: "+1kg/sem" },
        { nombre: "Fondos en paralelas", series: 3, reps: "8-12", rpe: 9, descanso: "120s", progresion: "peso corporal" },
        { nombre: "Extensiones en polea", series: 3, reps: "12-15", rpe: 8, descanso: "60s", progresion: "+2.5kg/sem" },
      ],
    },
    {
      nombre: "Martes - Espalda y Bíceps",
      tipo: "Pull",
      ejercicios: [
        { nombre: "Dominadas", series: 4, reps: "6-10", rpe: 8, descanso: "120s", progresion: "+1 rep/sem" },
        { nombre: "Remo con barra", series: 4, reps: "8-10", rpe: 8, descanso: "90s", progresion: "+2.5kg/sem" },
        { nombre: "Jalón al pecho", series: 3, reps: "10-12", rpe: "7", descanso: "90s", progresion: "+2.5kg/sem" },
        { nombre: "Face pulls", series: 3, reps: "15-20", rpe: 7, descanso: "60s", progresion: "+1kg/sem" },
        { nombre: "Curl con barra", series: 3, reps: "10-12", rpe: 8, descanso: "60s", progresion: "+2.5kg/sem" },
      ],
    },
    {
      nombre: "Miércoles - Pierna",
      tipo: "Legs",
      ejercicios: [
        { nombre: "Sentadilla libre", series: 4, reps: "6-8", rpe: 8, descanso: "120s", progresion: "+5kg/sem" },
        { nombre: "Peso muerto rumano", series: 3, reps: "10-12", rpe: 8, descanso: "90s", progresion: "+2.5kg/sem" },
        { nombre: "Prensa de piernas", series: 3, reps: "10-12", rpe: 7, descanso: "90s", progresion: "+10kg/sem" },
        { nombre: "Curl femoral", series: 3, reps: "12-15", rpe: 8, descanso: "60s", progresion: "+2.5kg/sem" },
        { nombre: "Elevación de talones", series: 4, reps: "15-20", rpe: 8, descanso: "45s", progresion: "+5kg/sem" },
      ],
    },
    {
      nombre: "Viernes - Hombros y Brazos",
      tipo: "Upper",
      ejercicios: [
        { nombre: "Press militar", series: 4, reps: "8-10", rpe: 8, descanso: "90s", progresion: "+2.5kg/sem" },
        { nombre: "Elevaciones laterales", series: 3, reps: "12-15", rpe: 8, descanso: "60s", progresion: "+1kg/sem" },
        { nombre: "Press Arnold", series: 3, reps: "10-12", rpe: 8, descanso: "90s", progresion: "+2.5kg/sem" },
        { nombre: "Curl martillo", series: 3, reps: "12-15", rpe: 8, descanso: "60s", progresion: "+1kg/sem" },
        { nombre: "Extensiones overhead", series: 3, reps: "12-15", rpe: 8, descanso: "60s", progresion: "+2.5kg/sem" },
      ],
    },
  ],
};

const CONSEJOS = {
  Mesomorfo: [
    "✅ Responde bien al entrenamiento de hipertrofia",
    "✅ Puede ganar músculo con relativa facilidad",
    "⚠️ Cuidado con el metabolismo: no descuidar la dieta",
    "📈 Enfoque: progresión lineal + volumen moderado-alto",
  ],
  Endomorfo: [
    "✅ Gran capacidad de fuerza",
    "⚠️ Tendencia a acumular grasa: cardio + dieta estricta",
    "📈 Enfoque: supersets + menor descanso + HIIT",
  ],
  Ectomorfo: [
    "✅ Dificultad para engordar",
    "⚠️ Dificultad para ganar masa: superávit calórico + compuestos pesados",
    "📈 Enfoque: menos volumen, más descanso, compuestos básicos",
  ],
};

function generateHTML() {
  let html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rutina Personalizada - ${CLIENT.nombre}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
    .header { background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; padding: 40px; }
    .header h1 { font-size: 32px; font-weight: 700; margin-bottom: 8px; }
    .header p { opacity: 0.9; font-size: 16px; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .client-card { background: white; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .client-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-top: 16px; }
    .stat { text-align: center; }
    .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 4px; }
    .stat-value { font-size: 24px; font-weight: 700; color: #0f172a; }
    .stat-unit { font-size: 14px; color: #64748b; font-weight: 400; }
    .morph-tag { display: inline-block; background: #e0f2fe; color: #0284c7; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 13px; margin-top: 8px; }
    .obs { margin-top: 16px; padding: 12px 16px; background: #fffbeb; border-radius: 10px; color: #92400e; font-size: 14px; line-height: 1.5; }
    .section-title { font-size: 20px; font-weight: 700; margin: 32px 0 16px; color: #0f172a; }
    .advice-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; }
    .advice { background: white; border-radius: 12px; padding: 16px; border-left: 4px solid #0ea5e9; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .day-card { background: white; border-radius: 16px; margin-bottom: 20px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .day-header { background: #0f172a; color: white; padding: 16px 24px; display: flex; align-items: center; gap: 12px; }
    .day-number { width: 36px; height: 36px; border-radius: 50%; background: #0ea5e9; display: flex; align-items: center; justify-content: center; font-weight: 700; }
    .day-title { font-size: 18px; font-weight: 600; }
    .day-type { margin-left: auto; background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .exercise { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 16px; }
    .exercise:last-child { border-bottom: none; }
    .exercise-name { font-weight: 600; font-size: 15px; flex: 1; }
    .exercise-config { display: flex; gap: 12px; align-items: center; color: #64748b; font-size: 13px; flex-wrap: wrap; }
    .config-badge { background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-weight: 500; white-space: nowrap; }
    .progresion { color: #22c55e; font-weight: 600; font-size: 12px; }
    .footer { text-align: center; padding: 32px; color: #94a3b8; font-size: 12px; }
    @media print { body { background: white; } .day-card { box-shadow: none; border: 1px solid #e2e8f0; } .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 ${WEEK_PLAN.nombre}</h1>
    <p>Mesociclo ${WEEK_PLAN.mesociclo} · Semanas ${WEEK_PLAN.semanaInicio}-${WEEK_PLAN.semanaFin} · ${WEEK_PLAN.dias.length} días/semana</p>
  </div>
  <div class="container">

    <div class="client-card">
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 4px;">👤 ${CLIENT.nombre}</h2>
      <span class="morph-tag">${CLIENT.morfologia}</span>
      <div class="client-grid">
        <div class="stat">
          <div class="stat-label">Edad</div>
          <div class="stat-value">${CLIENT.edad}<span class="stat-unit"> años</span></div>
        </div>
        <div class="stat">
          <div class="stat-label">Peso</div>
          <div class="stat-value">${CLIENT.pesoActual}<span class="stat-unit"> kg</span></div>
        </div>
        <div class="stat">
          <div class="stat-label">Altura</div>
          <div class="stat-value">${CLIENT.altura}<span class="stat-unit"> cm</span></div>
        </div>
        <div class="stat">
          <div class="stat-label">Grasa</div>
          <div class="stat-value">${CLIENT.nivelGrasa}<span class="stat-unit">%</span></div>
        </div>
        <div class="stat">
          <div class="stat-label">Experiencia</div>
          <div class="stat-value" style="font-size:16px">${CLIENT.experiencia}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Objetivo</div>
          <div class="stat-value" style="font-size:16px">${CLIENT.objetivo}</div>
        </div>
      </div>
      <div class="obs">💬 ${CLIENT.observaciones}</div>
    </div>

    <h2 class="section-title">🎯 Enfoque según Morfología: ${CLIENT.morfologia}</h2>
    <div class="advice-grid">
`;

  const consejos = CONSEJOS[CLIENT.morfologia] || CONSEJOS.Mesomorfo;
  consejos.forEach((c) => {
    html += `      <div class="advice">${c}</div>\n`;
  });

  html += `    </div>

    <h2 class="section-title">📅 Semana 1 — Rutina Detallada</h2>
`;

  WEEK_PLAN.dias.forEach((dia, i) => {
    html += `
    <div class="day-card">
      <div class="day-header">
        <div class="day-number">${i + 1}</div>
        <div class="day-title">${dia.nombre}</div>
        <div class="day-type">${dia.tipo}</div>
      </div>
`;
    dia.ejercicios.forEach((ej) => {
      html += `
      <div class="exercise">
        <div class="exercise-name">${ej.nombre}</div>
        <div class="exercise-config">
          <span class="config-badge">${ej.series}×${ej.reps}</span>
          <span class="config-badge">${ej.descanso}</span>
          <span class="config-badge">RPE ${ej.rpe}</span>
          <span class="progresion">📈 ${ej.progresion}</span>
        </div>
      </div>
`;
    });
    html += `    </div>\n`;
  });

  html += `
    <div class="footer">
      <p>Generado por PersonalTrainer App · ${new Date().toLocaleDateString('es-ES')} · Carlos Martínez - Hipertrofia - ${CLIENT.morfologia}</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

const html = generateHTML();
const outPath = path.join(__dirname, '..', '..', 'preview-rutina.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`✅ HTML generado en: ${outPath}`);
console.log(`   Ábrelo en tu navegador (doble clic o "start preview-rutina.html")`);
