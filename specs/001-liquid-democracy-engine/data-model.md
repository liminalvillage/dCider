# Data Model: Liquid Democracy Engine

**Date**: 2025-10-18
**Feature**: Liquid Democracy Engine (LDE)
**Purpose**: Define entities, relationships, validation rules, and state transitions

## Overview

The Liquid Democracy Engine data model is distributed across three tiers:
1. **On-Chain (Smart Contracts)**: Delegation relationships, topics, attestations, operator set
2. **Off-Chain (Enclave)**: Computed voting power graphs, transitive delegation chains
3. **Frontend (Client State)**: User session, cached graph data, transaction status

This document focuses on canonical data structures; implementation details (Solidity structs, TypeScript interfaces) defined in API contracts.

---

## Core Entities

### 1. Topic

**Description**: A governance domain or category with independent delegation graph (e.g., "Climate Policy", "Treasury Management").

**Attributes**:
- `id` (uint256): Unique topic identifier, assigned sequentially
- `name` (string): Human-readable topic name (max 64 characters)
- `description` (string): Topic description stored as IPFS CID (bytes32)
- `proposalThreshold` (uint256): Minimum voting power required to create proposals on this topic
- `active` (bool): Whether topic accepts new delegations and proposals
- `createdAt` (uint256): Block timestamp of topic creation
- `admin` (address): Address authorized to modify topic configuration

**Relationships**:
- One-to-Many with Delegation: A topic has many delegations
- One-to-Many with Proposal: A topic has many proposals
- One-to-Many with DeadEndDeclaration: A topic has many dead-end declarations

**Validation Rules**:
- `name` MUST be non-empty and unique across all topics
- `proposalThreshold` MUST be > 0 and <= total voting power in topic
- `admin` MUST be non-zero address
- Only `admin` can modify topic (except `active` status via governance)

**State Transitions**:
- **Created** → **Active**: Topic initialized by admin
- **Active** → **Inactive**: Admin deactivates topic (existing delegations persist but frozen)
- **Inactive** → **Active**: Admin reactivates topic

**Storage Location**: On-chain (TopicRegistry contract)

**Key Entities (from spec.md)**:
> Topic: A governance domain or category (e.g., "Climate Policy", "Education", "Treasury Management"). Each topic has an independent delegation graph.

---

### 2. Delegation

**Description**: A relationship from one address (delegator) to another (delegate) for a specific topic, transferring voting power.

**Attributes**:
- `delegator` (address): Address delegating their voting power
- `delegate` (address): Address receiving delegated power
- `topicId` (uint256): Topic to which this delegation applies
- `timestamp` (uint256): Block timestamp when delegation created
- `depth` (uint8): Delegation chain depth (0 = direct voter, increments transitively, max 7)

**Relationships**:
- Many-to-One with Topic: Many delegations belong to one topic
- Self-referential: Delegate can delegate further (transitive delegation) unless dead-end

