# Virtual Office V2 - Agent Humanity

**Date:** 2026-03-30
**Status:** Planning

## Executive Summary

The virtual office agents are functional but feel robotic. This plan transforms them into living characters through facial expressions, synchronized task-driven state machines, and a fully animated office environment.

## Current State Assessment

### Already Built

| Feature | File | Status |
|---------|------|--------|
| Agent face with blinking | AgentModel.tsx:142-229 | Working |
| Typing arms animation | AgentModel.tsx:98-140 | Working |
| Error shake | AgentModel.tsx:296-299 | Working |
| Walking with bob | AgentModel.tsx:257-264 | Working |
| Idle patrol paths | AgentModel.tsx:265-284 | Working |
| ActiveRunRing (pulsing green) | AgentModel.tsx:70-87 | Working |
| Plants (5 corners) | ModernOfficeFurniture.tsx:268-290, 375-379 | Working |
| Window wall | ModernOfficeFurniture.tsx:238-266 | Working |
| Whiteboard + markers | ModernOfficeFurniture.tsx:295-314 | Working |
| Pinboard + notes | ModernOfficeFurniture.tsx:316-334 | Working |
| Posters | ModernOfficeFurniture.tsx:336-352 | Working |
| AmbientParticles | AmbientParticles.tsx | Working |
| Monitor glow animation | ModernOfficeFurniture.tsx:45-52, 83-86 | Working |
| Coffee mug on desk | ModernOfficeFurniture.tsx:124-132 | Working |

### Missing Features

| Priority | Feature | Impact |
|----------|---------|--------|
| P0.1 | Face expressions (smile/frown per state) | Personality |
| P0.1 | Walking arm swing | Realism |
| P0.1 | Name badge on agent | Identification |
| P0.2 | Walking patrol paths (30s idle trigger) | Autonomy feel |
| P0.3 | Real-time clock on wall | Life |
| P0.3 | Whiteboard animated diagrams | Activity |
| P1.1 | Role accessories (headphones/tablet/coffee) | Variety |
| P1.2 | Monitor content UV scroll animation | Active work |
| P1.3 | Error/away state animations (frown, zzz) | Personality |
| P2.1 | Auto-orbit after 10s inactivity | Cinematics |
| P2.1 | Task completion celebration camera | Feedback |
| P2.2 | Isometric overview mode toggle | UX |

