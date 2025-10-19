/**
 * Delegation Graph Data Service
 *
 * Fetches and structures delegation data for graph visualization
 */

import type { Signer } from 'ethers';
import { getDelegation, getTopicDelegators, getTerminalDelegate } from '../contracts/delegationManager';

export interface GraphNode {
  id: string;           // Address
  address: string;      // Full address
  label: string;        // Shortened address for display
  votingPower: number;  // Accumulated voting power
  isTerminal: boolean;  // Is this a terminal delegate?
  isUser: boolean;      // Is this the connected user?
  isDelegating: boolean; // Has this address delegated?
  isDeadEnd: boolean;   // Has declared as dead-end
}

export interface GraphEdge {
  source: string;       // Delegator address
  target: string;       // Delegate address
  topicId: number;      // Topic ID
  timestamp: number;    // Delegation timestamp
}

export interface DelegationGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  topicId: number;
  userAddress: string | null;
  terminalDelegates: Map<string, number>; // address => voting power
}

/**
 * Shorten an Ethereum address for display
 */
function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Fetch complete delegation graph for a topic
 */
export async function fetchDelegationGraph(
  signer: Signer | null,
  chainId: number,
  topicId: number,
  userAddress: string | null
): Promise<DelegationGraphData> {
  if (!signer) {
    return {
      nodes: [],
      edges: [],
      topicId,
      userAddress,
      terminalDelegates: new Map()
    };
  }

  try {
    // Get all delegators for this topic
    const delegators = await getTopicDelegators(signer, chainId, topicId);
    console.log(`[GraphData] Topic ${topicId}: Found ${delegators.length} delegators`, delegators);

    const nodesMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const terminalDelegates = new Map<string, number>();

    // Process each delegator
    for (const delegator of delegators) {
      // Get delegation info
      const delegation = await getDelegation(signer, chainId, delegator, topicId);

      // Skip if no active delegation
      if (!delegation || delegation.delegate === '0x0000000000000000000000000000000000000000') {
        continue;
      }

      // Get terminal delegate
      const terminal = await getTerminalDelegate(signer, chainId, delegator, topicId);

      // Add/update delegator node
      if (!nodesMap.has(delegator)) {
        nodesMap.set(delegator, {
          id: delegator,
          address: delegator,
          label: shortenAddress(delegator),
          votingPower: 0,
          isTerminal: terminal === delegator,
          isUser: userAddress ? delegator.toLowerCase() === userAddress.toLowerCase() : false,
          isDelegating: delegation.delegate !== '0x0000000000000000000000000000000000000000',
          isDeadEnd: false // TODO: Add dead-end check
        });
      }

      // Add/update delegate node
      if (!nodesMap.has(delegation.delegate)) {
        const isTerminalDelegate = terminal === delegation.delegate;
        nodesMap.set(delegation.delegate, {
          id: delegation.delegate,
          address: delegation.delegate,
          label: shortenAddress(delegation.delegate),
          votingPower: 0,
          isTerminal: isTerminalDelegate,
          isUser: userAddress ? delegation.delegate.toLowerCase() === userAddress.toLowerCase() : false,
          isDelegating: false, // Will be updated if they delegate
          isDeadEnd: false
        });
      }

      // Update delegate node's isDelegating status
      const delegateNode = nodesMap.get(delegation.delegate)!;
      const delegateInfo = await getDelegation(signer, chainId, delegation.delegate, topicId);
      if (delegateInfo && delegateInfo.delegate !== '0x0000000000000000000000000000000000000000') {
        delegateNode.isDelegating = true;
      }

      // Add edge
      edges.push({
        source: delegator,
        target: delegation.delegate,
        topicId,
        timestamp: Number(delegation.timestamp)
      });

      // Count voting power for terminal delegates
      if (terminal && terminal !== '0x0000000000000000000000000000000000000000') {
        const currentPower = terminalDelegates.get(terminal) || 0;
        terminalDelegates.set(terminal, currentPower + 1);
      }
    }

    // Update voting power in nodes
    for (const [address, power] of terminalDelegates.entries()) {
      const node = nodesMap.get(address);
      if (node) {
        node.votingPower = power;
        node.isTerminal = true;
      }
    }

    // Convert nodes map to array
    const nodes = Array.from(nodesMap.values());

    // Sort nodes by voting power (descending)
    nodes.sort((a, b) => b.votingPower - a.votingPower);

    return {
      nodes,
      edges,
      topicId,
      userAddress,
      terminalDelegates
    };

  } catch (error) {
    console.error('[GraphData] Error fetching delegation graph:', error);
    return {
      nodes: [],
      edges: [],
      topicId,
      userAddress,
      terminalDelegates: new Map()
    };
  }
}



/**
 * Find the delegation path from a user to their terminal delegate
 */
export function traceDelegationPath(
  graphData: DelegationGraphData,
  startAddress: string
): string[] {
  const path: string[] = [startAddress];
  const visited = new Set<string>();

  let current = startAddress;
  visited.add(current);

  // Follow edges until we reach a terminal delegate
  while (true) {
    const edge = graphData.edges.find(e =>
      e.source.toLowerCase() === current.toLowerCase()
    );

    if (!edge) {
      // No outgoing edge, current is terminal
      break;
    }

    const next = edge.target;

    // Prevent cycles
    if (visited.has(next.toLowerCase())) {
      console.warn('Cycle detected in delegation path');
      break;
    }

    path.push(next);
    visited.add(next.toLowerCase());
    current = next;

    // Safety limit
    if (path.length > 10) {
      console.warn('Delegation path too long, stopping');
      break;
    }
  }

  return path;
}

/**
 * Get statistics about the delegation graph
 */
export function getGraphStats(graphData: DelegationGraphData) {
  const totalVoters = graphData.nodes.length;
  const terminalDelegates = graphData.nodes.filter(n => n.isTerminal && n.votingPower > 0);
  const delegating = graphData.nodes.filter(n => n.isDelegating);
  const notDelegating = totalVoters - delegating.length;

  const maxPower = Math.max(...terminalDelegates.map(n => n.votingPower), 0);
  const avgPower = terminalDelegates.length > 0
    ? terminalDelegates.reduce((sum, n) => sum + n.votingPower, 0) / terminalDelegates.length
    : 0;

  const maxChainLength = Math.max(
    ...graphData.nodes.map(n => {
      const path = traceDelegationPath(graphData, n.address);
      return path.length;
    }),
    1
  );

  return {
    totalVoters,
    terminalDelegateCount: terminalDelegates.length,
    delegatingCount: delegating.length,
    notDelegatingCount: notDelegating,
    maxVotingPower: maxPower,
    avgVotingPower: avgPower,
    maxChainLength,
    delegationEdges: graphData.edges.length
  };
}
