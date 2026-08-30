export function checkConstraint(plan, constraint) {
  const actual = plan.metrics[constraint.field];
  if (constraint.op === 'gte') return actual >= constraint.value;
  if (constraint.op === 'lte') return actual <= constraint.value;
  if (constraint.op === 'eq') return actual === constraint.value;
  if (constraint.op === 'in') return constraint.value.includes(actual);
  throw new Error(`Unsupported operator: ${constraint.op}`);
}

export function evaluatePlan(plan, constraints) {
  const checks = Object.fromEntries(constraints.map(c => [c.id, checkConstraint(plan, c)]));
  const failed = constraints.filter(c => !checks[c.id]);
  return { plan, checks, failed, fullPass: failed.length === 0 };
}

function violationMagnitude(plan, constraint) {
  const actual = plan.metrics[constraint.field];
  const expected = constraint.value;
  if (constraint.op === 'lte') return Math.max(0, actual - expected) / Math.max(Math.abs(expected), 1);
  if (constraint.op === 'gte') return Math.max(0, expected - actual) / Math.max(Math.abs(expected), 1);
  return checkConstraint(plan, constraint) ? 0 : 1;
}
export function compressDecisionFrontier(candidatePlans, constraints) {
  const evaluated = candidatePlans.map(plan => evaluatePlan(plan, constraints));
  const feasible = evaluated.filter(x => x.fullPass);
  if (feasible.length) return { originalGoalFeasible: true, evaluated, frontier: feasible.map(x => x.plan), rejected: evaluated.length - feasible.length };

  const eligible = evaluated.filter(x => {
    const nonRelaxableFailure = x.failed.some(c => c.relaxable === false);
    const relaxableFailures = x.failed.filter(c => c.relaxable !== false);
    return !nonRelaxableFailure && relaxableFailures.length === 1;
  });

  const bestByTradeoff = new Map();
  for (const item of eligible) {
    const constraint = item.failed[0];
    const magnitude = violationMagnitude(item.plan, constraint);
    const existing = bestByTradeoff.get(constraint.id);
    if (!existing || magnitude < existing.magnitude || (magnitude === existing.magnitude && (item.plan.preference ?? 99) < (existing.item.plan.preference ?? 99))) {
      bestByTradeoff.set(constraint.id, { item, magnitude });
    }
  }
  const frontier = [...bestByTradeoff.values()].map(x => x.item.plan).sort((a,b)=>(a.preference ?? 99)-(b.preference ?? 99));
  return { originalGoalFeasible: false, evaluated, frontier, rejected: evaluated.length - frontier.length };
}
export function createAuthorityEnvelope(baseConstraints, override = {}) {
  const constraints = baseConstraints.map(c => {
    const patch = override.constraints?.[c.id];
    return patch ? { ...c, value: patch.value } : { ...c };
  });
  for (const extra of override.additionalConstraints ?? []) constraints.push({ ...extra });
  return { id: override.id, label: override.label, rationale: override.rationale, constraints };
}

export function authorityAllows(plan, envelope) {
  return evaluatePlan(plan, envelope.constraints).fullPass;
}

export function chooseAuthorizedRepair(repairCandidates, envelope) {
  const evaluated = repairCandidates.map(plan => evaluatePlan(plan, envelope.constraints));
  const allowed = evaluated.filter(x => x.fullPass).sort((a,b)=>(a.plan.preference ?? 99)-(b.plan.preference ?? 99));
  return { selected: allowed[0]?.plan ?? null, evaluated };
}

export function constraintResultForUI(plan, constraints) {
  return constraints.map(c => ({ id:c.id, label:c.label, pass:checkConstraint(plan,c), actual:plan.metrics[c.field], expected:c.value, op:c.op }));
}
