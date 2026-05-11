# WooDreads

Dreadlocks artist website and Hermes AI agent configuration.

## Contents

### Website (`index.html`)
Single-page business website for WooDreads, a dreadlock artist in Rome, Italy.

- Dark theme with neon accents
- Portfolio, services, booking form
- Interactive quiz: "Che dread sei?"

### Hermes Agent (`hermes/`)
Configuration for the Hermes AI agent running locally at `~/.hermes/`.

**Aura** - Virtual assistant for Woodreads studio that manages appointments, quotes, and client communications.

| File | Description |
|------|-------------|
| `SOUL.md` | Current system prompt (Aura's "brain") |
| `config.yaml` | Hermes configuration |
| `skills/` | 25 skill categories |
| `.skills_prompt_snapshot.json` | Skills snapshot |

## Setup

### Website
Simply open `index.html` in a browser or deploy to any static hosting.

### Updating Hermes Config
```bash
# Copy latest files from ~/.hermes/
cp ~/.hermes/SOUL.md hermes/
cp ~/.hermes/config.yaml hermes/
cp -r ~/.hermes/skills/ hermes/

# Commit changes
git add -A && git commit -m "Update Hermes config"
```

## Tech

- HTML5 + CSS3 + Vanilla JS (website)
- Hermes Agent (local AI assistant)