# Tasks: Liquid Democracy Engine

**Input**: Design documents from `/specs/001-liquid-democracy-engine/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Following Test-First Development (TDD) principle per constitution - tests written FIRST before implementation

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Smart Contracts**: `contracts/src/`, `contracts/test/`
- **Enclave Service**: `enclave-service/src/`, `enclave-service/tests/`
- **Frontend**: `frontend/src/`, `frontend/src/tests/`
- **E2E Tests**: `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Initialize monorepo structure with contracts/, enclave-service/, and frontend/ directories
- [ ] T002 [P] Initialize Hardhat project in contracts/ with Solidity 0.8.19+ and TypeScript support
- [ ] T003 [P] Initialize Foundry in contracts/ for testing with forge init
- [ ] T004 [P] Initialize Node.js project in enclave-service/ with TypeScript 5.0+ configuration
- [ ] T005 [P] Initialize Svelte 4+ project in frontend/ with Vite build system
- [ ] T006 [P] Configure Hardhat networks for Gnosis Chiado testnet in hardhat.config.ts
- [ ] T007 [P] Install OpenZeppelin Contracts v5.0+ in contracts/ package.json
- [ ] T008 [P] Install Enclave.gg SDK in enclave-service/ package.json
- [ ] T009 [P] Install Superfluid Protocol SDK in contracts/ and frontend/ package.json
- [ ] T010 [P] Install Ethers.js v6 in frontend/ and enclave-service/ package.json
- [ ] T011 [P] Install Cytoscape.js in frontend/ package.json
- [ ] T012 [P] Configure ESLint and Prettier for TypeScript in all packages
- [ ] T013 [P] Configure Vitest for TypeScript testing in enclave-service/ and frontend/
- [ ] T014 [P] Install and configure Playwright for E2E testing in tests/e2e/
- [ ] T015 [P] Create .env.example files in contracts/, enclave-service/, and frontend/
- [ ] T016 Setup GitHub Actions or CI pipeline configuration for automated testing

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Smart Contract Interfaces

- [ ] T017 [P] Create IDelegationManager interface in contracts/src/interfaces/IDelegationManager.sol
- [ ] T018 [P] Create IVotePowerVerifier interface in contracts/src/interfaces/IVotePowerVerifier.sol
- [ ] T019 [P] Create IRewardDistributor interface in contracts/src/interfaces/IRewardDistributor.sol
- [ ] T020 [P] Create ITopicRegistry interface in contracts/src/interfaces/ITopicRegistry.sol
- [ ] T021 [P] Create IEnclaveOperator interface in contracts/src/interfaces/IEnclaveOperator.sol

### Core Smart Contract Libraries

- [ ] T022 [P] Implement DelegationGraph library in contracts/src/libraries/DelegationGraph.sol for graph traversal and cycle detection
- [ ] T023 [P] Implement AttestationLib library in contracts/src/libraries/AttestationLib.sol for attestation validation utilities

### Core Smart Contracts (Foundational)

- [ ] T024 Create TopicRegistry contract in contracts/src/core/TopicRegistry.sol with topic management
- [ ] T025 Implement VotePowerVerifier contract in contracts/src/core/VotePowerVerifier.sol with enclave operator management and attestation verification
- [ ] T026 Create base DelegationManager contract in contracts/src/core/DelegationManager.sol with storage structures (no delegation logic yet)

### Enclave Service Foundation

- [ ] T027 [P] Create enclave SDK wrapper in enclave-service/src/lib/enclave-sdk.ts for Enclave.gg integration
- [ ] T028 [P] Implement graph algorithms (DFS/BFS) in enclave-service/src/lib/graph-algorithms.ts for transitive delegation
- [ ] T029 Create ChainListener service in enclave-service/src/services/ChainListener.ts for listening to contract events
- [ ] T030 Create ResultSubmitter service in enclave-service/src/services/ResultSubmitter.ts for submitting attestations to blockchain

### Frontend Foundation

- [ ] T031 [P] Create wallet connection service in frontend/src/lib/web3/walletConnect.ts with MetaMask/WalletConnect support
- [ ] T032 [P] Create contract ABIs directory and type definitions in frontend/src/lib/contracts/
- [ ] T033 [P] Create event listener service in frontend/src/lib/web3/eventListener.ts for contract event subscriptions
- [ ] T034 [P] Create ConnectWallet component in frontend/src/components/wallet/ConnectWallet.svelte
- [ ] T035 [P] Create WalletStatus component in frontend/src/components/wallet/WalletStatus.svelte
- [ ] T035a [P] Security test for wallet edge cases in frontend/src/tests/integration/wallet-security.test.ts (disconnection during transaction, network mismatch, invalid signature)
- [ ] T036 Create main layout with wallet integration in frontend/src/routes/+layout.svelte

