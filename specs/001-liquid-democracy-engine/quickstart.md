# Quickstart Guide: Liquid Democracy Engine

**Purpose**: Developer onboarding guide for implementing the Liquid Democracy Engine MVP

**Target Audience**: Solidity developers, frontend developers, DevOps engineers

**Prerequisites**:
- Node.js 20+, pnpm or npm
- Foundry (for Solidity testing) - `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- Hardhat (for deployment) - installed via npm
- Basic understanding of Ethereum/EVM, Solidity, Svelte
- Gnosis Chain testnet (Chiado) wallet with xDAI

---

## 1. Project Setup

### Clone and Initialize

```bash
# Navigate to repo root
cd /Users/roberto/Projects/dCider

# Install dependencies for all workspaces
pnpm install

# Verify installations
npx hardhat --version  # Should show Hardhat 2.x
forge --version        # Should show Foundry
node --version         # Should show v20.x
```

### Directory Structure

```
dCider/
├── contracts/          # Smart contracts (Solidity)
├── enclave-service/    # Enclave operator service (TypeScript)
├── frontend/           # Svelte dApp
└── tests/              # E2E tests (Playwright)
```

---

## 2. Smart Contract Development

### Environment Setup

```bash
cd contracts

# Create .env file
cat > .env << 'EOF'
PRIVATE_KEY=0x... # Your testnet private key
CHIADO_RPC_URL=https://rpc.chiadochain.net
GNOSISSCAN_API_KEY=... # For contract verification
PINATA_API_KEY=... # For IPFS (optional)
EOF

# Hardhat configuration (hardhat.config.ts)
# Already configured for Chiado testnet (chainId: 10200)
```

### Development Workflow (Test-First per Constitution)

**Step 1: Write Tests FIRST**

```bash
# Example: DelegationManager tests
forge test --match-contract DelegationManagerTest -vvv

# Run specific test
forge test --match-test testDelegateSuccess -vvv
```

**Step 2: Implement Contract**

```solidity
// contracts/src/core/DelegationManager.sol
pragma solidity 0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract DelegationManager is ReentrancyGuard, AccessControl {
    // Implementation based on contracts/DelegationManager.yaml spec
    // See data-model.md for entity definitions
}
```

**Step 3: Run Tests (Red → Green → Refactor)**

```bash
# All tests must pass before proceeding
forge test

# Gas profiling
forge test --gas-report

# Coverage
forge coverage
```

### Contract Deployment (Chiado Testnet)

```bash
# Deploy all contracts
npx hardhat deploy --network chiado

# Verify on Gnosisscan
npx hardhat verify --network chiado <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>

# Setup initial topics
npx hardhat run scripts/setup-topics.ts --network chiado
```

### Key Contracts Reference

| Contract | Purpose | Key Functions |
|----------|---------|---------------|
| `DelegationManager` | Delegation/revocation logic | `delegate()`, `revoke()`, `declareDeadEnd()` |
| `VotePowerVerifier` | Attestation verification | `submitAttestation()`, `getVotingPower()` |
| `RewardDistributor` | Superfluid rewards | `updateFlows()`, `getFlowRate()` |
| `TopicRegistry` | Topic management | `createTopic()`, `getTopic()` |

---

## 3. Enclave Service Development

### Setup

```bash
cd enclave-service

# Install dependencies
pnpm install

# Configure environment
cat > .env << 'EOF'
CHIADO_RPC_URL=https://rpc.chiadochain.net
DELEGATION_MANAGER_ADDRESS=0x... # From contract deployment
VOTEPOWER_VERIFIER_ADDRESS=0x...
ENCLAVE_OPERATOR_PRIVATE_KEY=0x... # Operator wallet
ENCLAVE_GG_API_KEY=... # From Enclave.gg signup
EOF
```

### Run Operator Service

```bash
# Development mode (hot reload)
pnpm dev

# Production mode
pnpm build
pnpm start

