/**
 * ChainListener Service
 *
 * Listens for delegation/revocation events from DelegationManager contract
 * Triggers voting power recomputation when delegation state changes
 */

import { ethers } from 'ethers';
import { EventEmitter } from 'events';

export interface DelegationEvent {
  type: 'Delegated' | 'Revoked' | 'DeadEndDeclared' | 'DeadEndRevoked';
  delegator: string;
  delegate?: string;
  topicId: number;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
}

export interface ChainListenerConfig {
  rpcUrl: string;
  delegationManagerAddress: string;
  startBlock?: number;
  pollInterval?: number;
}

/**
 * ChainListener service for monitoring delegation events
 */
export class ChainListener extends EventEmitter {
  private provider: ethers.Provider;
  private delegationManager: ethers.Contract;
  private isListening: boolean = false;
  private pollInterval: number;
  private lastProcessedBlock: number;

  // DelegationManager ABI (events only)
  private static readonly ABI = [
    'event Delegated(address indexed delegator, address indexed delegate, uint256 indexed topicId, uint256 timestamp)',
    'event Revoked(address indexed delegator, uint256 indexed topicId, uint256 timestamp)',
    'event DeadEndDeclared(address indexed delegate, uint256 indexed topicId, uint256 timestamp)',
    'event DeadEndRevoked(address indexed delegate, uint256 indexed topicId, uint256 timestamp)',
  ];

  constructor(config: ChainListenerConfig) {
    super();

    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

    // Initialize contract interface
    this.delegationManager = new ethers.Contract(
      config.delegationManagerAddress,
      ChainListener.ABI,
      this.provider
    );

    this.pollInterval = config.pollInterval || 5000; // 5 seconds default
    this.lastProcessedBlock = config.startBlock || 0;

    console.log('[ChainListener] Initialized');
    console.log(`  RPC: ${config.rpcUrl}`);
    console.log(`  Contract: ${config.delegationManagerAddress}`);
    console.log(`  Poll Interval: ${this.pollInterval}ms`);
  }

  /**
   * Start listening for events
   */
  async start(): Promise<void> {
    if (this.isListening) {
      console.warn('[ChainListener] Already listening');
      return;
    }

    this.isListening = true;

    // Get current block if not set
    if (this.lastProcessedBlock === 0) {
      this.lastProcessedBlock = await this.provider.getBlockNumber();
      console.log(`[ChainListener] Starting from block ${this.lastProcessedBlock}`);
    }

    // Set up event listeners
    this._setupEventListeners();

    console.log('[ChainListener] Started listening for events');
  }

  /**
   * Stop listening for events
   */
  stop(): void {
    if (!this.isListening) {
      return;
    }

    this.isListening = false;
    this.delegationManager.removeAllListeners();

    console.log('[ChainListener] Stopped listening');
  }

  /**
   * Get last processed block number
   */
  getLastProcessedBlock(): number {
    return this.lastProcessedBlock;
  }

  /**
   * Setup event listeners for all delegation events
   */
  private _setupEventListeners(): void {
    // Delegated event
    this.delegationManager.on(
      'Delegated',
      async (delegator: string, delegate: string, topicId: bigint, timestamp: bigint, event: any) => {
        const delegationEvent: DelegationEvent = {
          type: 'Delegated',
          delegator,
          delegate,
          topicId: Number(topicId),
          timestamp: Number(timestamp),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };

        console.log('[ChainListener] Delegated:', {
          delegator,
          delegate,
          topicId: delegationEvent.topicId,
        });

        this.emit('delegation-event', delegationEvent);
        this.lastProcessedBlock = event.log.blockNumber;
      }
    );

    // Revoked event
    this.delegationManager.on(
      'Revoked',
      async (delegator: string, topicId: bigint, timestamp: bigint, event: any) => {
        const delegationEvent: DelegationEvent = {
          type: 'Revoked',
          delegator,
          topicId: Number(topicId),
          timestamp: Number(timestamp),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };

        console.log('[ChainListener] Revoked:', {
          delegator,
          topicId: delegationEvent.topicId,
        });

        this.emit('delegation-event', delegationEvent);
        this.lastProcessedBlock = event.log.blockNumber;
      }
    );

    // DeadEndDeclared event
    this.delegationManager.on(
      'DeadEndDeclared',
      async (delegate: string, topicId: bigint, timestamp: bigint, event: any) => {
        const delegationEvent: DelegationEvent = {
          type: 'DeadEndDeclared',
          delegator: delegate, // Use delegator field for consistency
          topicId: Number(topicId),
          timestamp: Number(timestamp),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };

        console.log('[ChainListener] DeadEndDeclared:', {
          delegate,
          topicId: delegationEvent.topicId,
        });

        this.emit('delegation-event', delegationEvent);
        this.lastProcessedBlock = event.log.blockNumber;
      }
    );

    // DeadEndRevoked event
    this.delegationManager.on(
      'DeadEndRevoked',
      async (delegate: string, topicId: bigint, timestamp: bigint, event: any) => {
        const delegationEvent: DelegationEvent = {
          type: 'DeadEndRevoked',
          delegator: delegate, // Use delegator field for consistency
          topicId: Number(topicId),
          timestamp: Number(timestamp),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };

        console.log('[ChainListener] DeadEndRevoked:', {
          delegate,
          topicId: delegationEvent.topicId,
        });

        this.emit('delegation-event', delegationEvent);
        this.lastProcessedBlock = event.log.blockNumber;
      }
    );
  }

  /**
   * Fetch historical events for a topic
   *
   * @param topicId Topic ID to fetch events for
   * @param fromBlock Starting block number
   * @param toBlock Ending block number (default: latest)
   * @returns Array of delegation events
   */
  async fetchHistoricalEvents(
    topicId: number,
    fromBlock: number,
    toBlock?: number
  ): Promise<DelegationEvent[]> {
    const events: DelegationEvent[] = [];

    const currentBlock = toBlock || (await this.provider.getBlockNumber());

    console.log(
      `[ChainListener] Fetching historical events for topic ${topicId} from block ${fromBlock} to ${currentBlock}`
    );

    // Fetch Delegated events
    const delegatedFilter = this.delegationManager.filters.Delegated(null, null, topicId);
    const delegatedEvents = await this.delegationManager.queryFilter(
      delegatedFilter,
      fromBlock,
      currentBlock
    );

    for (const event of delegatedEvents) {
      const args = event.args;
      if (args) {
        events.push({
          type: 'Delegated',
          delegator: args[0],
          delegate: args[1],
          topicId: Number(args[2]),
          timestamp: Number(args[3]),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
        });
      }
    }

    // Fetch Revoked events
    const revokedFilter = this.delegationManager.filters.Revoked(null, topicId);
    const revokedEvents = await this.delegationManager.queryFilter(
      revokedFilter,
      fromBlock,
      currentBlock
    );

    for (const event of revokedEvents) {
      const args = event.args;
      if (args) {
        events.push({
          type: 'Revoked',
          delegator: args[0],
          topicId: Number(args[1]),
          timestamp: Number(args[2]),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
        });
      }
    }

    // Sort by block number and transaction index
    events.sort((a, b) => a.blockNumber - b.blockNumber);

    console.log(`[ChainListener] Found ${events.length} historical events`);

    return events;
  }
}

/**
 * Factory function to create ChainListener
 */
export function createChainListener(config: ChainListenerConfig): ChainListener {
  return new ChainListener(config);
}
