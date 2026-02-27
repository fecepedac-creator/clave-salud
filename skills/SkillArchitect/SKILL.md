---
name: "SkillArchitect"
description: "Meta-Skill to orchestrate the creation of high-quality, secure, and standardized Skills and Rules for Clave Salud."
---

# SkillArchitect: The Meta-Skill

This skill is responsible for the lifecycle of other skills and rules within the Clave Salud ecosystem. It ensures that every new capability added to the agent is robust, documented, and follows the project's core principles.

## Workflow for Creating a New Skill

1. **Identify the Need**: Define the specific capability or expertise required (e.g., "Radiology Auditor", "Billing Specialist").
2. **Setup Directory Structure**:
   - Create `skills/[SkillName]/`
   - Create `skills/[SkillName]/SKILL.md`
   - Create `skills/[SkillName]/scripts/` (if tools are needed)
3. **Draft the SKILL.md**:
   - Must include YAML frontmatter with `name` and `description`.
   - Must have a "Security & Privacy" section (Mandatory for medical data).
   - Must define clear "Instructions" and "Tool Usage".
4. **Draft Supporting Rules**:
   - Create a corresponding rule in `.agent/rules/[skill_name]_usage.md` to define *when* the agent should activate this skill.
5. **Validation**:
   - Verify that the skill is correctly formatted and that all scripts are executable.

## Mandatory Sections for All Skills

- **Security & Privacy**: How this skill handles sensitive patient data (HIPAA/GDPR compliance).
- **Architecture Integrity**: How this skill respects the modular structure of Clave Salud.
- **Verification Plan**: How to test that the skill is performing as expected.

## Usage
Activate this Meta-Skill whenever the user says: "Create a new skill", "Add a new capability", or "I want the agent to learn X".
