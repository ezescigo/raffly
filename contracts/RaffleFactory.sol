//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./RaffleClonable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

interface IImplementation {
    function initialize(address _raffleCreator) external;
}

interface IImplementationinterface {
    function initialize(address _whoopyCreator) external;
}

interface IVRFManager {
    function addConsumer(address consumerAddress) external;

    function removeConsumer(address consumerAddress) external;

    function withdraw(uint256 wAmount, address to) external;
}

interface IUpkeepManager {
    function registerAndPredictID(
        string memory name,
        bytes memory encryptedEmail,
        address upkeepContract,
        uint32 gasLimit,
        address adminAddress,
        bytes memory checkData,
        uint96 amount,
        uint8 source
    ) external returns (uint256 upkeepID);
}

contract RaffleFactory {
    address public immutable implementation;
    address public immutable _manager;
    address public immutable _upkeep;
    address public immutable deployer;
    address[] public raffles;

    event CloneCreated(address indexed _instance, address indexed creator);

    event NewConsumerAdded();

    event UpkeepAdded(uint256 _upkeepId);

    mapping(address => address[]) public rafflesList;

    constructor(address _implementation, address manager, address upkeep) {
        implementation = _implementation;
        _manager = manager;
        _upkeep = upkeep;
        deployer = msg.sender;
    }

    function createNewRaffle() external payable returns (address newInstance) {
        require(msg.value == 10000000000000000000 wei);

        newInstance = Clones.clone(implementation);
        IImplementation(newInstance).initialize(msg.sender);
        rafflesList[msg.sender].push(newInstance);
        raffles.push(newInstance);
        emit CloneCreated(newInstance, msg.sender);

        IVRFManager(_manager).addConsumer(newInstance);
        emit NewConsumerAdded();

        uint256 upkeepID = IUpkeepManager(_upkeep).registerAndPredictID(
            "Raffly",
            "0x",
            newInstance,
            5000000,
            msg.sender,
            "0x",
            5000000000000000000,
            0
        );
        emit UpkeepAdded(upkeepID);
        (bool success, ) = payable(msg.sender).call{value: 10000000000000000000}("");
        require(success, "tx failed");

        return newInstance;
    }
}
