"use client";

import { useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { BugAntIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Address, AddressInput } from "~~/components/scaffold-eth";
import { IntegerInput } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { formatEther } from "viem";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [address, setAddress] = useState("");
  const [txAddAValue, setTxAddAValue] = useState<string>("");
  const [txAddBValue, setTxAddBValue] = useState<string>("");
  const [addLiqTime, setAddLiqTime] = useState<string>("");
  const [txLTValue, setTxLTValue] = useState<string>("");
  const [removeLiqTime, setRemoveLiqTime] = useState<string>("");
  const [txSwapAValue, setTxSwapAValue] = useState<string>("");
  let [txSwapBOutValue, setTxSwapBOutValue] = useState<string>("");
  const [swapATime, setSwapATime] = useState<string>("");
  let [tokenPrice, setTokenPrice] = useState<string>("");
  const [txAtoSwapValue, setAtoSwapTxValue] = useState<string>("");
  let [txBOutToSwapValue, setTxBOutToSwapValue] = useState<string>("");
  const { data: deployedContractData } = useDeployedContractInfo({ contractName: "AToken" });
  const aTokenAddress = deployedContractData?.address || "0x..."; // Replace with actual deployed address
  const { data: deployedContractDataB } = useDeployedContractInfo({ contractName: "BToken" });
  const bTokenAddress = deployedContractDataB?.address || "0x..."; // Replace with actual deployed address
  const { data: deployedContractDataC } = useDeployedContractInfo({ contractName: "SimpleSwap" });
  const simpleSwapAddress = deployedContractDataC?.address || "0x..."; // Replace with actual deployed address
  const { writeContractAsync: writeSimpleSwapAsync } = useScaffoldWriteContract({ contractName: "SimpleSwap" });
  const addressPath: Array<string> = [aTokenAddress, bTokenAddress];
    const { data: bTokenPrice } = useScaffoldReadContract({
      contractName: "SimpleSwap",
      functionName: "getPrice",
      args: [aTokenAddress, bTokenAddress],
    });
    const { data: aTokenBalance } = useScaffoldReadContract({
      contractName: "AToken",
      functionName: "balanceOf",
      args: [simpleSwapAddress],
    });
    const { data: bTokenBalance } = useScaffoldReadContract({
      contractName: "BToken",
      functionName: "balanceOf",
      args: [simpleSwapAddress],
    });
    const { data: bTokenAmountOut } = useScaffoldReadContract({
      contractName: "SimpleSwap",
      functionName: "getAmountOut",
      args: [BigInt(txAtoSwapValue), aTokenBalance, bTokenBalance]
    });
    const { data: bTokenMinAmountOut } = useScaffoldReadContract({
      contractName: "SimpleSwap",
      functionName: "getAmountOut",
      args: [BigInt(txSwapAValue), aTokenBalance, bTokenBalance]
    });

  return (
    <>
      <div className="flex items-center flex-col grow pt-5">
        <div className="px-3">
          <h1 className="text-center">
            <span className="block text-2xl mb-2">Welcome to</span>
            <span className="block text-4xl font-bold">Simple Swap</span>
          </h1>

          <p className="text-center mt-2">
            Start by minting{" "}
            <Link href="/atoken" passHref className="link">
              A Tokens
            </Link>{" "}
            and{" "}
            <Link href="/btoken" passHref className="link">
              B Tokens
            </Link>{" "}
            in order to interact with the application.
          </p>

          <div className="flex flex-col md:flex-row items-start justify-center gap-4 mt-8">
            <div className="card bg-base-100 w-80 shadow-sm">
              <div className="card-body items-center text-center">
                <h2 className="card-title">Add liquidity to the pool</h2>
                <div>
                  {" "}
                  <label>A Token Address</label>
                  <AddressInput onChange={setAddress} value={aTokenAddress} placeholder="A Token address" />
                </div>
                <div>
                  {" "}
                  <label>B Token Address</label>
                  <AddressInput onChange={setAddress} value={bTokenAddress} placeholder="B Token address" />
                </div>
                <div>
                  <label>Add the desired amount of A Tokens</label>
                  <IntegerInput
                    value={txAddAValue}
                    onChange={updatedTxAddAValue => {
                      setTxAddAValue(updatedTxAddAValue);
                    }}
                    placeholder="A Token amount (wei)"
                  />
                </div>
                <div>
                  <label>Add the desired amount of B Tokens</label>
                  <IntegerInput
                    value={txAddBValue}
                    onChange={updatedTxAddBValue => {
                      setTxAddBValue(updatedTxAddBValue);
                    }}
                    placeholder="B Token amount (wei)"
                  />
                </div>
                <div>
                  {" "}
                  <label>Address to transfer Liquidity Tokens</label>
                  <AddressInput onChange={setAddress} value={connectedAddress || ""} placeholder="Input your address" />
                </div>
                <div>
                  <label>Transaction time limit</label>
                  <IntegerInput
                    value={addLiqTime}
                    disableMultiplyBy1e18={true}
                    onChange={updatedAddLiqTime => {
                      setAddLiqTime(updatedAddLiqTime);
                    }}
                    placeholder="Time limit (seconds)"
                  />
                </div>
                <div className="card-actions">
                  <button
                    className="btn btn-primary text-lg px-12 mt-2"
                    disabled={
                      !aTokenAddress ||
                      !bTokenAddress ||
                      !connectedAddress ||
                      !txAddAValue ||
                      !txAddBValue ||
                      !addLiqTime
                    }
                    onClick={async () => {
                      try {
                        await writeSimpleSwapAsync({
                          functionName: "addLiquidity",
                          args: [
                            aTokenAddress,
                            bTokenAddress,
                            BigInt(txAddAValue),
                            BigInt(txAddBValue),
                            BigInt(txAddAValue),
                            BigInt(txAddBValue),
                            connectedAddress,
                            BigInt(Date.now() + addLiqTime),
                          ],
                        });
                      } catch (e) {
                        console.error("Error while adding liquidity", e);
                      }
                    }}
                  >
                    Transact
                  </button>
                </div>
              </div>
            </div>
            <div className="card bg-base-100 w-80 shadow-sm">
              <div className="card-body items-center text-center">
                <h2 className="card-title">Remove liquidity from the pool</h2>
                <div>
                  {" "}
                  <label>A Token Address</label>
                  <AddressInput onChange={setAddress} value={aTokenAddress} placeholder="Input your address" />
                </div>
                <div>
                  {" "}
                  <label>B Token Address</label>
                  <AddressInput onChange={setAddress} value={bTokenAddress} placeholder="Input your address" />
                </div>
                <div>
                  <label>Exchange your Liquidity Tokens</label>
                  <IntegerInput
                    value={txLTValue}
                    onChange={updatedTxLTValue => {
                      setTxLTValue(updatedTxLTValue);
                    }}
                    placeholder="Liquidity Token amount (wei)"
                  />
                </div>
                <div>
                  {" "}
                  <label>Address to transfer A&B Tokens</label>
                  <AddressInput onChange={setAddress} value={connectedAddress || ""} placeholder="Input your address" />
                </div>
                <div>
                  <label>Transaction time limit</label>
                  <IntegerInput
                    value={removeLiqTime}
                    disableMultiplyBy1e18={true}
                    onChange={updatedRemoveLiqTime => {
                      setRemoveLiqTime(updatedRemoveLiqTime);
                    }}
                    placeholder="Time limit (seconds)"
                  />
                </div>
                <div className="card-actions">
                  <button className="btn btn-primary text-lg px-12 mt-2"
                    disabled={
                      !aTokenAddress ||
                      !bTokenAddress ||
                      !connectedAddress ||
                      !txLTValue ||
                      !removeLiqTime
                    }
                    onClick={async () => {
                      try {
                        await writeSimpleSwapAsync({
                          functionName: "removeLiquidity",
                          args: [
                            aTokenAddress,
                            bTokenAddress,
                            BigInt(txLTValue),
                            BigInt(0),
                            BigInt(0),
                            connectedAddress,
                            BigInt(Date.now() + removeLiqTime),
                          ],
                        });
                      } catch (e) {
                        console.error("Error while removing liquidity", e);
                      }
                    }}
                    >Transact</button>
                </div>
              </div>
            </div>
            <div className="card bg-base-100 w-80 shadow-sm">
              <div className="card-body items-center text-center">
                <h2 className="card-title">Tokens Swap</h2>

                <div>
                  <label>Amount of A tokens to exchange</label>
                  <IntegerInput
                    value={txSwapAValue}
                    onChange={updatedTxSwapAValue => {
                      setTxSwapAValue(updatedTxSwapAValue);
                    }}
                    placeholder="A Token amount (wei)"
                  />
                </div>
                <div>
                  <label>Minimum of B tokens return expected</label>
                  <IntegerInput
                    value={txSwapBOutValue = bTokenMinAmountOut ? formatEther(bTokenMinAmountOut) : ""}
                    onChange={updatedTxSwapBOutValue => {
                      setTxSwapBOutValue(updatedTxSwapBOutValue);
                    }}
                    placeholder="B Token amount (wei)"
                  />
                </div>
                <div>
                  {" "}
                  <label>Address to transfer Exchanged Tokens</label>
                  <AddressInput onChange={setAddress} value={connectedAddress || ""} placeholder="Input your address" />
                </div>
                <div>
                  <label>Transaction time limit</label>
                  <IntegerInput
                    value={swapATime}
                    disableMultiplyBy1e18={true}
                    onChange={updatedSwapATime => {
                      setSwapATime(updatedSwapATime);
                    }}
                    placeholder="Time limit (seconds)"
                  />
                </div>
                <div className="card-actions">
                  <button className="btn btn-primary text-lg px-12 mt-2"
                    disabled={
                      !txSwapAValue ||
                      !txSwapBOutValue ||
                      !connectedAddress ||
                      !addressPath ||
                      !swapATime
                    }
                    onClick={async () => {
                      try {
                        await writeSimpleSwapAsync({
                          functionName: "swapExactTokensForTokens",
                          args: [
                            BigInt(txSwapAValue),
                            BigInt(0),
                            addressPath,
                            connectedAddress,
                            BigInt(Date.now() + swapATime),
                          ],
                        });
                      } catch (e) {
                        console.error("Error while swaping tokens", e);
                      }
                    }}
                  >Transact</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="grow bg-base-300 w-full mt-16 px-8 py-12">
          <div className="flex justify-center items-start gap-12 flex-col md:flex-row">
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <h2 className="card-title">B Token Price</h2>
              <p className="text-xl">{bTokenPrice ? formatEther(bTokenPrice) : 0}</p>
              <label className="text center px-2">A Token Balance</label>
              <p className="text-xl">{aTokenBalance ? formatEther(aTokenBalance) : 0}</p>
              <label className="text center px-2">B Token Balance</label>
              <p className="text-xl">{bTokenBalance ? formatEther(bTokenBalance) : 0}</p>
            </div>
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <p>Amount of A Tokens to swap:</p>
              <IntegerInput
                value={txAtoSwapValue}
                onChange={updatedTxAtoSwapValue => {
                  setAtoSwapTxValue(updatedTxAtoSwapValue);
                }}
                placeholder="value (wei)"
              />
              <p>Expected B Tokens to get:</p>
              <IntegerInput
                value={txBOutToSwapValue = bTokenAmountOut ? formatEther(bTokenAmountOut) : ""}
                disableMultiplyBy1e18={true}
                disabled onChange={updatedTxBOutToSwapValue => {
                  setTxBOutToSwapValue(updatedTxBOutToSwapValue);
                }}
                placeholder="value (wei)"
              />
            </div>
          </div>
        </div>
        <div className="grow bg-base-300 w-full mt-16 px-8 py-12">
          <div className="flex justify-center items-center gap-12 flex-col md:flex-row">
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <BugAntIcon className="h-8 w-8 fill-secondary" />
              <p>
                Check all the available functions using the{" "}
                <Link href="/debug" passHref className="link">
                  Debug Contracts
                </Link>{" "}
                tab.
              </p>
            </div>
            <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-xs rounded-3xl">
              <MagnifyingGlassIcon className="h-8 w-8 fill-secondary" />
              <p>
                Explore your local transactions with the{" "}
                <Link href="/blockexplorer" passHref className="link">
                  Block Explorer
                </Link>{" "}
                tab.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
