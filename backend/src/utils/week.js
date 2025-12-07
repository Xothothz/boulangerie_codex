export function getWeekDateRange(weekString) {
  // weekString = "2025-W49"
  const [year, week] = weekString.split('-W').map(Number);
  // Calcule le lundi de la semaine ISO en utilisant UTC pour éviter les décalages.
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay(); // 0 (dimanche) -> 6 (samedi)
  const monday = new Date(simple);
  const diff = dow <= 4 ? dow - 1 : dow - 8; // ISO : semaine commence lundi
  monday.setUTCDate(simple.getUTCDate() - diff);

  const days = [...Array(7)].map((_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d;
  });

  return {
    monday,
    sunday: days[6],
    days,
  };
}
