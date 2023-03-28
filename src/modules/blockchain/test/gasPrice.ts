import { BigNumber, ethers } from "ethers";
import * as RxJS from "rxjs";
import { FeeData } from "@ethersproject/providers/src.ts";

async function main() {
  // const jsonRpcProvider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com/',{
  //   name: 'polygon',
  //   chainId: 137,
  //   _defaultProvider: (providers) => new providers.JsonRpcProvider('https://polygon-rpc.com/')
  // });
  //
  // const feedData = await jsonRpcProvider.getFeeData();
  // console.log(`lastBaseFeePerGas: ${feedData.lastBaseFeePerGas.toString()}`)
  // console.log(`maxFeePerGas: ${feedData.maxFeePerGas.toString()}`)
  // console.log(`maxPriorityFeePerGas: ${feedData.maxPriorityFeePerGas.toString()}`)
  // console.log(`gasPrice: ${feedData.gasPrice.toString()}`)
  // console.log();
  //
  // const { maxFeePerGas, maxPriorityFeePerGas, gasPrice } = await getFeeDataWithDynamicMaxPriorityFeePerGas(jsonRpcProvider);
  // console.log(`maxFeePerGas: ${maxFeePerGas}`);
  // console.log(`maxPriorityFeePerGas: ${maxPriorityFeePerGas}`);
  // console.log(`gasPrice: ${gasPrice}`);
  let counter = 0;

  RxJS.defer(() => RxJS.timer(1000, 1000).pipe(
    RxJS.scan(acc => counter += acc + 1, counter),
    RxJS.tap(value => console.log(`value: ${value}`)),
    RxJS.mergeMap(_ => RxJS.throwError(() => new Error(''))),
    RxJS.retry(3)
    )
  ).subscribe({
    next: value => console.log(`value: ${value}`)
    }
  )
}

export async function getFeeDataWithDynamicMaxPriorityFeePerGas(jsonRpcProvider): Promise<any> {
  let maxFeePerGas: null | BigNumber = null
  let maxPriorityFeePerGas: null | BigNumber = null
  let gasPrice: null | BigNumber = null

  // const provider = getProvider()

  const [block, eth_maxPriorityFeePerGas] = await Promise.all([
    await jsonRpcProvider.getBlock("latest"),
    await jsonRpcProvider.send("eth_maxPriorityFeePerGas", []),
  ])

  console.log(`eth_maxPriorityFeePerGas: ${BigNumber.from(eth_maxPriorityFeePerGas)}, block gas fee: ${BigNumber.from(block.baseFeePerGas)}`)

  if (block && block.baseFeePerGas) {
    maxPriorityFeePerGas = BigNumber.from(eth_maxPriorityFeePerGas);
    if (maxPriorityFeePerGas) {
      maxFeePerGas = block.baseFeePerGas.add(maxPriorityFeePerGas);
    }
  }

  return { maxFeePerGas, maxPriorityFeePerGas, gasPrice }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


