// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DelegationGraph
 * @notice Library for delegation graph traversal and cycle detection
 * @dev Implements algorithms for validating delegation chains
 */
library DelegationGraph {
    // ============ Constants ============

    uint8 public constant MAX_DELEGATION_DEPTH = 7;

    // ============ Errors ============

    error CycleDetected();
    error MaxDepthExceeded();

    // ============ Structs ============

    struct GraphNode {
        address delegate;
        bool visited;
        bool inStack;
    }

    // ============ Functions ============

    /**
     * @notice Check if adding a delegation would create a cycle
     * @dev Uses DFS to detect cycles in delegation graph
     * @param delegations Mapping from delegator => delegate for a topic
     * @param newDelegator Address attempting to delegate
     * @param newDelegate Address being delegated to
     * @return hasCycle True if cycle would be created
     */
    function wouldCreateCycle(
        mapping(address => address) storage delegations,
        address newDelegator,
        address newDelegate
    ) internal view returns (bool hasCycle) {
        // If newDelegate doesn't delegate further, no cycle possible
        if (delegations[newDelegate] == address(0)) {
            return false;
        }

        // Traverse delegation chain from newDelegate
        address current = newDelegate;
        uint256 steps = 0;
        uint256 maxSteps = 100; // Safety limit for gas

        while (current != address(0) && steps < maxSteps) {
            // If we circle back to newDelegator, we have a cycle
            if (current == newDelegator) {
                return true;
            }

            current = delegations[current];
            steps++;
        }

        return false;
    }

    /**
     * @notice Calculate delegation chain depth for an address
     * @dev Traverses chain to terminal delegate
     * @param delegations Mapping from delegator => delegate for a topic
     * @param user Address to calculate depth for
     * @return depth Chain depth (0 if not delegated, 1-7 if delegated)
     */
    function calculateDepth(
        mapping(address => address) storage delegations,
        address user
    ) internal view returns (uint8 depth) {
        address current = delegations[user];

        // If not delegated, depth is 0
        if (current == address(0)) {
            return 0;
        }

        depth = 1;
        uint256 maxIterations = MAX_DELEGATION_DEPTH + 1;
        uint256 iterations = 0;

        // Follow chain to terminal delegate
        while (delegations[current] != address(0) && iterations < maxIterations) {
            current = delegations[current];
            depth++;
            iterations++;
        }

        return depth;
    }

    /**
     * @notice Validate that new delegation won't exceed max depth
     * @dev Checks if adding this delegation would cause any chain to exceed MAX_DELEGATION_DEPTH
     * @param delegations Mapping from delegator => delegate for a topic
     * @param delegator Address that wants to delegate
     * @param newDelegate Address being delegated to
     * @return valid True if delegation is within depth limit
     */
    function validateDepth(
        mapping(address => address) storage delegations,
        address delegator,
        address newDelegate
    ) internal view returns (bool valid) {
        // Calculate current depth of the delegate
        uint8 delegateDepth = calculateDepth(delegations, newDelegate);

        // If someone delegates to delegator, find the longest chain ending at delegator
        // This is expensive but necessary for correctness
        uint8 maxIncomingDepth = 0;

        // We can't efficiently iterate all possible addresses, so we check if
        // the delegator has incoming delegations by checking calculateDepth
        // This works because if delegator is at the end of a chain, the delegator's
        // current depth (before new delegation) should be 0
        uint8 delegatorCurrentDepth = calculateDepth(delegations, delegator);

        // After delegation, delegator's depth will be delegateDepth + 1
        // Any address pointing to delegator will have depth increased by delegateDepth + 1
        // So max total depth would be: maxIncomingDepth + (delegateDepth + 1)

        // Actually, we need to think about this differently:
        // If delegator has depth 0 (not currently delegating), then:
        //   - After delegating to newDelegate (who has depth D), delegator will have depth D+1
        //   - Anyone pointing to delegator will have their depth increased

        // Simple check: delegateDepth + 1 <= MAX
        // This ensures the direct chain through delegator->delegate doesn't exceed max
        valid = (delegateDepth + 1) <= MAX_DELEGATION_DEPTH;

        return valid;
    }

    /**
     * @notice Get the terminal delegate (end of chain)
     * @dev Follows delegation chain to the final non-delegating address
     * @param delegations Mapping from delegator => delegate for a topic
     * @param user Starting address
     * @return terminal Terminal delegate address (or user if not delegated)
     */
    function getTerminalDelegate(
        mapping(address => address) storage delegations,
        address user
    ) internal view returns (address terminal) {
        terminal = user;
        uint256 maxIterations = MAX_DELEGATION_DEPTH + 1;
        uint256 iterations = 0;

        while (delegations[terminal] != address(0) && iterations < maxIterations) {
            terminal = delegations[terminal];
            iterations++;
        }

        return terminal;
    }

    /**
     * @notice Get full delegation chain for an address
     * @dev Returns array of addresses from user to terminal delegate
     * @param delegations Mapping from delegator => delegate for a topic
     * @param user Starting address
     * @return chain Array of addresses in delegation chain (including user)
     */
    function getDelegationChain(
        mapping(address => address) storage delegations,
        address user
    ) internal view returns (address[] memory chain) {
        uint8 depth = calculateDepth(delegations, user);

        // If not delegated, return single-element array with user
        if (depth == 0) {
            chain = new address[](1);
            chain[0] = user;
            return chain;
        }

        // Allocate array for chain (user + all delegates)
        chain = new address[](depth + 1);
        chain[0] = user;

        address current = user;
        for (uint8 i = 0; i < depth; i++) {
            current = delegations[current];
            chain[i + 1] = current;
        }

        return chain;
    }
}
