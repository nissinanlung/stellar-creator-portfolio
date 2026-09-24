// contracts/vault/src/batch.rs
// Issue #520 — Multi-Vault Batch Withdrawal
//
// Vectorised batch processor for vault withdrawals.
// Gas optimisation: a single contract invocation handles N withdrawals,
// avoiding per-withdrawal transaction overhead and network congestion.
//
// Atomicity guarantee: requests that fail validation are recorded as failed
// outcomes (success: false) rather than aborting the entire batch. If you
// need all-or-nothing semantics, inspect the returned outcomes and roll back
// at the caller level.

use soroban_sdk::{contracterror, contracttype, Address, Env, Vec};

/// A single withdrawal request within a batch.
#[contracttype]
#[derive(Clone)]
pub struct WithdrawalRequest {
    /// Vault owner address authorising this withdrawal.
    pub owner: Address,
    /// Destination address to receive the withdrawn funds.
    pub recipient: Address,
    /// Token amount to withdraw (in stroops / base units). Must be strictly positive.
    pub amount: i128,
}

/// Outcome for a single processed withdrawal in a batch.
///
/// `success` is `false` when the request was skipped due to a zero/negative
/// amount or an insufficient vault balance. In failure cases, `amount` reflects the
/// original requested amount (not debited) so callers can inspect the failure.
#[contracttype]
#[derive(Clone)]
pub struct WithdrawalOutcome {
    /// Vault owner address associated with the withdrawal attempt.
    pub owner: Address,
    /// Requested withdrawal amount.
    pub amount: i128,
    /// `true`  – funds were successfully debited and the withdrawal event was emitted.
    /// `false` – the request was invalid or underfunded; no state was changed.
    pub success: bool,
}

/// Error codes for batch-level failures.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum BatchError {
    /// Raised when `process_batch` is called with an empty vector of requests.
    EmptyBatch = 1,
    /// Kept for ABI / event-log compatibility; no longer used to abort batch execution.
    ZeroAmount = 2,
    /// Kept for ABI / event-log compatibility; no longer used to abort batch execution.
    InsufficientBalance = 3,
}

/// Vectorised batch processor for vault withdrawals.
///
/// Evaluates each withdrawal request independently within a single invocation.
/// For each entry:
/// - Verifies `req.owner.require_auth()`.
/// - Checks if `amount <= 0`: if so, appends `WithdrawalOutcome { success: false }`.
/// - Reads current balance via `get_balance`: if `current < amount`, appends `WithdrawalOutcome { success: false }`.
/// - Otherwise, updates balance via `set_balance(env, owner, current - amount)`, emits a `"withdraw"` event,
///   and appends `WithdrawalOutcome { success: true }`.
///
/// # Arguments
/// * `env` - Reference to the Soroban environment (`&Env`).
/// * `requests` - A [`Vec<WithdrawalRequest>`] containing the withdrawal instructions.
/// * `get_balance` - Closure taking `(&Env, &Address)` and returning the current balance as an `i128`.
/// * `set_balance` - Closure taking `(&Env, &Address, i128)` to update stored balance.
///
/// # Returns
/// * [`Vec<WithdrawalOutcome>`] - Vector of outcome records in the exact order of `requests`.
///
/// # Preconditions
/// * `requests` must contain at least one item. If `requests.is_empty()`, panics immediately with `BatchError::EmptyBatch`.
/// * Each `req.owner` must authorize the contract call via `req.owner.require_auth()`.
///
/// # Events Emitted
/// * Symbol topic `("withdraw", owner)` with data tuple `(recipient, amount)` for each successful withdrawal.
pub fn process_batch(
    env: &Env,
    requests: Vec<WithdrawalRequest>,
    get_balance: impl Fn(&Env, &Address) -> i128,
    set_balance: impl Fn(&Env, &Address, i128),
) -> Vec<WithdrawalOutcome> {
    if requests.is_empty() {
        // Nothing to do — surface this as a hard error at the batch level.
        soroban_sdk::panic_with_error!(env, BatchError::EmptyBatch);
    }

    let mut outcomes: Vec<WithdrawalOutcome> = Vec::new(env);

    for req in requests.iter() {
        // Require each owner to have authorised this invocation.
        req.owner.require_auth();

        // Validate amount — record failure instead of aborting the whole batch.
        if req.amount <= 0 {
            outcomes.push_back(WithdrawalOutcome {
                owner: req.owner.clone(),
                amount: req.amount,
                success: false,
            });
            continue;
        }

        let current = get_balance(env, &req.owner);

        // Insufficient balance — record failure without touching state.
        if current < req.amount {
            outcomes.push_back(WithdrawalOutcome {
                owner: req.owner.clone(),
                amount: req.amount,
                success: false,
            });
            continue;
        }

        // Debit vault balance.
        set_balance(env, &req.owner, current - req.amount);

        // Emit withdrawal event for indexer.
        env.events().publish(
            (soroban_sdk::symbol_short!("withdraw"), req.owner.clone()),
            (req.recipient.clone(), req.amount),
        );

        outcomes.push_back(WithdrawalOutcome {
            owner: req.owner.clone(),
            amount: req.amount,
            success: true,
        });
    }

    outcomes
}
