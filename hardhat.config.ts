import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import dotenv from 'dotenv';

dotenv.config();

const config: HardhatUserConfig = {
  solidity: '0.8.20',
  networks: {
    alfajores: {
      url: process.env.ALFAJORES_URL || '',
      accounts: process.env.PRIVATE_KEY && (process.env.PRIVATE_KEY.length === 64 || process.env.PRIVATE_KEY.length === 66)
        ? [process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`]
        : [],
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
  },
};

export default config;
