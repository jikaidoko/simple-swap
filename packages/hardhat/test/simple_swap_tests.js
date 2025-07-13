const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { time } = require("@nomicfoundation/hardhat-network-helpers"); // Import time helpers

describe("SimpleSwap", function () {
  // This fixture deploys all necessary contracts (AToken, BToken, SimpleSwap)
  // and sets up the initial state for tests.
  async function deploySimpleSwapFixture() {
    const [deployer, addr1, addr2] = await ethers.getSigners();

    // Deploy AToken and BToken
    const ATokenFactory = await ethers.getContractFactory("AToken");
    const aToken = await ATokenFactory.deploy();
    await aToken.waitForDeployment();

    const BTokenFactory = await ethers.getContractFactory("BToken");
    const bToken = await BTokenFactory.deploy();
    await bToken.waitForDeployment();

    // Deploy SimpleSwap (LP Token)
    const SimpleSwapFactory = await ethers.getContractFactory("SimpleSwap");
    const swap = await SimpleSwapFactory.deploy(); // No constructor args for SimpleSwap
    await swap.waitForDeployment();

    // Mint some AToken and BToken to addr1 for testing liquidity provision and swaps
    const initialMintAmount = BigInt(1000000000000000000000n); // 1000 tokens (assuming 18 decimals)
    await aToken.mint(addr1.address, initialMintAmount);
    await bToken.mint(addr1.address, initialMintAmount);

    // Return all deployed contracts and signers
    return { swap, aToken, bToken, deployer, addr1, addr2 };
  }

  // Helper function to add initial liquidity for other tests
  async function addInitialLiquidity(swap, aToken, bToken, provider) {
    const amountADesired = BigInt(100000000000000000000n); // 100 AToken
    const amountBDesired = BigInt(100000000000000000000n); // 100 BToken (1:1 ratio for simplicity)
    const amountAMin = amountADesired;
    const amountBMin = amountBDesired;

    await aToken.connect(provider).approve(swap.target, amountADesired);
    await bToken.connect(provider).approve(swap.target, amountBDesired);

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestamp = blockBefore.timestamp;
    const deadline = timestamp + 300;

    const tx = await swap.connect(provider).addLiquidity(
      aToken.target,
      bToken.target,
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin,
      provider.address,
      deadline
    );
    const receipt = await tx.wait();

    const expectedEventTopic = ethers.id("LiquidityAdded(address,address,address,uint256,uint256,uint256)");
    const liquidityAddedEvent = receipt.logs.find(
      (log) => log.address === swap.target && log.topics[0] === expectedEventTopic
    );
    const decodedEvent = swap.interface.decodeEventLog(
      "LiquidityAdded",
      liquidityAddedEvent.data,
      liquidityAddedEvent.topics
    );

    return {
      actualAmountA: decodedEvent.amountAAdded,
      actualAmountB: decodedEvent.amountBAdded,
      mintedLiquidity: decodedEvent.lpTokensMinted,
    };
  }

  describe("Deployment", function () {
    it("should deploy the SimpleSwap contract", async function () {
      const { swap } = await loadFixture(deploySimpleSwapFixture);
      expect(swap.target).to.be.properAddress;
    });
  });

  describe("addLiquidity", function () {
    it("should allow adding liquidity for the first time", async function () {
      const { swap, aToken, bToken, addr1 } = await loadFixture(deploySimpleSwapFixture);

      const amountADesired = BigInt(200);
      const amountBDesired = BigInt(50);
      const amountAMin = BigInt(190);
      const amountBMin = BigInt(45);

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestamp = blockBefore.timestamp;
      const deadline = timestamp + 300;

      const initialATokenBalanceAddr1 = await aToken.balanceOf(addr1.address);
      const initialBTokenBalanceAddr1 = await bToken.balanceOf(addr1.address);

      await aToken.connect(addr1).approve(swap.target, amountADesired);
      await bToken.connect(addr1).approve(swap.target, amountBDesired);

      const tx = await swap.connect(addr1).addLiquidity(
        aToken.target,
        bToken.target,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        addr1.address,
        deadline
      );
      const receipt = await tx.wait();

      const expectedEventTopic = ethers.id("LiquidityAdded(address,address,address,uint256,uint256,uint256)");
      const liquidityAddedEvent = receipt.logs.find(
        (log) => log.address === swap.target && log.topics[0] === expectedEventTopic
      );

      expect(liquidityAddedEvent).to.not.be.undefined;
      const decodedEvent = swap.interface.decodeEventLog(
        "LiquidityAdded",
        liquidityAddedEvent.data,
        liquidityAddedEvent.topics
      );

      const actualAmountA = decodedEvent.amountAAdded;
      const actualAmountB = decodedEvent.amountBAdded;
      const mintedLiquidity = decodedEvent.lpTokensMinted;

      const addr1LpBalance = await swap.balanceOf(addr1.address);
      expect(addr1LpBalance).to.be.gt(BigInt(0), "Addr1 LP balance should be greater than 0");
      expect(addr1LpBalance).to.equal(mintedLiquidity, "Addr1 LP balance should match minted liquidity");

      const finalATokenBalanceAddr1 = await aToken.balanceOf(addr1.address);
      const finalBTokenBalanceAddr1 = await bToken.balanceOf(addr1.address);
      expect(finalATokenBalanceAddr1).to.equal(initialATokenBalanceAddr1 - actualAmountA, "Addr1 AToken balance incorrect");
      expect(finalBTokenBalanceAddr1).to.equal(initialBTokenBalanceAddr1 - actualAmountB, "Addr1 BToken balance incorrect");

      const swapATokenBalance = await aToken.balanceOf(swap.target);
      const swapBTokenBalance = await bToken.balanceOf(swap.target);
      expect(swapATokenBalance).to.equal(actualAmountA, "SimpleSwap AToken balance incorrect");
      expect(swapBTokenBalance).to.equal(actualAmountB, "SimpleSwap BToken balance incorrect");

      expect(await swap.reserveA()).to.equal(actualAmountA, "SimpleSwap reserveA incorrect");
      expect(await swap.reserveB()).to.equal(actualAmountB, "SimpleSwap reserveB incorrect");

      const expectedSqrtProduct = Math.floor(Math.sqrt(Number(amountADesired) * Number(amountBDesired)));
      expect(mintedLiquidity).to.be.closeTo(BigInt(expectedSqrtProduct), BigInt(1));
    });

    it("should revert if deadline is exceeded", async function () {
      const { swap, aToken, bToken, addr1 } = await loadFixture(deploySimpleSwapFixture);

      const amountADesired = BigInt(100);
      const amountBDesired = BigInt(100);
      const amountAMin = BigInt(90);
      const amountBMin = BigInt(90);

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestamp = blockBefore.timestamp;
      const deadline = timestamp - 1; // Deadline in the past

      await aToken.connect(addr1).approve(swap.target, amountADesired);
      await bToken.connect(addr1).approve(swap.target, amountBDesired);

      await expect(
        swap.connect(addr1).addLiquidity(
          aToken.target,
          bToken.target,
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          addr1.address,
          deadline
        )
      ).to.be.revertedWith("Deadline exceeded");
    });

    it("should revert if amounts are zero", async function () {
      const { swap, aToken, bToken, addr1 } = await loadFixture(deploySimpleSwapFixture);

      const amountADesired = BigInt(0); // Zero amount
      const amountBDesired = BigInt(50);
      const amountAMin = BigInt(0);
      const amountBMin = BigInt(45);

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestamp = blockBefore.timestamp;
      const deadline = timestamp + 300;

      await aToken.connect(addr1).approve(swap.target, amountBDesired);
      await bToken.connect(addr1).approve(swap.target, amountBDesired);

      await expect(
        swap.connect(addr1).addLiquidity(
          aToken.target,
          bToken.target,
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          addr1.address,
          deadline
        )
      ).to.be.revertedWith("Amounts cannot be zero");
    });
  });

  describe("removeLiquidity", function () {
    it("should allow removing liquidity", async function () {
      const { swap, aToken, bToken, addr1 } = await loadFixture(deploySimpleSwapFixture);

      // Add initial liquidity
      const { mintedLiquidity: initialLpTokens } = await addInitialLiquidity(swap, aToken, bToken, addr1);

      const lpTokensToBurn = initialLpTokens / BigInt(2); // Burn half
      const amountAMin = BigInt(0); // For simplicity, allow any amount for now
      const amountBMin = BigInt(0);

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestamp = blockBefore.timestamp;
      const deadline = timestamp + 300;

      // Get initial balances before removal
      const initialATokenBalanceAddr1 = await aToken.balanceOf(addr1.address);
      const initialBTokenBalanceAddr1 = await bToken.balanceOf(addr1.address);
      const initialLpBalanceAddr1 = await swap.balanceOf(addr1.address);
      const initialSwapATokenBalance = await aToken.balanceOf(swap.target);
      const initialSwapBTokenBalance = await bToken.balanceOf(swap.target);

      // Approve SimpleSwap to burn LP tokens from addr1
      await swap.connect(addr1).approve(swap.target, lpTokensToBurn);

      const tx = await swap.connect(addr1).removeLiquidity(
        aToken.target,
        bToken.target,
        lpTokensToBurn,
        amountAMin,
        amountBMin,
        addr1.address, // Recipient of tokens
        deadline
      );
      const receipt = await tx.wait();

      const expectedEventTopic = ethers.id("LiquidityRemoved(address,address,address,uint256,uint256,uint256)");
      const liquidityRemovedEvent = receipt.logs.find(
        (log) => log.address === swap.target && log.topics[0] === expectedEventTopic
      );

      expect(liquidityRemovedEvent).to.not.be.undefined;
      const decodedEvent = swap.interface.decodeEventLog(
        "LiquidityRemoved",
        liquidityRemovedEvent.data,
        liquidityRemovedEvent.topics
      );

      const amountAReceived = decodedEvent.amountAReceived;
      const amountBReceived = decodedEvent.amountBReceived;
      const lpTokensBurned = decodedEvent.lpTokensBurned;

      // Assertions
      expect(lpTokensBurned).to.equal(lpTokensToBurn, "LP tokens burned should match amount desired");
      expect(await swap.balanceOf(addr1.address)).to.equal(initialLpBalanceAddr1 - lpTokensToBurn, "Addr1 LP balance not updated");

      expect(await aToken.balanceOf(addr1.address)).to.equal(initialATokenBalanceAddr1 + amountAReceived, "Addr1 AToken balance not updated");
      expect(await bToken.balanceOf(addr1.address)).to.equal(initialBTokenBalanceAddr1 + amountBReceived, "Addr1 BToken balance not updated");

      expect(await aToken.balanceOf(swap.target)).to.equal(initialSwapATokenBalance - amountAReceived, "Swap AToken balance not updated");
      expect(await bToken.balanceOf(swap.target)).to.equal(initialSwapBTokenBalance - amountBReceived, "Swap BToken balance not updated");

      expect(await swap.reserveA()).to.equal(initialSwapATokenBalance - amountAReceived, "Swap reserveA not updated");
      expect(await swap.reserveB()).to.equal(initialSwapBTokenBalance - amountBReceived, "Swap reserveB not updated");
    });

    it("should revert if liquidity is zero", async function () {
      const { swap, aToken, bToken, addr1 } = await loadFixture(deploySimpleSwapFixture);
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestamp = blockBefore.timestamp;
      const deadline = timestamp + 300;

      await expect(
        swap.connect(addr1).removeLiquidity(
          aToken.target,
          bToken.target,
          BigInt(0), // Zero liquidity
          BigInt(0),
          BigInt(0),
          addr1.address,
          deadline
        )
      ).to.be.revertedWith("Liquidity should not be zero");
    });

    it("should revert if no liquidity in pool", async function () {
      const { swap, aToken, bToken, addr1 } = await loadFixture(deploySimpleSwapFixture);
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestamp = blockBefore.timestamp;
      const deadline = timestamp + 300;

      // No initial liquidity added

      await expect(
        swap.connect(addr1).removeLiquidity(
          aToken.target,
          bToken.target,
          BigInt(100),
          BigInt(0),
          BigInt(0),
          addr1.address,
          deadline
        )
      ).to.be.revertedWith("No liquidity in pool");
    });
  });

  describe("swapExactTokensForTokens", function () {
    it("should allow swapping tokens", async function () {
      const { swap, aToken, bToken, addr1, addr2 } = await loadFixture(deploySimpleSwapFixture);

      // Add initial liquidity to the pool (e.g., 100 AToken, 100 BToken)
      await addInitialLiquidity(swap, aToken, bToken, addr1);

      // Amount of AToken to swap
      const amountIn = BigInt(10000000000000000000n); // 10 AToken
      const amountOutMin = BigInt(1); // Expect at least 1 BToken
      const path = [aToken.target, bToken.target]; // Swap AToken for BToken
      const to = addr2.address; // Send output to addr2

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestamp = blockBefore.timestamp;
      const deadline = timestamp + 300;

      // Get initial balances before swap
      const initialATokenBalanceAddr1 = await aToken.balanceOf(addr1.address);
      const initialBTokenBalanceAddr2 = await bToken.balanceOf(addr2.address);
      const initialSwapATokenBalance = await aToken.balanceOf(swap.target);
      const initialSwapBTokenBalance = await bToken.balanceOf(swap.target);
      const initialSwapReserveA = await swap.reserveA();
      const initialSwapReserveB = await swap.reserveB();

      // Approve SimpleSwap to spend AToken from addr1
      await aToken.connect(addr1).approve(swap.target, amountIn);

      const tx = await swap.connect(addr1).swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        to,
        deadline
      );
      const receipt = await tx.wait();

      const expectedEventTopic = ethers.id("Swap(address,address,address,uint256,uint256)");
      const swapEvent = receipt.logs.find(
        (log) => log.address === swap.target && log.topics[0] === expectedEventTopic
      );

      expect(swapEvent).to.not.be.undefined;
      const decodedEvent = swap.interface.decodeEventLog(
        "Swap",
        swapEvent.data,
        swapEvent.topics
      );

      const actualAmountOut = decodedEvent.amountOut;

      // Assertions
      expect(await aToken.balanceOf(addr1.address)).to.equal(initialATokenBalanceAddr1 - amountIn, "Addr1 AToken balance incorrect after swap");
      expect(await bToken.balanceOf(addr2.address)).to.equal(initialBTokenBalanceAddr2 + actualAmountOut, "Addr2 BToken balance incorrect after swap");

      expect(await aToken.balanceOf(swap.target)).to.equal(initialSwapATokenBalance + amountIn, "Swap AToken balance incorrect after swap");
      expect(await bToken.balanceOf(swap.target)).to.equal(initialSwapBTokenBalance - actualAmountOut, "Swap BToken balance incorrect after swap");

      // Verify calculated amountOut (using the contract's own getAmountOut logic)
      const expectedAmountOutFromContract = await swap.getAmountOut(amountIn, initialSwapReserveA, initialSwapReserveB);
      expect(actualAmountOut).to.equal(expectedAmountOutFromContract, "Actual amount out does not match contract's calculation");
    });

    it("should revert if deadline is exceeded", async function () {
      const { swap, aToken, bToken, addr1, addr2 } = await loadFixture(deploySimpleSwapFixture);
      await addInitialLiquidity(swap, aToken, bToken, addr1);

      const amountIn = BigInt(100);
      const amountOutMin = BigInt(1);
      const path = [aToken.target, bToken.target];
      const to = addr2.address;

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestamp = blockBefore.timestamp;
      const deadline = timestamp - 1; // Deadline in the past

      await aToken.connect(addr1).approve(swap.target, amountIn);

      await expect(
        swap.connect(addr1).swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          path,
          to,
          deadline
        )
      ).to.be.revertedWith("Deadline exceeded");
    });

    it("should revert if insufficient liquidity for swap", async function () {
      const { swap, aToken, bToken, addr1, addr2 } = await loadFixture(deploySimpleSwapFixture);
      // NO initial liquidity added here

      const amountIn = BigInt(100);
      const amountOutMin = BigInt(1);
      const path = [aToken.target, bToken.target];
      const to = addr2.address;

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestamp = blockBefore.timestamp;
      const deadline = timestamp + 300;

      await aToken.connect(addr1).approve(swap.target, amountIn);

      await expect(
        swap.connect(addr1).swapExactTokensForTokens(
          amountIn,
          amountOutMin,
          path,
          to,
          deadline
        )
      ).to.be.revertedWith("Insufficient liquidity for swap");
    });
  });

  describe("getPrice", function () {
    it("should return the correct price after adding liquidity", async function () {
      const { swap, aToken, bToken, addr1 } = await loadFixture(deploySimpleSwapFixture);

      // Add initial liquidity (e.g., 100 AToken, 100 BToken)
      await addInitialLiquidity(swap, aToken, bToken, addr1);

      const price = await swap.getPrice(aToken.target, bToken.target);

      // Expected price calculation: (reserveB * 1e18) / reserveA
      // After addInitialLiquidity, reserveA = 100e18, reserveB = 100e18
      const expectedPrice = (BigInt(100000000000000000000n) * BigInt(1e18)) / BigInt(100000000000000000000n); // 1 * 1e18
      expect(price).to.equal(expectedPrice);

      // Test reverse price
      const priceReverse = await swap.getPrice(bToken.target, aToken.target);
      const expectedPriceReverse = (BigInt(100000000000000000000n) * BigInt(1e18)) / BigInt(100000000000000000000n); // 1 * 1e18
      expect(priceReverse).to.equal(expectedPriceReverse);
    });

    it("should revert if token A reserve is zero", async function () {
      const { swap, aToken, bToken } = await loadFixture(deploySimpleSwapFixture);
      // No liquidity added, so reserves are zero

      await expect(
        swap.getPrice(aToken.target, bToken.target)
      ).to.be.revertedWith("Token A reserve is zero for price calculation");
    });
  });

  describe("getAmountOut", function () {
    it("should calculate the correct amount out", async function () {
      const { swap } = await loadFixture(deploySimpleSwapFixture);

      const amountIn = BigInt(10);
      const reserveIn = BigInt(100);
      const reserveOut = BigInt(100);

      // Formula: (amountIn * reserveOut) / (reserveIn + amountIn)
      const expectedAmountOut = (amountIn * reserveOut) / (reserveIn + amountIn); // (10 * 100) / (100 + 10) = 1000 / 110 = 9 (integer division)

      const calculatedAmountOut = await swap.getAmountOut(amountIn, reserveIn, reserveOut);
      expect(calculatedAmountOut).to.equal(expectedAmountOut);
    });

    it("should return 0 if amountIn is 0", async function () {
      const { swap } = await loadFixture(deploySimpleSwapFixture);
      const calculatedAmountOut = await swap.getAmountOut(BigInt(0), BigInt(100), BigInt(100));
      expect(calculatedAmountOut).to.equal(BigInt(0));
    });

    it("should revert if input reserve is zero", async function () {
      const { swap } = await loadFixture(deploySimpleSwapFixture);
      await expect(
        swap.getAmountOut(BigInt(10), BigInt(0), BigInt(100)) // reserveIn is 0
      ).to.be.revertedWith("Input reserve cannot be zero");
    });
  });
});
