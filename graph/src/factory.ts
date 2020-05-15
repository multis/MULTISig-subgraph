import { ContractInstantiation } from '../generated/GSNMultisigFactory/GSNMultisigFactory'
import { GSNMultiSigWalletWithDailyLimit  } from '../generated/templates/GSNMultiSigWalletWithDailyLimit/GSNMultiSigWalletWithDailyLimit'
import { Wallet, Genesis, Token } from '../generated/schema'
import { GSNMultiSigWalletWithDailyLimit as GSNMultiSigWalletWithDailyLimitContract,
         ERC20 as ERC20Contract } from '../generated/templates'
import { Bytes, Address, dataSource, BigInt, log } from '@graphprotocol/graph-ts'
import { hardcodedTokens } from './hardcodedTokens'
import { zeroBigInt } from './utils'

declare function require(moduleNames: string[], onLoad: (...args: any[]) => void): void;


export function handleContractInstantiation(event: ContractInstantiation): void {

  genesis(dataSource.network())

  let wallet = new Wallet(event.params.instantiation.toHex())

  let multisig = GSNMultiSigWalletWithDailyLimit.bind(event.params.instantiation)
  let owners = multisig.getOwners()
  let required = multisig.required()
  let dailyLimit = multisig.dailyLimit()

  wallet.date = event.block.timestamp
  wallet.hash = event.transaction.hash

  wallet.factoryAddress = event.transaction.from
  wallet.totalTransactions = zeroBigInt()
  wallet.transactions = []
  wallet.submissions = []
  wallet.balances = []
  wallet.owners = <Array<Bytes>> owners
  wallet.required = required
  wallet.dailyLimit = dailyLimit

  wallet.save()

  // Instanciate a new datasource
  GSNMultiSigWalletWithDailyLimitContract.create(event.params.instantiation)
}


function genesis(network: string): void {
  
  if(Genesis.load("1") == null) {

    let genesis = new Genesis("1")

    let tokens: string[] = []

    for (let i = 0; i < hardcodedTokens.length; i++) {
      let def = hardcodedTokens[i]
      if(network == def.network) {
        let token = new Token(def.address)
        token.decimals = BigInt.fromI32(def.decimals)
        token.symbol = def.symbol
  
        token.save()
        tokens.push(token.id)

        // Start tracking ERC20 token
        if(def.symbol != "ETH") {
          ERC20Contract.create(Address.fromString(token.id))
        }
        
      }
    }

    genesis.network = network
    genesis.tokens = tokens
    genesis.save()
  }
}