### Deployment and Setup Scripts

- [ ] T037 [P] Create Hardhat deployment script for TopicRegistry in contracts/scripts/deploy.ts
- [ ] T038 [P] Create topic initialization script in contracts/scripts/setup-topics.ts
- [ ] T039 [P] Create environment configuration management in all packages

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Delegate Vote on a Topic (Priority: P1) 🎯 MVP

**Goal**: Enable voters to delegate their voting power on specific topics to trusted delegates with transitive delegation support

**Independent Test**: Connect wallet, select topic, choose delegate address, confirm delegation transaction, verify voting power transferred to delegate through transitive chain

### Tests for User Story 1 - Write FIRST, Ensure FAIL ⚠️

- [ ] T040 [P] [US1] Unit test for DelegationManager.delegate() in contracts/test/unit/DelegationManager.t.sol covering basic delegation
- [ ] T041 [P] [US1] Unit test for transitive delegation (A→B→C) in contracts/test/unit/DelegationManager.t.sol
- [ ] T042 [P] [US1] Unit test for cycle detection in DelegationGraph library in contracts/test/unit/DelegationGraph.t.sol
- [ ] T043 [P] [US1] Unit test for max depth validation (7 levels) in contracts/test/unit/DelegationManager.t.sol
- [ ] T044 [P] [US1] Security test for reentrancy protection in contracts/test/security/Reentrancy.t.sol
- [ ] T045 [P] [US1] Integration test for end-to-end delegation flow in contracts/test/integration/EndToEndDelegation.t.sol
- [ ] T046 [P] [US1] Enclave service test for GraphComputer in enclave-service/tests/GraphComputer.test.ts
- [ ] T047 [P] [US1] Frontend component test for TopicSelector in frontend/src/tests/components/delegation/TopicSelector.test.ts
- [ ] T048 [P] [US1] Frontend component test for DelegateInput in frontend/src/tests/components/delegation/DelegateInput.test.ts
- [ ] T049 [P] [US1] E2E test for delegation user journey in tests/e2e/delegation.spec.ts

### Implementation for User Story 1

**Smart Contract Implementation**

- [ ] T050 [US1] Implement delegate() function in contracts/src/core/DelegationManager.sol with validation (no self-delegation, active topic)
- [ ] T051 [US1] Add cycle detection to delegate() using DelegationGraph library in contracts/src/core/DelegationManager.sol
- [ ] T052 [US1] Add max depth validation (7 levels) to delegate() in contracts/src/core/DelegationManager.sol
- [ ] T053 [US1] Add Delegated event emission with indexed parameters in contracts/src/core/DelegationManager.sol
- [ ] T054 [US1] Implement getDelegation() view function in contracts/src/core/DelegationManager.sol
- [ ] T055 [US1] Implement getDelegationDepth() view function in contracts/src/core/DelegationManager.sol
- [ ] T056 [US1] Add ReentrancyGuard protection to delegate() function in contracts/src/core/DelegationManager.sol
- [ ] T056a [US1] Add one-vote-per-voter validation (FR-017) in contracts/src/core/DelegationManager.sol

**Enclave Service Implementation**

- [ ] T057 [P] [US1] Implement EnclaveOperator main service in enclave-service/src/operators/EnclaveOperator.ts
- [ ] T058 [US1] Implement GraphComputer for delegation graph traversal and voting power calculation in enclave-service/src/operators/GraphComputer.ts
- [ ] T059 [US1] Implement AttestationSigner for TEE attestation generation in enclave-service/src/operators/AttestationSigner.ts
- [ ] T060 [US1] Integrate ChainListener to detect Delegated events in enclave-service/src/operators/EnclaveOperator.ts
- [ ] T061 [US1] Integrate ResultSubmitter to submit attestations to VotePowerVerifier in enclave-service/src/operators/EnclaveOperator.ts

**Frontend Implementation**

