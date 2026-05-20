# Celo Onboarding Agent

A React + Vite app for onboarding new Celo users with a friendly assistant flow and an on-chain onboarding badge contract.

## Features

- Create a new Celo-compatible wallet
- Import an existing wallet with a recovery phrase
- Backup and confirm the mnemonic phrase
- On-chain onboarding contract integration
- Browser wallet connect and badge registration

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open the local URL shown by Vite.

## Deploying the smart contract

1. Copy `.env.example` to `.env` and fill in your values.
2. Run a local network if desired:
   ```bash
   npx hardhat node
   ```
3. Deploy the contract locally:
   ```bash
   npm run deploy:local
   ```
4. After deployment, set `VITE_ONBOARDING_CONTRACT_ADDRESS` in `.env`.

## Celo deployment

1. Configure `ALFAJORES_URL` and `PRIVATE_KEY` in `.env`.
2. Deploy to Alfajores:
   ```bash
   npm run deploy:alfajores
   ```

## Notes

- Wallet data is stored locally in `localStorage` for this prototype.
- The onboarding badge contract is implemented in `contracts/OnboardingBadge.sol`.
- The frontend contract helper is in `src/lib/contract.ts`.
- Replace the contract address in `.env` after deployment to enable on-chain badge claims.
# Predict-Win
