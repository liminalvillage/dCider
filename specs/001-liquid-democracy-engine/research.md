# Research: Liquid Democracy Engine

**Date**: 2025-10-18
**Feature**: Liquid Democracy Engine (LDE)
**Purpose**: Resolve technical unknowns and establish best practices for implementation

## Research Questions

This document addresses NEEDS CLARIFICATION items from Technical Context and establishes best practices for key technologies.

---

## 1. Proposal Metadata Storage (IPFS vs Arweave)

**Question**: Where should proposal descriptions and metadata be stored off-chain?

**Decision**: IPFS with pinning service

**Rationale**:
- **Cost**: IPFS with pinning (Pinata, Web3.Storage) is free or low-cost for MVP vs Arweave's upfront permanent storage cost
- **Mutability**: Proposal metadata may need amendments/corrections; IPFS allows updates via new CIDs
- **EVM Integration**: Well-established patterns for IPFS CID storage in Ethereum contracts (32-byte content hash)
- **Tooling**: Better TypeScript/JavaScript SDK support (ipfs-http-client, Pinata SDK)
- **Retrieval**: Faster retrieval through local gateways and caching

**Alternatives Considered**:
- **Arweave**: Permanent storage attractive for governance records, but upfront cost prohibitive for MVP with potentially many proposals; better suited for finalized/ratified decisions
- **On-chain storage**: Too expensive for long-form proposal text (gas costs)
- **Centralized DB**: Defeats trustless governance model

**Implementation Notes**:
- Store IPFS CID (Content Identifier) as bytes32 in Proposal struct
- Use Pinata or Web3.Storage for pinning (prevents garbage collection)
- Frontend fetches from public IPFS gateway with local cache fallback
- Consider Arweave for archival of finalized/executed proposals (future enhancement)

---

## 2. Enclave Attestation Threshold (M-of-N Values)

**Question**: What should the M-of-N threshold be for multi-operator attestation consensus?

**Decision**: 3-of-5 (M=3, N=5)

**Rationale**:
- **Byzantine Fault Tolerance**: Tolerates up to 2 malicious/offline operators while maintaining security
- **Availability**: 60% quorum allows system to function even with 40% operator downtime
- **Security**: Requires collusion of 3+ operators to submit fraudulent voting power results
- **Practical Operations**: 5 operators manageable for MVP; not too few (centralization risk) or too many (coordination overhead)
- **Industry Standard**: Aligns with common multi-sig patterns (3/5) in DeFi governance

**Alternatives Considered**:
- **2-of-3**: Lower overhead but only 1 fault tolerance; too risky for governance system
- **5-of-7 or 7-of-10**: Better decentralization but excessive coordination complexity for MVP
- **Simple majority (N/2+1)**: Dynamic threshold based on total operators, but makes security guarantees less predictable

**Implementation Notes**:
- VotePowerVerifier contract stores operator set (5 addresses) and threshold (3)
- Attestation submission requires signatures from at least 3 distinct operators
- Admin function to update operator set (governance-controlled, out of scope for MVP)
- Event emissions track which operators participated in each attestation

---

## 3. Graph Visualization Library (D3.js vs Cytoscape.js)

**Question**: Which JavaScript library should power the delegation graph visualization?

**Decision**: Cytoscape.js

**Rationale**:
- **Graph-Specific**: Purpose-built for graph/network visualization vs D3's general-purpose data viz
- **Performance**: Better performance for 500-node target (SC-004); handles larger graphs with canvas rendering
- **Layout Algorithms**: Built-in force-directed, hierarchical, and circular layouts optimized for delegation chains
- **Interaction**: First-class support for node selection, highlighting paths (FR-014 "trace my vote"), zooming/panning
- **Learning Curve**: Simpler API for graph use cases; D3 offers more flexibility but requires more custom code
- **Ecosystem**: Good Svelte integration via cytoscape-svelte or direct wrapper components

**Alternatives Considered**:
- **D3.js**: More flexible and powerful for custom visualizations, but overkill for standard delegation graph; requires more code for features Cytoscape provides out-of-box
- **vis.js**: Simpler than both but less actively maintained; smaller ecosystem
- **React Flow**: Excellent but React-specific; integration with Svelte would be awkward

**Implementation Notes**:
- Use `cytoscape` core library (v3.27+)
- Layout: force-directed (`cola` or `fcose` extension) for general graphs; `dagre` for hierarchical delegation chains
- Styling: Node size proportional to voting power; edge thickness for direct vs transitive delegation
- Interactivity: Click node → show details panel; "trace my vote" highlights path from user's address to terminal delegate
- Performance: Lazy load graph data; implement viewport culling for >500 nodes (future enhancement)

---

## 4. Hardhat vs Foundry for Contract Development

**Question**: Which Solidity development framework should be used?

**Decision**: Hardhat with Foundry for testing

