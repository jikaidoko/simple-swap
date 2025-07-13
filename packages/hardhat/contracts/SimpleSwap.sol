// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

/// @title Interface for SimpleSwap
interface ISimpleSwap {
    /// @notice Adds liquidity to the pool, minting LP tokens to the provider.
    /// @param tokenA The address of the first token in the pair.
    /// @param tokenB The address of the second token in the pair.
    /// @param amountADesired The desired amount of tokenA to add.
    /// @param amountBDesired The desired amount of tokenB to add.
    /// @param amountAMin The minimum amount of tokenA to add, to prevent unfavorable rates.
    /// @param amountBMin The minimum amount of tokenB to add, to prevent unfavorable rates.
    /// @param to The address that will receive the LP tokens.
    /// @param deadline The timestamp by which the transaction must be completed.
    /// @return amountA The actual amount of tokenA added to the pool.
    /// @return amountB The actual amount of tokenB added to the pool.
    /// @return liquidity The amount of LP tokens minted.
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    /// @notice Removes liquidity from the pool, burning LP tokens and returning underlying tokens.
    /// @param tokenA The address of the first token in the pair.
    /// @param tokenB The address of the second token in the pair.
    /// @param liquidity The amount of LP tokens to burn.
    /// @param amountAMin The minimum amount of tokenA to receive, to prevent unfavorable rates.
    /// @param amountBMin The minimum amount of tokenB to receive, to prevent unfavorable rates.
    /// @param to The address that will receive the underlying tokens.
    /// @param deadline The timestamp by which the transaction must be completed.
    /// @return amountA The actual amount of tokenA received.
    /// @return amountB The actual amount of tokenB received.
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);

    /// @notice Swaps an exact amount of input tokens for an amount of output tokens.
    /// @param amountIn The amount of input tokens to swap.
    /// @param amountOutMin The minimum amount of output tokens to receive, to prevent unfavorable rates.
    /// @param path An array of token addresses, ordered from input to output. For example, `[tokenA, tokenB]`.
    /// @param to The address that will receive the output tokens.
    /// @param deadline The timestamp by which the transaction must be completed.
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;

    /// @notice Gets the current price of one token relative to another in the pool.
    /// @param tokenA The address of the first token.
    /// @param tokenB The address of the second token.
    /// @return price The price of tokenB in terms of tokenA (tokenB reserve / tokenA reserve * 1e18).
    function getPrice(
        address tokenA,
        address tokenB
    ) external view returns (uint256 price);

    /// @notice Calculates the amount of output tokens received for a given amount of input tokens.
    /// @param amountIn The amount of input tokens.
    /// @param reserveIn The current reserve of the input token in the pool.
    /// @param reserveOut The current reserve of the output token in the pool.
    /// @return The calculated amount of output tokens.
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) external view returns (uint256);
}

