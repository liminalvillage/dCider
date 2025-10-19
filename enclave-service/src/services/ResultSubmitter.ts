/**
 * ResultSubmitter Service
 *
 * Submits enclave attestations to VotePowerVerifier contract
 * Handles transaction signing and submission
 */

import { ethers } from 'ethers';

export interface SubmissionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  gasUsed?: bigint;
}

export interface AttestationData {
  resultHash: string;
  topicId: number;
  blockNumber: number;
  signatures: string[];
  nonce: number;
  addresses: string[];
  powers: number[];
}

export interface ResultSubmitterConfig {
  rpcUrl: string;
  votePowerVerifierAddress: string;
  operatorPrivateKey: string;
}

/**
 * ResultSubmitter service for submitting attestations to blockchain
 */
export class ResultSubmitter {
  private provider: ethers.Provider;
  private signer: ethers.Wallet;
  private votePowerVerifier: ethers.Contract;

  // VotePowerVerifier ABI (submitAttestation function only)
  private static readonly ABI = [
    'function submitAttestation((bytes32 resultHash, uint256 topicId, uint256 blockNumber, bytes[] signatures, uint256 nonce) attestation, address[] addresses, uint256[] powers) external',
    'event AttestationAccepted(bytes32 indexed resultHash, uint256 timestamp)',
    'event AttestationRejected(bytes32 indexed resultHash, string reason)',
  ];

  constructor(config: ResultSubmitterConfig) {
    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

    // Initialize signer
    this.signer = new ethers.Wallet(config.operatorPrivateKey, this.provider);

    // Initialize contract
    this.votePowerVerifier = new ethers.Contract(
      config.votePowerVerifierAddress,
      ResultSubmitter.ABI,
      this.signer
    );

    console.log('[ResultSubmitter] Initialized');
    console.log(`  RPC: ${config.rpcUrl}`);
    console.log(`  Contract: ${config.votePowerVerifierAddress}`);
    console.log(`  Operator: ${this.signer.address}`);
  }

  /**
   * Submit attestation to VotePowerVerifier contract
   *
   * @param attestation Attestation data with signatures
   * @returns Submission result
   */
  async submitAttestation(attestation: AttestationData): Promise<SubmissionResult> {
    try {
      console.log('[ResultSubmitter] Submitting attestation...');
      console.log(`  Topic: ${attestation.topicId}`);
      console.log(`  Result Hash: ${attestation.resultHash}`);
      console.log(`  Signatures: ${attestation.signatures.length}`);
      console.log(`  Addresses: ${attestation.addresses.length}`);

      // Prepare attestation struct
      const attestationStruct = {
        resultHash: attestation.resultHash,
        topicId: attestation.topicId,
        blockNumber: attestation.blockNumber,
        signatures: attestation.signatures,
        nonce: attestation.nonce,
      };

      // Estimate gas
      const gasEstimate = await this.votePowerVerifier.submitAttestation.estimateGas(
        attestationStruct,
        attestation.addresses,
        attestation.powers
      );

      console.log(`  Estimated Gas: ${gasEstimate.toString()}`);

      // Submit transaction
      const tx = await this.votePowerVerifier.submitAttestation(
        attestationStruct,
        attestation.addresses,
        attestation.powers,
        {
          gasLimit: gasEstimate * 120n / 100n, // Add 20% buffer
        }
      );

      console.log(`  Transaction Hash: ${tx.hash}`);
      console.log('  Waiting for confirmation...');

      // Wait for confirmation
      const receipt = await tx.wait();

      console.log(`  Confirmed in block ${receipt.blockNumber}`);
      console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);

      // Check if attestation was accepted or rejected
      const acceptedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = this.votePowerVerifier.interface.parseLog(log);
          return parsed?.name === 'AttestationAccepted';
        } catch {
          return false;
        }
      });

      const rejectedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = this.votePowerVerifier.interface.parseLog(log);
          return parsed?.name === 'AttestationRejected';
        } catch {
          return false;
        }
      });

      if (rejectedEvent) {
        const parsed = this.votePowerVerifier.interface.parseLog(rejectedEvent);
        const reason = parsed?.args?.reason || 'Unknown reason';
        console.error(`  ❌ Attestation REJECTED: ${reason}`);

        return {
          success: false,
          transactionHash: tx.hash,
          error: `Attestation rejected: ${reason}`,
          gasUsed: receipt.gasUsed,
        };
      }

      if (acceptedEvent) {
        console.log('  ✓ Attestation ACCEPTED');
      }

      return {
        success: true,
        transactionHash: tx.hash,
        gasUsed: receipt.gasUsed,
      };
    } catch (error: any) {
      console.error('[ResultSubmitter] Submission failed:', error.message);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get current nonce for attestation submission
   * Uses block timestamp + random to ensure uniqueness
   *
   * @returns Nonce value
   */
  async generateNonce(): Promise<number> {
    const blockNumber = await this.provider.getBlockNumber();
    const block = await this.provider.getBlock(blockNumber);
    const timestamp = block?.timestamp || Math.floor(Date.now() / 1000);

    // Combine timestamp with random value for uniqueness
    const randomPart = Math.floor(Math.random() * 1000000);
    const nonce = timestamp * 1000000 + randomPart;

    return nonce;
  }

  /**
   * Get operator address
   */
  getOperatorAddress(): string {
    return this.signer.address;
  }

  /**
   * Check if operator has sufficient balance for gas
   *
   * @param minBalance Minimum balance required in wei
   * @returns Whether operator has sufficient balance
   */
  async checkBalance(minBalance: bigint = ethers.parseEther('0.01')): Promise<boolean> {
    const balance = await this.provider.getBalance(this.signer.address);

    console.log(`[ResultSubmitter] Operator balance: ${ethers.formatEther(balance)} ETH`);

    if (balance < minBalance) {
      console.warn(
        `  ⚠️  Low balance! Required: ${ethers.formatEther(minBalance)} ETH`
      );
      return false;
    }

    return true;
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    const feeData = await this.provider.getFeeData();
    return feeData.gasPrice || 0n;
  }
}

/**
 * Factory function to create ResultSubmitter
 */
export function createResultSubmitter(config: ResultSubmitterConfig): ResultSubmitter {
  return new ResultSubmitter(config);
}
