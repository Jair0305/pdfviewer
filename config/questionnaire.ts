import type { Question } from "@/types/expediente";

export const QUESTIONNAIRE_TEMPLATE: Question[] = [
  // ── Identificación ────────────────────────────────────────────────────────
  { id: "q_ident_completo",    category: "Identificación",  text: "¿El expediente contiene identificación completa de las partes?" },
  { id: "q_ident_domicilio",   category: "Identificación",  text: "¿Se acredita domicilio de las partes?" },
  { id: "q_ident_representante", category: "Identificación", text: "¿El representante legal cuenta con poder notarial vigente?" },

  // ── Documentos obligatorios ───────────────────────────────────────────────
  { id: "q_doc_demanda",       category: "Documentos",      text: "¿La demanda o escrito inicial está presente?" },
  { id: "q_doc_contestacion",  category: "Documentos",      text: "¿La contestación a la demanda está presente?" },
  { id: "q_doc_pruebas",       category: "Documentos",      text: "¿Las pruebas ofrecidas están debidamente integradas?" },
  { id: "q_doc_notificaciones",category: "Documentos",      text: "¿Las notificaciones constan en el expediente?" },
  { id: "q_doc_acuerdos",      category: "Documentos",      text: "¿Los acuerdos del juzgado están completos?" },

  // ── Plazos y términos ─────────────────────────────────────────────────────
  { id: "q_plazos_demanda",    category: "Plazos",          text: "¿La demanda se presentó dentro del término legal?" },
  { id: "q_plazos_contestacion", category: "Plazos",        text: "¿La contestación fue presentada en tiempo?" },
  { id: "q_plazos_recursos",   category: "Plazos",          text: "¿Los recursos o apelaciones se interpusieron en tiempo y forma?" },

  // ── Firma y autenticidad ──────────────────────────────────────────────────
  { id: "q_firma_partes",      category: "Autenticidad",    text: "¿Los documentos cuentan con firma de las partes?" },
  { id: "q_firma_autoridad",   category: "Autenticidad",    text: "¿Los acuerdos y resoluciones tienen firma del juzgador?" },
  { id: "q_firma_sello",       category: "Autenticidad",    text: "¿Los documentos oficiales tienen sello de la autoridad?" },

  // ── Resolución ────────────────────────────────────────────────────────────
  { id: "q_res_sentencia",     category: "Resolución",      text: "¿Existe sentencia definitiva?" },
  { id: "q_res_ejecutoria",    category: "Resolución",      text: "¿La sentencia causó ejecutoria?" },
  { id: "q_res_cumplimiento",  category: "Resolución",      text: "¿Consta el cumplimiento de la sentencia?" },
];
