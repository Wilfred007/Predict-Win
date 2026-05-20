// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OnboardingBadge {
    mapping(address => bool) public onboarded;

    event UserOnboarded(address indexed user);

    function registerOnboarded() external {
        require(!onboarded[msg.sender], "Already onboarded");
        onboarded[msg.sender] = true;
        emit UserOnboarded(msg.sender);
    }

    function isOnboarded(address user) external view returns (bool) {
        return onboarded[user];
    }
}
