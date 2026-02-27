import type { Plan } from "../plans/schema";
import { parseAndValidatePlanJson } from "../plans/validate";
import type { ArchitectValidationResult } from "./types";

function hasMilestoneText(value: string | undefined) {
  if (!value) {
    return false;
  }
  return /\bmilestone\b/i.test(value);
}

export function collectMilestoneSteps(plan: Plan) {
  const output: string[] = [];
  for (const step of plan.steps) {
    if (hasMilestoneText(step.summary) || hasMilestoneText(step.details) || (step.tags || []).some((tag) => hasMilestoneText(tag))) {
      output.push(step.id);
    }
  }
  return output;
}

export function validateArchitectPlan(plan: Plan): ArchitectValidationResult {
  let schemaValid = false;
  try {
    parseAndValidatePlanJson(JSON.stringify(plan));
    schemaValid = true;
  } catch {
    schemaValid = false;
  }

  const milestoneSteps = collectMilestoneSteps(plan);
  const milestonePresent = milestoneSteps.length > 0;
  const validatorPassed = schemaValid && milestonePresent;

  return {
    plan_schema_valid: schemaValid,
    milestone_keyword_present: milestonePresent,
    milestone_steps: milestoneSteps,
    validator_passed: validatorPassed,
    retries_used: 0,
    final_pass: validatorPassed,
    message: validatorPassed
      ? "Plan passed schema and milestone validation."
      : "Plan failed schema or milestone validation.",
  };
}
