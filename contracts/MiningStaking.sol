// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * MiningStaking
 * - Users stake `stakeToken` (e.g., Randy)
 * - Rewards paid in `rewardToken` (can be same as stake token)
 * - Reward rate distributes continuously per-second across total weighted stake
 * - Weighted stake = stakedAmount * multiplier(stakedAmount)
 * - Multipliers are tiered thresholds configured by owner
 * - Contract must be pre-funded with `rewardToken`
 */
contract MiningStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakeToken;
    IERC20 public immutable rewardToken;

    // Reward tokens distributed per second, scaled to 1e18 for precision
    uint256 public rewardRatePerSecond;

    // Accounting
    uint256 public lastUpdateTime;
    uint256 public rewardPerWeightedStakeStored; // scaled 1e18
    uint256 public totalStaked;
    uint256 public totalWeightedStake; // sum of stake * multiplier (1e18)

    struct UserInfo {
        uint256 staked;
        uint256 weightedStake;
        uint256 rewardsAccrued; // unclaimed
        uint256 userRewardPerWeightedStakePaid; // checkpoint
        uint256 lockEnd; // timestamp until which withdraw is locked
        uint256 lockBoostMultiplier; // scaled 1e18 (1e18 = 1x)
    }

    mapping(address => UserInfo) public users;

    // Tiers: thresholds in stakeToken units, multipliers scaled 1e18 (1e18 = 1x)
    uint256[] public tierThresholds;
    uint256[] public tierMultipliers;

    event Staked(address indexed user, uint256 amount, uint256 newStake);
    event Withdrawn(address indexed user, uint256 amount, uint256 remaining);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);
    event TiersUpdated();
    event LockUpdated(address indexed user, uint256 lockEnd, uint256 lockBoostMultiplier);

    uint256 public constant MAX_LOCK_SECONDS = 365 days;
    uint256 public constant MAX_LOCK_BOOST = 3e18; // 3.0x

    constructor(
        address owner_,
        IERC20 stakeToken_,
        IERC20 rewardToken_,
        uint256 rewardRatePerSecond_,
        uint256[] memory thresholds,
        uint256[] memory multipliers
    ) Ownable(owner_) {
        require(address(stakeToken_) != address(0), "stake token");
        require(address(rewardToken_) != address(0), "reward token");
        require(thresholds.length == multipliers.length, "tiers len");
        stakeToken = stakeToken_;
        rewardToken = rewardToken_;
        rewardRatePerSecond = rewardRatePerSecond_;
        tierThresholds = thresholds;
        tierMultipliers = multipliers;
        lastUpdateTime = block.timestamp;
    }

    // ===== View helpers =====
    function tiers() external view returns (uint256[] memory, uint256[] memory) {
        return (tierThresholds, tierMultipliers);
    }

    function currentMultiplier(uint256 stakeAmount) public view returns (uint256) {
        // default 1x
        uint256 m = 1e18;
        uint256 len = tierThresholds.length;
        for (uint256 i = 0; i < len; i++) {
            if (stakeAmount >= tierThresholds[i]) {
                m = tierMultipliers[i];
            } else {
                break;
            }
        }
        return m;
    }

    function rewardPerWeightedStake() public view returns (uint256) {
        if (totalWeightedStake == 0) {
            return rewardPerWeightedStakeStored;
        }
        uint256 delta = block.timestamp - lastUpdateTime;
        uint256 accrued = delta * rewardRatePerSecond * 1e18 / totalWeightedStake; // scale 1e18
        return rewardPerWeightedStakeStored + accrued;
    }

    function earned(address account) public view returns (uint256) {
        UserInfo memory u = users[account];
        uint256 rpw = rewardPerWeightedStake();
        uint256 pending = (u.weightedStake * (rpw - u.userRewardPerWeightedStakePaid)) / 1e18;
        return u.rewardsAccrued + pending;
    }

    // ===== Mutations =====
    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "amount=0");
        stakeToken.safeTransferFrom(msg.sender, address(this), amount);

        totalStaked += amount;

        UserInfo storage u = users[msg.sender];
        u.staked += amount;

        // recalc multiplier and weighted stake considering tier vs active lock
        uint256 newMultiplier = _currentUserMultiplier(msg.sender, u);
        uint256 newWeighted = (u.staked * newMultiplier) / 1e18;
        totalWeightedStake = totalWeightedStake - u.weightedStake + newWeighted;
        u.weightedStake = newWeighted;

        emit Staked(msg.sender, amount, u.staked);
    }

    function stakeWithLock(uint256 amount, uint256 lockSeconds) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "amount=0");
        if (lockSeconds > MAX_LOCK_SECONDS) {
            lockSeconds = MAX_LOCK_SECONDS;
        }
        stakeToken.safeTransferFrom(msg.sender, address(this), amount);

        totalStaked += amount;

        UserInfo storage u = users[msg.sender];
        u.staked += amount;

        // compute boost 1.0x .. 3.0x linearly with duration
        uint256 boost = 1e18 + ((MAX_LOCK_BOOST - 1e18) * lockSeconds) / MAX_LOCK_SECONDS;
        if (boost > MAX_LOCK_BOOST) boost = MAX_LOCK_BOOST;

        uint256 newLockEnd = block.timestamp + lockSeconds;
        if (newLockEnd > u.lockEnd) {
            u.lockEnd = newLockEnd;
        }
        if (boost > u.lockBoostMultiplier) {
            u.lockBoostMultiplier = boost;
        }
        emit LockUpdated(msg.sender, u.lockEnd, u.lockBoostMultiplier);

        // recalc multiplier and weighted stake with lock considered
        uint256 newMultiplier = _currentUserMultiplier(msg.sender, u);
        uint256 newWeighted = (u.staked * newMultiplier) / 1e18;
        totalWeightedStake = totalWeightedStake - u.weightedStake + newWeighted;
        u.weightedStake = newWeighted;

        emit Staked(msg.sender, amount, u.staked);
    }

    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        require(amount > 0, "amount=0");
        UserInfo storage u = users[msg.sender];
        require(u.staked >= amount, "exceeds stake");
        require(block.timestamp >= u.lockEnd, "locked");

        u.staked -= amount;
        totalStaked -= amount;

        uint256 newMultiplier = _currentUserMultiplier(msg.sender, u);
        uint256 newWeighted = (u.staked * newMultiplier) / 1e18;
        totalWeightedStake = totalWeightedStake - u.weightedStake + newWeighted;
        u.weightedStake = newWeighted;

        stakeToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, u.staked);
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        UserInfo storage u = users[msg.sender];
        uint256 reward = u.rewardsAccrued;
        if (reward > 0) {
            u.rewardsAccrued = 0;
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external {
        uint256 bal = users[msg.sender].staked;
        if (bal > 0) {
            withdraw(bal);
        }
        getReward();
    }

    // ===== Owner controls =====
    function setRewardRate(uint256 newRate) external onlyOwner updateReward(address(0)) {
        emit RewardRateUpdated(rewardRatePerSecond, newRate);
        rewardRatePerSecond = newRate;
    }

    function setTiers(uint256[] calldata thresholds, uint256[] calldata multipliers) external onlyOwner updateReward(address(0)) {
        require(thresholds.length == multipliers.length, "tiers len");
        tierThresholds = thresholds;
        tierMultipliers = multipliers;
        emit TiersUpdated();
        // totalWeightedStake will be refreshed lazily as users interact
    }

    // Allow owner to recover tokens (e.g., leftover rewards)
    function recoverToken(address token, uint256 amount, address to) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    // ===== Modifiers =====
    modifier updateReward(address account) {
        uint256 rpw = rewardPerWeightedStake();
        rewardPerWeightedStakeStored = rpw;
        lastUpdateTime = block.timestamp;

        if (account != address(0)) {
            UserInfo storage u = users[account];
            uint256 accrued = 0;
            if (u.weightedStake > 0) {
                accrued = (u.weightedStake * (rpw - u.userRewardPerWeightedStakePaid)) / 1e18;
            }
            u.rewardsAccrued += accrued;
            u.userRewardPerWeightedStakePaid = rpw;

            // lazily refresh weighted stake (e.g., when lock expires or tiers changed)
            uint256 mNow = _currentUserMultiplier(account, u);
            uint256 wNow = (u.staked * mNow) / 1e18;
            if (wNow != u.weightedStake) {
                totalWeightedStake = totalWeightedStake - u.weightedStake + wNow;
                u.weightedStake = wNow;
            }
        }
        _;
    }

    // ===== Additional views/helpers =====
    function _currentUserMultiplier(address /*account*/, UserInfo storage u) internal view returns (uint256) {
        uint256 tierM = currentMultiplier(u.staked);
        uint256 lockM = (block.timestamp < u.lockEnd && u.lockBoostMultiplier > 0) ? u.lockBoostMultiplier : 1e18;
        return tierM >= lockM ? tierM : lockM;
    }

    function currentUserMultiplier(address account) external view returns (uint256) {
        UserInfo storage u = users[account];
        uint256 tierM = currentMultiplier(u.staked);
        uint256 lockM = (block.timestamp < u.lockEnd && u.lockBoostMultiplier > 0) ? u.lockBoostMultiplier : 1e18;
        return tierM >= lockM ? tierM : lockM;
    }

    function remainingRewards() external view returns (uint256) {
        return IERC20(rewardToken).balanceOf(address(this));
    }
}


