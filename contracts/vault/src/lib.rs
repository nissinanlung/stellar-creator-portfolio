// contracts/vault/src/lib.rs
// Issue #520 — Multi-Vault Batch Withdrawal
//
// Exposes the VaultContract with a batch_withdraw entry point that
// delegates to the batch processor for atomic, gas-efficient execution.

#![no_std]

pub mod batch;

use batch::{process_batch, WithdrawalOutcome, WithdrawalRequest};
use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

/// Soroban smart contract managing individual vault balances and batch withdrawals.
#[contract]
pub struct VaultContract;

#[contractimpl]
impl VaultContract {
    /// Deposits token funds into the specified owner's vault balance.
    ///
    /// Increases the stored balance of `owner` by `amount`.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment context (`Env`).
    /// * `owner` - The [`Address`] of the vault owner whose balance will be credited.
    /// * `amount` - The token amount to deposit as an `i128`. Must be strictly positive (`amount > 0`).
    ///
    /// # Preconditions
    /// * `owner` must authenticate this contract call (`owner.require_auth()`).
    /// * `amount` must be greater than zero. Panics with `"deposit amount must be positive"` if `amount <= 0`.
    ///
    /// # Side Effects
    /// * Updates persistent storage for key `("bal", owner)` with `current_balance + amount`.
    /// * Bumps storage TTL to maintain key persistence.
    ///
    /// # Example
    /// ```rust,ignore
    /// client.deposit(&owner_address, &1_000_i128);
    /// assert_eq!(client.balance(&owner_address), 1_000);
    /// ```
    pub fn deposit(env: Env, owner: Address, amount: i128) {
        owner.require_auth();
        assert!(amount > 0, "deposit amount must be positive");
        let current = Self::read_balance(&env, &owner);
        Self::write_balance(&env, &owner, current + amount);
    }

    /// Executes a batch of withdrawal requests in a single transaction.
    ///
    /// Iterates through `requests` and processes each independently via [`process_batch`].
    /// Successful withdrawals deduct funds and publish a `"withdraw"` event; invalid or
    /// underfunded requests return an outcome with `success: false` without altering state.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment context (`Env`).
    /// * `requests` - A [`Vec<WithdrawalRequest>`] containing the list of withdrawal instructions to evaluate.
    ///
    /// # Returns
    /// * [`Vec<WithdrawalOutcome>`] - Outcome record for each request in the exact order received,
    ///   indicating whether funds were debited (`success: true`) or skipped (`success: false`).
    ///
    /// # Preconditions
    /// * `requests` must contain at least one request. If `requests` is empty, panics with `BatchError::EmptyBatch`.
    /// * Each `WithdrawalRequest.owner` must authenticate the invocation (`req.owner.require_auth()`).
    ///
    /// # Gas Optimisation
    /// Batching reduces invocation overhead by aggregating multiple withdrawals into a single call.
    ///
    /// # Example
    /// ```rust,ignore
    /// let requests = vec![
    ///     &env,
    ///     WithdrawalRequest { owner: owner_a.clone(), recipient: recipient.clone(), amount: 500 },
    /// ];
    /// let outcomes = client.batch_withdraw(&requests);
    /// assert!(outcomes.get(0).unwrap().success);
    /// ```
    pub fn batch_withdraw(
        env: Env,
        requests: Vec<WithdrawalRequest>,
    ) -> Vec<WithdrawalOutcome> {
        process_batch(
            &env,
            requests,
            |e, addr| Self::read_balance(e, addr),
            |e, addr, bal| Self::write_balance(e, addr, bal),
        )
    }

    /// Returns the current vault balance for the specified `owner`.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment context (`Env`).
    /// * `owner` - The [`Address`] of the vault owner to query.
    ///
    /// # Returns
    /// * `i128` - The stored vault balance, or `0` if no balance record exists for `owner`.
    ///
    /// # Preconditions
    /// * None. This is a read-only query function and does not require authentication.
    ///
    /// # Example
    /// ```rust,ignore
    /// let current_bal = client.balance(&owner_address);
    /// ```
    pub fn balance(env: Env, owner: Address) -> i128 {
        Self::read_balance(&env, &owner)
    }

