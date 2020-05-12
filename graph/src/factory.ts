
import { ContractInstantiation } from '../generated/MultisigWalletFactory/MultisigWalletFactory'
import { Wallet } from '../generated/schema'

export function handleContractInstantiation(event: ContractInstantiation): void {
  let wallet = new Wallet(event.params.instantiation.toHex())
  wallet.save()
}