- [ ] T062 [P] [US1] Create TopicSelector component in frontend/src/components/delegation/TopicSelector.svelte
- [ ] T063 [P] [US1] Create DelegateInput component in frontend/src/components/delegation/DelegateInput.svelte
- [ ] T064 [P] [US1] Create DelegationList component to display current delegations in frontend/src/components/delegation/DelegationList.svelte
- [ ] T065 [US1] Create delegation service for transaction builders in frontend/src/lib/web3/delegationService.ts
- [ ] T066 [US1] Create delegation page integrating all components in frontend/src/routes/delegate/+page.svelte
- [ ] T067 [US1] Add transaction status tracking and user feedback to delegation page
- [ ] T068 [US1] Add error handling for delegation failures (cycle, depth, invalid delegate)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Users can delegate voting power on topics with transitive delegation support.

---

## Phase 4: User Story 2 - Revoke Delegation and Reclaim Vote (Priority: P2)

**Goal**: Enable voters to revoke their delegations and reclaim voting power for direct voting or re-delegation

**Independent Test**: Delegate voting power (using US1), then revoke delegation and verify voting power returns to original voter, observe downstream chain updates

### Tests for User Story 2 - Write FIRST, Ensure FAIL ⚠️

- [ ] T069 [P] [US2] Unit test for DelegationManager.revoke() in contracts/test/unit/DelegationManager.t.sol
- [ ] T070 [P] [US2] Unit test for revocation impact on delegation chains in contracts/test/unit/DelegationManager.t.sol
- [ ] T071 [P] [US2] Unit test for topic-specific revocation (keeping other delegations intact) in contracts/test/unit/DelegationManager.t.sol
- [ ] T072 [P] [US2] Integration test for revocation triggering voting power recalculation in contracts/test/integration/EndToEndDelegation.t.sol
- [ ] T073 [P] [US2] Enclave service test for voting power updates after revocation in enclave-service/tests/GraphComputer.test.ts
- [ ] T074 [P] [US2] Frontend component test for RevokeDelegation in frontend/src/tests/components/delegation/RevokeDelegation.test.ts
- [ ] T075 [P] [US2] E2E test for revocation user journey in tests/e2e/revocation.spec.ts

### Implementation for User Story 2

**Smart Contract Implementation**

- [ ] T076 [US2] Implement revoke() function in contracts/src/core/DelegationManager.sol with topic validation
- [ ] T077 [US2] Add Revoked event emission with indexed parameters in contracts/src/core/DelegationManager.sol
- [ ] T078 [US2] Handle no-op case when no delegation exists in revoke() function
- [ ] T079 [US2] Add ReentrancyGuard protection to revoke() function in contracts/src/core/DelegationManager.sol

**Enclave Service Implementation**

- [ ] T080 [US2] Update ChainListener to detect Revoked events in enclave-service/src/services/ChainListener.ts
- [ ] T081 [US2] Update GraphComputer to handle revocation and recalculate voting power distribution in enclave-service/src/operators/GraphComputer.ts
- [ ] T082 [US2] Ensure attestation generation includes revocation-triggered power changes in enclave-service/src/operators/AttestationSigner.ts

**Frontend Implementation**

- [ ] T083 [P] [US2] Create RevokeDelegation component in frontend/src/components/delegation/RevokeDelegation.svelte
- [ ] T084 [US2] Add revoke() function to delegation service in frontend/src/lib/web3/delegationService.ts
- [ ] T085 [US2] Integrate RevokeDelegation component into delegation page in frontend/src/routes/delegate/+page.svelte
- [ ] T086 [US2] Add confirmation dialog for revocation action
- [ ] T087 [US2] Update DelegationList to show revoke button for active delegations

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Users can delegate and revoke at will with proper voting power updates.

---

## Phase 5: User Story 3 - Declare Dead-End to Prevent Further Delegation (Priority: P3)

**Goal**: Enable delegates to signal trust by declaring they will personally vote and not delegate further

**Independent Test**: Delegate marks self as dead-end for topic, attempt to delegate that topic further and see transaction fail, view dead-end status in profile

### Tests for User Story 3 - Write FIRST, Ensure FAIL ⚠️

- [ ] T088 [P] [US3] Unit test for DelegationManager.declareDeadEnd() in contracts/test/unit/DelegationManager.t.sol
- [ ] T089 [P] [US3] Unit test for dead-end preventing further delegation in contracts/test/unit/DelegationManager.t.sol
- [ ] T090 [P] [US3] Unit test for revoking dead-end declaration in contracts/test/unit/DelegationManager.t.sol
- [ ] T091 [P] [US3] Unit test for isDeadEnd() view function in contracts/test/unit/DelegationManager.t.sol
- [ ] T092 [P] [US3] Integration test for dead-end in delegation chains in contracts/test/integration/EndToEndDelegation.t.sol
- [ ] T093 [P] [US3] E2E test for dead-end declaration user journey in tests/e2e/dead-end.spec.ts

