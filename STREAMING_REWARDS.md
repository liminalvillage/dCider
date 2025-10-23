# Streaming Rewards Implementation

## Overview

The streaming rewards functionality enables continuous token distribution to delegates based on their voting power using **Superfluid** protocol. Rewards stream in real-time proportional to each delegate's accumulated voting power in a given topic.

## Architecture

### Smart Contracts

#### 1. RewardDistributor.sol
**Location:** `contracts/src/core/RewardDistributor.sol`

Core contract managing Superfluid streaming rewards.

**Key Features:**
- Proportional reward distribution based on voting power
- Real-time streaming using Superfluid protocol
- Multi-topic support with independent reward pools
- Automatic flow updates when voting power changes
- Pool capacity management and utilization tracking

**Main Functions:**
```solidity
// Update reward flows based on voting power changes
function updateFlows(
    uint256 topicId,
    VotingPowerUpdate[] calldata votingPowerMapping,
    uint256 totalVotingPower
) external;

// Get current flow rate for a delegate
function getFlowRate(address delegate, uint256 topicId)
    external view returns (int96 flowRate, uint256 totalStreamed, uint256 lastUpdated);

// Estimate monthly reward potential
function estimateMonthlyReward(
    uint256 topicId,
    uint256 votingPower,
    uint256 totalVotingPower
) external view returns (uint256 tokensPerMonth, int96 flowRate, uint256 sharePercentage);

// Set pool flow rate (admin only)
function setPoolFlowRate(uint256 topicId, int96 newPoolFlowRate) external;
```

#### 2. VotePowerVerifier.sol Integration
**Location:** `contracts/src/core/VotePowerVerifier.sol`

Modified to automatically trigger reward updates when voting power attestations are submitted.

