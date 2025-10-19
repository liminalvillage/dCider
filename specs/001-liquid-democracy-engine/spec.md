# Feature Specification: Liquid Democracy Engine

**Feature Branch**: `001-liquid-democracy-engine`
**Created**: 2025-10-18
**Status**: Draft
**Input**: User description: "Liquid Democracy Engine (LDE) — Multi-topic Delegation System with Secure Vote Computation via Enclave.gg"

## Clarifications

### Session 2025-10-18

- Q: When does enclave computation of voting power occur? → A: Real-time per transaction - Every delegation/revocation triggers immediate enclave computation
- Q: What is the enclave operator trust model? → A: Multi-operator with threshold - Multiple operators; require M-of-N attestation agreement
- Q: How are proposals created and who can create them? → A: Delegate-only proposal rights - Only addresses with >N delegated power can create proposals
- Q: What is the maximum delegation chain depth? → A: Limit to 7 delegations
- Q: How quickly do streaming reward rates update after delegation changes? → A: Within 5 minutes batched - Batch multiple updates to reduce gas costs

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Delegate Vote on a Topic (Priority: P1)

A voter wants to delegate their voting power on a specific topic (e.g., climate policy) to a trusted expert, while retaining the ability to vote directly on other topics they care about.

**Why this priority**: This is the core value proposition of liquid democracy. Without topic-specific delegation, the system is just traditional representative democracy. This enables the minimal viable product where users can experience the fundamental benefit.

**Independent Test**: Can be fully tested by connecting a wallet, selecting a topic from a list, choosing a delegate address, and confirming the delegation transaction. Delivers immediate value as the voter's power is now represented by someone they trust on that specific issue.

**Acceptance Scenarios**:

1. **Given** I am a connected voter with voting power, **When** I select "Climate Policy" topic and delegate to address 0xABC, **Then** my voting power for climate policy is transferred to 0xABC and I see confirmation of successful delegation
2. **Given** I have already delegated climate policy to 0xABC, **When** I attempt to vote directly on a climate proposal, **Then** I see a message indicating my vote is currently delegated and I must revoke to vote directly
3. **Given** I have delegated climate policy but not education policy, **When** I view an education proposal, **Then** I can vote directly without any delegation restrictions
4. **Given** I delegate to address 0xABC on climate policy, **When** 0xABC delegates their climate votes to 0xDEF, **Then** my voting power flows through the chain to 0xDEF (transitive delegation)

---

### User Story 2 - Revoke Delegation and Reclaim Vote (Priority: P2)

A voter who previously delegated wants to reclaim their voting power on a topic, either to vote directly or to delegate to someone else.

**Why this priority**: Revocation is essential to the "liquid" nature of liquid democracy. Without this, delegation becomes permanent representation. This is P2 because delegation (P1) must exist before revocation is meaningful.

**Independent Test**: Can be tested independently by first delegating (using P1 functionality), then revoking that delegation and observing that voting power returns to the original voter. Delivers the autonomy and flexibility that distinguishes liquid from traditional democracy.

**Acceptance Scenarios**:

1. **Given** I have delegated my climate policy vote to 0xABC, **When** I revoke my delegation on climate policy, **Then** my voting power returns to me and I can vote directly or delegate to someone else
2. **Given** I revoke a delegation that was part of a chain (A→B→C), **When** the revocation is processed, **Then** all downstream voting power calculations are updated to reflect my withdrawn power
3. **Given** I have delegated multiple topics to the same delegate, **When** I revoke only one topic, **Then** my other delegations to that person remain intact
4. **Given** I revoke a delegation, **When** reward streams are calculated, **Then** my former delegate's streaming rewards are adjusted to reflect the reduced voting power

---

### User Story 3 - Declare Dead-End to Prevent Further Delegation (Priority: P3)

A delegate wants to signal that they will personally vote on issues and will not delegate further, building trust with their delegators by promising final accountability.

**Why this priority**: This is a trust-building feature that enhances the quality of delegation but is not strictly necessary for basic functionality. It's valuable for reputation but P1 and P2 provide the core mechanics.

**Independent Test**: Can be tested by a delegate marking themselves as a dead-end for a topic, then attempting to delegate that topic to another address and seeing the transaction fail. Delivers trust signal to potential delegators.

**Acceptance Scenarios**:

1. **Given** I am a delegate holding voting power on education policy, **When** I declare myself a dead-end on education, **Then** the system records this declaration and displays it to potential delegators
2. **Given** I have declared myself a dead-end on education, **When** I attempt to delegate education votes to another address, **Then** the transaction is rejected with an error message
3. **Given** I am a voter considering delegation, **When** I view a potential delegate's profile, **Then** I can see which topics they have declared as dead-ends
4. **Given** I declared myself a dead-end but want to change this, **When** I revoke my dead-end declaration, **Then** I can delegate those votes forward again

---

### User Story 4 - View Delegation Graph and Voting Power Distribution (Priority: P4)