# Service monitors DelegationManager events and computes voting power
```

### How It Works

1. **Event Listening**: Service listens for `Delegated`, `Revoked`, `DeadEndDeclared` events
2. **Graph Computation**: On event, computes voting power via DFS graph traversal (inside TEE)
3. **Attestation**: Enclave.gg SDK generates attestation with operator signature
4. **Submission**: Every ~5 minutes (batched), submits attestation to VotePowerVerifier
5. **Verification**: Contract verifies M-of-N (3-of-5) signatures, accepts if quorum met

### Testing Enclave Locally (Mock Mode)

```bash
# Run with mock enclave (no TEE required for development)
MOCK_ENCLAVE=true pnpm dev

# Test graph computation
pnpm test src/operators/GraphComputer.test.ts
```

---

## 4. Frontend Development

### Setup

```bash
cd frontend

# Install dependencies
pnpm install

# Configure environment
cat > .env << 'EOF'
PUBLIC_CHAIN_ID=10200
PUBLIC_RPC_URL=https://rpc.chiadochain.net
PUBLIC_DELEGATION_MANAGER_ADDRESS=0x...
PUBLIC_VOTEPOWER_VERIFIER_ADDRESS=0x...
PUBLIC_TOPIC_REGISTRY_ADDRESS=0x...
PUBLIC_REWARD_DISTRIBUTOR_ADDRESS=0x...
PUBLIC_WALLETCONNECT_PROJECT_ID=... # From WalletConnect Cloud
EOF
```

### Development Server

```bash
# Start dev server
pnpm dev
# Frontend runs on http://localhost:5173

# Build for production
pnpm build
pnpm preview
```

### Key Features

| Route | User Story | Components |
|-------|------------|-----------|
| `/delegate` | P1, P2 | TopicSelector, DelegateInput, DelegationList |
| `/graph` | P4 | DelegationGraphView (Cytoscape.js) |
| `/rewards` | P5 | RewardsDashboard (Superfluid integration) |

### Testing Frontend

```bash
# Component tests (Vitest)
pnpm test

# E2E tests (Playwright) - from repo root
cd ../tests
pnpm exec playwright test

# Test specific user story
pnpm exec playwright test delegation.spec.ts
```

---

## 5. End-to-End Testing

### Prerequisites

- Contracts deployed to Chiado testnet
- Enclave service running
- Frontend running locally
- Test wallet funded with Chiado xDAI (use faucet: https://gnosisfaucet.com/)

### Run E2E Tests

```bash
cd tests/e2e

# User Story 1: Delegate Vote on a Topic
pnpm exec playwright test delegation.spec.ts

# User Story 2: Revoke Delegation
pnpm exec playwright test revocation.spec.ts

# User Story 4: View Delegation Graph
pnpm exec playwright test graph-visualization.spec.ts

# All tests
pnpm exec playwright test
```

### Manual Testing Flow

1. **Connect Wallet**: Navigate to http://localhost:5173, click "Connect Wallet", select MetaMask
2. **View Topics**: See list of active topics (Climate, Education, etc.)
3. **Delegate**: Select topic → Enter delegate address → Confirm transaction → Wait for confirmation
4. **View Graph**: Navigate to `/graph` → Select topic → See delegation graph with your delegation
5. **Revoke**: Return to `/delegate` → Click "Revoke" on active delegation → Confirm
6. **Check Rewards**: Navigate to `/rewards` → See streaming rewards (if you're a delegate with power)

---

## 6. Common Tasks

### Add New Topic (Admin)

```bash
cd contracts
npx hardhat run scripts/add-topic.ts --network chiado
# Follow prompts to enter topic name, description CID, proposal threshold
```

### Add Enclave Operator (Admin)

```bash
# Call VotePowerVerifier.addOperator()
npx hardhat run scripts/add-operator.ts --network chiado
```

### Monitor Events

```bash
# Watch DelegationManager events
npx hardhat run scripts/monitor-events.ts --network chiado

