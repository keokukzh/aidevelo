# Track Spec: Optimize User Onboarding & First-Task Success Flow

## Overview
This track focuses on streamlining the initial user experience for Aidevelo. The goal is to ensure a new user can go from a fresh installation to seeing their first autonomous AI CEO complete a task within 5 minutes ("5-Minute Magic").

## Objectives
- Simplify the onboarding wizard to be more intuitive and focused on immediate success.
- Automate or guide the initial agent configuration (CEO agent) to reduce friction.
- Ensure clear, real-time feedback during the first agent heartbeat and task execution.
- Validate that the default "local trusted" mode is seamless for new users.

## Scope
- **Onboarding Wizard:** Review and refine `ui/src/components/OnboardingWizard.tsx` and related components.
- **Agent Configuration:** Optimize the default configuration for the CEO agent in `server/src/onboarding-assets/`.
- **First Task Execution:** Ensure the default task assigned to the CEO is simple, verifiable, and fast.
- **Feedback Loops:** Enhance the real-time activity stream in the UI to clearly show the CEO's initial actions.

## Success Criteria
- A user can complete the onboarding wizard in under 2 minutes.
- The first CEO agent starts its heartbeat and completes its first task within 3 minutes of finishing onboarding.
- All core setup steps are verified by automated tests with >80% coverage.