**Rationale**:
- **Hardhat for Development**: Better TypeScript integration for deployment scripts; easier Svelte frontend integration via ethers.js
- **Foundry for Testing**: Faster test execution (native Solidity tests vs Hardhat's JS-based tests); better fuzzing support for security tests
- **Hybrid Approach**: Best of both worlds—Hardhat for deployment and TypeScript tooling; Foundry for comprehensive test suites
- **Industry Practice**: Hybrid Hardhat+Foundry increasingly common in production projects (Aave V3, Uniswap V4)

**Alternatives Considered**:
- **Hardhat-only**: Simpler toolchain but slower tests; JS-based tests less expressive for complex contract logic
- **Foundry-only**: Excellent testing but weaker deploy script ecosystem; requires learning Solidity scripting vs familiar TypeScript
- **Truffle**: Legacy framework; ecosystem moving away from it

**Implementation Notes**:
- Use Hardhat for: deployment scripts, contract compilation, network configuration, frontend ABI generation
- Use Foundry for: unit tests, integration tests, security tests (reentrancy, overflow), gas profiling
- `forge test` for local testing; `hardhat deploy --network gnosis` for testnet deployments
- Share contract artifacts via `hardhat-foundry` plugin or symlinks

---

## 5. Superfluid Protocol Integration Pattern

**Question**: How should streaming rewards be integrated with Superfluid?

**Decision**: Constant Flow Agreement (CFA) with proportional flow rate updates

**Rationale**:
- **Simplicity**: CFA is Superfluid's core primitive for continuous token streaming; well-documented and battle-tested
- **On-Chain Automation**: Superfluid handles per-second streaming math; contract only updates flow rates on delegation changes
- **Gas Efficiency**: Batched flow rate updates (5-min intervals per clarifications) amortize gas costs across multiple delegations
- **User Experience**: Delegates see real-time accruing rewards in Superfluid dashboard/frontend without manual claiming

**Pattern**:
1. RewardDistributor contract is Superfluid "app" that manages flows
2. On delegation/revocation event → enclave computes new voting power distribution
3. Every 5 minutes, batch processor submits attestation with updated (delegate → voting power) mapping
4. RewardDistributor.updateFlows() calculates new flow rate per delegate: `flowRate = (votingPower / totalVotingPower) * poolFlowRate`
5. Calls Superfluid CFA to update/create/delete flows for changed delegates

**Alternatives Considered**:
- **Instant Distribution Agreement (IDA)**: Bulk distribution at epoch boundaries; simpler but less "real-time" feeling
- **Manual claiming**: Defeats purpose of streaming; poor UX
- **Custom streaming**: Reinventing Superfluid's wheel; security risk and audit burden

**Implementation Notes**:
- Use `@superfluid-finance/ethereum-contracts` SDK (v1.9+)
- RewardDistributor inherits `SuperAppBase` for Superfluid callbacks
- Super Token: Deploy wrapped governance token or use existing (e.g., GNOx on Gnosis)
- Admin funds reward pool with Super Tokens; flow rate set based on intended monthly distribution
- Handle edge cases: delegate voting power drops to 0 → delete flow; new delegate → create flow

---

## 6. Enclave.gg SDK and TEE Attestation

**Question**: How does Enclave.gg attestation work and integrate with EVM?

**Research Summary**:

**Enclave.gg Overview**:
- Trusted Execution Environment (TEE) provider using Intel SGX or AWS Nitro Enclaves
- Secure enclaves provide remote attestation proving computation integrity
- SDK generates cryptographic attestation signatures that can be verified on-chain

**Attestation Flow**:
1. Enclave operator runs voting power computation inside TEE
2. Enclave.gg SDK produces attestation: `attestation = sign(computationResult, enclavePrivateKey)`
3. Attestation includes: result hash, timestamp, enclave public key, SGX quote/Nitro document
4. On-chain VotePowerVerifier verifies signature against registered enclave operator public keys
5. Multi-operator: Collect attestations from M operators, verify M-of-N threshold, accept result if quorum met

**Best Practices**:
- **Operator Registration**: Pre-register operator public keys in VotePowerVerifier contract
- **Replay Protection**: Include block number and nonce in attestation to prevent reuse
- **Result Verification**: Contract verifies result hash matches expected format (e.g., Merkle root of votingPower mapping)
- **Transparency**: Emit event with full attestation data for off-chain audit

**Implementation Notes**:
- Enclave operator service polls DelegationManager events (Delegated, Revoked, DeadEndDeclared)
- On event, compute new voting power distribution using graph traversal (DFS from each voter)
- Generate attestation with Enclave.gg SDK: `const attestation = await enclave.attest(votingPowerResult)`
- Submit attestation to VotePowerVerifier with operator signature
- Contract verifies: (1) operator is in authorized set, (2) signature valid, (3) quorum met, (4) result hash not replayed
- Accepted result triggers RewardDistributor.updateFlows()

**Security Considerations**:
- Enclave code must be deterministic (same inputs → same outputs) for M-of-N consensus
- Operator set diversity critical; avoid geographic/cloud provider concentration
- Monitor for attestation submission delays (>5 minutes) indicating operator issues

---

## 7. Gnosis Chain Configuration and Best Practices

**Question**: What are Gnosis Chain-specific considerations for deployment?

**Research Summary**:

**Gnosis Chain Characteristics**:
- EVM-compatible Layer 1 (formerly xDai)
- Block time: ~5 seconds (vs Ethereum's ~12s)
- Gas token: xDAI (stablecoin pegged to USD)
- Low transaction costs: ~$0.01 per transaction (vs Ethereum's variable high fees)
- Finality: ~2-3 blocks for practical finality

**Benefits for Liquid Democracy Engine**:
- **Transaction Cost**: Delegation/revocation affordable for users; enables frequent delegation changes
- **Confirmation Speed**: <30s confirmation target (SC-001) easily achievable with 5s block times
- **Stable Gas Costs**: xDAI predictability helps UX (no gas spike surprises)
- **Ecosystem**: Existing governance projects (Gnosis DAO, 1hive) provide reference implementations

**Deployment Best Practices**:
- **Testnet**: Use Gnosis Chiado testnet for MVP deployment; request xDAI from Chiado faucet
- **RPC Endpoints**: Use reliable providers (Gnosis RPC, Ankr, Chainnodes) with fallback endpoints in frontend
- **Block Explorer**: Verify contracts on Gnosisscan (Blockscout); users can inspect delegation state
- **Bridging**: For multi-chain future, use Gnosis Omnibridge for asset bridging from Ethereum
- **Gas Estimation**: Set gas limits 20% above estimates; Gnosis Gas Station API for current prices

**Implementation Notes**:
- Hardhat network config: `chainId: 100` (mainnet) or `10200` (Chiado testnet)
- Frontend RPC: `https://rpc.gnosischain.com/` with fallback to Ankr
- Contract verification: `npx hardhat verify --network gnosis <address> <constructor-args>`
- Faucet (Chiado): `https://gnosisfaucet.com/`

---

## 8. OpenZeppelin Contracts for Security Patterns

**Question**: Which OpenZeppelin contracts and patterns should be used?

**Decision**: Key contracts and utilities

**OpenZeppelin v5.0+ Contracts to Use**:

1. **Access Control**:
   - `Ownable2Step`: Two-step ownership transfer for TopicRegistry admin functions
   - `AccessControl`: Role-based permissions for enclave operators (OPERATOR_ROLE)

2. **Security**:
   - `ReentrancyGuard`: Protect delegation/revocation functions that interact with external contracts (RewardDistributor)
   - `Pausable`: Emergency pause mechanism for critical bugs

3. **Utilities**:
   - `EnumerableSet`: Track operator set and delegations efficiently
   - `SafeCast`: Type conversions for voting power calculations (avoid overflows)

4. **Proxy Patterns** (Future, not MVP):
   - `UUPSUpgradeable`: Upgradeability for post-MVP contract iterations (constitution requires migration plans)

**Security Patterns**:
- **Checks-Effects-Interactions**: All state changes before external calls
  ```solidity
  function delegate(uint256 topicId, address delegate) external nonReentrant {
      // Checks
      require(delegate != msg.sender, "Cannot self-delegate");
      require(!_wouldCreateCycle(topicId, delegate), "Creates cycle");

      // Effects
      _delegations[topicId][msg.sender] = delegate;
      emit Delegated(msg.sender, delegate, topicId);

      // Interactions
      _notifyEnclaveOperators(topicId);
  }
  ```

- **Access Control Example**:
  ```solidity
  function submitAttestation(bytes32 resultHash, bytes[] calldata signatures)
      external
      onlyRole(OPERATOR_ROLE)
  {
      require(signatures.length >= ATTESTATION_THRESHOLD, "Insufficient signatures");
      // ... verify attestation
  }
  ```

**Implementation Notes**:
- Use OpenZeppelin Contracts v5.0.1 (latest stable)
- Import specific contracts to minimize deployment size (24KB limit)
- Run OpenZeppelin Defender for automated security monitoring (testnet)
- Follow OpenZeppelin security audit patterns for custom logic

---

## Summary of Decisions

| Research Item | Decision | Key Rationale |
|---------------|----------|---------------|
| Proposal Metadata Storage | IPFS with pinning | Cost-effective, mutable, good EVM integration |
| Attestation Threshold | 3-of-5 operators | Byzantine fault tolerance, standard multi-sig pattern |
| Graph Visualization | Cytoscape.js | Graph-optimized, better performance, simpler API |
| Development Framework | Hardhat + Foundry hybrid | TypeScript tooling + fast native Solidity tests |
| Streaming Rewards | Superfluid CFA | Proven protocol, on-chain automation, great UX |
| Enclave Integration | Enclave.gg SDK with M-of-N verification | Remote attestation, multi-operator security |
| Target Network | Gnosis Chain (Chiado testnet) | Low cost, fast confirmation, stable gas |
| Security Framework | OpenZeppelin v5.0+ | Battle-tested patterns, role-based access, reentrancy guards |

All NEEDS CLARIFICATION items from Technical Context have been resolved. Implementation can proceed to Phase 1 (data modeling and contract design).