# Or use frontend console (browser DevTools)
# Events logged in real-time via eventListener.ts
```

### Troubleshooting

**Issue**: Transaction fails with "Creates cycle"
- **Fix**: Check delegation chain with `getDelegationDepth()` - likely attempting A→B→C→A

**Issue**: Attestation rejected with "Insufficient signatures"
- **Fix**: Ensure 3+ operators are running and signing; check operator logs

**Issue**: Graph visualization doesn't load
- **Fix**: Verify contract addresses in frontend `.env`; check browser console for errors

**Issue**: Rewards not streaming
- **Fix**: Ensure RewardDistributor has sufficient Super Token balance; check Superfluid dashboard

---

## 7. Deployment Checklist (Testnet)

- [ ] Smart contracts compiled without warnings: `forge build --via-ir`
- [ ] All tests passing: `forge test && pnpm test`
- [ ] Contracts deployed to Chiado: `npx hardhat deploy --network chiado`
- [ ] Contracts verified on Gnosisscan
- [ ] 5 enclave operators configured with public keys
- [ ] Initial topics created (minimum 1 topic for testing)
- [ ] Reward pool funded with Super Tokens
- [ ] Frontend deployed (Vercel, Netlify, or IPFS)
- [ ] E2E tests passing against deployed contracts
- [ ] At least 50 test transactions executed (SC-008 requirement)

---

## 8. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Svelte)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Delegation   │  │ Graph View   │  │ Rewards      │         │
│  │ Interface    │  │ (Cytoscape)  │  │ Dashboard    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│         │                  │                  │                  │
│         └──────────────────┴──────────────────┘                  │
│                            │                                      │
│                    Ethers.js / Web3 Provider                     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Gnosis Chain (Chiado Testnet)                   │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ DelegationManager│  │ VotePowerVerifier│  │ TopicRegistry│ │
│  │ - delegate()     │  │ - submitAttest() │  │ - topics     │ │
│  │ - revoke()       │  │ - getVotePower() │  └──────────────┘ │
│  └──────────────────┘  └──────────────────┘                     │
│           │                     ▲                                │
│           │ Events              │ Attestations                   │
│           │                     │                                │
│           ▼                     │                                │
│  ┌─────────────────────────────┴───────────────┐               │
│  │        RewardDistributor (Superfluid)        │               │
│  │        - updateFlows()                        │               │
│  └──────────────────────────────────────────────┘               │
└────────────────────────┬─────────────────┬──────────────────────┘
                         │                 │
                         │                 │
                         ▼                 ▼
        ┌──────────────────────┐  ┌──────────────────────┐
        │  Enclave Service      │  │  Enclave Service      │
        │  (Operator 1)         │  │  (Operator 2-5)       │
        │  ┌─────────────────┐  │  │  ┌─────────────────┐  │
        │  │ Enclave.gg TEE  │  │  │  │ Enclave.gg TEE  │  │
        │  │ - Compute Power │  │  │  │ - Compute Power │  │
        │  │ - Sign Attest   │  │  │  │ - Sign Attest   │  │
        │  └─────────────────┘  │  │  └─────────────────┘  │
        └──────────────────────┘  └──────────────────────┘
```

---

## 9. Next Steps After Quickstart

1. **Implement User Stories**: Follow `/speckit.tasks` to generate detailed task breakdown
2. **Write Tests First**: For each task, write failing tests → get user approval → implement
3. **Security Review**: Before mainnet, conduct security audit (OpenZeppelin, Trail of Bits)
4. **Testnet Beta**: Recruit community testers to validate UX and find edge cases
5. **Mainnet Deployment**: Deploy to Gnosis Chain mainnet → Ethereum mainnet (future)

---

## 10. Resources

**Documentation**:
- [Specification](./spec.md) - Feature requirements and user stories
- [Data Model](./data-model.md) - Entity definitions and relationships
- [Research](./research.md) - Technology decisions and best practices
- [Contract Interfaces](./contracts/) - OpenAPI specs for each contract

**External Resources**:
- [Gnosis Chain Docs](https://docs.gnosischain.com/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Foundry Book](https://book.getfoundry.sh/)
- [Enclave.gg SDK](https://docs.enclave.gg/) (hypothetical - check actual docs)
- [Superfluid Docs](https://docs.superfluid.finance/)
- [Cytoscape.js Docs](https://js.cytoscape.org/)

**Support**:
- GitHub Issues: [dCider Repository](https://github.com/your-org/dCider/issues)
- Discord: [Community Channel](#)

---

**Last Updated**: 2025-10-18
**Version**: 1.0.0 (MVP)
