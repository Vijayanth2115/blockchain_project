// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DAO {

    enum ProposalType {
        FINANCIAL,
        HIRING,
        GOVERNANCE,
        OPERATIONAL,
        SECURITY
    }

    struct Proposal {
        string description;
        ProposalType proposalType;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
        uint256 createdAt;
        uint256 deadline;
    }

    address public owner;
    mapping(address => bool) public members;
    uint256 public memberCount;

    Proposal[] private proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    uint256 public quorum;
    uint256 public constant VOTING_DURATION = 5 minutes;

    event ProposalCreated(uint256 indexed id, string description, uint256 deadline);
    event VoteCast(uint256 indexed id, address voter, bool support);
    event ProposalExecuted(uint256 indexed id);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyMember() {
        require(members[msg.sender], "Not member");
        _;
    }

    modifier validProposal(uint256 id) {
        require(id < proposals.length, "Invalid ID");
        _;
    }

    constructor(uint256 _quorum) {
        owner = msg.sender;
        members[msg.sender] = true;
        memberCount = 1;
        quorum = _quorum;
    }

    function addMember(address _member) external onlyOwner {
        require(!members[_member], "Already member");
        members[_member] = true;
        memberCount++;
    }

    function createProposal(
        string calldata _description,
        ProposalType _type
    ) external onlyMember {
        proposals.push(
            Proposal({
                description: _description,
                proposalType: _type,
                yesVotes: 0,
                noVotes: 0,
                executed: false,
                createdAt: block.timestamp,
                deadline: block.timestamp + VOTING_DURATION
            })
        );

        emit ProposalCreated(
            proposals.length - 1,
            _description,
            block.timestamp + VOTING_DURATION
        );
    }

    function vote(uint256 id, bool support)
        external
        onlyMember
        validProposal(id)
    {
        Proposal storage p = proposals[id];

        require(block.timestamp < p.deadline, "Voting ended");
        require(!hasVoted[id][msg.sender], "Already voted");

        hasVoted[id][msg.sender] = true;

        if (support) p.yesVotes++;
        else p.noVotes++;

        emit VoteCast(id, msg.sender, support);
    }

    function execute(uint256 id) external validProposal(id) {
        Proposal storage p = proposals[id];

        require(!p.executed, "Already executed");
        require(block.timestamp >= p.deadline, "Voting not ended");
        require(p.yesVotes >= quorum, "Quorum not reached");

        p.executed = true;
        emit ProposalExecuted(id);
    }

    function getProposal(uint256 id)
        external
        view
        validProposal(id)
        returns (
            string memory,
            ProposalType,
            uint256,
            uint256,
            bool,
            uint256,
            uint256
        )
    {
        Proposal storage p = proposals[id];
        return (
            p.description,
            p.proposalType,
            p.yesVotes,
            p.noVotes,
            p.executed,
            p.createdAt,
            p.deadline
        );
    }

    function getProposalCount() external view returns (uint256) {
        return proposals.length;
    }

    function isMember(address _addr) external view returns (bool) {
        return members[_addr];
    }
}
