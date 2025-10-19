# Implementation Plan: Liquid Democracy Engine

**Branch**: `001-liquid-democracy-engine` | **Date**: 2025-10-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-liquid-democracy-engine/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

The Liquid Democracy Engine (LDE) is a decentralized governance protocol enabling topic-specific, revocable vote delegation with secure off-chain computation via Trusted Execution Environments (TEEs). The system allows voters to delegate their voting power per topic to trusted delegates, supports transitive delegation chains (up to 7 levels), and includes streaming token rewards proportional to accumulated voting power. All voting power computations are performed in real-time by multiple enclave operators with M-of-N attestation consensus, ensuring privacy-preserving yet verifiable governance.

Technical approach: Smart contracts (Solidity) handle on-chain delegation relationships and attestation verification; Enclave.gg TEEs compute voting power distributions off-chain; Superfluid manages streaming rewards; Svelte frontend with Web3 wallet integration provides user interface with delegation graph visualization.

## Technical Context

**Language/Version**: Solidity 0.8.19+ (smart contracts), TypeScript 5.0+ (frontend), Node.js 20+ (enclave operator service)
**Primary Dependencies**: Hardhat (contract development), OpenZeppelin Contracts v5.0+, Enclave.gg SDK, Superfluid Protocol SDK, Svelte 4+, Ethers.js v6, Cytoscape.js (graph visualization per research.md Section 3)
**Storage**: On-chain EVM state (delegation relationships, attestations), Off-chain enclave computation (voting power graphs), IPFS (proposal metadata per research.md Section 1)
**Testing**: Hardhat/Foundry (Solidity), Vitest (TypeScript/frontend), Playwright (E2E)
**Target Platform**: Gnosis Chain (primary target), EVM-compatible chains (Ethereum mainnet, Polygon for future deployment)
**Project Type**: Web application (blockchain dApp) - frontend + smart contracts + enclave service
**Performance Goals**: <30s transaction confirmation (SC-001), <5s graph visualization load for 500 nodes (SC-004), real-time enclave computation per transaction
**Constraints**: 24KB contract size limit, 7-level max delegation chain depth, 3-of-5 enclave attestation threshold (M=3, N=5 per research.md Section 2), 5-minute batched reward updates
**Scale/Scope**: MVP target 1000 participants, 500-node graph visualization, multiple independent topic domains, testnet deployment with 50+ test transactions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Library-First Architecture ✅ PASS

**Compliance:**
- Smart contracts organized as modular libraries (DelegationManager, VotePowerComputation, RewardDistributor)
- Frontend components decoupled from blockchain logic (separate services layer for Web3 interactions)
- Enclave computation service as standalone module with defined interface
- Graph visualization as independent component

**Evidence:** Three-tier architecture (contracts / enclave service / frontend) with clear interface boundaries per FR-005, FR-006, FR-013.

### II. Test-First Development (NON-NEGOTIABLE) ✅ CONDITIONAL PASS

**Requirement:** Tests written → user approved → tests fail → then implement

**Compliance Plan:**
- Contract tests written first covering FR-001 through FR-024 (delegation, revocation, attestation verification, cycle detection, depth limits)
- Frontend acceptance tests matching user stories P1-P5
- Integration tests for blockchain interactions before testnet deployment
- Security-focused tests (reentrancy, access control, attestation validation)

**Gate:** This plan phase does NOT write tests - tests MUST be written in implementation phase before any code. User approval of test strategy required before proceeding to `/speckit.tasks`.

### III. Simplicity & YAGNI ✅ PASS

**Compliance:**
- No premature abstraction: single delegation contract vs. complex proxy patterns (start simple)
- Proven patterns only: OpenZeppelin security libraries, standard ERC patterns
- MVP scope clearly bounded: no vote splitting, no dynamic topic creation, pre-funded reward pools
- Complexity justified below where necessary

**Evidence:** Assumptions section explicitly declares out-of-scope features; clarifications chose simpler options (e.g., batched rewards vs. immediate on-chain updates).

