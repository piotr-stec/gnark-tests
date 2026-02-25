import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import fs from "fs/promises";
import path from "path";

describe("ProofConsumer (Wrapper)", function () {
  async function deployContracts() {
    const [owner, user1, user2] = await hre.ethers.getSigners();

    // Deploy Verifier first
    const Verifier = await hre.ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy({ gasLimit: 900000000 });

    // Deploy ProofConsumer wrapper
    const ProofConsumer = await hre.ethers.getContractFactory("ProofConsumer");
    const proofConsumer = await ProofConsumer.deploy(verifier.target);

    return { verifier, proofConsumer, owner, user1, user2 };
  }

  async function loadProofData() {
    // Read proof from JSON file
    const proofData = JSON.parse(
      await fs.readFile(
        path.resolve(__dirname, "../proof_solidity.json"),
        "utf-8"
      )
    );

    const proof = proofData.proof.map((x: string) => BigInt(x));
    const commitments: [bigint, bigint] = [
      BigInt(proofData.commitments[0]),
      BigInt(proofData.commitments[1])
    ];
    const commitmentPok: [bigint, bigint] = [
      BigInt(proofData.commitmentPok[0]),
      BigInt(proofData.commitmentPok[1])
    ];

    // Read public witness from JSON file
    const witnessData = JSON.parse(
      await fs.readFile(
        path.resolve(__dirname, "../witness_solidity.json"),
        "utf-8"
      )
    );
    
    const input = witnessData.map((x: string) => BigInt(x));

    return { proof, commitments, commitmentPok, input };
  }

  describe("Deployment", function () {
    it("Should deploy ProofConsumer with correct verifier", async function () {
      const { verifier, proofConsumer } = await loadFixture(deployContracts);
      
      expect(await proofConsumer.verifier()).to.equal(verifier.target);
    });
  });

  describe("Proof Submission", function () {
    it("Should accept valid proof and record it", async function () {
      const { proofConsumer, user1 } = await loadFixture(deployContracts);
      const { proof, commitments, commitmentPok, input } = await loadProofData();

      console.log("\n📊 Submitting proof through wrapper...");

      // Estimate gas
      const estimatedGas = await proofConsumer.submitProof.estimateGas(
        proof,
        commitments,
        commitmentPok,
        input
      );

      console.log("\n⛽ Gas Estimation:");
      console.log("- Estimated gas:", estimatedGas.toString());
      console.log("- Estimated gas (formatted):", Number(estimatedGas).toLocaleString());

      // Submit proof
      const tx = await proofConsumer.connect(user1).submitProof(
        proof,
        commitments,
        commitmentPok,
        input
      );

      const receipt = await tx.wait();

      console.log("\n🔥 Actual Gas Used:");
      console.log("- Gas used:", receipt?.gasUsed.toString());
      console.log("- Gas used (formatted):", Number(receipt?.gasUsed).toLocaleString());
      console.log("- Transaction hash:", receipt?.hash);

      // Calculate proof hash
      const proofHash = hre.ethers.keccak256(
        hre.ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint256[8]", "uint256[2]", "uint256[2]"],
          [proof, commitments, commitmentPok]
        )
      );

      // Verify proof was marked as used
      expect(await proofConsumer.isProofUsed(proofHash)).to.be.true;

      // Check event was emitted
      await expect(tx)
        .to.emit(proofConsumer, "ProofVerified")
        .withArgs(proofHash, user1.address, await hre.ethers.provider.getBlock("latest").then(b => b?.timestamp));

      console.log("\n✅ Proof verified and recorded successfully!");
    });

    it("Should reject already used proof (replay protection)", async function () {
      const { proofConsumer, user1, user2 } = await loadFixture(deployContracts);
      const { proof, commitments, commitmentPok, input } = await loadProofData();

      console.log("\n🔒 Testing replay protection...");

      // Submit proof first time
      await proofConsumer.connect(user1).submitProof(
        proof,
        commitments,
        commitmentPok,
        input
      );

      console.log("✓ First submission successful");

      // Try to submit same proof again (should fail)
      await expect(
        proofConsumer.connect(user2).submitProof(
          proof,
          commitments,
          commitmentPok,
          input
        )
      ).to.be.revertedWith("Proof already used");

      console.log("✓ Second submission rejected (replay protection works!)");
    });
  });

  describe("Gas Comparison", function () {
    it("Should compare gas costs: direct call vs wrapper", async function () {
      const { verifier, proofConsumer, user1 } = await loadFixture(deployContracts);
      const { proof, commitments, commitmentPok, input } = await loadProofData();

      console.log("\n📊 Gas Cost Comparison:");
      console.log("=" .repeat(60));

      // 1. Direct verifyProof (view function - off-chain estimation)
      const directGas = await verifier.verifyProof.estimateGas(
        proof,
        commitments,
        commitmentPok,
        input
      );

      console.log("\n1️⃣  Direct verifyProof() call:");
      console.log("   Gas:", Number(directGas).toLocaleString());
      console.log("   Note: View function, no state change");

      // 2. Wrapper submitProof (actual transaction)
      const wrapperGas = await proofConsumer.submitProof.estimateGas(
        proof,
        commitments,
        commitmentPok,
        input
      );

      console.log("\n2️⃣  Wrapper submitProof() transaction:");
      console.log("   Gas:", Number(wrapperGas).toLocaleString());
      console.log("   Includes: verification + state change + event");

      // Calculate overhead
      const overhead = Number(wrapperGas) - Number(directGas);
      const overheadPercent = ((overhead / Number(directGas)) * 100).toFixed(2);

      console.log("\n📈 Overhead Analysis:");
      console.log("   Additional gas:", overhead.toLocaleString());
      console.log("   Overhead:", overheadPercent + "%");
      console.log("   Breakdown:");
      console.log("   - Storage (mapping write): ~20,000 gas");
      console.log("   - Event emission: ~1,500-3,000 gas");
      console.log("   - Additional logic: ~" + (overhead - 23000).toLocaleString() + " gas");

      console.log("\n" + "=".repeat(60));
    });
  });
});