/// @title A simplified decentralized exchange for swapping and providing liquidity.
/// @notice This contract implements a basic automated market maker (AMM) for two tokens, allowing users to add/remove liquidity and swap tokens.
contract SimpleSwap is ERC20, ISimpleSwap {
    /// @dev The total supply of LP (Liquidity Provider) tokens.
    uint256 LPtokenSupply;
    /// @dev The reserve of token A in the liquidity pool.
    uint256 public reserveA; // Made public for easier testing
    /// @dev The reserve of token B in the liquidity pool.
    uint256 public reserveB; // Made public for easier testing
    /// @dev Events to log significant actions in the contract for transparency and tracking.
    event LiquidityAdded(
        address indexed provider,
        address tokenA,
        address tokenB,
        uint256 amountAAdded,
        uint256 amountBAdded,
        uint256 lpTokensMinted
    );

    event LiquidityRemoved(
        address indexed provider,
        address tokenA,
        address tokenB,
        uint256 amountAReceived,
        uint256 amountBReceived,
        uint256 lpTokensBurned
    );

    event Swap(
        address indexed swapper,
        address inputToken,
        address outputToken,
        uint256 amountIn,
        uint256 amountOut
    );
   

    /// @notice Constructor for the SimpleSwap contract.
    /// @dev Initializes the ERC20 LP token with a name and symbol.
    constructor() ERC20("LP Token", "LPT") {}

    /// @notice Adds liquidity to the pool, minting LP tokens to the provider.
    /// @dev This function allows users to deposit a pair of tokens (tokenA and tokenB) into the liquidity pool.
    ///      The amount of LP tokens minted is calculated based on the square root of the product of desired amounts for the first liquidity provider,
    ///      and proportionally to existing reserves for subsequent providers.
    ///      It also transfers the tokens from the user to the contract and updates the reserves.
    /// @param tokenA The address of the first token in the pair.
    /// @param tokenB The address of the second token in the pair.
    /// @param amountADesired The desired amount of tokenA to add.
    /// @param amountBDesired The desired amount of tokenB to add.
    /// @param amountAMin The minimum amount of tokenA to add, to prevent unfavorable rates.
    /// @param amountBMin The minimum amount of tokenB to add, to prevent unfavorable rates.
    /// @param to The address that will receive the LP tokens.
    /// @param deadline The timestamp by which the transaction must be completed.
    /// @return amountA The actual amount of tokenA added to the pool.
    /// @return amountB The actual amount of tokenB added to the pool.
    /// @return liquidity The amount of LP tokens minted.
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        require(amountADesired != 0 && amountBDesired != 0, "Amounts cannot be zero");
        require(amountAMin <= amountADesired && amountBMin <= amountBDesired, "Minimum not reached");
        require(block.timestamp <= deadline, "Deadline exceeded");

        // Token transfer function to provide liquidity to the pool.
        // Previous allowance from the provider required
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountADesired);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountBDesired);

        // For simplicity in this example, assume desired amounts are actual amounts transferred.
        amountA = amountADesired;
        amountB = amountBDesired;

        // Checks-Effects-Interactions Pattern
        reserveA += amountA;
        reserveB += amountB;

        // LP token minting function
        if (LPtokenSupply == 0) {
            // Uniswap V2 formula suggested for first liquidity provider: sqrt(amountA * amountB)
            liquidity = Math.sqrt(amountA * amountB);
            // Update the total supply of LP tokens
            LPtokenSupply = liquidity;
            _mint(to, liquidity);
        } else {
            if (reserveA == 0 || reserveB == 0) {
                revert("Insufficient reserves for proportional liquidity calculation");
            }
            uint256 liquidityA = (amountA * LPtokenSupply) / reserveA;
            uint256 liquidityB = (amountB * LPtokenSupply) / reserveB;

            liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;

            require(liquidity > 0, "No LP tokens minted due to imbalance or small amounts");

            LPtokenSupply += liquidity;
            _mint(to, liquidity);
        }

        // This event logs the details of the liquidity addition for transparency and tracking.
        emit LiquidityAdded(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
        

        return (amountA, amountB, liquidity);
    }

    /// @notice Removes liquidity from the pool, burning LP tokens and returning underlying tokens.
    /// @dev Users can burn their LP tokens to retrieve a proportional amount of the underlying token reserves.
    ///      The amounts of tokens returned are based on the liquidity provided relative to the total LP token supply.
    /// @param tokenA The address of the first token in the pair.
    /// @param tokenB The address of the second token in the pair.
    /// @param liquidity The amount of LP tokens to burn.
    /// @param amountAMin The minimum amount of tokenA to receive, to prevent unfavorable rates.
    /// @param amountBMin The minimum amount of tokenB to receive, to prevent unfavorable rates.
    /// @param to The address that will receive the underlying tokens.
    /// @param deadline The timestamp by which the transaction must be completed.
    /// @return amountA The actual amount of tokenA received.
    /// @return amountB The actual amount of tokenB received.
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB) {
        require(liquidity > 0, "Liquidity should not be zero");
        require(block.timestamp <= deadline, "Deadline exceeded");
        require(LPtokenSupply > 0, "No liquidity in pool"); // Added check

        /* Uniswap V2 formula used to retrieve the proportional
         * amount of A tokens and B tokens regarding the LP tokens
         * users aim to burn relative to the total LP supply.
         * reserveA * (liquidity / LPtokenSupply) &
         * reserveB * (liquidity / LPtokenSupply)*/
        amountA = (reserveA * liquidity) / LPtokenSupply; // Corrected division order for precision
        amountB = (reserveB * liquidity) / LPtokenSupply; // Corrected division order for precision

        // Checks-Effects-Interactions Pattern
        reserveA -= amountA;
        reserveB -= amountB;
        LPtokenSupply -= liquidity; // Update LP token supply

        //Check the actual amount reaches the minimum desired by user
        require(amountA >= amountAMin && amountB >= amountBMin, "Minimal amount not reached");

        IERC20(tokenA).transfer(to, amountA); // Transferred to 'to' address
        IERC20(tokenB).transfer(to, amountB); // Transferred to 'to' address
        _burn(msg.sender, liquidity); // msg.sender burns their LP tokens

        // This event logs the details of the liquidity removal for transparency and tracking.
        emit LiquidityRemoved(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
        
        return (amountA, amountB);
    }

    /// @notice Swaps an exact amount of input tokens for an amount of output tokens.
    /// @dev This function facilitates token swaps based on the current reserves in the pool.
    ///      It calculates the output amount based on the constant product formula and
    ///      transfers tokens accordingly.
    /// @param amountIn The amount of input tokens to swap.
    /// @param amountOutMin The minimum amount of output tokens to receive, to prevent unfavorable rates.
    /// @param path An array of token addresses, ordered from input to output. For example, `[tokenA, tokenB]`.
    /// @param to The address that will receive the output tokens.
    /// @param deadline The timestamp by which the transaction must be completed.
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external {
        require(path.length == 2, "Path must be two tokens");
        require(amountIn > 0, "Amount in must be greater than zero");
        require(block.timestamp <= deadline, "Deadline exceeded"); // Changed to <= for consistency

        address inputTokenAddress = path[0];
        address outputTokenAddress = path[1];

        // Get current reserves (balances of tokens held by this swap contract)
        uint256 inputReserve = IERC20(inputTokenAddress).balanceOf(address(this));
        uint256 outputReserve = IERC20(outputTokenAddress).balanceOf(address(this));

        require(inputReserve > 0 && outputReserve > 0, "Insufficient liquidity for swap");

        // Calculate amountOut using the constant product formula (x * y = k)
        // (reserveOut * amountIn) / (reserveIn + amountIn) is a common simplification
        uint256 amountOut = getAmountOut(amountIn, inputReserve, outputReserve);

        require(amountOut >= amountOutMin, "Minimal amount not reached");

        // Transfer input token from sender to swap contract
        IERC20(inputTokenAddress).transferFrom(msg.sender, address(this), amountIn);

        // Update internal reserves based on the swap (important for price calculation)
        // Note: These are simplified updates. 
        if (inputTokenAddress == address(aToken)) { // Assuming aToken and bToken are known
            reserveA += amountIn;
            reserveB -= amountOut;
        } else if (inputTokenAddress == address(bToken)) {
            reserveB += amountIn;
            reserveA -= amountOut;
        }
        // This if/else if block assumes that tokenA and tokenB are fixed.
        // For a generic AMM, you would need a mapping from token address to its reserve.
        // For this SimpleSwap, let's assume tokenA is always reserveA and tokenB is always reserveB.

        // Transfer output token from swap contract to recipient
        IERC20(outputTokenAddress).transfer(to, amountOut);

        emit Swap(msg.sender, inputTokenAddress, outputTokenAddress, amountIn, amountOut);
        
    }

    /// @notice Gets the current price of one token relative to another in the pool.
    /// @dev The price is calculated as the ratio of the reserves, scaled by 1e18.
    /// @param tokenA The address of the first token.
    /// @param tokenB The address of the second token.
    /// @return price The price of tokenB in terms of tokenA (tokenB reserve / tokenA reserve * 1e18).
    function getPrice(
        address tokenA,
        address tokenB
    ) public view returns (uint256 price) {
        // Use internal reserves for price calculation, not external balances
        uint256 currentReserveA = (tokenA == address(aToken)) ? reserveA : reserveB;
        uint256 currentReserveB = (tokenB == address(bToken)) ? reserveB : reserveA;

        require(currentReserveA > 0, "Token A reserve is zero for price calculation");
        return (currentReserveB * 1e18) / currentReserveA;
    }

    /// @notice Calculates the amount of output tokens received for a given amount of input tokens.
    /// @dev This pure function calculates the output amount based on the constant product formula
    ///      ($k = reserveIn \times reserveOut$). The formula used is $(amountIn \times reserveOut) / (reserveIn + amountIn)$.
    /// @param amountIn The amount of input tokens.
    /// @param reserveIn The current reserve of the input token in the pool.
    /// @param reserveOut The current reserve of the output token in the pool.
    /// @return The calculated amount of output tokens.
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
        require(reserveIn > 0, "Input reserve cannot be zero");
        return (amountIn * reserveOut) / (reserveIn + amountIn);
    }

    address public aToken; // Assuming these are set in a real constructor
    address public bToken; // Assuming these are set in a real constructor

}
