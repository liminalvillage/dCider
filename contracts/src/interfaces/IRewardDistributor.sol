// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRewardDistributor
 * @notice Interface for managing Superfluid streaming rewards proportional to voting power
 * @dev Integrates with Superfluid protocol for continuous token streaming
 */
interface IRewardDistributor {
    // ============ Structs ============

    struct RewardStream {
        address delegate;
        uint256 topicId;
        int96 flowRate;
        uint256 totalStreamed;
        uint256 lastUpdated;
        bool active;
    }

    struct VotingPowerUpdate {
        address delegate;
        uint256 power;
    }

    // ============ Events ============

    event FlowCreated(
        address indexed delegate,
        uint256 indexed topicId,
        int96 flowRate
    );

    event FlowUpdated(
        address indexed delegate,
        uint256 indexed topicId,
        int96 oldFlowRate,
        int96 newFlowRate
    );

    event FlowDeleted(
        address indexed delegate,
        uint256 indexed topicId
    );

    event PoolFlowRateUpdated(
        uint256 indexed topicId,
        int96 newPoolFlowRate
    );

    // ============ Errors ============

    error UnauthorizedCaller();
    error InvalidFlowRate();
    error InsufficientPoolBalance();
    error SuperfluidOperationFailed(string reason);

    // ============ Functions ============

    /**
     * @notice Update reward flows based on new voting power distribution
     * @dev Called by VotePowerVerifier after attestation acceptance
     * @param topicId Topic ID for which voting power changed
     * @param votingPowerMapping Array of delegates and their voting powers
     * @param totalVotingPower Sum of all voting power in the topic
     */
    function updateFlows(
        uint256 topicId,
        VotingPowerUpdate[] calldata votingPowerMapping,
        uint256 totalVotingPower
    ) external;

    /**
     * @notice Get current flow rate for delegate on topic
     * @param delegate Delegate address
     * @param topicId Topic ID
     * @return flowRate Current flow rate (tokens/second)
     * @return totalStreamed Total tokens streamed to date
     * @return lastUpdated Timestamp of last update
     */
    function getFlowRate(address delegate, uint256 topicId)
        external
        view
        returns (
            int96 flowRate,
            uint256 totalStreamed,
            uint256 lastUpdated
        );

    /**
     * @notice Get reward pool configuration for topic
     * @param topicId Topic ID
     * @return poolFlowRate Total tokens/second available for distribution
     * @return totalDistributed Sum of all active delegate flow rates
     * @return remainingCapacity Unused flow rate capacity
     */
    function getPoolFlowRate(uint256 topicId)
        external
        view
        returns (
            int96 poolFlowRate,
            int96 totalDistributed,
            int96 remainingCapacity
        );

    /**
     * @notice Estimate monthly reward for given voting power
     * @param topicId Topic ID
     * @param votingPower Delegate's voting power
     * @param totalVotingPower Total voting power in topic
     * @return tokensPerMonth Estimated monthly token reward
     * @return flowRate Calculated flow rate (tokens/second)
     * @return sharePercentage Voting power as percentage of total
     */
    function estimateMonthlyReward(
        uint256 topicId,
        uint256 votingPower,
        uint256 totalVotingPower
    )
        external
        view
        returns (
            uint256 tokensPerMonth,
            int96 flowRate,
            uint256 sharePercentage
        );

    /**
     * @notice Set or update pool flow rate for topic (admin only)
     * @param topicId Topic ID
     * @param newPoolFlowRate New total flow rate for the pool
     */
    function setPoolFlowRate(uint256 topicId, int96 newPoolFlowRate) external;

    /**
     * @notice Fund reward pool with Super Tokens (admin only)
     * @param topicId Topic ID
     * @param amount Amount of Super Tokens to add
     */
    function fundPool(uint256 topicId, uint256 amount) external;
}
