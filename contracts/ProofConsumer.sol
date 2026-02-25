// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Verifier.sol";

contract ProofConsumer {
    Verifier public verifier;
    
    // Track used proofs to prevent replay attacks
    mapping(bytes32 => bool) public usedProofs;
    
    // Events for tracking
    event ProofVerified(bytes32 indexed proofHash, address indexed submitter, uint256 timestamp);
    event ProofRejected(bytes32 indexed proofHash, address indexed submitter, string reason);
    
    constructor(address _verifier) {
        verifier = Verifier(_verifier);
    }
    
    /// @notice Submit and verify a proof, preventing replay attacks
    /// @param proof The Groth16 proof [8 elements]
    /// @param commitments The Pedersen commitments [2 elements]
    /// @param commitmentPok The proof of knowledge for commitments [2 elements]
    /// @param input The public inputs [1747 elements]
    function submitProof(
        uint256[8] calldata proof,
        uint256[2] calldata commitments,
        uint256[2] calldata commitmentPok,
        uint256[1747] calldata input
    ) external {
        // Generate unique hash for this proof
        bytes32 proofHash = keccak256(abi.encode(proof, commitments, commitmentPok));
        
        // Check if proof was already used
        require(!usedProofs[proofHash], "Proof already used");
        
        // Verify the proof (this will revert if invalid)
        verifier.verifyProof(proof, commitments, commitmentPok, input);
        
        // Mark proof as used
        usedProofs[proofHash] = true;
        
        // Emit success event
        emit ProofVerified(proofHash, msg.sender, block.timestamp);
        
        // Here you can add your business logic that depends on the proof
        // For example: mint NFT, transfer tokens, update state, etc.
    }
    
    /// @notice Check if a proof has been used
    /// @param proofHash The hash of the proof to check
    /// @return bool True if proof was already used
    function isProofUsed(bytes32 proofHash) external view returns (bool) {
        return usedProofs[proofHash];
    }
}
