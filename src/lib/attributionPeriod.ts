export interface ResolvedAttributionPeriod {
  startDate: string;
  endDate: string;
}

/**
 * Risolve il periodo di attribuzione a partire dalle date effettivamente
 * attribuibili (quelle con SIA snapshot completo SIA Netting storico).
 *
 * T1 è SEMPRE l'ultima data attribuibile: il caso d'uso predefinito è "il
 * rendimento fino ad oggi", quindi T1 non è selezionabile dall'utente.
 * L'utente sceglie solo T0; se non specificato, oppure non valido (non tra
 * le date attribuibili, o non precedente a T1), il periodo parte dalla prima
 * data attribuibile disponibile (storico completo).
 *
 * Ritorna null se non ci sono almeno due date attribuibili distinte.
 */
export function resolveAttributionPeriod(
  attributableDates: string[],
  selectedStartDate?: string | null,
): ResolvedAttributionPeriod | null {
  const dates = [...new Set(attributableDates)].sort((a, b) => a.localeCompare(b));
  if (dates.length < 2) return null;

  const endDate = dates[dates.length - 1];
  const startDate = selectedStartDate && dates.includes(selectedStartDate) && selectedStartDate < endDate
    ? selectedStartDate
    : dates[0];

  return { startDate, endDate };
}