### Implementation for User Story 3

**Smart Contract Implementation**

- [ ] T094 [US3] Implement declareDeadEnd() function in contracts/src/core/DelegationManager.sol
- [ ] T095 [US3] Implement revokeDeadEnd() function in contracts/src/core/DelegationManager.sol
- [ ] T096 [US3] Add dead-end validation to delegate() function preventing delegation by dead-end delegates
- [ ] T097 [US3] Implement isDeadEnd() view function in contracts/src/core/DelegationManager.sol
- [ ] T098 [US3] Add DeadEndDeclared and DeadEndRevoked events with indexed parameters in contracts/src/core/DelegationManager.sol

**Enclave Service Implementation**

- [ ] T099 [US3] Update ChainListener to detect DeadEndDeclared and DeadEndRevoked events in enclave-service/src/services/ChainListener.ts
- [ ] T100 [US3] Update GraphComputer to respect dead-end constraints in delegation chain traversal in enclave-service/src/operators/GraphComputer.ts

**Frontend Implementation**

- [ ] T101 [P] [US3] Create DeadEndToggle component in frontend/src/components/delegation/DeadEndToggle.svelte
- [ ] T102 [P] [US3] Create DelegateProfile component showing dead-end status in frontend/src/components/delegation/DelegateProfile.svelte
- [ ] T103 [US3] Add declareDeadEnd() and revokeDeadEnd() functions to delegation service in frontend/src/lib/web3/delegationService.ts
- [ ] T104 [US3] Integrate dead-end toggle into delegation page for delegates
- [ ] T105 [US3] Display dead-end status badge when viewing potential delegates

**Checkpoint**: All three core delegation user stories (delegate, revoke, dead-end) are now independently functional.

---

## Phase 6: User Story 4 - View Delegation Graph and Voting Power Distribution (Priority: P4)

**Goal**: Provide transparency through visual delegation graph showing voting power flows and delegation chains

**Independent Test**: Navigate to topic graph view, see interactive visualization of delegation relationships with node sizes proportional to voting power, click nodes for details, trace vote path

### Tests for User Story 4 - Write FIRST, Ensure FAIL ⚠️

- [ ] T106 [P] [US4] Frontend unit test for graph data fetching in frontend/src/tests/lib/graph/delegationGraph.test.ts
- [ ] T107 [P] [US4] Frontend component test for DelegationGraphView rendering in frontend/src/tests/components/graph/DelegationGraphView.test.ts
- [ ] T108 [P] [US4] Frontend component test for VotePowerDetails panel in frontend/src/tests/components/graph/VotePowerDetails.test.ts
- [ ] T109 [P] [US4] E2E test for graph visualization load performance (<5s for 500 nodes) in tests/e2e/graph-visualization.spec.ts
- [ ] T110 [P] [US4] E2E test for "trace my vote" functionality in tests/e2e/graph-visualization.spec.ts
- [ ] T110a [P] [US4] E2E test for 'trace my vote' path highlighting accuracy in tests/e2e/graph-visualization.spec.ts

### Implementation for User Story 4

**Smart Contract Support** (read-only, uses existing data)

- [ ] T111 [P] [US4] Add getAllDelegationsForTopic() view function in contracts/src/core/DelegationManager.sol for graph data export
- [ ] T112 [P] [US4] Add getVotingPowerForTopic() view function in contracts/src/core/VotePowerVerifier.sol

**Frontend Implementation**

- [ ] T113 [P] [US4] Create delegation graph data fetching service in frontend/src/lib/graph/delegationGraph.ts
- [ ] T114 [P] [US4] Create Cytoscape visualization wrapper in frontend/src/lib/graph/visualization.ts
- [ ] T115 [US4] Create DelegationGraphView component in frontend/src/components/graph/DelegationGraphView.svelte with Cytoscape integration
- [ ] T116 [P] [US4] Create VotePowerDetails panel component in frontend/src/components/graph/VotePowerDetails.svelte
- [ ] T117 [US4] Implement force-directed layout configuration (cola or fcose) for graph visualization
- [ ] T118 [US4] Implement node styling (size proportional to voting power, color coding for dead-ends)
- [ ] T119 [US4] Implement edge styling (direct vs transitive delegation)
- [ ] T120 [US4] Add click handlers for node selection and details panel display
- [ ] T121 [US4] Implement "trace my vote" path highlighting from user address to terminal delegate
- [ ] T122 [US4] Create graph visualization page in frontend/src/routes/graph/+page.svelte
- [ ] T123 [US4] Add real-time graph updates on delegation/revocation events
- [ ] T124 [US4] Optimize graph rendering for 500+ nodes with viewport culling if needed

