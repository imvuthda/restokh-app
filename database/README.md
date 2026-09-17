# Restaurant Management Database

Run `99_full_database.sql` on a fresh MySQL 8.0+ or MariaDB 10.6+ server.

If the database was installed from an older release, back it up and run
`14_production_improvements.sql` once instead of importing the full file again.
This adds immediate logout token revocation and payment idempotency support.

If old seed labels show `áž...`, run `15_utf8_seed_repair.sql` once. It repairs
only the known seed codes and keeps custom restaurant records unchanged.

For an older installation, run `16_branch_production_rules.sql` once after
confirming that only one branch is marked as Head Office.

Run `17_system_settings.sql` once on an older installation to add the complete
restaurant settings defaults without overwriting values already configured.

Run `18_khmer_address_repair.sql` if the Cambodia address appears as
`áž”áŸ’...`; it restores the text to `ប្រទេសកម្ពុជា` using UTF-8-safe HEX.

Run `19_auto_sku.sql` once on an existing installation to enable safe,
transactional menu and ingredient SKU numbering (`MI-000001`, `ING-000001`, ...).

Run `20_fix_khmer_units.sql` once if the unit dropdown shows broken Khmer text.
It safely repairs only the standard `KG`, `G`, `L`, `ML`, `PCS`, and `BOTTLE`
labels and can be rerun without affecting custom units.

Run `21_payment_method_settings.sql` on an existing installation to manage which
payment methods are available in POS from System Settings.

Run `22_manage_table_shapes.sql` on an existing installation to enable CRUD for
table shapes. Areas and shapes can then be created, edited, or deactivated per branch.

Run `23_special_customer_discount.sql` once on an existing installation to add
customer types and safe automatic VIP/staff/partner discount percentages. New
orders copy the percentage into the order, so later customer changes never alter
old receipts or historical reports.

Run `24_payment_methods_master.sql` once on an existing installation to enable
branch-specific payment method CRUD (Cash, ABA, ACLEDA, Wing, Card, Bank,
Credit, and custom methods). Existing payment records keep their original code;
removing a method safely deactivates it instead of deleting transaction history.

If Khmer labels in table shapes or payment methods display as `áž...`, back up
the database and run `25_fix_khmer_master_data.sql` once. It repairs the standard
labels for every branch and enforces `utf8mb4` on both master tables.

Run `26_reservation_lifecycle.sql` once on an existing installation to enable
the complete reservation flow: confirm, check-in/open order, automatic
completion after payment, cancellation, and table release.

Run `27_guest_order_discount.sql` once on an existing installation to enable
safe percentage or fixed-amount guest discounts with a required reason,
employee audit trail, receipt display, and sales reporting.

If an existing `cashier` account cannot open POS, update the backend and
frontend code first, then run `28_cashier_pos_access.sql` to restore the
built-in cashier role's default POS permissions. This script is safe to rerun
and does not grant `settings.manage`. Log out and log in again afterward.

- Username: `admin`
- Password: `Admin@123`

Change the password immediately after first login. Backend transactions must lock invoice sequences and inventory rows during numbering, purchasing, payment, and stock changes.

Multi-branch rule: `super_admin` may work across all branches. Every other user
must be assigned to exactly one branch; the API ignores attempts by those users
to read or write another branch.