A user wants to visualize how voting power flows through delegation chains for a given topic, understanding who holds power and how it was accumulated.

**Why this priority**: Transparency and observability are crucial for trust, but the system can function without visualization. This is a UX enhancement that makes the system more accessible and trustworthy.

**Independent Test**: Can be tested by navigating to a topic page and viewing an interactive graph showing nodes (voters/delegates) and edges (delegation relationships), with node sizes proportional to accumulated voting power. Delivers transparency and helps users make informed delegation decisions.

**Acceptance Scenarios**:

1. **Given** delegations exist on climate policy, **When** I navigate to the climate policy graph view, **Then** I see a visual representation of all delegation relationships with voting power weights
2. **Given** I am viewing the delegation graph, **When** I click on a delegate node, **Then** I see details about their accumulated voting power, dead-end status, and who delegated to them
3. **Given** the graph is complex with long chains, **When** I select "trace my vote", **Then** the system highlights the path from my address to the final delegate who can vote
4. **Given** a delegation or revocation occurs, **When** I refresh the graph view, **Then** I see the updated voting power distribution reflecting the change

---

### User Story 5 - Earn Streaming Rewards Based on Voting Power (Priority: P5)

A delegate who has accumulated significant voting power through delegations wants to receive streaming token rewards proportional to the trust placed in them.

**Why this priority**: Economic incentives can improve delegate engagement and quality, but the core governance functionality works without payments. This is an optional enhancement for sustainability and delegate accountability.

**Independent Test**: Can be tested by accumulating voting power as a delegate, then observing that a continuous token stream begins flowing to the delegate's address proportional to their power share. Delivers economic sustainability and incentivizes quality delegation.

**Acceptance Scenarios**:

1. **Given** I am a delegate with 100 voting power on climate policy and total pool is 1000, **When** streaming rewards are active, **Then** I receive 10% of the reward stream for climate policy
2. **Given** I am receiving streaming rewards, **When** a delegator revokes their delegation to me, **Then** my reward stream is automatically adjusted downward within the next reward calculation cycle
3. **Given** I hold voting power across multiple topics, **When** I view my rewards dashboard, **Then** I see separate streams for each topic proportional to my power in that topic
4. **Given** reward calculation happens off-chain via enclave, **When** results are submitted on-chain, **Then** the contract verifies the enclave attestation before updating stream allocations

---

### Edge Cases

