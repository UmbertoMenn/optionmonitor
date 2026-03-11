// Suffissi ticker europei (riuso logica edge function)
const EU_SUFFIXES = ['.MI', '.DE', '.SW', '.PA', '.AS', '.L', '.MC', '.BR', '.VI', '.CO', '.HE', '.ST', '.OL', '.LS'];

export function isEuropeanTicker(ticker: string): boolean {
  return EU_SUFFIXES.some(suffix => ticker.toUpperCase().endsWith(suffix));
}

// Helper per gestire ora legale CET/CEST
function getCETOffset(date: Date): number {
  const month = date.getUTCMonth();
  if (month >= 3 && month < 9) return 2; // CEST (Apr-Sep)
  if (month === 2) {
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), 3, 0));
    const lastSunday = lastDay.getUTCDate() - lastDay.getUTCDay();
    return date.getUTCDate() >= lastSunday ? 2 : 1;
  }
  if (month === 9) {
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), 10, 0));
    const lastSunday = lastDay.getUTCDate() - lastDay.getUTCDay();
    return date.getUTCDate() >= lastSunday ? 1 : 2;
  }
  return 1; // CET (Nov-Feb)
}

// Helper per gestire ora legale US Eastern (EDT/EST)
// EDT (UTC-4): 2a domenica di marzo → 1a domenica di novembre
// EST (UTC-5): resto dell'anno
function getETOffset(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-11

  // Calcola 2a domenica di marzo (mese 2)
  const mar1 = new Date(Date.UTC(year, 2, 1));
  const mar1Day = mar1.getUTCDay(); // 0=Sun
  const secondSundayMar = 1 + (7 - mar1Day) % 7 + 7; // 2a domenica

  // Calcola 1a domenica di novembre (mese 10)
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const nov1Day = nov1.getUTCDay();
  const firstSundayNov = 1 + (7 - nov1Day) % 7;

  // DST US scatta alle 2:00 AM locale (07:00 UTC per EST→EDT, 06:00 UTC per EDT→EST)
  const dstStart = Date.UTC(year, 2, secondSundayMar, 7, 0); // marzo, 07:00 UTC
  const dstEnd = Date.UTC(year, 10, firstSundayNov, 6, 0);   // novembre, 06:00 UTC

  const ts = date.getTime();
  if (ts >= dstStart && ts < dstEnd) return -4; // EDT
  return -5; // EST
}

export function isMarketOpen(ticker: string): boolean {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  
  // Weekend - tutti i mercati chiusi
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  
  if (isEuropeanTicker(ticker)) {
    // EU: 09:00-17:30 CET/CEST
    const cetOffset = getCETOffset(now);
    const cetHour = (now.getUTCHours() + cetOffset) % 24;
    const cetMinutes = now.getUTCMinutes();
    const cetTime = cetHour * 60 + cetMinutes;
    const euOpen = 9 * 60;
    const euClose = 17 * 60 + 30;
    return cetTime >= euOpen && cetTime < euClose;
  } else {
    // US: 09:30-16:00 Eastern Time
    const etOffset = getETOffset(now);
    const etHourRaw = now.getUTCHours() + etOffset;
    const etHour = ((etHourRaw % 24) + 24) % 24;
    const etMinutes = now.getUTCMinutes();
    const etTime = etHour * 60 + etMinutes;
    const usOpen = 9 * 60 + 30;
    const usClose = 16 * 60;
    return etTime >= usOpen && etTime < usClose;
  }
}
