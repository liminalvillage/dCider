// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title AttestationLib
 * @notice Library for enclave attestation validation utilities
 * @dev Handles M-of-N signature verification and attestation processing
 */
library AttestationLib {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Errors ============

    error InvalidSignatureLength();
    error SignatureVerificationFailed();
    error InvalidSignatureS();

    // ============ Functions ============

    /**
     * @notice Recover signer address from result hash and signature
     * @dev Uses ECDSA recovery with EIP-191 eth_sign prefix
     * @param resultHash Hash of computation result
     * @param signature ECDSA signature bytes
     * @return signer Recovered address
     */
    function recoverSigner(bytes32 resultHash, bytes memory signature)
        internal
        pure
        returns (address signer)
    {
        // Create eth_sign message hash
        bytes32 ethSignedMessageHash = resultHash.toEthSignedMessageHash();

        // Recover address from signature
        signer = ethSignedMessageHash.recover(signature);

        if (signer == address(0)) {
            revert SignatureVerificationFailed();
        }

        return signer;
    }

    /**
     * @notice Verify that signature is from an authorized operator
     * @dev Recovers signer and checks against operator set
     * @param resultHash Hash of computation result
     * @param signature ECDSA signature
     * @param authorizedOperators Array of authorized operator addresses
     * @return valid True if signature is from authorized operator
     * @return operator Address of the operator who signed
     */
    function verifyOperatorSignature(
        bytes32 resultHash,
        bytes memory signature,
        address[] memory authorizedOperators
    ) internal pure returns (bool valid, address operator) {
        operator = recoverSigner(resultHash, signature);

        // Check if operator is in authorized list
        valid = false;
        for (uint256 i = 0; i < authorizedOperators.length; i++) {
            if (authorizedOperators[i] == operator) {
                valid = true;
                break;
            }
        }

        return (valid, operator);
    }

    /**
     * @notice Verify M-of-N signatures from operator set
     * @dev Checks that at least M distinct authorized operators signed
     * @param resultHash Hash being attested to
     * @param signatures Array of signatures
     * @param authorizedOperators Array of authorized operator addresses
     * @param requiredSignatures M value (minimum signatures needed)
     * @return valid True if M valid signatures from distinct operators
     * @return signers Array of recovered signer addresses
     */
    function verifyMultiSignature(
        bytes32 resultHash,
        bytes[] memory signatures,
        address[] memory authorizedOperators,
        uint256 requiredSignatures
    ) internal pure returns (bool valid, address[] memory signers) {
        uint256 signatureCount = signatures.length;

        // Early return if not enough signatures provided
        if (signatureCount < requiredSignatures) {
            return (false, new address[](0));
        }

        signers = new address[](signatureCount);
        uint256 validSignatures = 0;

        // Track seen operators to prevent duplicates
        address[] memory tempSeen = new address[](signatureCount);

        for (uint256 i = 0; i < signatureCount; i++) {
            (bool isValid, address operator) = verifyOperatorSignature(
                resultHash,
                signatures[i],
                authorizedOperators
            );

            if (!isValid) {
                continue;
            }

            // Check for duplicate operator
            bool isDuplicate = false;
            for (uint256 j = 0; j < validSignatures; j++) {
                if (tempSeen[j] == operator) {
                    isDuplicate = true;
                    break;
                }
            }

            if (isDuplicate) {
                continue;
            }

            signers[validSignatures] = operator;
            tempSeen[validSignatures] = operator;
            validSignatures++;

            // Early exit if we have enough valid signatures
            if (validSignatures >= requiredSignatures) {
                break;
            }
        }

        // Resize signers array to actual count
        assembly {
            mstore(signers, validSignatures)
        }

        valid = validSignatures >= requiredSignatures;
        return (valid, signers);
    }

    /**
     * @notice Calculate result hash for voting power mapping
     * @dev Standard hash format: keccak256(abi.encode(addresses, powers))
     * @param addresses Array of addresses with voting power
     * @param powers Array of corresponding voting power values
     * @return resultHash Computed hash
     */
    function calculateResultHash(
        address[] memory addresses,
        uint256[] memory powers
    ) internal pure returns (bytes32 resultHash) {
        require(addresses.length == powers.length, "Array length mismatch");

        resultHash = keccak256(abi.encode(addresses, powers));
        return resultHash;
    }

    /**
     * @notice Verify block freshness (not too old)
     * @dev Checks that attestation block is within acceptable range
     * @param attestationBlock Block number from attestation
     * @param currentBlock Current block number
     * @param maxAge Maximum acceptable block age
     * @return fresh True if block is fresh enough
     */
    function verifyBlockFreshness(
        uint256 attestationBlock,
        uint256 currentBlock,
        uint256 maxAge
    ) internal pure returns (bool fresh) {
        // Block number must not be in the future
        if (attestationBlock > currentBlock) {
            return false;
        }

        // Block must be within maxAge blocks of current
        uint256 age = currentBlock - attestationBlock;
        fresh = age <= maxAge;

        return fresh;
    }

    /**
     * @notice Generate attestation commitment hash
     * @dev Includes nonce and other params to prevent replay
     * @param resultHash Hash of voting power result
     * @param topicId Topic ID
     * @param blockNumber Block number of attestation
     * @param nonce Unique nonce
     * @return commitment Attestation commitment hash
     */
    function generateAttestationCommitment(
        bytes32 resultHash,
        uint256 topicId,
        uint256 blockNumber,
        uint256 nonce
    ) internal pure returns (bytes32 commitment) {
        commitment = keccak256(
            abi.encodePacked(resultHash, topicId, blockNumber, nonce)
        );
        return commitment;
    }
}