### IV. Smart Contract Security ✅ PASS

**Compliance:**
- Checks-effects-interactions pattern for state changes
- Reentrancy guards on external calls (reward distribution, attestation submission)
- Access control for privileged operations (topic management, operator set)
- Cycle detection and depth validation (FR-008, FR-024)
- Multi-operator attestation prevents single point of compromise
- Test suite includes security test cases (per constitution requirement)

**Evidence:** FR-007 requires M-of-N attestation; FR-008 prevents cycles; clarifications establish defense-in-depth (depth limits, threshold consensus).

### V. Observability & Transparency ✅ PASS

**Compliance:**
- Events for all state changes (FR-009: delegation, revocation, dead-end declarations)
- Frontend logging of blockchain interactions
- Public delegation graph (FR-013: users view current state)
- Contract verification on block explorer required
- Clear error messages for transaction failures

**Evidence:** User Story 4 (P4) provides graph visualization; FR-009 mandates events; testnet deployment requirement ensures public verifiability.

### Blockchain-Specific Requirements ✅ PASS

**Smart Contract Standards:**
- Solidity version pinned (0.8.19+ specified above)
- OpenZeppelin security patterns (specified in dependencies)
- Contract size under 24KB (design must verify, flagged for Phase 1 validation)

**Frontend Integration:**
- Web3 wallet integration via standard providers (FR-015, FR-018)
- Transaction status tracking (part of FR-001, FR-002 acceptance criteria)

**Testing Requirements:**
- Unit tests for all contract functions (per TDD principle)
- Integration tests against local blockchain (Hardhat Network)
- Testnet deployment required (SC-008)

**Gate Status:** ✅ All constitution requirements satisfied. No violations requiring justification.

---

## Post-Phase 1 Constitution Re-Check

*GATE: Re-evaluation after design artifacts generated (research.md, data-model.md, contracts/, quickstart.md)*

### I. Library-First Architecture ✅ PASS

**Post-Design Evidence:**
- ✅ Four independent smart contracts with clear interfaces (DelegationManager, VotePowerVerifier, RewardDistributor, TopicRegistry)
- ✅ Enclave service as standalone Node.js module with defined API
- ✅ Frontend components decoupled via services layer (delegationService.ts, web3/)
- ✅ Contract interfaces documented as OpenAPI YAML specs for clear boundaries
- ✅ Data model separates on-chain, off-chain, and client state concerns

**Conclusion:** Design maintains modular library architecture throughout. Each component can be tested and developed independently.

### II. Test-First Development (NON-NEGOTIABLE) ✅ CONDITIONAL PASS

**Post-Design Validation:**
- ✅ Quickstart.md documents test-first workflow: "Write Tests FIRST" before implementation
- ✅ Project structure includes parallel test directories mirroring source (test/unit/, test/integration/, test/security/)
- ✅ Testing stack specified: Foundry for Solidity, Vitest for TypeScript, Playwright for E2E
- ✅ Security test categories identified (reentrancy, access control, attestation validation)

**Gate:** Design phase complete. Implementation phase (via `/speckit.tasks`) MUST follow TDD workflow:
1. Generate test tasks first
2. User approves test strategy
3. Tests written and failing
4. Implementation proceeds

**Conclusion:** Test infrastructure planned. TDD enforcement deferred to task execution phase.

### III. Simplicity & YAGNI ✅ PASS

**Post-Design Evidence:**
- ✅ Research.md chose simplest viable options: IPFS over Arweave, 3-of-5 threshold (standard), Cytoscape over D3 (graph-optimized)
- ✅ No premature abstraction: single contracts vs proxy patterns, batched rewards vs real-time on-chain
- ✅ Data model includes only entities required for MVP user stories (9 core entities, all justified)
- ✅ Hybrid Hardhat+Foundry justified by specific benefits (TypeScript tooling + fast tests)

**Conclusion:** Design decisions prioritize proven patterns and defer complexity. All choices documented with rationale in research.md.

