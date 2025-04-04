/**
 * Get the start and end dates of the week containing the given date
 */
export function getWeekRange(date: Date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

/**
 * Get the start and end dates of the quarter containing the given date
 */
export function getQuarterRange(date: Date) {
  const start = new Date(date);
  const quarter = Math.floor(start.getMonth() / 3);
  
  start.setMonth(quarter * 3, 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 3, 0);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

/**
 * Calculate the total workload for a given date range
 */
export function calculateWorkload(workloads: Array<{ workload: number }>) {
  return workloads.reduce((total, current) => total + current.workload, 0);
}