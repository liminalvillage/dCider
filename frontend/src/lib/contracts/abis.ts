/**
 * Contract ABIs
 *
 * Contract ABIs for frontend interaction
 * These will be replaced with actual ABIs after contract compilation
 */

export const DelegationManagerABI = [
  'function delegate(uint256 topicId, address delegate) external',
  'function revoke(uint256 topicId) external',
  'function declareDeadEnd(uint256 topicId) external',
  'function revokeDeadEnd(uint256 topicId) external',
  'function getDelegation(address delegator, uint256 topicId) external view returns (tuple(address delegator, address delegate, uint256 topicId, uint256 timestamp, uint8 depth))',
  'function isDeadEnd(address delegate, uint256 topicId) external view returns (bool isDeadEnd, uint256 declaredAt)',
  'function getDelegationDepth(address user, uint256 topicId) external view returns (uint8 depth)',
  'function getTerminalDelegate(address delegator, uint256 topicId) external view returns (address terminal)',
  'function getDelegationChain(address delegator, uint256 topicId) external view returns (address[] chain)',
  'function getAllDelegationsForTopic(uint256 topicId) external view returns (address[] delegators, address[] delegates)',
  'function getTopicDelegators(uint256 topicId) external view returns (address[] memory)',
  'event Delegated(address indexed delegator, address indexed delegate, uint256 indexed topicId, uint256 timestamp)',
  'event Revoked(address indexed delegator, uint256 indexed topicId, uint256 timestamp)',
  'event DeadEndDeclared(address indexed delegate, uint256 indexed topicId, uint256 timestamp)',
  'event DeadEndRevoked(address indexed delegate, uint256 indexed topicId, uint256 timestamp)',
];

export const DELEGATION_MANAGER_ABI = DelegationManagerABI;

export const TopicRegistryABI = [
  'function createTopic(string name, bytes32 descriptionCID, uint256 proposalThreshold) external returns (uint256 topicId)',
  'function getTopic(uint256 topicId) external view returns (tuple(uint256 id, string name, bytes32 descriptionCID, uint256 proposalThreshold, bool active, uint256 createdAt, address admin))',
  'function getAllTopics(bool activeOnly) external view returns (tuple(uint256 id, string name, bytes32 descriptionCID, uint256 proposalThreshold, bool active, uint256 createdAt, address admin)[] topics, uint256 count)',
  'function isTopicActive(uint256 topicId) external view returns (bool exists, bool active)',
  'function topicCount() external view returns (uint256 count)',
  'function updateTopicThreshold(uint256 topicId, uint256 newThreshold) external',
  'function setTopicActive(uint256 topicId, bool active) external',
  'event TopicCreated(uint256 indexed topicId, string name, address indexed admin)',
  'event TopicThresholdUpdated(uint256 indexed topicId, uint256 oldThreshold, uint256 newThreshold)',
  'event TopicActiveStatusChanged(uint256 indexed topicId, bool active)',
];

export const TOPIC_REGISTRY_ABI = TopicRegistryABI;

export const VotePowerVerifierABI = [
  'function getVotingPower(address user, uint256 topicId) external view returns (uint256 power, uint256 lastUpdated, bytes32 attestationHash)',
  'function getOperators() external view returns (tuple(address operatorAddress, bytes enclavePublicKey, bool active, uint256 addedAt, uint256 attestationCount)[] operators, uint256 threshold, uint256 totalOperators)',
  'event VotingPowerUpdated(uint256 indexed topicId, bytes32 attestationHash, uint256 timestamp)',
  'event AttestationAccepted(bytes32 indexed resultHash, uint256 timestamp)',
];

export const RewardDistributorABI = [
  'function getFlowRate(address delegate, uint256 topicId) external view returns (int96 flowRate, uint256 totalStreamed, uint256 lastUpdated)',
  'function getPoolFlowRate(uint256 topicId) external view returns (int96 poolFlowRate, int96 totalDistributed, int96 remainingCapacity)',
  'function estimateMonthlyReward(uint256 topicId, uint256 votingPower, uint256 totalVotingPower) external view returns (uint256 tokensPerMonth, int96 flowRate, uint256 sharePercentage)',
  'event FlowCreated(address indexed delegate, uint256 indexed topicId, int96 flowRate)',
  'event FlowUpdated(address indexed delegate, uint256 indexed topicId, int96 oldFlowRate, int96 newFlowRate)',
  'event FlowDeleted(address indexed delegate, uint256 indexed topicId)',
];