**Key Changes:**
- Added `rewardDistributor` state variable
- Automatic call to `rewardDistributor.updateFlows()` after attestation acceptance
- Non-blocking reward updates (won't revert attestation if rewards fail)

### Frontend Components

#### 1. RewardStreamDisplay.svelte
**Location:** `frontend/src/lib/components/RewardStreamDisplay.svelte`

Beautiful, real-time streaming reward display component.

**Features:**
- Real-time accumulation updates (every second)
- Compact and full display modes
- Multiple time unit rates (per second/hour/day/month)
- Visual indicators for active streams
- Responsive design with gradient styling

**Usage:**
```svelte
<RewardStreamDisplay
  delegate={userAddress}
  topicId={1}
  flowRate={flowRate}
  totalStreamed={totalStreamed}
  lastUpdated={lastUpdated}
  isActive={true}
  compact={false}
/>
```

#### 2. RewardsDashboard.svelte
**Location:** `frontend/src/lib/components/RewardsDashboard.svelte`

Comprehensive dashboard for viewing rewards.

**Features:**
- User's personal reward stream
- Topic reward pool information with utilization bar
- Leaderboard of active delegates
- Auto-refresh every 10 seconds
- Pool capacity and distribution tracking

**Usage:**
```svelte
<RewardsDashboard
  userAddress={$walletAddress}
  topicId={selectedTopic}
  showAllDelegates={true}
/>
```

#### 3. Reward Streams Store
**Location:** `frontend/src/lib/stores/rewardStreams.ts`

Svelte store for managing reward data.

**Key Functions:**
```typescript
// Initialize connection
await initRewardDistributor(provider, contractAddress, abi);

// Fetch stream data
const stream = await fetchFlowRate(delegate, topicId);

// Fetch pool data
const pool = await fetchPoolFlowRate(topicId);

// Estimate rewards
const estimate = await estimateReward(topicId, votingPower, totalVotingPower);

// Subscribe to updates
const unsubscribe = subscribeToStreamUpdates(delegate, topicId, 10000);
```

## Deployment

### Prerequisites

1. **Superfluid Contracts Deployed** on target network
2. **Super Token** available for rewards (e.g., DAIx, USDCx)
3. **VotePowerVerifier** already deployed

### Network Configuration

#### Gnosis Chiado Testnet
```typescript
{
  superfluidHost: "0x42b11d1AdC84b2B95B0c3e39738e25329e3F84CC",
  rewardToken: "0xF2d68898557cCb2Cf4C10c3Ef2B034b2a69DAD00" // fDAIx
}
```

#### Gnosis Mainnet
```typescript
{
  superfluidHost: "0x2dFe937cD98Ab92e59cF3139138f18c823a4efE7",
  rewardToken: "0x59988e47A3503AaFaA0368b9deF095c818Fdca01" // USDCx
}
```

### Deployment Steps

1. **Deploy RewardDistributor:**
```bash
cd contracts
pnpm deploy:chiado
```

2. **Configure Pool Flow Rate:**
```solidity
// Set topic reward pool to 1 token/second
rewardDistributor.setPoolFlowRate(topicId, 1e18);
```

3. **Fund the Contract:**
```solidity
// Transfer Super Tokens to RewardDistributor
superToken.transfer(rewardDistributorAddress, amount);
```

4. **Connect to VotePowerVerifier:**
```solidity
// Link contracts
votePowerVerifier.setRewardDistributor(rewardDistributorAddress);
```

The deployment script (`contracts/deploy/04_deploy_reward_distributor.ts`) handles most of this automatically.

## How It Works

### Flow Lifecycle

```
1. Delegate receives voting power via delegation
   ↓
2. Enclave computes voting power and submits attestation
   ↓
3. VotePowerVerifier accepts attestation
   ↓
4. VotePowerVerifier calls RewardDistributor.updateFlows()
   ↓
5. RewardDistributor calculates proportional flow rates
   ↓
6. Superfluid streams start/update automatically
   ↓
7. Delegates receive tokens continuously in real-time
```

### Proportional Distribution

If a topic has:
- **Pool Flow Rate:** 10 tokens/second
- **Delegate A:** 600 voting power (60%)
- **Delegate B:** 300 voting power (30%)
- **Delegate C:** 100 voting power (10%)

Then:
- **Delegate A** receives: 6 tokens/second
- **Delegate B** receives: 3 tokens/second
- **Delegate C** receives: 1 token/second

### Real-time Accumulation

The frontend calculates real-time accumulated rewards:

```typescript
const now = Math.floor(Date.now() / 1000);
const elapsed = now - lastUpdated;
const streamed = flowRate * elapsed;
const currentTotal = totalStreamed + streamed;
```

This provides a smooth, continuously updating display.

## Testing

### Smart Contract Tests

**Location:** `contracts/src/test/RewardDistributorTest.sol`

**Coverage:**
- ✅ Initial state verification
- ✅ Single delegate flow creation
- ✅ Multiple delegate proportional distribution
- ✅ Flow updates when voting power changes
- ✅ Flow deletion when voting power reaches zero
- ✅ Pool flow rate management
- ✅ Monthly reward estimation
- ✅ Real-time streaming accumulation
- ✅ Access control
- ✅ Edge cases (empty arrays, large delegate counts)
- ✅ Fuzz testing for proportional distribution

**Run Tests:**
```bash
cd contracts
forge test --match-path src/test/RewardDistributorTest.sol -vvv
```

## Security Considerations

1. **Access Control**
   - Only VERIFIER_ROLE can update flows
   - Only ADMIN_ROLE can set pool rates and fund pools
   - Role-based access enforced via OpenZeppelin AccessControl

2. **Reentrancy Protection**
   - ReentrancyGuard on all state-changing functions
   - External calls to Superfluid isolated and handled safely

3. **Non-Blocking Updates**
   - Reward updates don't revert attestation submissions
   - Failed reward updates are caught and logged

4. **Pool Capacity Management**
   - Total distributed flows cannot exceed pool flow rate
   - Automatic rebalancing when pool capacity reduced

5. **Superfluid Integration**
   - Uses battle-tested Superfluid protocol
   - Remote attestation ensures computation integrity

## User Experience

### For Delegates

**View Rewards:**
1. Navigate to Rewards Dashboard
2. See real-time streaming accumulation
3. View rates per second/hour/day/month
4. Track position on leaderboard

**Estimate Potential:**
```typescript
// See what you'd earn with X voting power
const estimate = await estimateReward(topicId, myPower, totalPower);
console.log(`Monthly: ${estimate.tokensPerMonth} tokens`);
console.log(`Share: ${estimate.sharePercentage}%`);
```

### For Administrators

**Configure Pools:**
```solidity
// Set reward rate for a topic
rewardDistributor.setPoolFlowRate(topicId, 1e18); // 1 token/sec

// Fund the pool
rewardDistributor.fundPool(topicId, 1000000 ether);
```

**Monitor Utilization:**
```typescript
const pool = await fetchPoolFlowRate(topicId);
const utilization = (pool.totalDistributed / pool.poolFlowRate) * 100;
console.log(`Pool ${utilization}% utilized`);
```

## Future Enhancements

1. **Multi-token Support**
   - Support multiple reward tokens per topic
   - Let delegates choose preferred reward token

2. **Boost Multipliers**
   - Apply multipliers for long-term delegations
   - Bonus rewards for active participation

3. **Delegation Tiers**
   - Different reward rates for different delegate tiers
   - Reputation-based bonuses

4. **Analytics Dashboard**
   - Historical reward charts
   - Comparative analytics
   - Projection tools

5. **Notifications**
   - Alert when stream starts/stops
   - Notify when rewards accumulate to threshold
   - Monthly summary emails

## Resources

- **Superfluid Docs:** https://docs.superfluid.finance/
- **Contract Interfaces:** `contracts/src/interfaces/IRewardDistributor.sol`
- **Example Usage:** `frontend/src/routes/rewards/+page.svelte` (to be created)

## Support

For questions or issues:
1. Check contract events for debugging
2. Verify Superfluid token balances
3. Ensure pool has sufficient capacity
4. Review logs for failed transactions

---

**Status:** ✅ Implementation Complete

**Deployments:**
- Chiado Testnet: *Pending deployment*
- Gnosis Mainnet: *Pending deployment*

Last Updated: 2025-10-23
