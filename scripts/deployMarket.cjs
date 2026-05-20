#!/usr/bin/env node
'use strict';

const { ethers } = require('ethers');
const fs   = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const NETWORK = process.argv[2] || 'mainnet';

const RPC_URLS = {
  mainnet:   'https://forno.celo.org',
  alfajores: process.env.ALFAJORES_URL || 'https://alfajores-forno.celo-testnet.org',
};

async function main() {
  const rpcUrl = RPC_URLS[NETWORK];
  if (!rpcUrl) throw new Error(`Unknown network: ${NETWORK}. Use "mainnet" or "alfajores".`);

  const artifactPath = path.join(
    __dirname, '../artifacts/contracts/PredictionMarket.sol/PredictionMarket.json'
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey || (rawKey.length !== 64 && rawKey.length !== 66)) {
    throw new Error('PRIVATE_KEY missing or invalid length in .env');
  }
  const privateKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet   = new ethers.Wallet(privateKey, provider);
  const network  = await provider.getNetwork();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Network  : Celo ${NETWORK} (chainId ${network.chainId})`);
  console.log(`RPC      : ${rpcUrl}`);
  console.log(`Deployer : ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance  : ${ethers.formatEther(balance)} CELO`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (balance === 0n) {
    throw new Error('Deployer has 0 CELO — fund the wallet before deploying.');
  }

  if (balance < ethers.parseEther('0.01')) {
    console.warn('⚠  Low balance — deployment may fail if gas cost exceeds balance.');
  }

  // Use 1.25× the current base fee as maxFeePerGas to stay within budget
  // Ethers' default is 2× which inflates the balance check
  const feeData   = await provider.getFeeData();
  const baseFee   = feeData.gasPrice || ethers.parseUnits('200', 'gwei');
  const maxFee    = (baseFee * 125n) / 100n;
  const priority  = ethers.parseUnits('2.5', 'gwei');

  console.log(`Gas       : maxFeePerGas ${ethers.formatUnits(maxFee, 'gwei')} Gwei`);

  console.log('\nDeploying PredictionMarket…');
  const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy({
    maxFeePerGas:      maxFee,
    maxPriorityFeePerGas: priority,
  });

  console.log(`Tx hash  : ${contract.deploymentTransaction()?.hash}`);
  console.log('Waiting for confirmation…');

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log('\n✓ PredictionMarket deployed!');
  console.log(`Address  : ${address}`);
  console.log('\nAdd this to your .env:');
  console.log(`VITE_PREDICTION_MARKET_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error('\n✗ Deployment failed:', err.message);
  process.exit(1);
});
