export function getTripReadiness(trip) {
  const result = {
    gear:{total:0,ready:0,pending:0,rental:0,skipped:0},
    checks:{total:0,ready:0,pending:0,skipped:0},
    pendingGear:[],rentals:[],checksToDo:[],
  };
  for (const item of trip?.items || []) {
    const check=item.category==='出发检查';
    const summary=check ? result.checks : result.gear;
    if (item.status==='skip') {
      summary.skipped++;
      continue;
    }
    summary.total++;
    if (item.status==='packed' || item.status==='wearing') {
      summary.ready++;
    } else if (check) {
      summary.pending++;
      result.checksToDo.push(item);
    } else if (item.status==='rental') {
      summary.rental++;
      result.rentals.push(item);
    } else {
      summary.pending++;
      if (item.status==='pending') result.pendingGear.push(item);
    }
  }
  return result;
}