**Checkpoint**: Transparency is now complete. Users can visualize delegation flows and make informed delegation decisions.

---

## Phase 7: User Story 5 - Earn Streaming Rewards Based on Voting Power (Priority: P5)

**Goal**: Economic sustainability through streaming token rewards to delegates proportional to accumulated voting power

**Independent Test**: Accumulate voting power as delegate, observe continuous token stream proportional to power share, see stream adjust when delegations change

### Tests for User Story 5 - Write FIRST, Ensure FAIL ⚠️

- [ ] T125 [P] [US5] Unit test for RewardDistributor.updateFlows() in contracts/test/unit/RewardDistributor.t.sol
- [ ] T126 [P] [US5] Unit test for proportional flow rate calculation in contracts/test/unit/RewardDistributor.t.sol
- [ ] T127 [P] [US5] Unit test for stream creation/update/deletion lifecycle in contracts/test/unit/RewardDistributor.t.sol
- [ ] T128 [P] [US5] Integration test for reward flow updates after delegation changes in contracts/test/integration/RewardFlow.t.sol
- [ ] T129 [P] [US5] Security test for reentrancy in Superfluid callbacks in contracts/test/security/Reentrancy.t.sol
- [ ] T130 [P] [US5] Frontend component test for RewardsDashboard in frontend/src/tests/components/rewards/RewardsDashboard.test.ts

### Implementation for User Story 5

**Smart Contract Implementation**

- [ ] T131 [US5] Implement RewardDistributor contract in contracts/src/rewards/RewardDistributor.sol inheriting SuperAppBase
- [ ] T132 [US5] Implement updateFlows() function with batched flow rate updates in contracts/src/rewards/RewardDistributor.sol
- [ ] T133 [US5] Implement proportional flow rate calculation: flowRate = (votingPower / totalVotingPower) * poolFlowRate
- [ ] T134 [US5] Integrate Superfluid CFA for createFlow(), updateFlow(), deleteFlow() operations
- [ ] T135 [US5] Add FlowCreated, FlowUpdated, FlowDeleted events in contracts/src/rewards/RewardDistributor.sol
- [ ] T136 [US5] Implement admin function to fund reward pool with Super Tokens
- [ ] T137 [US5] Add ReentrancyGuard protection to Superfluid callback functions
- [ ] T138 [US5] Handle edge cases: delegate power drops to 0 → delete flow, new delegate → create flow

**Enclave to Rewards Integration**

- [ ] T139 [US5] Update ResultSubmitter to notify RewardDistributor after attestation acceptance in enclave-service/src/services/ResultSubmitter.ts
- [ ] T140 [US5] Implement batched reward update logic (5-minute intervals) in enclave-service/src/services/RewardBatcher.ts

**Deployment Scripts**

- [ ] T141 [P] [US5] Create RewardDistributor deployment script in contracts/scripts/deploy.ts
- [ ] T142 [P] [US5] Create script to deploy/wrap Super Token for rewards in contracts/scripts/setup-rewards.ts
- [ ] T143 [P] [US5] Create script to fund reward pool in contracts/scripts/fund-rewards.ts

**Frontend Implementation**

- [ ] T144 [P] [US5] Create RewardsDashboard component in frontend/src/components/rewards/RewardsDashboard.svelte
- [ ] T145 [P] [US5] Create rewards data fetching service using Superfluid SDK in frontend/src/lib/web3/rewardsService.ts
- [ ] T146 [US5] Create rewards page in frontend/src/routes/rewards/+page.svelte
- [ ] T147 [US5] Display real-time accruing rewards with per-second updates
- [ ] T148 [US5] Show separate streams per topic with voting power breakdown
- [ ] T149 [US5] Add visual indication of flow rate changes after delegation updates
- [ ] T149a Validate reward adjustment timing meets 5-minute target (SC-006) in enclave-service/tests/integration/

**Checkpoint**: Economic incentive layer complete. Delegates earn continuous rewards proportional to trust placed in them.

---

