import { Execution, Submission, Deposit, 
         OwnerAddition, OwnerRemoval, DailyLimitChange, 
         RequirementChange, GSNMultiSigWalletWithDailyLimit, 
         Confirmation, Revocation } 
         from '../generated/templates/GSNMultiSigWalletWithDailyLimit/GSNMultiSigWalletWithDailyLimit'
import { Transfer } from '../generated/templates/ERC20/ERC20'
import { Wallet, Transaction } from '../generated/schema'
import { zeroBigInt, concat } from './utils'
import { log, Address, crypto, Bytes, ByteArray, BigInt } from '@graphprotocol/graph-ts'



export function handleSubmission(event: Submission): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        //let multisig = GSNMultiSigWalletWithDailyLimit.bind(multisigAddr)
        //let callResult = multisig.transactions(event.params.transactionId)

    } else {
        log.warning("handleSubmission::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleConfirmation(event: Confirmation): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        //let multisig = GSNMultiSigWalletWithDailyLimit.bind(multisigAddr)
        //let callResult = multisig.transactions(event.params.transactionId)

    } else {
        log.warning("handleConfirmation::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleRevocation(event: Revocation): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        //let multisig = GSNMultiSigWalletWithDailyLimit.bind(multisigAddr)
        //let callResult = multisig.transactions(event.params.transactionId)

    } else {
        log.warning("handleRevocation::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleExecution (event: Execution): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let multisig = GSNMultiSigWalletWithDailyLimit.bind(multisigAddr)
        let callResult = multisig.transactions(event.params.transactionId)

        let transaction = loadOrCreateTransaction(multisigAddr, event.transaction.hash)
        transaction.block = event.block.number
        transaction.date = event.block.timestamp
        transaction.hash = event.transaction.hash
        transaction.executionId = event.params.transactionId
        transaction.from = multisigAddr
        transaction.to = callResult.value0
        if(callResult.value2.length > 0) {
            transaction.type = "CONTRACT"
            transaction.value = callResult.value1
            transaction.token = "0x0000000000000000000000000000000000000000" // ETH
        } else if(callResult.value1 > zeroBigInt()) {
            transaction.type = "VALUE"
            transaction.value = callResult.value1
            transaction.token = "0x0000000000000000000000000000000000000000" // ETH
        }
        transaction.status = "EXECUTED"
        transaction.save()
    
        wallet = pushTransactionIfNotExist(wallet, transaction)

        wallet.save()

    } else {
        log.warning("handleExecution::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleExecutionFailure (event: Execution): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let multisig = GSNMultiSigWalletWithDailyLimit.bind(multisigAddr)
        let callResult = multisig.transactions(event.params.transactionId)

        let transaction = loadOrCreateTransaction(multisigAddr, event.transaction.hash)
        transaction.block = event.block.number
        transaction.date = event.block.timestamp
        transaction.hash = event.transaction.hash
        transaction.executionId = event.params.transactionId
        transaction.from = multisigAddr
        transaction.to = callResult.value0
        if(callResult.value1 > zeroBigInt()) {
            transaction.type = "VALUE"
            transaction.value = callResult.value1
            transaction.token = "0x0000000000000000000000000000000000000000" // ETH
        }
        transaction.status = "ERROR"
        transaction.save()
    
        wallet = pushTransactionIfNotExist(wallet, transaction)
    
        wallet.save()

    } else {
        log.warning("handleExecution::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleDeposit(event: Deposit): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event.transaction.hash)
        transaction.block = event.block.number
        transaction.date = event.block.timestamp
        transaction.hash = event.transaction.hash
        transaction.type = "VALUE"
        transaction.status = "EXECUTED"
        transaction.value = event.params.value
        transaction.token = "0x0000000000000000000000000000000000000000" // ETH
        transaction.from = event.params.sender
        transaction.to = multisigAddr
        transaction.save()
    
        wallet = pushTransactionIfNotExist(wallet, transaction)
    
        wallet.save()

    } else {
        log.warning("handleDeposit::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleOwnerAddition(event: OwnerAddition): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event.transaction.hash)
        transaction.block = event.block.number
        transaction.date = event.block.timestamp
        transaction.hash = event.transaction.hash
        transaction.type = "ADMIN"
        transaction.subType = "ADD_OWNER"
        transaction.from = multisigAddr
        transaction.to = multisigAddr
        transaction.save()
    
        wallet = pushTransactionIfNotExist(wallet, transaction)
        
        let owners = wallet.owners
        owners.push(event.params.owner)
        wallet.owners = owners
    
        wallet.save()

    } else {
        log.warning("handleOwnerAddition::Wallet {} not found", [multisigAddr.toHexString()])
    }
}
export function handleOwnerRemoval(event: OwnerRemoval): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event.transaction.hash)
        transaction.block = event.block.number
        transaction.date = event.block.timestamp
        transaction.hash = event.transaction.hash
        transaction.type = "ADMIN"
        transaction.subType = "REMOVE_OWNER"
        transaction.from = multisigAddr
        transaction.to = multisigAddr
        transaction.save()
    
        wallet = pushTransactionIfNotExist(wallet, transaction)

        let owners = wallet.owners
        let index = owners.indexOf(event.params.owner, 0)
        if (index > -1) {
            owners = owners.splice(index, 1);

        }
        wallet.owners = owners
    
        wallet.save()

    } else {
        log.warning("handleOwnerRemoval::Wallet {} not found", [multisigAddr.toHexString()])
    }
}
export function handleDailyLimitChange(event: DailyLimitChange): void { 

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event.transaction.hash)
        transaction.block = event.block.number
        transaction.date = event.block.timestamp
        transaction.hash = event.transaction.hash
        transaction.type = "ADMIN"
        transaction.subType = "CHANGE_DAILY_LIMIT"
        transaction.from = multisigAddr
        transaction.to = multisigAddr
        transaction.save()
    
        wallet = pushTransactionIfNotExist(wallet, transaction)
        wallet.dailyLimit = event.params.dailyLimit
    
        wallet.save()

    } else {
        log.warning("handleDailyLimitChange::Wallet {} not found", [multisigAddr.toHexString()])
    }
}
export function handleRequirementChange(event: RequirementChange): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event.transaction.hash)
        transaction.block = event.block.number
        transaction.date = event.block.timestamp
        transaction.hash = event.transaction.hash
        transaction.type = "ADMIN"
        transaction.subType = "CHANGE_REQUIREMENT"
        transaction.from = multisigAddr
        transaction.to = multisigAddr
        transaction.save()
    
        wallet = pushTransactionIfNotExist(wallet, transaction)
        wallet.required = event.params.required
    
        wallet.save()

    } else {
        log.warning("handleRequirementChange::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleERC20Transfer(event: Transfer): void {
    handleERC20Transfer2(event.params.from, event)
    handleERC20Transfer2(event.params.to, event)
}

function handleERC20Transfer2(id: Address, event: Transfer): void {
    
    let multisigAddr = id
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event.transaction.hash)
        transaction.block = event.block.number
        transaction.date = event.block.timestamp
        transaction.hash = event.transaction.hash
        transaction.type = "VALUE"
        transaction.subType = "ERC20"
        transaction.status = "EXECUTED"
        transaction.value = event.params.value
        transaction.token = event.address.toHex()
        transaction.from = event.params.from
        transaction.to = event.params.to
        transaction.save()
    
        wallet = pushTransactionIfNotExist(wallet, transaction)
    
        wallet.save()
    } 
}

function loadOrCreateTransaction(multisig: Address, txHash: Bytes): Transaction {
    let id = crypto.keccak256(concat(multisig, txHash)).toHex()

    // it is more efficient to create than load (https://github.com/graphprotocol/support/wiki/common-patterns#updating-entities-in-the-store-efficiently)
    // let transaction = Transaction.load(id)
    // if(transaction == null) {
    //     return new Transaction(id.toString())
    // } else {
    //     return <Transaction> transaction
    // }

    return new Transaction(id.toString())
}

function pushTransactionIfNotExist(wallet: Wallet|null, transaction: Transaction): Wallet|null {
    if(wallet == null) throw "wallet cannot be null"

    let transactions = wallet.transactions

    if (transactions.indexOf(transaction.id, 0) == -1) {
        transactions.push(transaction.id)
        wallet.transactions = transactions
    }

    wallet.totalTransactions = BigInt.fromI32(wallet.transactions.length)
    return wallet
}