

export class AsToken {
    symbol: string
    tokenAddress: string
    tokenDecimals: i32
    network: string
  }
  
  export let hardcodedTokens: Array<AsToken> = [
    ///MAINNET /////////////////////////////////////////////////
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
    },
    ///RINKEBY /////////////////////////////////////////////////
    {
      symbol: 'DAI',
      tokenAddress: '0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea ',
      tokenDecimals: 18,
      network: 'rinkeby'
    },
    {
      symbol: 'CDT',
      tokenAddress: '0xfabeb0a74538575ce58de2d54ddef4fe2cec4698',
      tokenDecimals: 18,
      network: 'rinkeby'
    },
    {
      symbol: 'CDT',
      tokenAddress: '0xf2ea37930a2d98f41f80a6c92aca8f86aa29288a',
      tokenDecimals: 18,
      network: 'rinkeby'
    }
]
