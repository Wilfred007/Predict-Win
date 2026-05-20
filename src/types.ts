// ── Onboarding ────────────────────────────────────────
export type OnboardingStep =
  | 'welcome'
  | 'create'
  | 'import'
  | 'backup'
  | 'confirm'
  | 'dashboard';

export interface WalletInfo {
  address: string;
  mnemonic: string;
}

export interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
}

// ── Navigation ────────────────────────────────────────
export type Page = 'markets' | 'market-detail' | 'my-bets' | 'onboarding';

// ── Prediction Market ─────────────────────────────────
export enum Outcome {
  None = 0,
  Home = 1,
  Draw = 2,
  Away = 3,
}

export const OutcomeLabel: Record<Outcome, string> = {
  [Outcome.None]: '—',
  [Outcome.Home]: 'Home Win',
  [Outcome.Draw]: 'Draw',
  [Outcome.Away]: 'Away Win',
};

export interface Market {
  id: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoff: number;      // unix seconds
  resolved: boolean;
  result: Outcome;
  totalPool: bigint;
  homePool: bigint;
  drawPool: bigint;
  awayPool: bigint;
}

export interface UserBet {
  marketId: number;
  outcome: Outcome;
  amount: bigint;
  claimed: boolean;
}

// ── Agent ─────────────────────────────────────────────
export interface AgentContext {
  page: Page;
  market?: Market;
  isAdmin: boolean;
  onboardingStep?: OnboardingStep;
}

export interface AgentResponse {
  text: string;
  resolveMarket?: {
    marketId: number;
    outcome: Outcome;
  };
}