## Phase 8: Enclave Attestation and Vote Power Verification (Cross-Cutting)

**Purpose**: Complete the enclave attestation verification flow for secure voting power computation

**Note**: This phase completes the M-of-N attestation system referenced in earlier user stories

### Tests - Write FIRST, Ensure FAIL ⚠️

- [ ] T150 [P] Unit test for VotePowerVerifier.submitAttestation() in contracts/test/unit/VotePowerVerifier.t.sol
- [ ] T151 [P] Unit test for M-of-N signature verification (3-of-5) in contracts/test/unit/VotePowerVerifier.t.sol
- [ ] T152 [P] Unit test for replay protection (nonce validation) in contracts/test/unit/VotePowerVerifier.t.sol
- [ ] T153 [P] Security test for attestation validation in contracts/test/security/AttestationValidation.t.sol
- [ ] T154 [P] Integration test for full enclave computation flow in enclave-service/tests/integration/FullFlow.test.ts

### Implementation

**Smart Contract Implementation**

- [ ] T155 Implement operator management (add/remove operators) in contracts/src/core/VotePowerVerifier.sol with AccessControl
- [ ] T156 Implement submitAttestation() function with M-of-N signature verification in contracts/src/core/VotePowerVerifier.sol
- [ ] T157 Add ECDSA signature recovery and operator validation using AttestationLib
- [ ] T158 Implement replay protection with nonce tracking in contracts/src/core/VotePowerVerifier.sol
- [ ] T159 Implement block number freshness validation (<100 blocks)
- [ ] T160 Add AttestationSubmitted, AttestationAccepted, AttestationRejected events
- [ ] T161 Implement voting power cache updates after attestation acceptance
- [ ] T162 Add operator registration functions (addOperator, removeOperator) with role-based access

**Enclave Service Completion**

- [ ] T163 Finalize attestation submission with M-of-N multi-operator coordination in enclave-service/src/services/ResultSubmitter.ts
- [ ] T164 Add error handling and retry logic for failed attestation submissions
- [ ] T165 Implement attestation monitoring and logging for transparency
- [ ] T165a [P] Create attestation validation success rate measurement task in enclave-service/tests/ to verify SC-003 (100% validation rate)

**Checkpoint**: Secure computation layer complete. Voting power is verifiably computed off-chain with multi-operator consensus.

---

## Phase 9: Proposal System (Future Enhancement - Optional for MVP)

**Purpose**: Enable delegates to create proposals and voters to vote with accumulated power

**Note**: This phase is optional for MVP but included for completeness based on spec.md entities

### Tests - Write FIRST, Ensure FAIL ⚠️

- [ ] T166 [P] Unit test for ProposalManager.createProposal() in contracts/test/unit/ProposalManager.t.sol
- [ ] T167 [P] Unit test for voting power threshold check in contracts/test/unit/ProposalManager.t.sol
- [ ] T168 [P] Unit test for vote() with delegation validation in contracts/test/unit/ProposalManager.t.sol
- [ ] T169 [P] Unit test for voting power snapshot at vote close in contracts/test/unit/ProposalManager.t.sol
- [ ] T170 [P] Integration test for full proposal lifecycle in contracts/test/integration/ProposalLifecycle.t.sol

### Implementation

**Smart Contract Implementation**

- [ ] T171 [P] Create IProposalManager interface in contracts/src/interfaces/IProposalManager.sol
- [ ] T172 Create ProposalManager contract in contracts/src/core/ProposalManager.sol
- [ ] T173 Implement createProposal() with voting power threshold check (FR-022, FR-023)
- [ ] T174 Implement vote() function with double-voting prevention (FR-016)
- [ ] T175 Implement voting power snapshot at proposal close time (FR-020)
- [ ] T176 Implement proposal status transitions (Pending → Active → Passed/Rejected)
- [ ] T177 Add ProposalCreated, VoteCast, ProposalStatusChanged events

**Frontend Implementation**

- [ ] T178 [P] Create ProposalList component in frontend/src/components/proposals/ProposalList.svelte
- [ ] T179 [P] Create CreateProposal component in frontend/src/components/proposals/CreateProposal.svelte
- [ ] T180 [P] Create VoteOnProposal component in frontend/src/components/proposals/VoteOnProposal.svelte
- [ ] T181 Create proposal page in frontend/src/routes/proposals/+page.svelte
- [ ] T182 [P] Install IPFS client SDK (Pinata or Web3.Storage) in frontend/package.json
- [ ] T183 Implement proposal metadata upload to IPFS in frontend/src/lib/ipfs/uploadMetadata.ts
- [ ] T184 Implement IPFS CID retrieval and caching in frontend/src/lib/ipfs/fetchMetadata.ts
- [ ] T185 [P] Test IPFS upload/retrieval round-trip in frontend/src/tests/integration/ipfs.test.ts

