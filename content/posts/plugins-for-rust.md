---
title: "Plugins for Rust"
date: 2023-01-27
draft: false
tags: ["development", "rust"]
---

Plugins are a useful way to allow advanced users to add new functions your software without having to modify the main program itself. With [interpreted languages](<https://en.wikipedia.org/wiki/Interpreter_(computing)>) like JavaScript or Python this can be relatively easy as the runtime itself is able to execute arbitrary instructions without them having to be compiled first. Rust is a compiled lanaguage so does not have a method of executing abritrary instructions prior to compilation so adding functions generally requires rewriting them in Rust and redeploying the binary.

So while interpreted languages are very convenient for executing arbitrary code (\* written in the same language) this is not without risk as these commands are often executed in the same security context as the host and could potentially execute malicious code or access resources they should not.

With that in mind, my ideal requirements for a plugin system are:

- A user is able to execute arbitrary code provided in a language that is relatively well known/popular.
- Code is executed in a sandbox so users cannot access resources that are not explicitly granted.
- The code is executed at a _reasonable_ level of performance - where _reasonable_ depends on the use case.

While a lot of [excellent articles](https://nullderef.com/blog/plugin-tech/) have been written on the topic the purpose of this post is to explore the performance of a WebAssembly and specifically a [WebAssembly System Interface](https://wasi.dev/) (WASI) approach.

# WebAssembly and WebAssembly System Interface

Despite the name, [WebAssembly](https://en.wikipedia.org/wiki/WebAssembly) is better thought of as a portable binary-code format that can produced by many languages and run in a virtual machine - the `Web` part is a bit of a misnomer as browsers have just one implementation of the virtual machine. Rust already has an excellent and well supported library [wasmtime](https://github.com/bytecodealliance/wasmtime) that implements a virtual machine/sandbox that is able to interpet a compiled `WASM` module and execute it. `wasmtime` also implements the [WebAssembly System Interface](https://wasi.dev/) specification allowing explicit permissions to access host resources such as access to the host filesystem.

# Arbitrary Code Execution

To meet the first requirement, arbitrary code execution, we need some sort of interpreter that is able to be run within the Rust binary and be called with an instruction provided by the user that it executes and returns a response - a [scripting language](https://en.wikipedia.org/wiki/Scripting_language). While it is tempting to consider a language like [Lua](<https://en.wikipedia.org/wiki/Lua_(programming_language)>) which is almost ideal for this purpose instead I am limiting this search to either [Python](<https://en.wikipedia.org/wiki/Python_(programming_language)>) or [JavaScript](https://en.wikipedia.org/wiki/JavaScript) both due to their ubiquity (extremly easy to find developers) and easy integration with WebAssembly.

Whilst Python is now able to be built for WebAssembly (see https://github.com/singlestore-labs/python-wasi/) it is an extremely large binary (the binary Python 3.11 WASM file is more than 100MB).

Instead I am focusing on a comparatively tiny JavaScript interpreter called [QuickJS](https://bellard.org/quickjs/) which is relatively tiny at ~1MB and still passes [nearly 100%](https://test262.report/) of the ECMAScript Test Suite. [Shopify](https://www.shopify.com/), via the [javy](https://github.com/Shopify/javy) project have created excellent Rust bindings [quickjs-wasm-sys](https://github.com/Shopify/javy/tree/main/crates/quickjs-wasm-sys) and [quickjs-wasm-rs](https://github.com/Shopify/javy/tree/main/crates/quickjs-wasm-rs) which allow `QuickJS` to be build for the `WASI` target with minimal effort and, as we will explore below, offer some additional useful features for interacting with QuickJS.

# Performance

Now we have selected a chosen runtime (`wasmtime`) and interpreter (`quickjs`) we now need to test whether that combination can meet our performance requirements.

## Some Arbitrary Code

To be somewhat realistic we need a contrived example of some code to execute in the plugin.

This example we will be using data captured by an imaginary running watch that periodically records latitude/longitude/altitude measurements as JSON objects (we have 260 `features` like below) and we want to calculate the total distance of the run but, users being users, have raised a feature request to calculate the distance of their runs in the [Canadian Football Fields](https://en.wikipedia.org/wiki/Canadian_football_field) measure. Instead of building such an obscure request into our software we decide to use a plugin allowing us to meet this request plus any of these [unusual units of measurement](https://en.wikipedia.org/wiki/List_of_unusual_units_of_measurement) requests without having to alter our main code base.

```json
{
  "type": "FeatureCollection",
  "name": "track_points",
  "crs": {
    "type": "name",
    "properties": {
      "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
    }
  },
  "features": [
    {
      "type": "Feature",
      "properties": {
        "track_fid": 0,
        "track_seg_id": 0,
        "track_seg_point_id": 1,
        "ele": 60,
        "time": "2023-01-22 00:00:00+00"
      },
      "geometry": { "type": "Point", "coordinates": [151.22989, -33.89279] }
    },
    {
      "type": "Feature",
      "properties": {
        "track_fid": 0,
        "track_seg_id": 0,
        "track_seg_point_id": 2,
        "ele": 66,
        "time": "2023-01-22 00:00:56+00"
      },
      "geometry": { "type": "Point", "coordinates": [151.23077, -33.89159] }
    }
  ]
}
```

To do the calculation we want to first implement a function to calculate the distance between two points.

```js
// simple approximate distance function returning distance between two points in meters
function distance(lat0, lon0, lat1, lon1) {
  if (lat0 == lat1 && lon0 == lon1) {
    return 0;
  } else {
    const radlat0 = (Math.PI * lat0) / 180;
    const radlat1 = (Math.PI * lat1) / 180;
    const theta = lon0 - lon1;
    const radtheta = (Math.PI * theta) / 180;
    let dist =
      Math.sin(radlat0) * Math.sin(radlat1) +
      Math.cos(radlat0) * Math.cos(radlat1) * Math.cos(radtheta);
    if (dist > 1) {
      dist = 1;
    }
    dist = Math.acos(dist);
    dist = (dist * 180) / Math.PI;
    return dist * 60 * 1853.159;
  }
}
```

Then reduce the list of points to calculate the total distance.

```js
// calculate the total length of a set of input features in canadian football fields
function calculate(data) {
  // canadian football fields are 140 meters
  const candadian_football_field = 140;

  return data.features.reduce(
    (accumulator, currentValue, currentIndex, array) => {
      if (currentIndex == 0) {
        return 0;
      } else {
        const previousValue = array[currentIndex - 1];
        const dist = distance(
          currentValue.geometry.coordinates[1],
          currentValue.geometry.coordinates[0],
          previousValue.geometry.coordinates[1],
          previousValue.geometry.coordinates[0]
        );
        return accumulator + dist / candadian_football_field;
      }
    },
    0
  );
}
```

## WASM Interfacing

It is still somewhat difficult to get data in and out of a `WASM` virtual machine as it does not directly expose use of all of the [types](https://webassembly.github.io/spec/core/syntax/types.html) you may be used to. Thanks to an excellent blog post by [Peter Malmgren](https://petermalmgren.com/serverside-wasm-data/) who explores different options for passing data into a WASM instance I have implemented his 'Approach 2: Using exported functions and memory' pattern. The benefit of this approach is that it allows the the virtual machine `stdout` and `stderr` to be disabled and it is easy to add additional host functions to expose to the WASM instance.

```rust
linker.func_wrap(
    "host",
    "get_input_size",
    move |_: Caller<'_, WasiCtx>| -> Result<i32> { Ok(input_size) },
)?;
```

You can see the code for the two halves of the interface code here:

- [WASM](https://github.com/seddonm1/quickjs/blob/e9d8afd6e8f74d41e674a30821a344d3423b8260/crates/quickjs-wasm/src/io.rs) interface code.
- Host [wasmtime](https://github.com/seddonm1/quickjs/blob/e9d8afd6e8f74d41e674a30821a344d3423b8260/crates/quickjs/src/lib.rs#L65) interface code.

## Baseline

The initial naive implementation is to instantiate a new QuickJS `Context`, retrieve the input string from the host, execute it and return the output. This is executing in `8.2ms` per iteration which is definitely not quick. The benchmarks below were run using [this code](https://github.com/seddonm1/quickjs/blob/e9d8afd6e8f74d41e674a30821a344d3423b8260/crates/quickjs/benches/benchmark.rs).

At this stage it is sensible to ask why we are instantiating a new runtime each execution? Firstly as there is a chance to [leak memory](https://github.com/bytecodealliance/wasmtime/issues/2751) and secondly then our isolation guarantees (between executions) become weaker.

```bash
try_execute             time:   [8.3125 ms 8.3329 ms 8.3544 ms]
Found 5 outliers among 100 measurements (5.00%)
  1 (1.00%) low mild
  3 (3.00%) high mild
  1 (1.00%) high severe
```

Code:

```rust
mod io;

use anyhow::Result;
use quickjs_wasm_rs::Context;

static SCRIPT_NAME: &str = "script.js";

fn main() -> Result<()> {
    let context = Context::default();

    match io::get_input_string()? {
        Some(input) => {
            let output = context.eval_global(SCRIPT_NAME, &input)?;
            io::set_output_value(Some(output))
        }
        None => io::set_output_value(None),
    }
}
```

## Wizer

In this 2021 post [Making JavaScript run fast on WebAssembly](https://bytecodealliance.org/articles/making-javascript-run-fast-on-webassembly) Mozilla introduced the idea of taking snapshots of a WASM virtual machine state allowing work to be performed at WASM 'compile' time rather than at run time. In this case we know we need a QuickJS `Context` each execution so if we were able to instantiate this once rather than in each execution then there should be some performance improvenment. A tool called [Wizer](https://github.com/bytecodealliance/wizer) has been built to achieve this.

In this case there _may be_ a very slighty improvement of around 2% (100-200µs) per iteration which is not much but may add up if this function is executed millions of times per day and for such little effort there is no real reason not to do it.

```bash
try_execute             time:   [8.0596 ms 8.0959 ms 8.1350 ms]
                        change: [-3.3404% -2.8433% -2.3509%] (p = 0.00 < 0.05)
                        Performance has improved.
Found 2 outliers among 100 measurements (2.00%)
  2 (2.00%) high mild
```

Code:

```rust
static mut JS_CONTEXT: OnceCell<Context> = OnceCell::new();

#[export_name = "wizer.initialize"]
pub extern "C" fn init() {
    unsafe {
        let context = Context::default();

        JS_CONTEXT.set(context).unwrap();
    }
}

fn main() -> Result<()> {
    let context = unsafe { JS_CONTEXT.get().unwrap() };
```

## Wizer+

Given that the QuickJS `Context` does not improve the `8.1ms` execution time, what would happen if we could move more logic into the `wizer.initialize` code like registering the `distance` and `calculate` functions as it must take at least some time for QuickJS to parse the string representation into internal binary code?

The benchmarks suggest this is not much of a problem but does come with a major downside: a custom `WASM` module will have to be built and deployed for each combination of required functions. Unfortunately, at time of writing, Wizer is unable to support both `.make_linker(...)` and `allow_wasi` which would allow a one time injection and snapshot of these functions at runtime.

```bash
try_execute             time:   [7.9269 ms 7.9709 ms 8.0195 ms]
                        change: [-2.2372% -1.5439% -0.8280%] (p = 0.00 < 0.05)
                        Change within noise threshold.
Found 4 outliers among 100 measurements (4.00%)
  2 (2.00%) high mild
  2 (2.00%) high severe
```

## Calculation or Parsing?

At this stage we have eliminated the QuickJS `Context` and `wizer.initialize`ing the `distance` and `calculate` functions as the source of slowness leaving two remaining candidates as the source of the poor performance; getting the `data` object into QuickJS and the actual calculation time. The easiest way to test this is to also move the `data` element into the `wizer.initialize` function so that the script execution is running against already instantiated data.

This benchmark clearly shows that the actual calculation is only around 11% of the execution time so the biggest gain will be from working out how to more efficiently pass in `data`.

```time
try_execute             time:   [890.44 µs 898.09 µs 906.87 µs]
                        change: [-88.793% -88.647% -88.501%] (p = 0.00 < 0.05)
                        Performance has improved.
Found 6 outliers among 100 measurements (6.00%)
  4 (4.00%) high mild
  2 (2.00%) high severe
```

Code:

```js
calculate(data);
```

## Javy to the rescue

At this stage we can re-examine at the `Javy` code and see that a lot of the work they have done appears to have followed this same process. The `quickjs-wasm-rs` package has the `json` or `msgpack` feature flags which enable different serialization options for getting data in and out of the QuickJS `Context`. These functions construct the QuickJS `Value` objects directly from an input `json` string (or serialized `msgpack` bytes) rather than relying on the QuickJS parser to parse the 100KB+ input string.

The benchmarks show a large reduction from the original `8.1ms` to just `2.5ms` per execution with the `json` approach with a minor downside that the input data is set to a fixed global variable `data` (but this could also be set via another call to the host if desired). The code also uses a completely generic `WASM` module that is not custom compiled for each deployment allowing it to execute any arbitrary code.

```bash
try_execute             time:   [2.5336 ms 2.5513 ms 2.5724 ms]
                        change: [-68.282% -67.992% -67.677%] (p = 0.00 < 0.05)
                        Performance has improved.
Found 6 outliers among 100 measurements (6.00%)
  4 (4.00%) high mild
  2 (2.00%) high severe
```

## Parallel

Finally we will explore parallelization with the excellent [rayon](https://github.com/rayon-rs/rayon) libary. As each execution is running in a single thread and each execution is a pure function we can easily run them in parallel - which may or may not make sense for your use case. Some care needs to be taken here as instantiating a Rayon task per execution does incur quite a lot of scheduling cost so `chunk`ing into partitions and executing in parallel gives best results.

Here 1000 iterations are executed in parallel on a 16 core laptop:

```bash
cargo run --release --example par_iter

elapsed: 475.869146ms
iteration: 475.869µs
```

The sequential example is also available via:

```bash
cargo run --release --example iter
```

# Conclusion

In this series of steps I have demonstrated a plugin system for Rust that meets my goals of arbitrary code execution in a sandboxed environment at a _reasonable_ `2.5ms` execution speed.

The code for this post is available at https://github.com/seddonm1/quickjs.
