// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PredictionMarket {
    uint256 public constant PLATFORM_FEE_BPS = 500; // 5%

    enum Outcome { None, Home, Draw, Away }

    struct Market {
        string  homeTeam;
        string  awayTeam;
        string  league;
        uint256 kickoff;    // unix timestamp (seconds)
        bool    resolved;
        Outcome result;
        uint256 totalPool;
        uint256 homePool;
        uint256 drawPool;
        uint256 awayPool;
    }

    address public owner;
    uint256 public accumulatedFees;
    uint256 public marketCount;

    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => mapping(Outcome => uint256))) public userStakes;
    mapping(uint256 => mapping(address => bool)) public claimed;

    event MarketCreated(uint256 indexed marketId, string homeTeam, string awayTeam, string league, uint256 kickoff);
    event BetPlaced(uint256 indexed marketId, address indexed user, Outcome outcome, uint256 amount);
    event MarketResolved(uint256 indexed marketId, Outcome result);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event FeesWithdrawn(address indexed owner, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createMarket(
        string calldata homeTeam,
        string calldata awayTeam,
        string calldata league,
        uint256 kickoff
    ) external onlyOwner returns (uint256 marketId) {
        require(kickoff > block.timestamp, "Kickoff must be in the future");
        marketId = marketCount++;
        markets[marketId] = Market({
            homeTeam:  homeTeam,
            awayTeam:  awayTeam,
            league:    league,
            kickoff:   kickoff,
            resolved:  false,
            result:    Outcome.None,
            totalPool: 0,
            homePool:  0,
            drawPool:  0,
            awayPool:  0
        });
        emit MarketCreated(marketId, homeTeam, awayTeam, league, kickoff);
    }

    function placeBet(uint256 marketId, Outcome outcome) external payable {
        require(marketId < marketCount, "Market does not exist");
        require(outcome != Outcome.None, "Invalid outcome");
        require(!markets[marketId].resolved, "Market already resolved");
        require(block.timestamp < markets[marketId].kickoff, "Betting closed: match started");
        require(msg.value > 0, "Must send CELO to bet");

        Market storage m = markets[marketId];
        m.totalPool += msg.value;
        if      (outcome == Outcome.Home) m.homePool += msg.value;
        else if (outcome == Outcome.Draw) m.drawPool += msg.value;
        else                              m.awayPool += msg.value;

        userStakes[marketId][msg.sender][outcome] += msg.value;
        emit BetPlaced(marketId, msg.sender, outcome, msg.value);
    }

    function resolveMarket(uint256 marketId, Outcome result) external onlyOwner {
        require(marketId < marketCount, "Market does not exist");
        require(!markets[marketId].resolved, "Already resolved");
        require(result != Outcome.None, "Invalid result");

        Market storage m = markets[marketId];
        m.resolved = true;
        m.result   = result;

        uint256 fee = (m.totalPool * PLATFORM_FEE_BPS) / 10_000;
        accumulatedFees += fee;

        emit MarketResolved(marketId, result);
    }

    function claimWinnings(uint256 marketId) external {
        require(marketId < marketCount, "Market does not exist");
        Market storage m = markets[marketId];
        require(m.resolved, "Market not resolved yet");
        require(!claimed[marketId][msg.sender], "Already claimed");

        uint256 userStake = userStakes[marketId][msg.sender][m.result];
        require(userStake > 0, "No winning stake");

        claimed[marketId][msg.sender] = true;

        uint256 winningPool;
        if      (m.result == Outcome.Home) winningPool = m.homePool;
        else if (m.result == Outcome.Draw) winningPool = m.drawPool;
        else                               winningPool = m.awayPool;

        uint256 fee      = (m.totalPool * PLATFORM_FEE_BPS) / 10_000;
        uint256 prize    = m.totalPool - fee;
        uint256 payout   = (userStake * prize) / winningPool;

        require(address(this).balance >= payout, "Insufficient contract balance");

        (bool ok,) = msg.sender.call{value: payout}("");
        require(ok, "Transfer failed");

        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    function withdrawFees() external onlyOwner {
        uint256 amount = accumulatedFees;
        require(amount > 0, "No fees to withdraw");
        accumulatedFees = 0;
        (bool ok,) = owner.call{value: amount}("");
        require(ok, "Transfer failed");
        emit FeesWithdrawn(owner, amount);
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        require(marketId < marketCount, "Market does not exist");
        return markets[marketId];
    }

    function getUserStake(
        uint256 marketId,
        address user,
        Outcome outcome
    ) external view returns (uint256) {
        return userStakes[marketId][user][outcome];
    }
}
