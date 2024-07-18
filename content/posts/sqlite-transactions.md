---
title: "SQLite Transactions"
date: 2024-07-16
draft: false
tags: ["development", "sqlite", "rust"]
---

## What is SQLite?

In the past few years [SQLite](https://www.sqlite.org/) (not SQL-light) has had a surge of popularity as people have come to realise its power as an in-process, highly reliable SQL database engine as a backend for server processes rather than its traditional role of client or edge applications. This change in stance for SQLite has happened despite the authors almost [actively discouraging](https://www.sqlite.org/whentouse.html#checklist_for_choosing_the_right_database_engine) its use for this purpose.

I am interested in SQLite for some key reasons:

- It is conceptually simple: Imagine a [B-tree](https://en.wikipedia.org/wiki/B-tree) of rows/tuples partitioned by a table's primary key that has been [exhaustively tested](https://www.sqlite.org/testing.html) to persist that data to disk reliably, then add a [SQL](https://en.wikipedia.org/wiki/SQL) interaction layer.
- Is able to have practical backup strategy via [Litestream](https://litestream.io/) that will perform backups and continuous replication of the write-ahead-log to a remote location. The backups are then able to be automatically restored on startup with a [trivial command](https://litestream.io/reference/restore/). Does your business really need the 99.99% uptime offered by expensive cloud managed databases like [AWS](https://aws.amazon.com/rds/aurora/), [Azure](https://azure.microsoft.com/en-us/products/azure-sql/) or [Google](https://cloud.google.com/sql/postgresql)?
- It can be run locally as I still like having a complete development environment able to be run offline.
- [in-memory](https://www.sqlite.org/inmemorydb.html) via `file::memory:` allowing test code to easily start up and tear down an instance per test if required.

## The single-writer limitation

The limitations of SQLite on servers has been [well documented](https://www.sqlite.org/whentouse.html#situations_where_a_client_server_rdbms_may_work_better) by the SQLite authors and the best [server side configurations](https://kerkour.com/sqlite-for-servers) dissected, however the standout limitation is *high-volume websites* by which they mean *write-heavy websites*.

In [Write-Ahead Logging](https://www.sqlite.org/wal.html) mode (required by Litestream) SQLite employs a single writer by [design](https://www.sqlite.org/wal.html#concurrency) which allows at most one write transaction but many read-only transactions to run concurrently. This design places the bottleneck of a *high-volume write-heavy websites* squarely on how to manage throughput on that single writer... and that brings us back to one of the core building-blocks of modern technology:

## ACID

If you have forgotten about the [Atomic](https://en.wikipedia.org/wiki/Atomicity_(database_systems)), [Consistent](https://en.wikipedia.org/wiki/Consistency_(database_systems)), [Isolated](https://en.wikipedia.org/wiki/Isolation_(database_systems)), [Durable](https://en.wikipedia.org/wiki/Durability_(database_systems)) guarantees provided by [most](https://jepsen.io/) modern databases then this is the time to go and [refresh your knowledge](https://en.wikipedia.org/wiki/ACID).

### SQLite

SQLite, [by default](https://sqlite.org/isolation.html), offers strict `SERIALIZABLE` [Isolated](https://en.wikipedia.org/wiki/Isolation_(database_systems)) transactions which is the strongest isolation guarantee (unless certain conditions are met: https://sqlite.org/isolation.html). By employing a single-writer, SQLite is using a form of [Pessimistic concurrency control](https://en.wikipedia.org/wiki/Concurrency_control#Categories) that makes it easy to guarantee that the underlying data has not changed whilst the write-transaction is in progress.

### Postgres

Postgres, on the other hand, actually differs from the `SERIALIZABLE` default defined in the [SQL Standard](https://en.wikipedia.org/wiki/ISO/IEC_9075) and chooses the more relaxed `READ COMMITTED` (and this is despite having the much more complex [Multiversion concurrency control](https://en.wikipedia.org/wiki/Multiversion_concurrency_control)). This reduction in strictness means that it is at risk of [non-repeatable reads](https://en.wikipedia.org/wiki/Isolation_(database_systems)#Non-repeatable_reads) where, even within the same transaction, it is possible to retrieve different results by executing the same read-query multiple times if the values have been changed by another `COMMITTED` transaction in the background. By choosing this isolation level Postgres opens the risk of a transaction operating on stale data. This fact needs to be kept-in-mind by the developer - imagine what might be possible if performing financial transactions with stale balance data?

If set to [SERIALIZABLE](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-SERIALIZABLE) then Postgres uses an [optimistic-concurrency control](https://en.wikipedia.org/wiki/Optimistic_concurrency_control) scheme where data accessed during the transaction is tracked and before-commit is verified not to have changed. Postgres does this based on either `finer-grain` locking (row level) or `course-grain` locking (`page` level) depending on the transaction so as to manage memory usage. This pattern is referred to as `optimistic` due to the fact it is expected that there will not be a conflict due to the underlying data having changed when the transaction is committed - which is less likely to change the more `fine-grained` the data monitored by the transaction is.

### FoundationDB

Transactions are not just limited to [Relational databases](https://en.wikipedia.org/wiki/Relational_database). FoundationDB, in my view one of the finest open-source projects (that incidentally has used SQLite's storage code for many years), also employs [optimistic-concurrency control](https://en.wikipedia.org/wiki/Optimistic_concurrency_control) to achieve `SERIALIZABLE` guarantees across a distributed key-value store. At the time when NoSQL came onto the scene, distributed NoSQL stores with ACID guarantees were not common and FoundationDB wrote the [Transaction Manifesto](https://apple.github.io/foundationdb/transaction-manifesto.html) to highlight how greatly the developer can benefit from the ACID guarantees.

FoundationDB goes one-step further and offers advice on how to write code for [optimistic-concurrency control](https://en.wikipedia.org/wiki/Optimistic_concurrency_control) and the fact that sometimes data *will* change in response to a concurrent transaction conflict and the transaction is automatically retried:

## Idempotence

> An idempotent transaction is one that has the same effect when committed twice as when committed once. -- FoundationDB

In [making any transaction idempotent](https://apple.github.io/foundationdb/developer-guide.html#developer-guide-unknown-results) FoundationDB provides patterns for how to avoid issues if a transaction needs to retried multiple times due to a conflict. Things like avoiding creating random identifiers inside the transaction might be immediately recognizable to [functional programmers](https://en.wikipedia.org/wiki/Pure_function) but logic to guard against a state that may have changed since the intial execution may not be immediately obvious:

```python
# Increases account balance and stores a record of the deposit with a unique depositId
@fdb.transactional
def deposit(tr, acctId, depositId, amount):

    # If the deposit record exists, the deposit already succeeded, and we can quit
    depositKey = fdb.tuple.pack(('account', acctId, depositId))
    if tr[depositKey].present(): return

    amount = struct.pack('<i', amount)
    tr[depositKey] = amount

    # The above check ensures that the balance update is executed only once
    balanceKey = fdb.tuple.pack(('account', acctId))
    tr.add(balanceKey, amount)
```

With all that in our heads, what options does SQLite give us?

## BEGIN ...

SQLite offers multiple ways for developers to indicate to the engine how the transaction will behave in the form of the `IMMEDIATE`, `EXCLUSIVE` and `DEFERRED` keywords that when in [Write-Ahead Logging](https://www.sqlite.org/wal.html) mode can be reduced to `DEFERRED` vs `IMMEDIATE`.

It is worth mentioning the `SQLITE_BUSY_TIMEOUT` parameter that is configurable milliseconds delay that a transaction can wait before returning `SQLITE_BUSY` as seen below:

### DEFERRED

Deferred means that the transaction will be started in `READ` mode that can run concurrently with any existing read or write transactions and will only be upgraded to a blocking `READ-WRITE` transction if a query that modifies the database state is executed (like `INSERT`, `UPDATE` or `DELETE`).  If at the time of upgrade the database is locked by another transaction (plus `SQLITE_BUSY_TIMEOUT`) then a `SQLITE_BUSY` error will be returned and it is up to the client to handle it (e.g. fail/retry).

### IMMEDIATE

Immediate means that the transaction will be started immediately in `READ-WRITE` mode and, if a write transaction is already running, will immediately (plus `SQLITE_BUSY_TIMEOUT`) return `SQLITE_BUSY`. Once again, it is up to the client to decide how to handle.

### CONCURRENT

SQLite has an [experimental branch](https://www.sqlite.org/cgi/src/doc/begin-concurrent/doc/begin_concurrent.md) that moves the transactions from [Pessimistic](https://en.wikipedia.org/wiki/Concurrency_control#Categories) to limited [Optimistic](https://en.wikipedia.org/wiki/Optimistic_concurrency_control) - limited in that the optimistic locking operates at a database [page](https://en.wikipedia.org/wiki/Page_%28computer_memory%29) level (by default `4096` bytes) not row/tuple level.

In `CONCURRENT` mode, SQLite will allow multiple write transactions to be active at once but, before commit, will verify that none of the `pages` accessed while performing the transaction have changed since the transaction began. If no conflict occurs then the changes will be committed sequentially and strict `SERIALIZABLE` guarantees are achieved. If conflicts occur then SQLite will return a `SQLITE_BUSY` and the client can decide how to handle. Note that this state cannot be resolved by waiting so `SQLITE_BUSY_TIMEOUT` does not apply.

### HC-Tree

Another experimental branch of SQLite is [HC-Tree] which is a work-in-progress that aims to provide optimistic row/tuple level locking. One interesting outcome is that they provide an excellent set of [benchmarks](https://sqlite.org/hctree/doc/hctree/doc/hctree/threadtest.wiki) to demonstrate the performance benefits of such a design against the `BEGIN CONCURRENT` branch.

Why don't we take their benchmarking approach and run it against the standard options?

## Benchmarking

### Setup

This script is set up to seed the database with `n` (default 1000000) rows which will create a database file of around 350MB.

```sql
PRAGMA journal_mode = WAL;
PRAGMA mmap_size = 1000000000;
PRAGMA synchronous = off;
PRAGMA journal_size_limit = 16777216;

CREATE TABLE tbl(
    a INTEGER PRIMARY KEY,
    b BLOB(200),
    c CHAR(64)
);

-- https://www.sqlite.org/series.html
WITH RECURSIVE generate_series(value) AS (
    SELECT 0
    UNION ALL
    SELECT value+1 FROM generate_series
    WHERE value < {rows}
)
INSERT INTO tbl
SELECT value, randomblob(200), hex(randomblob(32))
FROM generate_series;

CREATE INDEX tbl_i1 ON tbl(substr(c, 1, 16));
CREATE INDEX tbl_i2 ON tbl(substr(c, 2, 16));
```

### Strategies

The `hc-tree` benchmarks run two queries: one random `SELECT` and one `UPDATE`.

The `SELECT` query performs a random index lookup using the `tbl_i1` index. `frandomblob` has been replaced with a variable so the transaction is idempotent.

```sql
-- repeat nScan times:
-- SELECT * FROM tbl WHERE substr(c, 1, 16)>=hex(frandomblob(8)) ORDER BY substr(c, 1, 16) LIMIT 10;
SELECT * FROM tbl WHERE substr(c, 1, 16)>=? ORDER BY substr(c, 1, 16) LIMIT 10;
```

The `UPDATE` query refers to an `updateblob` function which can update a part of the `b` `BLOB`. As this does not exist the query has been changed to update the entire `b` and `c` values and to be idempotent.

```sql
-- repeat nUpdate times:
-- UPDATE tbl SET b=updateblob(b, ?, ?), c=hex(frandomblob(32)) WHERE a = ?;
UPDATE tbl SET b=?, c=? WHERE a=?;
```

### Behavior

The code has been written to start up `n` threads that will try to execute as many transactions as possible in a loop for 30 seconds (measured by incrementing a shared atomic counter).

- In all cases the code has been written to retry on `SQLITE_BUSY`.
- Each transaction has been written to be idempotent so the `Scan` and `Update` parameters are generated outside of the retry loop to simulate how an automatic retry might operate.

The final piece of setup is to control the file location to protect a solid-state-drive. This command on MacOS will create a 16G ramdisk mounted at `/Volumes/ramdisk`. Calculated by RAM in MB (16384) * 2048.


```bash
diskutil erasevolume apfs 'ramdisk' `hdiutil attach -nobrowse -nomount ram://33554432`
```

Or Linux:

```bash
sudo mkdir -p /mnt/ramdisk
sudo mount -t tmpfs -o size=16g tmpfs /mnt/ramdisk
```


## Results

### nUpdate=1, nScan=0
![Update 1 / Scan 0](/img/2024/sqlite_n_update_1_n_scan_0.svg)

This write-only transaction shows:

- `IMMEDIATE` vs `DEFERRED` benefits are clear as the locking happens immediately and the transaction does not suffer the upgrading cost.
- `CONCURRENT` does show increased throughput as the number of threads increases and conflicts increase. At the lower end it performs slightly worse indicating some level of bookkeeping cost. Even with only one update per transaction there were more than 1000 retried transactions at `16` threads.

### nUpdate=10, nScan=0
![Update 10 / Scan 0](/img/2024/sqlite_n_update_10_n_scan_0.svg)

This write-only batched transaction shows:

- As expected, batching writes helps a lot with number of updated rows at `16` threads, `CONCURRENT` increasing from ~12k/sec to ~19k/sec.
- `IMMEDIATE` vs `DEFERRED` matters less as presumably the cost of doing the underlying update becomes more significant than the cost of upgrading the transaction (the upgrade only happens once per transaction vs the 10 updates).

### nUpdate=1, nScan=10
![Update 1 / Scan 10](/img/2024/sqlite_n_update_1_n_scan_10.svg)

This transaction should expose the weakness of the `page` level `CONCURRENT` locking as the random reads should increase collisions:

- This immediately shows why using `IMMEDIATE` for any transaction that will update is important vs the cost of upgrading a `DEFERRED` transaction.
- For `CONCURRENT` the fact that these results are so solid is due to the fact that underlying collisions did not actually increase very much. See discussion below.

### nUpdate=10, nScan=10
![Update 10 / Scan 10](/img/2024/sqlite_n_update_10_n_scan_10.svg)

This test does not show anything of significance compared with what we have already observed.

### nUpdate=0, nScan=10
![Update 0 / Scan 10](/img/2024/sqlite_n_update_0_n_scan_10.svg)

This read-only batched transaction shows:

- `IMMEDIATE` vs `DEFERRED` shows the impact of [Pessimistic concurrency control](https://en.wikipedia.org/wiki/Concurrency_control#Categories) and why you should not default to `IMMEDIATE` for all transactions.
- `CONCURRENT` vs `IMMEDIATE` indicates there is a slight downside to using `CONCURRENT` mode under heavy load where performs slightly worse in all cases but `CONCURRENT` would be a good default option.

## Discussion

Some comments about `CONCURRENT`:

### Write-ahead Logging

To gain [optimistic-concurrency control](https://en.wikipedia.org/wiki/Optimistic_concurrency_control) `CONCURRENT` makes heavy use of the `write-ahead-log` and if you watch the target directory while the `CONCURRENT` stage is running you will see the `-wal` suffixed file growing rapidly. This means you should be aware of a few things:

- These benchmarks were run against a temporary ram disk if the heavy writes of the `CONCURRENT` mode do need to be written to a storage then you can expect the write performance of your storage to become important and it is likely that `IMMMEDIATE` mode will be faster. So it is a good idea to benchmark against your actual device.
- Sustained writes to the `write-ahead log` will not allow SQLite to execute `checkpointing` (copying the WAL data back into the main SQLite file and truncating the log) so the `WAL` will continue to grow until out of storage. SQLite maintains another [experimental branch](https://sqlite.org/cgi/src/doc/wal2/doc/wal2.md) which uses two rotating `WAL` files to prevent this problem. The [bedrock](https://www.sqlite.org/src/timeline?r=bedrock) branch incorporates `CONCURRENT` and `WAL2` patches however [Litestream](https://litestream.io/) does not support `WAL2`.

### Collisions

This chart shows the number of retried transactions per second when executing with `nUpdate=10, nScan=10`.

![Update 10 / Scan 10](/img/2024/sqlite_n_update_10_n_scan_10_retries.svg)

- These tests perform updates over those ~80k pages so the probability of collision is low. If you reduce the number of rows in the table or change your sampling to something that is skewed like most recent records then the chance of collisions goes up. See [this article](https://sqlite.org/src/doc/begin-concurrent/doc/begin_concurrent.md) for programming notes which advises explicitly against using integer `ROWID` tables to try to reduce data locality issues.
- Each row should be a maximum of 336 bytes made up of 8 bytes (`INTEGER` is variable-length encoded) + 200 bytes (`BLOB` raw encoding) + 128 bytes (`TEXT` is `UTF-8` encoded). This means that one `4096` byte page will have a maximum of `12` rows (before overhead). Based on this we expect ~80k pages are used to store the 1 million rows.
- If the number of rows seeded is reduced to `10000` then collisions are so frequent then performance drops hugely with `CONCURRENT` and `IMMEDIATE` takes a huge lead.


## Run it yourself

Firstly, the absolute numbers here are not the purpose of this exercise. These should be used for relative performance only as you can run the benchmarks on your hardware to see what throughput you receive.

- A multi-platform Docker image is available at: [ghcr.io/seddonm1/sqlite-bench:latest](https://github.com/users/seddonm1/packages/container/package/sqlite-bench).
- This code has been pushed https://github.com/seddonm1/sqlite-bench.
- The excellent https://github.com/rusqlite/rusqlite has been forked to make the minor changes required to build the SQLite [begin-concurrent](https://www.sqlite.org/src/info/e3f8c70ef5a7349c) branch at version 3.46.0. To see the modifications see this [compare](https://github.com/rusqlite/rusqlite/compare/eebbbb008633b36f2580b29501800fb8bc37e36a...seddonm1:rusqlite:begin-concurrent).


## Further Reading

- https://fly.io/blog/all-in-on-sqlite-litestream/
- https://kerkour.com/sqlite-for-servers
- https://simonwillison.net/2022/Oct/23/datasette-gunicorn/#benchmarking-sqlite
