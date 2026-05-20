import hre from 'hardhat';

async function main() {
  const OnboardingBadge = await hre.ethers.getContractFactory('OnboardingBadge');
  const contract = await OnboardingBadge.deploy();
  await contract.deployed();

  console.log('OnboardingBadge deployed to:', contract.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
