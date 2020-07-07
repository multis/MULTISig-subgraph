import { Execution, Submission as SubmissionEvent, Deposit, 
         OwnerAddition, OwnerRemoval, DailyLimitChange, 
         RequirementChange, GSNMultiSigWalletWithDailyLimit, 
         Confirmation, Revocation } from '../generated/templates/GSNMultiSigWalletWithDailyLimit/GSNMultiSigWalletWithDailyLimit'
import { TransactionRelayed, Deposited, Withdrawn } from '../generated/RelayHub/RelayHub'
import { Wallet, Transaction, Action, } from '../generated/schema'
import { zeroBigInt, oneBigInt, concat, padLeft } from './utils'
import { log, Address, Bytes, crypto, ByteArray, BigInt, ethereum } from '@graphprotocol/graph-ts'

export function handleSubmission(event: SubmissionEvent): void {
    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let multisig = GSNMultiSigWalletWithDailyLimit.bind(multisigAddr)
        let callResult = multisig.transactions(event.params.transactionId)
        
        let action = getAction(multisigAddr, event)
        action.stamp = event.block.timestamp
        action.hash = event.transaction.hash
        action.transactionId = event.params.transactionId
        //action.type = filled by handleConfirmation
        //action.sender = filled by handleConfirmation
        action.isSubmission = true
        action.save()
        
        let transaction = getTransaction(multisigAddr, event.params.transactionId, event)
        transaction.stamp               = event.block.timestamp
        transaction.hash                = event.transaction.hash
        transaction.block               = event.block.number
        transaction.transactionId       = event.params.transactionId
        transaction.status              = "PENDING"
        transaction.value               = callResult.value1
        transaction.destination         = callResult.value0
        if(callResult.value2.length < 2700) { // max size of a column. In some very rare cases, the method data bytecode is very long 
            transaction.data            = callResult.value2
        } else {
            log.warning("multisig: {} transaction {} - cannot store transaction.data (too long), size: {}", 
                        [multisigAddr.toHexString(), event.transaction.hash.toHexString(), ByteArray.fromI32(callResult.value2.length).toHexString()])
        }

        transaction.counterparty        = transaction.destination 
        transaction.amount              = transaction.value 

        if(transaction.value.gt(zeroBigInt()) && transaction.data.length == 0) {
            transaction.type            = "VALUE"
            transaction.subType         = "VALUE_ETHER_DEBIT"
        } else if(transaction.data.length > 0) {
            transaction.type            = "CONTRACT"
        }

        transaction = addActionToTransaction(transaction, action)
        transaction.save()

        wallet = addTransactionToWallet(<Wallet> wallet, transaction)
        wallet.nextId = wallet.nextId.plus(oneBigInt())
        wallet.save()

    } else {
        log.warning("handleSubmission::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleConfirmation(event: Confirmation): void {
    let multisigAddr = event.address

    let action = getAction(multisigAddr, event)
    action.stamp = event.block.timestamp
    action.hash = event.transaction.hash
    action.transactionId = event.params.transactionId
    action.type = "CONFIRM"
    action.sender = event.params.sender
    action.isConfirmation = true
    action.save()

    let transaction = getTransaction(multisigAddr, event.params.transactionId, event)
    if(action.isSubmission) {
        transaction.creator = event.params.sender
        transaction.save()
    }
}

export function handleRevocation(event: Revocation): void {
    let multisigAddr = event.address

    let action = getAction(multisigAddr, event)
    action.stamp = event.block.timestamp
    action.hash = event.transaction.hash
    action.transactionId = event.params.transactionId
    action.isRevokation = true
    action.type = "REVOKE"
    action.sender = event.params.sender
    action.save()


    let transaction = getTransaction(multisigAddr, event.params.transactionId, event)
    
    let multisig = GSNMultiSigWalletWithDailyLimit.bind(multisigAddr)
    let confirmationCount = multisig.getConfirmationCount(event.params.transactionId)
    if(confirmationCount.equals(zeroBigInt())) {
        transaction.stamp               = event.block.timestamp // overwrite the stamp
        transaction.hash                = event.transaction.hash // overwrite the hash
        transaction.block               = event.block.number // overwrite the block #
        transaction.logIndex            = event.logIndex
        transaction.status              = "CANCELLED"
    }
    
    transaction = addActionToTransaction(transaction, action)
    transaction.save()
}

export function handleExecution (event: Execution): void {
    let multisigAddr = event.address

    let action = getAction(multisigAddr, event)
    action.stamp          = event.block.timestamp
    action.hash           = event.transaction.hash
    action.transactionId  = event.params.transactionId
    action.sender         = event.transaction.from
    action.isExecution    = true
    if(action.type == null) {
        action.type = "EXECUTE"
    }
    action.save()

    let transaction = getTransaction(multisigAddr, event.params.transactionId, event)
    transaction.stamp     = event.block.timestamp // overwrite the stamp
    transaction.hash      = event.transaction.hash // overwrite the hash
    transaction.block     = event.block.number // overwrite the block #
    transaction.logIndex  = event.logIndex
    transaction.amount    = (transaction.value != null)  ? transaction.value : zeroBigInt()
    transaction.status    = "EXECUTED"

    transaction           = addActionToTransaction(transaction, action)
    transaction.save()

    let wallet = Wallet.load(multisigAddr.toHex())
    wallet.balanceEther = wallet.balanceEther.minus(<BigInt> transaction.amount)
    wallet.save()
}

export function handleExecutionFailure (event: Execution): void {
    let multisigAddr = event.address

    let action = getAction(multisigAddr, event)
    action.stamp             = event.block.timestamp
    action.hash              = event.transaction.hash
    action.transactionId     = event.params.transactionId
    action.sender            = event.transaction.from
    action.isExecutionFailed = true
    if(action.type == null) {
        action.type = "EXECUTE"
    }
    action.save()

    let transaction = getTransaction(multisigAddr, event.params.transactionId, event)
    transaction.stamp               = event.block.timestamp // overwrite the stamp
    transaction.hash                = event.transaction.hash // overwrite the hash
    transaction.block               = event.block.number // overwrite the block #
    transaction.logIndex            = event.logIndex
    transaction.amount              = transaction.value
    transaction.status              = "FAILED"

    transaction = addActionToTransaction(transaction, action)
    transaction.save()
}


export function handleDeposit(event: Deposit): void {
    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = getTransaction(multisigAddr, null, event)
        transaction.stamp               = event.block.timestamp
        transaction.hash                = event.transaction.hash
        transaction.block               = event.block.number
        transaction.logIndex            = event.logIndex
        transaction.transactionId       = null
        transaction.amount              = event.params.value
        transaction.counterparty        = event.params.sender
        transaction.status              = "EXECUTED"
        transaction.type                = "VALUE"
        transaction.subType             = "VALUE_ETHER_CREDIT"
        transaction.save()

        wallet = addTransactionToWallet(<Wallet> wallet, transaction)
        wallet.balanceEther = wallet.balanceEther.plus(<BigInt> transaction.amount)
        wallet.save()

    } else {
        log.warning("handleDeposit::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleDeposited(event: Deposited): void {
    let multisigAddr = event.params.recipient
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        wallet.balanceGSN = wallet.balanceGSN.plus(event.params.amount)
        wallet.save()
    }
}

export function handleWithdrawn(event: Withdrawn): void {
    let multisigAddr = event.params.account
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        wallet.balanceGSN = wallet.balanceGSN.minus(event.params.amount)
        wallet.save()
    }
}

