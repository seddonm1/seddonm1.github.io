---
title: "Bringing a jewel-encrusted warhammer to a knife fight"
date: 2025-02-04
draft: false
tags: ["development", "rust"]
---

This post is about the brute-force reverse engineering of an old [Multi-user Dungeon](https://en.wikipedia.org/wiki/Multi-user_dungeon) (MUD), using modern [Large Language Models](https://en.wikipedia.org/wiki/Large_language_model) (LLMs) to automate this painstaking process. While the choice of a MUD codebase is arbitrary (explained below), the approach applies equally well to other tasks, such as converting legacy `COBOL` to a modern language.

There are two reasons that LLMs should be good at this process, given their lineage:

1. **Summarization**: Large Language Models tend to be extremely good at [summarization](https://arxiv.org/abs/2301.13848) where they are able to identify patterns across huge amounts of data. It is this skill that suggests, with a large enough [context window](https://en.wikipedia.org/wiki/Context_window), they should be able to identify patterns in decompiled code - perfect for identifying how variables and functions are used across a code base.
1. **Translation**: Large Language Models evolved from [Google Translate](https://en.wikipedia.org/wiki/Google_Translate) where they utilize [neural machine translation](https://en.wikipedia.org/wiki/Neural_machine_translation) to translate from one language to another (i.e. English to French). This suggests they should be capable of performing accurate 'neural' translation of one programming language to another.

Ultimately this is a playground for me to learn about the real LLM capabilities (outside of standard benchmarks) where the journey is as interesting as the outcome.

## Intro to MUDs

Back in the pre-internet days (yes, they existed) users would use a [modem](https://en.wikipedia.org/wiki/Modem) and their phoneline to connect to [Bulletin board systems](https://en.wikipedia.org/wiki/Bulletin_board_system) (BBS) where they could chat, transfer files and play games. These were a glimpse of the future where multiple 'online' users would be able to interact in real-time. 

One of these BBS games was the *extremely addictive* [MajorMUD - Realm of Legends](https://www.majormud.com/): an online dungeons-and-dragons-esque fantasy game for the [Worldgroup/MajorBBS](https://en.wikipedia.org/wiki/The_Major_BBS) platform. My friends and I were heavily invested in this game where - due to game balance design - the more time spent made your character more powerful and the game easier (our phone line was occupied for many hours). The game's true strength was for groups of players to form parties and play the game together or against one another.

![MUD gameplay](../../img/2026/mmud.svg "class=terminal-frame")

For all intents and purposes the [source code has been lost](https://www.reddit.com/r/MajorMUD/comments/4525pt/majormud_source_code/) and only a Windows 32-bit [Dynamic-link library](https://en.wikipedia.org/wiki/Dynamic-link_library) (DLL) remains. The GreaterMUD project was an independent 'faithful rewrite' but is also closed source. Therefore this 628KB DLL is perfect for doing brute-force reverse engineering via LLMs as we know the training process has not been compromised by ingesting this source code - so it can't 'cheat' and replay [memorized](https://arxiv.org/abs/2601.02671) code.

## Decompiling

### From DLL to C?

Initially I tried to get the LLM to take raw assembly and try to rewrite the logic. This proved a dead end however I suspect if you had the resources you could easily generate a huge amount of training data compiling with different compilers/compiler options and train a very strong model. This is an almost ideal situation for LLM finetuning - a closed system with a known-correct outcome where you can mass-produce training data cheaply.

I tried multiple commercial decompilers before settling on [Ghidra](https://github.com/NationalSecurityAgency/ghidra): an open-source decompiler built by the [National Security Agency](https://www.nsa.gov/). It is extremely powerful and it is clear a huge amount of effort has gone into the pattern matching required for it to do a solid job of producing `pseudo-C` - that is their `c` like language that doesn't directly compile. 

![A screenshot of Ghidra](../../img/2026/ghidra.png)

While its decompilation is amazing, depending on how the program has been compiled, a lot of information is lost in the process - like human-readable variable names (configuring the compiler to keep debug symbols in the binary would retain more of this information). So what you get is mostly logically-correct but not human-friendly code. Here is a randomly chosen (relatively short) function:

```c
/* monster_add_cast_spell_to_user */

int __cdecl
monster_add_cast_spell_to_user
          (int param_1,uint param_2,undefined2 param_3,int param_4,int param_5,int param_6,
          char param_7)

{
  int iVar1;
  int iVar2;
  int iVar3;
  
                    /* 0x25ea6  166  _monster_add_cast_spell_to_user */
  iVar1 = get_player(param_1);
  if ((iVar1 != 0) && (param_5 != 0)) {
    iVar3 = -1;
    iVar2 = 0;
    do {
      if (*(ushort *)(iVar1 + 0x40 + iVar2 * 2) == param_2) {
        if ((param_7 != '\0') && (*(short *)(iVar1 + 0x54 + iVar2 * 2) < param_4)) {
          *(short *)(iVar1 + 0x54 + iVar2 * 2) = (short)param_4;
          *(undefined2 *)(iVar1 + 0x68 + iVar2 * 2) = param_3;
          monster_display_spell_success(param_1,param_5,param_6,iVar1 + 0x1e,param_4);
          return iVar2;
        }
        return -2;
      }
      if (*(short *)(iVar1 + 0x40 + iVar2 * 2) == 0) {
        iVar3 = iVar2;
      }
      iVar2 = iVar2 + 1;
    } while (iVar2 < 10);
    if (iVar3 != -1) {
      *(undefined2 *)(iVar1 + 0x40 + iVar3 * 2) = (undefined2)param_2;
      *(undefined2 *)(iVar1 + 0x68 + iVar3 * 2) = param_3;
      *(short *)(iVar1 + 0x54 + iVar3 * 2) = (short)param_4;
      monster_display_spell_success(param_1,param_5,param_6,iVar1 + 0x1e,param_4);
      return iVar3;
    }
  }
  return -1;
}
```

How do you turn it into human-friendly code? 

How do you identify that `(iVar1 + 0x40 + iVar2 * 2)` = `(player_ptr->spell_ids[spell_slot_index] == _spell_id)`?

### Gemini enters the game ...

Google's Gemini models (specifically from `flash-2.5` onwards with one million token [usable context length](https://cloud.google.com/blog/products/ai-machine-learning/the-needle-in-the-haystack-test-and-how-gemini-pro-solves-it)) are absolutely amazing at crawling through code, identifying patterns and automating the task of renaming functions and variable names. `gemini-cli` supports tool calling so you can use a [model-context protocol](https://modelcontextprotocol.io/docs/getting-started/intro) tool like [GhidrAssistMCP](https://github.com/jtang613/GhidrAssistMCP) to automate the this loop. 

For clarity lets walk through an example loop:

1. Take a target function like `monster_add_cast_spell_to_user` and use the `decompile_function` tool to retrieve the current state of Ghidra's decompiled view of the function.
1. Use the `function_xref` tool to identify which functions have references *to* `monster_add_cast_spell_to_user` and which functions are referenced *from* `monster_add_cast_spell_to_user`. So, for example, you can see that in the source above `get_player`, and `monster_display_spell_success` are referenced *from* `monster_add_cast_spell_to_user`.
1. Loop over the referenced functions and `decompile_function` to retreive their decompiled code.
1. For this example `get_player` is responsible for retreiving a `player` pointer from memory (this is quite obvious from the API calls it uses like `ptrblok`) so we can draw two conclusions from this line of code: `iVar1 = get_player(param_1);`: `iVar1` can be renamed to `player_ptr` and `param_1` is a `player_id`. The `rename_symbol` tool can be called twice to update the Ghidra state.
1. Now if you call `decompile_function(monster_add_cast_spell_to_user)` again the source code will now return `player_ptr = get_player(player_id);` in that line and, like your IDE, those variables will be renamed throughout the entire function so subsequent lines like `if (*(ushort *)(iVar1 + 0x40 + iVar2 * 2) == param_2)` becomes `if (*(ushort *)(player_ptr + 0x40 + iVar2 * 2) == param_2)` and we immediately know we are doing some operation involving a `player` - hugely informative to make the next renaming decisions.

Now you can have `gemini-cli` run this in a loop and you can see how it will, over time, be able to "peel back the layers" of the original code and produce a more-and-more complete view of the code base.

This is the LLM party-trick #1: **summarization** of a huge amount of context - far exceeding the human brain's capacity - to identify patterns.

{{< callout title="Ghidra" >}}
I don't want this to be a Ghidra tutorial but you can also define data structures like `structs` and `enums` in Ghidra. [GhidrAssistMCP](https://github.com/jtang613/GhidrAssistMCP) has tools like the `structs` tool that will allow it to `create` and `update` data structures. Once correctly defined Ghidra will automatically update the decompiled code to show: `player_ptr->spell_ids`.
{{< /callout >}}

Now the problem becomes one of just cost and time to produce: (note this is still in Ghidra `pseudo-c`)

```c

/* Adds a cast spell effect to a player's active spell list. This function attempts to find an
   existing spell by `spell_id`. If found and `can_overwrite_if_stronger` is true, the spell's
   duration and value are updated if the new value is higher. Otherwise, it searches for an empty
   spell slot to add the new spell. A success message is displayed to the player upon successful
   spell addition or update. */

int __cdecl
monster_add_cast_spell_to_user
          (int player_id,ushort spell_id,short duration,int value,spell *spell_ptr,
          monster *monster_ptr,bool can_overwrite_if_stronger_flag)

{
  player *player_ptr;
  int spell_slot_index;
  int empty_spell_slot_index;
  undefined2 unused_stack_var;
  
                    /* 0x25ea6  166  _monster_add_cast_spell_to_user */
  player_ptr = get_player(player_id);
  if ((player_ptr != (player *)0x0) && (spell_ptr != (spell *)0x0)) {
    empty_spell_slot_index = -1;
    spell_slot_index = 0;
    do {
      if (player_ptr->spell_ids[spell_slot_index] == _spell_id) {
        if ((can_overwrite_if_stronger_flag) && (player_ptr->spell_values[spell_slot_index] < value)
           ) {
          player_ptr->spell_values[spell_slot_index] = (short)value;
          player_ptr->spell_durations[spell_slot_index] = duration;
          monster_display_spell_success
                    (player_id,spell_ptr,monster_ptr,player_ptr->given_name,(char *)value);
          return spell_slot_index;
        }
        return -2;
      }
      if (player_ptr->spell_ids[spell_slot_index] == 0) {
        empty_spell_slot_index = spell_slot_index;
      }
      spell_slot_index = spell_slot_index + 1;
    } while (spell_slot_index < 10);
    if (empty_spell_slot_index != -1) {
      player_ptr->spell_ids[empty_spell_slot_index] = spell_id;
      player_ptr->spell_durations[empty_spell_slot_index] = duration;
      player_ptr->spell_values[empty_spell_slot_index] = (short)value;
      monster_display_spell_success
                (player_id,spell_ptr,monster_ptr,player_ptr->given_name,(char *)value);
      return empty_spell_slot_index;
    }
  }
  return -1;
}
```

Now that we have a semi-human-friendly decompiled binary in `pseudo-c`, on to LLM party trick #2: **translation**.

## Claude enters the game ...

Here is a 1:1 translation produced by `claude-opus-4.5`. You can see that my implementation does have a different signature to deal with the `rust` borrow-checker - but you can safely ignore this for this discussion.

To produce this conversion you can basically ask `claude` to (in reality is is not _quite_ this simple but this is good enough for demonstration purpose):

```bash
retrieve the monster_add_cast_spell_to_user function from ghidra and rewrite-it-in-rust 
```

... and it produces:

```rust
/// Adds a spell cast by a monster to a player's active spells.
///
/// Handles checking if a spell already exists and optionally overwriting it
/// if the new value is stronger. Uses the last available empty slot.
///
/// Returns Some(slot_index) on success, or None on failure.
pub fn monster_add_cast_spell_to_user(
    &self,
    player_id: PlayerId,
    spell: &'static Spell,
    duration: i16,
    value: i16,
    can_overwrite_if_stronger: bool,
    game: &mut Game,
    messages: &'static Messages,
    players: &mut Players,
    rooms: &Rooms,
) -> Option<usize> {
    let player = players.get(&player_id)?;

    // Find existing spell or last empty slot
    let mut empty_slot = None;
    let mut existing_slot = None;

    for (i, active_spell_opt) in player.active_spells.iter().enumerate() {
        match active_spell_opt {
            Some(active_spell) if active_spell.spell.id == spell.id => {
                existing_slot = Some((i, active_spell.value));
                break;
            }
            None => empty_slot = Some(i),
            _ => {}
        }
    }

    // Determine which slot to use and whether to proceed
    let slot = match existing_slot {
        Some((i, existing_value)) => {
            if can_overwrite_if_stronger && existing_value < value {
                i
            } else {
                return None;
            }
        }
        None => empty_slot?,
    };

    // Get player name before mutable borrow, then update the spell slot
    let player_name = player.given_name.clone();
    players.get_mut(&player_id).unwrap().active_spells[slot] =
        Some(PlayerActiveSpell { spell, value, duration });

    self.monster_display_spell_success(
        Some(player_id),
        spell,
        &player_name,
        &value.to_string(),
        game,
        messages,
        players,
        rooms,
    );

    Some(slot)
}
```

{{< callout title="Why Rust?" >}}
To prepare for the inevitable question: because I enjoy writing [Rust](https://rust-lang.org/). I like its tooling, I like thinking about how efficiency/allocations/deallocations/ownership work, I like writing [functional code](https://doc.rust-lang.org/book/ch00-00-introduction.html?highlight=zero-cost#people-who-value-speed-and-stability) and I like being able to mentally delegate a huge amount of work to the compiler.
{{< /callout >}}

## How do we know it works?

The million dollar question now becomes one of verification: how do we know that we translated it correctly?

{{< callout title="The confident accountant" >}}
Interviewer: "I heard you are extremely quick at math."

Me: "That's correct."

Interviewer: "What is 14 multiplied by 27?"

Me: "600!"

Interviewer: "That's not even close."

Me: "Yeah, but it was fast."
{{< /callout >}}

Large Language Models, when used in agentic loops, achieve their best results when they can 'close the loop', i.e., they have a way of evaluating a success condition.

![Agentic Loop](<../../img/2026/agentic-loop.webp> "Source: [Anthropic](https://www.anthropic.com/engineering/building-effective-agents)")

At their core Large Language Models, while highly advanced, are [statistically reconstructing](https://garymarcus.substack.com/p/humans-versus-machines-the-hallucination) patterns from the training data. Statistical reconstruction proves effective on known problems but is susceptible to [hallucinations](https://en.wikipedia.org/wiki/Hallucination_(artificial_intelligence)) when faced with novel problems (data that is out of distribution in the training data). So, if you are writing a React App connecting to a RESTful backend they are _likely_ to so with few hallucinations as they have ingested millions? of code bases that do largely the same operations. But how many people are silly enough to embark on translating 80,000 lines of obfuscated `pseudo-C` (... and to make my life worse I also changed the storage to a relational database). Hallucinations are a problem _unless_ you can close that feedback loop.

My answer is [differential](https://en.wikipedia.org/wiki/Differential_testing), [property](https://en.wikipedia.org/wiki/Software_testing#Property_testing) testing.


### The Setup

#### Problem:

To be able to setup a harness we first need to solve a few problems:

1. The Ghidra `pseudo-C` does not produce `c` so we cant easily compile it and use codegen to create bindings to call it now as a native binary.
1. Even if we could compile the Ghidra `pseudo-C` there are many `WGSERVER`/`MajorBBS` API calls which would need to be [implemented](https://www.mbbsemu.com/) for it to be usable.

What I need is a way to run the original Win32 x86 code ... on my Macbook?


#### Solution:

My solution is a miracle of engineering (read: [QEMU](https://en.wikipedia.org/wiki/QEMU) magic):

![Infrastructure](../../img/2026/architecture.svg)

1. Development occurs within an aarch64 [devcontainer](https://containers.dev/) - so the MacOS Docker engine is running an aarch64 Linux 6.17.8 kernel in a virtual machine.                 
1. Inside the container [Wine](https://www.winehq.org/) can run Windows 32-bit x86 binaries produced by the Rust `i686-pc-windows-gnu` target - transparently spawning another layer of virtual machines.
1. The DLL is reflectively loaded into memory - headers are parsed, sections are mapped, and base relocations are applied if the preferred address (`0x400000`) is unavailable.
1. Calls to `WGSERVER`/`MajorBBS` APIs (like `prf`, `alcmem`, `dfaQuery`, `genrdn`) are resolved to Rust mock implementations, making operations like random number generation deterministic.
1. Inline hooks redirect `get_*_data()` functions so the DLL reads/writes boxed `#[repr(C, packed)]` structs owned by Rust - enabling bidirectional mutation of both implementations.
1. Function addresses are calculated from known [Relative Value Address](https://en.wikipedia.org/wiki/Base_address) (RVA) offsets, allowing each DLL function to be invoked in isolation.
1. Rust entities are converted via `entity.to_wcc_*()` to C-compatible structs matching the original DLL byte layout, then inserted into shared state before test execution.

![Setting up a harness](../../img/2026/setup.svg)

This is an extremely complex setup that was *fully implemented by Claude Opus 4.5* (with quite a bit of steering) - but it **works**.

### The testing

Now we have a way to execute the original and re-implemented implementations alongside each other, how do we know _what_ to test?

#### Problem:

Again, let's discuss problems:

1. The `Wine` executor allows us to execute the DLL but it prevents us from measuring `coverage` (due to the execution model) to ensure we have covered all the code paths within the a function.
1. If we generate coverage from only the translated Rust side how do we know we have covered all the code paths?

![The testing](../../img/2026/test.svg)

#### Solution:

My answer is a loop using a combination of [property testing](https://github.com/proptest-rs/proptest) and [differential testing](https://en.wikipedia.org/wiki/Differential_testing) combined with the Rust-only coverage to inform when to add additional property tests. This will not guarantee all paths are hit but side-effects (i.e. game state mutation) not covered in the Rust coverage should be caught by differential testing allowing them to be debugged and added to the test.

So let's take a tiny function:

```rust
impl Player {
    /// Adds a delay to the player's delay counter.
    pub fn add_delay(&mut self, delay: u8) {
        self.delay = self.delay.wrapping_add(delay);
    }
}
```

and review the tests:

```rs
#[cfg(test)]
mod tests {
    use proptest::prelude::*;

    use crate::game::{
        enums::{ClassType, RaceType},
        players::Player,
        runtime::get_test_runtime,
    };

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(256))]

        /// Property-based differential test for add_delay.
        ///
        /// Generates random player delay and addition values, comparing Rust vs DLL.
        #[test]
        fn test_add_delay_differential(
            initial_delay in any::<u8>(),
            delay_to_add in any::<u8>(),
        ) {
            // Create the rust state
            let mut rt = get_test_runtime();

            // Create the player
            let mut player = Player::new(
                "PropTestPlayer".to_string(),
                &mut rt.game,
                &rt.races[&RaceType::Human],
                &rt.classes[&ClassType::Warrior],
            );

            // Mutate the player
            player.delay = initial_delay;

            // Create the Windows world from the Rust world
            #[cfg(target_os = "windows")]
            let mut harness = unsafe {
                crate::differential::dll_harness::DllHarness::from_runtime(&rt)
            };

            // Inject the player to match Rust
            #[cfg(target_os = "windows")]
            let harness_slot = {
                let slot = player.id.0 as u16;
                harness.state.players.insert(slot, Box::new(player.to_wcc_player()));
                slot
            };

            // Run Rust implementation
            player.add_delay(delay_to_add);

            // Windows: Run DLL and compare
            #[cfg(target_os = "windows")]
            {
                unsafe {
                    harness.add_delay(harness_slot, delay_to_add);
                }

                let dll_player = unsafe { harness.get_player(harness_slot).unwrap() };

                prop_assert_eq!(player, dll_player);
            }
        }
    }
}
```

In this example the two variables `initial_delay in any::<u8>()` and `delay_to_add in any::<u8>()` will be tested with different combinations of only `u8` values (so 256 * 256 = 65,536 possibilities). For more interesting data types the [Arbitrary](https://docs.rs/proptest/latest/proptest/arbitrary/trait.Arbitrary.html) trait can be implemented to restrict the random range ([any](https://docs.rs/proptest/latest/proptest/arbitrary/fn.any.html) implements `Arbitrary`). For example there is no point generating a full range of `u16` foreign-key values if only `0..1398` exist:

```rust
#[cfg(test)]
impl SpellId {
    /// Generate a random valid spell ID (hardcoded range from game database: 1..=1398).
    pub fn arbitrary() -> impl proptest::strategy::Strategy<Value = SpellId> {
        use proptest::prelude::*;
        (1u32..=1398).prop_map(SpellId)
    }
}
```

The use of the `target_os` means this test will run as a purely property based test when executed via a normal Rust build to calculate coverage and be a basic smoke-test. Then the `Wine` Windows build can do differential testing of Rust vs the DLL to uncover differences in translation.

I've written [previously](http://localhost:1313/posts/sqlite-transactions/#foundationdb) about my admiration of the FoundationDB's [deterministic-simulation](https://www.youtube.com/watch?v=4fFDFbi3toc) and that is what this harness allows. PropTest provides the [PROPTEST_RNG_SEED](https://docs.rs/proptest/latest/proptest/test_runner/struct.Config.html#structfield.rng_seed) and [PROPTEST_RNG_ALGORITHM](https://docs.rs/proptest/latest/proptest/test_runner/struct.Config.html#structfield.rng_algorithm) environment variables so you can easily create deterministic test cases that are reproducible in the event of test-case failure (and can easily be distributed on multiple machines):

```bash
#!/bin/bash
for seed in $(seq 0 100); do
  echo "=== seed=$seed ==="
  PROPTEST_FORK=true PROPTEST_VERBOSE=1 PROPTEST_RNG_SEED=$seed PROPTEST_RNG_ALGORITHM=cc PROPTEST_CASES=1 \
    cargo test --release -- --nocapture
  if [ $? -ne 0 ]; then
    echo "FAILED at seed=$seed"
    exit 1
  fi
done
echo "All seeds passed"
```

## So what's next?

As I said, this process is mainly for my learning and benchmarking the core foundation model's evolving capabilities. A year ago Claude and Gemini were simply far, far worse at this task - next year, will they be able to one-shot this?

I would really love to be able to run this on my own infrastructure. We know local models are getting better but hardware is simply too expensive - but a local NVIDIA RTX PRO 6000 Blackwell Workstation Edition would be nice (hint NVIDIA) or an AMD Strix Halo 128GB (hint AMD).

Note: I will not be releasing the code as I don't own the underlying intellectual property and I ask that you do not either if you also perform this task on the same binary.
