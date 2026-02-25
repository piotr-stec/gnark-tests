import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: false,
    },
  },
  networks: {
    hardhat: {
      hardfork: "cancun",
      allowUnlimitedContractSize: true,
      blockGasLimit: 1000000000,
      gas: 1000000000,
      gasPrice: "auto",
      allowBlocksWithSameTimestamp: true,
    },
  },
};

export default config;