    // ── Internal storage helpers ─────────────────────────────────────────────

    fn balance_key(owner: &Address) -> (soroban_sdk::Symbol, Address) {
        (soroban_sdk::symbol_short!("bal"), owner.clone())
    }

    fn read_balance(env: &Env, owner: &Address) -> i128 {
        env.storage()
            .persistent()
            .get::<_, i128>(&Self::balance_key(owner))
            .unwrap_or(0)
    }

    fn write_balance(env: &Env, owner: &Address, amount: i128) {
        env.storage()
            .persistent()
            .set(&Self::balance_key(owner), &amount);
        // Bump TTL on every write (mirrors storage.rs policy).
        env.storage()
            .persistent()
            .extend_ttl(&Self::balance_key(owner), 100, 518_400);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use batch::WithdrawalRequest;
    use soroban_sdk::{testutils::Address as _, vec, Env};

    fn setup() -> (Env, soroban_sdk::Address, VaultContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register_contract(None, VaultContract);
        let client = VaultContractClient::new(&env, &id);
        (env, id, client)
    }

    #[test]
    fn deposit_and_balance() {
        let (env, _, client) = setup();
        let owner = Address::generate(&env);
        client.deposit(&owner, &1000);
        assert_eq!(client.balance(&owner), 1000);
    }

    #[test]
    fn batch_withdraw_deducts_all() {
        let (env, _, client) = setup();
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.deposit(&a, &500);
        client.deposit(&b, &300);

        let requests = vec![
            &env,
            WithdrawalRequest { owner: a.clone(), recipient: recipient.clone(), amount: 200 },
            WithdrawalRequest { owner: b.clone(), recipient: recipient.clone(), amount: 100 },
        ];

        let outcomes = client.batch_withdraw(&requests);
        assert_eq!(outcomes.len(), 2);
        assert_eq!(client.balance(&a), 300);
        assert_eq!(client.balance(&b), 200);
    }

    #[test]
    #[should_panic]
    fn batch_withdraw_rejects_insufficient_balance() {
        let (env, _, client) = setup();
        let owner = Address::generate(&env);
        let recipient = Address::generate(&env);
        client.deposit(&owner, &50);

        let requests = vec![
            &env,
            WithdrawalRequest { owner: owner.clone(), recipient, amount: 100 },
        ];
        client.batch_withdraw(&requests); // should panic
    }

    #[test]
    fn batch_withdraw_happy_path_full_flow() {
        let (env, _, client) = setup();
        let owner = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.deposit(&owner, &1000);

        let requests = vec![
            &env,
            WithdrawalRequest { owner: owner.clone(), recipient: recipient.clone(), amount: 400 },
        ];

        let outcomes = client.batch_withdraw(&requests);

        // Every valid request succeeds with the requested amount preserved.
        assert_eq!(outcomes.len(), 1);
        let outcome = outcomes.get(0).unwrap();
        assert!(outcome.success);
        assert_eq!(outcome.owner, owner);
        assert_eq!(outcome.amount, 400);

        // Vault balance is debited by exactly the withdrawn amount.
        assert_eq!(client.balance(&owner), 600);
    }

    #[test]
    fn batch_withdraw_skips_zero_amount_request() {
        let (env, _, client) = setup();
        let owner = Address::generate(&env);
        let recipient = Address::generate(&env);
        client.deposit(&owner, &500);

        let requests = vec![
            &env,
            WithdrawalRequest { owner: owner.clone(), recipient, amount: 0 },
        ];

        let outcomes = client.batch_withdraw(&requests);

        // Zero-amount requests are recorded as failures without touching state.
        assert_eq!(outcomes.len(), 1);
        assert!(!outcomes.get(0).unwrap().success);
        assert_eq!(outcomes.get(0).unwrap().amount, 0);
        assert_eq!(client.balance(&owner), 500);
    }
}