export function handleOwnerAddition(event: OwnerAddition): void {
    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let action = getAction(multisigAddr, event)

        if(action.transactionId != null) { // in some edge cases, we cannot get the action (because the confirmation happens in another tx)
            let transaction = getTransaction(multisigAddr, action.transactionId, event)
            transaction.type = "ADMIN"
            transaction.subType = "ADMIN_ADD_OWNER"
            transaction.extraBytes1 = event.params.owner
            transaction.save()
        }
    
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
        let action = getAction(multisigAddr, event)

        if(action.transactionId != null) {
            let transaction = getTransaction(multisigAddr, action.transactionId, event)
            transaction.type = "ADMIN"
            transaction.subType = "ADMIN_REMOVE_OWNER"
            transaction.extraBytes1 = event.params.owner
            transaction.save()
        }
    
        let owners = wallet.owners
        let index = owners.indexOf(event.params.owner, 0)
        if (index > -1) {
            owners.splice(index, 1)
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
        let action = getAction(multisigAddr, event)

        if(action.transactionId != null) {
            let transaction = getTransaction(multisigAddr, action.transactionId, event)
            transaction.type = "ADMIN"
            transaction.subType = "ADMIN_CHANGE_DAILY_LIMIT"
            transaction.extraBigInt1 = event.params.dailyLimit 
            transaction.save()
        }
    
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
        let action = getAction(multisigAddr, event)

        if(action.transactionId != null) {
            let transaction = getTransaction(multisigAddr, action.transactionId, event)
            transaction.type = "ADMIN"
            transaction.subType = "ADMIN_CHANGE_REQUIREMENT"
            transaction.extraBigInt1 = event.params.required 
            transaction.save()
        }
    
        wallet.required = event.params.required
        wallet.save()

    } else {
        log.warning("handleRequirementChange::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleTransactionRelayed(event: TransactionRelayed): void {
    let multisigAddr = event.params.to
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let action = getAction(multisigAddr, event)
        action.sender = event.params.from 
        action.save()

        wallet.balanceGSN = wallet.balanceGSN.minus(event.params.charge)
        wallet.save()
    }
}

function getTransaction(multisig: Address, transactionId: BigInt|null, event: ethereum.Event): Transaction {
    let id = new ByteArray(0)
    if(transactionId != null) {
        id = crypto.keccak256(concat(multisig, ByteArray.fromHexString(padLeft(transactionId.toHexString(), 64, "0"))))
    } else {
        id = crypto.keccak256(concat(multisig, event.transaction.hash))
    }

    let transaction = Transaction.load(id.toHexString())
    if(transaction == null) {
        transaction = new Transaction(id.toHexString())
    }

    return transaction as Transaction
}

function getAction(multisig: Address, event: ethereum.Event): Action {
    let id = crypto.keccak256(concat(multisig, event.transaction.hash))

    let action = Action.load(id.toHexString())
    if(action == null) {
        action                   = new Action(id.toHexString())
        action.isSubmission      = false
        action.isExecution       = false
        action.isRevokation      = false
        action.isConfirmation    = false
        action.isExecutionFailed = false
    }

    return action as Action
}

function addActionToTransaction(transaction: Transaction, action: Action): Transaction {
    let timeline = (transaction.timeline != null) ? transaction.timeline : <string[]>[]

    if (timeline.indexOf(action.id, 0) == -1) {
        timeline.push(action.id)
        transaction.timeline = timeline
    }
    return transaction
}

function addTransactionToWallet(wallet: Wallet, transaction: Transaction): Wallet {
    let transactions = wallet.transactions

    if (transactions.indexOf(transaction.id, 0) == -1) {
        transactions.push(transaction.id)
        wallet.transactions = transactions
    }

    return wallet
}
