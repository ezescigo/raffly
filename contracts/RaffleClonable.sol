// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__NotCreated();
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);
error Raffle__IncorrectPrizePercentage();

/**
 * @title Raffle Clonable Contract
 * @author Ezequiel Scigolini
 * @notice Creating decentralized smart contract
 * @dev Implements Chainlink VRF v2 and Keepers
 */
contract RaffleClonable is
    Initializable,
    Ownable,
    VRFConsumerBaseV2,
    KeeperCompatibleInterface,
    ReentrancyGuard
{
    // Types
    enum RaffleState {
        OPEN,
        CALCULATING,
        CLOSED
    } // uint256 0 = OPEN, 1 = CALCULATING, 2 = CLOSED

    // State Variables
    address payable[] private s_players;
    address payable[] private s_recentWinners;
    address[] public addressIndexes;
    VRFCoordinatorV2Interface private i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private constant callbackGasLimit = 2000000;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // Raffle variables
    address public immutable _vrfAdd;
    address public s_raffleManager;
    address public s_raffleOwner;
    address private s_recentWinner;
    // address private s_recentWinner2;
    // address private s_recentWinner3;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 public s_entranceFee;
    uint256 public s_interval;
    uint256 public s_winnerPrizePercentage; // between 0 and 100;
    // uint32 public s_maxWinners;
    string public s_raffleName;
    bool isInitialized;
    bool s_raffleCreated;
    bool private upkeepPerformed; // required??
    bool onAbortRaffle;

    // Events
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);
    event RaffleCreated(
        string raffleName,
        uint256 entranceFee,
        uint32 maxWinners,
        uint256 interval,
        address ownerAddress,
        address raffleAddress,
        uint256 balance
    );
    event PlayerEntered(
        address indexed player,
        uint256 balance,
        uint256 currentPlayersNumber,
        string raffleName,
        address[] players,
        uint256 entranceFee,
        address raffleAddress,
        address ownerAddress
    );
    event PlayersRefunded();

    struct Player {
        uint256 entryCount;
        uint256 index;
    }

    // Mappings
    mapping(address => Player) players;
    mapping(address => uint256) balances;

    // Functions
    constructor(
        address vrfCoordinatorV2,
        uint64 subscriptionId,
        bytes32 gasLane
    ) initializer VRFConsumerBaseV2(vrfCoordinatorV2) {
        _vrfAdd = vrfCoordinatorV2;
        i_subscriptionId = subscriptionId;
        i_gasLane = gasLane;
        s_raffleManager = address(msg.sender);
        isInitialized = true;
    }

    // Called in every new instance (after raffleFactory.createNewRaffle() is called)
    function initialize(address _raffleOwner) public payable initializer {
        require(isInitialized == false, "contract constructor already called");
        transferOwnership(_raffleOwner);
        s_raffleState = RaffleState.CLOSED;
        i_vrfCoordinator = VRFCoordinatorV2Interface(_vrfAdd);
        s_raffleOwner = _raffleOwner;
        s_raffleCreated = false;
        upkeepPerformed = false;
        onAbortRaffle = false;
    }

    // After creating the instance, the owner must call createRaffle() and provide config parameters
    function createRaffle(
        string memory raffleName,
        uint256 entranceFee,
        uint32 maxWinners,
        uint256 interval,
        uint256 winnerPrizePercentage
    ) public onlyOwner {
        require(msg.sender == s_raffleOwner, "Only owner can create Raffle");
        require(s_raffleCreated == false, "Raffle is already created");
        if (winnerPrizePercentage > 100) {
            revert Raffle__IncorrectPrizePercentage();
        }
        s_raffleName = raffleName;
        s_entranceFee = entranceFee;
        s_winnerPrizePercentage = winnerPrizePercentage;
        // s_maxWinners = maxWinners;
        s_interval = interval; //* 86400;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        s_raffleCreated = true;

        emit RaffleCreated(
            raffleName,
            entranceFee,
            maxWinners,
            interval,
            msg.sender,
            address(this),
            address(this).balance
        );
    }

    function enterRaffle() external payable {
        if (msg.value < s_entranceFee) {
            revert Raffle__NotEnoughETHEntered();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        if (!s_raffleCreated) {
            revert Raffle__NotCreated();
        }

        if (players[msg.sender].entryCount == 0) {
            addressIndexes.push(msg.sender);
            s_players.push(payable(msg.sender));
            players[msg.sender].entryCount = 1;
            players[msg.sender].index = addressIndexes.length;
        } else {
            players[msg.sender].entryCount += 1;
        }

        emit PlayerEntered(
            msg.sender,
            address(this).balance,
            s_players.length,
            s_raffleName,
            addressIndexes,
            s_entranceFee,
            // s_maxWinners,
            address(this),
            s_raffleOwner
        );
    }

    /**
     * @dev This is the function that the Chainlink Keeper nodes call
     * they look for the 'upkeepNeeded' to return true
     * The following should be true in order to return true:
     * 1. Time interval should have passed
     * 2. Raffle should at least have 1 player
     * 3. Keeper's Subscription is funded with LINK
     * 4. Lottery should be in 'Open' state
     */
    function checkUpkeep(
        bytes memory /* checkData */
    ) public override returns (bool upKeepNeeded, bytes memory /* performData */) {
        bool isOpen = (RaffleState.OPEN == s_raffleState);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > s_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;
        upKeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
        return (upKeepNeeded, "0x0");
    }

    function performUpkeep(bytes calldata /* _performData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }
        s_raffleState = RaffleState.CALCULATING;

        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            callbackGasLimit,
            NUM_WORDS // s_maxWinners
        );
        emit RequestedRaffleWinner(requestId);
    }

    function fulfillRandomWords(
        uint256,
        /* requestId */ uint256[] memory randomWords
    ) internal override nonReentrant {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_recentWinners.push(payable(recentWinner));
        s_raffleState = RaffleState.CLOSED;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;

        // Winner receives % setted by Owner
        (bool successWinner, ) = recentWinner.call{
            value: (address(this).balance * s_winnerPrizePercentage) / 100
        }("");
        if (!successWinner) {
            revert Raffle__TransferFailed();
        }

        // Owner receives the remaining balance
        (bool successOwner, ) = s_raffleOwner.call{value: address(this).balance}("");
        if (!successOwner) {
            revert Raffle__TransferFailed();
        }

        emit WinnerPicked(recentWinner);
    }

    function setEmergencyMode() public adminRestricted {
        onAbortRaffle = true;
    }

    function onAbortWithdrawEntryFee() public {
        require(balances[msg.sender] >= s_entranceFee);
        require(onAbortRaffle == true);
        balances[msg.sender] -= s_entranceFee;
        (bool sent, ) = msg.sender.call{value: s_entranceFee}("");
        require(sent, "failed to send ether");
    }

    // View / Pure functions
    function getEntranceFee() public view returns (uint256) {
        return s_entranceFee;
    }

    function getInterval() public view returns (uint256) {
        return s_interval;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function getPlayers() public view returns (address payable[] memory) {
        return s_players;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    // Modifiers

    modifier adminRestricted() {
        require(msg.sender == s_raffleManager);
        _;
    }

    // modifier restricted() {
    //     require(msg.sender == s_raffleOwner);
    //     _;
    // }
}
