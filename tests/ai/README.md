AI Advisor tests (no network, no database: an in-memory fake Supabase).

From the repo root:

    REPO=$PWD node --experimental-strip-types --import ./tests/ai/register.mjs tests/ai/agent.test.mts
    REPO=$PWD node --experimental-strip-types --import ./tests/ai/register.mjs tests/ai/providers.test.mts
