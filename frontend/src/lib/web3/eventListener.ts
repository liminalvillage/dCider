/**
 * Event Listener Service
 *
 * Listens for contract events and updates UI state
 */

import { ethers } from 'ethers';
import { writable, type Writable } from 'svelte/store';
import { DelegationManagerABI, TopicRegistryABI, VotePowerVerifierABI } from '../contracts/abis';

export interface DelegationEvent {
  type: 'Delegated' | 'Revoked' | 'DeadEndDeclared' | 'DeadEndRevoked';
  delegator: string;
  delegate?: string;
  topicId: number;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
}

export interface TopicEvent {
  type: 'TopicCreated' | 'TopicUpdated';
  topicId: number;
  name?: string;
  admin?: string;
  blockNumber: number;
  transactionHash: string;
}

export interface VotingPowerEvent {
  type: 'VotingPowerUpdated' | 'AttestationAccepted';
  topicId?: number;
  attestationHash?: string;
  resultHash?: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
}

// Event stores
export const delegationEvents: Writable<DelegationEvent[]> = writable([]);
export const topicEvents: Writable<TopicEvent[]> = writable([]);
export const votingPowerEvents: Writable<VotingPowerEvent[]> = writable([]);

/**
 * Event listener manager
 */
export class EventListenerService {
  private provider: ethers.Provider;
  private delegationManager: ethers.Contract | null = null;
  private topicRegistry: ethers.Contract | null = null;
  private votePowerVerifier: ethers.Contract | null = null;
  private isListening = false;

  constructor(provider: ethers.Provider) {
    this.provider = provider;
  }

  /**
   * Initialize contracts and start listening
   */
  startListening(addresses: {
    delegationManager: string;
    topicRegistry: string;
    votePowerVerifier: string;
  }): void {
    if (this.isListening) {
      console.warn('[EventListener] Already listening');
      return;
    }

    // Initialize contracts
    this.delegationManager = new ethers.Contract(
      addresses.delegationManager,
      DelegationManagerABI,
      this.provider
    );

    this.topicRegistry = new ethers.Contract(
      addresses.topicRegistry,
      TopicRegistryABI,
      this.provider
    );

    this.votePowerVerifier = new ethers.Contract(
      addresses.votePowerVerifier,
      VotePowerVerifierABI,
      this.provider
    );

    // Set up listeners
    this._setupDelegationListeners();
    this._setupTopicListeners();
    this._setupVotingPowerListeners();

    this.isListening = true;
    console.log('[EventListener] Started listening for events');
  }

  /**
   * Stop listening to events
   */
  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    this.delegationManager?.removeAllListeners();
    this.topicRegistry?.removeAllListeners();
    this.votePowerVerifier?.removeAllListeners();

    this.isListening = false;
    console.log('[EventListener] Stopped listening');
  }

  /**
   * Setup delegation event listeners
   */
  private _setupDelegationListeners(): void {
    if (!this.delegationManager) return;

    // Delegated event
    this.delegationManager.on(
      'Delegated',
      (delegator: string, delegate: string, topicId: bigint, timestamp: bigint, event: any) => {
        const delegationEvent: DelegationEvent = {
          type: 'Delegated',
          delegator,
          delegate,
          topicId: Number(topicId),
          timestamp: Number(timestamp),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };

        delegationEvents.update((events) => [delegationEvent, ...events]);
        console.log('[EventListener] Delegated:', delegationEvent);
      }
    );

    // Revoked event
    this.delegationManager.on(
      'Revoked',
      (delegator: string, topicId: bigint, timestamp: bigint, event: any) => {
        const delegationEvent: DelegationEvent = {
          type: 'Revoked',
          delegator,
          topicId: Number(topicId),
          timestamp: Number(timestamp),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };

        delegationEvents.update((events) => [delegationEvent, ...events]);
        console.log('[EventListener] Revoked:', delegationEvent);
      }
    );

    // DeadEndDeclared event
    this.delegationManager.on(
      'DeadEndDeclared',
      (delegate: string, topicId: bigint, timestamp: bigint, event: any) => {
        const delegationEvent: DelegationEvent = {
          type: 'DeadEndDeclared',
          delegator: delegate,
          topicId: Number(topicId),
          timestamp: Number(timestamp),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };

        delegationEvents.update((events) => [delegationEvent, ...events]);
        console.log('[EventListener] DeadEndDeclared:', delegationEvent);
      }
    );

    // DeadEndRevoked event
    this.delegationManager.on(
      'DeadEndRevoked',
      (delegate: string, topicId: bigint, timestamp: bigint, event: any) => {
        const delegationEvent: DelegationEvent = {
          type: 'DeadEndRevoked',
          delegator: delegate,
          topicId: Number(topicId),
          timestamp: Number(timestamp),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };

        delegationEvents.update((events) => [delegationEvent, ...events]);
        console.log('[EventListener] DeadEndRevoked:', delegationEvent);
      }
    );
  }

  /**
   * Setup topic event listeners
   */
  private _setupTopicListeners(): void {
    if (!this.topicRegistry) return;

    // TopicCreated event
    this.topicRegistry.on(
      'TopicCreated',
      (topicId: bigint, name: string, admin: string, event: any) => {
        const topicEvent: TopicEvent = {
          type: 'TopicCreated',
          topicId: Number(topicId),
          name,
          admin,
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };

        topicEvents.update((events) => [topicEvent, ...events]);
        console.log('[EventListener] TopicCreated:', topicEvent);
      }
    );
  }

  /**
   * Setup voting power event listeners
   */
  private _setupVotingPowerListeners(): void {
    if (!this.votePowerVerifier) return;

    // VotingPowerUpdated event
    this.votePowerVerifier.on(
      'VotingPowerUpdated',
      (topicId: bigint, attestationHash: string, timestamp: bigint, event: any) => {
        const vpEvent: VotingPowerEvent = {
          type: 'VotingPowerUpdated',
          topicId: Number(topicId),
          attestationHash,
          timestamp: Number(timestamp),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };

        votingPowerEvents.update((events) => [vpEvent, ...events]);
        console.log('[EventListener] VotingPowerUpdated:', vpEvent);
      }
    );

    // AttestationAccepted event
    this.votePowerVerifier.on(
      'AttestationAccepted',
      (resultHash: string, timestamp: bigint, event: any) => {
        const vpEvent: VotingPowerEvent = {
          type: 'AttestationAccepted',
          resultHash,
          timestamp: Number(timestamp),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };

        votingPowerEvents.update((events) => [vpEvent, ...events]);
        console.log('[EventListener] AttestationAccepted:', vpEvent);
      }
    );
  }

  /**
   * Fetch historical events for a topic
   */
  async fetchHistoricalDelegations(topicId: number, fromBlock = 0): Promise<DelegationEvent[]> {
    if (!this.delegationManager) {
      throw new Error('DelegationManager not initialized');
    }

    const events: DelegationEvent[] = [];

    // Fetch Delegated events
    const delegatedFilter = this.delegationManager.filters.Delegated(null, null, topicId);
    const delegatedEvents = await this.delegationManager.queryFilter(delegatedFilter, fromBlock);

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
    const revokedEvents = await this.delegationManager.queryFilter(revokedFilter, fromBlock);

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

    // Sort by block number
    events.sort((a, b) => a.blockNumber - b.blockNumber);

    return events;
  }
}

/**
 * Create singleton event listener instance
 */
let eventListenerInstance: EventListenerService | null = null;

export function getEventListener(provider: ethers.Provider): EventListenerService {
  if (!eventListenerInstance) {
    eventListenerInstance = new EventListenerService(provider);
  }
  return eventListenerInstance;
}