### IV. Smart Contract Security ✅ PASS

**Post-Design Evidence:**
- ✅ Data model specifies validation rules for all entities (cycle detection, depth limits, double-voting prevention)
- ✅ OpenZeppelin security patterns documented in research.md (ReentrancyGuard, AccessControl, SafeCast)
- ✅ Checks-Effects-Interactions pattern shown in research.md code example
- ✅ Multi-operator attestation (3-of-5) prevents single-point compromise
- ✅ Contract interfaces include security responses (AttestationRejected event, validation error enums)
- ✅ Security test suite planned (tests/security/Reentrancy.t.sol, AccessControl.t.sol, AttestationValidation.t.sol)

**Conclusion:** Security requirements translated into concrete design patterns and validation rules. Test suite will enforce security properties.

### V. Observability & Transparency ✅ PASS

**Post-Design Evidence:**
- ✅ Data model defines 11+ event types covering all state changes (Delegated, Revoked, AttestationAccepted, FlowUpdated, etc.)
- ✅ Contract interfaces specify indexed parameters for efficient event filtering
- ✅ Frontend architecture includes eventListener.ts for real-time event subscriptions
- ✅ Quickstart.md includes event monitoring script and troubleshooting section
- ✅ Deployment checklist requires contract verification on Gnosisscan (public transparency)

**Conclusion:** Observability designed into all layers. Events provide audit trail; frontend logs user-facing interactions; contracts publicly verifiable.

### Blockchain-Specific Requirements ✅ PASS

**Post-Design Validation:**
- ✅ Solidity version pinned to 0.8.19+ (research.md, Technical Context)
- ✅ OpenZeppelin v5.0+ specified for security patterns (research.md Section 8)
- ✅ Contract size awareness: plan.md flags 24KB limit for Phase 1 validation
- ✅ Web3 wallet integration: frontend includes walletConnect.ts, supports MetaMask/WalletConnect
- ✅ Testing requirements met: Hardhat for integration tests, Foundry for unit/security tests, Chiado testnet for E2E

**Conclusion:** All blockchain-specific requirements addressed in design.

### Final Gate Status: ✅ ALL CHECKS PASSED

No constitution violations detected. Design phase complete. Ready to proceed to `/speckit.tasks` for task generation and implementation.

## Project Structure

### Documentation (this feature)

