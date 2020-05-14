import {  CreateCall } from '../generated/GSNMultisigFactory/GSNMultisigFactory'
import { Wallet, Genesis, Token } from '../generated/schema'
import { GSNMultiSigWalletWithDailyLimit as GSNMultiSigWalletWithDailyLimitContract,
         ERC20 as ERC20Contract } from '../generated/templates'
import { Bytes, Address, dataSource, BigInt, log } from '@graphprotocol/graph-ts'
import { hardcodedTokens } from './hardcodedTokens'

declare function require(moduleNames: string[], onLoad: (...args: any[]) => void): void;


export function handleContractInstantiation(call: CreateCall): void {

  genesis(dataSource.network())

  let wallet = new Wallet(call.outputs.wallet.toHex())
  wallet.factoryAddress = call.transaction.from
  wallet.creationBlock = call.block.number
  wallet.creationDate = call.block.timestamp
  wallet.transactions = []
  wallet.pending = []
  wallet.owners = <Array<Bytes>> call.inputs._owners
  wallet.required = call.inputs._required
  wallet.dailyLimit = call.inputs._dailyLimit
  wallet.save()

  // Instanciate a new datasource
  GSNMultiSigWalletWithDailyLimitContract.create(call.outputs.wallet)
}


function genesis(network: string): void {
  
  if(Genesis.load("1") === null) {

    let genesis = new Genesis("1")
    let tokens: string[] = []

    for (let i = 0; i < hardcodedTokens.length; i++) {
      let def = hardcodedTokens[i]
      if(dataSource.network() == def.network) {
        let token = new Token(def.tokenAddress)
        token.decimals = BigInt.fromI32(def.tokenDecimals)
        token.symbol = def.symbol
  
        token.save()
        tokens.push(token.id)

        // Start tracking ERC20 token
        if(def.symbol != "ETH") {
          ERC20Contract.create(Address.fromString(token.id))
        }
        
      }
    }

    genesis.tokens = tokens
    genesis.save()
  }
}
