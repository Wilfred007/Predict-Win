import hre from 'hardhat';

async function main() {
  console.log('Deploying PredictionMarket to', hre.network.name, '...');

  const PredictionMarket = await hre.ethers.getContractFactory('PredictionMarket');
  const contract = await PredictionMarket.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log('PredictionMarket deployed to:', address);
  console.log('');
  console.log('Add to your .env file:');
  console.log(`VITE_PREDICTION_MARKET_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
