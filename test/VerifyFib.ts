import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import fs from "fs/promises";
import path from "path";

describe("Verifier", function () {
  async function deployVerifier() {
    const [owner, otherAccount] = await hre.ethers.getSigners();

    const Verifier = await hre.ethers.getContractFactory("VerifierFibonacci");
    const verifier = await Verifier.deploy({ gasLimit: 900000000 });

    return { verifier, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should deploy the Verifier contract successfully", async function () {
      const { verifier } = await loadFixture(deployVerifier);
      
      expect(verifier.target).to.be.properAddress;
    });
  });

  describe("Verification", function () {
    it("Should verify proof correctly", async function () {
      const { verifier } = await loadFixture(deployVerifier);

      // Read proof from JSON file
      const proofData = JSON.parse(
        await fs.readFile(
          path.resolve(__dirname, "../proof_solidity_fibo.json"),
          "utf-8"
        )
      );

      console.log("Proof data loaded");

      // Extract proof components
      const proof = proofData.proof.map((x: string) => BigInt(x));
      // Read public witness from JSON file
      const witnessData = JSON.parse(
        await fs.readFile(
          path.resolve(__dirname, "../witness_solidity_fibo.json"),
          "utf-8"
        )
      );
      
      const input = witnessData.map((x: string) => BigInt(x));

      console.log("\nParsed data:");
      console.log("- Proof elements:", proof.length);
      console.log("- Input elements:", input.length);

      // Estimate gas for verifyProof
      const estimatedGas = await verifier.verifyProof.estimateGas(
        proof,
        input
      );

      console.log("\n⛽ Gas estimation:");
      console.log("- Estimated gas:", estimatedGas.toString());
      console.log("- Estimated gas (formatted):", Number(estimatedGas).toLocaleString());

      // Verify the proof
      await verifier.verifyProof(proof, input);
      console.log("\n✓ Proof verified successfully!");
    });
  });
});
