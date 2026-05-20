import type { AgentContext, AgentResponse, ChatMessage, OnboardingStep, Outcome } from '../types';

const ONBOARDING_SYSTEM_PROMPT = `You are a friendly Celo blockchain onboarding assistant embedded in a wallet setup app. Help users:
- Create or import a Celo wallet
- Understand and safely store their 12-word recovery phrase
- Navigate the backup and confirmation steps
- Claim their on-chain onboarding badge after setup

Keep answers to 2–3 sentences, beginner-friendly. Never ask users to share their private key or recovery phrase with you. If asked about unrelated topics, gently redirect to the onboarding flow. Do not give financial or investment advice.`;

const PREDICTION_MARKET_SYSTEM_PROMPT = `You are a football prediction market assistant for a Celo blockchain app called Celo Predict.

Your roles:
- Help users understand how prediction markets work (stake CELO on Home / Draw / Away, winners share the pool)
- Explain implied odds: each outcome's pool share as a percentage of the total
- Explain the 5% platform fee: winners share 95% of the total pool proportionally
- Provide football analysis: team form, head-to-head records, injury news (based on your training knowledge)
- Guide new users through connecting their wallet and placing bets

Keep answers to 2–4 sentences. Do not give financial advice. If asked about crypto basics, recommend the Onboarding section.`;

const ADMIN_RESOLVE_ADDENDUM = `

You are in ADMIN mode for the following market:
{MARKET_CONTEXT}

You can resolve this market using the resolve_market tool. IMPORTANT rules:
1. Only call resolve_market when the admin explicitly states the final match result AND confirms they want to resolve it.
2. Before calling the tool, always ask for confirmation: "You want to resolve [HomeTeam] vs [AwayTeam] as [outcome]. Type 'confirm' to proceed."
3. Only fire the tool after the user says "confirm", "yes", or "proceed".
4. Map results to outcomes: if HomeTeam won → Home, if AwayTeam won → Away, if it ended level → Draw.`;

const RESOLVE_MARKET_TOOL = {
  type: 'function',
  function: {
    name: 'resolve_market',
    description:
      'Resolve a football prediction market with the final match result. Only call this after the admin has confirmed they want to resolve the market.',
    parameters: {
      type: 'object',
      properties: {
        marketId: {
          type: 'number',
          description: 'The numeric ID of the market to resolve',
        },
        outcome: {
          type: 'string',
          enum: ['Home', 'Draw', 'Away'],
          description: 'The final result: Home (home team won), Draw, or Away (away team won)',
        },
      },
      required: ['marketId', 'outcome'],
    },
  },
};

function buildSystemPrompt(context: AgentContext): string {
  if (context.page === 'onboarding') {
    return `${ONBOARDING_SYSTEM_PROMPT}\n\nUser is currently on the "${context.onboardingStep}" step.`;
  }

  let prompt = PREDICTION_MARKET_SYSTEM_PROMPT;

  if (context.market) {
    const m = context.market;
    const now = Math.floor(Date.now() / 1000);
    const status = m.resolved ? 'Resolved' : now < m.kickoff ? 'Upcoming' : 'Live/In Progress';
    const kickoffStr = new Date(m.kickoff * 1000).toUTCString();

    prompt += `\n\nCurrent market: ID ${m.id} | ${m.homeTeam} vs ${m.awayTeam} (${m.league}) | Kickoff: ${kickoffStr} | Status: ${status}`;

    if (context.isAdmin && !m.resolved) {
      const marketContext = `ID ${m.id}: ${m.homeTeam} (Home) vs ${m.awayTeam} (Away), ${m.league}, kickoff ${kickoffStr}`;
      prompt += ADMIN_RESOLVE_ADDENDUM.replace('{MARKET_CONTEXT}', marketContext);
    }
  }

  return prompt;
}

export function getWelcomeAssistantMessage(): string {
  return "Hi there! I'm your friendly Celo onboarding assistant. I can help you create a wallet, import an existing one, and keep your recovery phrase safe.";
}

export async function getAgentResponse(
  history: ChatMessage[],
  userMessage: string,
  context: AgentContext,
): Promise<AgentResponse> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) return { text: 'No API key configured. Please add VITE_GROQ_API_KEY to your .env file.' };

  const useTools = context.isAdmin && !!context.market && !context.market.resolved;
  const model = useTools ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';

  const messages = [
    { role: 'system' as const, content: buildSystemPrompt(context) },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.text })),
    { role: 'user' as const, content: userMessage },
  ];

  const body: Record<string, unknown> = { model, max_tokens: 512, messages };
  if (useTools) {
    body.tools = [RESOLVE_MARKET_TOOL];
    body.tool_choice = 'auto';
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  const choice = data.choices[0];

  if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length > 0) {
    const toolCall = choice.message.tool_calls[0];
    const args = JSON.parse(toolCall.function.arguments) as { marketId: number; outcome: string };
    const outcomeMap: Record<string, Outcome> = { Home: 1, Draw: 2, Away: 3 };
    return {
      text: `Resolving market #${args.marketId} as **${args.outcome}**. Sending transaction…`,
      resolveMarket: {
        marketId: args.marketId,
        outcome: outcomeMap[args.outcome],
      },
    };
  }

  return { text: choice.message.content as string };
}

// Backward-compatible shim for OnboardingPage
export async function getAssistantMessage(
  history: ChatMessage[],
  userMessage: string,
  step: OnboardingStep,
): Promise<string> {
  const response = await getAgentResponse(history, userMessage, {
    page: 'onboarding',
    isAdmin: false,
    onboardingStep: step,
  });
  return response.text;
}
