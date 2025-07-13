"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { AddressInput, InputBase } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const BToken: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { data: deployedContractData } = useDeployedContractInfo({ contractName: "SimpleSwap" });
      const simpleSwapAddress = deployedContractData?.address || "0x..."; // Replace with actual deployed address
  const [toAddress, setToAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  const { data: balance } = useScaffoldReadContract({
    contractName: "BToken",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  const { data: totalSupply } = useScaffoldReadContract({
    contractName: "BToken",
    functionName: "totalSupply",
  });

  const { writeContractAsync: writeBTokenAsync } = useScaffoldWriteContract({ contractName: "BToken" });

  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10">
        <div className="px-5 text-center max-w-4xl">
          <h1 className="text-4xl font-bold">B Token</h1>
          <div className="divider my-0" />

          <h2 className="text-3xl font-bold mt-4">Mint B tokens for free</h2>

          <div>
            <p>
              You can also transfer tokens to another address. Just fill in the address and the amount of tokens you
              want to send and click the send button. You can check the total amount of minted tokens and your own
              balance below.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center items-center bg-base-300 w-full mt-8 px-8 pt-6 pb-12">
          <div className="flex justify-center items-center space-x-2 flex-col sm:flex-row">
            <p className="my-2 mr-2 font-bold text-2xl">Total Supply:</p>
            <p className="text-xl">{totalSupply ? formatEther(totalSupply) : 0} BTK (B Tokens)</p>
          </div>
          <div className="flex justify-center items-center space-x-2 flex-col sm:flex-row">
            <p className="y-2 mr-2 font-bold text-2xl">Your Balance:</p>
            <p className="text-xl">{balance ? formatEther(balance) : 0} BTK (B Tokens)</p>
          </div>
          <div className="flex justify-center items-center space-x-2 flex-col sm:flex-row mb-6">
            <button
              className="btn btn-accent text-lg px-12 mt-2"
              onClick={async () => {
                try {
                  await writeBTokenAsync({ functionName: "mint", args: [connectedAddress, parseEther("100")] });
                } catch (e) {
                  console.error("Error while minting token", e);
                }

                try {
                  await writeBTokenAsync({ functionName: "approve", args: [simpleSwapAddress, parseEther("100")] });
                } catch (e) {
                  console.error("Error while allowing token", e);
                }
              }}
            >
              Mint 100 Tokens
            </button>
          </div>
          <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center w-full md:w-2/4 rounded-3xl mt-10">
            <h3 className="text-2xl font-bold">Transfer Tokens</h3>
            <div className="flex flex-col items-center justify-between w-full lg:w-3/5 px-2 mt-4">
              <div className="font-bold mb-2">Send To:</div>
              <div>
                <AddressInput value={toAddress} onChange={setToAddress} placeholder="Address" />
              </div>
            </div>
            <div className="flex flex-col items-center justify-between w-full lg:w-3/5 p-2 mt-4">
              <div className="flex gap-2 mb-2">
                <div className="font-bold">Amount:</div>
                <div>
                  <button
                    disabled={!balance}
                    className="btn btn-secondary text-xs h-6 min-h-6"
                    onClick={() => {
                      if (balance) {
                        setAmount(formatEther(balance));
                      }
                    }}
                  >
                    Max
                  </button>
                </div>
              </div>
              <div>
                <InputBase value={amount} onChange={setAmount} placeholder="0" />
              </div>
            </div>
            <div>
              <button
                className="btn btn-primary text-lg px-12 mt-2"
                disabled={!toAddress || !amount}
                onClick={async () => {
                  try {
                    await writeBTokenAsync({ functionName: "transfer", args: [toAddress, parseEther(amount)] });
                    setToAddress("");
                    setAmount("");
                  } catch (e) {
                    console.error("Error while transfering token", e);
                  }
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BToken;
