import { ContractInstantiation } from '../generated/GSNMultisigFactory/GSNMultisigFactory'
import { GSNMultiSigWalletWithDailyLimit  } from '../generated/templates/GSNMultiSigWalletWithDailyLimit/GSNMultiSigWalletWithDailyLimit'
import { Wallet } from '../generated/schema'
import { GSNMultiSigWalletWithDailyLimit as GSNMultiSigWalletWithDailyLimitContract } from '../generated/templates'
import { Bytes, dataSource, Address } from '@graphprotocol/graph-ts'
import { zeroBigInt } from './utils'

export function handleContractInstantiation(event: ContractInstantiation): void {

  let multisigInstance = GSNMultiSigWalletWithDailyLimit.bind(event.params.instantiation)

  let wallet = new Wallet(event.params.instantiation.toHex())
  wallet.creator             = event.params.sender
  wallet.network             = dataSource.network()
  wallet.stamp               = event.block.timestamp
  wallet.block               = event.block.number
  wallet.hash                = event.transaction.hash
  wallet.factory             = event.address as Address
  wallet.balanceEther        = zeroBigInt()
  wallet.transactions        = []
  wallet.owners              = multisigInstance.getOwners() as Bytes[]
  wallet.required            = multisigInstance.required()
  wallet.dailyLimit          = multisigInstance.dailyLimit()

  wallet.save()

  // Instanciate a new datasource
  GSNMultiSigWalletWithDailyLimitContract.create(event.params.instantiation)
}