**Checkpoint**: Governance system complete with proposal creation and voting.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and deployment readiness

- [ ] T186 [P] Run Slither static analysis on all Solidity contracts
- [ ] T187 [P] Run Mythril security analysis on all Solidity contracts
- [ ] T188 [P] Verify all contracts pass 24KB size limit constraint
- [ ] T189 [P] Optimize contract bytecode if size limit exceeded (use libraries, external functions)
- [ ] T190 [P] Create comprehensive deployment documentation in docs/deployment.md
- [ ] T191 [P] Create user guide for delegation in docs/user-guide.md
- [ ] T192 [P] Create operator setup guide in docs/operator-setup.md
- [ ] T193 Deploy complete system to Gnosis Chiado testnet
- [ ] T194 Verify all contracts on Gnosisscan block explorer
- [ ] T195 Setup initial topics via setup-topics.ts script
- [ ] T196 Initialize enclave operator set (5 operators) for testnet
- [ ] T197 Fund reward pools with test Super Tokens
- [ ] T198 Run quickstart.md validation with 50+ test transactions (SC-008)
- [ ] T199 [P] Performance testing: delegation transaction confirmation <30s (SC-001)
- [ ] T200 [P] Performance testing: graph visualization load <5s for 500 nodes (SC-004)
- [ ] T201 [P] Stress testing: 1000 participants with max 7 delegation depth (SC-002)
- [ ] T202 [P] Security testing: verify 100% cycle rejection rate (SC-007)
- [ ] T203 [P] UX testing: 90% user success rate for first delegation (SC-005)
- [ ] T203a Create UX survey protocol and data collection form for SC-005 and SC-009 (90% first-delegation success, 80% satisfaction)
- [ ] T204 Conduct internal security audit or arrange external audit
- [ ] T204a Create security vulnerability checklist aligned with SC-010 (zero vote manipulation/unauthorized delegation vulnerabilities)
- [ ] T205 [P] Add comprehensive inline documentation to all smart contracts
- [ ] T206 [P] Add comprehensive inline documentation to enclave service
- [ ] T207 [P] Add comprehensive inline documentation to frontend components
- [ ] T208 Create architecture diagram in docs/architecture.md
- [ ] T209 Update CLAUDE.md with deployment configuration and common commands
- [ ] T210 Create demo video or screenshots for documentation
- [ ] T211 Prepare testnet demo environment with sample delegations and graph visualization
- [ ] T212 Document delegation concentration monitoring approach in docs/governance.md (FR-021: no hard limits enforced)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4 → P5)
- **Enclave Attestation (Phase 8)**: Can proceed in parallel with user stories 1-3, must complete before US5
- **Proposal System (Phase 9)**: Optional, depends on US1-2 completion
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses US1 delegation function but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Enhances US1 but independently testable
- **User Story 4 (P4)**: Can start after US1-3 have contract implementations (needs delegation data) - Independently testable
- **User Story 5 (P5)**: Depends on Phase 8 (Enclave Attestation) completion - Independently testable once attestation works

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Smart contract interfaces and libraries before implementations
- Smart contracts before enclave service integration
- Smart contracts before frontend components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**: All tasks T002-T015 marked [P] can run in parallel

**Phase 2 (Foundational)**:
- Contract interfaces T017-T021 can run in parallel
- Contract libraries T022-T023 can run in parallel
- Enclave foundation T027-T028 can run in parallel with contract work
- Frontend foundation T031-T035 can run in parallel with backend work
- Scripts T037-T039 can run in parallel

**Within Each User Story**:
- All tests marked [P] can run in parallel
- Models/components in different files marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

**Phase 10 (Polish)**:
- Security analysis T183-T184 can run in parallel
- Documentation tasks T187-T189 and T202-T204 can run in parallel
- Performance tests T196-T200 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (after writing them):
Task T040: "Unit test for DelegationManager.delegate()"
Task T041: "Unit test for transitive delegation"
Task T042: "Unit test for cycle detection"
Task T043: "Unit test for max depth validation"
Task T044: "Security test for reentrancy protection"
Task T045: "Integration test for end-to-end delegation"
Task T046: "Enclave service test for GraphComputer"
Task T047: "Frontend component test for TopicSelector"
Task T048: "Frontend component test for DelegateInput"
Task T049: "E2E test for delegation user journey"