- What happens when a delegation creates a cycle (A→B→C→A)? System must detect and reject cyclic delegations to prevent infinite loops in vote weight calculation.
- What happens when a delegation would exceed the maximum chain depth of 7? System must reject the delegation transaction with an error indicating the depth limit has been reached.
- What happens when a delegate's voting power exceeds a concentration threshold (e.g., >30% of total power)? System does not enforce hard limits on delegation concentration. Power distribution is managed through social coordination, transparency (via delegation graph visualization), and individual revocation rights. If concentration becomes problematic, the community can coordinate revocations.
- What happens when a voter delegates, then the delegate address is compromised or acts maliciously? The original voter can revoke, but there may be a delay—system should provide real-time revocation.
- How does the system handle delegation changes during an active voting period? Delegations can be changed at any time, even during active votes. The system takes a snapshot of voting power at the moment the vote closes (voting period ends). This provides maximum flexibility for voters while ensuring a clear, final power distribution for vote tallying. Voters can adjust their delegations strategically throughout the voting period.
- What happens when enclave computation fails or provides invalid attestation? Smart contract must reject results and maintain previous voting power state until valid computation is provided.
- How are ties handled when voting power is exactly split? Standard tiebreaker rules (timestamp, random seed) should be documented in governance rules.
- What happens if a user tries to delegate to an address that has declared itself a dead-end? The direct delegation succeeds (dead-end only prevents the delegate from delegating further).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow voters to delegate their voting power on a per-topic basis to any valid blockchain address
- **FR-002**: System MUST allow voters to revoke their delegations at any time, immediately returning voting power to the voter
- **FR-003**: System MUST support transitive delegation (A delegates to B, B delegates to C, so A's power flows to C)
- **FR-004**: System MUST allow delegates to declare themselves as dead-ends for specific topics, preventing further delegation
- **FR-005**: System MUST track delegation relationships on-chain with public transparency
- **FR-006**: System MUST compute final voting power distribution using off-chain trusted execution environment in real-time upon each delegation or revocation transaction (voting power updated immediately; reward stream adjustments batched per FR-012)
- **FR-007**: System MUST verify enclave attestation before accepting vote weight computation results on-chain, requiring 3-of-5 threshold agreement (M=3, N=5) from multiple independent enclave operators
- **FR-008**: System MUST reject delegation transactions that would create cycles in the delegation graph
- **FR-024**: System MUST enforce a maximum delegation chain depth of 7 levels, rejecting delegations that would exceed this limit
- **FR-009**: System MUST emit events for all delegation, revocation, and dead-end declaration actions
- **FR-010**: System MUST support multiple independent topics with separate delegation graphs per topic
- **FR-011**: System MUST calculate streaming rewards proportional to each delegate's accumulated voting power
- **FR-012**: System MUST adjust streaming rewards automatically when delegations or revocations occur, processing updates in batches within 5-minute intervals to optimize gas costs
- **FR-013**: Users MUST be able to view the current delegation graph for any topic
- **FR-014**: Users MUST be able to trace the path from their vote to the final delegate who can vote
- **FR-015**: System MUST support wallet-based authentication for all governance actions
- **FR-016**: System MUST prevent double-voting (direct vote + delegated vote on the same proposal)
- **FR-017**: System MUST maintain voting power at exactly one unit per voter (no vote splitting in MVP)
- **FR-018**: System MUST integrate with standard Web3 wallet providers for transaction signing
- **FR-019**: System MUST allow delegation changes at any time, including during active voting periods
- **FR-020**: System MUST snapshot voting power at vote close time to determine final vote tallies
- **FR-021**: System MUST NOT enforce hard limits on delegation concentration per delegate
- **FR-022**: System MUST restrict proposal creation to addresses holding minimum threshold of delegated voting power on the relevant topic
- **FR-023**: System MUST allow delegates meeting the power threshold to create proposals scoped to topics where they hold sufficient power

### Assumptions

- Voting power is initially distributed 1:1 with wallet addresses (one address = one vote unit)
- Enclave computation uses multi-operator threshold model (M-of-N attestation agreement required); dynamic operator set management is out of scope for MVP
- Reward pool is pre-funded and managed separately; dynamic reward pool management is out of scope for MVP
- Streaming reward rate updates are batched for gas efficiency with maximum 5-minute latency from delegation/revocation events
- All voters have access to Web3-compatible wallets and basic understanding of blockchain transactions
- Gas fees for delegation/revocation transactions are paid by users; gas subsidies are out of scope for MVP
- Topics are predefined and managed by governance administrators; dynamic topic creation is out of scope for MVP
- Minimum voting power threshold for proposal creation will be defined per topic by governance administrators
- Proposal creation threshold will be configurable per topic (example: 10 voting power units minimum for testnet MVP)
- Delegation concentration is managed through social coordination and transparency rather than hard protocol limits
- Voting power snapshots occur at vote close; strategic delegation changes during voting periods are expected user behavior
- Proposal creation and voting (FR-016, FR-020, FR-022, FR-023) are post-MVP features; MVP focuses on delegation mechanics (US1-US5)

### Key Entities

- **Voter**: An address holding voting power (initially one unit). Can delegate power on specific topics or vote directly. Represented by blockchain address.
- **Delegate**: An address that has received delegated voting power from one or more voters. Can vote on behalf of delegators or delegate further (unless dead-end). Also represented by blockchain address.
- **Topic**: A governance domain or category (e.g., "Climate Policy", "Education", "Treasury Management"). Each topic has an independent delegation graph.
- **Delegation**: A relationship from one address to another for a specific topic, transferring voting power. Includes delegator address, delegate address, topic ID, and timestamp.
- **Dead-End Declaration**: A self-imposed constraint by a delegate indicating they will not delegate further on a specific topic. Includes delegate address, topic ID, and status.
- **Voting Power**: Accumulated vote weight for an address on a specific topic, calculated as direct power plus all transitively delegated power. Computed off-chain via enclave.
- **Enclave Attestation**: Cryptographic proof that vote weight computation was performed inside a trusted execution environment, verified on-chain before accepting results.
- **Reward Stream**: Continuous token flow to a delegate proportional to their voting power on a topic, managed via streaming payment protocol.
- **Proposal**: A governance decision to be voted on, created by delegates with sufficient voting power. Scoped to a specific topic with voting period start/end times, description, and vote tally (yes/no/abstain).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Voters can successfully delegate and revoke voting power on specific topics with transaction confirmation in under 30 seconds
- **SC-002**: System correctly computes voting power distribution for delegation graphs with up to 1000 participants and maximum 7 delegation chain depth
- **SC-003**: Enclave-computed voting power results are verifiable on-chain with attestation validation success rate of 100%
- **SC-004**: Delegation graph visualization loads and displays up to 500 nodes and edges in under 5 seconds
- **SC-005**: 90% of users can successfully complete their first delegation action without external help or documentation
- **SC-006**: Streaming rewards adjust within 5 minutes of delegation or revocation actions affecting voting power
- **SC-007**: System prevents and rejects 100% of attempted cyclic delegations
- **SC-008**: Prototype is successfully deployed and functional on testnet with at least 50 test transactions demonstrating all core features
- **SC-009**: At least 80% of test participants report that the delegation process is easier and more flexible than traditional voting
- **SC-010**: Zero security vulnerabilities related to vote weight manipulation or unauthorized delegation changes in initial audit
