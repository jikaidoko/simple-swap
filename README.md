# Simple Swap
## An elementary Automated Market Maker (AMM) Liquidity Pool
![](https://github.com/jikaidoko/simple-swap/blob/readme-images/simpleSwap.PNG)
### With five basic functions
- addLiquidity(): Adds liquidity to the pool, minting LP tokens to the provider.
- removeLiquidity(): Removes liquidity from the pool, burning LP tokens and returning underlying tokens.
- swapExactTokensForTokens(): Swaps an exact amount of input tokens for an amount of output tokens.
- getPrice(): Gets the current price of one token relative to another in the pool.
- getAmountOut(): Calculates the amount of output tokens received for a given amount of input tokens.

#### Add Liquidity

This function allows users to deposit a pair of tokens (tokenA and tokenB) into the liquidity pool.
The amount of LP tokens minted is calculated based on the square root of the product of desired amounts for the first liquidity provider,
and proportionally to existing reserves for subsequent providers.
It also transfers the tokens from the user to the contract and updates the reserves.
##### Parameters:
- *tokenA*: The address of the first token in the pair.
- *tokenB*: The address of the second token in the pair.
- *amountADesired*: The desired amount of tokenA to add.
- *amountBDesired*: The desired amount of tokenB to add.
- *amountAMin*: The minimum amount of tokenA to add, to prevent unfavorable rates.
- *amountBMin*: The minimum amount of tokenB to add, to prevent unfavorable rates.
- *to*: The address that will receive the LP tokens.
- *deadline*: The timestamp by which the transaction must be completed.

##### Returns:
- *amountA:* The actual amount of tokenA added to the pool.
- *amountB:* The actual amount of tokenB added to the pool.
- *liquidity:* The amount of LP tokens minted.


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

        // Checks-Effects-Interactions Pattern
        reserveA += amountADesired;
        reserveB += amountBDesired;

        // Token transfer function to provide liquidity to the pool.
        // Previous allowance from the provider required
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountADesired);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountBDesired);

        // LP token minting function
        if (LPtokenSupply == 0) {
            // Uniswap V2 formula suggested for first liquidity provider: 
			//sqrt(amountADesired *amountBDesired)
            // Square root Newton-Raphson algorithm implementation
            uint256 x = (amountADesired * amountBDesired);
            uint256 z = x;
            uint256 nx = (x + 1) / 2;
            while (nx < z) {
                z = nx;
                nx = (z + x / z) / 2;
            }
            liquidity = z;
            LPtokenSupply = liquidity;
            _mint(to, liquidity);
        } else {
            /* Uniswap V2 formula used for other liquidity providers
             * lpTokensToMint = min((amountA * totalSupplyLP) / reserveA), 
			 *(amountB * totalSupplyLP) / reserveB))
             * The min function ensures the liquidity providers
             * only get LP tokens for the balanced portion of their deposit.
             */
            if ((amountADesired * LPtokenSupply / reserveA) <= 
			(amountBDesired * LPtokenSupply / reserveB)) {
                liquidity = amountADesired * LPtokenSupply / reserveA;
                LPtokenSupply += liquidity;
                _mint(to, liquidity);
            } else {
                liquidity = amountBDesired * LPtokenSupply / reserveB;
                LPtokenSupply += liquidity;
                _mint(to, liquidity);
            }
        }
        return (reserveA, reserveB, liquidity);
    }

#### Remove Liquidity
Removes liquidity from the pool, burning LP tokens and returning underlying tokens.
Users can burn their LP tokens to retrieve a proportional amount of the underlying token reserves.
The amounts of tokens returned are based on the liquidity provided relative to the total LP token supply.
##### Parameters
- *tokenA:* The address of the first token in the pair.
- *tokenB:* The address of the second token in the pair.
- *liquidity:* The amount of LP tokens to burn.
- *amountAMin:* The minimum amount of tokenA to receive, to prevent unfavorable rates.
- *amountBMin:* The minimum amount of tokenB to receive, to prevent unfavorable rates.
- *to:* The address that will receive the underlying tokens.
- *deadline:* The timestamp by which the transaction must be completed.

##### Returns:
- *amountA:* The actual amount of tokenA received.
- *amountB:* The actual amount of tokenB received.

```
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
            /* Uniswap V2 formula used to retrieve the proportional   
             * amount of A tokens and B tokens regarding the LP tokens
             * users aim to burn relative to the total LP supply.
             * reserveA * (liquidity / LPtokenSupply) &
             * reserveB * (liquidity / LPtokenSupply)*/
        amountA = reserveA * (liquidity / LPtokenSupply);
        amountB = reserveB * (liquidity / LPtokenSupply);
        // Checks-Effects-Interactions Pattern
        reserveA -= amountA;
        reserveB -= amountB;
        //Check the actual amount reaches the minimum desired by user
        require(amountA >= amountAMin && amountB >= amountBMin, "Minimal amount not reached");

        IERC20(tokenA).transfer(msg.sender, amountA);
        IERC20(tokenB).transfer(msg.sender, amountB);
        _burn(to, liquidity);
        return (amountA, amountB);
    }
```

#### Token Exchange
Swaps an exact amount of input tokens for an amount of output tokens. Facilitates token swaps based on the current reserves in the pool. It calculates the output amount based on the constant product formula and transfers tokens accordingly.
##### Parameters
- *amountIn:* The amount of input tokens to swap.
- *amountOutMin:* The minimum amount of output tokens to receive, to prevent unfavorable rates.
- *path:* An array of token addresses, ordered from input to output. For example, `[tokenA, tokenB]`.
- *to:* The address that will receive the output tokens.
- *deadline:* The timestamp by which the transaction must be completed.

```
function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    	) external {
        uint256 amountOut = 0;
        amountOut = (amountIn * (IERC20(path[1]).balanceOf(address(this)))) /
		((IERC20(path[0]).balanceOf(address(this))) + amountIn);
        require(amountOut >= amountOutMin, "Minimal amount not reached");
        require(deadline > block.timestamp, "Deadline exceeded");
        // Checks-Effects-Interactions Pattern
        reserveA += amountIn;
        reserveB -= amountOut;
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        IERC20(path[1]).transfer(to, amountOut);
    }

```
#### Get the current price
The price is calculated as the ratio of the reserves. The current price of one token is relative to the other in the pool.
##### Parameters
*- tokenA:* The address of the first token.
*- tokenB:* The address of the second token.
##### Returns
*- price:* The price of tokenB in terms of tokenA

```
function getPrice(
        address tokenA,
        address tokenB
    ) public view returns (uint256 price) {
        return price = (IERC20(tokenB).balanceOf(address(this))) * 1e18 /
        (IERC20(tokenA).balanceOf(address(this)));
    }
```
#### Get the expected output amount
Calculates the amount of output tokens received for a given amount of input tokens, based on the constant product formula: (amountIn \times reserveOut) / (reserveIn + amountIn).

```
function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256) {
        return (amountIn * reserveOut) / (reserveIn + amountIn);
    }
```
##### *Notice*
This elementary Automated Market Maker liquidity pool follows the Uniswap V2 protocol.

__________
