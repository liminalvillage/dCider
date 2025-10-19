/**
 * T046: Enclave service test for GraphComputer
 * Tests voting power computation logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildDelegationGraph,
  findTerminalDelegate,
  calculateVotingPower,
  detectCycles,
  validateGraph,
  getDelegationChain,
  type DelegationEdge,
  type DelegationGraph,
  type VotingPowerResult
} from '../src/lib/graph-algorithms';

describe('GraphComputer - Voting Power Calculation', () => {
  describe('buildDelegationGraph', () => {
    it('should build empty graph from no edges', () => {
      const edges: DelegationEdge[] = [];
      const graph = buildDelegationGraph(edges);

      expect(graph.delegations.size).toBe(0);
    });

    it('should build simple graph from single edge', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'bob' }
      ];

      const graph = buildDelegationGraph(edges);

      expect(graph.delegations.get('alice')).toBe('bob');
    });

    it('should build graph with multiple edges', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'charlie' },
        { from: 'bob', to: 'charlie' },
        { from: 'charlie', to: 'dave' }
      ];

      const graph = buildDelegationGraph(edges);

      expect(graph.delegations.get('alice')).toBe('charlie');
      expect(graph.delegations.get('bob')).toBe('charlie');
      expect(graph.delegations.get('charlie')).toBe('dave');
    });
  });

  describe('findTerminalDelegate', () => {
    it('should return self if no delegation', () => {
      const graph = buildDelegationGraph([]);
      const terminal = findTerminalDelegate(graph, 'alice');

      expect(terminal).toBe('alice');
    });

    it('should follow single delegation', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'bob' }
      ];
      const graph = buildDelegationGraph(edges);
      const terminal = findTerminalDelegate(graph, 'alice');

      expect(terminal).toBe('bob');
    });

    it('should follow delegation chain', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'bob' },
        { from: 'bob', to: 'charlie' },
        { from: 'charlie', to: 'dave' }
      ];
      const graph = buildDelegationGraph(edges);
      const terminal = findTerminalDelegate(graph, 'alice');

      expect(terminal).toBe('dave');
    });

    it('should detect cycle and throw error', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'bob' },
        { from: 'bob', to: 'alice' }
      ];
      const graph = buildDelegationGraph(edges);

      expect(() => findTerminalDelegate(graph, 'alice')).toThrow('Cycle detected');
    });

    it('should handle max depth gracefully', () => {
      // Create chain of depth 7
      const edges: DelegationEdge[] = [];
      const users = ['u0', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'];

      for (let i = 0; i < 7; i++) {
        edges.push({ from: users[i], to: users[i + 1] });
      }

      const graph = buildDelegationGraph(edges);
      const terminal = findTerminalDelegate(graph, 'u0');

      expect(terminal).toBe('u7');
    });
  });

  describe('calculateVotingPower', () => {
    it('should calculate power when no delegations', () => {
      const graph = buildDelegationGraph([]);
      const allVoters = new Set(['alice', 'bob', 'charlie']);
      const results = calculateVotingPower(graph, allVoters);

      expect(results).toHaveLength(3);
      expect(results.find(r => r.address === 'alice')?.power).toBe(1);
      expect(results.find(r => r.address === 'bob')?.power).toBe(1);
      expect(results.find(r => r.address === 'charlie')?.power).toBe(1);
    });

    it('should aggregate power to terminal delegate', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'charlie' },
        { from: 'bob', to: 'charlie' }
      ];

      const graph = buildDelegationGraph(edges);
      const allVoters = new Set(['alice', 'bob', 'charlie']);
      const results = calculateVotingPower(graph, allVoters);

      // Charlie should have power of 3 (alice + bob + himself)
      const charliePower = results.find(r => r.address === 'charlie');
      expect(charliePower?.power).toBe(3);

      // Alice and Bob should not appear in results (delegated)
      expect(results.find(r => r.address === 'alice')).toBeUndefined();
      expect(results.find(r => r.address === 'bob')).toBeUndefined();
    });

    it('should handle transitive delegation chains', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'bob' },
        { from: 'bob', to: 'charlie' }
      ];

      const graph = buildDelegationGraph(edges);
      const allVoters = new Set(['alice', 'bob', 'charlie']);
      const results = calculateVotingPower(graph, allVoters);

      // Charlie should have power of 3
      const charliePower = results.find(r => r.address === 'charlie');
      expect(charliePower?.power).toBe(3);

      expect(results).toHaveLength(1);
    });

    it('should handle complex multi-branch graph', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'bob' },
        { from: 'bob', to: 'charlie' },
        { from: 'dave', to: 'charlie' },
        { from: 'eve', to: 'frank' }
      ];

      const graph = buildDelegationGraph(edges);
      const allVoters = new Set(['alice', 'bob', 'charlie', 'dave', 'eve', 'frank']);
      const results = calculateVotingPower(graph, allVoters);

      // Charlie: alice -> bob -> charlie, dave -> charlie, charlie
      const charliePower = results.find(r => r.address === 'charlie');
      expect(charliePower?.power).toBe(4);

      // Frank: eve -> frank, frank
      const frankPower = results.find(r => r.address === 'frank');
      expect(frankPower?.power).toBe(2);

      expect(results).toHaveLength(2);
    });

    it('should sort results by power descending', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'charlie' },
        { from: 'bob', to: 'charlie' },
        { from: 'eve', to: 'frank' }
      ];

      const graph = buildDelegationGraph(edges);
      const allVoters = new Set(['alice', 'bob', 'charlie', 'eve', 'frank', 'dave']);
      const results = calculateVotingPower(graph, allVoters);

      // Charlie (3) should be first, Frank (2) second, Dave (1) third
      expect(results[0].address).toBe('charlie');
      expect(results[0].power).toBe(3);
      expect(results[1].address).toBe('frank');
      expect(results[1].power).toBe(2);
      expect(results[2].address).toBe('dave');
      expect(results[2].power).toBe(1);
    });
  });

  describe('detectCycles', () => {
    it('should return empty array for acyclic graph', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'bob' },
        { from: 'bob', to: 'charlie' }
      ];

      const graph = buildDelegationGraph(edges);
      const cycles = detectCycles(graph);

      expect(cycles).toHaveLength(0);
    });

    it('should detect direct cycle', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'bob' },
        { from: 'bob', to: 'alice' }
      ];

      const graph = buildDelegationGraph(edges);
      const cycles = detectCycles(graph);

      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0]).toContain('alice');
      expect(cycles[0]).toContain('bob');
    });

    it('should detect indirect cycle', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'bob' },
        { from: 'bob', to: 'charlie' },
        { from: 'charlie', to: 'alice' }
      ];

      const graph = buildDelegationGraph(edges);
      const cycles = detectCycles(graph);

      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  describe('validateGraph', () => {
    it('should validate healthy graph', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'bob' },
        { from: 'bob', to: 'charlie' }
      ];

      const graph = buildDelegationGraph(edges);
      const validation = validateGraph(graph);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect cycles as invalid', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'bob' },
        { from: 'bob', to: 'alice' }
      ];

      const graph = buildDelegationGraph(edges);
      const validation = validateGraph(graph);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('Cycle');
    });

    it('should detect excessive depth', () => {
      // Create chain of depth 8 (exceeds max of 7)
      const edges: DelegationEdge[] = [];
      const users = Array.from({ length: 9 }, (_, i) => `u${i}`);

      for (let i = 0; i < 8; i++) {
        edges.push({ from: users[i], to: users[i + 1] });
      }

      const graph = buildDelegationGraph(edges);
      const validation = validateGraph(graph);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('depth'))).toBe(true);
    });
  });

  describe('getDelegationChain', () => {
    it('should return single address if no delegation', () => {
      const graph = buildDelegationGraph([]);
      const chain = getDelegationChain(graph, 'alice');

      expect(chain).toEqual(['alice']);
    });

    it('should return full chain', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'bob' },
        { from: 'bob', to: 'charlie' },
        { from: 'charlie', to: 'dave' }
      ];

      const graph = buildDelegationGraph(edges);
      const chain = getDelegationChain(graph, 'alice');

      expect(chain).toEqual(['alice', 'bob', 'charlie', 'dave']);
    });

    it('should detect cycle in chain', () => {
      const edges: DelegationEdge[] = [
        { from: 'alice', to: 'bob' },
        { from: 'bob', to: 'alice' }
      ];

      const graph = buildDelegationGraph(edges);

      expect(() => getDelegationChain(graph, 'alice')).toThrow('Cycle');
    });
  });
});