**Validation Rules** (FR-001, FR-002, FR-003, FR-008, FR-024):
- `delegator` MUST NOT equal `delegate` (no self-delegation)
- `topicId` MUST reference an active topic
- `delegate` MUST NOT create cycle (FR-008: detect via graph traversal)
- New delegation depth MUST NOT exceed 7 (FR-024: reject if delegate's chain depth is 6)
- `delegator` can have at most ONE delegation per topic (new delegation replaces old)
- If `delegator` has already voted on active proposal, delegation MUST be rejected OR vote invalidated

**State Transitions**:
- **Created**: Delegator calls `delegate(topicId, delegateAddress)`
- **Revoked**: Delegator calls `revoke(topicId)` or delegates to different address
- **Invalidated**: If delegate is at depth 6 and attempts to delegate further

**Derived Data**:
- Effective delegation chain: Computed off-chain by traversing `delegator` → `delegate` → `delegate.delegate` → ... until terminal delegate (no outgoing delegation or dead-end)

**Storage Location**: On-chain (DelegationManager contract)

**Events**:
- `Delegated(address indexed delegator, address indexed delegate, uint256 indexed topicId, uint256 timestamp)`
- `Revoked(address indexed delegator, uint256 indexed topicId, uint256 timestamp)`

**Key Entities (from spec.md)**:
> Delegation: A relationship from one address to another for a specific topic, transferring voting power. Includes delegator address, delegate address, topic ID, and timestamp.

---

### 3. DeadEndDeclaration

**Description**: A self-imposed constraint by a delegate indicating they will not delegate further on a specific topic.

**Attributes**:
- `delegate` (address): Address declaring dead-end status
- `topicId` (uint256): Topic for which delegate is a dead-end
- `active` (bool): Whether dead-end declaration is currently in effect
- `declaredAt` (uint256): Block timestamp of declaration

**Relationships**:
- Many-to-One with Topic: Many dead-end declarations belong to one topic

**Validation Rules** (FR-004):
- `delegate` can have at most ONE dead-end declaration per topic
- If `active` is true, any attempt by `delegate` to delegate further on `topicId` MUST be rejected
- `delegate` can revoke dead-end by calling `revokeDeadEnd(topicId)` (sets `active` to false)

**State Transitions**:
- **Declared**: Delegate calls `declareDeadEnd(topicId)` (sets `active` to true)
- **Revoked**: Delegate calls `revokeDeadEnd(topicId)` (sets `active` to false)

**Storage Location**: On-chain (DelegationManager contract)

**Events**:
- `DeadEndDeclared(address indexed delegate, uint256 indexed topicId, uint256 timestamp)`
- `DeadEndRevoked(address indexed delegate, uint256 indexed topicId, uint256 timestamp)`

**Key Entities (from spec.md)**:
> Dead-End Declaration: A self-imposed constraint by a delegate indicating they will not delegate further on a specific topic. Includes delegate address, topic ID, and status.

---

### 4. VotingPower

**Description**: Accumulated vote weight for an address on a specific topic, calculated as direct power (1 if not delegated) plus all transitively delegated power.

**Attributes**:
- `address` (address): Address holding voting power
- `topicId` (uint256): Topic for which voting power is calculated
- `power` (uint256): Total accumulated voting power (minimum 0, maximum total participants)
- `lastUpdated` (uint256): Block timestamp of last computation
- `attestationHash` (bytes32): Hash of enclave attestation that produced this result

**Relationships**:
- Derived from Delegation: Voting power is computed by traversing delegation graph
- One-to-One with address+topic combination

**Validation Rules** (FR-006, FR-007):
- Voting power MUST be computed by enclave, NOT on-chain
- Contract MUST verify M-of-N attestation signatures before accepting power values
- Voting power MUST be recomputed in real-time upon each delegation/revocation event
- Total voting power across all addresses for a topic MUST equal total participants (conservation of power)

**Computation Algorithm** (Off-Chain in Enclave):
```
For each voter V in topic T:
  If V has delegated to D:
    V.votingPower[T] = 0
    D.votingPower[T] += 1 (transitive)
  Else:
    V.votingPower[T] = 1 (direct)

For each delegation chain:
  Traverse from delegator to terminal delegate
  Accumulate power at terminal delegate
  Ensure chain depth <= 7
  Detect and reject cycles
```

**State Transitions**:
- **Computed**: Enclave processes delegation/revocation event → computes new power distribution
- **Attested**: M-of-N operators sign attestation
- **Verified**: VotePowerVerifier contract accepts attestation → updates on-chain power mapping

**Storage Location**:
- **Off-Chain (Primary)**: Enclave maintains full voting power graph
- **On-Chain (Cached)**: VotePowerVerifier stores latest attested power values for active proposals

**Events**:
- `VotingPowerUpdated(uint256 indexed topicId, bytes32 attestationHash, uint256 timestamp)`

**Key Entities (from spec.md)**:
> Voting Power: Accumulated vote weight for an address on a specific topic, calculated as direct power plus all transitively delegated power. Computed off-chain via enclave.

---

### 5. EnclaveAttestation

**Description**: Cryptographic proof that vote weight computation was performed inside a trusted execution environment, verified on-chain.

**Attributes**:
- `resultHash` (bytes32): Keccak256 hash of voting power mapping `keccak256(abi.encode(addresses[], powers[]))`
- `topicId` (uint256): Topic for which voting power was computed
- `blockNumber` (uint256): Block number at which delegation state was read
- `signatures` (bytes[]): Array of operator signatures (ECDSA) attesting to result
- `timestamp` (uint256): Block timestamp when attestation submitted
- `nonce` (uint256): Unique nonce to prevent replay attacks

**Relationships**:
- Many-to-One with Topic: Many attestations per topic (one per computation round)
- Many-to-One with EnclaveOperator: M operators must sign each attestation

**Validation Rules** (FR-007, Clarification: 3-of-5 threshold):
- `signatures.length` MUST be >= 3 (M = 3)
- Each signature MUST be from distinct operator in authorized set (N = 5)
- Signature MUST be valid ECDSA signature: `ecrecover(resultHash, signature) == operatorAddress`
- `nonce` MUST NOT have been used before (replay protection)
- `blockNumber` MUST be recent (within ~100 blocks to ensure freshness)

**State Transitions**:
- **Submitted**: Operator calls `submitAttestation(resultHash, signatures, blockNumber, nonce)`
- **Verified**: Contract validates signatures and quorum
- **Accepted**: Attestation passes all checks → VotingPower updated → RewardDistributor notified
- **Rejected**: Attestation fails validation → event emitted with failure reason

**Storage Location**: On-chain (VotePowerVerifier contract)

**Events**:
- `AttestationSubmitted(bytes32 indexed resultHash, uint256 indexed topicId, uint256 blockNumber, address[] operators)`
- `AttestationAccepted(bytes32 indexed resultHash, uint256 timestamp)`
- `AttestationRejected(bytes32 indexed resultHash, string reason)`

**Key Entities (from spec.md)**:
> Enclave Attestation: Cryptographic proof that vote weight computation was performed inside a trusted execution environment, verified on-chain before accepting results.

---

### 6. EnclaveOperator

**Description**: An authorized entity running trusted execution environment for voting power computation.

**Attributes**:
- `operatorAddress` (address): Ethereum address of operator (used for signature verification)
- `enclavePublicKey` (bytes): Public key of enclave instance (for TEE verification)
- `active` (bool): Whether operator is currently authorized
- `addedAt` (uint256): Block timestamp when operator added to set
- `attestationCount` (uint256): Total attestations submitted by this operator

**Relationships**:
- Part of operator set (N = 5 operators)
- Many-to-Many with EnclaveAttestation: Operators co-sign attestations

**Validation Rules**:
- Operator set MUST maintain exactly 5 active operators (N = 5)
- Only governance admin can add/remove operators (out of scope for MVP)
- Removing operator MUST NOT reduce active count below threshold M (3)

**State Transitions**:
- **Added**: Admin calls `addOperator(address, bytes enclavePublicKey)`
- **Removed**: Admin calls `removeOperator(address)` (only if active count > M)
- **Active** ↔ **Inactive**: Admin toggles operator status

**Storage Location**: On-chain (VotePowerVerifier contract)

**Events**:
- `OperatorAdded(address indexed operator, bytes enclavePublicKey)`
- `OperatorRemoved(address indexed operator)`

---

### 7. Proposal

**Description**: A governance decision to be voted on, created by delegates with sufficient voting power.

**Attributes**:
- `id` (uint256): Unique proposal identifier, assigned sequentially
- `topicId` (uint256): Topic to which proposal belongs
- `creator` (address): Address that created proposal (must have >= proposalThreshold voting power)
- `title` (string): Proposal title (max 128 characters)
- `descriptionCID` (bytes32): IPFS CID of full proposal description and metadata
- `votingStartBlock` (uint256): Block number when voting begins
- `votingEndBlock` (uint256): Block number when voting ends
- `status` (enum): `Pending | Active | Passed | Rejected | Executed | Cancelled`
- `votesFor` (uint256): Total voting power voting "Yes"
- `votesAgainst` (uint256): Total voting power voting "No"
- `votesAbstain` (uint256): Total voting power abstaining
- `createdAt` (uint256): Block timestamp of proposal creation

**Relationships**:
- Many-to-One with Topic: Many proposals belong to one topic
- One-to-Many with Vote: A proposal has many votes

**Validation Rules** (FR-022, FR-023):
- `creator` MUST have voting power >= `topic.proposalThreshold` on `topicId` at proposal creation
- `votingStartBlock` MUST be >= current block + proposal delay (e.g., 100 blocks)
- `votingEndBlock` MUST be > votingStartBlock and <= votingStartBlock + max voting period (e.g., 50,400 blocks ≈ 7 days on Gnosis)
- `topicId` MUST reference an active topic
- `descriptionCID` MUST be valid IPFS CID (32 bytes)

**State Transitions**:
- **Pending**: Proposal created, voting not yet started
- **Active**: Current block >= votingStartBlock and <= votingEndBlock
- **Passed**: votingEndBlock reached and votesFor > votesAgainst and quorum met
- **Rejected**: votingEndBlock reached and (votesFor <= votesAgainst OR quorum not met)
- **Executed**: Passed proposal's on-chain actions executed (future enhancement)
- **Cancelled**: Creator cancels proposal before voting starts

**Storage Location**: On-chain (ProposalManager contract - future, minimal in MVP)

**Events**:
- `ProposalCreated(uint256 indexed id, uint256 indexed topicId, address indexed creator, uint256 votingStartBlock, uint256 votingEndBlock)`
- `ProposalStatusChanged(uint256 indexed id, Status newStatus)`

**Key Entities (from spec.md)**:
> Proposal: A governance decision to be voted on, created by delegates with sufficient voting power. Scoped to a specific topic with voting period start/end times, description, and vote tally (yes/no/abstain).

---

### 8. Vote

**Description**: An individual vote cast on a proposal using accumulated voting power.

**Attributes**:
- `voter` (address): Address casting the vote
- `proposalId` (uint256): Proposal being voted on
- `support` (enum): `For | Against | Abstain`
- `votingPower` (uint256): Voting power of voter at vote close (snapshot per FR-020)
- `timestamp` (uint256): Block timestamp of vote

**Relationships**:
- Many-to-One with Proposal: Many votes belong to one proposal

**Validation Rules** (FR-016, FR-019, FR-020):
- Voter MUST NOT have delegated their power on proposal's topic (FR-016: prevent double voting)
- If voter HAS delegated, vote MUST be rejected with error message
- Voter can change vote any time during voting period (latest vote counts)
- Voting power MUST be snapshotted at `proposal.votingEndBlock` (FR-020)

**State Transitions**:
- **Cast**: Voter calls `vote(proposalId, support)` during active voting period
- **Updated**: Voter changes vote by calling `vote()` again
- **Finalized**: Voting period ends → voting power snapshot taken → vote power locked

**Storage Location**: On-chain (ProposalManager contract)

**Events**:
- `VoteCast(address indexed voter, uint256 indexed proposalId, Support support, uint256 votingPower)`

---

### 9. RewardStream

**Description**: Continuous token flow to a delegate proportional to their voting power on a topic.

**Attributes**:
- `delegate` (address): Address receiving streaming rewards
- `topicId` (uint256): Topic for which rewards are streamed
- `flowRate` (int96): Superfluid flow rate (tokens per second) - Superfluid's native type
- `totalStreamed` (uint256): Total tokens streamed since stream creation (informational)
- `lastUpdated` (uint256): Block timestamp of last flow rate update
- `active` (bool): Whether stream is currently active

**Relationships**:
- One-to-One with delegate+topic combination
- Derived from VotingPower: Flow rate proportional to voting power share

**Validation Rules** (FR-011, FR-012):
- `flowRate` MUST be calculated as: `flowRate = (votingPower / totalVotingPower) * poolFlowRate`
- `flowRate` updates MUST occur within 5 minutes of voting power changes (batched)
- If `votingPower` drops to 0, stream MUST be deleted (flow rate set to 0)
- Total flow rates across all delegates MUST NOT exceed pool flow rate

**Computation** (Off-Chain, triggered by attestation acceptance):
```
Every 5 minutes:
  For each topic T with updated voting power:
    totalPower = sum of all voting power in T
    poolFlowRate = rewardPool[T].flowRate

    For each delegate D with power > 0:
      newFlowRate = (D.votingPower[T] / totalPower) * poolFlowRate
      if newFlowRate != D.currentFlowRate:
        RewardDistributor.updateFlow(D, T, newFlowRate)
```

**State Transitions**:
- **Created**: Delegate accumulates first voting power → Superfluid CFA.createFlow()
- **Updated**: Voting power changes → Superfluid CFA.updateFlow() (batched every 5 min)
- **Deleted**: Voting power drops to 0 → Superfluid CFA.deleteFlow()

**Storage Location**:
- **On-Chain (Superfluid)**: Superfluid protocol manages actual streaming state
- **On-Chain (RewardDistributor)**: Tracks flow rate mapping for validation

**Events**:
- `FlowCreated(address indexed delegate, uint256 indexed topicId, int96 flowRate)`
- `FlowUpdated(address indexed delegate, uint256 indexed topicId, int96 oldFlowRate, int96 newFlowRate)`
- `FlowDeleted(address indexed delegate, uint256 indexed topicId)`

**Key Entities (from spec.md)**:
> Reward Stream: Continuous token flow to a delegate proportional to their voting power on a topic, managed via streaming payment protocol.

---

## Entity Relationship Diagram (ERD)

```
┌─────────────────┐         ┌─────────────────────┐
│  Topic          │◄───────┤  Delegation         │
│  - id           │  1   *  │  - delegator        │
│  - name         │         │  - delegate         │
│  - threshold    │         │  - topicId          │
│  - active       │         │  - timestamp        │
└─────────────────┘         │  - depth            │
       │                     └─────────────────────┘
       │ 1                            │
       │                              │ self-referential
       │ *                            │ (transitive)
       │                              ▼
┌─────────────────┐         ┌─────────────────────┐
│  Proposal       │         │  DeadEndDeclaration │
│  - id           │         │  - delegate         │
│  - topicId      │         │  - topicId          │
│  - creator      │         │  - active           │
│  - voting blocks│         └─────────────────────┘
│  - votes        │                  │
└─────────────────┘                  │ *
       │ 1                           │
       │                             │ 1
       │ *                           ▼
┌─────────────────┐         ┌─────────────────────┐
│  Vote           │         │  VotingPower        │
│  - voter        │         │  - address          │
│  - proposalId   │         │  - topicId          │
│  - support      │         │  - power            │
│  - votingPower  │         │  - attestationHash  │
└─────────────────┘         └─────────────────────┘
                                     │ 1
                                     │
                                     │ 1
                            ┌─────────────────────┐
                            │ EnclaveAttestation  │
                            │ - resultHash        │
                            │ - topicId           │
                            │ - signatures        │
                            │ - blockNumber       │
                            └─────────────────────┘
                                     │ *
                                     │
                                     │ *
                            ┌─────────────────────┐
                            │ EnclaveOperator     │
                            │ - operatorAddress   │
                            │ - enclavePublicKey  │
                            │ - active            │
                            └─────────────────────┘

┌─────────────────┐
│  RewardStream   │
│  - delegate     │
│  - topicId      │
│  - flowRate     │
│  - active       │
└─────────────────┘
       │ derived from VotingPower
       └───────────────┐
                       ▼
              (Superfluid Protocol)
```

---

## Validation Summary by Functional Requirement

| FR | Entity | Validation Rule |
|----|--------|-----------------|
| FR-001 | Delegation | Delegate per-topic to any valid address |
| FR-002 | Delegation | Revoke anytime, power returns to delegator |
| FR-003 | Delegation | Support transitive delegation (chain traversal) |
| FR-004 | DeadEndDeclaration | Prevent further delegation if dead-end active |
| FR-005 | Delegation | All relationships tracked on-chain with events |
| FR-006 | VotingPower | Compute via enclave in real-time per transaction |
| FR-007 | EnclaveAttestation | Verify M-of-N (3-of-5) attestation signatures |
| FR-008 | Delegation | Reject cycles via graph traversal check |
| FR-009 | All | Emit events for all state changes |
| FR-010 | Topic | Support multiple independent topics |
| FR-011 | RewardStream | Calculate flow rate proportional to voting power |
| FR-012 | RewardStream | Auto-adjust streams within 5 minutes (batched) |
| FR-016 | Vote | Prevent double voting (direct + delegated) |
| FR-017 | VotingPower | Exactly one unit per voter (no splitting) |
| FR-019 | Delegation | Allow changes during active voting periods |
| FR-020 | Vote | Snapshot voting power at vote close time |
| FR-022 | Proposal | Restrict creation to addresses with >= threshold power |
| FR-024 | Delegation | Enforce max depth of 7 levels |

---

## State Transition Summary

### Delegation Lifecycle
1. **Voter delegates** → Delegation.Created → Event emitted
2. **Enclave computes** → VotingPower updated → Attestation submitted
3. **Contract verifies** → Attestation accepted → Rewards adjusted
4. **Voter revokes** → Delegation.Revoked → Power recalculated

### Proposal Lifecycle (Future Enhancement)
1. **Delegate creates** → Proposal.Pending → Voting scheduled
2. **Voting starts** → Proposal.Active → Voters cast votes
3. **Voting ends** → Snapshot taken → Proposal.Passed or Rejected
4. **Execution** → Actions performed → Proposal.Executed

### Reward Stream Lifecycle
1. **Delegate gains power** → Stream.Created → Superfluid flow starts
2. **Power changes** → Stream.Updated → Flow rate adjusted (5-min batch)
3. **Power drops to 0** → Stream.Deleted → Flow stopped

---

## Implementation Notes

**Solidity Structs** (contracts):
- Structs mirror entity attributes with appropriate Solidity types (address, uint256, bytes32, etc.)
- Use OpenZeppelin EnumerableSet for operator tracking and delegation lookups
- Events include `indexed` parameters for efficient filtering

**TypeScript Interfaces** (frontend/enclave):
- TypeScript interfaces for Web3 interaction (ethers.js contract types)
- Enclave uses same interfaces for off-chain computation
- GraphQL schema (future) mirrors entity structure for frontend queries

**Database** (optional, not in MVP):
- Indexer (e.g., The Graph subgraph) can cache on-chain data for frontend performance
- Schema mirrors entities with additional indexes for queries

All entities satisfy constitution requirements:
- ✅ Library-First: Clear separation between on-chain state and off-chain computation
- ✅ Observability: All state changes emit events
- ✅ Security: Validation rules prevent cycles, depth attacks, double voting
- ✅ Simplicity: Minimal entity set covering all user stories
