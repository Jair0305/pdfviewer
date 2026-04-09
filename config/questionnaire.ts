import type { Question } from "@/types/expediente";

/**
 * Static questionnaire template for expediente review.
 * Replace/extend with backend-fetched questions when backend is ready.
 */
export const QUESTIONNAIRE_TEMPLATE: Question[] = [
  // ── Admisibilidad ──────────────────────────────────────────────────────────
  { id: "q1",  text: "¿El expediente cuenta con la demanda inicial?",         category: "Admisibilidad", required: true },
  { id: "q2",  text: "¿La demanda está debidamente firmada?",                 category: "Admisibilidad", required: true },
  { id: "q3",  text: "¿Se adjuntaron los anexos requeridos?",                 category: "Admisibilidad" },
  { id: "q4",  text: "¿Existe acuerdo de admisión?",                          category: "Admisibilidad", required: true },
  // ── Notificación ──────────────────────────────────────────────────────────
  { id: "q5",  text: "¿Se realizó el emplazamiento al demandado?",            category: "Notificación",  required: true },
  { id: "q6",  text: "¿Consta constancia de notificación en autos?",          category: "Notificación" },
  { id: "q7",  text: "¿Las notificaciones se realizaron en tiempo y forma?",  category: "Notificación" },
  // ── Contestación ──────────────────────────────────────────────────────────
  { id: "q8",  text: "¿Existe contestación de demanda?",                      category: "Contestación",  required: true },
  { id: "q9",  text: "¿La contestación fue presentada en tiempo?",            category: "Contestación",  required: true },
  { id: "q10", text: "¿La contestación incluye ofrecimiento de pruebas?",     category: "Contestación" },
  // ── Pruebas ───────────────────────────────────────────────────────────────
  { id: "q11", text: "¿Se admitieron las pruebas ofrecidas?",                 category: "Pruebas" },
  { id: "q12", text: "¿Existe acuerdo de desahogo de pruebas?",               category: "Pruebas" },
  { id: "q13", text: "¿Las pruebas documentales están debidamente certificadas?", category: "Pruebas" },
  // ── Sentencia ─────────────────────────────────────────────────────────────
  { id: "q14", text: "¿Existe sentencia definitiva?",                         category: "Sentencia",     required: true },
  { id: "q15", text: "¿La sentencia está debidamente fundada y motivada?",    category: "Sentencia",     required: true },
  { id: "q16", text: "¿Existe constancia de notificación de la sentencia?",   category: "Sentencia" },
];
