// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../core/RewardDistributor.sol";
import "../core/VotePowerVerifier.sol";
import "../interfaces/IRewardDistributor.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title RewardDistributorTest
 * @notice Comprehensive tests for RewardDistributor contract
 */
contract RewardDistributorTest is Test {
    RewardDistributor public rewardDistributor;
    VotePowerVerifier public votePowerVerifier;
    MockSuperfluidHost public superfluidHost;
    MockSuperToken public rewardToken;

    address public admin = address(0x1);
    address public delegate1 = address(0x2);
    address public delegate2 = address(0x3);
    address public delegate3 = address(0x4);

    uint256 public constant TOPIC_ID = 1;
    int96 public constant POOL_FLOW_RATE = 1e18; // 1 token/second

    event FlowCreated(address indexed delegate, uint256 indexed topicId, int96 flowRate);
    event FlowUpdated(address indexed delegate, uint256 indexed topicId, int96 oldFlowRate, int96 newFlowRate);
    event FlowDeleted(address indexed delegate, uint256 indexed topicId);
    event PoolFlowRateUpdated(uint256 indexed topicId, int96 newPoolFlowRate);

    function setUp() public {
        vm.startPrank(admin);

        // Deploy mocks
        superfluidHost = new MockSuperfluidHost();
        rewardToken = new MockSuperToken();
        votePowerVerifier = new VotePowerVerifier();

        // Deploy RewardDistributor
        rewardDistributor = new RewardDistributor(
            address(superfluidHost),
            address(rewardToken),
            address(votePowerVerifier)
        );

        // Grant roles
        rewardDistributor.grantRole(rewardDistributor.VERIFIER_ROLE(), address(this));

        // Set pool flow rate
        rewardDistributor.setPoolFlowRate(TOPIC_ID, POOL_FLOW_RATE);

        // Fund the contract
        rewardToken.mint(address(rewardDistributor), 1000000 ether);

        vm.stopPrank();
    }

    // ============ Setup Tests ============

    function test_InitialState() public {
        assertEq(address(rewardDistributor.superfluidHost()), address(superfluidHost));
        assertEq(address(rewardDistributor.rewardToken()), address(rewardToken));
        assertEq(address(rewardDistributor.votePowerVerifier()), address(votePowerVerifier));
    }

    function test_PoolFlowRateInitialized() public {
        (int96 poolFlowRate, int96 totalDistributed, int96 remainingCapacity) =
            rewardDistributor.getPoolFlowRate(TOPIC_ID);

        assertEq(poolFlowRate, POOL_FLOW_RATE);
        assertEq(totalDistributed, 0);
        assertEq(remainingCapacity, POOL_FLOW_RATE);
    }

    // ============ UpdateFlows Tests ============

    function test_UpdateFlows_SingleDelegate() public {
        IRewardDistributor.VotingPowerUpdate[] memory updates =
            new IRewardDistributor.VotingPowerUpdate[](1);
        updates[0] = IRewardDistributor.VotingPowerUpdate({
            delegate: delegate1,
            power: 100
        });

        vm.expectEmit(true, true, false, true);
        emit FlowCreated(delegate1, TOPIC_ID, POOL_FLOW_RATE);

        rewardDistributor.updateFlows(TOPIC_ID, updates, 100);

        // Verify flow created
        (int96 flowRate, uint256 totalStreamed, uint256 lastUpdated) =
            rewardDistributor.getFlowRate(delegate1, TOPIC_ID);

        assertEq(flowRate, POOL_FLOW_RATE);
        assertEq(totalStreamed, 0);
        assertGt(lastUpdated, 0);
    }

    function test_UpdateFlows_MultipleDelegates() public {
        IRewardDistributor.VotingPowerUpdate[] memory updates =
            new IRewardDistributor.VotingPowerUpdate[](3);

        updates[0] = IRewardDistributor.VotingPowerUpdate({
            delegate: delegate1,
            power: 50  // 50%
        });
        updates[1] = IRewardDistributor.VotingPowerUpdate({
            delegate: delegate2,
            power: 30  // 30%
        });
        updates[2] = IRewardDistributor.VotingPowerUpdate({
            delegate: delegate3,
            power: 20  // 20%
        });

        rewardDistributor.updateFlows(TOPIC_ID, updates, 100);

        // Verify proportional flows
        (int96 flowRate1,,) = rewardDistributor.getFlowRate(delegate1, TOPIC_ID);
        (int96 flowRate2,,) = rewardDistributor.getFlowRate(delegate2, TOPIC_ID);
        (int96 flowRate3,,) = rewardDistributor.getFlowRate(delegate3, TOPIC_ID);

        assertEq(flowRate1, POOL_FLOW_RATE * 50 / 100);
        assertEq(flowRate2, POOL_FLOW_RATE * 30 / 100);
        assertEq(flowRate3, POOL_FLOW_RATE * 20 / 100);
    }

    function test_UpdateFlows_ProportionalDistribution() public {
        IRewardDistributor.VotingPowerUpdate[] memory updates =
            new IRewardDistributor.VotingPowerUpdate[](2);

        updates[0] = IRewardDistributor.VotingPowerUpdate({
            delegate: delegate1,
            power: 75
        });
        updates[1] = IRewardDistributor.VotingPowerUpdate({
            delegate: delegate2,
            power: 25
        });

        rewardDistributor.updateFlows(TOPIC_ID, updates, 100);

        (int96 flowRate1,,) = rewardDistributor.getFlowRate(delegate1, TOPIC_ID);
        (int96 flowRate2,,) = rewardDistributor.getFlowRate(delegate2, TOPIC_ID);

        // Should be 3:1 ratio
        assertEq(flowRate1, flowRate2 * 3);
    }

    function test_UpdateFlows_ZeroVotingPower() public {
        // First create a flow
        IRewardDistributor.VotingPowerUpdate[] memory updates1 =
            new IRewardDistributor.VotingPowerUpdate[](1);
        updates1[0] = IRewardDistributor.VotingPowerUpdate({
            delegate: delegate1,
            power: 100
        });
        rewardDistributor.updateFlows(TOPIC_ID, updates1, 100);

        // Update with zero voting power
        IRewardDistributor.VotingPowerUpdate[] memory updates2 =
            new IRewardDistributor.VotingPowerUpdate[](1);
        updates2[0] = IRewardDistributor.VotingPowerUpdate({
            delegate: delegate1,
            power: 0
        });

        vm.expectEmit(true, true, false, false);
        emit FlowDeleted(delegate1, TOPIC_ID);

        rewardDistributor.updateFlows(TOPIC_ID, updates2, 100);

        // Verify flow closed
        (int96 flowRate,,) = rewardDistributor.getFlowRate(delegate1, TOPIC_ID);
        assertEq(flowRate, 0);
    }

    function test_UpdateFlows_ChangingPower() public {
        // Initial distribution
        IRewardDistributor.VotingPowerUpdate[] memory updates1 =
            new IRewardDistributor.VotingPowerUpdate[](1);
        updates1[0] = IRewardDistributor.VotingPowerUpdate({
            delegate: delegate1,
            power: 100
        });
        rewardDistributor.updateFlows(TOPIC_ID, updates1, 100);

        (int96 initialFlowRate,,) = rewardDistributor.getFlowRate(delegate1, TOPIC_ID);

        // Change distribution
        IRewardDistributor.VotingPowerUpdate[] memory updates2 =
            new IRewardDistributor.VotingPowerUpdate[](2);
        updates2[0] = IRewardDistributor.VotingPowerUpdate({
            delegate: delegate1,
            power: 50
        });
        updates2[1] = IRewardDistributor.VotingPowerUpdate({
            delegate: delegate2,
            power: 50
        });

        vm.expectEmit(true, true, false, true);
        emit FlowUpdated(delegate1, TOPIC_ID, initialFlowRate, POOL_FLOW_RATE / 2);

        rewardDistributor.updateFlows(TOPIC_ID, updates2, 100);

        (int96 newFlowRate1,,) = rewardDistributor.getFlowRate(delegate1, TOPIC_ID);
        (int96 newFlowRate2,,) = rewardDistributor.getFlowRate(delegate2, TOPIC_ID);

        assertEq(newFlowRate1, POOL_FLOW_RATE / 2);
        assertEq(newFlowRate2, POOL_FLOW_RATE / 2);
    }

    // ============ Pool Management Tests ============

    function test_SetPoolFlowRate() public {
        int96 newFlowRate = 2e18;

        vm.prank(admin);
        vm.expectEmit(true, false, false, true);
        emit PoolFlowRateUpdated(TOPIC_ID, newFlowRate);

        rewardDistributor.setPoolFlowRate(TOPIC_ID, newFlowRate);

        (int96 poolFlowRate,,) = rewardDistributor.getPoolFlowRate(TOPIC_ID);
        assertEq(poolFlowRate, newFlowRate);
    }

    function test_SetPoolFlowRate_RevertNegative() public {
        vm.prank(admin);
        vm.expectRevert(IRewardDistributor.InvalidFlowRate.selector);
        rewardDistributor.setPoolFlowRate(TOPIC_ID, -1);
    }

    function test_SetPoolFlowRate_RequiresAdmin() public {
        vm.prank(delegate1);
        vm.expectRevert();
        rewardDistributor.setPoolFlowRate(TOPIC_ID, 2e18);
    }

    // ============ Estimation Tests ============

    function test_EstimateMonthlyReward() public {
        uint256 votingPower = 50;
        uint256 totalVotingPower = 100;

        (uint256 tokensPerMonth, int96 flowRate, uint256 sharePercentage) =
            rewardDistributor.estimateMonthlyReward(TOPIC_ID, votingPower, totalVotingPower);

        // Should be 50% of pool
        assertEq(flowRate, POOL_FLOW_RATE / 2);
        assertEq(sharePercentage, 5000); // 50% in basis points

        // Monthly = flowRate * 30 days
        uint256 expectedMonthly = uint256(uint96(flowRate)) * 30 days;
        assertEq(tokensPerMonth, expectedMonthly);
    }

    function test_EstimateMonthlyReward_ZeroPower() public {
        (uint256 tokensPerMonth, int96 flowRate, uint256 sharePercentage) =
            rewardDistributor.estimateMonthlyReward(TOPIC_ID, 0, 100);

        assertEq(tokensPerMonth, 0);
        assertEq(flowRate, 0);
        assertEq(sharePercentage, 0);
    }

    // ============ Streaming Accumulation Tests ============

    function test_StreamingAccumulation() public {
        // Create stream
        IRewardDistributor.VotingPowerUpdate[] memory updates =
            new IRewardDistributor.VotingPowerUpdate[](1);
        updates[0] = IRewardDistributor.VotingPowerUpdate({
            delegate: delegate1,
            power: 100
        });
        rewardDistributor.updateFlows(TOPIC_ID, updates, 100);

        (int96 flowRate, uint256 initialTotal, uint256 initialTime) =
            rewardDistributor.getFlowRate(delegate1, TOPIC_ID);

        // Fast forward time
        vm.warp(block.timestamp + 3600); // 1 hour

        // Check accumulated amount
        (, uint256 newTotal,) = rewardDistributor.getFlowRate(delegate1, TOPIC_ID);

        uint256 expectedAccrued = uint256(uint96(flowRate)) * 3600;
        assertEq(newTotal, initialTotal + expectedAccrued);
    }

    // ============ Access Control Tests ============

    function test_UpdateFlows_RequiresVerifierRole() public {
        IRewardDistributor.VotingPowerUpdate[] memory updates =
            new IRewardDistributor.VotingPowerUpdate[](1);
        updates[0] = IRewardDistributor.VotingPowerUpdate({
            delegate: delegate1,
            power: 100
        });

        vm.prank(delegate1);
        vm.expectRevert();
        rewardDistributor.updateFlows(TOPIC_ID, updates, 100);
    }

    // ============ Edge Cases ============

    function test_UpdateFlows_EmptyArray() public {
        IRewardDistributor.VotingPowerUpdate[] memory updates =
            new IRewardDistributor.VotingPowerUpdate[](0);

        // Should not revert
        rewardDistributor.updateFlows(TOPIC_ID, updates, 0);
    }

    function test_UpdateFlows_LargeNumberOfDelegates() public {
        uint256 numDelegates = 50;
        IRewardDistributor.VotingPowerUpdate[] memory updates =
            new IRewardDistributor.VotingPowerUpdate[](numDelegates);

        for (uint256 i = 0; i < numDelegates; i++) {
            updates[i] = IRewardDistributor.VotingPowerUpdate({
                delegate: address(uint160(i + 1000)),
                power: 2  // Equal distribution
            });
        }

        rewardDistributor.updateFlows(TOPIC_ID, updates, numDelegates * 2);

        // Verify all delegates got flows
        for (uint256 i = 0; i < numDelegates; i++) {
            (int96 flowRate,,) = rewardDistributor.getFlowRate(address(uint160(i + 1000)), TOPIC_ID);
            assertGt(flowRate, 0);
        }
    }

    function test_GetActiveDelegates() public {
        IRewardDistributor.VotingPowerUpdate[] memory updates =
            new IRewardDistributor.VotingPowerUpdate[](3);

        updates[0] = IRewardDistributor.VotingPowerUpdate({ delegate: delegate1, power: 50 });
        updates[1] = IRewardDistributor.VotingPowerUpdate({ delegate: delegate2, power: 30 });
        updates[2] = IRewardDistributor.VotingPowerUpdate({ delegate: delegate3, power: 20 });

        rewardDistributor.updateFlows(TOPIC_ID, updates, 100);

        address[] memory activeDelegates = rewardDistributor.getActiveDelegates(TOPIC_ID);
        assertEq(activeDelegates.length, 3);
    }

    // ============ Fuzz Tests ============

    function testFuzz_ProportionalDistribution(uint256 power1, uint256 power2) public {
        power1 = bound(power1, 1, 1e18);
        power2 = bound(power2, 1, 1e18);
        uint256 totalPower = power1 + power2;

        IRewardDistributor.VotingPowerUpdate[] memory updates =
            new IRewardDistributor.VotingPowerUpdate[](2);
        updates[0] = IRewardDistributor.VotingPowerUpdate({ delegate: delegate1, power: power1 });
        updates[1] = IRewardDistributor.VotingPowerUpdate({ delegate: delegate2, power: power2 });

        rewardDistributor.updateFlows(TOPIC_ID, updates, totalPower);

        (int96 flowRate1,,) = rewardDistributor.getFlowRate(delegate1, TOPIC_ID);
        (int96 flowRate2,,) = rewardDistributor.getFlowRate(delegate2, TOPIC_ID);

        // Total should equal pool flow rate (within rounding error)
        assertApproxEqRel(flowRate1 + flowRate2, POOL_FLOW_RATE, 0.01e18);
    }
}

// ============ Mock Contracts ============

contract MockSuperfluidHost {
    // Minimal implementation for testing
}

contract MockSuperToken is ERC20 {
    constructor() ERC20("Mock Super Token", "MST") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function createFlow(address, int96) external pure returns (bool) {
        return true;
    }

    function updateFlow(address, int96) external pure returns (bool) {
        return true;
    }

    function deleteFlow(address, address) external pure returns (bool) {
        return true;
    }
}
