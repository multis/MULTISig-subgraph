import { Execution, Submission as SubmissionEvent, Deposit, 
         OwnerAddition, OwnerRemoval, DailyLimitChange, 
         RequirementChange, GSNMultiSigWalletWithDailyLimit, 
         Confirmation, Revocation } 
         from '../generated/templates/GSNMultiSigWalletWithDailyLimit/GSNMultiSigWalletWithDailyLimit'
import { Transfer, Approval, TransferFromCall } from '../generated/templates/ERC20/ERC20'
import { Wallet, Transaction, Submission, Action, Balance, Allowance } from '../generated/schema'
import { zeroBigInt, concat } from './utils'
import { log, Address, crypto, ByteArray, BigInt, ethereum } from '@graphprotocol/graph-ts'



export function handleSubmission(event: SubmissionEvent): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let multisig = GSNMultiSigWalletWithDailyLimit.bind(multisigAddr)
        let callResult = multisig.transactions(event.params.transactionId)

        let submission = loadOrCreateSubmission(multisigAddr, event.params.transactionId, event)
        submission.date = event.block.timestamp
        submission.hash = event.transaction.hash
        submission.executionId = event.params.transactionId
        submission.value = callResult.value1
        submission.destination = callResult.value0
        submission.data = callResult.value2
        submission.save()
    
        let submissions = wallet.submissions
        submissions.push(submission.id)
        wallet.submissions = submissions
        
        wallet.save()

    } else {
        log.warning("handleSubmission::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleConfirmation(event: Confirmation): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let submission = loadOrCreateSubmission(multisigAddr, event.params.transactionId, event)

        let action = loadOrCreateAction(multisigAddr, event.params.transactionId, "CONFIRM", event.params.sender, event)
        action.save()

        submission = addActionToSubmission(submission, action)
        submission.save()

    } else {
        log.warning("handleConfirmation::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleRevocation(event: Revocation): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {

        let action = loadOrCreateAction(multisigAddr, event.params.transactionId, "REVOKE", event.params.sender, event)
        action.save()

        wallet = handleTransaction(multisigAddr, <Wallet>wallet, event.params.transactionId, "CANCELED", event, action)
        wallet.save()

    } else {
        log.warning("handleRevocation::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleExecution (event: Execution): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {        
        wallet = handleTransaction(multisigAddr, <Wallet>wallet, event.params.transactionId, "EXECUTED", event, null)
        wallet.save()

    } else {
        log.warning("handleExecution::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleExecutionFailure (event: Execution): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        wallet = handleTransaction(multisigAddr, <Wallet>wallet, event.params.transactionId, "FAILED", event, null)
        wallet.save()

    } else {
        log.warning("handleExecutionFailure::Wallet {} not found", [multisigAddr.toHexString()])
    }
}


function handleTransaction (multisigAddr: Address, wallet: Wallet, executionId: BigInt, status: string, event: ethereum.Event, action: Action|null): Wallet {

    let submission = loadOrCreateSubmission(multisigAddr, executionId, event)

    if(action != null) {
        submission = addActionToSubmission(submission, <Action>action)
    }
    submission.ended = true
    submission.save()

    let multisig = GSNMultiSigWalletWithDailyLimit.bind(multisigAddr)
    let callResult = multisig.transactions(executionId)

    let transaction = loadOrCreateTransaction(multisigAddr, event)

    let transactions = [] as Transaction[]
    transactions.push(transaction)
    if(transaction.linkedTransactions != null) {
        let linked = transaction.linkedTransactions as string[]
        for(let i = 0; i < linked.length; i++) {
            let id = linked[i]
            transactions.push(<Transaction>Transaction.load(id))
        }
    }

    for(let i = 0; i < transactions.length; i++) {
        let tx = transactions[i] as Transaction

        tx.executionId = executionId
        tx.from = multisigAddr
        tx.to = callResult.value0
    
        // value > 0 and no data (Value transfer)
        if(callResult.value1.gt(zeroBigInt()) && callResult.value2.length == 0) {
            tx.type = "VALUE"
            tx.value = callResult.value1
            tx.token = "0x0000000000000000000000000000000000000000" // ETH
    
            if(status == "EXECUTED") { // updated balance only if executed
                let balance = loadOrCreateBalance(multisigAddr, <Address>Address.fromHexString(tx.token))
                balance.value = (balance.value.minus(<BigInt>tx.value))
                balance.save()
                wallet = updateBalance(wallet, balance)
            }
    
        // value > 0 and data (Contract call with value)
        } else if(callResult.value1.gt(zeroBigInt()) && callResult.value2.length > 0) {
            tx.type = "CONTRACT"
            tx.value = callResult.value1
            tx.token = "0x0000000000000000000000000000000000000000" // ETH
    
            if(status == "EXECUTED") { // updated balance only if executed
                let balance = loadOrCreateBalance(multisigAddr, <Address>Address.fromHexString(tx.token))
                balance.value = (balance.value.minus(<BigInt>tx.value))
                balance.save()
                wallet = updateBalance(wallet, balance)
            }
    
        // value == 0 and data (Contract call with no value)
        } else if(callResult.value1.equals(zeroBigInt()) && callResult.value2.length > 0) {
            let loadedtx = Transaction.load(tx.id)
    
            // Bypass this when the data is an ERC20 transfer (VALUE) or wallet config tx (ADMIN)
            if(loadedtx.type != "VALUE" && loadedtx.type != "ADMIN") { 
                tx.type = "CONTRACT" 
                tx.value = zeroBigInt()
                tx.token = "0x0000000000000000000000000000000000000000" // ETH
            }
            // if ERC20 transfer (VALUE), reset from and to
            if(loadedtx.type == "VALUE") {
                tx.from = tx.from
                tx.to = tx.to
            }
        
        // value == 0, no data 
        } else {
           // should never happen..
        }
    
        tx.status = status
        tx.submission = submission.id
        tx.save()
    
        wallet = pushTransactionIfNotExist(wallet, tx)
    }

    return wallet
}

export function handleDeposit(event: Deposit): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event)
        transaction.type = "VALUE"
        transaction.status = "EXECUTED"
        transaction.value = event.params.value
        transaction.token = "0x0000000000000000000000000000000000000000" // ETH
        transaction.from = event.params.sender
        transaction.to = multisigAddr
        transaction.save()
    
        let balance = loadOrCreateBalance(multisigAddr, <Address>Address.fromHexString(transaction.token))
        balance.value = (balance.value.plus(<BigInt>transaction.value))
        balance.save()

        wallet = pushTransactionIfNotExist(wallet, transaction)
        wallet = updateBalance(wallet, balance)
        wallet.save()

    } else {
        log.warning("handleDeposit::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleOwnerAddition(event: OwnerAddition): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event)
        transaction.type = "ADMIN"
        transaction.subType = "ADD_OWNER"
        transaction.extraBytes1 = event.params.owner
        transaction.save()
    
        let owners = wallet.owners
        owners.push(event.params.owner)
        wallet.owners = owners
        wallet = pushTransactionIfNotExist(wallet, transaction)
        wallet.save()

    } else {
        log.warning("handleOwnerAddition::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleOwnerRemoval(event: OwnerRemoval): void {

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event)
        transaction.type = "ADMIN"
        transaction.subType = "REMOVE_OWNER"
        transaction.extraBytes1 = event.params.owner
        transaction.save()
    
        let owners = wallet.owners
        let index = owners.indexOf(event.params.owner, 0)
        if (index > -1) {
            owners = owners.splice(index, 1);
        }
        wallet.owners = owners
        wallet = pushTransactionIfNotExist(wallet, transaction)
        wallet.save()

    } else {
        log.warning("handleOwnerRemoval::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleDailyLimitChange(event: DailyLimitChange): void { 

    let multisigAddr = event.address
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {
        let transaction = loadOrCreateTransaction(multisigAddr, event)
        transaction.type = "ADMIN"
        transaction.subType = "CHANGE_DAILY_LIMIT"
        transaction.extraBigInt1 = event.params.dailyLimit 
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
        let transaction = loadOrCreateTransaction(multisigAddr, event)
        transaction.type = "ADMIN"
        transaction.subType = "CHANGE_REQUIREMENT"
        transaction.extraBigInt1 = event.params.required 
        transaction.save()
    
        wallet = pushTransactionIfNotExist(wallet, transaction)
        wallet.required = event.params.required
        wallet.save()

    } else {
        log.warning("handleRequirementChange::Wallet {} not found", [multisigAddr.toHexString()])
    }
}

export function handleERC20Approval(event: Approval): void {

    let multisigAddr = event.params.owner
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {

        let transaction = loadOrCreateTransaction(multisigAddr, event)
        transaction.type = "ADMIN"
        transaction.subType = "ALLOWANCE"
        transaction.extraBigInt1 = event.params.value 
        transaction.extraBytes1 = event.address
        transaction.extraBytes2 = event.params.spender 
        transaction.save()
    
        let allowance = loadOrCreateAllowance(multisigAddr, event.address, event.params.spender)
        allowance.value = allowance.value.plus(event.params.value)
        allowance.save()
    
        wallet = pushTransactionIfNotExist(wallet, transaction)
        wallet = updateAllowance(wallet, allowance)
        wallet.save()
    }
}

export function handleERC20Transfer(event: Transfer): void {
    handleERC20Transfer2(event.params.from, event)  // send
    handleERC20Transfer2(event.params.to, event)    // receive
}

function handleERC20Transfer2(id: Address, event: Transfer): void {
    
    let multisigAddr = id
    let wallet = Wallet.load(multisigAddr.toHex())

    if(wallet != null) {

        let transaction = Transaction.load(crypto.keccak256(concat(multisigAddr, event.transaction.hash)).toHexString())
        if(transaction != null) { // transaction already exists
            let transactionId = crypto.keccak256(concat(concat(multisigAddr, event.transaction.hash), ByteArray.fromI32(event.logIndex.toI32())))
            transaction.linkedTransactions.push(transactionId.toHexString())
            transaction.save()


            transaction = new Transaction(transactionId.toHexString())
        }

        
        if(event.params.from == multisigAddr && event.transaction.to == event.address) { // direct transfer
            let allowance = loadOrCreateAllowance(multisigAddr, event.address, event.transaction.from)
            allowance.value = allowance.value.minus(event.params.value)
            allowance.save()
        
            wallet = updateAllowance(wallet, allowance)  

            transaction.extraString1 = "DIRECT_TRANSFER"
        }
        
        transaction.type = "VALUE"
        transaction.subType = "ERC20"
        transaction.status = "EXECUTED"
        transaction.value = event.params.value
        transaction.token = event.address.toHexString()
        transaction.from = event.params.from
        transaction.to = event.params.to
        transaction.save()
    
        let balance = loadOrCreateBalance(multisigAddr, event.address)
        balance.value = (multisigAddr == event.params.to) ? (balance.value.plus(event.params.value)) : (balance.value.minus(event.params.value))
        balance.save()

        wallet = pushTransactionIfNotExist(wallet, <Transaction>transaction)
        wallet = updateBalance(wallet, balance)
        wallet.save()
    } 
}

function loadOrCreateTransaction(multisig: Address, event: ethereum.Event): Transaction {
    let id = crypto.keccak256(concat(multisig, event.transaction.hash))
    let transaction = new Transaction(id.toHexString())
    transaction.date = event.block.timestamp
    transaction.hash = event.transaction.hash

    return transaction
}

function loadOrCreateSubmission(multisig: Address, transactionId: BigInt, event: ethereum.Event): Submission {
    let id = crypto.keccak256(concat(multisig, ByteArray.fromI32(transactionId.toI32())))

    let submission = Submission.load(id.toHexString())
    if(submission != null) {
        return submission as Submission
    } else {
        return new Submission(id.toHexString())
    }
}

function loadOrCreateAction(multisig: Address, transactionId: BigInt, type: string, sender: Address, event: ethereum.Event): Action {
    let id = crypto.keccak256(concat(concat(multisig, event.transaction.hash), ByteArray.fromI32(transactionId.toI32())))
    let action = new Action(id.toHexString())
    action.date = event.block.timestamp
    action.hash = event.transaction.hash
    action.executionId = transactionId
    action.type = type
    action.sender = sender

    return action
}

function loadOrCreateBalance(multisig: Address, token: Address): Balance {
    let id = crypto.keccak256(concat(multisig, token))

    let balance = Balance.load(id.toHexString())
    if(balance == null) {
        balance = new Balance(id.toHexString())
        balance.token = token.toHexString()
        balance.wallet = multisig.toHexString()
        balance.value = zeroBigInt()
    }

    return balance as Balance
}

function loadOrCreateAllowance(multisig: Address, token: Address, spender: Address): Allowance {
    let id = crypto.keccak256(concat(concat(multisig, token), spender))

    let allowance = Allowance.load(id.toHexString())
    if(allowance == null) {
        allowance = new Allowance(id.toHexString())
        allowance.spender = spender
        allowance.token = token.toHexString()
        allowance.wallet = multisig.toHexString()
        allowance.value = zeroBigInt()
    }

    return allowance as Allowance
}

function updateBalance(wallet: Wallet|null, balance: Balance): Wallet {
    if(wallet == null) throw "wallet cannot be null"

    let balances = wallet.balances

    if (balances.indexOf(balance.id, 0) == -1) {
        balances.push(balance.id)
        wallet.balances = balances
    }

    return wallet as Wallet
}

function updateAllowance(wallet: Wallet|null, allowance: Allowance): Wallet {
    if(wallet == null) throw "wallet cannot be null"

    let allowances = wallet.allowances

    if (allowances.indexOf(allowance.id, 0) == -1) {
        allowances.push(allowance.id)
        wallet.allowances = allowances
    }

    return wallet as Wallet
}

function addActionToSubmission(submission: Submission, action: Action): Submission {
    let actions = (submission.actions != null) ? submission.actions : <string[]>[]
    actions.push(action.id)
    submission.actions = actions
    return submission
}

function pushTransactionIfNotExist(wallet: Wallet|null, transaction: Transaction): Wallet {
    if(wallet == null) throw "wallet cannot be null"

    let transactions = wallet.transactions

    if (transactions.indexOf(transaction.id, 0) == -1) {
        transactions.push(transaction.id)
        wallet.transactions = transactions
    }

    wallet.totalTransactions = BigInt.fromI32(wallet.transactions.length)
    return wallet as Wallet
}