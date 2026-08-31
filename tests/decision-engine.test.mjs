import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarios } from '../scenarios.mjs';
import {
  evaluatePlan,
  compressDecisionFrontier,
  createAuthorityEnvelope,
  authorityAllows,
  chooseAuthorizedRepair,
} from '../decision-engine.mjs';

for (const scenario of Object.values(scenarios)) {
  test(`${scenario.id}: compresses to three human trade-offs`, () => {
    const result = compressDecisionFrontier(scenario.candidates, scenario.goal.constraints);
    assert.equal(result.originalGoalFeasible, false);
    assert.equal(result.frontier.length, 3);
    assert.equal(result.rejected, scenario.candidates.length - 3);
    for (const plan of result.frontier) {
      const check = evaluatePlan(plan, scenario.goal.constraints);
      assert.equal(check.failed.length, 1);
      assert.equal(check.failed[0].relaxable, true);
    }
  });
}
for (const scenario of Object.values(scenarios)) {
  test(`${scenario.id}: authority permits only bounded repairs`, () => {
    const authorityConfig = scenario.authorityByPlan[scenario.recommendedPlanId];
    const envelope = createAuthorityEnvelope(scenario.goal.constraints, authorityConfig);
    const choice = chooseAuthorizedRepair(scenario.repairCandidates, envelope);
    assert.ok(choice.selected, 'expected one authorized repair');
    assert.equal(authorityAllows(choice.selected, envelope), true);

    const rejected = choice.evaluated.filter(item => !item.fullPass);
    assert.ok(rejected.length >= 1, 'expected at least one repair outside authority');
    for (const item of rejected) {
      assert.equal(authorityAllows(item.plan, envelope), false);
    }
  });
}

test('non-relaxable outcome failures never enter the decision frontier', () => {
  for (const scenario of Object.values(scenarios)) {
    const result = compressDecisionFrontier(scenario.candidates, scenario.goal.constraints);
    for (const plan of result.frontier) {
      const check = evaluatePlan(plan, scenario.goal.constraints);
      assert.equal(check.failed.some(c => c.relaxable === false), false);
    }
  }
});