```
specs/001-liquid-democracy-engine/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (completed)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── DelegationManager.yaml       # OpenAPI/Interface spec for delegation contract
│   ├── VotePowerVerifier.yaml       # Attestation verification contract interface
│   ├── RewardDistributor.yaml       # Streaming reward management interface
│   └── TopicRegistry.yaml           # Topic management interface
├── checklists/
│   └── requirements.md  # Spec quality checklist (completed)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
contracts/
├── src/
│   ├── core/
│   │   ├── DelegationManager.sol       # Delegation and revocation logic
│   │   ├── VotePowerVerifier.sol       # Enclave attestation verification
│   │   └── TopicRegistry.sol           # Topic management and configuration
│   ├── rewards/
│   │   └── RewardDistributor.sol       # Superfluid integration for streaming rewards
│   ├── libraries/
│   │   ├── DelegationGraph.sol         # Graph traversal and cycle detection
│   │   └── AttestationLib.sol          # Attestation validation utilities
│   └── interfaces/
│       ├── IDelegationManager.sol
│       ├── IVotePowerVerifier.sol
│       ├── IRewardDistributor.sol
│       └── IEnclaveOperator.sol
├── test/
│   ├── unit/
│   │   ├── DelegationManager.t.sol
│   │   ├── VotePowerVerifier.t.sol
│   │   └── DelegationGraph.t.sol
│   ├── integration/
│   │   ├── EndToEndDelegation.t.sol
│   │   └── RewardFlow.t.sol
│   └── security/
│       ├── Reentrancy.t.sol
│       ├── AccessControl.t.sol
│       └── AttestationValidation.t.sol
└── scripts/
    ├── deploy.ts
    └── setup-topics.ts

enclave-service/
├── src/
│   ├── operators/
│   │   ├── EnclaveOperator.ts          # Main enclave computation service
│   │   ├── GraphComputer.ts            # Delegation graph traversal and voting power calculation
│   │   └── AttestationSigner.ts        # TEE attestation generation
│   ├── services/
│   │   ├── ChainListener.ts            # Listen for delegation/revocation events
│   │   └── ResultSubmitter.ts          # Submit attestations to VotePowerVerifier
│   └── lib/
│       ├── enclave-sdk.ts              # Enclave.gg SDK wrapper
│       └── graph-algorithms.ts         # DFS/BFS for transitive delegation
└── tests/
    ├── GraphComputer.test.ts
    └── integration/
        └── FullFlow.test.ts

frontend/
├── src/
│   ├── lib/
│   │   ├── contracts/                  # Contract ABIs and type definitions
│   │   ├── web3/
│   │   │   ├── walletConnect.ts        # Wallet connection logic
│   │   │   ├── delegationService.ts    # Delegation transaction builders
│   │   │   └── eventListener.ts        # Contract event subscriptions
│   │   └── graph/
│   │       ├── delegationGraph.ts      # Graph data fetching and processing
│   │       └── visualization.ts        # D3.js or Cytoscape rendering
│   ├── components/
│   │   ├── wallet/
│   │   │   ├── ConnectWallet.svelte
│   │   │   └── WalletStatus.svelte
│   │   ├── delegation/
│   │   │   ├── TopicSelector.svelte
│   │   │   ├── DelegateInput.svelte
│   │   │   ├── DelegationList.svelte
│   │   │   └── RevokeDelegation.svelte
│   │   ├── graph/
│   │   │   ├── DelegationGraphView.svelte
│   │   │   └── VotePowerDetails.svelte
│   │   ├── rewards/
│   │   │   └── RewardsDashboard.svelte
│   │   └── proposals/
│   │       ├── ProposalList.svelte
│   │       └── CreateProposal.svelte
│   ├── routes/
│   │   ├── +page.svelte                # Landing page
│   │   ├── delegate/+page.svelte       # Delegation interface (User Story 1, 2)
│   │   ├── graph/+page.svelte          # Graph visualization (User Story 4)
│   │   └── rewards/+page.svelte        # Rewards dashboard (User Story 5)
│   └── tests/
│       ├── components/
│       │   └── delegation/
│       │       └── TopicSelector.test.ts
│       └── integration/
│           └── delegation-flow.spec.ts

tests/
└── e2e/
    ├── delegation.spec.ts              # User Story 1 acceptance tests
    ├── revocation.spec.ts              # User Story 2 acceptance tests
    ├── dead-end.spec.ts                # User Story 3 acceptance tests
    └── graph-visualization.spec.ts     # User Story 4 acceptance tests
```

**Structure Decision**: Web application architecture with three primary components:

1. **Smart Contracts** (`contracts/`): Solidity contracts deployed to Gnosis Chain handling on-chain delegation state and attestation verification
2. **Enclave Service** (`enclave-service/`): Node.js service running Enclave.gg TEE for secure voting power computation with multi-operator support
3. **Frontend** (`frontend/`): Svelte-based dApp with Web3 wallet integration for user interactions

This structure satisfies:
- Library-First Architecture: Each component is independently testable with clear interfaces
- Test-First Development: Parallel test directories mirror source structure
- Simplicity: Standard Web3 dApp pattern without unnecessary abstraction layers
- Observability: Clear separation enables independent monitoring of each tier

## Complexity Tracking

*No constitution violations requiring justification. This section intentionally left empty.*

All architecture decisions align with constitution principles:
- Modular library structure without over-engineering
- Proven patterns (OpenZeppelin, Hardhat, Svelte) over novel approaches
- Security-first with multi-operator attestation
- Observable through events and graph visualization