# Launch parallel enclave and frontend work (after contracts done):
Task T057: "Implement EnclaveOperator main service"
Task T062: "Create TopicSelector component"
Task T063: "Create DelegateInput component"
Task T064: "Create DelegationList component"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T016)
2. Complete Phase 2: Foundational (T017-T039) - CRITICAL blocking phase
3. Complete Phase 3: User Story 1 (T040-T068) - Delegation with transitive support
4. Complete Phase 8: Enclave Attestation (T150-T165) - Required for US1 voting power computation
5. **STOP and VALIDATE**: Test User Story 1 independently with full attestation flow
6. Deploy minimal MVP to testnet (T190-T194)

### Incremental Delivery (Recommended)

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 + Enclave Attestation → Test independently → **Deploy/Demo MVP!** (Core delegation working)
3. Add User Story 2 → Test independently → Deploy/Demo (Revocation adds flexibility)
4. Add User Story 3 → Test independently → Deploy/Demo (Dead-end adds trust signaling)
5. Add User Story 4 → Test independently → Deploy/Demo (Transparency via visualization)
6. Add User Story 5 → Test independently → Deploy/Demo (Economic sustainability)
7. Optionally add Proposal System (Phase 9) for full governance
8. Polish and Production Readiness (Phase 10)

### Parallel Team Strategy

With 3+ developers after Foundational phase completes:

- **Developer A**: User Story 1 (Smart Contracts + Tests)
- **Developer B**: Enclave Service (Foundation + US1 integration)
- **Developer C**: Frontend (Foundation + US1 components)

Then continue with US2, US3, US4, US5 in parallel or sequentially based on priorities.

---

## Task Summary

**Total Tasks**: 208
- **Phase 1 (Setup)**: 16 tasks
- **Phase 2 (Foundational)**: 23 tasks - BLOCKS all user stories
- **Phase 3 (User Story 1 - P1)**: 29 tasks (10 tests + 19 implementation)
- **Phase 4 (User Story 2 - P2)**: 19 tasks (7 tests + 12 implementation)
- **Phase 5 (User Story 3 - P3)**: 18 tasks (6 tests + 12 implementation)
- **Phase 6 (User Story 4 - P4)**: 19 tasks (5 tests + 14 implementation)
- **Phase 7 (User Story 5 - P5)**: 25 tasks (6 tests + 19 implementation)
- **Phase 8 (Enclave Attestation)**: 16 tasks (5 tests + 11 implementation)
- **Phase 9 (Proposal System - Optional)**: 17 tasks (5 tests + 12 implementation)
- **Phase 10 (Polish)**: 26 tasks

**Parallel Opportunities**: 87 tasks marked [P] can run in parallel within their phases

**Independent Test Criteria**:
- **US1**: Successfully delegate voting power with transitive support, verify power flows to final delegate
- **US2**: Revoke delegation, verify power returns, observe chain updates
- **US3**: Declare dead-end, attempt delegation (should fail), view status
- **US4**: View graph with 500 nodes in <5s, trace vote path, see power distribution
- **US5**: Accumulate power, see streaming rewards, observe adjustments on delegation changes

**MVP Scope**: Phases 1-3 + Phase 8 (Setup + Foundational + US1 + Enclave Attestation) = **68 tasks**

**Constitution Compliance**:
- ✅ Test-First Development: Tests written before implementation for all phases
- ✅ Library-First Architecture: Clear interfaces and modular components
- ✅ Simplicity & YAGNI: MVP focused, proven patterns (OpenZeppelin, Superfluid)
- ✅ Smart Contract Security: Security tests, reentrancy guards, access control
- ✅ Observability: Events for all state changes, graph visualization, comprehensive logging

---

## Notes

- **[P] tasks**: Different files, no dependencies, can run in parallel
- **[Story] label**: Maps task to specific user story for traceability
- **Test-First**: ALL tests must be written FIRST and FAIL before implementation begins
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Stop at any checkpoint to validate story independently
- Phase 2 (Foundational) is CRITICAL - nothing else can proceed until complete
- Constitution requires no violations - all architecture decisions documented in research.md
- Target network: Gnosis Chiado testnet for MVP deployment
- Performance targets: <30s confirmation, <5s graph load, 1000 participants supported
