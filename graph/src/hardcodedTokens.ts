

export class AsToken {
    symbol: string
    tokenAddress: string
    tokenDecimals: i32
    network: string
  }
  
  export let hardcodedTokens: Array<AsToken> = [
    {
      symbol: 'ETH',
      tokenAddress: '0x0000000000000000000000000000000000000000',
      tokenDecimals: 18,
      network: 'mainnet'
    },
    {
      symbol: 'DAI',
      tokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
      tokenDecimals: 18,
      network: 'mainnet'
    },
    {
      symbol: 'SUSD',
      tokenAddress: '0x57ab1ec28d129707052df4df418d58a2d46d5f51',
      tokenDecimals: 18,
      network: 'mainnet'
    },
    {
      symbol: 'USDC',
      tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      tokenDecimals: 6,
      network: 'mainnet'
    }
]
