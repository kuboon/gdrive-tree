---
name: gist-skills
description: How to save & load skills from my gist
---

# metadata file

Each skill directory should have `.<skill-name>.SKILL.md` that will contain
matadata.

```
<skill-description>

updated_at: YYYY-MM-DD HH:MM +09:00
[gist](<gist-url>)
```

# List skills

`gh gist list --filter "SKILL.md <other queries>"`

# Load skill

- get gist-id by "List skills"
- get contents by `gh gist view <gist-id>`
- save them to `<workdir-root>/.claude/skills/<skill-name>/*`

# Save or update

- if metadata file is not exist or no gist-url saved:
  - `gh gist create SKILL.md -p -d "<skill-name>/SKILL.md <tag> <tag> <tag>"`
  - create mtadata file with gist-url

- `gh gist edit <gist-id> "<update-filename>"`
